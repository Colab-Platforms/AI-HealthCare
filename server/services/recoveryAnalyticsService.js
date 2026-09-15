// Mirrors activityAnalyticsService.js's structure — reads RecoveryDailySummary.
// Unlike the other *DailySummary collections, RecoveryDailySummary.date is a
// 'YYYY-MM-DD' string (matching DailyHealthScore's convention, since
// calculateRecoveryScore follows calculateDailyScore's exact shape) rather
// than a Date, so the window here is string bounds, not Date objects —
// lexicographic comparison works fine for ISO date strings.

const RecoveryDailySummary = require('../models/RecoveryDailySummary');

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SPAN_DAYS = 365 * 5;

class RecoveryAnalyticsInputError extends Error {}

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
      throw new RecoveryAnalyticsInputError(`${label} must be in YYYY-MM-DD format`);
    }
  }
  if (date && range !== 'daily') {
    throw new RecoveryAnalyticsInputError('date is only valid with range=daily — use startDate/endDate for weekly/monthly/yearly');
  }

  let startStr;
  let endStr = null;

  if (date) {
    startStr = date;
    endStr = date;
  } else if (customStart || customEnd) {
    startStr = customStart || '0000-01-01';
    endStr = customEnd || toDateStr(new Date());

    if (endStr < startStr) {
      throw new RecoveryAnalyticsInputError('endDate must not be before startDate');
    }
    const spanDays = (new Date(endStr) - new Date(startStr)) / 86400000;
    if (spanDays > MAX_SPAN_DAYS) {
      throw new RecoveryAnalyticsInputError(`Date range too large — max ${MAX_SPAN_DAYS} days`);
    }
  } else if (range === 'weekly') {
    startStr = toDateStr(currentWeekStartUTC());
  } else if (range === 'monthly') {
    const now = new Date();
    startStr = toDateStr(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  } else if (range === 'yearly') {
    const now = new Date();
    startStr = toDateStr(new Date(Date.UTC(now.getUTCFullYear(), 0, 1)));
  } else {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 30);
    startStr = toDateStr(start);
  }

  return { $gte: startStr, ...(endStr ? { $lte: endStr } : {}) };
}

async function getRecoveryAnalytics(userId, range = 'daily', options = {}) {
  const dateMatch = resolveWindow(range, options);

  const rows = await RecoveryDailySummary.find({ user: userId, date: dateMatch })
    .select('date recoveryScore components')
    .sort({ date: 1 })
    .lean();

  const entries = rows.map(r => ({
    date: r.date,
    recoveryScore: r.recoveryScore,
    components: r.components || {}
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
      avgRecoveryScore: average(group.map(g => g.recoveryScore)),
      daysLogged: group.length
    };
  });

  return { range, summary };
}

module.exports = { getRecoveryAnalytics, RecoveryAnalyticsInputError };
