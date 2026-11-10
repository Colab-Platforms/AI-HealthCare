const test = require('node:test');
const assert = require('node:assert');
const { buildNutritionInsight, buildNotLoggedInsight } = require('../services/nutritionInsightService');
const { calculateDietQualityScore } = require('../services/dietQualityScoreService');

test('an empty day would score 40 from the formula alone (why it is short-circuited)', () => {
  const empty = calculateDietQualityScore({ totalCalories: 0 }, { age: 33, gender: 'male', calorieGoal: 2000 });
  assert.strictEqual(empty.score, 40);
});

test('the not-logged insight has the same shape as a real one', () => {
  const real = buildNutritionInsight(calculateDietQualityScore(
    { totalCalories: 1800, totalProtein: 80, totalCarbs: 220, totalFats: 60, totalFiber: 25 },
    { age: 33, gender: 'male', calorieGoal: 2000 },
  ));
  const notLogged = buildNotLoggedInsight();
  assert.deepStrictEqual(Object.keys(notLogged).sort(), Object.keys(real).sort());
  assert.strictEqual(notLogged.band, 'not_logged');
  assert.ok(!/\d/.test(notLogged.overallSummary), 'no score number in the not-logged copy');
});
