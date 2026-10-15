/**
 * DailyActivityMetric stores one row per user+deviceType+day. A user with
 * two connected devices (e.g. Google Health + manual entry) syncing the same
 * day gets two rows for that date. calculateDailyScore used to sum steps/
 * activeMinutes across those rows, double-counting the same physical steps.
 * Fixed to take the max across devices instead. This mocks every model the
 * function touches (no real DB) so the merge logic itself is verified.
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

test('two connected devices reporting steps for the same day: max, not sum', async (t) => {
  const deviceRows = [
    { steps: 6000, activeMinutes: 30 }, // device A
    { steps: 6200, activeMinutes: 25 }, // device B — same day, slightly different reading
  ];

  t.mock.method(DailyActivityMetric, 'find', () => selectLeanResolves(deviceRows));
  t.mock.method(NutritionSummary, 'findOne', () => leanResolves(null));
  t.mock.method(SleepSession, 'findOne', () => leanResolves(null));
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

  assert.equal(result.raw.activity.steps.actual, 6200, 'steps must be the max across devices, not the 12200 sum');
});
