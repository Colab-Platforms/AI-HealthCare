/**
 * Hybrid diet plan (Food DB week + AI meals), against the real seed file. The model call and the
 * dish resolver are faked: no Mongo, no AI.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const G = require('../services/foodDb/dietPlanGenerator');
const H = require('../services/foodDb/hybridPlan');
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

const generatePlan = (u, opts) => G.generatePlanFromFoods(FOODS, u, opts);

/** Reads "- day N slot: about K kcal" lines from the prompt, as the real model would. */
function askedSlots(prompt) {
  return [...prompt.matchAll(/^- day (\d+) (breakfast|lunch|dinner): about (\d+) kcal/gm)]
    .map((m) => ({ day: Number(m[1]), slot: m[2], kcal: Number(m[3]) }));
}

/** A model that writes a home meal for every slot asked, each with its own new dish. */
function fakeModel(mealFor) {
  const calls = [];
  const fn = async ({ system, prompt }) => {
    calls.push({ system, prompt });
    return { meals: askedSlots(prompt).map((s, n) => ({ day: s.day, slot: s.slot, items: mealFor(s, n) })) };
  };
  fn.calls = calls;
  return fn;
}

const homeMeal = (s, n) => (s.slot === 'breakfast'
  ? [{ name: `Test Poha ${n}`, role: 'main', grams: 200 }]
  : [{ name: `Test Dal ${n}`, role: 'main', grams: 250 }, { name: 'Chapati', role: 'flatbread', grams: 90 }, { name: 'Cucumber Raita', role: 'side', grams: 100 }]);

const KNOWN = { chapati: 'THF-00299', 'cucumber raita': 'THF-00420', 'chicken curry': 'THF-00177', 'moong dal tadka': 'THF-00083' };

/**
 * Known names → seed foods; "Test Dal N" / "Test Poha N" → new ai_pending foods (what aiFoodFallback
 * would create), cloned from a real dal / poha so they carry real nutrition.
 */
function fakeResolver() {
  const created = [];
  const fn = async (names) => {
    const foodsByName = new Map();
    for (const name of names) {
      const key = H.nameKey(name);
      if (KNOWN[key]) { foodsByName.set(key, BY_ID.get(KNOWN[key])); continue; }
      const m = name.match(/^Test (Dal|Poha) (\d+)$/);
      if (!m) continue; // the DB does not know it, and the fallback could not save it
      const template = BY_ID.get(m[1] === 'Dal' ? 'THF-00083' : 'THF-00364');
      const food = { ...template, foodId: `THF-A${String(created.length + 1).padStart(5, '0')}`, name, dataQuality: { ...template.dataQuality, status: 'ai_pending' } };
      created.push(food.foodId);
      foodsByName.set(key, food);
    }
    return { foodsByName, createdFoodIds: [...created] };
  };
  fn.created = created;
  return fn;
}

const mealKcalFromItems = (meal, extra) => meal.items.reduce((acc, it) => {
  const food = BY_ID.get(it.foodId) || extra.get(it.foodId);
  assert.ok(food, `unknown foodId ${it.foodId}`);
  return acc + nutritionFor(food, it.grams).calories;
}, 0);

test('chooseAiSlots: half the meals, one per day first, slot types rotated', () => {
  const rng = G.mulberry32(1);
  const slots = H.chooseAiSlots(0.5, rng);
  assert.equal(slots.length, 11); // round(21 × 0.5)
  const perDay = Array.from({ length: 7 }, (_, d) => slots.filter((s) => s.day === d).length);
  assert.ok(perDay.every((n) => n >= 1 && n <= 2), `per day ${perDay}`);
  const perSlot = SLOTS.map((s) => slots.filter((x) => x.slot === s).length);
  assert.ok(perSlot.every((n) => n >= 3 && n <= 4), `per slot ${perSlot}`);
  assert.equal(new Set(slots.map((s) => `${s.day}:${s.slot}`)).size, slots.length);

  assert.deepEqual(H.chooseAiSlots(0, G.mulberry32(1)), []);
  assert.equal(new Set(H.chooseAiSlots(1, G.mulberry32(1)).map((s) => `${s.day}:${s.slot}`)).size, 21);
});

test('hybrid plan: AI meals replace half the DB meals, with DB foods and DB nutrition, days still on target', async () => {
  const model = fakeModel(homeMeal);
  const resolver = fakeResolver();
  const r = await H.generateHybridPlan(user(), { seed: 'h1', share: 0.5 }, { generatePlan, callModel: model, resolveDishNames: resolver });
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.plan.generator, 'hybrid');
  assert.equal(model.calls.length, 1, 'one model call for the whole plan');
  assert.equal(r.stats.aiSlotsAsked, 11);
  assert.equal(r.stats.aiMeals, 11, `kept: ${JSON.stringify(r.stats.aiKept)}`);
  assert.ok(r.stats.maxDayErrorPct <= 5, `max day error ${r.stats.maxDayErrorPct.toFixed(1)}%`);
  assert.equal(r.stats.createdFoodIds.length, 11, 'each new dish was added to the DB');

  const extra = new Map();
  for (const id of resolver.created) extra.set(id, { ...BY_ID.get('THF-00083'), foodId: id }); // same nutrition as the clone
  let ai = 0;
  for (const s of SLOTS) {
    for (const meal of r.plan.mealPlan[s]) {
      assert.ok(['food_db', 'ai_db'].includes(meal.source));
      assert.ok(meal.items.length >= 1);
      if (meal.source !== 'ai_db') continue;
      ai++;
      // The AI's numbers are never used: the meal's calories are the sum of its DB items.
      const poha = meal.items.some((i) => i.name.startsWith('Test Poha'));
      if (!poha) assert.equal(meal.calories, mealKcalFromItems(meal, extra), meal.name);
    }
  }
  assert.equal(ai, 11);
});

test('the prompt shows the DB meals of the week, the meals to write and their budgets', async () => {
  const model = fakeModel(homeMeal);
  await H.generateHybridPlan(user(), { seed: 'h2', share: 0.5 }, { generatePlan, callModel: model, resolveDishNames: fakeResolver() });
  const { prompt, system } = model.calls[0];
  assert.match(system, /VEGETARIAN/);
  assert.equal((prompt.match(/: \(you write this\)/g) || []).length, 11);
  assert.equal(askedSlots(prompt).length, 11);
  assert.ok(askedSlots(prompt).every((s) => s.kcal > 200 && s.kcal < 1000));
  assert.match(prompt, /Day 7 — breakfast:/);
  assert.match(prompt, /Lives in: Rajasthan/);
});

test('model failure → the DB plan, unchanged', async () => {
  const failing = async () => { throw new Error('529 overloaded'); };
  const db = generatePlan(user(), { seed: 'h3' });
  const r = await H.generateHybridPlan(user(), { seed: 'h3', share: 0.5 }, { generatePlan, callModel: failing, resolveDishNames: fakeResolver() });
  assert.equal(r.ok, true);
  assert.equal(r.plan.generator, 'food_db');
  assert.equal(r.stats.aiMeals, 0);
  assert.match(r.stats.modelError, /529/);
  assert.deepEqual(r.plan.mealPlan, db.plan.mealPlan);
});

test('an AI meal that breaks the diet, or names a dish the DB cannot place, keeps the DB meal', async () => {
  const model = fakeModel((s, n) => (n % 2
    ? [{ name: 'Chicken Curry', role: 'main', grams: 250 }, { name: 'Chapati', role: 'flatbread', grams: 90 }]
    : [{ name: 'Some Unknown Dish', role: 'main', grams: 250 }]));
  const r = await H.generateHybridPlan(user(), { seed: 'h4', share: 0.5 }, { generatePlan, callModel: model, resolveDishNames: fakeResolver() });
  assert.equal(r.ok, true);
  assert.equal(r.stats.aiMeals, 0);
  assert.equal(r.plan.generator, 'food_db');
  assert.ok(r.stats.aiKept.some((k) => /diet type/.test(k.reason)), JSON.stringify(r.stats.aiKept));
  assert.ok(r.stats.aiKept.some((k) => /not in the food DB/.test(k.reason)));
  for (const s of SLOTS) for (const meal of r.plan.mealPlan[s]) assert.ok(!/chicken/i.test(meal.name));
});

test('an AI meal may not repeat a dish the week already has in that slot', async () => {
  const db = generatePlan(user(), { seed: 'h5' });
  const lunchDish = db.plan.mealPlan.lunch[0].items.find((i) => G.DISH_ROLES.has(i.role));
  const name = BY_ID.get(lunchDish.foodId).name;
  const resolver = async (names) => ({ foodsByName: new Map(names.map((n) => [H.nameKey(n), BY_ID.get(lunchDish.foodId)])), createdFoodIds: [] });
  const fill = await H.fillAiSlots(user(), db.plan.mealPlan, [{ day: 3, slot: 'lunch' }], {
    callModel: async () => ({ meals: [{ day: 4, slot: 'lunch', items: [{ name, role: 'main', grams: 300 }] }] }),
    resolveDishNames: resolver,
  });
  assert.equal(fill.replaced.length, 0);
  assert.match(fill.kept[0].reason, /repeats/);
});

test('an AI meal with two dishes of one kind, or a full plate plus more dishes, keeps the DB meal', () => {
  const ctx = G.buildContext(user({ dietaryPreference: 'eggetarian' }));
  const foods = new Map([
    ['Masala Omelette', 'THF-00354'],
    ['Egg Curry with 2 Roti', 'THF-00536'],
    ['Egg Curry', 'THF-00176'],
    ['Egg Bhurji', 'THF-00526'],
    ['Chapati', 'THF-00299'],
  ].map(([name, id]) => [H.nameKey(name), BY_ID.get(id)]));
  const build = (names) => H.buildAiMeal(names.map((name) => ({ name, role: 'main', grams: 150 })), foods, { slot: 'lunch', budget: 700, ctx, blockedIds: new Set() });
  // Live test, day 1 breakfast: "Masala Omelette, Egg Curry with 2 Roti and Thalipeeth".
  assert.match(build(['Masala Omelette', 'Egg Curry with 2 Roti']).error, /two egg dishes|full plate/);
  assert.match(build(['Egg Curry with 2 Roti', 'Chapati']).error, /full plate/);
  assert.match(build(['Egg Bhurji', 'Masala Omelette']).error, /two egg dishes/);
  assert.equal(build(['Egg Curry', 'Chapati']).error, undefined);
});

test('parseMeals: only the slots asked for, items cleaned and capped', () => {
  const slots = [{ day: 0, slot: 'lunch' }];
  const parsed = H.parseMeals({
    meals: [
      { day: 1, slot: 'Lunch', items: [{ name: ' Moong Dal Tadka ', role: 'MAIN', grams: '250' }, { name: '' }] },
      { day: 2, slot: 'dinner', items: [{ name: 'Not asked' }] },
    ],
  }, slots);
  assert.deepEqual([...parsed.keys()], ['0:lunch']);
  assert.deepEqual(parsed.get('0:lunch'), [{ name: 'Moong Dal Tadka', role: 'main', grams: 250 }]);
  assert.equal(H.parseMeals(null, slots).size, 0);
});

test('single AI meal (regenerate): a new AI meal on the same budget, avoiding the excluded dishes', async () => {
  const db = generatePlan(user(), { seed: 'h6' });
  const budget = db.plan.mealPlan.dinner[2].calories;
  const meal = await H.generateHybridMeal(user(), { mealPlan: db.plan.mealPlan, slot: 'dinner', dayIndex: 2, budget, excludeFoodIds: ['THF-A00001'] }, {
    callModel: fakeModel(homeMeal),
    resolveDishNames: fakeResolver(),
  });
  // The fake resolver's first new dish is THF-A00001, which is excluded: the meal is refused.
  assert.equal(meal, null);

  const ok = await H.generateHybridMeal(user(), { mealPlan: db.plan.mealPlan, slot: 'dinner', dayIndex: 2, budget, excludeFoodIds: [] }, {
    callModel: fakeModel(homeMeal),
    resolveDishNames: fakeResolver(),
  });
  assert.equal(ok.source, 'ai_db');
  assert.ok(Math.abs(ok.calories - budget) <= budget * 0.08, `${ok.calories} vs ${budget}`);
  assert.notEqual(db.plan.mealPlan.dinner[2].source, 'ai_db', 'the stored plan object is not modified');
});
