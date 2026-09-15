const WearableData = require('../models/WearableData');

// Fallback score jab device se sleepScore na aaye (manual entry).
// NSF guideline: 8hrs ideal, deviation se linearly penalize karta hai.
function estimateQualityScore(totalSleepMinutes) {
  if (!totalSleepMinutes) return null;
  const hours = totalSleepMinutes / 60;
  const deviation = Math.abs(hours - 8);
  const score = 100 - deviation * 15;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function enrichEntry(raw) {
  const total = raw.totalSleepMinutes || 0;
  const deep = raw.deepSleepMinutes || 0;
  const light = raw.lightSleepMinutes || 0;
  const rem = raw.remSleepMinutes || 0;
  const awake = raw.awakeMinutes || 0;
  const hasStages = deep > 0 || light > 0 || rem > 0;
  // Stage minutes only ever come from hardware — a manual typed entry can never
  // have them, regardless of what deviceType the record happens to be filed under.
  const source = hasStages ? 'wearable' : 'manual';

  const timeInBed = total + awake;
  const efficiency = timeInBed > 0 ? Math.round((total / timeInBed) * 1000) / 10 : null;

  return {
    date: raw.date.toISOString().split('T')[0],
    totalHours: Math.round((total / 60) * 10) / 10,
    source,
    bedTime: raw.bedTime || null,
    wakeTime: raw.wakeTime || null,
    stages: hasStages ? {
      deepMinutes: deep,
      lightMinutes: light,
      remMinutes: rem,
      awakeMinutes: awake,
      deepPct: total ? Math.round((deep / total) * 100) : 0,
      lightPct: total ? Math.round((light / total) * 100) : 0,
      remPct: total ? Math.round((rem / total) * 100) : 0,
    } : null,
    efficiency,
    sleepScore: typeof raw.sleepScore === 'number' ? raw.sleepScore : estimateQualityScore(total),
    scoreType: typeof raw.sleepScore === 'number' ? 'device' : 'estimated',
  };
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
  return dateStr; // daily
}

function average(nums) {
  const valid = nums.filter(n => typeof n === 'number' && !Number.isNaN(n));
  if (!valid.length) return null;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SPAN_DAYS = 365 * 5; // hard cap: 5 years, regardless of what caller asks for

function parseDateOnlyUTC(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

// Monday (UTC) of the current ISO week.
function currentWeekStartUTC() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - diffToMonday);
  return monday;
}

class SleepAnalyticsInputError extends Error {}

async function getSleepAnalytics(userId, range = 'daily', options = {}) {
  const { date, startDate: customStart, endDate: customEnd } = options;

  for (const [label, val] of [['date', date], ['startDate', customStart], ['endDate', customEnd]]) {
    if (val !== undefined && !DATE_ONLY_RE.test(val)) {
      throw new SleepAnalyticsInputError(`${label} must be in YYYY-MM-DD format`);
    }
  }

  if (date && range !== 'daily') {
    throw new SleepAnalyticsInputError('date is only valid with range=daily — use startDate/endDate for weekly/monthly/yearly');
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
      throw new SleepAnalyticsInputError('endDate must not be before startDate');
    }
    const spanDays = (matchEnd - matchStart) / 86400000;
    if (spanDays > MAX_SPAN_DAYS) {
      throw new SleepAnalyticsInputError(`Date range too large — max ${MAX_SPAN_DAYS} days`);
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
    // 'daily' with no date filter — recent history list, not a single day.
    matchStart = new Date();
    matchStart.setUTCDate(matchStart.getUTCDate() - 30);
    matchStart.setUTCHours(0, 0, 0, 0);
  }

  const dateMatch = matchEnd ? { $gte: matchStart, $lte: matchEnd } : { $gte: matchStart };

  // Aggregation projects only sleepData subfields — avoids pulling heartRate/
  // bloodOxygen/stressLevels arrays that grow unbounded per connected device.
  const rows = await WearableData.aggregate([
    { $match: { user: userId } },
    { $unwind: '$sleepData' },
    { $match: { 'sleepData.date': dateMatch } },
    { $project: {
        _id: 0,
        date: '$sleepData.date',
        totalSleepMinutes: '$sleepData.totalSleepMinutes',
        deepSleepMinutes: '$sleepData.deepSleepMinutes',
        lightSleepMinutes: '$sleepData.lightSleepMinutes',
        remSleepMinutes: '$sleepData.remSleepMinutes',
        awakeMinutes: '$sleepData.awakeMinutes',
        sleepScore: '$sleepData.sleepScore',
        bedTime: '$sleepData.bedTime',
        wakeTime: '$sleepData.wakeTime',
        deviceType: 1,
    }},
    { $sort: { date: 1 } },
  ]);

  const entries = rows.map(enrichEntry);

  if (range === 'daily') {
    return { range, entries };
  }

  // Bucket into weekly/monthly/yearly averages
  const buckets = {};
  for (const e of entries) {
    const key = bucketKey(e.date, range);
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(e);
  }

  const summary = Object.keys(buckets).sort().map(key => {
    const group = buckets[key];
    const manualCount = group.filter(g => g.source === 'manual').length;
    const wearableCount = group.filter(g => g.source === 'wearable').length;
    return {
      period: key,
      avgHours: average(group.map(g => g.totalHours)),
      avgScore: average(group.map(g => g.sleepScore)),
      avgDeepPct: average(group.map(g => g.stages?.deepPct).filter(v => v !== undefined)),
      avgLightPct: average(group.map(g => g.stages?.lightPct).filter(v => v !== undefined)),
      avgRemPct: average(group.map(g => g.stages?.remPct).filter(v => v !== undefined)),
      daysLogged: group.length,
      sources: { manual: manualCount, wearable: wearableCount },
    };
  });

  return { range, summary };
}

module.exports = { getSleepAnalytics, estimateQualityScore, SleepAnalyticsInputError };
