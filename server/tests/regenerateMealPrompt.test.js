/**
 * Flow test for the single-meal regeneration path.
 *
 * Runs the real `regenerateSingleMeal` with the model call stubbed, so the
 * prompt that would go to Claude is asserted directly — no API cost, no network,
 * and the assertions are about the thing that actually drives the output.
 *
 * This path had drifted from whole-plan generation: it dropped `city`, it never
 * read `foodsToAvoid`, and it carried its own copy of the "Focus on diverse
 * Indian cuisine" fallback. All three meant that pressing "regenerate" on a
 * badly-located meal could hand back something just as bad.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const dietRecommendationAI = require('../services/dietRecommendationAI');

/**
 * Capture the prompt instead of calling the model.
 * Returns { prompt, result } and always restores the original method.
 */
async function capturePrompt(args) {
  const original = dietRecommendationAI.makeAIRequest;
  let captured = null;

  dietRecommendationAI.makeAIRequest = async (payload) => {
    captured = payload.messages[0].content;
    return JSON.stringify({
      name: 'Dal Baati Churma',
      description: 'Rajasthani staple',
      portionSize: '1 plate (250g)',
      calories: args.remainingCalories,
      protein: 18,
      carbs: 60,
      fats: 20,
      benefits: 'High fibre',
    });
  };

  try {
    const result = await dietRecommendationAI.regenerateSingleMeal(args);
    return { prompt: captured, result };
  } finally {
    dietRecommendationAI.makeAIRequest = original;
  }
}

function baseArgs({ userData: userDataOverrides, ...rest } = {}) {
  return {
    mealType: 'breakfast',
    remainingCalories: 420,
    avoidNames: [],
    ...rest,
    // Merged separately: spreading `rest` over a `userData` key would replace
    // the whole object and silently drop the defaults each test relies on.
    userData: {
      dietaryPreference: 'vegetarian',
      allergies: ['peanuts'],
      medicalConditions: [],
      country: 'India',
      region: 'north',
      state: 'Rajasthan',
      city: 'Jaipur',
      foodPreferences: { foodsToAvoid: [], mealPreferences: { breakfast: ['poha'] } },
      ...userDataOverrides,
    },
  };
}

test('the regenerated meal carries the full location block', async () => {
  const { prompt } = await capturePrompt(baseArgs());

  assert.ok(prompt.includes('STATE FOCUS'), 'state missing from regenerate prompt');
  assert.ok(prompt.includes('Rajasthan'));
  // city used to be dropped on this path even though whole-plan generation sent
  // it — regenerating silently lost the most specific signal we have.
  assert.ok(prompt.includes('CITY FOCUS'), 'city missing from regenerate prompt');
  assert.ok(prompt.includes('Jaipur'));
});

test('never asks for diverse cuisine from all regions', async () => {
  for (const userData of [
    { state: '', city: '', region: 'other' },
    { state: 'Rajasthan', city: '', region: 'other' },
    { state: '', city: '', region: 'north' },
  ]) {
    const { prompt } = await capturePrompt(baseArgs({ userData }));
    assert.ok(
      !prompt.includes('diverse Indian cuisine'),
      `the all-regions fallback came back for ${JSON.stringify(userData)}`
    );
  }
});

test('permanently rejected dishes are excluded', async () => {
  const { prompt } = await capturePrompt(
    baseArgs({
      userData: {
        foodPreferences: {
          foodsToAvoid: ['Pesarattu', 'Ker Sangri'],
          mealPreferences: { breakfast: [] },
        },
      },
    })
  );

  assert.ok(prompt.includes('NEVER suggest these'));
  assert.ok(prompt.includes('Pesarattu'));
  assert.ok(prompt.includes('Ker Sangri'));
});

test('the dish being replaced is in the avoid list', async () => {
  // The caller now includes the rejected slot in avoidNames; handing back the
  // same dish is the one outcome that definitely fails the user's request.
  const { prompt } = await capturePrompt(
    baseArgs({ avoidNames: ['Pesarattu', 'Upma'] })
  );

  assert.ok(prompt.includes('Do NOT suggest any of these'));
  assert.ok(prompt.includes('Pesarattu'));
});

test('allergies and dietary type still reach the prompt', async () => {
  const { prompt } = await capturePrompt(baseArgs());

  assert.ok(prompt.includes('peanuts'));
  assert.ok(prompt.includes('STRICT VEGETARIAN'));
});

test('the calorie budget is stated and honoured in the parsed result', async () => {
  const { prompt, result } = await capturePrompt(baseArgs({ remainingCalories: 537 }));

  assert.ok(prompt.includes('537 kcal'));
  assert.equal(result.calories, 537);
  assert.equal(result.name, 'Dal Baati Churma');
});

test('a user with no location still gets a usable prompt', async () => {
  const { prompt } = await capturePrompt(
    baseArgs({ userData: { state: '', city: '', region: 'other' } })
  );

  assert.ok(prompt.includes('not specified'));
  assert.ok(prompt.includes('STRICT VEGETARIAN'), 'must still carry the signals we do have');
});

test('missing foodPreferences does not throw', async () => {
  await assert.doesNotReject(() =>
    capturePrompt(baseArgs({ userData: { foodPreferences: undefined } }))
  );
});

test('the prompt asks for every field the meal schema stores', async () => {
  // The replacement is written with $set on the whole array element, so a field
  // the prompt does not ask for is deleted from that slot rather than left
  // alone. This asked for 8 of 21 fields, which silently stripped fiber,
  // sodium and all 8 micronutrients from any regenerated meal.
  //
  // Read off the schema rather than hardcoded, so adding a field to the model
  // without adding it here fails instead of quietly losing data.
  const { mealOptionFields } = require('../models/PersonalizedDietPlan');
  const { prompt } = await capturePrompt(baseArgs());

  const missing = mealOptionFields.filter((f) => !prompt.includes(`"${f}"`));

  assert.deepEqual(
    missing,
    [],
    `regenerate prompt never asks for: ${missing.join(', ')} — these get wiped on regenerate`
  );
});
