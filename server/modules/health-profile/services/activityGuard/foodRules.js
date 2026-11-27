// Food x health profile rules (27 Nov). Pure and synchronous. One file for
// every food screen, so a logged meal, a scanned plate and a 7-day plan are
// judged the same way:
//
//   const facts = foodFacts(healthProfile);
//   dishViolations(dish, facts)        -> [{ code, level, detail }]   (identity: allergy, diet, restriction ...)
//   checkMeal({ dishes, meal, day }, facts, { mode }) -> alerts with text (identity + numbers for the day)
//
// Dish names are read with the food DB's own classifier (services/foodDb/
// classify.js: allergens + veg / egg / non-veg from a name) and condition
// matching is shared (safetyConstraints), so nothing here re-invents either.

const { allergensFromName, dietTypeFromName } = require('../../../../services/foodDb/classify');
const { allergensInText } = require('../../../../services/foodDb/mealWarnings');
const { buildSafetyConstraints } = require('../safetyConstraints');

const NONE_TEXT = /^(none|no|nil|na|n\/a|nothing|none of these|other|-)$/i;
const AVOID_PREFIX = /^(no|avoid|avoiding|less|without|zero|limit|stop|skip|don'?t eat)\s+/i;
const clean = (arr) => [...new Set((arr || []).map((v) => String(v ?? '').trim()).filter((v) => v && !NONE_TEXT.test(v)))];
const padded = (t) => ` ${String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
const hasWord = (hay, term) => {
    const w = padded(term).trim();
    return w.length >= 3 && hay.includes(` ${w} `);
};

const ALLERGEN_LABEL = { milk: 'dairy', egg: 'egg', peanut: 'peanuts', tree_nuts: 'tree nuts', gluten: 'gluten', soy: 'soy', fish: 'fish', shellfish: 'shellfish', sesame: 'sesame', mustard: 'mustard' };
const JAIN_AVOID = ['onion', 'pyaz', 'pyaaz', 'garlic', 'lahsun', 'lehsun', 'potato', 'aloo', 'alu', 'carrot', 'gajar', 'beetroot', 'chukandar', 'radish', 'mooli', 'sweet potato', 'shakarkand', 'arbi'];
const LEAFY_GREENS = ['palak', 'spinach', 'saag', 'sarson', 'methi', 'fenugreek', 'kale', 'broccoli', 'bathua', 'cabbage', 'patta gobhi', 'lettuce'];
const GOUT_FOODS = ['mutton', 'lamb', 'goat', 'beef', 'pork', 'liver', 'kaleji', 'kidney', 'brain', 'bheja', 'prawn', 'prawns', 'shrimp', 'crab', 'lobster', 'sardine', 'anchovy', 'beer'];
const ALCOHOL = ['beer', 'wine', 'whisky', 'whiskey', 'vodka', 'rum', 'gin', 'alcohol', 'daru', 'sharab', 'cocktail', 'brandy', 'toddy', 'tequila'];
const GRAPEFRUIT = ['grapefruit', 'chakotra', 'pomelo'];

const MED = {
    vitK: /warfarin|acitrom|acenocoumarol/i,
    grapefruit: /amlodipine|felodipine|nifedipine|atorvastatin|simvastatin|lovastatin/i,
    alcohol: /metformin|insulin|glimepiride|gliclazide|glibenclamide|glipizide|warfarin|acitrom|metronidazole|flagyl|tinidazole|paracetamol|dolo|crocin/i,
};

// ── facts from the profile ──────────────────────────────────────────────────
function codedTerms(texts) {
    const codes = new Map(); // code -> the user's own words
    const free = [];
    for (const text of clean(texts)) {
        const c = allergensInText(text);
        c.forEach((code) => { if (!codes.has(code)) codes.set(code, text); });
        if (!c.size) free.push(text);
    }
    return { codes, free };
}

function normalizeDiet(pref) {
    const p = String(pref || '').toLowerCase();
    if (/jain/.test(p)) return 'jain';
    if (/vegan/.test(p)) return 'vegan';
    if (/egg|ovo/.test(p)) return 'eggetarian';
    if (/non|meat|omni|pesc|chicken|fish/.test(p)) return 'non-vegetarian';
    if (/veg/.test(p)) return 'vegetarian';
    return null;
}

function foodFacts(hp) {
    const p = hp || {};
    const c = buildSafetyConstraints(p);
    const d = p.diet || {};
    const meds = ((p.medications && p.medications.items) || []).filter((m) => m && m.active !== false).map((m) => String(m.name || ''));
    const medHit = (re) => meds.find((m) => re.test(m)) || null;
    const allergyTexts = ((p.allergies && p.allergies.items) || []).filter((a) => a && a.type !== 'drug').map((a) => a.allergen);
    return {
        allergy: codedTerms(allergyTexts),
        intolerance: codedTerms(((p.intolerances && p.intolerances.items) || []).map((i) => i.name)),
        diet: normalizeDiet(d.preference),
        restrictions: clean([...(d.restrictions || []), ...(d.dietaryRestrictions || [])]).map((t) => t.replace(AVOID_PREFIX, '').trim()).filter(Boolean),
        avoid: clean([...(d.dislikes || []), ...(d.dietaryDont || [])]).map((t) => t.replace(AVOID_PREFIX, '').trim()).filter(Boolean),
        conditions: new Set(c.conditionKeys),
        med: { vitK: medHit(MED.vitK), grapefruit: medHit(MED.grapefruit), alcohol: medHit(MED.alcohol) },
    };
}

// ── one dish ────────────────────────────────────────────────────────────────
function analyzeDish(dish) {
    const name = String(dish?.name || '').trim();
    const ingredients = (dish?.ingredients || []).map((i) => String(typeof i === 'string' ? i : i?.name || '')).filter(Boolean);
    const all = [name, ...ingredients];
    const hay = padded(all.join(' | '));
    const allergens = new Set();
    for (const t of all) {
        allergensFromName(t).forEach((a) => allergens.add(a));
        allergensInText(t).forEach((a) => allergens.add(a));
    }
    // Eggless / vegan dishes say so in their name: don't flag egg / dairy then.
    if (/\beggless\b/i.test(name)) allergens.delete('egg');
    const types = all.map((t) => dietTypeFromName(t, '', allergensFromName(t)));
    const dietType = types.includes('non_vegetarian') ? 'non_vegetarian' : (allergens.has('egg') ? 'eggetarian' : 'vegetarian');
    return { name: name || 'this dish', hay, allergens, dietType };
}

const DIET_OK = {
    vegetarian: (t, a) => t === 'vegetarian' && !a.has('egg'),
    eggetarian: (t) => t !== 'non_vegetarian',
    jain: (t, a) => t === 'vegetarian' && !a.has('egg'),
    vegan: (t, a) => t === 'vegetarian' && !a.has('egg') && !a.has('milk'),
};

// Identity checks: things that are wrong for this person no matter the portion.
function dishViolations(dishOrAnalysis, facts) {
    const x = dishOrAnalysis.hay ? dishOrAnalysis : analyzeDish(dishOrAnalysis);
    const out = [];
    for (const code of x.allergens) {
        if (facts.allergy.codes.has(code)) out.push({ code: 'meal_allergy', level: 'important', detail: { dish: x.name, what: ALLERGEN_LABEL[code] || code, user: facts.allergy.codes.get(code) } });
    }
    for (const term of facts.allergy.free) {
        if (hasWord(x.hay, term)) out.push({ code: 'meal_allergy', level: 'important', detail: { dish: x.name, what: term, user: term } });
    }
    if (facts.conditions.has('celiac') && x.allergens.has('gluten') && !facts.allergy.codes.has('gluten')) {
        out.push({ code: 'meal_celiac', level: 'important', detail: { dish: x.name } });
    }
    for (const code of x.allergens) {
        if (facts.intolerance.codes.has(code) && !facts.allergy.codes.has(code)) out.push({ code: 'meal_intolerance', level: 'caution', detail: { dish: x.name, what: ALLERGEN_LABEL[code] || code, user: facts.intolerance.codes.get(code) } });
    }
    const ok = facts.diet && DIET_OK[facts.diet];
    if (ok && !ok(x.dietType, x.allergens)) out.push({ code: 'meal_diet_clash', level: 'caution', detail: { dish: x.name, diet: facts.diet } });
    if (facts.diet === 'jain') {
        const hit = JAIN_AVOID.find((w) => hasWord(x.hay, w));
        if (hit) out.push({ code: 'meal_jain', level: 'caution', detail: { dish: x.name, what: hit } });
    }
    for (const term of facts.restrictions) {
        if (hasWord(x.hay, term)) { out.push({ code: 'meal_restriction', level: 'caution', detail: { dish: x.name, what: term } }); break; }
    }
    for (const term of facts.avoid) {
        if (hasWord(x.hay, term)) { out.push({ code: 'meal_avoid', level: 'caution', detail: { dish: x.name, what: term } }); break; }
    }
    return out;
}

// ── text ────────────────────────────────────────────────────────────────────
const TEXT = {
    meal_allergy: ({ dish, what, user }, mode) => ({
        english: `"${dish}" may contain ${what}, and you are allergic to ${user}. ${mode === 'logged' ? 'If you get swelling, rash or trouble breathing, get medical help right away.' : 'Check the ingredients before eating.'}`,
        hinglish: `"${dish}" mein ${what} ho sakta hai, aur aapko ${user} se allergy hai. ${mode === 'logged' ? 'Sujan, rash ya saans mein dikkat ho to turant doctor ke paas jaiye.' : 'Khaane se pehle ingredients check kar lijiye.'}`,
    }),
    meal_celiac: ({ dish }) => ({
        english: `"${dish}" likely has gluten (wheat / atta / maida / suji). With celiac disease even small amounts harm the gut.`,
        hinglish: `"${dish}" mein gluten (gehun / atta / maida / suji) hone ki sambhavna hai. Celiac mein thoda sa bhi aant ko nuksan karta hai.`,
    }),
    meal_intolerance: ({ dish, what, user }) => ({
        english: `"${dish}" has ${what}; your profile lists ${user} intolerance. A tolerated version (e.g. lactose-free) is easier on the stomach.`,
        hinglish: `"${dish}" mein ${what} hai; aapke profile mein ${user} intolerance hai. Tolerated version (jaise lactose-free) pet ke liye aasaan rahega.`,
    }),
    meal_diet_clash: ({ dish, diet }) => ({
        english: `"${dish}" doesn't look ${diet}, and your profile says ${diet}. If that's changed, update it in your profile.`,
        hinglish: `"${dish}" ${diet} nahi lagta, aur aapke profile mein ${diet} hai. Agar ye badal gaya hai to profile update kar dijiye.`,
    }),
    meal_jain: ({ dish, what }) => ({
        english: `"${dish}" seems to have ${what}, which a Jain diet avoids.`,
        hinglish: `"${dish}" mein ${what} lagta hai, jo Jain diet mein nahi khaate.`,
    }),
    meal_restriction: ({ dish, what }) => ({
        english: `"${dish}" seems to have ${what}; your profile has a restriction on it.`,
        hinglish: `"${dish}" mein ${what} lagta hai; aapke profile mein iski restriction hai.`,
    }),
    meal_avoid: ({ dish, what }) => ({
        english: `"${dish}" has ${what}, which is on your foods-to-avoid list.`,
        hinglish: `"${dish}" mein ${what} hai, jo aapki avoid list mein hai.`,
    }),
    meal_sugar_diabetes: ({ sugar, scope }) => ({
        english: `With diabetes, ${scope === 'day' ? `today's sugar is already about ${sugar} g` : `this meal has about ${sugar} g sugar`}. Keep the next meal low in sugar and refined carbs; a 10-15 min walk after eating helps.`,
        hinglish: `Diabetes ke saath ${scope === 'day' ? `aaj ki sugar already lagbhag ${sugar} g ho gayi hai` : `is meal mein lagbhag ${sugar} g sugar hai`}. Agla meal kam sugar aur kam refined carbs wala rakhiye; khaane ke baad 10-15 min walk madad karti hai.`,
    }),
    meal_sodium: ({ sodium, scope, cond }) => ({
        english: `With ${cond}, ${scope === 'day' ? `today's salt is already about ${sodium} mg sodium` : `this meal has about ${sodium} mg sodium`} (aim under 2,000 mg a day). Skip pickle, papad and namkeen for the rest of the day.`,
        hinglish: `${cond[0].toUpperCase() + cond.slice(1)} ke saath ${scope === 'day' ? `aaj ka namak already lagbhag ${sodium} mg sodium ho gaya hai` : `is meal mein lagbhag ${sodium} mg sodium hai`} (din mein 2,000 mg se kam rakhna hai). Aaj aage achaar, papad, namkeen avoid kijiye.`,
    }),
    meal_protein_kidney: ({ protein }) => ({
        english: `This meal has about ${protein} g protein. With a kidney condition, protein should stay at what your doctor advised.`,
        hinglish: `Is meal mein lagbhag ${protein} g protein hai. Kidney condition mein protein utna hi rakhiye jitna doctor ne bataya hai.`,
    }),
    meal_gout: ({ what }) => ({
        english: `${what} is high in purines, which can trigger gout / high uric acid. Keep it occasional and drink plenty of water.`,
        hinglish: `${what} mein purine zyada hota hai, jo gout / uric acid badha sakta hai. Kabhi-kabhi hi lijiye aur paani khoob pijiye.`,
    }),
    meal_vitk_warfarin: ({ med, what }) => ({
        english: `You take ${med}. ${what} is high in vitamin K: fine to eat, but keep the amount steady day to day; sudden big changes affect the medicine.`,
        hinglish: `Aap ${med} lete hain. ${what} mein vitamin K zyada hai: kha sakte hain, par roz ki matra ek jaisi rakhiye; achanak bada badlav dawai ka asar badalta hai.`,
    }),
    meal_grapefruit: ({ med }) => ({
        english: `Grapefruit / chakotra interacts with ${med}; it's best avoided.`,
        hinglish: `Grapefruit / chakotra ${med} ke saath interact karta hai; ise avoid karna behtar hai.`,
    }),
    meal_alcohol_med: ({ med, liver }) => ({
        english: liver ? 'With fatty liver, alcohol is best avoided completely.' : `Alcohol with ${med} isn't safe (low sugar, liver or bleeding risk depending on the medicine). Best avoided; at least never on an empty stomach.`,
        hinglish: liver ? 'Fatty liver mein alcohol bilkul avoid karna chahiye.' : `${med} ke saath alcohol safe nahi hai (dawai ke hisaab se sugar girna, liver ya bleeding ka risk). Avoid kijiye; kam se kam khaali pet kabhi nahi.`,
    }),
};

const round = (n, step = 1) => Math.round(n / step) * step;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * input: { dishes: [{ name, ingredients? }], meal: { sugar, sodium, protein }, day: { sugar, sodium } | null }
 * mode: 'precheck' (scan, before eating) | 'logged'
 */
function checkMeal(input, facts, { mode = 'logged' } = {}) {
    if (!input || !facts) return [];
    const dishes = (input.dishes || []).map(analyzeDish).filter((x) => x.name);
    const raw = [];
    const seen = new Set();
    const add = (code, level, detail) => {
        const key = `${code}:${detail?.what || ''}:${detail?.dish || ''}`;
        if (seen.has(key)) return;
        seen.add(key);
        raw.push({ code, level, detail });
    };
    for (const x of dishes) for (const v of dishViolations(x, facts)) add(v.code, v.level, v.detail);

    const hay = dishes.map((x) => x.hay).join(' ');
    const meal = input.meal || {};
    const day = input.day || null;
    const C = facts.conditions;
    if (C.has('diabetes')) {
        const daySugar = num(day?.sugar), mealSugar = num(meal.sugar);
        if (daySugar >= 50) add('meal_sugar_diabetes', 'caution', { sugar: round(daySugar), scope: 'day' });
        else if (mealSugar >= 25) add('meal_sugar_diabetes', 'caution', { sugar: round(mealSugar), scope: 'meal' });
    }
    const saltCond = C.has('kidney') ? 'a kidney condition' : C.has('heart') ? 'a heart condition' : C.has('hypertension') ? 'high BP' : null;
    if (saltCond) {
        const daySodium = num(day?.sodium), mealSodium = num(meal.sodium);
        if (daySodium >= 2300) add('meal_sodium', 'caution', { sodium: round(daySodium, 50), scope: 'day', cond: saltCond });
        else if (mealSodium >= 1200) add('meal_sodium', 'caution', { sodium: round(mealSodium, 50), scope: 'meal', cond: saltCond });
    }
    if (C.has('kidney') && num(meal.protein) >= 40) add('meal_protein_kidney', 'caution', { protein: round(num(meal.protein)) });
    if (C.has('gout')) {
        const hit = GOUT_FOODS.find((w) => hasWord(hay, w));
        if (hit) add('meal_gout', 'caution', { what: hit[0].toUpperCase() + hit.slice(1) });
    }
    if (facts.med.vitK) {
        const hit = LEAFY_GREENS.find((w) => hasWord(hay, w));
        if (hit) add('meal_vitk_warfarin', 'caution', { med: facts.med.vitK, what: hit[0].toUpperCase() + hit.slice(1) });
    }
    if (facts.med.grapefruit && GRAPEFRUIT.some((w) => hasWord(hay, w))) add('meal_grapefruit', 'caution', { med: facts.med.grapefruit });
    if (ALCOHOL.some((w) => hasWord(hay, w))) {
        if (C.has('fatty_liver')) add('meal_alcohol_med', 'caution', { liver: true });
        else if (facts.med.alcohol) add('meal_alcohol_med', 'caution', { med: facts.med.alcohol });
    }

    const rank = { important: 0, caution: 1 };
    return raw
        .sort((a, b) => rank[a.level] - rank[b.level])
        .map((r) => ({ code: r.code, level: r.level, text: TEXT[r.code](r.detail, mode), detail: r.detail }));
}

module.exports = { foodFacts, analyzeDish, dishViolations, checkMeal, normalizeDiet, TEXT };
