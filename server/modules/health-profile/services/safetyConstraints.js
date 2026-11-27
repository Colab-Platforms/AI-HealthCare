// Safety constraints: what every feature must respect for this user, built
// ONCE from HealthProfile (26 Nov). Meal plans, the coach and exercise
// guidance read this instead of each re-deriving rules from raw fields.
//
//   buildSafetyConstraints(healthProfile)  pure
//   getSafetyConstraints(userId)           reads HealthProfile (cached)
//   foodRulesText(c) / exerciseRulesText(c) one prompt-ready block each
//
// Rules here are general, conservative guidance (never doses, never
// diagnosis); anything medical is phrased as "per doctor". Unknown medicine
// or condition names simply add no rule.

const ACTIVE = (c) => c && c.status !== 'resolved';
const names = (list, key = 'name') => ((list && list.items) || []).map((i) => String(i[key] || '').trim()).filter(Boolean);
const uniq = (arr) => [...new Map(arr.filter(Boolean).map((x) => [String(x).toLowerCase(), x])).values()];

// condition name -> food rule / exercise rule
const CONDITION_RULES = [
    { re: /diabet|prediabet|blood sugar|hba1c|\bsugar\b|t[12]\s?dm|\bdm\b|insulin resist/i, key: 'diabetes',
        food: 'diabetes: no added sugar or sweets, limit refined carbs (maida, white rice portions), prefer low-GI whole grains, dal, vegetables; spread carbs across meals',
        exercise: 'diabetes: avoid exercising on an empty stomach if on insulin or sulfonylureas; keep a quick sugar source handy' },
    { re: /hypertens|high\s*(bp|blood\s*pressure)|\bbp\b/i, key: 'hypertension',
        food: 'high BP: low salt (under 5 g/day), avoid pickles, papad, namkeen, processed foods',
        exercise: 'high BP: no heavy straining or breath-holding lifts; moderate intensity' },
    { re: /kidney|ckd|renal/i, key: 'kidney',
        food: 'kidney disease: protein, potassium, phosphorus and salt only as the doctor advises; no high-protein diets or potassium salt substitutes',
        exercise: null },
    { re: /cholesterol|ldl|lipid|triglycer/i, key: 'cholesterol',
        food: 'high cholesterol: limit fried food, ghee / butter / vanaspati and red meat; more fibre (oats, dal, vegetables)',
        exercise: null },
    { re: /gout|uric acid/i, key: 'gout',
        food: 'gout / high uric acid: limit organ meat, red meat, shellfish and alcohol; drink plenty of water',
        exercise: null },
    { re: /fatty liver|nafld/i, key: 'fatty_liver',
        food: 'fatty liver: no alcohol, limit sugar and fried food',
        exercise: null },
    { re: /heart(?!\s*burn)|cardiac|coronary|angina|\bcad\b|stent|bypass|stroke/i, key: 'heart',
        food: 'heart disease: low salt, limit saturated fat and fried food',
        exercise: 'heart disease: no high-intensity exercise unless the cardiologist cleared it; stop at chest pain, breathlessness or dizziness' },
    { re: /hypothyroid|thyroid/i, key: 'thyroid',
        food: 'thyroid: keep soy and very high-fibre foods away from the thyroid tablet time',
        exercise: null },
    { re: /celiac|coeliac/i, key: 'celiac',
        food: 'celiac: strictly no gluten (wheat, atta, maida, suji, barley, rye)',
        exercise: null },
    { re: /\bgut\b|\bibs\b|acidity|gerd|reflux|heart\s*burn|gastritis|ulcer|bloat|indigestion|colitis|crohn/i, key: 'gut',
        food: 'acidity / gut issues: avoid very spicy, oily and late heavy meals',
        exercise: null },
    { re: /asthma|copd/i, key: 'asthma',
        food: null,
        exercise: 'asthma: warm up slowly, keep the inhaler handy, avoid exercise in cold or polluted air' },
    { re: /arthritis|osteoarthritis|knee pain|joint/i, key: 'joints',
        food: null,
        exercise: 'joint problems: low-impact only (walking, cycling, swimming); no jumping or deep squats' },
    { re: /epilep|seizure/i, key: 'epilepsy',
        food: null,
        exercise: 'epilepsy: no solo swimming or exercise at heights' },
    { re: /pcos|pcod|polycystic/i, key: 'pcos',
        food: 'PCOS: limit sugar and refined carbs, protein with each meal',
        exercise: null },
    { re: /anaemi|anemi/i, key: 'anaemia',
        food: 'anaemia: iron-rich foods with vitamin C; keep tea / coffee away from meals',
        exercise: 'anaemia: lighter intensity, stop if dizzy or very breathless' },
    { re: /osteopor|osteopen|low bone density/i, key: 'osteoporosis',
        food: 'low bone density: calcium (milk, curd, paneer, ragi) and vitamin D sources daily',
        exercise: 'low bone density: no high-impact, contact sports or deep forward bending under load; walking and light strength are good' },
    { re: /hernia/i, key: 'hernia',
        food: null,
        exercise: 'hernia: no heavy lifting or straining (breath-holding), no crunches' },
    { re: /retinopath|glaucoma|retinal detach/i, key: 'eye',
        food: null,
        exercise: 'eye condition: no heavy straining lifts, no head-down yoga poses, no contact sports' },
];

// medicine name -> food interaction (general guidance; never a dose).
const MEDICATION_RULES = [
    { re: /warfarin|acitrom|acenocoumarol/i, rule: 'blood thinner: keep leafy greens (vitamin K) steady day to day, no sudden big changes; avoid alcohol' },
    { re: /metformin/i, rule: 'metformin: limit alcohol' },
    { re: /insulin|glimepiride|gliclazide|glibenclamide|glipizide/i, rule: 'insulin / sulfonylurea: never skip or delay meals; avoid alcohol on an empty stomach' },
    { re: /amlodipine|felodipine|nifedipine|atorvastatin|simvastatin|lovastatin/i, rule: 'BP / cholesterol tablet: avoid grapefruit and grapefruit juice' },
    { re: /levothyroxine|thyroxine|thyronorm|eltroxin/i, rule: 'thyroid tablet: empty stomach; keep tea / coffee, soy, calcium and iron 30-60 min away' },
    { re: /enalapril|ramipril|lisinopril|telmisartan|losartan|spironolactone/i, rule: 'this BP medicine: no potassium salt substitutes, no potassium supplements without the doctor' },
    { re: /\biron\b|ferrous/i, rule: 'iron supplement: keep tea / coffee / milk away by 1-2 hours' },
    { re: /statin/i, rule: 'statin: limit alcohol' },
];

function activeConditionNames(hp) {
    return ((hp && hp.conditions && hp.conditions.items) || []).filter(ACTIVE).map((c) => c.name).filter(Boolean);
}

function buildSafetyConstraints(hp, { age } = {}) {
    const p = hp || {};
    const conditions = activeConditionNames(p);
    const diabetesDetail = p.diabetes && p.diabetes.type ? [`Diabetes ${p.diabetes.type}`] : [];
    const matched = (re) => [...conditions, ...diabetesDetail].some((n) => re.test(n));
    const condRules = CONDITION_RULES.filter((r) => matched(r.re));
    const meds = ((p.medications && p.medications.items) || []).filter((m) => m.active !== false).map((m) => m.name).filter(Boolean);
    const medRules = MEDICATION_RULES.filter((r) => meds.some((m) => r.re.test(m))).map((r) => r.rule);
    const d = p.diet || {};
    const injuries = ((p.fitness && p.fitness.limitations) || []).filter((x) => x && x !== 'none');
    const disabilities = ((p.disabilities && p.disabilities.items) || []).map((x) => [x.name, x.aid && `uses ${x.aid}`].filter(Boolean).join(', '));
    const ageNow = Number(age ?? (p.basic && p.basic.age)) || null;

    return {
        food: {
            allergens: names(p.allergies, 'allergen'),
            allergiesKnown: Boolean(p.allergies && p.allergies.state && p.allergies.state !== 'missing'),
            intolerances: names(p.intolerances),
            dietType: d.preference || null,
            restrictions: uniq([...(d.restrictions || []), ...(d.dietaryRestrictions || [])]),
            avoid: uniq([...(d.dislikes || []), ...(d.dietaryDont || [])]),
            conditionRules: condRules.map((r) => r.food).filter(Boolean),
            medicationRules: uniq(medRules),
        },
        exercise: {
            injuries,
            disabilities,
            conditionRules: condRules.map((r) => r.exercise).filter(Boolean),
            olderAdult: ageNow != null && ageNow >= 65,
        },
        conditionKeys: condRules.map((r) => r.key),
    };
}

// One block for a meal / food prompt. Empty string when there is nothing to say.
function foodRulesText(c) {
    if (!c) return '';
    const f = c.food;
    const lines = [];
    if (f.allergens.length) lines.push(`ALLERGIES (never include, also hidden in sauces / spice mixes / garnish): ${f.allergens.join(', ')}`);
    else if (!f.allergiesKnown) lines.push('Allergies: not known yet (avoid suggesting common allergens as the main ingredient without saying so)');
    if (f.intolerances.length) lines.push(`INTOLERANCES (avoid, or use a tolerated version, e.g. lactose-free): ${f.intolerances.join(', ')}`);
    if (f.restrictions.length) lines.push(`RESTRICTIONS (religious / personal, must follow): ${f.restrictions.join(', ')}`);
    if (f.avoid.length) lines.push(`DOES NOT WANT: ${f.avoid.join(', ')}`);
    for (const r of f.conditionRules) lines.push(`CONDITION: ${r}`);
    for (const r of f.medicationRules) lines.push(`MEDICINE-FOOD: ${r}`);
    return lines.join('\n');
}

function exerciseRulesText(c) {
    if (!c) return '';
    const e = c.exercise;
    const lines = [];
    if (e.injuries.length) lines.push(`INJURIES / LIMITATIONS (no exercise that loads them): ${e.injuries.join(', ')}`);
    if (e.disabilities.length) lines.push(`PHYSICAL DISABILITIES (adapted options only: seated / supported / low-impact): ${e.disabilities.join('; ')}`);
    for (const r of e.conditionRules) lines.push(`CONDITION: ${r}`);
    if (e.olderAdult) lines.push('AGE 65+: low-impact, balance work, longer warm-up');
    return lines.join('\n');
}

async function getSafetyConstraints(userId, deps) {
    const { loadProfile } = require('./profileReadService');
    return buildSafetyConstraints(await loadProfile(userId, deps));
}

// Exercise precautions as a list of lines ([] when none, or when the profile
// can't be read: an additive field must never fail a response).
async function exercisePrecautions(userId, deps) {
    try {
        return exerciseRulesText(await getSafetyConstraints(userId, deps)).split('\n').filter(Boolean);
    } catch {
        return [];
    }
}

module.exports = { buildSafetyConstraints, getSafetyConstraints, foodRulesText, exerciseRulesText, exercisePrecautions, CONDITION_RULES, MEDICATION_RULES };
