/**
 * Admin food review (controllers/adminFoodController.js, docs/FOOD_DB_FLOW.md section 8.4).
 * Mongo is stubbed; documents are real Food model instances built from the seed.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const Food = require('../models/Food');
const M = require('../services/foodDb/foodMatcher');
let invalidated = 0;
M.invalidateIndex = () => { invalidated += 1; };
const c = require('../controllers/adminFoodController');

const seed = require(path.join(__dirname, '..', 'data', 'foodDb', 'foods.seed.json'));
const adminId = '507f1f77bcf86cd799439011';

function call(handler, { params = {}, body = {}, query = {} } = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); },
    };
    handler({ params, body, query, user: { _id: adminId } }, res);
  });
}

function hydrated(name) {
  const doc = new Food(structuredClone(seed.find((f) => f.name === name)));
  doc.save = async function save() { await this.validate(); return this; };
  return doc;
}

test('PATCH: an edit that fails the nutrition checks is refused with the problems', async () => {
  const doc = hydrated('Plain Paratha');
  Food.findOne = async () => doc;
  const r = await call(c.updateFood, { params: { foodId: doc.foodId }, body: { nutritionPer100g: { calories: 100, protein: 40, carbs: 40, fats: 30 } } });
  assert.equal(r.status, 422);
  assert.match(r.body.problems.join(), /calories 100 vs macros/);
});

test('PATCH: a valid edit is saved, verified, and the search text and serving units follow', async () => {
  const doc = hydrated('Plain Paratha');
  Food.findOne = async () => doc;
  invalidated = 0;
  const r = await call(c.updateFood, {
    params: { foodId: doc.foodId },
    body: { aliases: ['Sada Parantha', 'plain parantha'], serving: { defaultUnit: 'piece', defaultGrams: 70 }, note: 'checked against IFCT' },
  });
  assert.equal(r.status, 200);
  const f = r.body.food;
  assert.equal(f.dataQuality.status, 'verified');
  assert.equal(String(f.dataQuality.reviewedBy), adminId);
  assert.equal(f.dataQuality.reviewNote, 'checked against IFCT');
  assert.deepEqual(f.aliases, ['sada parantha', 'plain parantha']);
  assert.match(f.searchText, /sada/);
  assert.deepEqual(f.serving.units.map((u) => u.grams), [70]);
  assert.equal(invalidated, 1);
});

test('PATCH: system fields cannot be edited; invalid enum values are rejected', async () => {
  const doc = hydrated('Plain Paratha');
  Food.findOne = async () => doc;
  assert.equal((await call(c.updateFood, { params: { foodId: doc.foodId }, body: { foodId: 'X', stats: {} } })).status, 400);
  const r = await call(c.updateFood, { params: { foodId: doc.foodId }, body: { classification: { ...doc.classification.toObject(), dietType: 'meat' } } });
  assert.equal(r.status, 400);
  assert.match(r.body.problems.join(), /dietType/);
});

test('merge: names move to the target, the source is kept inactive with mergedInto', async () => {
  const source = { foodId: 'THF-A00004', name: 'Sauteed Spinach', aliases: ['palak sabzi'] };
  const target = { foodId: 'THF-00200', name: 'Spinach Stir Fry', aliases: ['palak fry'] };
  Food.findOne = (q) => ({ lean: async () => (q.foodId === source.foodId ? source : target) });
  let targetUpdate;
  Food.updateOne = async (q, u) => { targetUpdate = u.$set; };
  Food.findOneAndUpdate = (q, u) => ({ lean: async () => ({ ...source, ...u.$set }) });
  const r = await call(c.mergeFood, { params: { foodId: source.foodId }, body: { targetFoodId: target.foodId } });
  assert.equal(r.status, 200);
  assert.deepEqual(targetUpdate.aliases, ['palak fry', 'sauteed spinach', 'palak sabzi']);
  assert.equal(r.body.food.mergedInto, target.foodId);
  assert.equal(r.body.food.isActive, false);
  assert.equal(r.body.food['dataQuality.status'], 'rejected');

  assert.equal((await call(c.mergeFood, { params: { foodId: source.foodId }, body: { targetFoodId: source.foodId } })).status, 400);
});

test('list: unknown status is a 400; default lists the ai_pending queue by hit count', async () => {
  assert.equal((await call(c.listFoods, { query: { status: 'nope' } })).status, 400);
  let seen;
  Food.find = (filter) => { seen = filter; return { sort() { return this; }, skip() { return this; }, limit() { return this; }, lean: async () => [] }; };
  Food.countDocuments = async () => 0;
  const r = await call(c.listFoods, { query: {} });
  assert.equal(r.status, 200);
  assert.deepEqual(seen, { 'dataQuality.status': 'ai_pending' });
});
