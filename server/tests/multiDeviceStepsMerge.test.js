/**
 * DailyActivityMetric stores one row per user+deviceType+day. A user with
 * two connected devices syncing the same day gets two rows for that date.
 * Since connectDevice/os-sync now block a second REAL device from connecting
 * while one is active, two real-device rows on the same date can only be a
 * clean mid-day switch (non-overlapping windows) — genuinely additive, so
 * they're summed. A manual entry isn't gated by that lock, so it's maxed
 * against the device total instead (see utils/wearableMerge.js). This mocks
 * every model calculateDailyScore touches (no real DB) so the merge logic
 * itself is verified end-to-end through the service.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');

const DailyActivityMetric = require('../models/DailyActivityMetric');
const NutritionSummary = require('../models/NutritionSummary');
const SleepSession = require('../models/SleepSession');
const User = require('../models/User');
const ExerciseLog = require('../models/ExerciseLog');
const HealthGoal = require('../models/HealthGoal');
const RecoveryDailySummary = require('../models/RecoveryDailySummary');
const DailyHealthScore = require('../models/DailyHealthScore');

const { calculateDailyScore } = require('../services/dailyHealthScoreService');

function leanResolves(value) {
  return { lean: async () => value, select: () => leanResolves(value) };
}

function selectLeanResolves(value) {
  return { select: () => leanResolves(value) };
}

test('two real devices reporting steps for the same day (mid-day switch): summed', async (t) => {
  const deviceRows = [
    { deviceType: 'whoop', steps: 6000, activeMinutes: 30 },
    { deviceType: 'garmin', steps: 6200, activeMinutes: 25 }, // mid-day switch, same date
  ];

  t.mock.method(DailyActivityMetric, 'find', () => selectLeanResolves(deviceRows));
  t.mock.method(NutritionSummary, 'findOne', () => leanResolves(null));
  t.mock.method(SleepSession, 'find', () => selectLeanResolves([]));
  t.mock.method(User, 'findById', () => selectLeanResolves({ profile: {} }));
  t.mock.method(ExerciseLog, 'find', () => selectLeanResolves([]));
  t.mock.method(ExerciseLog, 'countDocuments', async () => 0);
  t.mock.method(HealthGoal, 'findOne', () => selectLeanResolves(null));
  t.mock.method(RecoveryDailySummary, 'findOne', () => selectLeanResolves(null));
  t.mock.method(DailyHealthScore, 'findOneAndUpdate', async (_f, update) => ({
    toObject: () => ({ userId: 'u1', date: '2026-10-15', ...update }),
  }));
  t.mock.method(DailyHealthScore, 'deleteOne', async () => {});

  const config = {
    version: 1,
    sleepTargetBounds: { min: 7, max: 9 },
    nutritionWeights: { logging: 0.6, quality: 0.4, calories: 0 },
    personalBaselineTau: { sleep: 10 },
    dailyWeights: { activity: 1 },
  };

  const result = await calculateDailyScore('u1', '2026-10-15', { config });

  assert.equal(result.raw.activity.steps.actual, 12200, 'two real devices on the same date (clean switch) are summed, not maxed');
});

test('a real device plus a manual entry on the same day: max, never added together', async (t) => {
  const deviceRows = [
    { deviceType: 'whoop', steps: 7000, activeMinutes: 30 },
    { deviceType: 'manual', steps: 2000, activeMinutes: 10 }, // could duplicate what whoop already counted
  ];

  t.mock.method(DailyActivityMetric, 'find', () => selectLeanResolves(deviceRows));
  t.mock.method(NutritionSummary, 'findOne', () => leanResolves(null));
  t.mock.method(SleepSession, 'find', () => selectLeanResolves([]));
  t.mock.method(User, 'findById', () => selectLeanResolves({ profile: {} }));
  t.mock.method(ExerciseLog, 'find', () => selectLeanResolves([]));
  t.mock.method(ExerciseLog, 'countDocuments', async () => 0);
  t.mock.method(HealthGoal, 'findOne', () => selectLeanResolves(null));
  t.mock.method(RecoveryDailySummary, 'findOne', () => selectLeanResolves(null));
  t.mock.method(DailyHealthScore, 'findOneAndUpdate', async (_f, update) => ({
    toObject: () => ({ userId: 'u1', date: '2026-10-15', ...update }),
  }));
  t.mock.method(DailyHealthScore, 'deleteOne', async () => {});

  const config = {
    version: 1,
    sleepTargetBounds: { min: 7, max: 9 },
    nutritionWeights: { logging: 0.6, quality: 0.4, calories: 0 },
    personalBaselineTau: { sleep: 10 },
    dailyWeights: { activity: 1 },
  };

  const result = await calculateDailyScore('u1', '2026-10-15', { config });

  assert.equal(result.raw.activity.steps.actual, 7000, 'manual is maxed against the device, never summed on top of it');
});
