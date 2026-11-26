/**
 * Amish's days — Daily Score before (v1) vs after (v2) the scoring change.
 *
 * Amish: male, 30, WHOOP (so recovery applies), calorie goal 2200, no
 * declared lifestyle flags. Step goal 7,500 and sleep target 8–9h come from
 * the real age-based guidance code.
 *
 * | # | Scenario                                         | v1 (before) | v2 (after) |
 * |---|--------------------------------------------------|-------------|------------|
 * | 1 | 7 AM: only WHOOP sync (8h sleep, recovery 78)    | 90.2        | 44.5       |
 * | 2 | Noon: + 2 meals, 3 glasses water, 4,000 steps    | 69.0        | 65.0       |
 * | 3 | Night: perfect day (incl. 60 min strength/week)  | 92.7        | 91.9       |
 * | 4 | Lazy day: only 3 glasses of water logged         | 33.7        | 1.4        |
 * | 5 | Only 2 drinks logged, nothing else               | 85.0        | 0          |
 * | 6 | Party: perfect day + 6 drinks + 3 cigarettes     | 73.4        | 55.4       |
 * | 7 | Bad day: 5h sleep, junk meal, 2,000 steps        | 28.3        | 25.9       |
 *
 * Activity = cardio + strength, equal halves, and a day with cardio but no
 * strength in the last 7 days counts strength as 0 (activityScoreFormula.js).
 * So scenarios 2 and 7 (steps, no strength) get half the activity they would
 * if strength were skipped; the perfect day logs its 60 weekly minutes.
 *
 * v1 figures were produced by running the pre-change service (git HEAD at the
 * time of the change) through these same mocks; only v2 is asserted here.
 *
 * Diet quality is pinned via a stub so the nutrition numbers are deterministic
 * — that service has its own tests and isn't what's under test here.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

// Must be stubbed BEFORE dailyHealthScoreService is required (it destructures
// the function at load time).
const dietQuality = require('../services/dietQualityScoreService');
let dietScore = 70;
dietQuality.calculateDietQualityScore = () => ({ score: dietScore });

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

const DATE = '2026-10-15';
const ALL_MEALS = { breakfast: true, lunch: true, dinner: true };

const CONFIG_V2 = {
  version: 2,
  sleepTargetBounds: { min: 7, max: 9 },
  personalBaselineTau: { sleep: 10 },
  dailyWeights: { sleep: 0.25, nutrition: 0.25, activity: 0.25, recovery: 0.25 },
  nutritionWeights: { logging: 0.25, quality: 0.41, calories: 0.17, hydration: 0.17 },
  recoveryApplicableWindowDays: 14,
  fluidRestrictedConditions: [],
  mobilityLimitedConditions: [],
};

const leanResolves = (value) => ({ lean: async () => value, select: () => leanResolves(value) });
const selectLeanResolves = (value) => ({ select: () => leanResolves(value) });

function amishDay(t, o) {
  dietScore = o.diet ?? 70;
  t.mock.method(DailyActivityMetric, 'find', () =>
    selectLeanResolves(o.steps ? [{ deviceType: 'whoop', steps: o.steps, activeMinutes: 0 }] : []));
  t.mock.method(NutritionSummary, 'findOne', () => leanResolves(o.food || o.water ? {
    totalFoodsCount: o.food?.meals || 0,
    mealsLogged: o.food?.mealsLogged || {},
    totalCalories: o.food?.kcal || 0,
    waterIntake: o.water || 0,
  } : null));
  t.mock.method(SleepSession, 'find', () =>
    selectLeanResolves(o.sleepHours ? [{ deviceType: 'whoop', totalSleepMinutes: o.sleepHours * 60 }] : []));
  t.mock.method(User, 'findById', () => selectLeanResolves({
    profile: { age: 30, gender: 'male', lifestyle: {} },
    smokeLog: o.cigarettes ? { [DATE]: { count: o.cigarettes } } : {},
    alcoholLog: o.drinks ? { [DATE]: { count: o.drinks, units: o.drinks } } : {},
  }));
  // The 7-day strength query filters on category; today's exercise query doesn't.
  t.mock.method(ExerciseLog, 'find', (filter) => selectLeanResolves(
    filter?.category === 'strength' && o.strengthMinutes7d ? [{ duration: o.strengthMinutes7d }] : []));
  t.mock.method(ExerciseLog, 'countDocuments', async () => 0);
  // Calorie goal lives on HealthGoal only (User.nutritionGoal removed 26 Nov).
  t.mock.method(HealthGoal, 'findOne', () => selectLeanResolves({ dailyCalorieTarget: 2200 }));
  // Amish wears WHOOP → the trailing-window "is recovery applicable" query
  // always finds a row; today's physiology score is per scenario.
  t.mock.method(RecoveryDailySummary, 'findOne', (filter) => (typeof filter.date === 'object'
    ? selectLeanResolves({ _id: 'r' })
    : selectLeanResolves(o.recovery != null ? { metricDetails: { physiology: { score: o.recovery } } } : null)));
  t.mock.method(UserMetricBaseline, 'findOne', async () => null);
  t.mock.method(UserMetricBaseline.prototype, 'save', async function save() { return this; });
  t.mock.method(DailyHealthScore, 'findOneAndUpdate', async (_f, update) => ({ toObject: () => ({ ...update }) }));
  t.mock.method(DailyHealthScore, 'deleteOne', async () => {});
  return calculateDailyScore('u1', DATE, { config: CONFIG_V2 });
}

const near = (actual, expected, msg) =>
  assert.ok(Math.abs(actual - expected) < 0.15, `${msg}: expected ≈${expected}, got ${actual}`);

const WHOOP_MORNING = { sleepHours: 8, recovery: 78 };
const PERFECT_DAY = {
  ...WHOOP_MORNING,
  food: { meals: 3, mealsLogged: ALL_MEALS, kcal: 2150 },
  diet: 75,
  water: 8,
  steps: 9000,
  strengthMinutes7d: 60,
};

test('1. 7 AM, only WHOOP sync: 44.5 (was 90.2 — missing pillars no longer re-weighted onto sleep)', async (t) => {
  const r = await amishDay(t, WHOOP_MORNING);
  near(r.finalScore, 44.5, 'score');
  assert.deepEqual(r.missingComponents.sort(), ['activity', 'nutrition']);
});

test('2. Noon, partial day: 65.0 (was 69.0) — score climbs as he logs', async (t) => {
  const r = await amishDay(t, {
    ...WHOOP_MORNING,
    food: { meals: 2, mealsLogged: { breakfast: true, lunch: true }, kcal: 1300 },
    water: 3,
    steps: 4000,
  });
  near(r.finalScore, 65.0, 'score');
  assert.deepEqual(r.missingComponents, []);
});

test('3. Perfect day: 91.9 (was 92.7) — a fully-logged day scores about the same as before', async (t) => {
  const r = await amishDay(t, PERFECT_DAY);
  near(r.finalScore, 91.9, 'score');
  near(r.components.nutrition, 89.6, 'nutrition incl. water');
});

test('4. Lazy day, only water: 1.4 (was 33.7)', async (t) => {
  const r = await amishDay(t, { water: 3 });
  near(r.finalScore, 1.4, 'score');
});

test('5. Only drinks logged: 0 (was 85 — logging alcohol alone used to produce a high score)', async (t) => {
  const r = await amishDay(t, { drinks: 2 });
  assert.equal(r.finalScore, 0);
  assert.equal(r.penalties.alcohol, 5);
});

test('6. Party night: 55.4 (was 73.4) — penalties hit harder than a 9%/22% weighted slot did', async (t) => {
  const r = await amishDay(t, { ...PERFECT_DAY, drinks: 6, cigarettes: 3 });
  near(r.baseScore, 91.9, 'base');
  near(r.penalties.smoking, 15.5, 'smoking penalty');
  near(r.penalties.alcohol, 21, 'alcohol penalty');
  near(r.finalScore, 55.4, 'score');
});

test('7. Bad day: 25.9 (was 28.3) — a fully-logged bad day stays bad', async (t) => {
  const r = await amishDay(t, {
    sleepHours: 5,
    recovery: 40,
    food: { meals: 1, mealsLogged: { lunch: true }, kcal: 900 },
    diet: 30,
    steps: 2000,
  });
  near(r.finalScore, 25.9, 'score');
});
