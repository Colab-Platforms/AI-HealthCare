/**
 * Meal warnings rule engine (services/foodDb/mealWarnings.js, docs/FOOD_DB_FLOW.md section 9).
 * Pure functions: no DB, no network. Most cases use small synthetic foods so each threshold is exact.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { buildUserHealthProfile, getMealWarnings, allergensInText } = require('../services/foodDb/mealWarnings');
const { DEFAULT_WARNING_CONFIG, deepMerge } = require('../services/foodDb/warningConfig');

// Per-100 g values, so `grams: 100` means "these exact amounts".
function food(name, per100 = {}, extra = {}) {
  return {
    name,
    aliases: [],
    nutritionPer100g: { calories: 100, protein: 5, carbs: 10, fats: 3, ...per100 },
    classification: { dietType: 'vegan' },
    allergens: [],
    tags: [],
    ingredients: [],
    glycemicIndex: null,
    ...extra,
  };
}
const warn = (user, dishes, config) => getMealWarnings({ profile: buildUserHealthProfile(user), dishes, config }).warnings;
const one = (f, grams = 100) => [{ food: f, grams }];

// ── profile ─────────────────────────────────────────────────────────────────
test('profile: conditions from every source, "None of these"/"Other" ignored', () => {
  const p = buildUserHealthProfile({
    profile: {
      isDiabetic: 'yes',
      healthConditions: ['Hypertension', 'None of these', 'Other'],
      chronicConditions: ['high cholesterol'],
      medicalHistory: { conditions: ['PCOD'], currentMedications: ['Telmisartan 40', 'Atorvastatin'] },
    },
  });
  assert.deepEqual([...p.conditions].sort(), ['diabetes', 'high_cholesterol', 'hypertension', 'pcos']);
  assert.deepEqual(p.medications.map((m) => m.kind).sort(), ['potassium_raising', 'statin']);
});

test('profile: allergy text maps to allergen codes; unknown text becomes free text', () => {
  assert.deepEqual([...allergensInText('Lactose intolerance')], ['milk']);
  assert.deepEqual([...allergensInText('tree nuts')].sort(), ['peanut', 'tree_nuts']);
  assert.deepEqual([...allergensInText('seafood')].sort(), ['fish', 'shellfish']);
  const p = buildUserHealthProfile({ profile: { allergies: ['Dairy', 'brinjal', 'none'] } });
  assert.equal(p.allergens.get('milk').text, 'Dairy');
  assert.deepEqual(p.freeText, [{ text: 'brinjal', source: 'allergy' }]);
});

test('no conditions, allergies or diet on file → no warnings', () => {
  const heavy = food('Feast', { carbs: 150, sugar: 40, sodium: 3000, satFat: 20 }, { tags: ['deep_fried'] });
  assert.deepEqual(warn({ profile: { healthConditions: ['None of these'] } }, one(heavy)), []);
});

// ── allergies, avoid list, diet ─────────────────────────────────────────────
test('allergy: always shown; "Contains" from a recipe, "May contain" from the name only', () => {
  const raita = food('Cucumber Raita', {}, { allergens: ['milk'], ingredients: [{ name: 'Curd' }] });
  const kulfi = food('Kulfi', {}, { allergens: ['milk'] });
  assert.deepEqual(warn({ profile: { allergies: ['Dairy'] } }, one(raita)),
    ['Contains dairy (Cucumber Raita) — you listed a dairy allergy.']);
  assert.deepEqual(warn({ foodPreferences: { dietaryRestrictions: ['lactose intolerance'] } }, one(kulfi)),
    ['May contain dairy (Kulfi) — you listed "lactose intolerance".']);
});

test('foods to avoid and free-text allergies match dish names, aliases and ingredients (spelling-folded)', () => {
  const bharta = food('Baingan Bharta', {}, { aliases: ['brinjal bharta'] });
  assert.deepEqual(warn({ foodPreferences: { foodsToAvoid: ['Brinjal'] } }, one(bharta)),
    ['You marked "Brinjal" as a food to avoid — found in Baingan Bharta.']);
  const pulao = food('Veg Pulao', {}, { ingredients: [{ name: 'Green peas' }] });
  assert.deepEqual(warn({ profile: { allergies: ['green peas'] } }, one(pulao)),
    ['You noted "green peas" — Veg Pulao contains it.']);
  assert.deepEqual(warn({ foodPreferences: { dietaryDont: ['no onion'] } },
    one(food('Dal Tadka', {}, { tags: ['contains_onion_garlic'] }))),
  ['You marked "onion" as a food to avoid — found in Dal Tadka.']);
});

test('diet clashes', () => {
  const chicken = food('Chicken Curry', {}, { classification: { dietType: 'non_vegetarian' } });
  const omelette = food('Omelette', {}, { classification: { dietType: 'eggetarian' } });
  const dal = food('Dal Tadka', {}, { classification: { dietType: 'vegetarian' }, tags: ['contains_onion_garlic'] });
  assert.deepEqual(warn({ profile: { dietaryPreference: 'vegetarian' } }, one(chicken)),
    ['Chicken Curry contains meat or fish — you follow a vegetarian diet.']);
  assert.deepEqual(warn({ profile: { dietaryPreference: 'eggetarian' } }, one(omelette)), []);
  assert.deepEqual(warn({ profile: { dietaryPreference: 'jain' } }, one(dal)),
    ['Dal Tadka usually contains onion, garlic or root vegetables, which are not Jain-friendly.']);
  assert.deepEqual(warn({ profile: { dietaryPreference: 'vegan' } }, one(dal)),
    ['Dal Tadka may contain dairy (ghee, milk or curd) — you follow a vegan diet.']);
  assert.deepEqual(warn({ profile: { dietaryPreference: 'non-vegetarian' } }, one(chicken)), []);
});

// ── conditions ──────────────────────────────────────────────────────────────
test('diabetes: carbs above 60 g warns, at 60 g does not', () => {
  const diabetic = { profile: { isDiabetic: 'yes' } };
  assert.deepEqual(warn(diabetic, one(food('Rice', { carbs: 60 }))), []);
  assert.match(warn(diabetic, one(food('Rice', { carbs: 61 })))[0], /^You have diabetes — this meal has ~61 g carbs, mostly from Rice\./);
});

test('diabetes: a high-GI dish with > 30 g carbs warns even when the meal total is moderate', () => {
  const [w] = warn({ profile: { healthConditions: ['Diabetes'] } }, one(food('Jeera Rice', { carbs: 40 }, { glycemicIndex: 65 })));
  assert.match(w, /Jeera Rice is a fast-digesting carb \(~40 g carbs\)/);
});

test('sodium is one warning naming every affected condition', () => {
  const w = warn({ profile: { healthConditions: ['Hypertension', 'Heart Disease'] } }, one(food('Pickle Thali', { sodium: 1200 })));
  assert.deepEqual(w, ['You have high blood pressure and a heart condition — this meal has ~1,200 mg sodium, about 52% of your daily limit.']);
});

test('at most 2 condition warnings, most severe first; allergy warnings are never capped', () => {
  const dish = food('Fried Feast', { carbs: 200, sodium: 900, satFat: 8 }, { allergens: ['milk', 'gluten'], tags: ['deep_fried', 'spicy'], glycemicIndex: 70 });
  const w = warn({
    profile: { allergies: ['milk', 'wheat'], healthConditions: ['Diabetes', 'Hypertension', 'High Cholesterol', 'Gut Health Issues'] },
  }, one(dish));
  assert.equal(w.filter((x) => /^May contain/.test(x)).length, 2);
  const conditionWarnings = w.filter((x) => /^You have/.test(x));
  assert.equal(conditionWarnings.length, 2);
  assert.match(conditionWarnings[0], /diabetes — this meal has ~200 g carbs/); // 200/60 = 3.3× the limit
});

test('thyroid, gut health and PCOS use tags', () => {
  assert.match(warn({ profile: { healthConditions: ['Thyroid'] } }, one(food('Soya Chunks Curry', {}, { tags: ['goitrogen'] })))[0],
    /a thyroid condition — Soya Chunks Curry is soy or cruciferous-heavy/);
  assert.match(warn({ profile: { healthConditions: ['Gut Health Issues'] } }, one(food('Samosa', {}, { tags: ['deep_fried', 'fried'] })))[0],
    /gut health issues — fried food in Samosa may upset digestion/);
  assert.match(warn({ profile: { healthConditions: ['PCOS'] } }, one(food('Jalebi', { sugar: 30 }, { tags: ['refined_carb'] })))[0],
    /PCOS — refined carbs in Jalebi can spike insulin/);
});

test('medications: warfarin + leafy greens, BP drugs + high potassium', () => {
  assert.match(warn({ profile: { medicalHistory: { currentMedications: ['Warfarin'] } } }, one(food('Palak Paneer')))[0],
    /^You take Warfarin — Palak Paneer is rich in vitamin K/);
  assert.match(warn({ profile: { medicalHistory: { currentMedications: ['Ramipril 5mg'] } } }, one(food('Banana Shake', { potassium: 1100 })))[0],
    /^You take Ramipril 5mg — this meal is high in potassium/);
  assert.deepEqual(warn({ profile: { medicalHistory: { currentMedications: ['Warfarin'] } } }, one(food('Jeera Rice'))), []);
});

test('missing nutrient values skip that rule instead of counting as zero or failing', () => {
  const noSodium = food('Mystery Curry', { sodium: null, satFat: null });
  assert.deepEqual(warn({ profile: { healthConditions: ['Hypertension', 'High Cholesterol'] } }, one(noSodium)), []);
});

test('config overrides are merged over the defaults', () => {
  const config = deepMerge(DEFAULT_WARNING_CONFIG, { rules: { hypertension: { sodiumMg: 500 } } });
  assert.equal(config.rules.hypertension.sodiumMg, 500);
  assert.equal(config.rules.diabetes.carbsG, 60); // untouched
  const dish = one(food('Dal', { sodium: 600 }));
  const bp = { profile: { healthConditions: ['Hypertension'] } };
  assert.deepEqual(warn(bp, dish), []);
  assert.equal(warn(bp, dish, config).length, 1);
});

// ── real seed data ──────────────────────────────────────────────────────────
test('seed: chicken biryani 600 g + raita for a diabetic, BP, dairy-allergic vegetarian', () => {
  const seed = require(path.join(__dirname, '..', 'data', 'foodDb', 'foods.seed.json'));
  const F = (n) => seed.find((f) => f.name === n);
  const w = warn({
    profile: { isDiabetic: 'yes', healthConditions: ['Hypertension'], allergies: ['Dairy'], dietaryPreference: 'vegetarian' },
  }, [{ food: F('Chicken Dum Biryani'), grams: 600 }, { food: F('Cucumber Raita'), grams: 100 }]);
  assert.deepEqual(w, [
    'Contains dairy (Chicken Dum Biryani and Cucumber Raita) — you listed a dairy allergy.',
    'Chicken Dum Biryani contains meat or fish — you follow a vegetarian diet.',
    'You have diabetes — this meal has ~96 g carbs, mostly from Chicken Dum Biryani. Consider a smaller portion with extra salad or protein.',
    'You have high blood pressure — this meal has ~1,220 mg sodium, about 53% of your daily limit.',
  ]);
});
