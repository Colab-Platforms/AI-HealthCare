/**
 * 7-day diet plan built from the Food DB, with no AI call (docs/FOOD_DB_FLOW.md section 13).
 *
 *   const r = await generatePlan(userData, { previousFoodIds, seed });
 *   if (r.ok) save(r.plan); else fall back to the AI generator (r.reason says why).
 *
 * Pipeline, per user:
 *   1. pool     foods the user may eat: diet type, Jain, allergens, exclusions, Indian home food only,
 *               no junk records (powders, stocks, sauces, flagged data)              → hard rules
 *   2. score    region / state catalogue, favourites, goal, medical conditions, previous plan → soft rules
 *   3. compose  each meal from a template (dal + sabzi + roti + salad, khichdi + curd, idli + sambar …)
 *   4. portion  grams / piece counts solved so each meal hits its calorie budget exactly enough;
 *               dinner absorbs the day's remainder, so every day lands on the target
 *   5. check    the same mealGuard used for AI plans, as a final safety net
 *
 * The pure core (`generatePlanFromFoods`, `generateMealFromFoods`) takes the foods array, so it is
 * unit-tested against data/foodDb/foods.seed.json without Mongo.
 *
 * Every meal stores `items: [{ foodId, grams, portionText }]`, so logging it is a POST /api/foods/resolve
 * with those items: the same numbers, no AI.
 */
const { tokens, tokenOverlap } = require('./normalize');
const { nutritionFor } = require('./foodMatcher');
const { allergensInText } = require('./mealWarnings');
const { reconcileFoodPreferences, buildAvoidTerms, checkMealForJain, checkMealForAvoids } = require('../../utils/dietConstraints');
const { checkMealForDiet } = require('../../utils/dietGuard');
const { checkMeal } = require('../../utils/mealGuard');
const { buildSlotBudget, slotCalorieRange, MEAL_TYPES, SLOT_SHARES } = require('../../config/indianMealSlots');
const { getReferenceDishes } = require('../../config/indianMealCatalog');
const { canonicalizeStateName, normalizeStateName, deriveRegionFromState } = require('../../config/indiaRegions');
const { normalizeGoal } = require('../dietTargets');

const DAYS = 7;
const COMBO_TRIES = 60; // random combinations scored per meal; the best valid one wins
const SLOT_TOLERANCE = 0.08; // a meal must land within ±8% of its budget (the AI prompt asks for the same)

/** Food DB dietType values each user diet may eat. 'other' stays vegetarian, as in indianMealCatalog. */
const DIET_FOOD_TYPES = {
  vegan: ['vegan'],
  vegetarian: ['vegan', 'vegetarian'],
  jain: ['vegan', 'vegetarian'],
  eggetarian: ['vegan', 'vegetarian', 'eggetarian'],
  'non-vegetarian': ['vegan', 'vegetarian', 'eggetarian', 'non_vegetarian'],
  other: ['vegan', 'vegetarian'],
};

// Records that are ingredients, bases or restaurant variants, not something served as a meal.
const JUNK_NAME = /\b(powder|premix|paste|stock|sauce|dressing|dip|essence|syrup|batter|dough|masala mix|restaurant|hotel|dhaba|special|style)\b/i;
const BAD_FLAGS = new Set(['macros_inconsistent', 'out_of_range']);
// Served by volume/weight; every other unit (piece, slice, cheela, idli…) is counted in whole pieces.
const MEASURE_UNIT = /\b(bowl|plate|cup|glass|serving|spoon|tablespoon|teaspoon|dish|katori|ladle|g|gram|grams|ml)\b/i;
const isCountUnit = (unit) => Boolean(unit) && !MEASURE_UNIT.test(unit);
// Dish families: at most MAX_FAMILY_PER_WEEK per slot, never twice in one day ("Kanda Poha" and
// "Matar Poha" are different foods but the same breakfast).
// Checked in this order, so the protein decides first: "Chicken Curry with Rice" is chicken, not rice.
const FAMILIES = ['chicken', 'fish', 'mutton', 'prawn', 'egg', 'paneer', 'soya', 'rajma', 'chole', 'kadhi', 'sambar',
  'poha', 'upma', 'chilla', 'cheela', 'paratha', 'parantha', 'thepla', 'dosa', 'idli', 'uttapam', 'dalia', 'daliya',
  'sandwich', 'omelette', 'bhurji', 'dhokla', 'khichdi', 'biryani', 'pulao', 'sabudana', 'pongal', 'puttu', 'appam',
  'sprout', 'chawal', 'rice'];
const FAMILY_ALIASES = { cheela: 'chilla', parantha: 'paratha', daliya: 'dalia' };
const MAX_FAMILY_PER_WEEK = 2;
const RICE_HEAVY = /\b(biryani|biriyani|pulao|pulav|fried rice)\b/i;
const EGG_NAME = /\b(egg|omelette|omelet|bhurji|anda)\b/i;

// What goes with a breakfast dish in an ordinary home. Skipped when the dish name already has it.
const BREAKFAST_PAIRINGS = [
  { re: /\b(paratha|parantha|thepla|thalipeeth|kulcha|bhakri|rotla|missi)\b/i, sides: ['curd'] },
  { re: /\b(idli|dosa|uttapam|uttappam|pesarattu|appam|adai|paniyaram|pongal)\b/i, sides: ['sambar', 'chutney'] },
  { re: /\b(chilla|cheela|dhokla|handvo|muthia)\b/i, sides: ['chutney'] },
  { re: EGG_NAME, sides: ['flatbread'] },
];

// Lunch/dinner shapes. Each entry is a list of roles; '?x' = optional side.
const TEMPLATES = {
  thali: ['dal', 'sabzi', 'carb', '?side'],
  oneDish: ['oneDish', '?side'],
  nonveg: ['nonveg', 'carb', '?salad'],
  light: ['dalOrSabzi', 'flatbread', '?salad'],
};

// How many days of the week get each shape. Order is shuffled per user.
function weeklyShapes(slot, diet) {
  const nonVeg = diet === 'non-vegetarian';
  const egg = diet === 'eggetarian';
  if (slot === 'lunch') {
    if (nonVeg) return ['nonveg', 'nonveg', 'nonveg', 'thali', 'thali', 'thali', 'oneDish'];
    if (egg) return ['nonveg', 'thali', 'thali', 'thali', 'thali', 'oneDish', 'oneDish'];
    return ['thali', 'thali', 'thali', 'thali', 'thali', 'oneDish', 'oneDish'];
  }
  if (nonVeg) return ['nonveg', 'nonveg', 'light', 'light', 'light', 'oneDish', 'thali'];
  if (egg) return ['nonveg', 'light', 'light', 'light', 'oneDish', 'oneDish', 'thali'];
  return ['light', 'light', 'light', 'light', 'thali', 'oneDish', 'oneDish'];
}

// State → the region labels used in foods.classification.regions.
const STATE_FOOD_REGIONS = {
  punjab: ['punjabi'], haryana: ['punjabi'], delhi: ['punjabi', 'mughlai'],
  gujarat: ['gujarati'], rajasthan: ['rajasthani'], maharashtra: ['maharashtrian'], goa: ['goan'],
  kerala: ['kerala'], 'tamil nadu': ['tamil'], 'andhra pradesh': ['andhra'], telangana: ['hyderabadi', 'andhra'],
  'west bengal': ['bengali'], 'jammu and kashmir': ['kashmiri'],
};

// ─── small utilities ────────────────────────────────────────────────────────

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(value) {
  let h = 2166136261;
  for (const ch of String(value)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Weighted random pick; higher score = more likely, never certain (keeps weeks varied). */
function pick(pool, rng, exclude) {
  const candidates = pool.filter((c) => !exclude || !exclude(c));
  if (!candidates.length) return null;
  const weights = candidates.map((c) => Math.exp(c.score / 2));
  let r = rng() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

const round1 = (n) => Math.round(n * 10) / 10;

/** "Chapati (Roti)" → "Chapati", "Bhindi Sabzi (Dry)" → "Bhindi Sabzi". */
function displayName(name) {
  const cleaned = String(name).replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || String(name);
}

function joinNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function conditionFlags(userData) {
  const text = [...(userData.medicalConditions || []), userData.diabetesInfo ? 'diabetes' : ''].join(' ').toLowerCase();
  return {
    diabetes: Boolean(userData.diabetesInfo) || /diabet|blood sugar/.test(text),
    hypertension: /hypertension|high blood pressure|\bbp\b/.test(text),
    cholesterol: /cholesterol|lipid|cardiac|heart/.test(text),
    thyroid: /thyroid/.test(text),
  };
}

// ─── 1. pool ─────────────────────────────────────────────────────────────────

function foodText(food) {
  return { name: food.name, ingredients: (food.ingredients || []).map((i) => i.name) };
}

/** Why a food can never be served to this user, or null. */
function excludeReason(food, ctx) {
  const c = food.classification || {};
  if (food.isActive === false || food.mergedInto) return 'inactive';
  if (!['verified', 'estimated'].includes(food.dataQuality?.status)) return 'not reviewed';
  if ((food.dataQuality?.flags || []).some((f) => BAD_FLAGS.has(f))) return 'bad data';
  if (c.cuisine !== 'indian') return 'not Indian home food';
  if (JUNK_NAME.test(food.name)) return 'not a dish';
  if (!food.serving?.defaultGrams || !food.nutritionPer100g?.calories) return 'no nutrition';
  if (!ctx.dietTypes.includes(c.dietType)) return 'diet type';
  if ((food.allergens || []).some((a) => ctx.allergens.has(a))) return 'allergen';
  const text = foodText(food);
  if (!checkMealForDiet(ctx.diet, text).ok) return 'diet type (ingredients)';
  if (ctx.jain && ((food.tags || []).some((t) => t === 'contains_onion_garlic' || t === 'contains_root_veg') || !checkMealForJain(text).ok)) return 'not Jain';
  if (!checkMealForAvoids(ctx.avoidTerms, text).ok) return 'user exclusion';
  if (ctx.conditions.diabetes && (food.tags || []).includes('high_sugar')) return 'high sugar (diabetes)';
  return null;
}

/** Which meal roles a food can fill. */
function rolesOf(food) {
  const c = food.classification || {};
  const slots = new Set(c.mealSlots || []);
  const ld = slots.has('lunch') || slots.has('dinner');
  const roles = [];
  const unit = food.serving?.defaultUnit;
  switch (c.category) {
    case 'one-dish meal or breakfast item':
      if (slots.has('breakfast')) roles.push('bfMain');
      if (ld) roles.push('oneDish');
      break;
    case 'lentil or legume dish':
      if (ld) roles.push('dal');
      if (/\bsambar\b/i.test(food.name)) roles.push('sambar');
      break;
    case 'vegetable or paneer dish':
      if (ld) roles.push('sabzi');
      break;
    case 'meat or fish curry':
    case 'meat or fish (dry)':
    case 'egg dish':
      if (ld) roles.push('nonveg');
      break;
    case 'flatbread':
      if (isCountUnit(unit)) roles.push('flatbread');
      break;
    case 'plain rice':
      roles.push('rice');
      break;
    case 'raita or curd side':
      roles.push('curd');
      break;
    case 'salad':
      roles.push('salad');
      break;
    case 'chutney or condiment':
      if (slots.has('breakfast') && /chutney/i.test(food.name)) roles.push('chutney');
      break;
    default:
      break;
  }
  return roles;
}

// ─── 2. score ────────────────────────────────────────────────────────────────

function catalogComponents(ctx) {
  const ref = getReferenceDishes({ state: ctx.state, region: ctx.region, diet: ctx.diet, jain: ctx.jain, avoidTerms: ctx.avoidTerms });
  const out = {};
  for (const slot of MEAL_TYPES) {
    out[slot] = (ref[slot] || [])
      .flatMap((dish) => dish.split(/,|\band\b|\bwith\b/i))
      .map((s) => s.replace(/\([^)]*\)/g, '').trim())
      .filter((s) => tokens(s).length);
  }
  return out;
}

function familyOf(food) {
  const words = tokens(food.name);
  const hit = FAMILIES.find((w) => words.includes(w));
  return hit ? FAMILY_ALIASES[hit] || hit : `id:${food.foodId}`;
}

function matchesAny(name, phrases, min = 0.6) {
  return phrases.some((p) => tokenOverlap(name, p) >= min || tokens(p).every((t) => tokens(name).includes(t)));
}

function scoreFood(food, slot, ctx) {
  const tags = new Set(food.tags || []);
  const per = nutritionFor(food, food.serving.defaultGrams);
  let s = 0;

  // Place: the state's everyday dishes first, then the food's own region labels.
  if (matchesAny(food.name, ctx.catalog[slot] || [])) s += 2.5;
  const regions = food.classification?.regions || [];
  if (regions.some((r) => ctx.stateRegions.includes(r))) s += 1.5;
  else if (ctx.regionKey && regions.includes(ctx.regionKey)) s += 1;

  // The user's own favourites.
  const favs = [...(ctx.prefs.mealPreferences?.[slot] || []), ...(ctx.prefs.preferredFoods || [])];
  if (favs.length && matchesAny(food.name, favs, 0.5)) s += 3;

  // Everyday cooking over heavy food, more so on a deficit.
  const lose = ctx.goal === 'weight_loss';
  if (tags.has('deep_fried')) s -= lose ? 3 : 2;
  else if (tags.has('fried')) s -= lose ? 1.5 : 0.5;
  if (tags.has('ghee_heavy')) s -= lose ? 2 : 0.5;
  if ((ctx.goal === 'muscle_gain' || ctx.goal === 'weight_gain') && per.protein >= 12) s += 1;

  // Medical conditions (soft; the warnings engine still flags what remains when the meal is logged).
  if (ctx.conditions.diabetes) {
    if ((food.glycemicIndex || 0) >= 70) s -= 2;
    if (tags.has('refined_carb')) s -= 2;
    if (tags.has('rice_based')) s -= 1;
    if ((per.fiber || 0) >= 5) s += 1;
  }
  if (ctx.conditions.hypertension) {
    if ((per.sodium || 0) > 700) s -= 2;
    else if ((per.sodium || 0) > 400) s -= 1;
  }
  if (ctx.conditions.cholesterol) {
    if (tags.has('ghee_heavy') || tags.has('fried') || tags.has('deep_fried')) s -= 1.5;
    if (tags.has('red_meat')) s -= 1;
  }
  if (ctx.conditions.thyroid && tags.has('goitrogen')) s -= 0.5;

  // Better data first; last week's dishes less often.
  if (food.dataQuality?.status === 'verified') s += 1;
  if (ctx.previousFoodIds.has(food.foodId)) s -= 1.5;
  return s;
}

function buildContext(userData, opts = {}) {
  const diet = userData.dietaryPreference;
  const { prefs, jain } = reconcileFoodPreferences(diet, userData.foodPreferences);
  const allergies = userData.allergies || [];
  const stateKey = userData.state ? normalizeStateName(canonicalizeStateName(userData.state)) : '';
  const region = stateKey ? deriveRegionFromState(userData.state) : (userData.region && userData.region !== 'other' ? userData.region : null);
  const ctx = {
    diet,
    jain,
    prefs,
    dietTypes: DIET_FOOD_TYPES[diet] || DIET_FOOD_TYPES.other,
    allergens: allergensInText(allergies.join(' ')),
    avoidTerms: buildAvoidTerms({
      foodsToAvoid: prefs.foodsToAvoid || [],
      dietaryDont: prefs.dietaryDont || [],
      dietaryRestrictions: prefs.dietaryRestrictions || [],
      allergies,
    }),
    conditions: conditionFlags(userData),
    goal: normalizeGoal(userData.goal || userData.bmiGoal),
    state: userData.state || null,
    region,
    regionKey: region,
    stateRegions: STATE_FOOD_REGIONS[stateKey] || [],
    location: { city: userData.city, state: userData.state },
    previousFoodIds: new Set(opts.previousFoodIds || []),
    preferRice: ['south', 'east', 'northeast'].includes(region),
  };
  ctx.catalog = catalogComponents(ctx);
  return ctx;
}

/** Per-slot pools of { food, roles, score }. */
function buildPools(foods, ctx) {
  const eligible = [];
  for (const food of foods) {
    if (excludeReason(food, ctx)) continue;
    const roles = rolesOf(food);
    if (roles.length) eligible.push({ food, roles });
  }
  const pools = {};
  for (const slot of MEAL_TYPES) {
    const bySlot = {};
    for (const { food, roles } of eligible) {
      const slots = food.classification?.mealSlots || [];
      for (const role of roles) {
        // Sides and staples are allowed in any slot; dishes only in their own slot.
        const staple = ['flatbread', 'rice', 'curd', 'salad', 'chutney', 'sambar'].includes(role);
        if (!staple && role !== 'bfMain' && !slots.includes(slot)) continue;
        if (role === 'bfMain' && slot !== 'breakfast') continue;
        if (slot === 'breakfast' && ['dal', 'sabzi', 'nonveg', 'oneDish', 'rice'].includes(role)) continue;
        // The slot rules the AI plans are held to (no biryani for breakfast, nothing foreign…).
        const guard = checkMeal({ meal: { name: food.name }, slot, diet: ctx.diet });
        if (guard.soft.length || guard.hard.length) continue;
        (bySlot[role] = bySlot[role] || []).push({ food, role, family: familyOf(food), score: scoreFood(food, slot, ctx) });
      }
    }
    bySlot.dalOrSabzi = [...(bySlot.dal || []), ...(bySlot.sabzi || [])];
    bySlot.carb = [...(bySlot.flatbread || []), ...(bySlot.rice || [])];
    bySlot.side = [...(bySlot.salad || []), ...(bySlot.curd || [])];
    pools[slot] = bySlot;
  }
  return pools;
}

// ─── 4. portion ──────────────────────────────────────────────────────────────

const kcalPerGram = (food) => (food.nutritionPer100g.calories || 0) / 100;

/** Portion model for one component of a meal. */
function makeComponent(entry, kind) {
  const { food, role } = entry;
  const def = food.serving.defaultGrams;
  if (kind === 'fixed') {
    let grams = def;
    if (role === 'chutney') grams = Math.min(def, 30);
    if (role === 'curd') grams = Math.min(Math.max(def, 80), 150);
    if (role === 'salad') grams = Math.min(def, 150);
    return { entry, kind, grams: Math.round(grams) };
  }
  if (isCountUnit(food.serving.defaultUnit)) {
    const idli = /\bidli\b/i.test(food.name);
    const base = role === 'flatbread' ? 2 : idli ? 3 : /\bboiled egg\b/i.test(food.name) ? 2 : 1;
    const max = role === 'flatbread' ? 4 : idli ? 5 : 3;
    return { entry, kind: 'count', unitGrams: def, base, min: 1, max, count: base };
  }
  const [lo, hi] = role === 'rice' ? [0.5, 1.4] : role === 'sambar' ? [0.5, 1] : [0.6, 1.6];
  return { entry, kind: 'grams', base: def, min: def * lo, max: def * hi, grams: def };
}

function componentGrams(c) {
  return c.kind === 'count' ? c.count * c.unitGrams : c.grams;
}

function totalKcal(components) {
  return components.reduce((s, c) => s + componentGrams(c) * kcalPerGram(c.entry.food), 0);
}

function applyScale(components, s) {
  for (const c of components) {
    if (c.kind === 'count') c.count = Math.min(c.max, Math.max(c.min, Math.round(c.base * s)));
    else if (c.kind === 'grams') c.grams = Math.min(c.max, Math.max(c.min, Math.round((c.base * s) / 10) * 10));
  }
}

/** Fit portions to the budget. Returns false when no realistic portion gets close enough. */
function fitPortions(components, budget) {
  let bestS = 1;
  let bestGap = Infinity;
  for (let s = 0.3; s <= 2.5; s += 0.05) {
    applyScale(components, s);
    const gap = Math.abs(totalKcal(components) - budget);
    if (gap < bestGap) { bestGap = gap; bestS = s; }
  }
  applyScale(components, bestS);

  // Close the last gap with the most calorie-dense adjustable gram component.
  const adjustable = components.filter((c) => c.kind === 'grams').sort((a, b) => kcalPerGram(b.entry.food) - kcalPerGram(a.entry.food));
  for (const c of adjustable) {
    const gap = budget - totalKcal(components);
    if (Math.abs(gap) < budget * 0.01) break;
    const want = c.grams + gap / kcalPerGram(c.entry.food);
    c.grams = Math.round(Math.min(c.max, Math.max(c.min, want)) / 5) * 5;
  }
  return Math.abs(totalKcal(components) - budget) <= budget * SLOT_TOLERANCE;
}

function plural(unit, n) {
  if (n <= 1) return unit;
  return /(s|sh|ch|x)$/.test(unit) ? `${unit}es` : `${unit}s`;
}

/**
 * "1 bowl", "1.5 bowls", "2 pieces", or plain grams when no serving unit fits.
 * Prefers the food's default unit and whole amounts: "1 bowl" over "half large bowl".
 */
function portionText(food, grams, count) {
  if (count != null) return `${count} ${plural(food.serving.defaultUnit, count)}`;
  const units = food.serving.units?.length ? food.serving.units : [{ unit: food.serving.defaultUnit, grams: food.serving.defaultGrams }];
  let best = null;
  for (const u of units) {
    for (const m of [0.5, 1, 1.5, 2, 2.5, 3]) {
      const err = Math.abs(u.grams * m - grams) / grams;
      if (err > 0.15) continue;
      const cost = err + (m === 1 ? 0 : 0.04) + (u.unit === food.serving.defaultUnit ? 0 : 0.03);
      if (!best || cost < best.cost) best = { u, m, cost };
    }
  }
  if (!best) return `${Math.round(grams)} g`;
  return `${best.m === 0.5 ? '½' : best.m} ${plural(best.u.unit, best.m)}`;
}

// ─── 3 + 5. compose a meal ───────────────────────────────────────────────────

const OUT_FIELDS = ['calories', 'protein', 'carbs', 'fats', 'fiber', 'sugar', 'sodium', 'saturatedFat', 'iron', 'calcium', 'potassium', 'vitaminC'];
const MICRO_FIELDS = { vitaminA: 'vitaminA', vitaminD: 'vitaminD', magnesium: 'magnesium' };
const WHOLE_FIELDS = new Set(['calories', 'sodium', 'calcium', 'potassium']);

function sumNutrients(parts) {
  const out = {};
  for (const k of OUT_FIELDS) {
    const vals = parts.map((p) => p.nutrition[k]).filter((v) => v != null);
    out[k] = vals.length ? vals.reduce((s, v) => s + v, 0) : null;
    if (out[k] != null) out[k] = WHOLE_FIELDS.has(k) ? Math.round(out[k]) : round1(out[k]);
  }
  for (const [outKey, microKey] of Object.entries(MICRO_FIELDS)) {
    const vals = parts.map((p) => p.food.micronutrientsPer100g?.[microKey]).map((v, i) => (v == null ? null : (v * parts[i].grams) / 100)).filter((v) => v != null);
    out[outKey] = vals.length ? round1(vals.reduce((s, v) => s + v, 0)) : null;
  }
  out.vitaminB12 = null; // not in the Food DB
  out.omega3 = null;
  return out;
}

function benefitsLine(n, ctx) {
  const bits = [];
  if (n.protein >= 20) bits.push(`good protein (${Math.round(n.protein)} g)`);
  if (n.fiber >= 8) bits.push(`high fibre (${Math.round(n.fiber)} g)`);
  if (ctx.conditions.hypertension && n.sodium != null && n.sodium < 600) bits.push('moderate salt');
  bits.push('portions measured from the food database');
  const text = bits.join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Turn fitted components into the stored meal object (mealOptionSchema + items/source). */
function toMeal(components, ctx) {
  const parts = components.map((c) => {
    const grams = Math.round(componentGrams(c));
    return {
      c,
      food: c.entry.food,
      grams,
      nutrition: nutritionFor(c.entry.food, grams),
      portion: portionText(c.entry.food, grams, c.kind === 'count' ? c.count : null),
    };
  });
  const mains = parts.filter((p) => p.c.kind !== 'fixed' || p.c.entry.role === 'sambar');
  const sides = parts.filter((p) => !mains.includes(p));
  const mainName = joinNames(mains.map((p) => displayName(p.food.name)));
  // "Masala Dosa with Sambar and Chutney" already has a "with": add sides with "+" rather than a second one.
  const glue = /\bwith\b/i.test(mainName) ? ' + ' : ' with ';
  let name = sides.length ? `${mainName}${glue}${joinNames(sides.map((p) => displayName(p.food.name)))}` : mainName;
  if (name.length > 60 && sides.length) name = mainName;

  // "2 Chapati", "3 Rava Idli" for counted items; "1 bowl moong dal tadka" for measured ones.
  const label = (p) => (p.c.kind === 'count'
    ? `${p.c.count} ${displayName(p.food.name)}`
    : `${p.portion} ${displayName(p.food.name).toLowerCase()}`);

  const n = sumNutrients(parts);
  const ingredients = [...new Set(parts.flatMap((p) => (p.food.ingredients || []).map((i) => i.name)))].slice(0, 20);
  return {
    name,
    description: parts.map((p) => `${displayName(p.food.name)}: ${p.portion} (${p.grams} g)`).join(' · '),
    portionSize: parts.map(label).join(', '),
    ingredients,
    ...n,
    benefits: benefitsLine(n, ctx),
    items: parts.map((p) => ({
      foodId: p.food.foodId,
      name: p.food.name,
      grams: p.grams,
      portionText: p.portion,
      role: p.c.entry.role,
      calories: p.nutrition.calories,
    })),
    source: 'food_db',
  };
}

/** Roles for a breakfast main: the main plus its usual accompaniments. */
function breakfastRoles(main) {
  const rule = BREAKFAST_PAIRINGS.find((p) => p.re.test(main.food.name));
  if (!rule) return [];
  const lower = main.food.name.toLowerCase();
  return rule.sides.filter((side) => !lower.includes(side) && !(side === 'curd' && /dahi|raita/.test(lower)));
}

/**
 * One random combination for a slot/shape, or null. `blocked(entry)` keeps a dish (or dish
 * family) from repeating within the week and within the day; it applies to dishes, not to
 * roti, rice and sides, which repeat every day in a real home.
 */
function drawCombo(slot, shape, pools, rng, ctx, blocked) {
  const p = pools[slot];
  const comps = [];

  if (slot === 'breakfast') {
    const main = pick(p.bfMain || [], rng, blocked);
    if (!main) return null;
    comps.push(makeComponent(main, 'flex'));
    for (const role of breakfastRoles(main)) {
      const side = pick(p[role] || [], rng);
      if (!side) continue;
      comps.push(makeComponent(side, role === 'flatbread' || role === 'sambar' ? 'flex' : 'fixed'));
    }
    return comps;
  }

  for (const raw of TEMPLATES[shape]) {
    const optional = raw.startsWith('?');
    let role = optional ? raw.slice(1) : raw;
    if (role === 'carb') role = rng() < (ctx.preferRice ? 0.7 : 0.25) ? 'rice' : 'flatbread';
    const pool = p[role] || [];
    const isDish = ['dal', 'sabzi', 'dalOrSabzi', 'oneDish', 'nonveg'].includes(role);
    const taken = new Set(comps.map((c) => c.entry.family));
    const entry = pick(pool, rng, isDish ? (e) => blocked(e) || taken.has(e.family) : null);
    if (!entry) {
      if (optional) continue;
      return null;
    }
    const fixed = ['side', 'salad', 'curd'].includes(role);
    comps.push(makeComponent(entry, fixed ? 'fixed' : 'flex'));
  }
  return comps;
}

function comboScore(meal, comps, budget, slot, ctx) {
  const food = comps.reduce((s, c) => s + c.entry.score, 0) / comps.length;
  const proteinTarget = ctx.proteinGoal ? ctx.proteinGoal * SLOT_SHARES[slot] : null;
  // Under-shooting protein costs more than over-shooting it.
  const proteinGap = proteinTarget ? (proteinTarget - (meal.protein || 0)) / proteinTarget : 0;
  const proteinFit = proteinTarget ? -Math.min(2, proteinGap > 0 ? proteinGap * 1.5 : -proteinGap * 0.5) * 3 : 0;
  const calFit = -Math.abs(meal.calories - budget) / budget * 10;
  return food + proteinFit + calFit;
}

/** Best valid meal for the first shape that can produce one (later shapes are fallbacks), or null. */
function bestMeal(slot, shapes, budget, pools, rng, ctx, blocked, extraCheck) {
  for (const shape of [...new Set(shapes)]) {
    const best = bestMealForShape(slot, shape, budget, pools, rng, ctx, blocked, extraCheck);
    if (best) return best;
  }
  return null;
}

function bestMealForShape(slot, shape, budget, pools, rng, ctx, blocked, extraCheck) {
  let best = null;
  for (let i = 0; i < COMBO_TRIES; i++) {
    const comps = drawCombo(slot, shape, pools, rng, ctx, blocked);
    if (!comps || !fitPortions(comps, budget)) continue;
    const meal = toMeal(comps, ctx);
    if (extraCheck && !extraCheck(meal, comps)) continue;
    const guard = checkMeal({ meal, slot, diet: ctx.diet, jain: ctx.jain, avoidTerms: ctx.avoidTerms, location: ctx.location });
    if (guard.hard.length) continue;
    const score = comboScore(meal, comps, budget, slot, ctx);
    if (!best || score > best.score) best = { meal, comps, score };
  }
  return best;
}

const DISH_ROLES = new Set(['bfMain', 'dal', 'sabzi', 'oneDish', 'nonveg']);
const dishEntries = (comps) => comps.filter((c) => DISH_ROLES.has(c.entry.role)).map((c) => c.entry);

/** Tracks what a week has used: dish ids and family counts per slot, and families per day. */
function varietyTracker() {
  const ids = { breakfast: new Set(), lunch: new Set(), dinner: new Set() };
  const families = { breakfast: new Map(), lunch: new Map(), dinner: new Map() };
  let today = { ids: new Set(), families: new Set() };
  return {
    newDay() { today = { ids: new Set(), families: new Set() }; },
    blocked(slot) {
      return (e) => ids[slot].has(e.food.foodId)
        || today.ids.has(e.food.foodId)
        || (slot !== 'breakfast' && today.families.has(e.family))
        || (families[slot].get(e.family) || 0) >= MAX_FAMILY_PER_WEEK;
    },
    use(slot, comps) {
      for (const e of dishEntries(comps)) {
        ids[slot].add(e.food.foodId);
        today.ids.add(e.food.foodId);
        if (slot !== 'breakfast') today.families.add(e.family);
        families[slot].set(e.family, (families[slot].get(e.family) || 0) + 1);
      }
    },
  };
}

// ─── public: pure core ──────────────────────────────────────────────────────

/** Why the DB cannot plan for this user at all (the AI handles these), or null. */
function unsupportedReason(userData) {
  if (!DIET_FOOD_TYPES[userData.dietaryPreference]) return `diet type "${userData.dietaryPreference}" not supported`;
  if (userData.occasion) return 'occasion/fasting plans need the AI';
  if (userData.country && userData.country !== 'India') return 'country outside India';
  if (!userData.nutritionGoals?.dailyCalories) return 'no calorie target';
  return null;
}

/**
 * @param {object[]} foods Food documents (lean)
 * @param {object} userData same object the AI generator receives
 * @param {{previousFoodIds?: string[], seed?: number|string}} [opts]
 * @returns {{ok: true, plan: object, stats: object} | {ok: false, reason: string}}
 */
function generatePlanFromFoods(foods, userData, opts = {}) {
  const unsupported = unsupportedReason(userData);
  if (unsupported) return { ok: false, reason: unsupported };

  const ctx = buildContext(userData, opts);
  ctx.proteinGoal = userData.nutritionGoals?.protein || null;
  const pools = buildPools(foods, ctx);
  const rng = mulberry32(hashSeed(opts.seed ?? `${Date.now()}`));
  const target = Math.round(userData.nutritionGoals.dailyCalories);
  const budget = buildSlotBudget(target);

  const shapes = { lunch: shuffle(weeklyShapes('lunch', ctx.diet), rng), dinner: shuffle(weeklyShapes('dinner', ctx.diet), rng) };
  const variety = varietyTracker();
  const mealPlan = { breakfast: [], lunch: [], dinner: [] };
  let riceHeavyCount = 0;
  const notTooMuchBiryani = (meal) => !(RICE_HEAVY.test(meal.name) && riceHeavyCount >= 1);

  for (let day = 0; day < DAYS; day++) {
    variety.newDay();

    const bf = bestMeal('breakfast', ['_'], budget.breakfast, pools, rng, ctx, variety.blocked('breakfast'));
    if (!bf) return { ok: false, reason: `not enough breakfast dishes (day ${day + 1})` };
    variety.use('breakfast', bf.comps);

    const lunchShapes = [shapes.lunch[day], 'thali', 'oneDish'];
    const lu = bestMeal('lunch', lunchShapes, budget.lunch, pools, rng, ctx, variety.blocked('lunch'), notTooMuchBiryani);
    if (!lu) return { ok: false, reason: `not enough lunch dishes (day ${day + 1})` };
    variety.use('lunch', lu.comps);
    if (RICE_HEAVY.test(lu.meal.name)) riceHeavyCount++;

    // Dinner takes whatever the day still needs, inside dinner's own range.
    const range = slotCalorieRange('dinner', target);
    const dinnerBudget = Math.min(range.max, Math.max(range.min, target - bf.meal.calories - lu.meal.calories));
    const dinnerShapes = [shapes.dinner[day], 'light', 'thali'];
    const di = bestMeal('dinner', dinnerShapes, dinnerBudget, pools, rng, ctx, variety.blocked('dinner'), notTooMuchBiryani);
    if (!di) return { ok: false, reason: `not enough dinner dishes (day ${day + 1})` };
    variety.use('dinner', di.comps);
    if (RICE_HEAVY.test(di.meal.name)) riceHeavyCount++;

    mealPlan.breakfast.push(bf.meal);
    mealPlan.lunch.push(lu.meal);
    mealPlan.dinner.push(di.meal);
  }

  const dayTotals = Array.from({ length: DAYS }, (_, i) => MEAL_TYPES.reduce((s, m) => s + (mealPlan[m][i].calories || 0), 0));
  return {
    ok: true,
    plan: {
      dailyCalorieTarget: target,
      macroTargets: {
        protein: userData.nutritionGoals.protein,
        carbs: userData.nutritionGoals.carbs,
        fats: userData.nutritionGoals.fats,
      },
      mealPlan,
      generator: 'food_db',
    },
    stats: {
      poolSizes: Object.fromEntries(MEAL_TYPES.map((s) => [s, Object.fromEntries(Object.entries(pools[s]).map(([r, l]) => [r, l.length]))])),
      dayTotals,
      maxDayErrorPct: Math.max(...dayTotals.map((t) => Math.abs(t - target) / target * 100)),
    },
  };
}

/**
 * One replacement meal (single-slot regenerate).
 * @param {{slot: string, budget: number, excludeFoodIds?: string[], seed?: any}} opts
 * @returns {object|null} meal
 */
function generateMealFromFoods(foods, userData, { slot, budget, excludeFoodIds = [], seed } = {}) {
  if (!MEAL_TYPES.includes(slot) || !budget) return null;
  if (unsupportedReason({ ...userData, nutritionGoals: { dailyCalories: budget } })) return null;
  const ctx = buildContext(userData);
  ctx.proteinGoal = userData.nutritionGoals?.protein || null;
  const pools = buildPools(foods, ctx);
  const rng = mulberry32(hashSeed(seed ?? `${Date.now()}`));
  const shapes = slot === 'breakfast' ? ['_'] : shuffle(Object.keys(TEMPLATES).filter((s) => s !== 'nonveg' || ['non-vegetarian', 'eggetarian'].includes(ctx.diet)), rng);
  const exclude = new Set(excludeFoodIds);
  const best = bestMeal(slot, shapes, budget, pools, rng, ctx, (e) => exclude.has(e.food.foodId));
  return best ? best.meal : null;
}

// ─── public: DB wrappers ────────────────────────────────────────────────────

const PLAN_PROJECTION = {
  foodId: 1, name: 1, classification: 1, allergens: 1, tags: 1, serving: 1, nutritionPer100g: 1,
  micronutrientsPer100g: 1, glycemicIndex: 1, ingredients: 1, dataQuality: 1, isActive: 1, mergedInto: 1,
};
const FOODS_TTL_MS = 10 * 60 * 1000;
let foodsCache = { foods: null, loadedAt: 0 };

async function loadPlanFoods() {
  if (foodsCache.foods && Date.now() - foodsCache.loadedAt < FOODS_TTL_MS) return foodsCache.foods;
  const Food = require('../../models/Food'); // lazy: the pure core stays usable without Mongo
  const foods = await Food.find(
    { isActive: true, mergedInto: null, 'dataQuality.status': { $in: ['verified', 'estimated'] }, 'classification.cuisine': 'indian' },
    PLAN_PROJECTION,
  ).lean();
  foodsCache = { foods, loadedAt: Date.now() };
  return foods;
}

function isEnabled() {
  return process.env.FOOD_DB_DIET_ENABLED === 'true';
}

async function generatePlan(userData, opts = {}) {
  const unsupported = unsupportedReason(userData);
  if (unsupported) return { ok: false, reason: unsupported };
  return generatePlanFromFoods(await loadPlanFoods(), userData, opts);
}

async function generateMeal(userData, opts) {
  return generateMealFromFoods(await loadPlanFoods(), userData, opts);
}

/** foodIds used by a stored plan's DB meals (to vary next week's plan). */
function planFoodIds(plan) {
  const ids = [];
  for (const slot of MEAL_TYPES) {
    for (const meal of plan?.mealPlan?.[slot] || []) {
      for (const item of meal?.items || []) if (item?.foodId && DISH_ROLES.has(item.role)) ids.push(item.foodId);
    }
  }
  return [...new Set(ids)];
}

module.exports = {
  isEnabled,
  generatePlan,
  generateMeal,
  planFoodIds,
  // pure core + helpers, for tests
  generatePlanFromFoods,
  generateMealFromFoods,
  unsupportedReason,
  excludeReason,
  buildContext,
  portionText,
  displayName,
  DISH_ROLES,
};
