const WearableData = require('../models/WearableData');
const DailyActivityMetric = require('../models/DailyActivityMetric');
const DailyHealthScore = require('../models/DailyHealthScore');
const { classifyCalendarBand } = require('../utils/calendarBand');

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SPAN_DAYS = 365 * 5;

class ActivityAnalyticsInputError extends Error {}

function parseDateOnlyUTC(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
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

  // Connection status still lives on the lightweight WearableData registry
  // doc; the actual day-by-day numbers now live in their own right-sized
  // collection, queried directly by date range instead of pulling every
  // device's full history and filtering in JS.
  const [devices, dailyEntries, dailyScores] = await Promise.all([
    WearableData.find({ user: userId }).select('isConnected').lean(),
    DailyActivityMetric.find({ user: userId, date: dateMatch }).select('date steps caloriesBurned').lean(),
    // The Activity Score itself (steps + active minutes + logged exercise,
    // WHO/CDC-guideline-based, sigmoid-saturating to each goal) is already
    // computed and persisted once per day by dailyHealthScoreService — read
    // it here rather than recomputing, same pattern recoveryAnalyticsService
    // uses for RecoveryDailySummary.recoveryScore.
    DailyHealthScore.find({ userId, date: { $gte: startStr, $lte: endStr } }).select('date components.activity').lean()
  ]);

  const hasWearableConnected = devices.some(w => w.isConnected);

  const activityScoreByDate = {};
  for (const row of dailyScores) {
    if (typeof row.components?.activity === 'number') {
      activityScoreByDate[row.date] = row.components.activity;
    }
  }

  // Merge same-day entries across every device — the has-entry map is what
  // lets us tell "no data" apart from "measured, and it was zero".
  const byDate = {};
  for (const entry of dailyEntries) {
    const d = new Date(entry.date).toISOString().split('T')[0];
    if (!byDate[d]) byDate[d] = { steps: 0, caloriesBurned: 0 };
    byDate[d].steps += entry.steps || 0;
    byDate[d].caloriesBurned += entry.caloriesBurned || 0;
  }
  // A day can have an Activity Score (e.g. from logged exercise alone) with
  // no DailyActivityMetric row at all — include those dates too, so the
  // calendar doesn't drop a real "good day" just because no device synced.
  for (const date of Object.keys(activityScoreByDate)) {
    if (!byDate[date]) byDate[date] = { steps: 0, caloriesBurned: 0 };
  }

  const entries = Object.keys(byDate).sort().map(date => {
    const activityScore = activityScoreByDate[date];
    return {
      date,
      steps: byDate[date].steps,
      caloriesBurned: byDate[date].caloriesBurned,
      activityScore: typeof activityScore === 'number' ? Math.round(activityScore * 10) / 10 : null,
      // 3-tier band for the mobile Score Calendar's dots — see calendarBand.js.
      calendarBand: typeof activityScore === 'number' ? classifyCalendarBand(activityScore) : null,
    };
  });

  if (range === 'daily') {
    return { range, hasWearableConnected, entries };
  }

  const buckets = {};
  for (const e of entries) {
    const key = bucketKey(e.date, range);
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(e);
  }

  const summary = Object.keys(buckets).sort().map(key => {
    const group = buckets[key];
    return {
      period: key,
      avgSteps: average(group.map(g => g.steps)),
      avgCaloriesBurned: average(group.map(g => g.caloriesBurned)),
      daysLogged: group.length,
    };
  });

  return { range, hasWearableConnected, summary };
}

module.exports = { getActivityAnalytics, ActivityAnalyticsInputError };
