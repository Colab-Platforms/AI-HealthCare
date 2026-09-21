// Recovery Score — Phase 1 (see team spec "Recovery Score Algorithm — Final
// Production V1"). Two independent layers, computed and reported separately:
//
//  1. PERSONAL-BASELINE layer (the score itself): z-scores today's HRV/RHR
//     against the user's OWN 14-day and 90-day history, converted to a
//     standard T-score (mean 50, SD 10 — the textbook psychometric
//     transformation, not an invented constant), then combined. This answers
//     "how does today compare to MY normal."
//
//  2. ABSOLUTE SAFETY-FLOOR layer (independent `warnings`, never folds into
//     the score): fixed clinical reference thresholds (WHO/AHA-adjacent),
//     the same for every user regardless of their personal baseline. This
//     exists because a baseline-relative score cannot detect "this person's
//     entire observed history has been unhealthy" — if someone's 90-day HRV
//     average is itself abnormally low, "improved vs. your own pattern" can
//     read as a good score while the absolute value is still concerning.
//     Whoop/Oura/Garmin all share this exact blind spot since they are
//     baseline-relative-only too.
//
//  3. RECOVERY CEILING + BASELINE DRIFT: the personal-baseline score alone
//     can look great purely because the RECENT window improved, even while
//     the 90-day long-term baseline is still clearly suppressed (someone
//     chronically unwell whose 90-day average never recovers). The drift
//     check below reuses the long-term z-scores already computed (no extra
//     query) to flag this, and the ceiling caps the score rather than only
//     warning about it.
//
// The Recovery Ceiling value and drift threshold below are PLACEHOLDERS —
// explicitly not calibrated against real outcome data yet (no vendor
// publishes a validated number for this either). They exist so the
// mechanism is wired end-to-end now; update the constants, not the logic,
// once real usage data justifies a specific number.
//
// Still genuinely deferred (not just placeholder'd): EMA-smoothed adaptive
// baselines, and full sleep "Continuity" (needs a per-night wake-event
// COUNT, which HealthKit sleep stages don't give us — we only have total
// awakeMinutes, not how many separate times the user woke).

const HeartRateDailySummary = require('../models/HeartRateDailySummary');
const StressDailySummary = require('../models/StressDailySummary');
const VitalsDailySummary = require('../models/VitalsDailySummary');
const BloodOxygenSample = require('../models/BloodOxygenSample');
const SleepSession = require('../models/SleepSession');
const DailyActivityMetric = require('../models/DailyActivityMetric');
const RecoveryDailySummary = require('../models/RecoveryDailySummary');
const { getWindowStats, dateOnlyUTC } = require('./recoveryBaselineService');
const { buildRecommendation } = require('./recoveryRecommendationService');

// Matches the product design's "compared with your own 14-day baseline"
// copy (Oura uses the same 14-day recent window against a longer reference).
const RECENT_WINDOW_DAYS = 14;
const LONG_WINDOW_DAYS = 90;
// Activity's "chronic load" reference uses the recent window, not the full
// 90 days — a newly-onboarded user realistically has activity history long
// before they have 90 days of HRV/RHR, but requiring 90 days here would
// leave the Activity modifier unavailable for most users for months.
const ACUTE_LOAD_WINDOW_DAYS = 7;
const CHRONIC_LOAD_WINDOW_DAYS = 28;

// Informational only — "Baseline Evolution" (Section: buildBaselineEvolution)
// shows how the user's own HRV/RHR normal has shifted over 3 distinct zones:
// short (15d), medium (30d), and the same long-term (90d) the score already
// uses. Deliberately 3 windows, not 5 — 45d/60d would sit inside the 15-90
// range as near-duplicates of their neighbors (highly correlated, since
// they're overlapping subsets of the same 90-day history) without adding
// distinct information, while costing 2 extra queries per metric. This does
// NOT feed the score formula — RECENT_WINDOW_DAYS (14) above is unchanged.
const BASELINE_EVOLUTION_WINDOWS = [15, 30]; // documents the windows used in buildBaselineEvolution() below

// PLACEHOLDER — see file header. -1.5 long-term z (HRV low / RHR high) is a
// "clearly still off" cut rather than a borderline one; 69 sits just under
// the Moderate band so a capped day reads as "Low", not merely "less than
// Optimal". Neither number has been validated against our own outcome data.
const DRIFT_Z_THRESHOLD = 1.5;
const RECOVERY_CEILING_WHEN_DRIFTED = 69;

// Standard psychometric T-score transformation (mean 50, SD 10) — the
// conventional way to put a z-score on a 0-100-ish scale. Not something we
// invented; the same transform underlies clinical assessments like the MMPI.
function toTScore(z) {
  if (z == null) return null;
  return Math.max(0, Math.min(100, 50 + 10 * z));
}

// Absolute, personal-baseline-independent reference ranges. Deliberately
// conservative (only flags clearly-outside-normal values) — this is a safety
// net, not a diagnostic tool, and must never claim "you are sick".
const SAFETY_FLOOR = {
  hrvMsLow: 20,           // below this is low for essentially any healthy adult
  rhrBpmHigh: 100,        // resting tachycardia range
  rhrBpmLow: 40,          // bradycardia range (excluding trained-athlete context we can't detect)
  spo2Low: 92,            // WHO/pulse-oximetry hypoxia reference
};

function zScore(value, mean, sd) {
  if (value == null || mean == null || !(sd > 0)) return null;
  return (value - mean) / sd;
}

// Population reference values — used ONLY as a fallback until a user has
// enough of their OWN history (see zScoreWithFallback below). Real published
// numbers, not invented placeholders:
//   HRV (RMSSD): Nunan et al. 2010 meta-analysis, 44 studies, 21,438 healthy
//     adults — mean=42ms, SD=15ms. This is a general-population figure, not
//     age-adjusted; a real HRV reference varies a lot by age, so this is
//     deliberately a rough starting point, not a precise personal estimate.
//   RHR: American Heart Association's published normal range, 60-100 bpm.
//     AHA reports a RANGE, not a mean/SD, so this converts it using the
//     standard range-to-SD approximation (mean = midpoint, SD = range/4,
//     treating the published range as roughly a 2-SD band) — a named,
//     conventional technique for turning a clinical range into a usable
//     distribution, not something invented for this app.
//   Respiratory Rate: standard adult clinical vital-sign range, 12-20
//     breaths/min, converted the same way.
const POPULATION_REFERENCE = {
  hrvMs: { mean: 42, sd: 15 },
  rhrBpm: { mean: 80, sd: 10 },   // (60+100)/2, (100-60)/4
  rrBreathsPerMin: { mean: 16, sd: 2 }, // (12+20)/2, (20-12)/4
};

// Prefers the user's OWN baseline; falls back to the population reference
// ONLY when there isn't enough personal history yet (sd null/undefined means
// fewer than 2 valid baseline days — see recoveryBaselineService.computeStats).
// This is what lets Day 1 show a real, honestly-labeled score instead of
// nothing — and it silently stops being used the moment real personal data
// exists, with no separate code path to switch over later.
function zScoreWithFallback(value, personalMean, personalSd, popRef) {
  if (value == null) return { z: null, source: null };
  if (personalMean != null && personalSd > 0) {
    return { z: (value - personalMean) / personalSd, source: 'personal' };
  }
  if (popRef.sd > 0) {
    return { z: (value - popRef.mean) / popRef.sd, source: 'population' };
  }
  return { z: null, source: null };
}

// 4-tier band, thresholds matching Oura's published Readiness tiers (85+
// Optimal, 70-84 Good/Moderate, under 70 progressively lower) rather than an
// invented split — see the product design's "74 -> Moderate Recovery" copy,
// which lands squarely in Oura's 70-84 band.
function classifyRecoveryBand(score) {
  if (score == null) return null;
  if (score >= 85) return { key: 'optimal', label: 'Optimal Recovery' };
  if (score >= 70) return { key: 'moderate', label: 'Moderate Recovery' };
  if (score >= 50) return { key: 'low', label: 'Low Recovery' };
  return { key: 'very_low', label: 'Very Low Recovery' };
}

// Renormalizes a weighted sum over only the sub-scores actually available —
// same pattern dailyHealthScoreService already uses for its own components,
// applied here at each domain level (Physiology, RecoveryBase) rather than
// once globally, so a metric missing in one domain never borrows weight from
// an unrelated domain.
function weightedAverage(parts) {
  const available = parts.filter((p) => p.score != null);
  if (available.length === 0) return null;
  const totalWeight = available.reduce((sum, p) => sum + p.weight, 0);
  return available.reduce((sum, p) => sum + p.score * (p.weight / totalWeight), 0);
}

async function buildHrvEngine(userId, dateStr) {
  const today = dateOnlyUTC(dateStr);
  const [todayDocs, recent, long] = await Promise.all([
    StressDailySummary.find({ user: userId, date: today }).select('avgHrvMs').lean(),
    getWindowStats(StressDailySummary, userId, (d) => d.avgHrvMs, dateStr, RECENT_WINDOW_DAYS),
    getWindowStats(StressDailySummary, userId, (d) => d.avgHrvMs, dateStr, LONG_WINDOW_DAYS),
  ]);

  const todayValues = todayDocs.map((d) => d.avgHrvMs).filter((v) => Number.isFinite(v));
  if (todayValues.length === 0) return { available: false };
  const todayHrv = todayValues.reduce((a, b) => a + b, 0) / todayValues.length;

  const recentFb = zScoreWithFallback(todayHrv, recent.mean, recent.sd, POPULATION_REFERENCE.hrvMs);
  const longFb = zScoreWithFallback(todayHrv, long.mean, long.sd, POPULATION_REFERENCE.hrvMs);
  const recentZ = recentFb.z;
  const longZ = longFb.z;
  const recentScore = toTScore(recentZ);
  const longScore = toTScore(longZ);

  // 60% long-term so a single depressed recent window can't quickly redefine
  // "healthy" — see this file's header note on baseline drift.
  const score = weightedAverage([
    { score: recentScore, weight: 0.40 },
    { score: longScore, weight: 0.60 },
  ]);

  return {
    available: true,
    today: Math.round(todayHrv * 10) / 10,
    baseline14: recent.mean != null ? Math.round(recent.mean * 10) / 10 : null,
    baseline90: long.mean != null ? Math.round(long.mean * 10) / 10 : null,
    // Mean +/- 1 SD over the 14-day window — the range a trend chart shades
    // as "your usual range" (see the product design's HRV detail screen).
    range14: (recent.mean != null && recent.sd != null)
      ? { low: Math.round((recent.mean - recent.sd) * 10) / 10, high: Math.round((recent.mean + recent.sd) * 10) / 10 }
      : null,
    recentZ, longTermZ: longZ,
    score: score != null ? Math.round(score) : null,
    baselineDays: long.n,
    sd90: long.sd,
    // 'personal' if either window used the user's own history, 'population'
    // if BOTH fell back — i.e. this reflects the user's real data the moment
    // any of it exists, not an all-or-nothing switch.
    baselineSource: (recentFb.source === 'personal' || longFb.source === 'personal') ? 'personal' : 'population',
  };
}

async function buildRhrEngine(userId, dateStr) {
  const today = dateOnlyUTC(dateStr);
  const [todayDocs, recent, long] = await Promise.all([
    HeartRateDailySummary.find({ user: userId, date: today }).select('restingBpm').lean(),
    getWindowStats(HeartRateDailySummary, userId, (d) => d.restingBpm?.value, dateStr, RECENT_WINDOW_DAYS),
    getWindowStats(HeartRateDailySummary, userId, (d) => d.restingBpm?.value, dateStr, LONG_WINDOW_DAYS),
  ]);

  const todayValues = todayDocs.map((d) => d.restingBpm?.value).filter((v) => Number.isFinite(v));
  if (todayValues.length === 0) return { available: false };
  const todayRhr = todayValues.reduce((a, b) => a + b, 0) / todayValues.length;

  // Direction flip: for RHR, LOWER than baseline is the good direction.
  const recentFb = zScoreWithFallback(todayRhr, recent.mean, recent.sd, POPULATION_REFERENCE.rhrBpm);
  const longFb = zScoreWithFallback(todayRhr, long.mean, long.sd, POPULATION_REFERENCE.rhrBpm);
  const recentZ = recentFb.z;
  const longZ = longFb.z;
  const recentScore = toTScore(recentZ != null ? -recentZ : null);
  const longScore = toTScore(longZ != null ? -longZ : null);

  const score = weightedAverage([
    { score: recentScore, weight: 0.40 },
    { score: longScore, weight: 0.60 },
  ]);

  return {
    available: true,
    today: Math.round(todayRhr),
    baseline14: recent.mean != null ? Math.round(recent.mean) : null,
    baseline90: long.mean != null ? Math.round(long.mean) : null,
    range14: (recent.mean != null && recent.sd != null)
      ? { low: Math.round(recent.mean - recent.sd), high: Math.round(recent.mean + recent.sd) }
      : null,
    recentZ, longTermZ: longZ,
    score: score != null ? Math.round(score) : null,
    baselineDays: long.n,
    sd90: long.sd,
    baselineSource: (recentFb.source === 'personal' || longFb.source === 'personal') ? 'personal' : 'population',
  };
}

// Respiratory rate: unlike HRV/RHR, deviation in EITHER direction reads as a
// potential concern (spec: "close to personal range = normal, unexpected
// elevation = potential stress signal") — so this scores on |z|, not signed
// z, and skips the recent/long split HRV and RHR use (RR is a stability
// check, not a trend metric we want to track drift on separately yet).
async function buildRrEngine(userId, dateStr) {
  const today = dateOnlyUTC(dateStr);
  const [todayDocs, recent] = await Promise.all([
    VitalsDailySummary.find({ user: userId, date: today }).select('avgRespiratoryRate').lean(),
    getWindowStats(VitalsDailySummary, userId, (d) => d.avgRespiratoryRate, dateStr, RECENT_WINDOW_DAYS),
  ]);

  const todayValues = todayDocs.map((d) => d.avgRespiratoryRate).filter((v) => Number.isFinite(v));
  if (todayValues.length === 0) return { available: false };
  const todayRr = todayValues.reduce((a, b) => a + b, 0) / todayValues.length;

  const fb = zScoreWithFallback(todayRr, recent.mean, recent.sd, POPULATION_REFERENCE.rrBreathsPerMin);
  const z = fb.z;
  const score = z != null ? toTScore(-Math.abs(z)) : null; // deviation either way lowers the score

  return {
    available: true,
    today: Math.round(todayRr * 10) / 10,
    baseline14: recent.mean != null ? Math.round(recent.mean * 10) / 10 : null,
    baselineSource: fb.source,
    z,
    score: score != null ? Math.round(score) : null,
  };
}

// Sleep: Duration (existing "hours vs. 8h ideal" heuristic) + Efficiency
// (real data: totalSleepMinutes / (totalSleepMinutes + awakeMinutes), a
// standard sleep-science ratio — SleepSession already captures awakeMinutes)
// + Regularity (real data: consistency of bedTime across recent nights).
// Continuity (wake-event COUNT, not just total awake minutes) is the one
// sub-component genuinely not buildable — see file header.
//
// Weights below follow the team spec's split (Duration 0.45 / Efficiency
// 0.30 / Regularity 0.15 / Continuity 0.10), renormalized over the 3
// available parts since Continuity is always missing right now.
async function buildSleepEngine(userId, dateStr) {
  const today = dateOnlyUTC(dateStr);
  const REGULARITY_WINDOW_DAYS = 14;
  const start = new Date(today); start.setUTCDate(start.getUTCDate() - REGULARITY_WINDOW_DAYS);

  const [tonight, recentNights] = await Promise.all([
    SleepSession.findOne({ user: userId, date: today }).select('totalSleepMinutes awakeMinutes bedTime').lean(),
    SleepSession.find({ user: userId, date: { $gte: start, $lt: today } }).select('bedTime').lean(),
  ]);
  if (!tonight?.totalSleepMinutes) return { available: false };

  const hours = tonight.totalSleepMinutes / 60;
  const durationScore = Math.max(0, Math.min(100, Math.round(100 - Math.abs(hours - 8) * 15)));

  const timeInBed = tonight.totalSleepMinutes + (tonight.awakeMinutes || 0);
  const efficiencyPct = timeInBed > 0 ? (tonight.totalSleepMinutes / timeInBed) * 100 : null;
  // Efficiency is already a 0-100 percentage — no extra scaling needed, it
  // maps directly onto the score scale (>=85% is the standard sleep-science
  // "good efficiency" reference; below that, the percentage itself already
  // reads as a lower score).
  const efficiencyScore = efficiencyPct != null ? Math.round(Math.max(0, Math.min(100, efficiencyPct))) : null;

  // Regularity: SD of bedtime (minutes-since-midnight) over the last 14
  // nights. Low variance = consistent schedule = high score. 120 minutes
  // (2 hours) of night-to-night bedtime swing is used as the "essentially no
  // regularity" reference point below — a common-sense anchor (a full
  // school/work-driven schedule swing), not a published clinical threshold.
  const bedtimeMinutes = recentNights
    .map((n) => n.bedTime && new Date(n.bedTime))
    .filter(Boolean)
    .map((d) => d.getUTCHours() * 60 + d.getUTCMinutes());
  let regularityScore = null;
  if (bedtimeMinutes.length >= 3) {
    const mean = bedtimeMinutes.reduce((a, b) => a + b, 0) / bedtimeMinutes.length;
    const variance = bedtimeMinutes.reduce((s, v) => s + (v - mean) ** 2, 0) / bedtimeMinutes.length;
    const sdMinutes = Math.sqrt(variance);
    regularityScore = Math.round(Math.max(0, Math.min(100, 100 - (sdMinutes / 120) * 100)));
  }

  const score = weightedAverage([
    { score: durationScore, weight: 0.45 },
    { score: efficiencyScore, weight: 0.30 },
    { score: regularityScore, weight: 0.15 },
  ]);

  return {
    available: true,
    hours: Math.round(hours * 10) / 10,
    efficiencyPct: efficiencyPct != null ? Math.round(efficiencyPct) : null,
    durationScore, efficiencyScore, regularityScore,
    score: score != null ? Math.round(score) : durationScore,
  };
}

// Activity is recovery DEMAND, not a "good activity score". Acute (7d) vs
// chronic (28d) load ratio: near-usual is neutral, well above usual is a
// penalty, and being very inactive gets no bonus (never negative either).
async function buildActivityModifier(userId, dateStr) {
  const today = dateOnlyUTC(dateStr);
  const acuteStart = new Date(today); acuteStart.setUTCDate(acuteStart.getUTCDate() - ACUTE_LOAD_WINDOW_DAYS);
  const chronicStart = new Date(today); chronicStart.setUTCDate(chronicStart.getUTCDate() - CHRONIC_LOAD_WINDOW_DAYS);

  const [acuteDocs, chronicDocs] = await Promise.all([
    DailyActivityMetric.find({ user: userId, date: { $gte: acuteStart, $lt: today } }).select('activeMinutes').lean(),
    DailyActivityMetric.find({ user: userId, date: { $gte: chronicStart, $lt: today } }).select('activeMinutes').lean(),
  ]);
  if (acuteDocs.length === 0 || chronicDocs.length === 0) return { available: false, modifier: 0 };

  const acuteLoad = acuteDocs.reduce((s, d) => s + (d.activeMinutes || 0), 0) / acuteDocs.length;
  const chronicLoad = chronicDocs.reduce((s, d) => s + (d.activeMinutes || 0), 0) / chronicDocs.length;
  if (!(chronicLoad > 0)) return { available: false, modifier: 0 };

  const loadRatio = acuteLoad / chronicLoad;
  let modifier = 0;
  if (loadRatio > 1.2) {
    // Overload beyond usual pattern — capped at -12 per the spec's V1 range.
    modifier = -Math.min(12, Math.round((loadRatio - 1.2) * 20));
  }
  // loadRatio <= 1.2 (including very inactive stretches) intentionally stays
  // at 0 — underactivity is not rewarded with a recovery bonus.

  return { available: true, acuteLoad: Math.round(acuteLoad), chronicLoad: Math.round(chronicLoad), loadRatio: Math.round(loadRatio * 100) / 100, modifier };
}

// Independent of the score: fixed clinical reference thresholds, the same
// for every user. Catches the case a purely personal-baseline score cannot —
// someone whose entire observed history is itself unhealthy (see file header).
async function buildSafetyWarnings(userId, dateStr, hrv, rhr) {
  const warnings = [];
  if (hrv.available && hrv.today < SAFETY_FLOOR.hrvMsLow) {
    warnings.push({
      code: 'hrv_below_reference_range',
      message: 'Your HRV is below the typical range for adults, even if it looks improved compared to your own recent pattern.'
    });
  }
  if (rhr.available && (rhr.today > SAFETY_FLOOR.rhrBpmHigh || rhr.today < SAFETY_FLOOR.rhrBpmLow)) {
    warnings.push({
      code: 'rhr_outside_reference_range',
      message: 'Your resting heart rate is outside the typical range for adults.'
    });
  }

  const today = dateOnlyUTC(dateStr);
  const spo2Agg = await BloodOxygenSample.aggregate([
    { $match: { user: userId, timestamp: { $gte: today, $lt: new Date(today.getTime() + 86400000) } } },
    { $group: { _id: null, avg: { $avg: '$percentage' } } }
  ]);
  const spo2 = spo2Agg[0]?.avg;
  if (spo2 != null && spo2 < SAFETY_FLOOR.spo2Low) {
    warnings.push({
      code: 'spo2_below_reference_range',
      message: 'Your blood oxygen reading is below the typical healthy range.'
    });
  }

  return warnings;
}

// 'population_reference' is a distinct tier from 'insufficient_baseline':
// the latter means no score at all (see the recoveryBase==null guard below);
// the former means a real score IS shown, using published population norms
// because personal history isn't there yet — see zScoreWithFallback.
function confidenceFromBaselineDays(days, usedPopulationReference) {
  if (usedPopulationReference) return 'population_reference';
  if (days == null || days < 7) return 'insufficient_baseline';
  if (days < 14) return 'low';
  if (days < 28) return 'moderate';
  if (days < 60) return 'good';
  return 'high';
}

// Drift = is the RECENT (14-day) baseline itself still meaningfully off from
// the LONG-term (90-day) reference — using the long-term z-scores the HRV/RHR
// engines already computed (today vs. 90-day mean/SD), not a fresh query.
// Reusing longTermZ here means: if TODAY looks fine relative to a 90-day
// baseline that is itself still suppressed, this alone won't catch it — this
// check is specifically "how far is my recent NORMAL from my long-term
// normal," a distinct question from "how does today compare to my normal."
// Only meaningful when both z-scores came from the user's OWN history —
// drifting against a population reference isn't a real personal-drift signal.
function computeBaselineDrift(hrv, rhr) {
  if (hrv.baselineSource !== 'personal' && rhr.baselineSource !== 'personal') {
    return { status: 'stable', hrvDrifted: false, rhrDrifted: false };
  }
  const hrvDrifted = hrv.available && hrv.baselineSource === 'personal' && hrv.longTermZ != null && hrv.longTermZ <= -DRIFT_Z_THRESHOLD;
  const rhrDrifted = rhr.available && rhr.baselineSource === 'personal' && rhr.longTermZ != null && rhr.longTermZ >= DRIFT_Z_THRESHOLD;
  return {
    status: (hrvDrifted || rhrDrifted) ? 'depressed_recent_baseline' : 'stable',
    hrvDrifted, rhrDrifted,
  };
}

// Informational "Baseline Evolution": mean/SD at 15d, 30d, and 90d (the 90d
// figure is reused from the already-computed HRV/RHR engine output — see
// BASELINE_EVOLUTION_WINDOWS comment above for why 45d/60d were left out).
// Never touches the score; purely for a trend-chart / PDF-style view of how
// a user's own "normal" has shifted over time.
async function buildBaselineEvolution(userId, dateStr, hrv, rhr) {
  const [hrv15, hrv30, rhr15, rhr30] = await Promise.all([
    getWindowStats(StressDailySummary, userId, (d) => d.avgHrvMs, dateStr, 15),
    getWindowStats(StressDailySummary, userId, (d) => d.avgHrvMs, dateStr, 30),
    getWindowStats(HeartRateDailySummary, userId, (d) => d.restingBpm?.value, dateStr, 15),
    getWindowStats(HeartRateDailySummary, userId, (d) => d.restingBpm?.value, dateStr, 30),
  ]);

  const round1 = (v) => (v != null ? Math.round(v * 10) / 10 : null);
  const roundInt = (v) => (v != null ? Math.round(v) : null);

  return {
    hrv: {
      day15: { mean: round1(hrv15.mean), sd: round1(hrv15.sd), n: hrv15.n },
      day30: { mean: round1(hrv30.mean), sd: round1(hrv30.sd), n: hrv30.n },
      day90: { mean: round1(hrv.baseline90), sd: round1(hrv.sd90), n: hrv.baselineDays },
    },
    rhr: {
      day15: { mean: roundInt(rhr15.mean), sd: round1(rhr15.sd), n: rhr15.n },
      day30: { mean: roundInt(rhr30.mean), sd: round1(rhr30.sd), n: rhr30.n },
      day90: { mean: roundInt(rhr.baseline90), sd: round1(rhr.sd90), n: rhr.baselineDays },
    },
  };
}

async function calculateRecoveryScore(userId, dateStr) {
  const [hrv, rhr, rr, sleep, activity] = await Promise.all([
    buildHrvEngine(userId, dateStr),
    buildRhrEngine(userId, dateStr),
    buildRrEngine(userId, dateStr),
    buildSleepEngine(userId, dateStr),
    buildActivityModifier(userId, dateStr),
  ]);

  // Without both core physiological signals there isn't enough evidence to
  // call this a full Recovery Score (spec section 22).
  if (!hrv.available && !rhr.available) {
    await RecoveryDailySummary.deleteOne({ user: userId, date: dateStr });
    return { user: userId, date: dateStr, recoveryScore: null, status: 'insufficient_physiological_data', components: {} };
  }

  // ANS = HRV + RHR + RR, renormalized over whichever are available (RR is
  // usually missing today since it's newly wired — weightedAverage already
  // renormalizes 0.50/0.40 between just HRV+RHR when RR is absent, so this
  // silently degrades to the same physiology math as before RR existed).
  const physiology = weightedAverage([
    { score: hrv.available ? hrv.score : null, weight: 0.50 },
    { score: rhr.available ? rhr.score : null, weight: 0.40 },
    { score: rr.available ? rr.score : null, weight: 0.10 },
  ]);

  const recoveryBase = weightedAverage([
    { score: physiology, weight: 0.70 },
    { score: sleep.available ? sleep.score : null, weight: 0.30 },
  ]);

  const warnings = await buildSafetyWarnings(userId, dateStr, hrv, rhr);
  const baseline = computeBaselineDrift(hrv, rhr);
  const baselineDays = Math.max(hrv.baselineDays || 0, rhr.baselineDays || 0);
  // Population-reference confidence applies only while EVERY available
  // metric is still falling back to it — the instant any one metric has
  // real personal history, that's reflected as ordinary day-count confidence.
  const usedSources = [hrv.available ? hrv.baselineSource : null, rhr.available ? rhr.baselineSource : null].filter(Boolean);
  const usedPopulationReference = usedSources.length > 0 && usedSources.every((s) => s === 'population');
  const confidence = confidenceFromBaselineDays(baselineDays, usedPopulationReference);

  // A reading existing today (hrv.available/rhr.available) is not the same as
  // having a baseline to score it against — z-score/T-score both come back
  // null with zero baseline history, which can make physiology/recoveryBase
  // null even though "today" has real numbers. Without this guard, `null +
  // activityModifier` coerces to 0 in JS and a brand-new user's very first
  // day would show "Recovery: 0/100" — read as catastrophic, when the honest
  // answer is "not enough history yet to score against."
  if (recoveryBase == null) {
    await RecoveryDailySummary.findOneAndUpdate(
      { user: userId, date: dateStr },
      { recoveryScore: null, components: {}, confidence, warnings, baselineStatus: baseline.status, metricDetails: { physiology: { score: null }, hrv, rhr, rr, sleep, activity } },
      { upsert: true, new: true }
    );
    return {
      user: userId, date: dateStr, recoveryScore: null,
      status: 'insufficient_baseline', confidence, warnings, baselineStatus: baseline.status,
      physiology: { score: null }, hrv, rhr, rr, sleep, activity,
    };
  }

  const activityModifier = activity.modifier || 0;
  const recoveryRaw = recoveryBase + activityModifier;
  let recoveryScore = Math.round(Math.max(0, Math.min(100, recoveryRaw)));
  let ceilingApplied = false;

  // PLACEHOLDER ceiling (see file header) — only caps DOWN, never raises a
  // score, and only when the long-term baseline itself is still drifted.
  if (baseline.status === 'depressed_recent_baseline' && recoveryScore > RECOVERY_CEILING_WHEN_DRIFTED) {
    recoveryScore = RECOVERY_CEILING_WHEN_DRIFTED;
    ceilingApplied = true;
  }

  const band = classifyRecoveryBand(recoveryScore);

  const components = {
    hrv: hrv.available ? hrv.score : undefined,
    restingHeartRate: rhr.available ? rhr.score : undefined,
    respiratoryRate: rr.available ? rr.score : undefined,
    sleepContribution: sleep.available ? sleep.score : undefined,
    strainContribution: activity.available ? Math.max(0, Math.min(100, 100 + activityModifier * 4)) : undefined,
  };

  // Informational only, does not affect recoveryScore — see
  // buildBaselineEvolution()'s header comment.
  const baselineEvolution = await buildBaselineEvolution(userId, dateStr, hrv, rhr);

  const metricDetails = {
    physiology: { score: physiology != null ? Math.round(physiology) : null },
    hrv, rhr, rr, sleep, activity,
    ceilingApplied,
    baselineEvolution,
  };

  // Rule-based only (lookup table keyed on band + activity load) — not an
  // AI call. See recoveryRecommendationService.js's header for why this is
  // a different, much smaller thing than the separately-deferred AI workout
  // recommendation engine.
  const recommendation = buildRecommendation({ band, activity, sleepAvailable: sleep.available });

  const saved = await RecoveryDailySummary.findOneAndUpdate(
    { user: userId, date: dateStr },
    { recoveryScore, band, components, confidence, warnings, baselineStatus: baseline.status, metricDetails, recommendation },
    { upsert: true, new: true }
  );

  return {
    user: userId,
    date: dateStr,
    recoveryScore: saved.recoveryScore,
    band: saved.band,
    confidence: saved.confidence,
    warnings: saved.warnings,
    baselineStatus: saved.baselineStatus,
    recommendation: saved.recommendation,
    physiology: metricDetails.physiology,
    baselineEvolution,
    hrv, rhr, rr, sleep, activity,
  };
}

module.exports = { calculateRecoveryScore };
