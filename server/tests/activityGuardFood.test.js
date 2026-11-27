// Activity guard (27 Nov): food / 7-day plan / supplement / goal rules.
const { test } = require('node:test');
const assert = require('node:assert');

const F = require('../modules/health-profile/services/activityGuard/foodRules');
const P = require('../modules/health-profile/services/activityGuard/planCheck');
const S = require('../modules/health-profile/services/activityGuard/supplementRules');
const G = require('../modules/health-profile/services/activityGuard/goalRules');
const { createActivityGuard, composeMessage } = require('../modules/health-profile/services/activityGuard/guardService');
const { CONDITION_RULES } = require('../modules/health-profile/services/safetyConstraints');

const items = (key, ...names) => ({ items: names.map((n) => ({ [key]: n, status: 'active', active: true })) });
const codes = (alerts) => alerts.map((a) => a.code);

// ── shared condition matching ──────────────────────────────────────────────
test('heartburn is a gut issue, not heart disease (shared regex fix)', () => {
    const keys = (name) => CONDITION_RULES.filter((r) => r.re.test(name)).map((r) => r.key);
    assert.ok(!keys('heartburn').includes('heart'));
    assert.ok(keys('heartburn').includes('gut'));
    assert.ok(keys('heart attack 2019').includes('heart'));
    assert.ok(keys('T2DM').includes('diabetes'));
});

// ── food ───────────────────────────────────────────────────────────────────
const hpFood = {
    diet: { preference: 'vegetarian', dislikes: ['karela'], restrictions: ['no beef'] },
    allergies: { items: [{ allergen: 'Peanuts', type: 'food' }, { allergen: 'Penicillin', type: 'drug' }] },
    intolerances: items('name', 'lactose'),
    conditions: items('name', 'Type 2 Diabetes', 'Hypertension'),
    medications: items('name', 'Warfarin 5mg'),
};

test('meal: allergy (important first), diet clash, intolerance, medicine-food', () => {
    const a = F.checkMeal({ dishes: [{ name: 'Chicken Biryani' }, { name: 'Peanut chikki' }, { name: 'Paneer tikka' }, { name: 'Palak dal' }] }, F.foodFacts(hpFood));
    assert.strictEqual(a[0].code, 'meal_allergy');
    assert.strictEqual(a[0].level, 'important');
    for (const c of ['meal_diet_clash', 'meal_intolerance', 'meal_vitk_warfarin']) assert.ok(codes(a).includes(c), c);
});

test('meal: allergen hidden in ingredients is caught', () => {
    const a = F.checkMeal({ dishes: [{ name: 'Veg pulao', ingredients: ['rice', 'groundnut oil'] }] }, F.foodFacts(hpFood));
    assert.ok(codes(a).includes('meal_allergy'));
});

test('meal: drug allergy (penicillin) never matches food', () => {
    const a = F.checkMeal({ dishes: [{ name: 'Penicillin' }] }, F.foodFacts({ allergies: { items: [{ allergen: 'Penicillin', type: 'drug' }] } }));
    assert.deepStrictEqual(a, []);
});

test('meal: plain dal-roti for this user -> nothing', () => {
    assert.deepStrictEqual(F.checkMeal({ dishes: [{ name: 'Moong dal khichdi' }, { name: 'Roti' }], meal: { sugar: 3, sodium: 400 }, day: { sugar: 10, sodium: 900 } }, F.foodFacts(hpFood)), []);
});

test('meal: day totals -> diabetes sugar and BP salt', () => {
    const a = F.checkMeal({ dishes: [{ name: 'Rice' }], meal: { sugar: 5, sodium: 300 }, day: { sugar: 62, sodium: 2600 } }, F.foodFacts(hpFood));
    assert.ok(codes(a).includes('meal_sugar_diabetes'));
    assert.ok(codes(a).includes('meal_sodium'));
    assert.match(a.find((x) => x.code === 'meal_sodium').text.english, /2,?600|2600/);
});

test('meal: no diabetes -> no sugar note even at high sugar', () => {
    assert.deepStrictEqual(F.checkMeal({ dishes: [{ name: 'Gulab jamun' }], meal: { sugar: 60 } }, F.foodFacts({})), []);
});

test('meal: vegan + paneer; eggetarian + egg ok; jain + aloo; restriction', () => {
    assert.ok(codes(F.checkMeal({ dishes: [{ name: 'Paneer tikka' }] }, F.foodFacts({ diet: { preference: 'vegan' } }))).includes('meal_diet_clash'));
    assert.deepStrictEqual(F.checkMeal({ dishes: [{ name: 'Egg curry' }] }, F.foodFacts({ diet: { preference: 'eggetarian' } })), []);
    assert.ok(codes(F.checkMeal({ dishes: [{ name: 'Aloo paratha' }] }, F.foodFacts({ diet: { preference: 'jain' } }))).includes('meal_jain'));
    assert.ok(codes(F.checkMeal({ dishes: [{ name: 'Beef fry' }] }, F.foodFacts({ diet: { preference: 'non-vegetarian', restrictions: ['no beef'] } }))).includes('meal_restriction'));
});

test('meal: celiac + roti important; alcohol + metformin', () => {
    const c = F.checkMeal({ dishes: [{ name: 'Roti' }] }, F.foodFacts({ conditions: items('name', 'Celiac disease') }));
    assert.strictEqual(c[0].code, 'meal_celiac');
    assert.ok(codes(F.checkMeal({ dishes: [{ name: 'Beer' }] }, F.foodFacts({ medications: items('name', 'Metformin 500') }))).includes('meal_alcohol_med'));
});

// ── 7-day plan ─────────────────────────────────────────────────────────────
const plan = () => ({
    breakfast: [{ name: 'Poha' }, { name: 'Peanut chikki and milk' }, { name: 'Upma' }, { name: 'Idli' }, { name: 'Dosa' }, { name: 'Oats' }, { name: 'Besan chilla' }],
    lunch: [{ name: 'Dal rice' }, { name: 'Rajma chawal' }, { name: 'Chicken curry' }, { name: 'Chole' }, { name: 'Sambar rice' }, { name: 'Kadhi' }, { name: 'Veg pulao' }],
    dinner: [{ name: 'Roti sabzi' }],
});

test('plan: checkPlan finds the allergy and the non-veg day with day + slot', () => {
    const issues = P.checkPlan(plan(), F.foodFacts(hpFood));
    assert.ok(issues.some((i) => i.slot === 'breakfast' && i.dayIndex === 1 && i.code === 'meal_allergy'));
    assert.ok(issues.some((i) => i.slot === 'lunch' && i.dayIndex === 2 && i.code === 'meal_diet_clash'));
});

test('plan: fixPlan swaps blocking dishes for the nearest clean day, leaves the rest', () => {
    const { mealPlan, fixed, remaining } = P.fixPlan(plan(), F.foodFacts({ ...hpFood, intolerances: { items: [] } }));
    assert.strictEqual(fixed.length, 2);
    assert.notStrictEqual(mealPlan.breakfast[1].name, 'Peanut chikki and milk');
    assert.notStrictEqual(mealPlan.lunch[2].name, 'Chicken curry');
    assert.strictEqual(mealPlan.breakfast[0].name, 'Poha');
    assert.deepStrictEqual(remaining.filter((r) => P.BLOCKING.has(r.code)), []);
});

test('plan: all options bad -> kept and flagged, not deleted', () => {
    const { mealPlan, fixed, remaining } = P.fixPlan({ dinner: [{ name: 'Chicken curry' }, { name: 'Fish fry' }] }, F.foodFacts({ diet: { preference: 'vegetarian' } }));
    assert.strictEqual(fixed.length, 0);
    assert.strictEqual(mealPlan.dinner.length, 2);
    assert.strictEqual(remaining.length, 2);
});

test('plan: alerts group by problem and say where', () => {
    const issues = P.checkPlan(plan(), F.foodFacts(hpFood));
    const alerts = P.planAlerts({ issues, fixed: [{ slot: 'lunch', dayIndex: 2, from: 'x', to: 'y' }] });
    assert.strictEqual(alerts[0].code, 'plan_allergy');
    assert.match(alerts[0].text.english, /^Day 2 breakfast:/);
    assert.ok(codes(alerts).includes('plan_fixed'));
});

test('plan: DB-style options (items[]) are checked by item name', () => {
    const issues = P.checkPlan({ lunch: [{ items: [{ name: 'Chicken curry' }, { name: 'Rice' }] }] }, F.foodFacts({ diet: { preference: 'vegetarian' } }));
    assert.strictEqual(issues[0].code, 'meal_diet_clash');
});

// ── supplements ────────────────────────────────────────────────────────────
test('supplement: fish oil + warfarin -> bleeding; + fish allergy -> important', () => {
    const f = S.supplementFacts({ medications: items('name', 'Warfarin'), allergies: { items: [{ allergen: 'fish' }] } });
    const a = S.checkSupplement({ name: 'Fish Oil 1000mg' }, f);
    assert.strictEqual(a[0].code, 'sup_allergy');
    assert.ok(codes(a).includes('sup_bleeding'));
});

test('supplement: calcium + thyroxine timing; biotin note; potassium + ramipril important', () => {
    const f = S.supplementFacts({ medications: items('name', 'Thyronorm 50', 'Ramipril 5') });
    assert.ok(codes(S.checkSupplement({ name: 'Calcium + D3' }, f)).includes('sup_thyroid_timing'));
    assert.match(S.checkSupplement({ name: 'Biotin' }, f)[0].text.english, /thyroid blood test/);
    const k = S.checkSupplement({ name: 'Potassium citrate' }, f);
    assert.strictEqual(k[0].code, 'sup_potassium');
    assert.strictEqual(k[0].level, 'important');
});

test('supplement: vegetarian + softgel form; nothing for a plain vitamin C', () => {
    const f = S.supplementFacts({ diet: { preference: 'vegetarian' } });
    assert.ok(codes(S.checkSupplement({ name: 'Vitamin D3', ingredients: ['softgel'] }, f)).includes('sup_diet'));
    assert.deepStrictEqual(S.checkSupplement({ name: 'Vitamin C' }, S.supplementFacts({ medications: items('name', 'Metformin') })), []);
});

test('supplement: berberine + insulin (via diabetes section)', () => {
    const f = S.supplementFacts({ diabetes: { medicationType: ['Insulin'] } });
    assert.ok(codes(S.checkSupplement({ name: 'Berberine' }, f)).includes('sup_sugar_lowering'));
});

// ── goals ──────────────────────────────────────────────────────────────────
test('goal: underweight target, eating disorder (important first), hypo meds', () => {
    const hp = { mentalHealth: items('name', 'Binge eating disorder'), medications: items('name', 'Glimepiride 2') };
    const a = G.checkGoal({ goalType: 'weight_loss', currentWeight: 60, targetWeight: 45, height: 170, age: 30 }, hp);
    assert.strictEqual(a[0].level, 'important');
    for (const c of ['goal_eating_disorder', 'goal_underweight_target', 'goal_hypo_meds']) assert.ok(codes(a).includes(c), c);
});

test('goal: fast loss with diabetes; teen; 65+; kidney + muscle gain; very low calories', () => {
    const dia = { conditions: items('name', 'Type 2 diabetes') };
    assert.ok(codes(G.checkGoal({ goalType: 'weight_loss', targetWeight: 70, height: 170, weeklyRateKg: 1 }, dia)).includes('goal_fast_with_condition'));
    assert.ok(codes(G.checkGoal({ goalType: 'weight_loss', targetWeight: 55, height: 165, age: 15 }, {})).includes('goal_teen_loss'));
    assert.ok(codes(G.checkGoal({ goalType: 'weight_loss', targetWeight: 65, height: 165, age: 70 }, {})).includes('goal_older_loss'));
    assert.ok(codes(G.checkGoal({ goalType: 'muscle_gain', targetWeight: 75, height: 175 }, { conditions: items('name', 'CKD stage 2') })).includes('goal_kidney_protein'));
    assert.ok(codes(G.checkGoal({ goalType: 'weight_loss', targetWeight: 60, height: 165, dailyCalorieTarget: 1100, gender: 'female' }, {})).includes('goal_very_low_calories'));
});

test('goal: healthy maintain goal -> nothing', () => {
    assert.deepStrictEqual(G.checkGoal({ goalType: 'maintain', targetWeight: 70, height: 175, age: 30, dailyCalorieTarget: 2200 }, {}), []);
});

// ── guard wiring per kind ──────────────────────────────────────────────────
function deps(profile, state = null) {
    const box = { state, claims: [] };
    return {
        box,
        loadProfile: async () => profile,
        loadSymptoms: async () => [],
        loadState: async () => box.state,
        claim: async (id, arg) => { box.claims.push(arg); box.state = { ...(box.state || {}), alertLog: [...(box.state?.alertLog || []), ...arg.entries] }; return true; },
        coachAvailable: async () => true,
    };
}
const user = { _id: 'u1', name: 'Asha Rao' };

test('guard: scan (precheck) opens the coach only for important alerts', async () => {
    const d = deps(hpFood);
    const g = createActivityGuard(d);
    const caution = await g.checkMeal(user, { dishes: [{ name: 'Paneer tikka' }] }, { mode: 'precheck' });
    assert.ok(caution.alerts.length);
    assert.strictEqual(caution.coach, null);
    const allergy = await g.checkMeal(user, { dishes: [{ name: 'Peanut chikki' }] }, { mode: 'precheck' });
    assert.match(allergy.coach.text, /^Asha, before you eat this/);
});

test('guard: logged meal opens for caution too, with the meal label', async () => {
    const r = await createActivityGuard(deps(hpFood)).checkMeal(user, { mealType: 'lunch', dishes: [{ name: 'Paneer tikka' }] }, { mode: 'logged' });
    assert.match(r.coach.text, /^Asha, Lunch is logged/);
});

test('guard: plan note goes out once per plan, a new plan can speak again', async () => {
    const d = deps(hpFood);
    const g = createActivityGuard(d);
    const alerts = P.planAlerts({ issues: P.checkPlan(plan(), F.foodFacts(hpFood)) });
    assert.ok((await g.checkPlan(user, { planId: 'p1', alerts })).coach);
    assert.strictEqual((await g.checkPlan(user, { planId: 'p1', alerts })).coach, null);
    assert.ok((await g.checkPlan(user, { planId: 'p2', alerts })).coach);
    assert.strictEqual(d.box.claims[0].activityAlert.kind, 'meal_plan');
});

test('guard: supplement added and goal set use their own intros', async () => {
    const g = createActivityGuard(deps({ medications: items('name', 'Warfarin'), mentalHealth: items('name', 'anorexia') }));
    assert.match((await g.checkSupplement(user, { name: 'Fish oil' })).coach.text, /^Asha, Fish oil is added to your routine/);
    assert.match((await g.checkGoal(user, { goalType: 'weight_loss', targetWeight: 60, height: 165 })).coach.text, /^Asha, your goal is set/);
});

test('composeMessage: review intro (plan) in Hinglish', () => {
    assert.match(composeMessage({ alerts: [{ message: 'x' }], label: '7-day meal plan', mode: 'review', kind: 'meal_plan', language: 'hinglish', firstName: '' }), /^aapke 7-day meal plan ke baare mein ek zaroori baat/);
});

test('supplement: shellfish allergy is not a fish allergy (fish oil ok), but krill / glucosamine flagged', () => {
    const f = S.supplementFacts({ allergies: { items: [{ allergen: 'Shellfish' }] } });
    assert.ok(!codes(S.checkSupplement({ name: 'Fish oil' }, f)).includes('sup_allergy'));
    assert.ok(codes(S.checkSupplement({ name: 'Glucosamine' }, f)).includes('sup_allergy'));
    assert.ok(codes(S.checkSupplement({ name: 'Krill oil' }, f)).includes('sup_allergy'));
});
