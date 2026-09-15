// Computes RecoveryDailySummary the same way dailyHealthScoreService computes
// DailyHealthScore: event-driven (via triggerRecoveryScoreRecompute, fired
// from log-write endpoints), reads the day's inputs fresh, upserts one row
// per user per day, and deletes rather than zero-fills a day with no data.
//
// Component scoring is a first-pass heuristic (0-100 per component, weighted
// average) — same "reasonable default, tune later" spirit as
// sleepAnalyticsService's estimateQualityScore. Not a clinical formula.

const HeartRateDailySummary = require('../models/HeartRateDailySummary');
const StressDailySummary = require('../models/StressDailySummary');
const VitalsDailySummary = require('../models/VitalsDailySummary');
const BloodOxygenSample = require('../models/BloodOxygenSample');
const SleepSession = require('../models/SleepSession');
const DailyActivityMetric = require('../models/DailyActivityMetric');
const RecoveryDailySummary = require('../models/RecoveryDailySummary');

function dateOnlyUTC(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

// Lower resting HR and higher HRV both read as "more recovered" — score
// relative to the user's own recent baseline rather than a fixed number,
// since a healthy resting HR varies a lot person to person.
function scoreAgainstBaseline(value, baseline, direction) {
  if (value == null || baseline == null || baseline === 0) return null;
  const pctDelta = ((value - baseline) / baseline) * 100;
  const signed = direction === 'lowerIsBetter' ? -pctDelta : pctDelta;
  return Math.max(0, Math.min(100, Math.round(50 + signed * 5)));
}

async function calculateRecoveryScore(userId, dateStr) {
  const date = dateOnlyUTC(dateStr);
  const baselineStart = new Date(date);
  baselineStart.setUTCDate(baselineStart.getUTCDate() - 30);

  const [todayHr, baselineHr, todayStress, todaySleep, todayVitals, todaySpo2, priorDayActivity, deviceDoc] = await Promise.all([
    HeartRateDailySummary.findOne({ user: userId, date }).lean(),
    HeartRateDailySummary.find({ user: userId, date: { $gte: baselineStart, $lt: date } }).select('restingBpm.value').lean(),
    StressDailySummary.findOne({ user: userId, date }).lean(),
    SleepSession.findOne({ user: userId, date }).lean(),
    VitalsDailySummary.findOne({ user: userId, date }).lean(),
    BloodOxygenSample.aggregate([
      { $match: { user: userId, timestamp: { $gte: date, $lt: new Date(date.getTime() + 86400000) } } },
      { $group: { _id: null, avg: { $avg: '$percentage' } } }
    ]),
    DailyActivityMetric.findOne({ user: userId, date: new Date(date.getTime() - 86400000) }).lean(),
    HeartRateDailySummary.findOne({ user: userId, date }).select('deviceType').lean()
  ]);

  const components = {};

  const baselineRestingValues = baselineHr.map(h => h.restingBpm?.value).filter(v => typeof v === 'number');
  const baselineResting = baselineRestingValues.length
    ? baselineRestingValues.reduce((a, b) => a + b, 0) / baselineRestingValues.length
    : null;
  if (todayHr?.restingBpm?.value != null) {
    const score = scoreAgainstBaseline(todayHr.restingBpm.value, baselineResting, 'lowerIsBetter');
    if (score != null) components.restingHeartRate = score;
  }

  if (todayStress?.avgLevel != null) {
    // Stress index is already 0-100 "more stress"; recovery reads the inverse.
    components.hrv = Math.max(0, Math.min(100, Math.round(100 - todayStress.avgLevel)));
  }

  const spo2Avg = todaySpo2[0]?.avg;
  if (spo2Avg != null) {
    // SpO2 below ~90% is clinically concerning; 95-100% is the normal healthy band.
    components.spo2 = Math.max(0, Math.min(100, Math.round((spo2Avg - 90) * 20)));
  }

  if (todayVitals?.avgSkinTemperatureCelsius != null) {
    // Deviation from a neutral baseline in either direction reads as lower recovery.
    const deviation = Math.abs(todayVitals.avgSkinTemperatureCelsius);
    components.skinTemperature = Math.max(0, Math.min(100, Math.round(100 - deviation * 20)));
  }

  if (todaySleep?.totalSleepMinutes != null) {
    // Reuse the same "8h ideal, linear penalty" heuristic sleepAnalyticsService uses.
    const hours = todaySleep.totalSleepMinutes / 60;
    components.sleepContribution = Math.max(0, Math.min(100, Math.round(100 - Math.abs(hours - 8) * 15)));
  }

  if (priorDayActivity) {
    // Heavier activity load yesterday reads as lower recovery today (strain).
    const activeMinutes = priorDayActivity.activeMinutes || 0;
    components.strainContribution = Math.max(0, Math.min(100, Math.round(100 - activeMinutes)));
  }

  const availableKeys = Object.keys(components);
  if (availableKeys.length === 0) {
    await RecoveryDailySummary.deleteOne({ user: userId, date: dateStr });
    return { user: userId, date: dateStr, recoveryScore: null, components: {} };
  }

  const recoveryScore = Math.round(
    availableKeys.reduce((sum, k) => sum + components[k], 0) / availableKeys.length
  );

  const saved = await RecoveryDailySummary.findOneAndUpdate(
    { user: userId, date: dateStr },
    { recoveryScore, components, deviceType: deviceDoc?.deviceType },
    { upsert: true, new: true }
  );

  return { user: userId, date: dateStr, recoveryScore: saved.recoveryScore, components: saved.components };
}

module.exports = { calculateRecoveryScore };
