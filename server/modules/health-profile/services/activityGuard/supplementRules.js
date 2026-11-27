// Supplement x health profile rules (27 Nov). Pure. Used when the user adds a
// supplement to their routine and on AI supplement recommendations, so both
// are judged the same way. General interaction guidance only: never a dose,
// never "stop your medicine"; anything serious says "ask your doctor first".
//
//   checkSupplement({ name, ingredients? }, facts) -> [{ code, level, text: { english, hinglish } }]
//   supplementFacts(healthProfile)

const { buildSafetyConstraints } = require('../safetyConstraints');
const { normalizeDiet } = require('./foodRules');

const S = {
    vitK: /vitamin\s*k\b|\bk2\b|phylloquinone|menaquinone/i,
    bleeding: /fish oil|omega[\s-]?3|\bepa\b|\bdha\b|vitamin\s*e\b|ginkgo|garlic|curcumin|turmeric|haldi|ginger extract|nattokinase|krill/i,
    potassium: /potassium/i,
    mineralBinder: /calcium|\biron\b|ferrous|magnesium|zinc|multivitamin|multi[\s-]?vitamin|antacid|soy|biotin/i,
    ashwagandha: /ashwagandha|withania/i,
    stJohns: /st\.?\s*john'?s?\s*wort|hypericum/i,
    kidneyLoad: /magnesium|potassium|creatine|protein powder|whey|vitamin\s*d\s*(60|50)[\s,]*000|high[\s-]?dose vitamin d/i,
    sugarLowering: /berberine|cinnamon|dalchini|fenugreek|methi|bitter gourd|karela|gymnema|gurmar|chromium/i,
    liver: /niacin|vitamin\s*b3|green tea extract|kava|high[\s-]?dose vitamin a|garcinia/i,
    stimulant: /pre[\s-]?workout|caffeine|guarana|yohimbine|synephrine|fat burner|ephedra/i,
    sedating: /melatonin|valerian|kava|chamomile extract/i,
    fishSource: /fish oil|cod liver|krill|omega[\s-]?3(?!.*(algal|algae|vegan|flax))/i,
    shellfishSource: /glucosamine|chitosan|krill/i,
    milkSource: /whey|casein|milk protein|colostrum/i,
    soySource: /soy protein|soya protein|soy isoflavone/i,
    gelatin: /gelatin|softgel|cod liver|fish oil/i,
};

const MED = {
    thinner: /warfarin|acitrom|acenocoumarol|apixaban|eliquis|rivaroxaban|xarelto|dabigatran|clopidogrel|ticagrelor|prasugrel|ecosprin|aspirin/i,
    vitKSensitive: /warfarin|acitrom|acenocoumarol/i,
    potassiumRaising: /\w+pril\b|\w+sartan\b|spironolactone|eplerenone|amiloride|aldactone/i,
    thyroid: /levothyroxine|thyroxine|thyronorm|eltroxin|thyrox/i,
    antidepressant: /sertraline|fluoxetine|escitalopram|citalopram|paroxetine|venlafaxine|duloxetine|amitriptyline|mirtazapine|bupropion/i,
    hypo: /insulin|glimepiride|gliclazide|glibenclamide|glipizide|amaryl/i,
    sedative: /alprazolam|clonazepam|diazepam|lorazepam|etizolam|zolpidem/i,
};

function supplementFacts(hp) {
    const p = hp || {};
    const c = buildSafetyConstraints(p);
    const meds = ((p.medications && p.medications.items) || []).filter((m) => m && m.active !== false).map((m) => String(m.name || ''));
    const med = {};
    for (const [k, re] of Object.entries(MED)) med[k] = meds.find((m) => re.test(m)) || null;
    const d = p.diabetes || {};
    if (!med.hypo && (d.medicationType || []).some((t) => /insulin|sulfonyl/i.test(t))) med.hypo = 'insulin';
    const allergyText = ((p.allergies && p.allergies.items) || []).map((a) => String(a.allergen || '')).join(' | ');
    const intoleranceText = ((p.intolerances && p.intolerances.items) || []).map((i) => String(i.name || '')).join(' | ');
    const mental = ((p.mentalHealth && p.mentalHealth.items) || []).map((m) => String(m.name || '')).join(' | ');
    return {
        med,
        conditions: new Set(c.conditionKeys),
        // Whole words: "Shellfish" must not read as a fish allergy.
        allergy: { fish: /(^|[^a-z])fish|seafood|machh?li/i.test(allergyText), shellfish: /shellfish|prawn|shrimp|crab|lobster|seafood|jhinga/i.test(allergyText), milk: /milk|dairy|whey|casein/i.test(allergyText), soy: /(^|[^a-z])soy/i.test(allergyText) },
        lactose: /lactose|dairy|milk/i.test(intoleranceText),
        diet: normalizeDiet(p.diet && p.diet.preference),
        liver: /liver|hepat|cirrho/i.test(((p.conditions && p.conditions.items) || []).filter((x) => x.status !== 'resolved').map((x) => x.name).join(' ')) || c.conditionKeys.includes('fatty_liver'),
        anxiety: /anxiety|panic|bipolar|insomnia/i.test(mental),
    };
}

const RULES = [
    { code: 'sup_allergy', level: 'important',
        when: (t, f) => (f.allergy.fish && S.fishSource.test(t) && 'fish') || (f.allergy.shellfish && S.shellfishSource.test(t) && 'shellfish') || (f.allergy.milk && S.milkSource.test(t) && 'milk') || (f.allergy.soy && S.soySource.test(t) && 'soy'),
        text: (n, f, what) => ({
            english: `${n} is usually made from ${what}, and you are allergic to ${what}. Look for a ${what}-free version (e.g. algal omega-3, plant protein).`,
            hinglish: `${n} aam taur pe ${what} se banta hai, aur aapko ${what} se allergy hai. ${what}-free version dekhiye (jaise algal omega-3, plant protein).`,
        }) },
    { code: 'sup_st_johns', level: 'important',
        when: (t, f) => S.stJohns.test(t) && (f.med.antidepressant || f.med.thinner),
        text: (n, f) => ({
            english: `St John's wort interacts strongly with ${f.med.antidepressant || f.med.thinner}. Don't take it together; ask your doctor first.`,
            hinglish: `St John's wort ${f.med.antidepressant || f.med.thinner} ke saath zyada interact karta hai. Saath mein mat lijiye; pehle doctor se poochiye.`,
        }) },
    { code: 'sup_potassium', level: 'important',
        when: (t, f) => S.potassium.test(t) && (f.med.potassiumRaising || f.conditions.has('kidney')),
        text: (n, f) => ({
            english: `${n} with ${f.med.potassiumRaising || 'a kidney condition'} can push potassium too high (heart rhythm risk). Take it only if your doctor prescribed it.`,
            hinglish: `${n} ${f.med.potassiumRaising || 'kidney condition'} ke saath potassium bahut badha sakta hai (dil ki dhadkan pe risk). Sirf doctor ke kehne pe lijiye.`,
        }) },
    { code: 'sup_vitk', level: 'caution',
        when: (t, f) => S.vitK.test(t) && f.med.vitKSensitive,
        text: (n, f) => ({
            english: `Vitamin K changes how ${f.med.vitKSensitive} works. Ask your doctor before starting; if you do, keep the dose the same every day.`,
            hinglish: `Vitamin K ${f.med.vitKSensitive} ka asar badalta hai. Shuru karne se pehle doctor se poochiye; lein to roz same dose rakhiye.`,
        }) },
    { code: 'sup_bleeding', level: 'caution',
        when: (t, f) => S.bleeding.test(t) && f.med.thinner,
        text: (n, f) => ({
            english: `${n} adds to the bleeding effect of ${f.med.thinner}. Ask your doctor first, and watch for easy bruising or bleeding gums.`,
            hinglish: `${n} ${f.med.thinner} ke saath bleeding ka asar badhata hai. Pehle doctor se poochiye, aur aasaan neel padna ya masoodon se khoon dikhe to bataiye.`,
        }) },
    { code: 'sup_thyroid_timing', level: 'caution',
        when: (t, f) => S.mineralBinder.test(t) && f.med.thyroid,
        text: (n, f) => ({
            english: `${n} blocks ${f.med.thyroid} absorption. Take it at least 4 hours after the thyroid tablet${/biotin/i.test(n) ? ', and stop biotin 2-3 days before a thyroid blood test' : ''}.`,
            hinglish: `${n} ${f.med.thyroid} ka absorption rokta hai. Thyroid tablet ke kam se kam 4 ghante baad lijiye${/biotin/i.test(n) ? ', aur thyroid test se 2-3 din pehle biotin band kijiye' : ''}.`,
        }) },
    { code: 'sup_ashwagandha', level: 'caution',
        when: (t, f) => S.ashwagandha.test(t) && (f.med.thyroid || f.med.sedative || f.conditions.has('thyroid')),
        text: (n, f) => ({
            english: `Ashwagandha can change thyroid levels and add to sleep / calming medicines${f.med.thyroid || f.med.sedative ? ` (${f.med.thyroid || f.med.sedative})` : ''}. Ask your doctor first.`,
            hinglish: `Ashwagandha thyroid levels badal sakta hai aur neend / calming dawaiyon ka asar badhata hai${f.med.thyroid || f.med.sedative ? ` (${f.med.thyroid || f.med.sedative})` : ''}. Pehle doctor se poochiye.`,
        }) },
    { code: 'sup_sugar_lowering', level: 'caution',
        when: (t, f) => S.sugarLowering.test(t) && f.med.hypo,
        text: (n, f) => ({
            english: `${n} lowers blood sugar, and so does ${f.med.hypo}. Together sugar can drop too low; check sugar more often and tell your doctor.`,
            hinglish: `${n} sugar kam karta hai, aur ${f.med.hypo} bhi. Dono saath mein sugar bahut gira sakte hain; sugar zyada baar check kijiye aur doctor ko bataiye.`,
        }) },
    { code: 'sup_kidney', level: 'caution',
        when: (t, f) => !S.potassium.test(t) && S.kidneyLoad.test(t) && f.conditions.has('kidney'),
        text: (n) => ({
            english: `With a kidney condition, ${n} can build up in the body. Take it only if your nephrologist agrees.`,
            hinglish: `Kidney condition mein ${n} body mein jama ho sakta hai. Sirf nephrologist ki permission se lijiye.`,
        }) },
    { code: 'sup_liver', level: 'caution',
        when: (t, f) => S.liver.test(t) && f.liver,
        text: (n) => ({
            english: `${n} is processed by the liver and can strain it. With your liver condition, ask your doctor first.`,
            hinglish: `${n} liver se process hota hai aur us pe load daal sakta hai. Liver condition mein pehle doctor se poochiye.`,
        }) },
    { code: 'sup_stimulant', level: 'caution',
        when: (t, f) => S.stimulant.test(t) && (f.conditions.has('hypertension') || f.conditions.has('heart') || f.anxiety),
        text: (n, f) => ({
            english: `${n} has stimulants that raise heart rate and BP${f.anxiety ? ' and can worsen anxiety / sleep' : ''}. Better avoided with your profile.`,
            hinglish: `${n} mein stimulants hain jo heart rate aur BP badhate hain${f.anxiety ? ' aur anxiety / neend bigad sakte hain' : ''}. Aapke profile ke saath avoid karna behtar hai.`,
        }) },
    { code: 'sup_sedating', level: 'caution',
        when: (t, f) => S.sedating.test(t) && f.med.sedative,
        text: (n, f) => ({
            english: `${n} adds to the drowsiness of ${f.med.sedative}. Ask your doctor before combining.`,
            hinglish: `${n} ${f.med.sedative} ki neend wala asar badhata hai. Saath lene se pehle doctor se poochiye.`,
        }) },
    { code: 'sup_lactose', level: 'caution',
        when: (t, f) => S.milkSource.test(t) && f.lactose && !f.allergy.milk,
        text: (n) => ({
            english: `${n} has milk sugar; with lactose intolerance, whey isolate or a plant protein is easier on the stomach.`,
            hinglish: `${n} mein lactose hota hai; lactose intolerance mein whey isolate ya plant protein pet ke liye aasaan hai.`,
        }) },
    { code: 'sup_diet', level: 'caution',
        when: (t, f) => ['vegetarian', 'vegan', 'jain', 'eggetarian'].includes(f.diet) && (S.gelatin.test(t) || S.fishSource.test(t)),
        text: (n, f) => ({
            english: `${n} is often fish-based or in gelatin capsules, which isn't ${f.diet}. Look for a veg capsule / algal version.`,
            hinglish: `${n} aksar fish se ya gelatin capsule mein hota hai, jo ${f.diet} nahi hai. Veg capsule / algal version dekhiye.`,
        }) },
];

function checkSupplement(sup, facts) {
    if (!sup || !facts) return [];
    const name = String(sup.name || '').trim();
    if (!name) return [];
    const t = [name, ...(sup.ingredients || [])].join(' | ');
    const out = [];
    for (const r of RULES) {
        let d;
        try { d = r.when(t, facts); } catch { d = null; }
        if (d) out.push({ code: r.code, level: r.level, text: r.text(name, facts, d) });
    }
    const rank = { important: 0, caution: 1 };
    return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

module.exports = { checkSupplement, supplementFacts, RULES };
