/**
 * Meal warnings rule engine (docs/FOOD_DB_FLOW.md section 9).
 * Replaces the AI-written "warnings" in the meal scan: same meal + same user → same warnings.
 *
 *   const profile = buildUserHealthProfile(user);                // once per request
 *   const { warnings, details } = getMealWarnings({ profile, dishes, config });
 *
 * `dishes` = [{ food, grams }] where `food` is a Food document (lean) — or an AI-fallback food in
 * the same shape — and `grams` the portion eaten. Pure and synchronous: no DB, no network.
 *
 * Output order (section 9.6): allergies → foods to avoid / noted items → diet clashes →
 * at most `maxConditionWarnings` condition/medication warnings, most severe first.
 */
const { tokens } = require('./normalize');
const { ALLERGEN_SYNONYMS } = require('./vocab');
const { DEFAULT_WARNING_CONFIG } = require('./warningConfig');
const { resolveDietaryPreference } = require('../../utils/dietaryPreference');

// ── user profile ────────────────────────────────────────────────────────────
const NONE_TEXT = /^(none|no|nil|na|n\/a|nothing|none of these|other|-)$/i;
const AVOID_PREFIX = /^(no|avoid|avoiding|less|without|zero|limit|stop|skip)\s+/i;

// Condition matching comes from ONE place (health-profile safetyConstraints,
// 27 Nov) so the meal scan, meal plans, the coach and the activity guard
// always agree on what a condition is. Keys mapped to this file's names.
const SHARED_KEY = { diabetes: 'diabetes', hypertension: 'hypertension', cholesterol: 'high_cholesterol', heart: 'heart_disease', pcos: 'pcos', thyroid: 'thyroid', gut: 'gut_health', kidney: 'kidney' };
const CONDITION_PATTERNS = require('../../modules/health-profile/services/safetyConstraints').CONDITION_RULES
  .filter((r) => SHARED_KEY[r.key])
  .map((r) => [SHARED_KEY[r.key], r.re]);

const MEDICATION_PATTERNS = [
  ['anticoagulant', /warfarin|acenocoumarol|acitrom|coumadin|nicoumalone|blood thinner/i],
  ['potassium_raising', /\b\w+pril\b|\b\w+sartan\b|spironolactone|eplerenone|amiloride|triamterene|aldactone/i],
  ['statin', /\b\w+statin\b/i],
];

const clean = (arr) => [...new Set((arr || []).map((v) => String(v ?? '').trim()).filter((v) => v && !NONE_TEXT.test(v)))];

function allergensInText(text) {
  const t = ` ${String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  const codes = new Set();
  for (const { allergens, words } of ALLERGEN_SYNONYMS) {
    if (words.some((w) => t.includes(` ${w} `))) allergens.forEach((a) => codes.add(a));
  }
  return codes;
}

/**
 * Collect everything the rules need from a user document (lean or hydrated).
 * Reads the same fields as utils/medicalContext.js (the old AI prompt), so nothing is lost.
 */
function buildUserHealthProfile(user) {
  const p = user?.profile || {};
  const prefs = user?.foodPreferences || {};
  const med = p.medicalHistory || {};

  // Allergen codes → the user's own words (an allergy outranks an intolerance/restriction).
  const allergens = new Map();
  const freeText = []; // [{ text, source }] matched against dish names/ingredients (section 9.5)
  for (const [source, list] of [['allergy', clean(p.allergies)], ['restriction', clean(prefs.dietaryRestrictions)]]) {
    for (const text of list) {
      const codes = allergensInText(text);
      codes.forEach((c) => { if (!allergens.has(c)) allergens.set(c, { text, source }); });
      if (!codes.size) freeText.push({ text, source });
    }
  }

  const avoidTerms = clean([...(prefs.foodsToAvoid || []), ...(prefs.dietaryDont || [])])
    .map((t) => t.replace(AVOID_PREFIX, '').trim())
    .filter(Boolean);

  const conditionTexts = clean([
    ...(p.healthConditions || []),
    p.healthConditionOther,
    ...(p.chronicConditions || []),
    ...(med.conditions || []),
  ]);
  const conditions = new Set();
  for (const text of conditionTexts) {
    const hit = CONDITION_PATTERNS.filter(([, re]) => re.test(text)).map(([c]) => c);
    hit.forEach((c) => conditions.add(c));
    if (!hit.length && !/vitamin|deficien/i.test(text)) freeText.push({ text, source: 'condition' });
  }
  if (p.isDiabetic === 'yes') conditions.add('diabetes');

  const medications = [];
  for (const text of clean(med.currentMedications)) {
    for (const [kind, re] of MEDICATION_PATTERNS) if (re.test(text)) medications.push({ kind, text });
  }

  return {
    allergens,
    avoidTerms,
    freeText,
    conditions,
    medications,
    dietPreference: resolveDietaryPreference(user).value, // vegetarian | vegan | eggetarian | jain | non-vegetarian | other | null
  };
}

// ── helpers ─────────────────────────────────────────────────────────────────
const ALLERGEN_LABEL = {
  milk: 'dairy', egg: 'egg', peanut: 'peanuts', tree_nuts: 'tree nuts', gluten: 'gluten',
  soy: 'soy', fish: 'fish', shellfish: 'shellfish', sesame: 'sesame', mustard: 'mustard',
};
const DIET_LABEL = { vegetarian: 'vegetarian', jain: 'Jain', eggetarian: 'eggetarian', vegan: 'vegan' };
const CONDITION_LABEL = {
  diabetes: 'diabetes', hypertension: 'high blood pressure', high_cholesterol: 'high cholesterol',
  heart_disease: 'a heart condition', pcos: 'PCOS', thyroid: 'a thyroid condition',
  gut_health: 'gut health issues', kidney: 'a kidney condition',
};
const LEAFY_GREENS = ['palak', 'spinach', 'sarson', 'saag', 'methi', 'fenugreek', 'broccoli', 'kale', 'bathua', 'cabbage', 'lettuce'];
const ONION_GARLIC_WORDS = new Set(['onion', 'garlic', 'pyaz', 'pyaaz', 'lahsun', 'lehsun']);

function joinAnd(items) {
  if (items.length <= 1) return items[0] || '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
const fmt = (n, step = 1) => (Math.round(n / step) * step).toLocaleString('en-US');

function dishNutrients(food, grams) {
  const n = food.nutritionPer100g || {};
  const m = food.micronutrientsPer100g || {};
  const f = grams / 100;
  const g = (v) => (v == null ? null : v * f);
  return {
    carbs: g(n.carbs), sugar: g(n.sugar), sodium: g(n.sodium), satFat: g(n.satFat),
    cholesterol: g(n.cholesterol), potassium: g(n.potassium), vitaminK: g(m.vitaminK),
  };
}

function sumKnown(rows, key) {
  const vals = rows.map((r) => r.n[key]).filter((v) => v != null);
  return vals.length ? vals.reduce((s, v) => s + v, 0) : null;
}

/** Name of the dish giving ≥ 50% of a nutrient, if any (for "mostly from X"). */
function mainSource(rows, key) {
  const total = sumKnown(rows, key);
  if (!total) return null;
  const top = rows.reduce((a, b) => ((b.n[key] || 0) > (a.n[key] || 0) ? b : a));
  return (top.n[key] || 0) / total >= 0.5 ? top.name : null;
}

function dishTokenSet(food) {
  const words = [food.name, ...(food.aliases || []), ...(food.ingredients || []).map((i) => i.name)];
  return new Set(tokens(words.join(' ')));
}

/** All words of `term` appear in the dish's name/aliases/ingredients ("brinjal" → Baingan Bharta). */
function termInDish(term, dish) {
  const tt = tokens(term);
  if (!tt.length) return false;
  if (tt.every((t) => dish.tokens.has(t))) return true;
  // "onion"/"garlic" restrictions also match dishes tagged as containing them.
  return tt.every((t) => ONION_GARLIC_WORDS.has(t)) && dish.tags.has('contains_onion_garlic');
}

// ── rules ───────────────────────────────────────────────────────────────────
function allergyWarnings(profile, rows) {
  const out = [];
  for (const [code, { text, source }] of profile.allergens) {
    const hits = rows.filter((r) => r.allergens.has(code));
    if (!hits.length) continue;
    // Allergens worked out from a recipe are "contains"; from the dish name only, "may contain".
    const certain = hits.some((r) => r.fromRecipe);
    const listed = source === 'allergy' && !/allerg/i.test(text)
      ? `you listed a ${text.toLowerCase()} allergy`
      : `you listed "${text}"`;
    out.push({
      type: 'allergy', code, severity: Infinity, dishes: hits.map((r) => r.name),
      text: `${certain ? 'Contains' : 'May contain'} ${ALLERGEN_LABEL[code]} (${joinAnd(hits.map((r) => r.name))}) — ${listed}.`,
    });
  }
  return out;
}

function avoidWarnings(profile, rows) {
  const out = [];
  for (const term of profile.avoidTerms) {
    const hits = rows.filter((r) => termInDish(term, r));
    if (hits.length) {
      out.push({ type: 'avoid', code: term, severity: Infinity, dishes: hits.map((r) => r.name),
        text: `You marked "${term}" as a food to avoid — found in ${joinAnd(hits.map((r) => r.name))}.` });
    }
  }
  for (const { text, source } of profile.freeText) {
    const hits = rows.filter((r) => termInDish(text, r));
    if (hits.length) {
      out.push({ type: 'noted', code: source, severity: Infinity, dishes: hits.map((r) => r.name),
        text: `You noted "${text}" — ${joinAnd(hits.map((r) => r.name))} ${hits.length > 1 ? 'contain' : 'contains'} it.` });
    }
  }
  return out;
}

function dietWarnings(profile, rows) {
  const pref = profile.dietPreference;
  const label = DIET_LABEL[pref];
  const out = [];
  const add = (r, text) => out.push({ type: 'diet', code: pref, severity: Infinity, dishes: [r.name], text });
  for (const r of rows) {
    const d = r.dietType;
    if (!d) continue; // unknown (AI-fallback dish): no diet claim either way
    if (pref === 'vegetarian' || pref === 'jain') {
      if (d === 'non_vegetarian') add(r, `${r.name} contains meat or fish — you follow a ${label} diet.`);
      else if (d === 'eggetarian') add(r, `${r.name} contains egg — you follow a ${label} diet.`);
      else if (pref === 'jain' && (r.tags.has('contains_onion_garlic') || r.tags.has('contains_root_veg'))) {
        add(r, `${r.name} usually contains onion, garlic or root vegetables, which are not Jain-friendly.`);
      }
    } else if (pref === 'eggetarian' && d === 'non_vegetarian') {
      add(r, `${r.name} contains meat or fish — you follow an eggetarian diet.`);
    } else if (pref === 'vegan' && d !== 'vegan') {
      if (d === 'non_vegetarian' || d === 'eggetarian' || r.allergens.has('milk')) {
        add(r, `${r.name} contains animal products — you follow a vegan diet.`);
      } else {
        add(r, `${r.name} may contain dairy (ghee, milk or curd) — you follow a vegan diet.`);
      }
    }
  }
  return out;
}

/** Candidate hits per condition: { condition, reason, severity, data }. */
function conditionHits(profile, rows, total, cfg) {
  const R = cfg.rules;
  const hits = [];
  const add = (condition, reason, severity, data = {}) => hits.push({ condition, reason, severity, data });
  const tagged = (tags) => rows.filter((r) => tags.some((t) => r.tags.has(t)));
  const C = profile.conditions;

  if (C.has('diabetes')) {
    if (total.carbs != null && total.carbs > R.diabetes.carbsG) add('diabetes', 'carbs', total.carbs / R.diabetes.carbsG);
    if (total.sugar != null && total.sugar > R.diabetes.sugarG) add('diabetes', 'sugar', total.sugar / R.diabetes.sugarG);
    for (const r of rows) {
      if (r.gi != null && r.gi >= R.diabetes.giHigh && (r.n.carbs || 0) > R.diabetes.giDishCarbsG) {
        add('diabetes', 'gi', r.gi / R.diabetes.giHigh, { dish: r });
      }
    }
  }
  for (const [cond, rule] of [['hypertension', R.hypertension], ['heart_disease', R.heartDisease], ['kidney', R.kidney]]) {
    if (C.has(cond) && total.sodium != null && total.sodium > rule.sodiumMg) add(cond, 'sodium', total.sodium / rule.sodiumMg);
  }
  for (const [cond, rule] of [['high_cholesterol', R.highCholesterol], ['heart_disease', R.heartDisease]]) {
    if (!C.has(cond)) continue;
    if (total.satFat != null && total.satFat > rule.satFatG) add(cond, 'satFat', total.satFat / rule.satFatG);
    if (rule.cholesterolMg && total.cholesterol != null && total.cholesterol > rule.cholesterolMg) {
      add(cond, 'cholesterol', total.cholesterol / rule.cholesterolMg);
    }
    const fried = tagged(rule.tags || []);
    if (fried.length) add(cond, 'deepFried', 1, { dishes: fried });
  }
  if (C.has('kidney') && total.potassium != null && total.potassium > R.kidney.potassiumMg) {
    add('kidney', 'potassium', total.potassium / R.kidney.potassiumMg);
  }
  if (C.has('pcos')) {
    for (const r of rows) {
      const highGi = r.gi != null && r.gi >= R.pcos.giHigh && (r.n.carbs || 0) > R.pcos.giDishCarbsG;
      const refinedSweet = r.tags.has('refined_carb') && (r.n.sugar || 0) > R.pcos.refinedSugarG;
      if (highGi || refinedSweet) add('pcos', 'refinedCarb', highGi ? r.gi / R.pcos.giHigh : 1, { dish: r });
    }
  }
  if (C.has('thyroid')) {
    const g = tagged(R.thyroid.tags);
    if (g.length) add('thyroid', 'goitrogen', 1, { dishes: g });
  }
  if (C.has('gut_health')) {
    const g = tagged(R.gutHealth.tags);
    if (g.length) add('gut_health', 'gutIrritant', 1, { dishes: g });
  }

  // Medications (limited, well-known food–drug interactions only).
  for (const med of profile.medications) {
    if (med.kind === 'anticoagulant') {
      const greens = rows.filter((r) => (r.n.vitaminK != null && r.n.vitaminK > R.medications.vitaminKUg)
        || LEAFY_GREENS.some((w) => r.tokens.has(w)));
      if (greens.length) add(`med:${med.text}`, 'vitaminK', 1, { med: med.text, dishes: greens });
    } else if (med.kind === 'potassium_raising' && total.potassium != null && total.potassium > R.medications.potassiumMg) {
      add(`med:${med.text}`, 'medPotassium', total.potassium / R.medications.potassiumMg, { med: med.text });
    } else if (med.kind === 'statin') {
      const g = rows.filter((r) => r.tokens.has('grapefruit'));
      if (g.length) add(`med:${med.text}`, 'grapefruit', 1.5, { med: med.text, dishes: g });
    }
  }
  return hits;
}

// Reasons that read the same for several conditions are merged into one warning (section 9.6 rule 4).
const SHARED_REASONS = new Set(['sodium', 'satFat', 'cholesterol', 'deepFried']);

function conditionText(reason, conds, data, total, rows, cfg) {
  const who = `You have ${joinAnd(conds.map((c) => CONDITION_LABEL[c]))}`;
  const names = (list) => joinAnd(list.map((r) => r.name));
  const from = (key) => { const s = mainSource(rows, key); return s ? `, mostly from ${s}` : ''; };
  switch (reason) {
    case 'carbs':
      return `${who} — this meal has ~${fmt(total.carbs)} g carbs${from('carbs')}. Consider a smaller portion with extra salad or protein.`;
    case 'sugar':
      return `${who} — this meal has ~${fmt(total.sugar)} g sugar${from('sugar')}. Keep sweet portions small.`;
    case 'gi':
      return `${who} — ${data.dish.name} is a fast-digesting carb (~${fmt(data.dish.n.carbs)} g carbs). Pair it with dal, vegetables or curd and keep the portion small.`;
    case 'sodium': {
      const pct = Math.round((total.sodium / cfg.dailyLimits.sodiumMg) * 100);
      return `${who} — this meal has ~${fmt(total.sodium, 10)} mg sodium, about ${pct}% of your daily limit.`;
    }
    case 'satFat':
      return `${who} — this meal is high in saturated fat (~${fmt(total.satFat)} g${from('satFat')}).`;
    case 'cholesterol':
      return `${who} — this meal has ~${fmt(total.cholesterol, 10)} mg cholesterol${from('cholesterol')}.`;
    case 'deepFried':
      return `${who} — ${names(data.dishes)} ${data.dishes.length > 1 ? 'are' : 'is'} deep-fried, which adds saturated and trans fat.`;
    case 'potassium':
      return `${who} — this meal is high in potassium (~${fmt(total.potassium, 10)} mg).`;
    case 'refinedCarb':
      return `${who} — refined carbs in ${data.dish.name} can spike insulin. Pair it with protein or fibre.`;
    case 'goitrogen':
      return `${who} — ${names(data.dishes)} ${data.dishes.length > 1 ? 'are' : 'is'} soy or cruciferous-heavy; keep it moderate.`;
    case 'gutIrritant': {
      const kinds = [];
      if (data.dishes.some((r) => r.tags.has('spicy'))) kinds.push('spicy');
      if (data.dishes.some((r) => r.tags.has('deep_fried'))) kinds.push('fried');
      return `${who} — ${kinds.join(' or ')} food in ${names(data.dishes)} may upset digestion.`;
    }
    case 'vitaminK':
      return `You take ${data.med} — ${names(data.dishes)} ${data.dishes.length > 1 ? 'are' : 'is'} rich in vitamin K. Keep your intake of leafy greens steady from week to week rather than changing it suddenly.`;
    case 'medPotassium':
      return `You take ${data.med} — this meal is high in potassium (~${fmt(total.potassium, 10)} mg). Check with your doctor how much potassium is right for you.`;
    case 'grapefruit':
      return `You take ${data.med} — grapefruit (${names(data.dishes)}) can interact with it.`;
    default:
      return null;
  }
}

function conditionWarnings(profile, rows, total, cfg) {
  const hits = conditionHits(profile, rows, total, cfg);
  const groups = new Map();
  const addTo = (key, h) => {
    const g = groups.get(key) || { reason: h.reason, conds: [], severity: 0, data: h.data };
    if (!h.condition.startsWith('med:') && !g.conds.includes(h.condition)) g.conds.push(h.condition);
    g.severity = Math.max(g.severity, h.severity);
    groups.set(key, g);
  };
  // Shared reasons name every condition they affect ("high blood pressure and a heart condition")…
  for (const h of hits) if (SHARED_REASONS.has(h.reason)) addTo(h.reason, h);
  // …other reasons are specific to one condition: keep only its strongest hit.
  const best = new Map();
  for (const h of hits) {
    if (SHARED_REASONS.has(h.reason)) continue;
    const cur = best.get(h.condition);
    if (!cur || h.severity > cur.severity) best.set(h.condition, h);
  }
  for (const h of best.values()) addTo(`${h.reason}|${h.condition}`, h);
  const out = [];
  for (const g of groups.values()) {
    const text = conditionText(g.reason, g.conds, g.data, total, rows, cfg);
    if (text) out.push({ type: g.reason.startsWith('med') || ['vitaminK', 'grapefruit'].includes(g.reason) ? 'medication' : 'condition',
      code: g.reason, severity: g.severity, conditions: g.conds, text });
  }
  return out.sort((a, b) => b.severity - a.severity).slice(0, cfg.maxConditionWarnings);
}

/**
 * @param {object} args
 * @param {object} args.profile   from buildUserHealthProfile(user)
 * @param {Array<{food: object, grams: number}>} args.dishes
 * @param {object} [args.config]  from getWarningConfig(); defaults if omitted
 * @returns {{ warnings: string[], details: object[] }}
 */
function getMealWarnings({ profile, dishes, config = DEFAULT_WARNING_CONFIG }) {
  if (!profile || !dishes?.length) return { warnings: [], details: [] };
  const rows = dishes
    .filter((d) => d?.food && d.grams > 0)
    .map(({ food, grams }) => ({
      name: food.name,
      grams,
      n: dishNutrients(food, grams),
      gi: food.glycemicIndex ?? null,
      dietType: food.classification?.dietType,
      allergens: new Set(food.allergens || []),
      tags: new Set(food.tags || []),
      tokens: dishTokenSet(food),
      fromRecipe: (food.ingredients || []).length > 0,
    }));
  if (!rows.length) return { warnings: [], details: [] };

  const total = {};
  for (const k of ['carbs', 'sugar', 'sodium', 'satFat', 'cholesterol', 'potassium']) total[k] = sumKnown(rows, k);

  const details = [
    ...allergyWarnings(profile, rows),
    ...avoidWarnings(profile, rows),
    ...dietWarnings(profile, rows),
    ...conditionWarnings(profile, rows, total, config),
  ];
  const seen = new Set();
  const unique = details.filter((d) => (seen.has(d.text) ? false : seen.add(d.text)));
  return { warnings: unique.map((d) => d.text), details: unique };
}

module.exports = { buildUserHealthProfile, getMealWarnings, allergensInText };
