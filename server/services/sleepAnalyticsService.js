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

async function getSleepAnalytics(userId, range = 'daily') {
  const rangeDays = { daily: 30, weekly: 90, monthly: 365, yearly: 365 * 5 }[range] || 30;
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - rangeDays);
  startDate.setUTCHours(0, 0, 0, 0);

  // Aggregation projects only sleepData subfields — avoids pulling heartRate/
  // bloodOxygen/stressLevels arrays that grow unbounded per connected device.
  const rows = await WearableData.aggregate([
    { $match: { user: userId } },
    { $unwind: '$sleepData' },
    { $match: { 'sleepData.date': { $gte: startDate } } },
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

module.exports = { getSleepAnalytics, estimateQualityScore };
