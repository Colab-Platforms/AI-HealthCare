/**
 * Veg/non-veg guarantees: resolver precedence, the output guard, and the
 * retry behaviour of single-meal regeneration. The model call is stubbed, so
 * no API cost and no network.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveDietaryPreference, normalizeDietaryPreference } = require('../utils/dietaryPreference');
const { checkMealForDiet } = require('../utils/dietGuard');
const dietRecommendationAI = require('../services/dietRecommendationAI');

test('resolver: profile wins over a stale plan', () => {
  const r = resolveDietaryPreference(
    { profile: { dietaryPreference: 'vegetarian' } },
    { inputData: { dietaryPreference: 'non-vegetarian' } }
  );
  assert.deepEqual(r, { value: 'vegetarian', source: 'profile' });
});

test('resolver: falls back to plan only when profile is empty', () => {
  const r = resolveDietaryPreference({ profile: {} }, { inputData: { dietaryPreference: 'vegan' } });
  assert.deepEqual(r, { value: 'vegan', source: 'plan' });
});

test('resolver: returns null instead of guessing non-veg', () => {
  assert.deepEqual(resolveDietaryPreference({ profile: {} }, null), { value: null, source: null });
  assert.deepEqual(resolveDietaryPreference({ profile: { dietaryPreference: 'bogus' } }), { value: null, source: null });
});

test('normalize: accepts case, spaces and underscores', () => {
  assert.equal(normalizeDietaryPreference(' Non_Vegetarian '), 'non-vegetarian');
  assert.equal(normalizeDietaryPreference(undefined), null);
});

test('guard: vegetarian rejects meat and egg, allows paneer and eggplant', () => {
  assert.equal(checkMealForDiet('vegetarian', { name: 'Chicken Curry' }).ok, false);
  assert.equal(checkMealForDiet('vegetarian', { name: 'Masala Omelette' }).ok, false);
  assert.equal(checkMealForDiet('vegetarian', { name: 'Paneer Bhurji' }).ok, true);
  assert.equal(checkMealForDiet('vegetarian', { name: 'Eggplant Bharta' }).ok, true);
  assert.equal(checkMealForDiet('vegetarian', { name: 'Dal', ingredients: ['toor dal', 'egg'] }).ok, false);
});

test('guard: vegan also rejects dairy, allows coconut milk and peanut butter', () => {
  assert.equal(checkMealForDiet('vegan', { name: 'Paneer Tikka' }).ok, false);
  assert.equal(checkMealForDiet('vegan', { name: 'Coconut Milk Curry' }).ok, true);
  assert.equal(checkMealForDiet('vegan', { name: 'Peanut Butter Toast' }).ok, true);
});

test('guard: non-vegetarian is never blocked', () => {
  assert.equal(checkMealForDiet('non-vegetarian', { name: 'Chicken Curry' }).ok, true);
});

test('regenerateSingleMeal: a rejected non-veg dish is retried, then the veg dish is returned', async () => {
  const original = dietRecommendationAI.makeAIRequest;
  const prompts = [];
  let call = 0;
  dietRecommendationAI.makeAIRequest = async (payload) => {
    prompts.push(payload.messages[0].content);
    call++;
    const name = call === 1 ? 'Chicken Tikka' : 'Chana Masala';
    return JSON.stringify({ name, calories: 400, protein: 20, carbs: 50, fats: 10 });
  };
  try {
    const meal = await dietRecommendationAI.regenerateSingleMeal({
      mealType: 'lunch',
      remainingCalories: 400,
      userData: { dietaryPreference: 'vegetarian', foodPreferences: {} },
      avoidNames: [],
    });
    assert.equal(meal.name, 'Chana Masala');
    assert.equal(call, 2);
    assert.match(prompts[1], /REJECTED: "Chicken Tikka"/);
  } finally {
    dietRecommendationAI.makeAIRequest = original;
  }
});

test('regenerateSingleMeal: throws when diet type is missing, never calls the model', async () => {
  const original = dietRecommendationAI.makeAIRequest;
  let called = false;
  dietRecommendationAI.makeAIRequest = async () => { called = true; return '{}'; };
  try {
    await assert.rejects(
      dietRecommendationAI.regenerateSingleMeal({
        mealType: 'lunch', remainingCalories: 400, userData: { dietaryPreference: undefined, foodPreferences: {} },
      }),
      /Diet type is required/
    );
    assert.equal(called, false);
  } finally {
    dietRecommendationAI.makeAIRequest = original;
  }
});
