const User = require('../models/User');
const { toPlainAlcoholLog, DATE_KEY_RE } = require('../utils/alcoholLog');

const MAX_SPAN_DAYS = 365 * 5;

class AlcoholAnalyticsInputError extends Error {}

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
  const valid = nums.filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (!valid.length) return null;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100) / 100;
}

function resolveWindow(range, { date, startDate: customStart, endDate: customEnd }) {
  for (const [label, val] of [['date', date], ['startDate', customStart], ['endDate', customEnd]]) {
    if (val !== undefined && !DATE_KEY_RE.test(val)) {
      throw new AlcoholAnalyticsInputError(`${label} must be in YYYY-MM-DD format`);
    }
  }
  if (date && range !== 'daily') {
    throw new AlcoholAnalyticsInputError('date is only valid with range=daily — use startDate/endDate for weekly/monthly/yearly');
  }

  let matchStart;
  let matchEnd = null;

  if (date) {
    matchStart = parseDateOnlyUTC(date);
    matchEnd = parseDateOnlyUTC(date);
  } else if (customStart || customEnd) {
    matchStart = customStart ? parseDateOnlyUTC(customStart) : new Date(0);
    matchEnd = customEnd ? parseDateOnlyUTC(customEnd) : new Date();

    if (matchEnd < matchStart) {
      throw new AlcoholAnalyticsInputError('endDate must not be before startDate');
    }
    const spanDays = (matchEnd - matchStart) / 86400000;
    if (spanDays > MAX_SPAN_DAYS) {
      throw new AlcoholAnalyticsInputError(`Date range too large — max ${MAX_SPAN_DAYS} days`);
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

  return { matchStart, matchEnd };
}

function enrichEntry(dateKey, val) {
  const sessions = Array.isArray(val.sessions) ? val.sessions : [];
  const drinkTypeCounts = {};
  for (const s of sessions) {
    drinkTypeCounts[s.drinkType] = (drinkTypeCounts[s.drinkType] || 0) + 1;
  }
  const topDrinkType = Object.keys(drinkTypeCounts).sort((a, b) => drinkTypeCounts[b] - drinkTypeCounts[a])[0] || null;

  return {
    date: dateKey,
    count: val.count || 0,
    units: val.units || 0,
    totalVolumeMl: val.totalVolumeMl || 0,
    resistedCount: val.resistedCount || 0,
    topDrinkType,
    sessions,
  };
}

// Same date-window semantics as sleep/activity analytics: date OR
// startDate/endDate OR the implicit range default — one canonical resolver
// so behaviour never drifts module to module.
async function getAlcoholAnalytics(userId, range = 'daily', options = {}) {
  const { matchStart, matchEnd } = resolveWindow(range, options);

  const user = await User.findById(userId).select('alcoholLog profile.gender lifestyle.alcohol').lean();
  if (!user) throw new AlcoholAnalyticsInputError('User not found');

  const plain = toPlainAlcoholLog(user.alcoholLog);

  const startKey = matchStart.toISOString().split('T')[0];
  const endKey = (matchEnd || new Date()).toISOString().split('T')[0];

  const entries = Object.keys(plain)
    .filter((k) => DATE_KEY_RE.test(k) && k >= startKey && k <= endKey)
    .sort()
    .map((k) => enrichEntry(k, plain[k]));

  if (range === 'daily') {
    return { range, entries };
  }

  const buckets = {};
  for (const e of entries) {
    const key = bucketKey(e.date, range);
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(e);
  }

  const summary = Object.keys(buckets).sort().map((key) => {
    const group = buckets[key];
    const daysWithDrinking = group.filter((g) => g.units > 0).length;
    return {
      period: key,
      avgUnits: average(group.map((g) => g.units)),
      totalUnits: Math.round(group.reduce((s, g) => s + g.units, 0) * 100) / 100,
      avgDrinksPerDay: average(group.map((g) => g.count)),
      daysLogged: group.length,
      daysWithDrinking,
      totalResisted: group.reduce((s, g) => s + g.resistedCount, 0),
    };
  });

  return { range, summary };
}

module.exports = { getAlcoholAnalytics, AlcoholAnalyticsInputError };
