// Turns raw SleepSession rows into the structured, age-aware clinical facts
// that dailyInsightService (LLM) and getSleepInsightData (API) build on.
//
// Deterministic only — no model call happens in this file. Every number here
// is plain arithmetic against SleepSession + the user's age, so the LLM layer
// downstream never has to compute or invent a figure, only phrase one.
//
// The thresholds below are evidence-informed wellness-analytics convention
// (the same ballpark consumer platforms like Oura/Fitbit/Whoop use), not a
// clinical diagnostic standard — see docs discussion for the age-band and
// stage-range sourcing (NSF/AASM ranges) vs the engineering choices (3/7/14
// night tiers, which mirror MIN_BASELINE_NIGHTS in sleepInsightService.js and
// REGULARITY_WINDOW_DAYS in recoveryScoreService.js).

const SleepSession = require('../models/SleepSession');
const { collapseToOnePerDay, filterPlausibleSleep } = require('../utils/wearableMerge');
// Single source of truth for the 0-100 sleep quality score — same function
// the Sleep screen's own ring calls (sleepAnalyticsService.js), so the
// insight can never cite a different number than what's on screen for the
// same night. See sleepScoreService.js's header for why this exists.
const { getNativeSleepScoresByDate, resolveSleepQualityScore } = require('./sleepScoreService');

const TREND_WINDOW_DAYS = 7;
const REGULARITY_WINDOW_DAYS = 14;
const MIN_NIGHTS_FOR_RAW_COMPARISON = 3;
const MIN_NIGHTS_FOR_TREND = 7;
const MIN_NIGHTS_FOR_REGULARITY = 14;

// NSF-consensus adult sleep-duration bands by age. Unknown age falls back to
// the general adult band rather than guessing.
function getIdealSleepRange(age) {
  if (age == null) return { min: 7, max: 9 };
  if (age < 18) return { min: 8, max: 10 };
  if (age <= 64) return { min: 7, max: 9 };
  return { min: 7, max: 8 };
}

// Typical adult sleep-stage composition (AASM scoring-manual ballpark).
const STAGE_RANGES = {
  deep: { min: 13, max: 23 },
  rem: { min: 20, max: 25 },
  light: { min: 45, max: 55 },
};

function rangeStatus(pct, range) {
  if (pct == null) return null;
  if (pct < range.min) return 'below_range';
  if (pct > range.max) return 'above_range';
  return 'in_range';
}

function efficiencyStatus(pct) {
  if (pct == null) return null;
  if (pct >= 85) return 'good';
  if (pct >= 75) return 'borderline';
  return 'poor';
}

function average(nums) {
  const valid = nums.filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function round1(n) {
  return n == null ? null : Math.round(n * 10) / 10;
}

function roundOrNull(n) {
  return n == null ? null : Math.round(n);
}

function sessionHours(s) {
  return (s.totalSleepMinutes || 0) / 60;
}

function sessionEfficiency(s) {
  const timeInBed = (s.totalSleepMinutes || 0) + (s.awakeMinutes || 0);
  return timeInBed > 0 ? (s.totalSleepMinutes / timeInBed) * 100 : null;
}

function stagePct(s, field) {
  const total = s.totalSleepMinutes || 0;
  if (!total || !s[field]) return null;
  return (s[field] / total) * 100;
}

function bedtimeMinutesSinceMidnight(s) {
  if (!s.bedTime) return null;
  const d = new Date(s.bedTime);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function computeRegularity(sessions) {
  const minutes = sessions.map(bedtimeMinutesSinceMidnight).filter((v) => v != null);
  if (minutes.length < 3) return { bedtimeVarianceMin: null, status: null };
  const mean = minutes.reduce((a, b) => a + b, 0) / minutes.length;
  const variance = minutes.reduce((s, v) => s + (v - mean) ** 2, 0) / minutes.length;
  const sdMinutes = Math.sqrt(variance);
  // Same 120-minute "essentially no regularity" anchor used in
  // recoveryScoreService.buildSleepEngine — a common-sense reference, not a
  // published clinical cutoff.
  const status = sdMinutes <= 30 ? 'consistent' : sdMinutes <= 60 ? 'somewhat_irregular' : 'irregular';
  return { bedtimeVarianceMin: Math.round(sdMinutes), status };
}

function buildLastNight(session, idealRange, nativeScoreMap) {
  if (!session) return null;
  const hours = round1(sessionHours(session));
  const efficiency = sessionEfficiency(session);
  const vsIdeal = hours < idealRange.min ? 'below' : hours > idealRange.max ? 'above' : 'within';
  // Pre-computed so the LLM states an exact, correct bedtime-shift suggestion
  // instead of doing (sometimes wrong) arithmetic itself — it only reports
  // this number, never invents one. Rounded to the nearest 15 minutes since
  // "shift bedtime by 37 minutes" reads as falsely precise for an estimate.
  const shortfallMinutesToMin = vsIdeal === 'below'
    ? Math.round(((idealRange.min - hours) * 60) / 15) * 15
    : null;
  const quality = resolveSleepQualityScore(session, nativeScoreMap);
  return {
    date: session.date.toISOString().split('T')[0],
    hours,
    vsIdeal,
    shortfallMinutesToMin,
    qualityScore: quality.value,
    qualityScoreSource: quality.source,
    efficiencyPct: efficiency != null ? Math.round(efficiency) : null,
    efficiencyStatus: efficiencyStatus(efficiency),
    deepPct: roundOrNull(stagePct(session, 'deepSleepMinutes')),
    remPct: roundOrNull(stagePct(session, 'remSleepMinutes')),
  };
}

/**
 * Returns a structured, tier-gated clinical analysis of a user's recent sleep.
 * The tier controls which claims are safe to make — fewer nights logged means
 * fewer aggregate claims, so the caller (and the LLM) never overclaims on thin data.
 */
async function getSleepClinicalAnalysis(userId, { age = null, sleepGoalHours = 8 } = {}) {
  const idealRange = getIdealSleepRange(age);

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - REGULARITY_WINDOW_DAYS);
  since.setUTCHours(0, 0, 0, 0);

  // One row per user+deviceType+day — a user with two connected devices (or a
  // mid-day switch) can have more than one SleepSession row for the same
  // date. Unlike steps/calories, sleep is one continuous event, so two rows
  // for one date mean two devices measuring the SAME night, not summable or
  // field-by-field maxable (bedTime/wakeTime/stages only make sense
  // together). Collapsed to the whole row with the most totalSleepMinutes
  // per date — see utils/wearableMerge.js. A plain `.sort({date:-1})` +
  // sessions[0] here used to just grab whichever row Mongo returned first,
  // which could silently be a broken sync instead of the real device
  // (confirmed live: Health Connect reported 7.6h/458min for a night WHOOP
  // correctly measured at 8h/482min, and the unmerged query picked Health
  // Connect's).
  const rawSessions = await SleepSession.find({ user: userId, date: { $gte: since } }).lean();
  // filterPlausibleSleep must run per calendar night, not across the whole
  // window at once — group first so a broken reading on one night can't
  // influence which row wins on another.
  const rawByDate = new Map();
  for (const s of rawSessions) {
    const key = s.date.toISOString().split('T')[0];
    if (!rawByDate.has(key)) rawByDate.set(key, []);
    rawByDate.get(key).push(s);
  }
  const plausibleSessions = Array.from(rawByDate.values()).flatMap(filterPlausibleSleep);
  const sessions = collapseToOnePerDay(plausibleSessions).sort((a, b) => b.date - a.date);

  // One batched query for the whole window, not one per night — see
  // sleepScoreService.js's header for why native scores can't be matched by
  // calendar day.
  const nativeScoreMap = await getNativeSleepScoresByDate(userId, sessions);
  const lastNight = buildLastNight(sessions[0] || null, idealRange, nativeScoreMap);
  const nightsLogged = sessions.length;

  const base = {
    idealRange,
    nightsLogged,
    lastNight,
  };

  if (nightsLogged < MIN_NIGHTS_FOR_RAW_COMPARISON) {
    return { ...base, tier: 'insufficient_data' };
  }

  if (nightsLogged < MIN_NIGHTS_FOR_TREND) {
    return {
      ...base,
      tier: 'raw_comparison',
      avgHours: round1(average(sessions.map(sessionHours))),
      avgEfficiencyPct: roundOrNull(average(sessions.map(sessionEfficiency))),
    };
  }

  const trendStart = new Date();
  trendStart.setUTCDate(trendStart.getUTCDate() - TREND_WINDOW_DAYS);
  trendStart.setUTCHours(0, 0, 0, 0);
  const prevTrendStart = new Date(trendStart);
  prevTrendStart.setUTCDate(prevTrendStart.getUTCDate() - TREND_WINDOW_DAYS);

  const recentWeek = sessions.filter((s) => s.date >= trendStart);
  const priorWeek = sessions.filter((s) => s.date >= prevTrendStart && s.date < trendStart);

  const recentAvgHours = average(recentWeek.map(sessionHours));
  const priorAvgHours = average(priorWeek.map(sessionHours));

  let trend = 'insufficient_data';
  if (recentAvgHours != null && priorAvgHours != null) {
    const delta = recentAvgHours - priorAvgHours;
    trend = delta > 0.5 ? 'improving' : delta < -0.5 ? 'declining' : 'stable';
  }

  const goalMetNights = recentWeek.filter((s) => sessionHours(s) >= sleepGoalHours).length;
  const sleepDebtHours = round1(Math.max(0, sleepGoalHours * recentWeek.length - (average(recentWeek.map(sessionHours)) || 0) * recentWeek.length));

  const avgEfficiency = average(sessions.map(sessionEfficiency));
  const avgDeepPct = average(sessions.map((s) => stagePct(s, 'deepSleepMinutes')));
  const avgRemPct = average(sessions.map((s) => stagePct(s, 'remSleepMinutes')));
  const avgLightPct = average(sessions.map((s) => stagePct(s, 'lightSleepMinutes')));

  const trendResult = {
    ...base,
    tier: nightsLogged >= MIN_NIGHTS_FOR_REGULARITY ? 'full_analysis' : 'trend_analysis',
    avgHours7d: round1(recentAvgHours),
    sleepDebtHours,
    goalAdherence7d: `${goalMetNights}/${recentWeek.length}`,
    trend,
    avgEfficiencyPct: avgEfficiency != null ? Math.round(avgEfficiency) : null,
    efficiencyStatus: efficiencyStatus(avgEfficiency),
    deepSleepPctAvg: avgDeepPct != null ? Math.round(avgDeepPct) : null,
    deepSleepStatus: rangeStatus(avgDeepPct, STAGE_RANGES.deep),
    remPctAvg: avgRemPct != null ? Math.round(avgRemPct) : null,
    remStatus: rangeStatus(avgRemPct, STAGE_RANGES.rem),
    lightPctAvg: avgLightPct != null ? Math.round(avgLightPct) : null,
    lightStatus: rangeStatus(avgLightPct, STAGE_RANGES.light),
  };

  if (nightsLogged < MIN_NIGHTS_FOR_REGULARITY) {
    return trendResult;
  }

  const { bedtimeVarianceMin, status: regularityStatus } = computeRegularity(sessions);

  return {
    ...trendResult,
    bedtimeVarianceMin,
    regularityStatus,
  };
}

const TIER_TO_MATURITY = {
  insufficient_data: 'just_started',
  raw_comparison: 'building_picture',
  trend_analysis: 'building_picture',
  full_analysis: 'full_history',
};

function buildStatusMessage(analysis) {
  const { tier, lastNight } = analysis;

  if (tier === 'insufficient_data') {
    return 'Keep tracking — we\'ll show patterns after a few more nights.';
  }
  if (tier === 'raw_comparison') {
    const avg = analysis.avgHours;
    return avg != null
      ? `Averaging ${avg}h over your last ${analysis.nightsLogged} nights. A few more nights and we'll show trends.`
      : 'Keep tracking — we\'ll show patterns after a few more nights.';
  }

  // trend_analysis / full_analysis — trend + debt carry the most signal
  const targetLabel = `${analysis.idealRange.min}-${analysis.idealRange.max}h`;
  if (analysis.trend === 'declining') {
    return `Your sleep has been declining this week — averaging ${analysis.avgHours7d}h against your ${targetLabel} target.`;
  }
  if (analysis.trend === 'improving') {
    return `Your sleep is trending up this week — averaging ${analysis.avgHours7d}h against your ${targetLabel} target.`;
  }
  if (analysis.sleepDebtHours > 0) {
    return `Fairly stable this week, but you're carrying a ${analysis.sleepDebtHours}h sleep debt against your ${targetLabel} target.`;
  }
  return `Your sleep has been steady this week, averaging ${analysis.avgHours7d}h within your ${targetLabel} target.`;
}

/**
 * Reshapes the raw tiered analysis into the flat, self-describing format the
 * mobile/web app renders directly — no tier-name lookups or conditional
 * logic required client-side. Each section carries its own `available` flag.
 */
function toAppSummary(analysis, coachMessage = null) {
  const hasTrend = analysis.tier === 'trend_analysis' || analysis.tier === 'full_analysis';
  const hasRegularity = analysis.tier === 'full_analysis';

  return {
    dataMaturity: TIER_TO_MATURITY[analysis.tier] || 'just_started',
    statusMessage: buildStatusMessage(analysis),
    lastNight: analysis.lastNight ? {
      date: analysis.lastNight.date,
      hoursSlept: analysis.lastNight.hours,
      comparedToTarget: analysis.lastNight.vsIdeal,
      sleepQuality: analysis.lastNight.efficiencyStatus,
      deepSleepPercent: analysis.lastNight.deepPct,
      remSleepPercent: analysis.lastNight.remPct,
    } : null,
    weeklyTrend: hasTrend ? {
      available: true,
      avgHoursPerNight: analysis.avgHours7d,
      targetHoursRange: analysis.idealRange,
      sleepDebtHours: analysis.sleepDebtHours,
      nightsGoalMet: analysis.goalAdherence7d,
      direction: analysis.trend,
    } : { available: false },
    bedtimeConsistency: hasRegularity ? {
      available: true,
      variationInMinutes: analysis.bedtimeVarianceMin,
      status: analysis.regularityStatus,
    } : { available: false },
    coachMessage: coachMessage ? {
      title: coachMessage.title,
      description: coachMessage.description,
      oneLiner: coachMessage.summary,
    } : null,
  };
}

module.exports = { getSleepClinicalAnalysis, getIdealSleepRange, STAGE_RANGES, toAppSummary };
