/**
 * Daily Score v2: 4 equal pillars (sleep, nutrition incl. water, activity,
 * recovery), applicable-but-missing = 0, not-applicable removed, smoking and
 * alcohol as subtracted penalties. All models mocked — no DB.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const DailyActivityMetric = require('../models/DailyActivityMetric');
const NutritionSummary = require('../models/NutritionSummary');
const SleepSession = require('../models/SleepSession');
const User = require('../models/User');
const ExerciseLog = require('../models/ExerciseLog');
const HealthGoal = require('../models/HealthGoal');
const RecoveryDailySummary = require('../models/RecoveryDailySummary');
const DailyHealthScore = require('../models/DailyHealthScore');
const UserMetricBaseline = require('../models/UserMetricBaseline');

const { calculateDailyScore } = require('../services/dailyHealthScoreService');
const { smokingPenalty, alcoholPenalty } = require('../services/healthScoreFormulas');

const DATE = '2026-10-15';

const leanResolves = (value) => ({ lean: async () => value, select: () => leanResolves(value) });
const selectLeanResolves = (value) => ({ select: () => leanResolves(value) });

const CONFIG = {
  version: 2,
  sleepTargetBounds: { min: 7, max: 9 },
  personalBaselineTau: { sleep: 10 },
  dailyWeights: { sleep: 0.25, nutrition: 0.25, activity: 0.25, recovery: 0.25 },
  nutritionWeights: { logging: 0.25, quality: 0.41, calories: 0.17, hydration: 0.17 },
  recoveryApplicableWindowDays: 14,
  fluidRestrictedConditions: ['kidney disease'],
  mobilityLimitedConditions: [],
};

/**
 * @param {object} o
 * @param {number} [o.sleepMinutes]
 * @param {number} [o.steps]
 * @param {object} [o.nutrition]       NutritionSummary doc
 * @param {number} [o.physiology]      today's recovery physiology score
 * @param {boolean} [o.hasRecentRecovery] device produced HRV in the window
 * @param {object} [o.user]
 */
function mockDay(t, o = {}) {
  let saved = null;
  t.mock.method(DailyActivityMetric, 'find', () => selectLeanResolves(o.steps ? [{ deviceType: 'whoop', steps: o.steps, activeMinutes: 0 }] : []));
  t.mock.method(NutritionSummary, 'findOne', () => leanResolves(o.nutrition || null));
  t.mock.method(SleepSession, 'find', () => selectLeanResolves(o.sleepMinutes ? [{ deviceType: 'whoop', totalSleepMinutes: o.sleepMinutes }] : []));
  t.mock.method(User, 'findById', () => selectLeanResolves(o.user || { profile: { age: 30, gender: 'male' } }));
  t.mock.method(ExerciseLog, 'find', () => selectLeanResolves([]));
  t.mock.method(ExerciseLog, 'countDocuments', async () => 0);
  t.mock.method(HealthGoal, 'findOne', () => selectLeanResolves(null));
  t.mock.method(RecoveryDailySummary, 'findOne', (filter) => {
    const isWindowQuery = typeof filter.date === 'object';
    if (isWindowQuery) return selectLeanResolves(o.hasRecentRecovery || o.physiology != null ? { _id: 'r' } : null);
    return selectLeanResolves(o.physiology != null ? { metricDetails: { physiology: { score: o.physiology } } } : null);
  });
  t.mock.method(UserMetricBaseline, 'findOne', async () => null);
  t.mock.method(UserMetricBaseline.prototype, 'save', async function save() { return this; });
  t.mock.method(DailyHealthScore, 'findOneAndUpdate', async (_f, update) => {
    saved = update;
    return { toObject: () => ({ userId: 'u1', date: DATE, ...update }) };
  });
  t.mock.method(DailyHealthScore, 'deleteOne', async () => {});
  return () => saved;
}

test('only sleep logged (WHOOP user): other pillars count 0, NOT re-weighted onto sleep', async (t) => {
  // 8h sleep → sleep component 100; nutrition, activity, recovery missing.
  mockDay(t, { sleepMinutes: 8 * 60, hasRecentRecovery: true });
  const r = await calculateDailyScore('u1', DATE, { config: CONFIG });

  assert.equal(r.components.sleep, 100);
  assert.equal(r.finalScore, 25, 'one of four pillars at 100 = 25, not 100');
  assert.deepEqual(r.missingComponents.sort(), ['activity', 'nutrition', 'recovery']);
  assert.deepEqual(r.notApplicableComponents, []);
});

test('phone-only user (no HRV ever): recovery is N/A, the 3 remaining pillars share 100', async (t) => {
  mockDay(t, { sleepMinutes: 8 * 60, hasRecentRecovery: false });
  const r = await calculateDailyScore('u1', DATE, { config: CONFIG });

  assert.deepEqual(r.notApplicableComponents, ['recovery']);
  assert.ok(Math.abs(r.finalScore - 33.3) < 0.1, `expected ~33.3, got ${r.finalScore}`);
});

test('water-only day: nutrition is computed from hydration alone, food parts count 0', async (t) => {
  mockDay(t, { nutrition: { waterIntake: 8, totalFoodsCount: 0 }, hasRecentRecovery: false });
  const r = await calculateDailyScore('u1', DATE, { config: CONFIG });

  // No calorie goal → calories N/A. logging 0, quality 0, hydration 100.
  // nutrition = 100 * 0.17 / (0.25 + 0.41 + 0.17) ≈ 20.5
  assert.ok(Math.abs(r.components.nutrition - 20.5) < 0.1, `got ${r.components.nutrition}`);
  assert.equal(r.components.hydration, 100, 'still exposed for display');
});

test('fluid-restricted user: hydration removed from nutrition, not scored as 0', async (t) => {
  mockDay(t, {
    nutrition: { waterIntake: 2, totalFoodsCount: 3, mealsLogged: { breakfast: true, lunch: true, dinner: true }, averageHealthScore: 80 },
    user: { profile: { chronicConditions: ['Kidney Disease'] } }, // no age/gender → diet score falls back to averageHealthScore
  });
  const r = await calculateDailyScore('u1', DATE, { config: CONFIG });

  assert.equal(r.components.hydration, undefined);
  // 3/3 meals logged; hydration and calories both N/A → only logging + quality,
  // renormalised over 0.66. (Water logged but ignored — not counted as 0.)
  const q = r.raw.dietQuality / 100;
  const expected = 100 * (0.25 * 1 + 0.41 * q) / 0.66;
  assert.ok(Math.abs(r.components.nutrition - expected) < 0.2, `expected ${expected}, got ${r.components.nutrition}`);
});

test('penalties are subtracted from the base score, floored at 0', async (t) => {
  mockDay(t, {
    sleepMinutes: 8 * 60,
    physiology: 100,
    user: {
      profile: { age: 30, gender: 'male' },
      smokeLog: { [DATE]: { count: 20 } },
      alcoholLog: { [DATE]: { count: 2, units: 2 } },
    },
  });
  const r = await calculateDailyScore('u1', DATE, { config: CONFIG });

  assert.equal(r.baseScore, 50); // sleep 100 + recovery 100, of 4 pillars
  assert.equal(r.penalties.smoking, 25);
  assert.equal(r.penalties.alcohol, 5);
  assert.equal(r.finalScore, 20);
});

test('smokingPenalty: first cigarette carries ~40% of the max (Hackshaw BMJ 2018)', () => {
  assert.equal(smokingPenalty(0), 0);
  assert.equal(smokingPenalty(1), 10);
  assert.equal(smokingPenalty(20), 25);
  assert.equal(smokingPenalty(40), 25);
  assert.ok(smokingPenalty(5) > 10 && smokingPenalty(5) < smokingPenalty(10));
});

test('alcoholPenalty: guideline limit, NIAAA binge and high-intensity anchors', () => {
  assert.equal(alcoholPenalty(0, 'male'), 0);
  assert.equal(alcoholPenalty(2, 'male'), 5); // US DGA limit (men)
  assert.equal(alcoholPenalty(1, 'female'), 5); // US DGA limit (women)
  assert.equal(alcoholPenalty(5, 'male'), 20); // NIAAA binge (men)
  assert.equal(alcoholPenalty(4, 'female'), 20); // NIAAA binge (women)
  assert.equal(alcoholPenalty(10, 'male'), 25); // high-intensity (men)
  assert.equal(alcoholPenalty(8, 'female'), 25); // high-intensity (women)
});
