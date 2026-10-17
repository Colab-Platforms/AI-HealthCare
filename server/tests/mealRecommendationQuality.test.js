/**
 * Meal-recommendation quality: genuine Indian routine, goal-correct calories,
 * Jain/exclusion strictness. The model call is stubbed — no network, no cost.
 *
 * Each group pins one real complaint:
 *   - biryani for breakfast / dishes named after the user's city
 *   - a user who switched Jain -> non-veg still being served Jain food
 *   - a bulking user handed a maintenance plan (and the reverse)
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const dietRecommendationAI = require('../services/dietRecommendationAI');
const { reconcileFoodPreferences, buildAvoidTerms, checkMealForJain, checkMealForAvoids } = require('../utils/dietConstraints');
const { checkMeal, sanitizeMealName } = require('../utils/mealGuard');
const { normalizePlanCalories, findCalorieViolations, rescaleMealToCalories } = require('../utils/mealPlanCalories');
const { buildSlotBudget } = require('../config/indianMealSlots');
const { getReferenceDishes } = require('../config/indianMealCatalog');
const { normalizeGoal, buildGoalInstructions } = require('../services/dietTargets');

// ---------------------------------------------------------------- slots ----

test('slot budgets always add back to exactly the daily target', () => {
  for (const kcal of [1200, 1500, 1733, 2000, 2450, 3100]) {
    const b = buildSlotBudget(kcal);
    assert.equal(b.breakfast + b.lunch + b.dinner, kcal, `budgets drifted for ${kcal}`);
    assert.ok(b.breakfast < b.lunch, 'lunch is the main meal');
    assert.ok(b.dinner < b.lunch, 'dinner is lighter than lunch');
  }
});

// ------------------------------------------------------- Jain / exclusions --

test('stale Jain tags are dropped when the user is no longer vegetarian/vegan', () => {
  const prefs = {
    dietaryRestrictions: ['Jain', 'Gluten-free'],
    dietaryDo: ['Jain food only'],
    preferredFoods: ['Jain thali', 'dal'],
    mealPreferences: { breakfast: ['Jain poha'], lunch: [], snacks: [], dinner: [] },
  };
  for (const diet of ['non-vegetarian', 'eggetarian', 'other']) {
    const { prefs: out, jain, dropped } = reconcileFoodPreferences(diet, prefs);
    assert.equal(jain, false, `Jain must not be enforced for ${diet}`);
    assert.deepEqual(out.dietaryRestrictions, ['Gluten-free']);
    assert.deepEqual(out.dietaryDo, []);
    assert.deepEqual(out.preferredFoods, ['dal']);
    assert.deepEqual(out.mealPreferences.breakfast, []);
    assert.equal(dropped.length, 4);
  }
});

test('Jain is decided by the diet type alone — a Jain tag on veg/vegan does NOT switch it on', () => {
  // The old model treated a "Jain" tag on a vegetarian as Jain. Two inputs for
  // one fact conflict, so only dietaryPreference === 'jain' counts now.
  for (const diet of ['vegetarian', 'vegan']) {
    const r = reconcileFoodPreferences(diet, { dietaryRestrictions: ['Jain'] });
    assert.equal(r.jain, false);
    assert.deepEqual(r.prefs.dietaryRestrictions, []);
  }
  const jain = reconcileFoodPreferences('jain', { dietaryRestrictions: ['Gluten-free'], foodsToAvoid: ['Jain Aloo Palak Sabzi with Kuttu Roti'] });
  assert.equal(jain.jain, true);
  assert.deepEqual(jain.prefs.foodsToAvoid, ['Jain Aloo Palak Sabzi with Kuttu Roti'], 'a rejected dish stays rejected');
  assert.deepEqual(jain.dropped, []);
});

test('NO MIXING: non-veg -> Jain serves only Jain, Jain -> non-veg serves no Jain, in both directions', () => {
  const stale = { dietaryRestrictions: ['Jain'] };

  const toJain = dietRecommendationAI.buildPlanPrompts(baseUserData({ dietaryPreference: 'jain', foodPreferences: {} }));
  assert.equal(toJain.constraints.jain, true);
  assert.ok(toJain.prompt.includes('STRICT JAIN'));
  assert.ok(toJain.prompt.includes('JAIN FOOD (strict'));
  assert.ok(!/non-vegetarian|NON-VEGETARIAN/.test(toJain.prompt), 'no non-veg wording in a Jain prompt');
  assert.ok(!/chicken|fish curry|egg curry/i.test(toJain.prompt.split('REFERENCE DISHES')[1] || ''), 'no meat in the Jain reference dishes');

  const toNonVeg = dietRecommendationAI.buildPlanPrompts(baseUserData({ dietaryPreference: 'non-vegetarian', foodPreferences: stale }));
  assert.equal(toNonVeg.constraints.jain, false);
  assert.ok(!/jain/i.test(toNonVeg.prompt) && !/jain/i.test(toNonVeg.systemPrompt));
});

test('a Jain-diet user is never given meat or eggs, nor onion/garlic/root vegetables', () => {
  const base = { slot: 'lunch', diet: 'jain', jain: true, dailyTarget: 2000 };
  assert.ok(checkMeal({ ...base, meal: { name: 'Chicken Curry with Roti', calories: 800 } }).hard.length >= 1);
  assert.ok(checkMeal({ ...base, meal: { name: 'Egg Curry with Rice', calories: 800 } }).hard.length >= 1);
  assert.ok(checkMeal({ ...base, meal: { name: 'Aloo Gobhi with Roti', calories: 800 } }).hard.length >= 1);
  assert.ok(checkMeal({ ...base, meal: { name: 'Veg Pulao', ingredients: ['rice', 'onion'], calories: 800 } }).hard.length >= 1);
  assert.equal(checkMeal({ ...base, meal: { name: 'Lauki Chana Dal with Roti', ingredients: ['lauki', 'chana dal', 'ghee', 'hing'], calories: 800 } }).ok, true);
});

test('jain is an accepted diet type end to end', () => {
  const { resolveDietaryPreference } = require('../utils/dietaryPreference');
  assert.deepEqual(resolveDietaryPreference({ profile: { dietaryPreference: 'jain' } }), { value: 'jain', source: 'profile' });
  assert.deepEqual(resolveDietaryPreference({ profile: { dietaryPreference: ' Jain ' } }), { value: 'jain', source: 'profile' });
  const User = require('../models/User');
  const err = new User({ profile: { dietaryPreference: 'jain' } }).validateSync('profile.dietaryPreference');
  assert.equal(err, undefined, 'the User schema must accept jain');
  const HealthGoal = require('../models/HealthGoal');
  assert.equal(new HealthGoal({ dietaryPreference: 'jain' }).validateSync('dietaryPreference'), undefined);
});

test('reconciling never mutates the caller\'s object (cached lean users are shared)', () => {
  const prefs = { dietaryRestrictions: ['Jain'] };
  reconcileFoodPreferences('non-vegetarian', prefs);
  assert.deepEqual(prefs.dietaryRestrictions, ['Jain']);
});

test('the prompt of a non-veg user who used to be Jain carries no Jain at all', () => {
  const { prompt, systemPrompt, constraints } = dietRecommendationAI.buildPlanPrompts(
    baseUserData({
      dietaryPreference: 'non-vegetarian',
      foodPreferences: { dietaryRestrictions: ['Jain'], dietaryDo: ['Jain food'] },
    })
  );
  assert.equal(constraints.jain, false);
  assert.ok(!/jain/i.test(prompt), 'Jain leaked into the prompt');
  assert.ok(!/jain/i.test(systemPrompt), 'Jain leaked into the system prompt');
});

test('the prompt of a Jain-diet user carries the strict Jain rule', () => {
  const { prompt, systemPrompt } = dietRecommendationAI.buildPlanPrompts(
    baseUserData({ dietaryPreference: 'jain', foodPreferences: {} })
  );
  assert.ok(prompt.includes('JAIN FOOD (strict'));
  assert.ok(systemPrompt.includes('JAIN FOOD (strict'));
});

test('Jain check judges name + ingredients, not the description', () => {
  assert.equal(checkMealForJain({ name: 'Aloo Paratha' }).ok, false);
  assert.equal(checkMealForJain({ name: 'Veg Pulao', ingredients: ['rice', 'onion', 'peas'] }).ok, false);
  assert.equal(checkMealForJain({ name: 'Kanda Poha' }).ok, false);
  assert.equal(checkMealForJain({ name: 'Methi Thepla with Curd', ingredients: ['atta', 'methi', 'dried ginger'] }).ok, true);
  // "prepared without onion" in a description must not reject the compliant dish
  assert.equal(checkMealForJain({ name: 'Moong Chilla', description: 'made without onion or garlic' }).ok, true);
});

test('"No dairy" and "No eggs" reach the members of the group', () => {
  const dairy = buildAvoidTerms({ dietaryDont: ['No dairy'] });
  assert.equal(checkMealForAvoids(dairy, { name: 'Palak Paneer with Roti' }).ok, false);
  assert.equal(checkMealForAvoids(dairy, { name: 'Dal Tadka with Ghee' }).ok, false);
  const eggs = buildAvoidTerms({ dietaryDont: ['No eggs'] });
  assert.equal(checkMealForAvoids(eggs, { name: 'Masala Omelette' }).ok, false);
  const onion = buildAvoidTerms({ dietaryDont: ['No onion'] });
  assert.equal(checkMealForAvoids(onion, { name: 'Kanda Poha' }).ok, false);
});

test('a permanently rejected dish and an allergen are both blocked, via name or ingredients', () => {
  const terms = buildAvoidTerms({ foodsToAvoid: ['Pesarattu'], allergies: ['peanuts'] });
  assert.equal(checkMealForAvoids(terms, { name: 'Pesarattu with Ginger Chutney' }).ok, false);
  assert.equal(checkMealForAvoids(terms, { name: 'Poha', ingredients: ['rice flakes', 'peanuts'] }).ok, false);
  assert.equal(checkMealForAvoids(terms, { name: 'Idli with Sambar' }).ok, true);
});

test('a rejected dish stored with its old "- Alibag Style" suffix still blocks the clean name', () => {
  // Real data: foodsToAvoid holds full generated names, and the same dish now
  // comes back without the suffix and the parenthetical.
  const terms = buildAvoidTerms({
    foodsToAvoid: ['Surmai Curry with Steamed Rice and Koshimbir - Alibag Coastal Style', 'Bombil (Bombay Duck) Masala with Bhakri and Solkadhi - Alibag Style'],
  });
  assert.equal(checkMealForAvoids(terms, { name: 'Surmai Curry with Steamed Rice and Koshimbir' }).ok, false);
  assert.equal(checkMealForAvoids(terms, { name: 'Bombil Masala with Bhakri and Solkadhi' }).ok, false);
  assert.equal(checkMealForAvoids(terms, { name: 'Surmai Curry with Steamed Rice and Koshimbir and Papad' }).ok, false);
  // a different dish that shares words is not blocked
  assert.equal(checkMealForAvoids(terms, { name: 'Pomfret Fry with Rice' }).ok, true);
  assert.equal(checkMealForAvoids(terms, { name: 'Steamed Rice' }).ok, true);
});

test('instruction-shaped exclusions do not become dish keywords', () => {
  const terms = buildAvoidTerms({ dietaryDont: ['No eating after 8pm at night please'] });
  assert.deepEqual(terms, []);
});

// ------------------------------------------------- routine / naming guard ---

test('biryani for breakfast is flagged; a poha breakfast is not', () => {
  const bad = checkMeal({ meal: { name: 'Chicken Biryani', calories: 560 }, slot: 'breakfast', diet: 'non-vegetarian', dailyTarget: 2000 });
  assert.ok(bad.soft.some((r) => /not a normal Indian breakfast/.test(r)));
  const ok = checkMeal({ meal: { name: 'Poha with Peanuts', calories: 560 }, slot: 'breakfast', diet: 'vegetarian', dailyTarget: 2000 });
  assert.equal(ok.ok, true, JSON.stringify(ok));
});

test('regional exceptions are not flagged: sabudana khichdi at breakfast, biryani at lunch', () => {
  assert.equal(checkMeal({ meal: { name: 'Sabudana Khichdi', calories: 560 }, slot: 'breakfast', diet: 'vegetarian', dailyTarget: 2000 }).ok, true);
  assert.equal(checkMeal({ meal: { name: 'Veg Biryani with Raita', calories: 800 }, slot: 'lunch', diet: 'vegetarian', dailyTarget: 2000 }).ok, true);
});

test('a 900 kcal breakfast is flagged by calories even if the dish looks fine', () => {
  const r = checkMeal({ meal: { name: 'Poha', calories: 900 }, slot: 'breakfast', diet: 'vegetarian', dailyTarget: 2000 });
  assert.ok(r.soft.some((x) => /outside the/.test(x)));
});

test('dish names carrying the user\'s city, or menu decoration, are flagged and cleaned', () => {
  const location = { city: 'Alibag', state: 'Maharashtra' };
  const flagged = checkMeal({ meal: { name: 'Kolambi Pohe - Alibag Style' }, slot: 'breakfast', diet: 'non-vegetarian', location });
  assert.ok(flagged.soft.length >= 1);

  assert.equal(sanitizeMealName('Kolambi Pohe - Alibag Style', location), 'Kolambi Pohe');
  assert.equal(sanitizeMealName('Alibag Special Kachori', location), 'Kachori');
  assert.equal(sanitizeMealName('Dal Baati (Authentic Style)', location), 'Dal Baati');
  assert.equal(sanitizeMealName('Jaipur-style Poha', { city: 'Jaipur' }), 'Poha');
  assert.equal(sanitizeMealName('Moong Dal Chilla with Mint Chutney', location), 'Moong Dal Chilla with Mint Chutney');
  // a name that would be emptied is kept rather than lost
  assert.equal(sanitizeMealName('Alibag', location), 'Alibag');
});

test('non-Indian dishes are flagged', () => {
  const r = checkMeal({ meal: { name: 'Avocado Toast with Quinoa' }, slot: 'breakfast', diet: 'vegetarian' });
  assert.ok(r.soft.some((x) => /not an Indian home dish/.test(x)));
});

test('diet, Jain and exclusion breaches are HARD; routine problems are soft', () => {
  const r = checkMeal({
    meal: { name: 'Chicken Biryani', calories: 560, ingredients: ['rice', 'chicken'] },
    slot: 'breakfast', diet: 'vegetarian', dailyTarget: 2000,
  });
  assert.ok(r.hard.length >= 1);
  assert.ok(r.soft.length >= 1);
});

// ------------------------------------------------------------- calories ----

function planWithDays(totals) {
  const mk = (kcal) => ({ name: 'x', calories: kcal, protein: kcal / 20, carbs: kcal / 8, fats: kcal / 30, fiber: 5 });
  return {
    breakfast: totals.map((t) => mk(t * 0.28)),
    lunch: totals.map((t) => mk(t * 0.4)),
    dinner: totals.map((t) => mk(t * 0.32)),
  };
}
const sumDay = (plan, i) => plan.breakfast[i].calories + plan.lunch[i].calories + plan.dinner[i].calories;

test('a day UNDER target is scaled up — the old code only handled overshoot', () => {
  const plan = planWithDays([1700, 2000, 2000]);
  const { scaled } = normalizePlanCalories(plan, 2000);
  assert.deepEqual(scaled, [0]);
  assert.ok(Math.abs(sumDay(plan, 0) - 2000) < 2);
  assert.equal(plan.breakfast[1].calories, 2000 * 0.28, 'an on-target day is left alone');
});

test('a day OVER target is scaled down, and nutrients scale with the calories', () => {
  const plan = planWithDays([2600]);
  const fiberBefore = plan.lunch[0].fiber;
  normalizePlanCalories(plan, 2000);
  assert.ok(Math.abs(sumDay(plan, 0) - 2000) < 2);
  assert.ok(plan.lunch[0].fiber < fiberBefore);
});

test('a day too far off is reported, not faked', () => {
  const plan = planWithDays([1000]);
  const { scaled, unfixable } = normalizePlanCalories(plan, 2000);
  assert.deepEqual(scaled, []);
  assert.deepEqual(unfixable, [0]);
  assert.equal(findCalorieViolations(plan, 2000)[0].direction, 'under');
});

test('a single meal is rescaled onto its budget only when materially off', () => {
  const near = { calories: 410, protein: 20 };
  assert.equal(rescaleMealToCalories(near, 400).calories, 410);
  const far = { calories: 480, protein: 24 };
  assert.ok(Math.abs(rescaleMealToCalories(far, 400).calories - 400) < 1);
});

// ----------------------------------------------------------------- goal ----

test('stored goal spellings collapse to one canonical set', () => {
  assert.equal(normalizeGoal('maintenance'), 'maintain');
  assert.equal(normalizeGoal('health_improvement'), 'general_health');
  assert.equal(normalizeGoal('disease_management'), 'general_health');
  assert.equal(normalizeGoal('weight_gain'), 'weight_gain');
  assert.equal(normalizeGoal(undefined), 'general_health');
});

test('weight loss is a CEILING, weight gain a FLOOR — and they say so', () => {
  const loss = buildGoalInstructions({ goal: 'weight_loss', calories: 1700, tdee: 2200 });
  const gain = buildGoalInstructions({ goal: 'weight_gain', calories: 2700, tdee: 2200 });
  assert.ok(loss.includes('CEILING') && loss.includes('-500 kcal'));
  assert.ok(gain.includes('FLOOR') && gain.includes('+500 kcal'));
  assert.ok(!loss.includes('FLOOR') && !gain.includes('CEILING'));
});

test('the goal reaches the plan prompt with its numbers', () => {
  const { prompt } = dietRecommendationAI.buildPlanPrompts(
    baseUserData({ goal: 'muscle_gain', bmiGoal: 'muscle_gain', tdee: 2300, nutritionGoals: { dailyCalories: 2550, protein: 140, carbs: 300, fats: 70 } })
  );
  assert.ok(prompt.includes('GOAL = MUSCLE GAIN'));
  assert.ok(prompt.includes('2550 kcal'));
});

// -------------------------------------------------------------- catalog ----

test('reference dishes respect the diet, Jain and exclusions', () => {
  const vegan = getReferenceDishes({ state: 'Gujarat', diet: 'vegan' });
  const all = Object.values(vegan).flat().join(' | ').toLowerCase();
  assert.ok(!/paneer|curd|ghee|milk|egg|chicken|fish/.test(all), all);

  const jain = getReferenceDishes({ state: 'Punjab', diet: 'vegetarian', jain: true });
  const jainAll = Object.values(jain).flat().join(' | ').toLowerCase();
  assert.ok(!/aloo|onion|gobhi paratha.*mooli|mooli/.test(jainAll), jainAll);

  const veg = getReferenceDishes({ state: 'Kerala', diet: 'vegetarian' });
  assert.ok(!Object.values(veg).flat().join(' ').toLowerCase().match(/chicken|fish|egg/));

  const nonVeg = getReferenceDishes({ state: 'Kerala', diet: 'non-vegetarian' });
  assert.ok(Object.values(nonVeg).flat().join(' ').toLowerCase().match(/chicken|fish|egg/));
});

test('the catalog follows state, then region, then falls back to everyday staples', () => {
  const raj = getReferenceDishes({ state: 'Rajasthan', diet: 'vegetarian' });
  assert.ok(raj.breakfast.some((d) => /Bajra Roti/.test(d)));

  const legacy = getReferenceDishes({ region: 'south', diet: 'vegetarian' });
  assert.ok(legacy.breakfast.some((d) => /Idli|Dosa/.test(d)));

  const none = getReferenceDishes({ diet: 'vegetarian' });
  assert.ok(none.breakfast.length > 0 && none.lunch.length > 0 && none.dinner.length > 0);
});

test('every catalog dish passes the guards that will judge the model\'s output', () => {
  for (const state of ['Rajasthan', 'Gujarat', 'Maharashtra', 'Punjab', 'Bihar', 'West Bengal', 'Kerala', 'Tamil Nadu', 'Karnataka', 'Andhra Pradesh', 'Telangana', 'Madhya Pradesh', undefined]) {
    for (const diet of ['vegetarian', 'eggetarian', 'non-vegetarian']) {
      const dishes = getReferenceDishes({ state, diet });
      for (const [slot, list] of Object.entries(dishes)) {
        for (const name of list) {
          const r = checkMeal({ meal: { name }, slot, diet });
          assert.deepEqual([...r.hard, ...r.soft], [], `${state}/${diet}/${slot}: "${name}" would be rejected by our own guard`);
        }
      }
    }
  }
});

// ------------------------------------------------------- prompt content ----

test('location appears once in the plan prompt, and the city is a tie-breaker', () => {
  const { prompt } = dietRecommendationAI.buildPlanPrompts(baseUserData({ state: 'Rajasthan', city: 'Jaipur' }));
  assert.equal(prompt.split('STATE FOCUS').length - 1, 1, 'STATE FOCUS duplicated');
  assert.equal(prompt.split('CITY FOCUS').length - 1, 1, 'CITY FOCUS duplicated');
  assert.ok(prompt.includes('tie-breaker only'));
  assert.ok(prompt.includes('NEVER put the city or state name in a dish name'));
});

test('the plan prompt carries slot budgets, slot guidance and the reference dishes', () => {
  const { prompt } = dietRecommendationAI.buildPlanPrompts(baseUserData({ state: 'Rajasthan' }));
  assert.ok(prompt.includes('CALORIE BUDGET PER SLOT'));
  assert.ok(prompt.includes('560 kcal'));
  assert.ok(prompt.includes('BREAKFAST = a light-to-moderate morning tiffin'));
  assert.ok(prompt.includes('NEVER for breakfast: biryani'));
  assert.ok(prompt.includes('REFERENCE DISHES'));
  assert.ok(prompt.includes('Bajra Roti'));
});

test('the old non-Indian examples are gone from the preference rule', () => {
  const { prompt } = dietRecommendationAI.buildPlanPrompts(baseUserData());
  assert.ok(!prompt.includes('Avocado Toast'));
  assert.ok(!prompt.includes('Toast with Dal'));
});

test('the caller\'s promptExtension is still appended', () => {
  const { prompt } = dietRecommendationAI.buildPlanPrompts(baseUserData(), 'OCCASION CONTEXT: Navratri');
  assert.ok(prompt.includes('OCCASION CONTEXT: Navratri'));
});

// ---------------------------------------------------------- the pipeline ----

function mockPlan(overrides = {}) {
  const meal = (name, kcal) => ({ name, description: 'd', portionSize: '1 bowl', ingredients: ['x'], calories: kcal, protein: 20, carbs: 60, fats: 15 });
  const breakfasts = ['Poha with Peanuts', 'Vegetable Upma', 'Besan Chilla with Curd', 'Idli with Sambar', 'Methi Paratha with Curd', 'Moong Dal Chilla', 'Vegetable Dalia'];
  const lunches = ['Roti, Dal and Bhindi Sabzi', 'Rajma Chawal', 'Chole with Roti', 'Kadhi Chawal', 'Palak Paneer with Roti', 'Moong Dal Khichdi with Curd', 'Lauki Chana Dal with Roti'];
  const dinners = ['Roti with Lauki Sabzi and Dal', 'Dal Palak with Roti', 'Paneer Bhurji with Roti', 'Tinda Sabzi with Roti', 'Vegetable Dalia Khichdi', 'Masoor Dal with Roti', 'Bhindi Masala with Roti'];
  return {
    dailyCalorieTarget: 2000,
    mealPlan: {
      breakfast: breakfasts.map((n) => meal(n, 560)),
      lunch: lunches.map((n) => meal(n, 800)),
      dinner: dinners.map((n) => meal(n, 640)),
      ...overrides,
    },
  };
}

/** Stub the model: whole-plan prompts get `planResponses`, single-meal prompts get `mealResponses`, in order. */
async function withStubbedModel({ planResponses = [], mealResponses = [] }, fn) {
  const original = dietRecommendationAI.makeAIRequest;
  const calls = { plan: 0, meal: 0, prompts: [] };
  dietRecommendationAI.makeAIRequest = async (payload) => {
    const content = payload.messages[0].content;
    calls.prompts.push(content);
    if (content.includes('7 daily options')) {
      const r = planResponses[Math.min(calls.plan++, planResponses.length - 1)];
      return JSON.stringify(r);
    }
    const r = mealResponses[Math.min(calls.meal++, mealResponses.length - 1)];
    return JSON.stringify(r);
  };
  try {
    return await fn(calls);
  } finally {
    dietRecommendationAI.makeAIRequest = original;
  }
}

test('a clean plan costs exactly one model call', async () => {
  await withStubbedModel({ planResponses: [mockPlan()] }, async (calls) => {
    const out = await dietRecommendationAI.generatePersonalizedDietPlan(baseUserData({ state: 'Rajasthan', city: 'Jaipur' }));
    assert.equal(calls.plan, 1);
    assert.equal(calls.meal, 0);
    assert.equal(out.mealPlan.breakfast.length, 7);
  });
});

test('decorated names are cleaned for free, with no repair call', async () => {
  const plan = mockPlan();
  plan.mealPlan.breakfast[0].name = 'Poha with Peanuts - Jaipur Style';
  await withStubbedModel({ planResponses: [plan] }, async (calls) => {
    const out = await dietRecommendationAI.generatePersonalizedDietPlan(baseUserData({ state: 'Rajasthan', city: 'Jaipur' }));
    assert.equal(out.mealPlan.breakfast[0].name, 'Poha with Peanuts');
    assert.equal(calls.meal, 0, 'a cosmetic fix must not cost a model call');
  });
});

test('a biryani breakfast is repaired in place with ONE single-meal call, not a whole new plan', async () => {
  const plan = mockPlan();
  plan.mealPlan.breakfast[2].name = 'Veg Biryani with Raita';
  const replacement = { name: 'Besan Chilla with Green Chutney', description: 'd', portionSize: '2 chilla', ingredients: ['besan'], calories: 560, protein: 22, carbs: 50, fats: 14 };
  await withStubbedModel({ planResponses: [plan], mealResponses: [replacement] }, async (calls) => {
    const out = await dietRecommendationAI.generatePersonalizedDietPlan(baseUserData());
    assert.equal(calls.plan, 1);
    assert.equal(calls.meal, 1);
    assert.equal(out.mealPlan.breakfast[2].name, 'Besan Chilla with Green Chutney');
    assert.equal(out.mealPlan.breakfast[1].name, 'Vegetable Upma', 'other meals are untouched');
  });
});

test('a Jain violation in a Jain-diet plan is repaired', async () => {
  const plan = mockPlan();
  plan.mealPlan.breakfast[0].name = 'Aloo Paratha with Curd';
  const replacement = { name: 'Methi Thepla with Curd', ingredients: ['atta', 'methi'], calories: 560, protein: 15, carbs: 60, fats: 15 };
  await withStubbedModel({ planResponses: [plan], mealResponses: [replacement] }, async () => {
    const out = await dietRecommendationAI.generatePersonalizedDietPlan(
      baseUserData({ dietaryPreference: 'jain', foodPreferences: {} })
    );
    assert.equal(out.mealPlan.breakfast[0].name, 'Methi Thepla with Curd');
  });
});

test('the SAME plan is accepted for a non-veg user whose Jain tag is stale', async () => {
  // Aloo Paratha is only wrong because of Jain; once the user is non-veg the
  // stale tag is ignored and the dish stands. This is the Jain -> non-veg bug.
  const plan = mockPlan();
  plan.mealPlan.breakfast[0].name = 'Aloo Paratha with Curd';
  await withStubbedModel({ planResponses: [plan] }, async (calls) => {
    const out = await dietRecommendationAI.generatePersonalizedDietPlan(
      baseUserData({ dietaryPreference: 'non-vegetarian', foodPreferences: { dietaryRestrictions: ['Jain'] } })
    );
    assert.equal(calls.meal, 0);
    assert.equal(out.mealPlan.breakfast[0].name, 'Aloo Paratha with Curd');
  });
});

test('a hard violation that cannot be repaired fails the plan instead of shipping it', async () => {
  const plan = mockPlan();
  plan.mealPlan.lunch[3].name = 'Chicken Curry with Roti';
  const stillBad = { name: 'Egg Curry with Rice', calories: 800, protein: 20, carbs: 60, fats: 20 };
  await withStubbedModel({ planResponses: [plan], mealResponses: [stillBad] }, async () => {
    await assert.rejects(
      dietRecommendationAI.generatePersonalizedDietPlan(baseUserData({ dietaryPreference: 'vegetarian' })),
      /hard constraints/
    );
  });
});

test('the single-meal prompt now has the naming rule, the routine rule and the goal', async () => {
  const meal = { name: 'Poha with Peanuts', calories: 560, protein: 12, carbs: 70, fats: 14 };
  await withStubbedModel({ mealResponses: [meal] }, async (calls) => {
    await dietRecommendationAI.regenerateSingleMeal({
      mealType: 'breakfast', remainingCalories: 560, avoidNames: [],
      userData: { dietaryPreference: 'vegetarian', state: 'Gujarat', city: 'Surat', goal: 'weight_loss', dailyCalories: 1700, foodPreferences: {} },
    });
    const p = calls.prompts[0];
    assert.ok(p.includes('DISH NAMING (MANDATORY)'));
    assert.ok(p.includes('BREAKFAST = a light-to-moderate morning tiffin'));
    assert.ok(p.includes('GOAL = WEIGHT LOSS'));
    assert.ok(p.includes('Typical everyday breakfast dishes'));
  });
});

// ---------------------------------------------------------------- helpers --

function baseUserData(overrides = {}) {
  return {
    age: 30, gender: 'male', weight: 70, height: 172, currentBMI: '23.7',
    bmiGoal: 'maintain', goal: 'maintain', tdee: 2000, activityLevel: 'moderately_active',
    dietaryPreference: 'vegetarian',
    country: 'India', region: 'other', state: null, city: null,
    allergies: [], medicalConditions: [], diabetesInfo: null,
    nutritionGoals: { dailyCalories: 2000, protein: 100, carbs: 250, fats: 65 },
    foodPreferences: {},
    lifestyle: {},
    ...overrides,
  };
}
