/**
 * AI fallback with auto-save (services/foodDb/aiFoodFallback.js, docs/FOOD_DB_FLOW.md section 8).
 * The LLM and Mongo are stubbed: an in-memory `foods` array stands in for the collection.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const openrouterAI = require('../services/openrouterAI');
const Food = require('../models/Food');
const FoodFallbackLog = require('../models/FoodFallbackLog');
const M = require('../services/foodDb/foodMatcher');
const { buildAiFood, makeAiFallback } = require('../services/foodDb/aiFoodFallback');

const seed = require(path.join(__dirname, '..', 'data', 'foodDb', 'foods.seed.json')).filter((f) => f.isActive);
M.getIndex = async () => M.buildIndex(seed);
M.invalidateIndex = () => {};

// ── in-memory Food / FoodFallbackLog ────────────────────────────────────────
let foods = [];
let logs = [];
const matches = (doc, q) => {
  if (q.$or) return q.$or.some((sub) => matches(doc, sub));
  return Object.entries(q).every(([k, v]) => {
    const val = k.split('.').reduce((o, p) => o?.[p], doc);
    if (v && v.$regex) return new RegExp(v.$regex, v.$options).test(val);
    if (v && v.$in) return Array.isArray(val) ? val.some((x) => v.$in.includes(x)) : v.$in.includes(val);
    return val === v;
  });
};
const chain = (result) => ({ sort() { return this; }, select() { return this; }, lean: async () => result() });
Food.findOne = (q) => chain(() => {
  const hits = foods.filter((d) => matches(d, q)).sort((a, b) => b.foodId.localeCompare(a.foodId));
  return hits[0] ? structuredClone(hits[0]) : null;
});
Food.create = async (doc) => {
  if (foods.some((d) => d.foodId === doc.foodId)) throw Object.assign(new Error('dup'), { code: 11000 });
  foods.push(structuredClone(doc));
  return { toObject: () => structuredClone(doc) };
};
Food.updateOne = async (q, u) => { const d = foods.find((x) => matches(x, q)); Object.assign(d, u.$set); };
FoodFallbackLog.create = async (doc) => { logs.push(doc); };

let aiReply;
openrouterAI.chatCompletion = async () => JSON.stringify(aiReply);
const reset = () => { foods = []; logs = []; };

// A plausible AI answer for "bacon".
const bacon = () => ({
  name: 'Bacon',
  isGenericFood: true,
  aliases: ['bacon strips'],
  nutritionPer100g: { calories: 541, protein: 37, carbs: 1.4, fats: 42, fiber: 0, sugar: 0, sodium: 1717, satFat: 14, cholesterol: 110 },
  serving: { defaultUnit: 'slice', defaultGrams: 15 },
  classification: { dietType: 'vegetarian', mealSlots: ['breakfast'], course: 'main', category: 'meat or fish (dry)', cuisine: 'global' },
  allergens: [],
  tags: ['processed'],
  glycemicIndex: null,
  ingredients: [{ name: 'Pork belly', gramsPerServing: 15 }],
});
const item = { name: 'bacon', candidates: [], portionText: '3 strips', estGrams: 45 };

// ── normalise + checks ──────────────────────────────────────────────────────
test('buildAiFood: diet type and allergens are never looser than the name rules', () => {
  const { doc, problems } = buildAiFood(bacon(), item); // AI wrongly said "vegetarian"
  assert.deepEqual(problems, []);
  assert.equal(doc.classification.dietType, 'non_vegetarian');
  assert.ok(doc.tags.includes('red_meat'));
  assert.equal(doc.dataQuality.status, 'ai_pending');
  assert.equal(doc.source.primary, 'ai');
  assert.deepEqual(doc.serving.units, [{ unit: 'slice', grams: 15 }]);

  const paneer = buildAiFood({ ...bacon(), name: 'Paneer Tikka', classification: { dietType: 'vegan', category: 'snack' }, nutritionPer100g: { calories: 260, protein: 15, carbs: 8, fats: 19 } },
    { name: 'paneer tikka' }).doc;
  assert.ok(paneer.allergens.includes('milk'));
  assert.equal(paneer.classification.dietType, 'vegetarian'); // dairy → not vegan

  const avocado = buildAiFood({ ...bacon(), name: 'Avocado', classification: { dietType: 'vegan', category: 'salad' }, allergens: [], tags: [], nutritionPer100g: { calories: 160, protein: 2, carbs: 8.5, fats: 14.7 } },
    { name: 'avocado' }).doc;
  assert.equal(avocado.classification.dietType, 'vegan'); // the name rules' cautious "vegetarian" default does not override
  // …nor their "savoury dishes contain onion/garlic" guess (live test: avocado got the tag)
  assert.ok(!avocado.tags.includes('contains_onion_garlic'));
  const pakora = buildAiFood({ ...bacon(), name: 'Onion Pakora', tags: [], classification: { dietType: 'vegan', category: 'snack' },
    nutritionPer100g: { calories: 300, protein: 6, carbs: 30, fats: 17 } }, { name: 'onion pakora' }).doc;
  assert.ok(pakora.tags.includes('contains_onion_garlic')); // the word is in the name
});

test('buildAiFood: the scanned name and candidates become aliases (the next scan matches)', () => {
  const { doc } = buildAiFood({ ...bacon(), name: 'Sauteed Spinach' }, { name: 'palak sabzi', candidates: ['spinach stir fry'] });
  assert.equal(doc.name, 'Sauteed Spinach');
  assert.ok(doc.aliases.includes('palak sabzi'));
  assert.ok(doc.aliases.includes('spinach stir fry'));
});

test('buildAiFood: impossible numbers, missing fields and personal names are caught', () => {
  const bad = buildAiFood({ ...bacon(), nutritionPer100g: { calories: 100, protein: 37, carbs: 1, fats: 42 } }, item);
  assert.match(bad.problems.join(), /calories 100 vs macros/);
  const missing = buildAiFood({ ...bacon(), nutritionPer100g: { calories: 541 }, classification: {} }, item);
  assert.ok(missing.problems.includes('protein missing'));
  assert.ok(missing.problems.includes('dietType missing'));
  assert.equal(buildAiFood({ ...bacon(), name: "Mom's Special Dal" }, { name: "mom's special dal" }).notGeneric, true);
  assert.equal(buildAiFood({ ...bacon(), isGenericFood: false }, item).notGeneric, true);
});

// ── save or link ────────────────────────────────────────────────────────────
test('new food is saved as ai_pending with a THF-A id, then the same name links instead of duplicating', async () => {
  reset();
  aiReply = bacon();
  const fb = makeAiFallback({ userId: null });
  const first = await fb(item);
  assert.equal(first.outcome, 'created');
  assert.equal(first.food.foodId, 'THF-A00001');
  assert.equal(first.food.stats.hitCount, 1);
  assert.equal(foods.length, 1);

  const second = await fb({ ...item, name: 'bacon strips' });
  assert.equal(second.outcome, 'linked');
  assert.equal(second.food.foodId, 'THF-A00001');
  assert.equal(foods.length, 1); // no duplicate

  aiReply = { ...bacon(), name: 'Turkey Bacon', aliases: [] };
  const third = await fb({ name: 'turkey bacon' });
  assert.equal(third.food.foodId, 'THF-A00002'); // next id in the AI range
});

test('failed checks: used for this scan only, not saved, logged for the admin', async () => {
  reset();
  aiReply = { ...bacon(), nutritionPer100g: { calories: 2000, protein: 37, carbs: 1, fats: 42 } };
  const r = await makeAiFallback({})(item);
  assert.equal(r.saved, false);
  assert.equal(r.outcome, 'failed_checks');
  assert.equal(r.food.foodId, undefined);
  assert.equal(foods.length, 0);
  assert.equal(logs[0].outcome, 'failed_checks');
  assert.ok(logs[0].reasons.some((x) => /calories/.test(x)));
});

test('a rejected name is never auto-saved again; a merged name links to its target', async () => {
  reset();
  foods.push({ foodId: 'THF-A00007', name: 'Bacon', aliases: [], isActive: false, mergedInto: null, dataQuality: { status: 'rejected' } });
  aiReply = bacon();
  const r = await makeAiFallback({})(item);
  assert.equal(r.outcome, 'previously_rejected');
  assert.equal(foods.length, 1);

  reset();
  foods.push(
    { foodId: 'THF-A00007', name: 'Bacon', aliases: [], isActive: false, mergedInto: 'THF-A00003', dataQuality: { status: 'rejected' } },
    { foodId: 'THF-A00003', name: 'Pork Bacon', aliases: [], isActive: true, mergedInto: null, dataQuality: { status: 'verified' } },
  );
  const merged = await makeAiFallback({})(item);
  assert.equal(merged.outcome, 'linked');
  assert.equal(merged.food.foodId, 'THF-A00003');
  assert.ok(foods.find((f) => f.foodId === 'THF-A00003').aliases.includes('bacon'));
});

test('an AI name close to an existing seed food links to it (no near-duplicate)', async () => {
  reset();
  foods.push(...seed.filter((f) => f.name === 'Masala Dosa').map((f) => structuredClone(f)));
  aiReply = { ...bacon(), name: 'Masala Dosai', aliases: [], classification: { dietType: 'vegan', category: 'one-dish meal or breakfast item' },
    nutritionPer100g: { calories: 170, protein: 4, carbs: 25, fats: 6 }, allergens: [], tags: [] };
  const r = await makeAiFallback({})({ name: 'mysore style dosa with potato' });
  assert.equal(r.outcome, 'linked');
  assert.equal(r.food.name, 'Masala Dosa');
});

test('an AI error is logged and returns null (the item is reported as unresolved)', async () => {
  reset();
  openrouterAI.chatCompletion = async () => { throw new Error('rate limited'); };
  const r = await makeAiFallback({})(item);
  assert.equal(r, null);
  assert.equal(logs[0].outcome, 'ai_error');
  openrouterAI.chatCompletion = async () => JSON.stringify(aiReply);
});
