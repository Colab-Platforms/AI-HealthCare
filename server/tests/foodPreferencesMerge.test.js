/**
 * Tests for the food-preferences merge.
 *
 * The first test is the one that matters: saving food preferences used to wipe
 * the user's `state`, because the handler rebuilt the preferences object from a
 * literal that never mentioned it. A user set their state, later added a liked
 * food, and silently lost their location — so their diet plan went back to
 * generic and nothing in the UI explained why.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { buildFoodPreferencesUpdate } = require('../controllers/userController');

function storedPrefs(overrides = {}) {
  return {
    region: 'south',
    country: 'India',
    state: 'Kerala',
    city: 'Kochi',
    preferredFoods: ['idli'],
    foodsToAvoid: [],
    dietaryRestrictions: [],
    dietaryDo: [],
    dietaryDont: [],
    mealPreferences: { breakfast: [], lunch: [], snacks: [], dinner: [] },
    ...overrides,
  };
}

test('saving unrelated fields does not wipe the stored state', () => {
  // The exact regression: the body carries only a liked food.
  const next = buildFoodPreferencesUpdate(storedPrefs(), { preferredFoods: ['dosa'] });

  assert.equal(next.state, 'Kerala');
  assert.equal(next.city, 'Kochi');
  assert.equal(next.country, 'India');
  assert.deepEqual(next.preferredFoods, ['dosa']);
});

test('unknown stored fields survive the merge', () => {
  // Anything added to the schema later must not be silently dropped.
  const next = buildFoodPreferencesUpdate(storedPrefs({ someNewField: 'keep me' }), {
    preferredFoods: ['dosa'],
  });

  assert.equal(next.someNewField, 'keep me');
});

test('a new state is stored and the region derived from it', () => {
  const next = buildFoodPreferencesUpdate(storedPrefs(), { state: 'Rajasthan' });

  assert.equal(next.state, 'Rajasthan');
  assert.equal(next.region, 'north');
});

test('state is canonicalised before storing', () => {
  // Otherwise "tamil nadu" and "Tamil Nadu" become distinct stored values and
  // the prompt text varies between users in the same place.
  const next = buildFoodPreferencesUpdate(storedPrefs(), { state: '  tamil nadu ' });

  assert.equal(next.state, 'Tamil Nadu');
  assert.equal(next.region, 'south');
});

test('region sent by the client is ignored', () => {
  // region is derived; trusting the body is what let the two disagree.
  const next = buildFoodPreferencesUpdate(storedPrefs(), {
    state: 'Rajasthan',
    region: 'south',
  });

  assert.equal(next.region, 'north');
});

test('a legacy region with no state is preserved, not reset to other', () => {
  // These users set the old Region dropdown before `state` existed. Deriving
  // unconditionally would throw away the only location signal they gave us.
  const next = buildFoodPreferencesUpdate(storedPrefs({ state: null, region: 'south' }), {
    preferredFoods: ['dosa'],
  });

  assert.equal(next.region, 'south');
  assert.equal(next.state, null);
});

test('an unmapped state is stored verbatim with region other', () => {
  // Free-form on purpose so users outside India can use it; the raw string is
  // still what reaches the prompt.
  const next = buildFoodPreferencesUpdate(storedPrefs(), {
    country: 'USA',
    state: 'California',
  });

  assert.equal(next.state, 'California');
  assert.equal(next.region, 'other');
  assert.equal(next.country, 'USA');
});

test('clearing the state explicitly is allowed', () => {
  const next = buildFoodPreferencesUpdate(storedPrefs(), { state: '' });

  assert.equal(next.state, null);
  // No state left to derive from, and no legacy region to fall back to beyond
  // what was stored.
  assert.equal(next.region, 'south');
});

test('city and country are only changed when the body mentions them', () => {
  const next = buildFoodPreferencesUpdate(storedPrefs(), {});

  assert.equal(next.city, 'Kochi');
  assert.equal(next.country, 'India');
});

test('an empty stored object does not throw and yields safe defaults', () => {
  for (const empty of [undefined, null, {}]) {
    const next = buildFoodPreferencesUpdate(empty, { preferredFoods: ['x'] });

    assert.equal(next.state, null);
    assert.equal(next.region, 'other');
    assert.deepEqual(next.preferredFoods, ['x']);
    assert.deepEqual(next.mealPreferences, {
      breakfast: [], lunch: [], snacks: [], dinner: [],
    });
  }
});

test('lastUpdated is refreshed on every save', () => {
  const before = Date.now();
  const next = buildFoodPreferencesUpdate(storedPrefs(), {});

  assert.ok(next.lastUpdated instanceof Date);
  assert.ok(next.lastUpdated.getTime() >= before);
});
