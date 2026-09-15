// Mirrors activityAnalyticsService.js's structure exactly (resolveWindow,
// bucketKey, average, daily/weekly/monthly/yearly branching) — reads
// StressDailySummary instead of DailyActivityMetric. All computation stays
// server-side; the frontend renders entries/summary as-is.

const StressDailySummary = require('../models/StressDailySummary');

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SPAN_DAYS = 365 * 5;

class StressAnalyticsInputError extends Error {}

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
      throw new StressAnalyticsInputError(`${label} must be in YYYY-MM-DD format`);
    }
  }
  if (date && range !== 'daily') {
    throw new StressAnalyticsInputError('date is only valid with range=daily — use startDate/endDate for weekly/monthly/yearly');
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
      throw new StressAnalyticsInputError('endDate must not be before startDate');
    }
    const spanDays = (matchEnd - matchStart) / 86400000;
    if (spanDays > MAX_SPAN_DAYS) {
      throw new StressAnalyticsInputError(`Date range too large — max ${MAX_SPAN_DAYS} days`);
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

async function getStressAnalytics(userId, range = 'daily', options = {}) {
  const dateMatch = resolveWindow(range, options);

  const rows = await StressDailySummary.find({ user: userId, date: dateMatch })
    .select('date avgLevel min max readingCount highStressMinutes')
    .sort({ date: 1 })
    .lean();

  const entries = rows.map(r => ({
    date: new Date(r.date).toISOString().split('T')[0],
    avgLevel: r.avgLevel,
    minLevel: r.min?.value ?? null,
    minLevelAt: r.min?.timestamp ?? null,
    maxLevel: r.max?.value ?? null,
    maxLevelAt: r.max?.timestamp ?? null,
    highStressMinutes: r.highStressMinutes || 0,
    readingCount: r.readingCount || 0
  }));

  if (range === 'daily') {
    return { range, entries };
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
      avgLevel: average(group.map(g => g.avgLevel)),
      totalHighStressMinutes: group.reduce((sum, g) => sum + g.highStressMinutes, 0),
      daysLogged: group.length
    };
  });

  return { range, summary };
}

module.exports = { getStressAnalytics, StressAnalyticsInputError };
