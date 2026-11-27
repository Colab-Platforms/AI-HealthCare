/**
 * Meal scan resolve (services/foodDb/foodScan.js) and the identification output parser
 * (services/foodDb/foodIdentifier.js). Mongo and the LLM are stubbed: the index and the Food
 * documents come from data/foodDb/foods.seed.json.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const Food = require('../models/Food');
const M = require('../services/foodDb/foodMatcher');
const WC = require('../services/foodDb/warningConfig');
const { resolveMeal, resolveGrams, itemsFromSimpleText } = require('../services/foodDb/foodScan');
const { normalizeIdentification } = require('../services/foodDb/foodIdentifier');

const seed = require(path.join(__dirname, '..', 'data', 'foodDb', 'foods.seed.json')).filter((f) => f.isActive);
const index = M.buildIndex(seed);
const byName = (n) => seed.find((f) => f.name === n);

// ── stubs: no Mongo ─────────────────────────────────────────────────────────
M.getIndex = async () => index;
WC.getWarningConfig = async () => WC.DEFAULT_WARNING_CONFIG;
Food.find = (q) => ({ lean: async () => seed.filter((f) => q.foodId.$in.includes(f.foodId)) });
let hitUpdates = [];
Food.updateMany = (filter) => { hitUpdates.push(filter.foodId.$in); return Promise.resolve(); };

// ── identification parser ───────────────────────────────────────────────────
test('identification: cleans names, drops empty items, caps candidates, rejects bad grams', () => {
  const r = normalizeIdentification({
    isFood: true,
    items: [
      { name: '  Chicken Biryani ', candidates: ['Hyderabadi Biryani', 'chicken biryani', 'a', 'b', 'c'], portionText: '1 large plate', estGrams: '600' },
      { name: '', candidates: [] },
      { name: 'Raita', estGrams: -5 },
    ],
  });
  assert.equal(r.isFood, true);
  assert.deepEqual(r.items[0], { name: 'chicken biryani', candidates: ['hyderabadi biryani', 'a', 'b'], portionText: '1 large plate', estGrams: 600 });
  assert.equal(r.items.length, 2);
  assert.equal(r.items[1].estGrams, null);
});

test('identification: no items or isFood:false means not food', () => {
  assert.equal(normalizeIdentification({ isFood: false, items: [] }).isFood, false);
  assert.equal(normalizeIdentification({ items: [] }).isFood, false);
  assert.equal(normalizeIdentification(null).isFood, false);
});

// ── grams ───────────────────────────────────────────────────────────────────
test('grams: LLM estimate wins; else portion text × serving unit; else default serving', () => {
  const food = { serving: { defaultUnit: 'bowl', defaultGrams: 180, units: [
    { unit: 'small bowl', grams: 108 }, { unit: 'bowl', grams: 180 }, { unit: 'large bowl', grams: 270 }] } };
  assert.equal(resolveGrams({ estGrams: 250 }, food), 250);
  assert.equal(resolveGrams({ estGrams: 99999, portionText: '2 bowls' }, food), 360); // absurd estimate ignored
  assert.equal(resolveGrams({ portionText: '1 large bowl' }, food), 270);
  assert.equal(resolveGrams({ portionText: 'half bowl' }, food), 90);
  assert.equal(resolveGrams({ portionText: '' }, food), 180);
});

// ── typed text shortcut ─────────────────────────────────────────────────────
test('typed single food skips the LLM; lists and vague words do not', () => {
  const items = itemsFromSimpleText(index, 'chicken dum biryani', '');
  assert.equal(items[0].foodId, byName('Chicken Dum Biryani').foodId);
  assert.equal(itemsFromSimpleText(index, 'dal, rice and roti', ''), null);
  assert.equal(itemsFromSimpleText(index, 'biryani', ''), null); // ambiguous → identifier/suggestions
  assert.equal(itemsFromSimpleText(index, 'maggi', ''), null); // not in DB
});

// ── resolve ─────────────────────────────────────────────────────────────────
test('resolve: the original sample meal, end to end', async () => {
  hitUpdates = [];
  const data = await resolveMeal({
    user: { profile: { isDiabetic: 'yes' } },
    items: [
      { name: 'chicken biryani', candidates: ['hyderabadi chicken biryani'], portionText: '1 large plate', estGrams: 600 },
      { name: 'cucumber raita', candidates: ['raita'], portionText: '1 small bowl', estGrams: 100 },
    ],
  });
  assert.equal(data.source, 'food_db');
  assert.deepEqual(data.dishes.map((d) => d.name), ['Chicken Dum Biryani', 'Cucumber Raita']);
  const [biryani] = data.dishes;
  assert.equal(biryani.quantity, '1 large plate (600 g)');
  assert.equal(biryani.nutrition.calories, 863); // 143.83 kcal/100 g × 600 g
  assert.ok(biryani.ingredients.length > 0);
  // ingredients are scaled to 600 g and still add up to the dish
  const ingKcal = biryani.ingredients.reduce((s, i) => s + i.nutrition.calories, 0);
  assert.ok(Math.abs(ingKcal - biryani.nutrition.calories) <= biryani.ingredients.length, `${ingKcal} vs ${biryani.nutrition.calories}`);
  assert.equal(data.calories, data.dishes.reduce((s, d) => s + d.nutrition.calories, 0));
  assert.equal(data.foodName, 'Chicken Dum Biryani, Cucumber Raita');
  assert.equal(data.quantity, '1 large plate, 1 small bowl');
  assert.match(data.warnings[0], /^You have diabetes — this meal has ~96 g carbs/);
  assert.equal(hitUpdates.length, 1);
});

test('resolve: same input twice gives the same output (the point of the whole change)', async () => {
  const items = [{ name: 'dal makhani', portionText: '1 bowl', estGrams: 200 }, { name: 'roti', portionText: '2 roti', estGrams: 80 }];
  const a = await resolveMeal({ items, user: {} });
  const b = await resolveMeal({ items, user: {} });
  assert.deepEqual(a, b);
});

// A Food-shaped AI result, as services/foodDb/aiFoodFallback.js returns it.
const aiFood = (name, per100, extra = {}) => ({
  name, aliases: [], ingredients: [], allergens: [], tags: [], glycemicIndex: null,
  classification: { dietType: 'vegan' },
  serving: { defaultUnit: 'serving', defaultGrams: 100, units: [{ unit: 'serving', grams: 100 }] },
  nutritionPer100g: { calories: 100, protein: 2, carbs: 10, fats: 5, fiber: 1, sugar: 1, sodium: 50, ...per100 },
  ...extra,
});
const fallbackOf = (food, outcome = 'not_saved') => async () => ({ food, saved: outcome !== 'not_saved', outcome });

test('resolve: below the match threshold nothing is guessed — AI fallback, with DB suggestions', async () => {
  // From the live Gemini test: these used to be silently matched to the wrong dish.
  const aiFallback = async (item) => ({ food: aiFood(item.name.replace(/[a-z]/g, (c) => c.toUpperCase()), {}), saved: false, outcome: 'failed_checks' });
  const data = await resolveMeal({
    items: [{ name: 'sauteed spinach', estGrams: 150 }, { name: 'bacon', estGrams: 45 }, { name: 'lemon slice', estGrams: 10 }],
    user: {},
    aiFallback,
  });
  assert.deepEqual(data.dishes.map((d) => d.source), ['ai_fallback', 'ai_fallback', 'ai_fallback']);
  assert.ok(!data.dishes.some((d) => ['Palak Paneer', 'Bacon and Mushroom Pancake', 'Lemon Rice'].includes(d.name)));
  assert.ok(data.dishes[0].suggestions.length > 0); // e.g. Palak Paneer offered, not used
  assert.equal(data.dishes[0].foodId, null); // not saved → no foodId

  const biryani = await resolveMeal({ items: [{ name: 'biryani', estGrams: 300 }], user: {} });
  assert.deepEqual(biryani.dishes, []);
  assert.equal(biryani.unresolved[0].name, 'biryani');
  assert.ok(biryani.unresolved[0].suggestions.some((s) => /Biryani/.test(s.name)));
});

test('resolve: a user-picked foodId is used as is', async () => {
  const id = byName('Kolkata Chicken Biryani').foodId;
  const data = await resolveMeal({ items: [{ name: 'biryani', foodId: id, estGrams: 300 }], user: {} });
  assert.equal(data.dishes[0].foodId, id);
  assert.equal(data.dishes[0].matchScore, 1);
});

test('resolve: unmatched item goes to the AI fallback; without one it is reported, not invented', async () => {
  const items = [{ name: 'sushi', portionText: '6 pieces', estGrams: 150 }];
  const none = await resolveMeal({ items, user: {} });
  assert.deepEqual(none.dishes, []);
  assert.deepEqual(none.unresolved, [{ name: 'sushi', suggestions: [] }]);
  assert.equal(none.source, 'none');

  const sushi = aiFood('Sushi', { calories: 140, protein: 5, carbs: 28, fats: 1, sodium: 700 },
    { foodId: 'THF-A00001', classification: { dietType: 'non_vegetarian' }, allergens: ['fish', 'soy'], dataQuality: { status: 'ai_pending' } });
  const data = await resolveMeal({
    items,
    user: { profile: { healthConditions: ['Hypertension'], dietaryPreference: 'vegetarian', allergies: ['fish'] } },
    aiFallback: fallbackOf(sushi, 'created'),
  });
  assert.equal(data.source, 'ai_fallback');
  const [dish] = data.dishes;
  assert.equal(dish.foodId, 'THF-A00001');
  assert.equal(dish.dataStatus, 'ai_pending');
  assert.equal(dish.quantity, '6 pieces (150 g)');
  assert.equal(dish.nutrition.calories, 210); // 140 kcal/100 g × 150 g
  assert.deepEqual(data.createdFoodIds, ['THF-A00001']);
  // AI foods now carry diet type and allergens, so every warning rule applies (the gap the live test found)
  assert.deepEqual(data.warnings, [
    'May contain fish (Sushi) — you listed a fish allergy.',
    'Sushi contains meat or fish — you follow a vegetarian diet.',
    'You have high blood pressure — this meal has ~1,050 mg sodium, about 46% of your daily limit.',
  ]);
});

test('resolve: an AI name that links to an existing DB food uses the stored values', async () => {
  const dosa = byName('Masala Dosa');
  const data = await resolveMeal({ items: [{ name: 'sushi', estGrams: 150 }], user: {}, aiFallback: fallbackOf(dosa, 'linked') });
  assert.equal(data.dishes[0].source, 'food_db');
  assert.equal(data.dishes[0].foodId, dosa.foodId);
  assert.deepEqual(data.createdFoodIds, []);
});

test('resolve: DB and AI dishes together are "mixed"', async () => {
  const data = await resolveMeal({
    items: [{ name: 'masala dosa', estGrams: 150 }, { name: 'sushi', estGrams: 150 }],
    user: {},
    aiFallback: fallbackOf(aiFood('Sushi', { calories: 200 })),
  });
  assert.equal(data.source, 'mixed');
  assert.equal(data.calories, data.dishes[0].nutrition.calories + 300);
});
