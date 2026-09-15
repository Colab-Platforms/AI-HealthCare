const WearableData = require('../models/WearableData');

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

  // Only the fields the aggregation below reads — same "don't pull the whole
  // wearable document" discipline as the dashboard's own wearable query.
  const wearables = await WearableData.find({ user: userId })
    .select('dailyMetrics.date dailyMetrics.steps dailyMetrics.caloriesBurned isConnected')
    .lean();

  const hasWearableConnected = wearables.some(w => w.isConnected);

  // Merge same-day entries across every device/manual doc, tracking which
  // dates actually have a reading — the has-entry map is what lets us tell
  // "no data" apart from "measured, and it was zero".
  const byDate = {};
  for (const w of wearables) {
    w.dailyMetrics?.forEach(m => {
      if (!m.date) return;
      const dateObj = new Date(m.date);
      if (dateObj < dateMatch.$gte || (dateMatch.$lte && dateObj > dateMatch.$lte)) return;
      const d = dateObj.toISOString().split('T')[0];
      if (!byDate[d]) byDate[d] = { steps: 0, caloriesBurned: 0 };
      byDate[d].steps += m.steps || 0;
      byDate[d].caloriesBurned += m.caloriesBurned || 0;
    });
  }

  const entries = Object.keys(byDate).sort().map(date => ({
    date,
    steps: byDate[date].steps,
    caloriesBurned: byDate[date].caloriesBurned,
  }));

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
