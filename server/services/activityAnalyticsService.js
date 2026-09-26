const WearableData = require('../models/WearableData');
const DailyActivityMetric = require('../models/DailyActivityMetric');
const DailyHealthScore = require('../models/DailyHealthScore');
const ExerciseLog = require('../models/ExerciseLog');
const User = require('../models/User');
const HealthGoal = require('../models/HealthGoal');
const { classifyCalendarBand } = require('../utils/calendarBand');
const { getExerciseGuidance } = require('./exerciseGuidanceService');
const { buildActivityInsight } = require('./activityScoreInsightService');

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SPAN_DAYS = 365 * 5;
const STRENGTH_WINDOW_DAYS = 7; // rolling window — see the comment on strengthSessionsLast7Days below

class ActivityAnalyticsInputError extends Error {}

function parseDateOnlyUTC(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

function currentWeekStartUTC() {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - diffToMonday);
  return monday;
}

function bucketKey(dateStr, range) {
  const d = new Date(dateStr);
  if (range === 'weekly') {
    const onejan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d - onejan) / 86400000) + onejan.getUTCDay() + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }
  if (range === 'monthly') return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  if (range === 'yearly') return `${d.getUTCFullYear()}`;
  return dateStr;
}

function average(nums) {
  const valid = nums.filter(n => typeof n === 'number' && !Number.isNaN(n));
  if (!valid.length) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

function resolveWindow(range, { date, startDate: customStart, endDate: customEnd }) {
  for (const [label, val] of [['date', date], ['startDate', customStart], ['endDate', customEnd]]) {
    if (val !== undefined && !DATE_ONLY_RE.test(val)) {
      throw new ActivityAnalyticsInputError(`${label} must be in YYYY-MM-DD format`);
    }
  }
  if (date && range !== 'daily') {
    throw new ActivityAnalyticsInputError('date is only valid with range=daily — use startDate/endDate for weekly/monthly/yearly');
  }

  let matchStart;
  let matchEnd = null;

  if (date) {
    matchStart = parseDateOnlyUTC(date);
    matchEnd = parseDateOnlyUTC(date);
    matchEnd.setUTCHours(23, 59, 59, 999);
  } else if (customStart || customEnd) {
    matchStart = customStart ? parseDateOnlyUTC(customStart) : new Date(0);
    matchEnd = customEnd ? parseDateOnlyUTC(customEnd) : new Date();
    matchEnd.setUTCHours(23, 59, 59, 999);

    if (matchEnd < matchStart) {
      throw new ActivityAnalyticsInputError('endDate must not be before startDate');
    }
    const spanDays = (matchEnd - matchStart) / 86400000;
    if (spanDays > MAX_SPAN_DAYS) {
      throw new ActivityAnalyticsInputError(`Date range too large — max ${MAX_SPAN_DAYS} days`);
    }
  } else if (range === 'weekly') {
    matchStart = currentWeekStartUTC();
  } else if (range === 'monthly') {
    const now = new Date();
    matchStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  } else if (range === 'yearly') {
    const now = new Date();
    matchStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  } else {
    matchStart = new Date();
    matchStart.setUTCDate(matchStart.getUTCDate() - 30);
    matchStart.setUTCHours(0, 0, 0, 0);
  }

  return { $gte: matchStart, ...(matchEnd ? { $lte: matchEnd } : {}) };
}

async function getActivityAnalytics(userId, range = 'daily', options = {}) {
  const dateMatch = resolveWindow(range, options);

  // Same window as dateMatch above but as YYYY-MM-DD strings — DailyHealthScore
  // stores `date` as a string (matching RecoveryDailySummary's convention),
  // not a Date, so it needs its own bounds rather than reusing dateMatch.
  const startStr = dateMatch.$gte.toISOString().split('T')[0];
  const endStr = (dateMatch.$lte || new Date()).toISOString().split('T')[0];

  // Strength uses a rolling 7-day lookback (see below), so the FIRST output
  // day in the range needs ExerciseLog data from up to 6 days before it —
  // fetched once here, not once per output day.
  const exerciseLogWindowStart = new Date(dateMatch.$gte.getTime() - (STRENGTH_WINDOW_DAYS - 1) * 86400000);

  // Connection status still lives on the lightweight WearableData registry
  // doc; the actual day-by-day numbers now live in their own right-sized
  // collection, queried directly by date range instead of pulling every
  // device's full history and filtering in JS.
  const [devices, dailyEntries, dailyScores, exerciseLogs, user, healthGoal] = await Promise.all([
    WearableData.find({ user: userId }).select('isConnected').lean(),
    DailyActivityMetric.find({ user: userId, date: dateMatch }).select('date steps activeMinutes caloriesBurned').lean(),
    // The Activity Score itself is already computed and persisted once per
    // day by dailyHealthScoreService — read it here rather than recomputing
    // (same pattern recoveryAnalyticsService uses for RecoveryDailySummary),
    // so there is exactly one place that formula lives and this endpoint can
    // never disagree with the Health Score's own number for the same day.
    DailyHealthScore.find({ userId, date: { $gte: startStr, $lte: endStr } }).select('date components.activity').lean(),
    ExerciseLog.find({ userId, timestamp: { $gte: exerciseLogWindowStart, $lte: dateMatch.$lte || new Date() } })
      .select('duration category caloriesBurned timestamp').lean(),
    User.findById(userId).select('profile.age').lean(),
    HealthGoal.findOne({ userId, isActive: true }).select('age goalType').lean(),
  ]);

  const hasWearableConnected = devices.some(w => w.isConnected);

  // Personalized targets — age/goal-based (WHO/ACSM/CDC, see
  // exerciseGuidanceService.js), fetched ONCE for the whole request. These
  // don't vary day-to-day for a given user, so every day/period in the
  // response shares the same goals block instead of recomputing it per day.
  const guidance = getExerciseGuidance(healthGoal?.age ?? user?.profile?.age, healthGoal?.goalType ?? null);
  const dailyCardioTarget = Math.round((guidance.cardioMinutesPerWeek / 7) * 10) / 10;
  const goals = {
    steps: guidance.stepsGoal,
    activeMinutes: dailyCardioTarget,
    cardioMinutes: dailyCardioTarget,
    strengthSessionsPerWeek: guidance.strengthSessionsPerWeek,
  };

  const activityScoreByDate = {};
  for (const row of dailyScores) {
    if (typeof row.components?.activity === 'number') {
      activityScoreByDate[row.date] = row.components.activity;
    }
  }

  // Device signals (steps, active minutes) — WearableData/DailyActivityMetric
  // only, never touched by manual ExerciseLog entries below. Merge same-day
  // entries across every connected device.
  const deviceByDate = {};
  for (const entry of dailyEntries) {
    const d = toDateStr(new Date(entry.date));
    if (!deviceByDate[d]) deviceByDate[d] = { steps: 0, activeMinutes: 0, caloriesBurned: 0 };
    deviceByDate[d].steps += entry.steps || 0;
    deviceByDate[d].activeMinutes += entry.activeMinutes || 0;
    deviceByDate[d].caloriesBurned += entry.caloriesBurned || 0;
  }

  // Manual signals (deliberate logged exercise) — ExerciseLog only, never
  // touched by device-sync above. cardioMinutes feeds the score (see
  // dailyHealthScoreService.js); totalMinutes/sessionsCount/caloriesBurned
  // are display-only, across every logged category.
  const manualByDate = {};
  for (const log of exerciseLogs) {
    const d = toDateStr(new Date(log.timestamp));
    if (!manualByDate[d]) manualByDate[d] = { cardioMinutes: 0, totalMinutes: 0, sessionsCount: 0, caloriesBurned: 0 };
    const duration = Number(log.duration) || 0;
    manualByDate[d].totalMinutes += duration;
    manualByDate[d].sessionsCount += 1;
    manualByDate[d].caloriesBurned += Number(log.caloriesBurned) || 0;
    if (log.category === 'cardio') manualByDate[d].cardioMinutes += duration;
  }

  // Strength: rolling 7-day count ending on each output day, not "did they
  // train today" — strength guidance is 2-3 sessions/WEEK, not daily, so a
  // single day's yes/no reads a correctly-spaced rest day as a failure (see
  // dailyHealthScoreService.js's identical rolling-window rationale). Built
  // once from the already-fetched exerciseLogs rather than one query per day.
  function strengthSessionsEndingOn(dateStr) {
    const dayEnd = parseDateOnlyUTC(dateStr);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1); // exclusive upper bound
    const windowStart = new Date(dayEnd.getTime() - STRENGTH_WINDOW_DAYS * 86400000);
    return exerciseLogs.filter((log) =>
      log.category === 'strength' &&
      new Date(log.timestamp) >= windowStart &&
      new Date(log.timestamp) < dayEnd
    ).length;
  }

  // Union of every date with ANY signal — device, manual, or a persisted
  // score — so a day isn't dropped just because one source is silent.
  const allDates = new Set([
    ...Object.keys(deviceByDate),
    ...Object.keys(manualByDate).filter((d) => d >= startStr && d <= endStr),
    ...Object.keys(activityScoreByDate),
  ]);

  const dateList = [...allDates].sort();
  // Insight text is only computed for a true single-day lookup (?date= or a
  // one-day range) — not for every day of a calendar-month range, where 30
  // rule-based insight computations per request would be wasted work the
  // calendar view never reads (it only needs score + band for the dots).
  const isSingleDayLookup = dateList.length <= 1;

  const entries = dateList.map((date) => {
    const device = deviceByDate[date] || { steps: 0, activeMinutes: 0, caloriesBurned: 0 };
    const manual = manualByDate[date] || { cardioMinutes: 0, totalMinutes: 0, sessionsCount: 0, caloriesBurned: 0 };
    const strengthSessionsLast7Days = strengthSessionsEndingOn(date);
    const activityScore = activityScoreByDate[date];

    // Movement/cardio signal: device's passive active-minutes takes priority
    // over manually-logged cardio-minutes — both can describe the SAME real
    // workout (a run the wearable detected as elevated heart-rate AND the
    // user separately logged), so they are never both counted; manual is
    // used only as a fallback when the device reports nothing that day. This
    // mirrors dailyHealthScoreService.js's scoring exactly (see that file's
    // comment) — `source` here tells the client which one actually won,
    // matching what fed the real Activity Score.
    let movementMinutes = null;
    if (device.activeMinutes > 0) {
      movementMinutes = { actual: device.activeMinutes, goal: goals.activeMinutes, source: 'device' };
    } else if (manual.cardioMinutes > 0) {
      movementMinutes = { actual: manual.cardioMinutes, goal: goals.cardioMinutes, source: 'manual' };
    }

    const entry = {
      date,
      // device/manual below are the raw, untouched readings from each
      // source — always shown as-is regardless of which one wins the
      // movementMinutes slot, so nothing the user logged or synced is hidden.
      device: {
        steps: device.steps,
        activeMinutes: device.activeMinutes,
        caloriesBurned: device.caloriesBurned,
      },
      manual: {
        cardioMinutes: manual.cardioMinutes,
        totalExerciseMinutes: manual.totalMinutes,
        sessionsCount: manual.sessionsCount,
        caloriesBurned: manual.caloriesBurned,
        strengthSessionsLast7Days,
      },
      // The signal that actually feeds the Activity Score's "movement" slot —
      // see the comment above.
      movementMinutes,
      goals,
      // Single source of truth — see the DailyHealthScore.find() comment
      // above. Never recomputed here.
      activityScore: typeof activityScore === 'number' ? Math.round(activityScore * 10) / 10 : null,
      calendarBand: typeof activityScore === 'number' ? classifyCalendarBand(activityScore) : null,
    };

    if (isSingleDayLookup && typeof activityScore === 'number') {
      entry.insight = buildActivityInsight(entry);
    }

    return entry;
  });

  if (range === 'daily') {
    return { range, startDate: startStr, endDate: endStr, hasWearableConnected, goals, days: entries };
  }

  const buckets = {};
  for (const e of entries) {
    const key = bucketKey(e.date, range);
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(e);
  }

  const summary = Object.keys(buckets).sort().map((key) => {
    const group = buckets[key];
    const avgActivityScore = average(group.map((g) => g.activityScore));
    const avgDeviceActiveMinutes = average(group.map((g) => g.device.activeMinutes)) || 0;
    const avgManualCardioMinutes = average(group.map((g) => g.manual.cardioMinutes)) || 0;
    const periodAverages = {
      device: { steps: average(group.map((g) => g.device.steps)) || 0, activeMinutes: avgDeviceActiveMinutes, caloriesBurned: 0 },
      manual: { cardioMinutes: avgManualCardioMinutes, strengthSessionsLast7Days: average(group.map((g) => g.manual.strengthSessionsLast7Days)) || 0 },
      // Same device-priority/manual-fallback rule as the per-day entries —
      // built from the period's own averages so the insight for a
      // weekly/monthly bucket stays consistent with how each day inside it
      // was actually scored.
      movementMinutes: avgDeviceActiveMinutes > 0
        ? { actual: avgDeviceActiveMinutes, goal: goals.activeMinutes, source: 'device' }
        : avgManualCardioMinutes > 0
          ? { actual: avgManualCardioMinutes, goal: goals.cardioMinutes, source: 'manual' }
          : null,
      goals,
      activityScore: avgActivityScore,
    };
    return {
      period: key,
      daysLogged: group.length,
      avgSteps: periodAverages.device.steps,
      avgActiveMinutes: periodAverages.device.activeMinutes,
      avgCardioMinutes: periodAverages.manual.cardioMinutes,
      // Same device-priority/manual-fallback rule as movementMinutes above —
      // NOT a sum. A device-synced workout (e.g. an Apple Watch session that
      // reaches ExerciseLog via /exercise/log) can already be counted in the
      // device's daily caloriesBurned total; adding manual's on top would
      // double-count that same real-world workout's calories.
      avgCaloriesBurned: average(group.map((g) => g.device.caloriesBurned > 0 ? g.device.caloriesBurned : g.manual.caloriesBurned)),
      avgActivityScore,
      // Insight here is built from the PERIOD's averages, not any single day —
      // "on an average day this period" — one computation per bucket (a
      // handful of weeks/months), not per day, so this stays cheap even over
      // a multi-year range.
      insight: typeof avgActivityScore === 'number' ? buildActivityInsight(periodAverages) : null,
    };
  });

  return { range, startDate: startStr, endDate: endStr, hasWearableConnected, goals, summary };
}

module.exports = { getActivityAnalytics, ActivityAnalyticsInputError };
