// "Patterns" — counts two specific, pre-defined correlations in the user's
// own last-30-days history. This is a frequency count over their own data,
// NOT machine learning and NOT a causal claim — every pattern surfaced to
// the user is labeled "correlation, not cause" per the product design.
//
// Only two patterns are checked (matching the design mock exactly):
//   1. Recovery was lower after 2 consecutive high-activity days.
//   2. A night under 6h30m was followed by a below-baseline morning.
// A pattern is only surfaced if it happened at least MIN_OCCURRENCES times —
// otherwise it's noise, not a pattern, and stays silent rather than showing
// a "trend" built on one coincidence.

const RecoveryDailySummary = require('../models/RecoveryDailySummary');
const DailyActivityMetric = require('../models/DailyActivityMetric');
const SleepSession = require('../models/SleepSession');

const LOOKBACK_DAYS = 30;
const MIN_OCCURRENCES = 3;
const SHORT_SLEEP_THRESHOLD_MIN = 390; // 6h30m
const HIGH_ACTIVITY_MULTIPLIER = 1.3; // vs. the user's own 30-day average active minutes

function dateKeyUTC(d) {
  return new Date(d).toISOString().split('T')[0];
}

async function detectPatterns(userId) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - LOOKBACK_DAYS);

  const [recoveryRows, activityRows, sleepRows] = await Promise.all([
    RecoveryDailySummary.find({ user: userId, date: { $gte: dateKeyUTC(start) } })
      .select('date recoveryScore band').lean(),
    DailyActivityMetric.find({ user: userId, date: { $gte: start } })
      .select('date activeMinutes').lean(),
    SleepSession.find({ user: userId, date: { $gte: start } })
      .select('date totalSleepMinutes').lean(),
  ]);

  if (recoveryRows.length < 5) return []; // not enough history to say anything meaningful

  const recoveryByDate = new Map(recoveryRows.map((r) => [r.date, r]));
  const activityByDate = new Map(activityRows.map((a) => [dateKeyUTC(a.date), a.activeMinutes || 0]));
  const sleepByDate = new Map(sleepRows.map((s) => [dateKeyUTC(s.date), s.totalSleepMinutes || 0]));

  const avgActiveMinutes = activityRows.length
    ? activityRows.reduce((s, a) => s + (a.activeMinutes || 0), 0) / activityRows.length
    : null;

  const isLowBand = (row) => row && (row.band?.key === 'low' || row.band?.key === 'very_low');

  let highActivityStreakCount = 0;
  let shortSleepCount = 0;

  const sortedDates = [...recoveryByDate.keys()].sort();
  for (const dateStr of sortedDates) {
    const d = new Date(dateStr);
    const prev1 = dateKeyUTC(new Date(d.getTime() - 86400000));
    const prev2 = dateKeyUTC(new Date(d.getTime() - 2 * 86400000));

    // Pattern 1: two consecutive high-activity days before a low-recovery day.
    if (avgActiveMinutes > 0) {
      const highThreshold = avgActiveMinutes * HIGH_ACTIVITY_MULTIPLIER;
      const prev1High = (activityByDate.get(prev1) || 0) > highThreshold;
      const prev2High = (activityByDate.get(prev2) || 0) > highThreshold;
      if (prev1High && prev2High && isLowBand(recoveryByDate.get(dateStr))) {
        highActivityStreakCount++;
      }
    }

    // Pattern 2: a short night followed by a below-baseline morning.
    const prevNightMinutes = sleepByDate.get(prev1);
    if (prevNightMinutes != null && prevNightMinutes < SHORT_SLEEP_THRESHOLD_MIN && isLowBand(recoveryByDate.get(dateStr))) {
      shortSleepCount++;
    }
  }

  const patterns = [];
  if (highActivityStreakCount >= MIN_OCCURRENCES) {
    patterns.push({
      text: 'Recovery was lowest after two consecutive high-activity days.',
      basis: `Observed ${highActivityStreakCount} times in the last ${LOOKBACK_DAYS} days`,
    });
  }
  if (shortSleepCount >= MIN_OCCURRENCES) {
    patterns.push({
      text: 'Nights under 6h 30m were followed by a below-baseline morning most of the time.',
      basis: 'Based on your own history · correlation, not cause',
    });
  }
  return patterns;
}

module.exports = { detectPatterns };
