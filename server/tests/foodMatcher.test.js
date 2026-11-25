/**
 * Food matcher ranking (services/foodDb/foodMatcher.js) against the real seed file.
 * No Mongo: the index is built from data/foodDb/foods.seed.json.
 * If a seed rebuild changes a result here, check the ranking still makes sense before updating the test.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const M = require('../services/foodDb/foodMatcher');

const seed = require(path.join(__dirname, '..', 'data', 'foodDb', 'foods.seed.json'));
const index = M.buildIndex(seed.filter((f) => f.isActive));
const top = (q, opts) => M.rankFoods(index, q, { limit: 3, ...opts });
const topName = (q, opts) => top(q, opts)[0]?.food.name;

test('exact names and Hindi spellings match with score 1', () => {
  for (const [q, name] of [
    ['dal makhani', 'Dal Makhani'],
    ['aloo paratha', 'Aloo Paratha'],
    ['alu parantha', 'Aloo Paratha'],
    ['masala dosa', 'Masala Dosa'],
    ['palak paneer', 'Palak Paneer'],
    ['chicken 65', 'Chicken 65'],
  ]) {
    const r = top(q)[0];
    assert.equal(r.food.name, name, q);
    assert.equal(r.score, 1, q);
  }
});

test('common dish names reach the match threshold', () => {
  const r = top('chicken biryani')[0];
  assert.equal(r.food.name, 'Chicken Dum Biryani');
  assert.ok(r.score >= M.MATCH_THRESHOLD, `score ${r.score}`);
});

test('words that differ by a couple of letters are not treated as the same word', () => {
  // chicken ≠ chickpea, chai ≠ chat, palak ≠ pulao
  assert.equal(topName('chicken curry'), 'Chicken Curry');
  assert.ok(!top('chicken curry').some((r) => r.food.name === 'Chickpeas Curry'));
  assert.equal(topName('masala chai'), 'Masala Chai');
  const palak = top('palak chicken').find((r) => r.food.name === 'Chicken Pulao');
  assert.ok(!palak || palak.score < M.MATCH_THRESHOLD);
});

test('generic word prefers the plain version', () => {
  assert.equal(topName('omelette'), 'Plain Omelette');
  assert.equal(topName('paratha'), 'Plain Paratha');
  assert.equal(topName('2 roti'), 'Chapati (Roti)');
});

test('ambiguous single words stay below the match threshold (→ suggestions)', () => {
  for (const q of ['biryani', 'raita', 'dal']) {
    assert.ok(top(q)[0].score < M.MATCH_THRESHOLD, `${q}: ${top(q)[0].score}`);
  }
});

test('foods not in the DB score below the suggestion threshold (→ AI fallback)', () => {
  for (const q of ['burger', 'maggi']) {
    assert.ok(top(q)[0].score < M.SUGGEST_THRESHOLD, `${q}: ${top(q)[0].score}`);
  }
});

test('candidates: the best of several names wins', () => {
  const r = M.rankFoods(index, ['hyderabadi dum biryani special', 'chicken biryani'], { limit: 1 })[0];
  assert.equal(r.food.name, 'Chicken Dum Biryani');
  assert.ok(r.score >= M.MATCH_THRESHOLD);
});

test('prefixLast lets the search box match a half-typed last word', () => {
  assert.match(topName('chicken biry', { prefixLast: true }), /Chicken.*Biryani/);
});

test('disabled foods are never returned', () => {
  const disabledNames = new Set(seed.filter((f) => !f.isActive).map((f) => f.name));
  for (const q of ['dum aloo', 'pea kofta curry', 'lentil soup']) {
    assert.ok(top(q).every((r) => !disabledNames.has(r.food.name) || seed.some((f) => f.isActive && f.name === r.food.name)), q);
  }
});

test('search result shape and portion maths', () => {
  const r = M.toSearchResult(top('chicken dum biryani')[0]);
  assert.equal(r.foodId, seed.find((f) => f.name === 'Chicken Dum Biryani').foodId);
  assert.deepEqual(Object.keys(r), ['foodId', 'name', 'matchScore', 'matchedOn', 'dietType', 'category',
    'defaultServing', 'nutritionPerServing', 'glycemicIndex', 'dataStatus']); // no photo: food images are off
  assert.equal(r.matchedOn, 'name');
  // 143.83 kcal/100 g × 377.7 g = 543 kcal
  assert.equal(r.nutritionPerServing.calories, 543);
  assert.deepEqual(M.nutritionFor({ nutritionPer100g: { calories: 100, protein: 10, sodium: 155.5, satFat: 1.23, iron: 0.44, potassium: 120.4 } }, 250),
    { calories: 250, protein: 25, carbs: null, fats: null, fiber: null, sugar: null, sodium: 389,
      saturatedFat: 3.1, cholesterol: null, potassium: 301, calcium: null, iron: 1.1, vitaminC: null });
});
