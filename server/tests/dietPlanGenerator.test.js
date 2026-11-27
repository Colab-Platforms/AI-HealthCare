/**
 * Food DB diet plan generator, run against the real seed file (no Mongo, no AI).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const G = require('../services/foodDb/dietPlanGenerator');
const { nutritionFor } = require('../services/foodDb/foodMatcher');

const FOODS = require(path.join(__dirname, '..', 'data', 'foodDb', 'foods.seed.json'));
const BY_ID = new Map(FOODS.map((f) => [f.foodId, f]));
const SLOTS = ['breakfast', 'lunch', 'dinner'];

function user(overrides = {}) {
  return {
    dietaryPreference: 'vegetarian',
    country: 'India',
    state: 'Rajasthan',
    goal: 'weight_loss',
    allergies: [],
    medicalConditions: [],
    foodPreferences: {},
    nutritionGoals: { dailyCalories: 1800, protein: 90, carbs: 200, fats: 60 },
    ...overrides,
  };
}

function plan(overrides, seed = 'test') {
  const r = G.generatePlanFromFoods(FOODS, user(overrides), { seed });
  assert.equal(r.ok, true, `expected a plan, got: ${r.reason}`);
  return r;
}

const allItems = (p) => SLOTS.flatMap((s) => p.mealPlan[s].flatMap((m) => m.items));

for (const diet of ['vegetarian', 'vegan', 'eggetarian', 'non-vegetarian']) {
  test(`${diet}: 7 days x 3 meals, every day on the calorie target`, () => {
    const { plan: p, stats } = plan({ dietaryPreference: diet });
    for (const s of SLOTS) assert.equal(p.mealPlan[s].length, 7, `${s} count`);
    assert.ok(stats.maxDayErrorPct <= 3, `max day error ${stats.maxDayErrorPct.toFixed(1)}%`);
    assert.equal(p.generator, 'food_db');
  });
}

test('every meal is made of real foods, and its numbers are exactly what /foods/resolve gives for those grams', () => {
  const { plan: p } = plan({ dietaryPreference: 'non-vegetarian', state: 'Kerala' });
  for (const s of SLOTS) {
    for (const meal of p.mealPlan[s]) {
      assert.equal(meal.source, 'food_db');
      assert.ok(meal.items.length >= 1);
      const sum = meal.items.reduce((acc, it) => {
        const food = BY_ID.get(it.foodId);
        assert.ok(food, `unknown foodId ${it.foodId}`);
        return acc + nutritionFor(food, it.grams).calories;
      }, 0);
      assert.equal(meal.calories, sum, `${meal.name}: meal kcal vs items`);
      for (const f of ['name', 'portionSize', 'description', 'benefits']) assert.equal(typeof meal[f], 'string');
    }
  }
});

test('diet type is never broken', () => {
  const allowed = {
    vegan: ['vegan'],
    vegetarian: ['vegan', 'vegetarian'],
    eggetarian: ['vegan', 'vegetarian', 'eggetarian'],
  };
  for (const [diet, types] of Object.entries(allowed)) {
    const { plan: p } = plan({ dietaryPreference: diet }, `diet-${diet}`);
    for (const it of allItems(p)) {
      assert.ok(types.includes(BY_ID.get(it.foodId).classification.dietType), `${diet}: ${it.name}`);
    }
  }
});

test('allergies and personal exclusions are respected', () => {
  const { plan: p } = plan({
    dietaryPreference: 'vegetarian',
    allergies: ['peanuts'],
    foodPreferences: { foodsToAvoid: ['paneer'], dietaryDont: ['no mushroom'] },
  });
  for (const it of allItems(p)) {
    const food = BY_ID.get(it.foodId);
    assert.ok(!food.allergens.includes('peanut'), `peanut in ${it.name}`);
    const text = [food.name, ...food.ingredients.map((i) => i.name)].join(' ').toLowerCase();
    assert.ok(!/\bpaneer\b/.test(text), `paneer in ${it.name}`);
    assert.ok(!/\bmushrooms?\b/.test(text), `mushroom in ${it.name}`);
  }
});

test('variety: no dish twice in the same meal type, no dish family more than twice a week', () => {
  const { plan: p } = plan({ dietaryPreference: 'vegetarian' }, 'variety');
  for (const s of SLOTS) {
    const ids = p.mealPlan[s].flatMap((m) => m.items.filter((i) => G.DISH_ROLES.has(i.role)).map((i) => i.foodId));
    assert.equal(new Set(ids).size, ids.length, `${s} repeats a dish`);
  }
  const poha = p.mealPlan.breakfast.filter((m) => /\bpoha\b/i.test(m.name)).length;
  assert.ok(poha <= 2, `${poha} poha breakfasts`);
});

test('same seed, same plan; different seed, different plan', () => {
  const a = plan({}, 'seed-a').plan.mealPlan.lunch.map((m) => m.name);
  const b = plan({}, 'seed-a').plan.mealPlan.lunch.map((m) => m.name);
  const c = plan({}, 'seed-b').plan.mealPlan.lunch.map((m) => m.name);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('what the DB cannot plan for goes to the AI', () => {
  assert.equal(G.generatePlanFromFoods(FOODS, user({ occasion: 'Navratri' })).ok, false);
  assert.equal(G.generatePlanFromFoods(FOODS, user({ country: 'USA' })).ok, false);
  assert.equal(G.generatePlanFromFoods(FOODS, user({ nutritionGoals: {} })).ok, false);
  // Jain: the seed's dals and sabzis are recipes with onion/garlic, so there are too few lunches.
  const jain = G.generatePlanFromFoods(FOODS, user({ dietaryPreference: 'jain' }));
  assert.equal(jain.ok, false);
  assert.match(jain.reason, /not enough/);
});

test('Jain filter: nothing with onion, garlic or root vegetables gets into the pool', () => {
  const ctx = G.buildContext(user({ dietaryPreference: 'jain' }));
  const aloo = FOODS.find((f) => f.name === 'Aloo Paratha');
  const plain = FOODS.find((f) => f.name === 'Plain Paratha');
  assert.ok(G.excludeReason(aloo, ctx));
  assert.equal(G.excludeReason(plain, ctx), null);
});

test('junk records and non-Indian food are never planned', () => {
  const ctx = G.buildContext(user());
  const powder = FOODS.find((f) => /sambar powder/i.test(f.name));
  if (powder) assert.equal(G.excludeReason(powder, ctx), 'not a dish');
  const global = FOODS.find((f) => f.classification.cuisine === 'global' && f.classification.dietType === 'vegetarian');
  assert.equal(G.excludeReason(global, ctx), 'not Indian home food');
});

test('single-meal regeneration: new dishes, same budget', () => {
  const { plan: p } = plan({}, 'regen');
  const used = p.mealPlan.lunch.flatMap((m) => m.items.filter((i) => G.DISH_ROLES.has(i.role)).map((i) => i.foodId));
  const meal = G.generateMealFromFoods(FOODS, user(), { slot: 'lunch', budget: 700, excludeFoodIds: used, seed: 'r1' });
  assert.ok(meal, 'expected a replacement');
  assert.ok(Math.abs(meal.calories - 700) <= 700 * 0.08, `${meal.calories} kcal`);
  for (const it of meal.items.filter((i) => G.DISH_ROLES.has(i.role))) assert.ok(!used.includes(it.foodId), `reused ${it.name}`);
});

test('portion text prefers the default unit and whole amounts', () => {
  const dal = FOODS.find((f) => f.name === 'Toor Dal Tadka');
  assert.equal(G.portionText(dal, 300), '1 bowl');
  assert.equal(G.portionText(dal, 180), '1 small bowl');
  const roti = FOODS.find((f) => f.name === 'Chapati (Roti)');
  assert.equal(G.portionText(roti, 90, 2), '2 pieces');
  assert.equal(G.displayName('Chapati (Roti)'), 'Chapati');
});
