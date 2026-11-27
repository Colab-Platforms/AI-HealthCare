/**
 * AI fallback for foods not in the DB, with auto-save (docs/FOOD_DB_FLOW.md section 8).
 *
 *   const aiFallback = makeAiFallback({ userId });
 *   const r = await aiFallback(item); // → { food, saved, outcome } | null
 *
 * 1. One small Gemini call returns the food in OUR schema (per-100 g nutrition, serving, diet type,
 *    allergens, tags, GI, ingredient names) — no tips, no warnings.
 * 2. Checks (section 8.2): calories vs macros ±20 %, per-100 g limits, oil-dominant, required
 *    fields, generic name. Diet type and allergens are combined with the name rules (stricter wins).
 * 3. Save or link:
 *    - same name/alias already in `foods` and active → add the scanned name as an alias, use that food
 *    - a close existing food (matcher ≥ 0.85, same main protein) → same
 *    - previously rejected/merged name → not saved again
 *    - otherwise insert as `ai_pending` with a THF-A… id
 *    Anything not saved is still used for this one scan and logged in FoodFallbackLog.
 */
const openrouterAI = require('../openrouterAI');
const Food = require('../../models/Food');
const FoodFallbackLog = require('../../models/FoodFallbackLog');
const V = require('./vocab');
const C = require('./classify');
const checks = require('./foodChecks');
const { tokens } = require('./normalize');
const M = require('./foodMatcher');

const MODEL = process.env.FOOD_FALLBACK_MODEL || openrouterAI.MODELS.GEMINI_FLASH;
const AI_KCAL_TOLERANCE = 0.2;
const LINK_MIN_SCORE = 0.85;
const AI_ID_PREFIX = 'THF-A';
const DIET_STRICTNESS = ['vegan', 'vegetarian', 'eggetarian', 'non_vegetarian'];
const PERSONAL_NAME = /\b(my|mom'?s|mum'?s|maa'?s|grandma'?s|nani'?s|dadi'?s|homemade by)\b|\w'?s (special|recipe)\b/i;

const cleanText = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
const r2 = (n) => Math.round(n * 100) / 100;
const numOrNull = (v) => {
  const n = Number(v);
  return v != null && v !== '' && Number.isFinite(n) && n >= 0 ? r2(n) : null;
};

// ── 1. the AI call ──────────────────────────────────────────────────────────
function buildPrompt(item) {
  const portion = [item.portionText, item.estGrams ? `about ${item.estGrams} g` : ''].filter(Boolean).join(', ');
  return `Describe the food "${item.name}"${portion ? ` (eaten portion: ${portion})` : ''} for a nutrition database.

RULES
- All nutrition is per 100 g of the food AS EATEN (cooked), using typical values from IFCT 2017 / USDA. Do not scale to the portion.
- calories must equal 4×protein + 4×carbs + 9×fats within 10 %.
- "name": the common generic name in Title Case (e.g. "Sauteed Spinach", "Avocado"). No brand names.
- "isGenericFood": false if this is a branded/packaged product or a personal recipe, else true.
- "serving": the usual single serving: "defaultUnit" (one of: bowl, plate, glass, cup, piece, slice, tablespoon, serving) and "defaultGrams".
- "dietType": any meat/fish/seafood → "non_vegetarian"; egg → "eggetarian"; any milk, curd, paneer, ghee, butter, cream, cheese or honey → "vegetarian"; otherwise "vegan".
- "allergens": every one of [${V.ALLERGENS.join(', ')}] the food typically contains.
- "tags": any of [${V.TAGS.filter((t) => t !== 'high_sugar').join(', ')}] that apply.
- "category": one of [${V.CATEGORIES.join(' | ')}].
- "glycemicIndex": typical GI, or null if the food has under 5 g carbs per 100 g.
- "ingredients": main ingredients with grams in ONE default serving (max 10).

Return exactly this JSON:
{"name": "", "isGenericFood": true, "aliases": [], "nutritionPer100g": {"calories": 0, "protein": 0, "carbs": 0, "fats": 0, "fiber": 0, "sugar": 0, "sodium": 0, "satFat": 0, "cholesterol": 0, "potassium": 0, "calcium": 0, "iron": 0, "vitaminC": 0}, "serving": {"defaultUnit": "", "defaultGrams": 0}, "classification": {"dietType": "", "mealSlots": [], "course": "", "category": "", "cuisine": "indian|indo_chinese|global"}, "allergens": [], "tags": [], "glycemicIndex": null, "ingredients": [{"name": "", "gramsPerServing": 0}]}`;
}

async function estimateFood(item, userId) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const reply = await openrouterAI.chatCompletion({
        model: MODEL,
        system: 'You are a food composition database. Respond ONLY with valid JSON.',
        messages: [{ role: 'user', content: buildPrompt(item) }],
        maxTokens: 1200,
        temperature: 0,
        feature: 'food_ai_fallback',
        userId,
        timeoutMs: 45000,
      });
      return openrouterAI.parseJsonResponse(reply);
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ [AiFoodFallback] attempt ${attempt + 1} for "${item.name}" failed: ${err.message}`);
    }
  }
  throw lastError;
}

// ── 2. normalise + checks ───────────────────────────────────────────────────
const stricterDiet = (a, b) => (DIET_STRICTNESS.indexOf(a) >= DIET_STRICTNESS.indexOf(b) ? a : b);

/** AI JSON → Food-shaped document (no foodId) plus the problems that block saving. Exported for tests. */
function buildAiFood(raw, item) {
  const problems = [];
  const name = titleCase(cleanText(raw?.name || item.name).toLowerCase()).slice(0, 60);
  const p = C.padded(name);

  const n = {};
  for (const k of Object.keys(V.NUTRIENT_UNITS.nutritionPer100g)) n[k] = numOrNull(raw?.nutritionPer100g?.[k]);
  for (const k of ['calories', 'protein', 'carbs', 'fats']) if (n[k] == null) problems.push(`${k} missing`);

  const cls = raw?.classification || {};
  const category = V.CATEGORIES.includes(cls.category) ? cls.category : C.categoryFromName(name);
  const cuisine = V.CUISINES.includes(cls.cuisine) ? cls.cuisine : C.cuisineFromName(p);
  const allergens = new Set((Array.isArray(raw?.allergens) ? raw.allergens : []).filter((a) => V.ALLERGENS.includes(a)));
  for (const a of C.allergensFromName(name, cuisine)) allergens.add(a); // name rules can only add
  const nameDiet = C.dietTypeFromName(name, category, allergens);
  let dietType = V.DIET_TYPES.includes(cls.dietType) ? cls.dietType : null;
  if (!dietType) problems.push('dietType missing');
  // Stricter of AI and name rules, but the name rules' cautious "vegetarian" default never overrides an AI "vegan".
  else if (nameDiet !== 'vegetarian' || dietType !== 'vegan') dietType = stricterDiet(dietType, nameDiet);
  if (allergens.has('egg') && DIET_STRICTNESS.indexOf(dietType) < 2) dietType = 'eggetarian';
  if (allergens.has('milk') && dietType === 'vegan') dietType = 'vegetarian';

  const tags = new Set((Array.isArray(raw?.tags) ? raw.tags : []).filter((t) => V.TAGS.includes(t)));
  // Name rules add tags too, but not their cautious "every savoury dish has onion/garlic" guess
  // (made for name-only seed foods): with category 'other' they only fire on words actually in
  // the name. Live test: avocado and bacon were tagged contains_onion_garlic.
  for (const t of C.tagsFromName(name, 'other')) tags.add(t);
  if ((n.sugar ?? 0) >= 15) tags.add('high_sugar');

  const flags = [];
  let defaultUnit = cleanText(raw?.serving?.defaultUnit).toLowerCase().slice(0, 20) || 'serving';
  let defaultGrams = Number(raw?.serving?.defaultGrams);
  if (!(defaultGrams >= 5 && defaultGrams <= 2000)) {
    defaultGrams = item.estGrams && item.estGrams >= 5 && item.estGrams <= 2000 ? item.estGrams : 100;
    defaultUnit = 'serving';
    flags.push('serving_defaulted');
  }

  const gi = Number(raw?.glycemicIndex);
  const glycemicIndex = Number.isFinite(gi) && gi > 0 && gi <= 110 ? Math.round(gi) : C.estimateGI(name, category, n.carbs);

  const ingredients = (Array.isArray(raw?.ingredients) ? raw.ingredients : []).slice(0, 10)
    .map((i) => ({ name: cleanText(i?.name).slice(0, 60), gramsPerServing: numOrNull(i?.gramsPerServing) }))
    .filter((i) => i.name);
  // Ingredient grams far above one serving mean the AI used another basis (e.g. a whole batch): scale to one serving.
  const ingGrams = ingredients.reduce((s, i) => s + (i.gramsPerServing || 0), 0);
  if (ingGrams > defaultGrams * 1.5) {
    for (const i of ingredients) if (i.gramsPerServing != null) i.gramsPerServing = r2((i.gramsPerServing * defaultGrams) / ingGrams);
  }

  const aliasSet = new Set();
  for (const a of [...(Array.isArray(raw?.aliases) ? raw.aliases : []), item.name, ...(item.candidates || [])]) {
    const v = cleanText(a).toLowerCase().slice(0, 80);
    if (v && v !== name.toLowerCase()) aliasSet.add(v);
  }
  const aliases = [...aliasSet].slice(0, 15);

  if (n.calories != null) {
    const kc = checks.kcalCheck(n, AI_KCAL_TOLERANCE);
    if (!kc.ok) problems.push(`calories ${n.calories} vs macros ${kc.calc}`);
    problems.push(...checks.rangeCheck(n, category).filter((x) => !x.endsWith('missing')));
  }

  const notGeneric = raw?.isGenericFood === false || PERSONAL_NAME.test(name) || PERSONAL_NAME.test(item.name || '');

  const doc = {
    name,
    aliases,
    searchText: [...new Set(tokens([name, ...aliases].join(' ')))].join(' '),
    description: null,
    classification: {
      dietType: dietType || nameDiet,
      mealSlots: (Array.isArray(cls.mealSlots) ? cls.mealSlots : []).filter((s) => V.MEAL_SLOTS.includes(s)),
      course: V.COURSES.includes(cls.course) ? cls.course : (C.COURSE_BY_CATEGORY[category] || 'main'),
      category,
      cuisine,
      regions: [],
    },
    allergens: [...allergens].sort(),
    tags: [...tags].sort(),
    serving: { defaultUnit, defaultGrams: Math.round(defaultGrams), units: checks.servingUnits(defaultUnit, defaultGrams) },
    nutritionPer100g: n,
    micronutrientsPer100g: null,
    glycemicIndex,
    ingredients,
    source: { primary: 'ai', anuvaadCode: null, anuvaadSource: null, indDishId: null, aiModel: MODEL, createdFromScanId: null },
    dataQuality: {
      status: 'ai_pending',
      estimatedFields: ['nutritionPer100g', 'classification', 'allergens', 'tags', 'glycemicIndex', 'serving', 'ingredients'],
      flags,
      checksPassed: problems.length === 0,
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
    },
    isActive: true,
  };
  if (!doc.classification.mealSlots.length) doc.classification.mealSlots = C.mealSlotsFor(category, p);
  return { doc, problems, notGeneric };
}

// ── 3. save or link ─────────────────────────────────────────────────────────
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function addAliases(food, names) {
  const merged = [...new Set([...(food.aliases || []), ...names.map((x) => cleanText(x).toLowerCase())])]
    .filter((a) => a && a !== food.name.toLowerCase());
  if (merged.length === (food.aliases || []).length) return;
  await Food.updateOne({ foodId: food.foodId }, {
    $set: { aliases: merged, searchText: [...new Set(tokens([food.name, ...merged].join(' ')))].join(' ') },
  });
  M.invalidateIndex();
}

async function nextAiFoodId() {
  const last = await Food.findOne({ foodId: { $regex: `^${AI_ID_PREFIX}\\d{5}$` } }).sort({ foodId: -1 }).select('foodId').lean();
  const n = last ? parseInt(last.foodId.slice(AI_ID_PREFIX.length), 10) + 1 : 1;
  return `${AI_ID_PREFIX}${String(n).padStart(5, '0')}`;
}

async function logNotSaved(outcome, item, doc, reasons, raw, userId) {
  try {
    await FoodFallbackLog.create({ scannedName: item.name, aiName: doc?.name, outcome, reasons, aiOutput: raw, userId });
  } catch (err) {
    console.error('[AiFoodFallback] could not write FoodFallbackLog:', err.message);
  }
}

async function saveOrLink({ doc, problems, notGeneric }, item, raw, userId) {
  const transient = (outcome, reasons) => {
    logNotSaved(outcome, item, doc, reasons, raw, userId);
    return { food: doc, saved: false, outcome };
  };
  if (notGeneric) return transient('not_generic', ['not a generic food (brand, packaged product or personal recipe)']);
  if (problems.length) return transient('failed_checks', problems);

  // Same name or alias already stored (any status).
  const lowerNames = [doc.name.toLowerCase(), item.name];
  const existing = await Food.findOne({
    $or: [{ name: { $regex: `^${escapeRegex(doc.name)}$`, $options: 'i' } }, { aliases: { $in: lowerNames } }],
  }).lean();
  if (existing) {
    if (existing.mergedInto) {
      const target = await Food.findOne({ foodId: existing.mergedInto, isActive: true }).lean();
      if (target) { await addAliases(target, [item.name]); return { food: target, saved: true, outcome: 'linked' }; }
    }
    if (!existing.isActive || existing.dataQuality?.status === 'rejected') {
      return transient('previously_rejected', [`${existing.foodId} is ${existing.dataQuality?.status || 'inactive'}`]);
    }
    await addAliases(existing, [item.name, ...(item.candidates || [])]);
    return { food: existing, saved: true, outcome: 'linked' };
  }

  // A close existing food under another name ("Sauteed Spinach" vs an existing "Spinach Stir Fry").
  const best = M.rankFoods(await M.getIndex(), [doc.name, ...doc.aliases], { limit: 1 })[0];
  if (best && best.score >= LINK_MIN_SCORE && C.proteinKey(best.food.name) === C.proteinKey(doc.name)) {
    const full = await Food.findOne({ foodId: best.food.foodId, isActive: true }).lean();
    if (full) { await addAliases(full, [item.name, doc.name]); return { food: full, saved: true, outcome: 'linked' }; }
  }

  // New food. Retry on a duplicate id from a concurrent insert.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const created = await Food.create({ ...doc, foodId: await nextAiFoodId(), stats: { hitCount: 1, lastMatchedAt: new Date() } });
      M.invalidateIndex();
      return { food: created.toObject(), saved: true, outcome: 'created' };
    } catch (err) {
      if (err?.code !== 11000 || attempt === 2) {
        console.error('[AiFoodFallback] insert failed:', err.message);
        return transient('failed_checks', [`insert failed: ${err.message}`]);
      }
    }
  }
  return transient('failed_checks', ['insert failed']);
}

/** The fallback resolveMeal() calls for an item the matcher could not place. */
function makeAiFallback({ userId = null } = {}) {
  return async (item) => {
    let raw;
    try {
      raw = await estimateFood(item, userId);
    } catch (err) {
      await logNotSaved('ai_error', item, null, [err.message], null, userId);
      return null;
    }
    const built = buildAiFood(raw, item);
    return saveOrLink(built, item, raw, userId);
  };
}

module.exports = { makeAiFallback, buildAiFood, buildPrompt, nextAiFoodId, AI_ID_PREFIX };
