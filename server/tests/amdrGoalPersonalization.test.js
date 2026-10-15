/**
 * The protein AMDR window used to be a fixed 10-35% of calories for every
 * user, regardless of bodyweight or goal. This personalizes it using
 * published g/kg-bodyweight protein guidance (ISSN for muscle_gain, Helms
 * et al. 2014 for weight_loss lean-mass preservation) — carbs/fat stay on
 * the fixed DRI range, since no similarly specific published multiplier
 * exists for those by goal.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { getAmdrRanges } = require('../utils/nutrientTargets');

test('no goalType/weightKg: falls back to the fixed DRI range, unchanged from before this existed', () => {
  const ranges = getAmdrRanges({});
  assert.deepEqual(ranges.protein, [10, 35]);
  assert.deepEqual(ranges.carbs, [45, 65]);
  assert.deepEqual(ranges.fat, [20, 35]);
});

test('goalType with no weightKg/calorieGoal: still falls back, never guesses', () => {
  assert.deepEqual(getAmdrRanges({ goalType: 'muscle_gain' }).protein, [10, 35]);
  assert.deepEqual(getAmdrRanges({ goalType: 'muscle_gain', weightKg: 70 }).protein, [10, 35]);
});

test('a goalType with no published multiplier (maintain) keeps the fixed range even with weight/calories present', () => {
  assert.deepEqual(getAmdrRanges({ goalType: 'maintain', weightKg: 70, calorieGoal: 2200 }).protein, [10, 35]);
});

test('the chat walkthrough case: weight_loss, 65kg, 1600 kcal — 156g protein (39%) now falls inside the window', () => {
  const ranges = getAmdrRanges({ goalType: 'weight_loss', weightKg: 65, calorieGoal: 1600 });
  // 1.6-2.4 g/kg * 65kg * 4 kcal/g / 1600 kcal * 100
  const expectedMin = Math.round((1.6 * 65 * 4 / 1600) * 100); // 26%
  const expectedMax = Math.round((2.4 * 65 * 4 / 1600) * 100); // 39%
  assert.deepEqual(ranges.protein, [expectedMin, expectedMax]);
  assert.ok(39 >= ranges.protein[0] && 39 <= ranges.protein[1], 'the 39% example from the walkthrough should now be inside the personalized window');
  // carbs/fat are untouched by goal — no published per-goal multiplier was used for them
  assert.deepEqual(ranges.carbs, [45, 65]);
  assert.deepEqual(ranges.fat, [20, 35]);
});

test('muscle_gain, 70kg, 2800 kcal: window sits around 16-22%, both bounds inside the old fixed 10-35%', () => {
  const ranges = getAmdrRanges({ goalType: 'muscle_gain', weightKg: 70, calorieGoal: 2800 });
  assert.ok(ranges.protein[0] >= 10 && ranges.protein[1] <= 35, 'ISSN high-protein guidance already fits inside the generic range at this bodyweight/calorie level');
  assert.ok(ranges.protein[0] < ranges.protein[1]);
});

test('different bodyweights on the same goal get different windows, not one fixed bucket', () => {
  const light = getAmdrRanges({ goalType: 'muscle_gain', weightKg: 55, calorieGoal: 2000 });
  const heavy = getAmdrRanges({ goalType: 'muscle_gain', weightKg: 95, calorieGoal: 2000 });
  assert.notDeepEqual(light.protein, heavy.protein);
});

test('extreme inputs (very low calorie goal) stay clamped to the sanity bounds, never above 45% or below 10%', () => {
  const ranges = getAmdrRanges({ goalType: 'weight_loss', weightKg: 100, calorieGoal: 800 });
  assert.ok(ranges.protein[0] >= 10 && ranges.protein[0] <= 45);
  assert.ok(ranges.protein[1] >= 10 && ranges.protein[1] <= 45);
  assert.ok(ranges.protein[1] > ranges.protein[0], 'min/max must never collapse to the same value (would zero out amdrNar\'s range width)');
});
