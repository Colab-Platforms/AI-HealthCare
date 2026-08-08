const HealthScoreConfig = require('../models/HealthScoreConfig');
const DailyHealthScore = require('../models/DailyHealthScore');
const HealthReport = require('../models/HealthReport');
const HealthMetric = require('../models/HealthMetric');
const User = require('../models/User');
const { scoreBloodPressure } = require('./healthScoreFormulas');

// The analyser mostly emits normal/high/low, but not exclusively — anything
// unmapped was silently dropped from the Clinical Score, so a report full of
// "borderline" results scored on whatever handful of markers happened to use
// the expected words.
// Statuses are matched loosely (lowercased, non-letters stripped) because the
// analyser's wording varies between reports. Anything unrecognised is dropped
// from the Clinical Score entirely, and dropping an abnormal marker RAISES the
// score — so the synonyms below matter: an unmapped "abnormal" made the report
// look better than an mapped "high" would have.
const STATUS_SCORE_MAP = {
  optimal: 95, good: 92, normal: 90, withinrange: 90, desirable: 90,
  borderline: 70, borderlinehigh: 70, borderlinelow: 70,
  elevated: 60, moderate: 60, mild: 70,
  high: 45, low: 45, abnormal: 45, outofrange: 45, deficient: 45, insufficient: 45,
  veryhigh: 30, verylow: 30, severe: 30,
  critical: 20, criticallyhigh: 20, criticallylow: 20, danger: 20,
};

const normaliseStatus = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

// Statuses that mean "this needs a doctor now", whatever the marker is.
const CRITICAL_STATUSES = new Set(['critical', 'criticallyhigh', 'criticallylow', 'danger']);

// How much a report still counts, given its age. A panel from two years ago
// describes a body that no longer exists; treating it as current overstates
// what is actually known about this person today.
function reportRecencyFactor(report, config) {
  const cfg = config.clinicalRecency || { fullWeightDays: 90, zeroWeightDays: 540, floor: 0.35 };
  const taken = report?.reportDate || report?.createdAt;
  if (!taken) return 1;

  const ageDays = (Date.now() - new Date(taken).getTime()) / 86400000;
  if (ageDays <= cfg.fullWeightDays) return 1;
  if (ageDays >= cfg.zeroWeightDays) return cfg.floor;

  const decayed = (ageDays - cfg.fullWeightDays) / (cfg.zeroWeightDays - cfg.fullWeightDays);
  return 1 - decayed * (1 - cfg.floor);
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function daysAgoStr(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split('T')[0];
}

// Clinical Score: mean of per-marker normalized scores on the latest report.
// Blood pressure is scored via clinical AHA categories (see
// healthScoreFormulas.scoreBloodPressure) using the dedicated HealthMetric
// log — not the report's free-text value — since it's already structured
// (systolic/diastolic) there. Every other marker uses the AI's own
// normal/high/low classification, since that's the only reliably-structured
// signal the report analysis currently emits per marker.
const normaliseMarkerKey = (key) => String(key).toLowerCase().replace(/[^a-z0-9]/g, '');

// Finds any marker whose numeric value breaches a lab "panic value" threshold.
// These are values that need a doctor, not a score — see the comment on
// criticalMarkerRanges in HealthScoreConfig for why averaging them is unsafe.
function findCriticalFindings(metrics, config) {
  const ranges = config.criticalMarkerRanges || [];
  const findings = [];

  for (const [key, marker] of Object.entries(metrics || {})) {
    // The analyser's own verdict is honoured for ANY marker, listed or not.
    // The threshold table below only covers fifteen well-known markers; without
    // this, a report flagging something outside that list as critical — a raised
    // troponin, say — scored low but raised no alert and left the score
    // uncapped, which is the exact failure the safety net exists to prevent.
    if (CRITICAL_STATUSES.has(normaliseStatus(marker?.status))) {
      findings.push({
        marker: key,
        value: Number.isFinite(Number(marker?.value)) ? Number(marker.value) : null,
        unit: marker?.unit || null,
        direction: 'critical',
      });
      continue; // already flagged; no need to also range-check it
    }

    const value = Number(marker?.value);
    if (!Number.isFinite(value)) continue;

    const rule = ranges.find((r) => normaliseMarkerKey(r.marker) === normaliseMarkerKey(key));
    if (!rule) continue;

    // Guard against unit mismatches. The same healthy platelet count reads as
    // "2.4" (lakh/µL) or "240000" (/µL) depending on the lab; compared against
    // thresholds written for the first, the second looks catastrophically
    // high. A value outside the physiologically possible span is a different
    // unit, not an emergency — skip it rather than raise a false alarm.
    const belowPlausible = rule.plausibleMin != null && value < rule.plausibleMin;
    const abovePlausible = rule.plausibleMax != null && value > rule.plausibleMax;
    if (belowPlausible || abovePlausible) continue;

    const tooLow = rule.low !== null && rule.low !== undefined && value <= rule.low;
    const tooHigh = rule.high !== null && rule.high !== undefined && value >= rule.high;
    if (tooLow || tooHigh) {
      findings.push({
        marker: rule.label || key,
        value,
        unit: rule.unit,
        direction: tooLow ? 'low' : 'high',
      });
    }
  }

  return findings;
}

// Clinical Score: markers are collapsed into their family first, then the
// families are averaged with clinical-impact weights.
//
// A flat per-marker average had two problems. Body temperature counted as much
// as HbA1c. And a standard blood panel carries six red-cell indices (Hb, Hct,
// RBC, MCV, MCH, MCHC) all measuring one thing — so a single anaemia moved the
// score six times while kidney function moved it once. Grouping also removes
// the panel-size dependence, where ordering a bigger test lowered the score
// purely by giving more markers a chance to be flagged.
async function calculateClinicalScore(userId, config) {
  const latestReport = await HealthReport.findOne({ user: userId, status: 'completed' })
    .sort({ createdAt: -1 })
    .lean();
  if (!latestReport?.aiAnalysis?.metrics) return null;

  const metrics = latestReport.aiAnalysis.metrics;
  const groups = config.markerGroups || [];
  const groupFor = (key) => {
    const norm = normaliseMarkerKey(key);
    return groups.find((g) => (g.markers || []).some((mk) => normaliseMarkerKey(mk) === norm));
  };

  // marker scores bucketed by group; ungrouped markers keep weight 1 each
  const grouped = new Map(); // groupName -> { weight, scores[] }
  const ungrouped = [];

  let unscoredMarkers = 0;

  for (const [key, marker] of Object.entries(metrics)) {
    const score = STATUS_SCORE_MAP[normaliseStatus(marker?.status)];
    if (score === undefined) {
      // Counted rather than ignored silently: if a report's wording drifts and
      // most markers stop being recognised, the Clinical Score would quietly be
      // built from the handful that still matched. Surfacing the number makes
      // that visible instead of invisible.
      unscoredMarkers += 1;
      continue;
    }

    const group = groupFor(key);
    if (!group) {
      ungrouped.push({ weight: 1, score });
      continue;
    }
    if (!grouped.has(group.name)) grouped.set(group.name, { weight: group.weight, scores: [] });
    grouped.get(group.name).scores.push(score);
  }

  const weighted = [
    ...[...grouped.values()].map((g) => ({
      weight: g.weight,
      score: g.scores.reduce((a, b) => a + b, 0) / g.scores.length, // collapse the family first
    })),
    ...ungrouped,
  ];

  const criticalFindings = findCriticalFindings(metrics, config);

  // A separately logged blood pressure reading is only used while it's recent.
  // An old one is worse than none: it presents a stale number as current, and
  // BP is exactly the marker people log precisely because it changes.
  const latestBP = await HealthMetric.findOne({ userId, type: 'blood_pressure' }).sort({ recordedAt: -1 }).lean();
  const bpAgeDays = latestBP ? (Date.now() - new Date(latestBP.recordedAt).getTime()) / 86400000 : Infinity;

  if (latestBP?.systolic && latestBP?.diastolic && bpAgeDays <= 90) {
    // Blood pressure is a high-impact marker and already clinically scored, so
    // it enters at the same weight as the other cardiometabolic families.
    weighted.push({ weight: 1.5, score: scoreBloodPressure(latestBP.systolic, latestBP.diastolic, config.bloodPressureCategories) });

    // Critical detection previously only looked at the report's own markers, so
    // a hypertensive-crisis reading logged through Vitals — the most likely way
    // it gets recorded — raised no alert at all.
    criticalFindings.push(...findCriticalFindings({
      BloodPressureSystolic: { value: latestBP.systolic },
      BloodPressureDiastolic: { value: latestBP.diastolic },
    }, config));
  }

  if (weighted.length === 0) return null;

  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  const score = weighted.reduce((sum, w) => sum + w.score * w.weight, 0) / totalWeight;

  return {
    score,
    report: latestReport,
    criticalFindings,
    recencyFactor: reportRecencyFactor(latestReport, config),
    markersScored: weighted.length,
    unscoredMarkers,
  };
}

// Risk Adjustment: a severe marker multiplicatively derates the WHOLE score
// (floored, never averaged away) — see docs/health-score-formulas.md Sec 6.2.
function calculateRiskAdjustmentFactor(report, config) {
  const risk = config.riskAdjustment || {};
  const weights = risk.severityWeights || { mild: 0.05, moderate: 0.15, severe: 0.3 };
  const deficiencies = report?.aiAnalysis?.deficiencies || [];
  const totalSeverity = deficiencies.reduce((sum, d) => sum + (weights[d.severity] || 0), 0);
  return Math.max(risk.floor ?? 0.6, 1 - totalSeverity);
}

// Today's Daily Score, carried straight into the Overall Score.
//
// This slot used to hold a 30-day average of Daily Scores. That made the
// Overall Score very stable, but it also meant a good (or bad) day today was
// diluted to 1/30th and barely moved the number — the user couldn't see the
// effect of what they'd just done. Using today's score directly makes that
// effect immediate and visible.
//
// The trade-off is deliberate and worth knowing: the Overall Score is now
// noticeably more volatile day to day, and a single bad day pulls it down.
// Consistency and Trend are what keep it anchored to longer-term behaviour.
//
// A day with nothing logged has a persisted row with finalScore 0 — that's
// "not logged yet", not "scored zero", so it's excluded rather than dragging
// the Overall Score to the floor every morning.
async function calculateTodayScore(userId) {
  const today = await DailyHealthScore.findOne({ userId, date: todayStr() }).lean();
  if (!today || Object.keys(today.components || {}).length === 0) return null;
  return today.finalScore;
}

// A row exists for any day the engine ran, including days the user logged
// nothing (finalScore 0, no components). Those are "not recorded", not "scored
// zero" — counting them as history understates every average and lets a user
// who opened the app on 30 silent days look like they have 30 days of data.
const isLoggedDay = (d) => Object.keys(d.components || {}).length > 0;

// Consistency: of the last N CALENDAR days, on how many did the user actually
// log their activities?
//
// The denominator is the number of days that have passed, not the number of
// score rows on file. A row is created whenever the engine runs — including
// when the user merely opens the app — so dividing by row count meant someone
// who opened the app twice in a month and logged on both occasions scored
// 100% consistent, having done nothing on the other 28 days.
//
// The numerator counts days with at least `minComponentsForLoggedDay`
// activities, so opening the app or logging a single stray item doesn't count
// as "kept up with it" — this measures logging activities, not app usage.
//
// The window is capped at how long the user has actually been on the app, so a
// three-day-old account isn't scored against 14 days of imagined inactivity.
async function calculateConsistencyScore(userId, config) {
  const windowDays = config.consistencyWindowDays || 14;
  const minComponents = config.minComponentsForLoggedDay || 3;

  const firstEver = await DailyHealthScore.findOne({ userId }).sort({ date: 1 }).select('date').lean();
  if (!firstEver) return null;

  const daysSinceJoining = Math.floor(
    (new Date(`${todayStr()}T00:00:00.000Z`) - new Date(`${firstEver.date}T00:00:00.000Z`)) / 86400000,
  ) + 1;

  const effectiveWindow = Math.min(windowDays, daysSinceJoining);
  if (effectiveWindow < config.minHistoryDays.consistency) return null; // too new to judge regularity

  const rows = await DailyHealthScore.find({
    userId,
    date: { $gte: daysAgoStr(effectiveWindow - 1) },
  }).select('date components').lean();

  const loggedDays = rows.filter((d) => Object.keys(d.components || {}).length >= minComponents).length;
  return 100 * (loggedDays / effectiveWindow);
}

// Trend: recent 7-day average vs the preceding period average, mapped to a
// ±15-point bonus/malus (not a raw percentage — a modest nudge, not a swing
// large enough to dominate the composite).
async function calculateTrendScore(userId, config) {
  const days = (await DailyHealthScore.find({ userId, date: { $gte: daysAgoStr(29) } }).sort({ date: 1 }).lean())
    .filter(isLoggedDay); // unlogged days would drag both window averages toward 0
  if (days.length < config.minHistoryDays.trend) return null;

  const recentWindow = days.slice(-7);
  const priorWindow = days.slice(0, -7);
  if (priorWindow.length === 0) return null; // need a "before" period to compare against

  const avg = (arr) => arr.reduce((s, d) => s + d.finalScore, 0) / arr.length;
  const recentAvg = avg(recentWindow);
  const priorAvg = avg(priorWindow);
  const delta = recentAvg - priorAvg; // in score points, roughly -100..100

  const bonus = Math.max(-15, Math.min(15, delta)); // clamp to ±15
  return 50 + bonus; // expressed on the same 0-100 scale as other components (50 = flat/no change)
}

async function calculateLongTermScore(userId) {
  const config = await HealthScoreConfig.findOne({ isActive: true }).lean();
  if (!config) throw new Error('No active HealthScoreConfig found');

  const [clinical, today, consistency, trend] = await Promise.all([
    calculateClinicalScore(userId, config),
    calculateTodayScore(userId),
    calculateConsistencyScore(userId, config),
    calculateTrendScore(userId, config),
  ]);

  const values = {
    clinical: clinical?.score ?? null,
    today,
    consistency,
    trend,
  };

  const availableKeys = Object.keys(values).filter(
    (k) => values[k] !== null && typeof config.longTermWeights[k] === 'number',
  );

  // Clinical's weight decays with the report's age, and what it gives up goes
  // to the behavioural components — which are current. So an old report doesn't
  // vanish, it just stops speaking as loudly as this week's habits.
  const recency = clinical?.recencyFactor ?? 1;
  const weightFor = (k) => config.longTermWeights[k] * (k === 'clinical' ? recency : 1);

  const totalAvailableWeight = availableKeys.reduce((sum, k) => sum + weightFor(k), 0);

  let rawScore = 0;
  if (totalAvailableWeight > 0) {
    rawScore = availableKeys.reduce(
      (sum, k) => sum + values[k] * (weightFor(k) / totalAvailableWeight),
      0,
    );
  }

  const riskAdjustmentFactor = clinical?.report ? calculateRiskAdjustmentFactor(clinical.report, config) : 1;
  let finalScore = rawScore * riskAdjustmentFactor;

  // Hard ceiling when a lab value is in critical range. The weighted average
  // above can still land in the 80s with one life-threatening result among
  // many normal ones — a number that reads as reassurance and could delay
  // someone seeking care. The cap makes the score refuse to say "you're fine"
  // while something needs a doctor; `criticalFindings` carries the reason so
  // the UI can show it rather than leaving an unexplained low number.
  const criticalFindings = clinical?.criticalFindings || [];
  if (criticalFindings.length > 0) {
    // Fallback keeps an older config (one without this field) from turning the
    // whole score into NaN via Math.min(x, undefined).
    finalScore = Math.min(finalScore, config.criticalFindingScoreCap ?? 45);
  }

  // Counts days the user actually logged on, since this drives the UI's
  // "based on N days" confidence hint — days with an empty row would inflate
  // the apparent confidence behind the score.
  const daysOfHistory = (await DailyHealthScore.find({ userId, date: { $gte: daysAgoStr(89) } })
    .select('components').lean()).filter(isLoggedDay).length;

  const snapshot = {
    value: Math.round(finalScore * 10) / 10,
    components: {
      clinical: values.clinical !== null ? Math.round(values.clinical * 10) / 10 : undefined,
      today: values.today !== null ? Math.round(values.today * 10) / 10 : undefined,
      consistency: values.consistency !== null ? Math.round(values.consistency * 10) / 10 : undefined,
      trend: values.trend !== null ? Math.round(values.trend * 10) / 10 : undefined,
    },
    riskAdjustmentFactor: Math.round(riskAdjustmentFactor * 100) / 100,
    criticalFindings,
    daysOfHistory,
    configVersion: config.version,
    computedAt: new Date(),
  };

  await User.findByIdAndUpdate(userId, { compositeHealthScore: snapshot });
  return snapshot;
}

module.exports = { calculateLongTermScore, reportRecencyFactor, todayStr, daysAgoStr };
