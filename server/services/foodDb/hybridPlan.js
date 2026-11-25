/**
 * Hybrid diet plan: the Food DB builds the week, the AI writes a share of the meals
 * (docs/FOOD_DB_FLOW.md section 13.6).
 *
 *   const r = await generateHybridPlan(userData, { previousFoodIds, share, userId });
 *   r.ok → r.plan (generator 'hybrid', or 'food_db' if the AI added nothing); else fall back to the AI generator.
 *
 * 1. The DB builds the full week (dietPlanGenerator), exactly as a DB-only plan.
 * 2. About `share` of the 21 meals go to the AI, rotating so each day loses one slot before any day
 *    loses two, and no slot type always goes to the AI.
 * 3. ONE model call writes those meals as separate dishes with grams. It is shown the DB meals of
 *    the week so its meals fit with them, and each meal's calorie budget.
 * 4. Each dish is looked up in the Food DB (matcher ≥ MATCH_THRESHOLD). A dish the DB does not have
 *    goes through aiFoodFallback: checked, and saved as a new `ai_pending` food. This is how the DB
 *    grows. The AI's own calorie numbers are never used: nutrition always comes from the food record.
 * 5. The same portion fitter and checks as DB meals run on it. Its budget is the calories of the DB
 *    meal it replaces, so every day still lands on the target.
 * 6. Any AI meal that fails (unknown dish, diet/allergy/Jain rule, repeat, portions) keeps the DB
 *    meal. If the model call fails, the user gets the DB plan.
 *
 * Every meal, DB or AI, stores `items: [{ foodId, grams }]`, so logging and images work the same.
 * AI meals are marked `source: 'ai_db'` (picked by the AI, nutrition from the DB).
 */
const G = require('./dietPlanGenerator');
const { MEAL_TYPES, SLOT_SHARES } = require('../../config/indianMealSlots');
const { checkMeal } = require('../../utils/mealGuard');
const { tokens } = require('./normalize');

const MAX_ITEMS = 5;
const MAX_NEW_FOODS = 8; // per plan: each unknown dish costs one fallback call
const MODEL_MAX_TOKENS = 3000;
const AI_SOURCE = 'ai_db';
const FIXED_ROLES = new Set(['curd', 'salad', 'chutney']);
const EGG_DISH = /\b(egg|eggs|omelette|omelet|bhurji|anda)\b/i;

const DIET_LINES = {
  vegan: 'VEGAN: no meat, fish, egg, milk, curd, paneer, ghee, butter, cream or honey.',
  vegetarian: 'VEGETARIAN: no meat, fish, seafood or egg. Milk, curd and paneer are fine.',
  jain: 'JAIN: vegetarian, and no onion, garlic, potato, carrot, radish, beetroot or any root vegetable.',
  eggetarian: 'EGGETARIAN: eggs are fine; no meat, fish or seafood.',
  'non-vegetarian': 'NON-VEGETARIAN: chicken, fish, mutton and eggs are fine, alongside vegetarian meals.',
  other: 'VEGETARIAN: no meat, fish, seafood or egg.',
};

const nameKey = (s) => tokens(String(s || '')).join(' ');

// ─── 1. which meals go to the AI ────────────────────────────────────────────

/**
 * [{ day, slot }] for round(21 × share) meals. First one meal per day (slot rotating by day), then a
 * second per day, so a 50 % share is 7 days × 1 + 4 days × 2.
 */
function chooseAiSlots(share, rng, days = 7) {
  const total = Math.round(days * MEAL_TYPES.length * Math.min(1, Math.max(0, share)));
  const offset = Math.floor(rng() * MEAL_TYPES.length);
  const order = [];
  for (let round = 0; round < MEAL_TYPES.length; round++) {
    for (let day = 0; day < days; day++) {
      order.push({ day, slot: MEAL_TYPES[(day + round + offset) % MEAL_TYPES.length] });
    }
  }
  return order.slice(0, total);
}

// ─── 2. the prompt ──────────────────────────────────────────────────────────

function listOrNone(list) {
  const clean = (list || []).filter((x) => typeof x === 'string' && x.trim());
  return clean.length ? clean.join(', ') : 'none';
}

function buildPrompt(userData, ctx, mealPlan, slots, budgets) {
  const days = mealPlan.breakfast.length;
  const aiKeys = new Set(slots.map((s) => `${s.day}:${s.slot}`));
  const week = [];
  for (let d = 0; d < days; d++) {
    const parts = MEAL_TYPES.map((slot) => `${slot}: ${aiKeys.has(`${d}:${slot}`) ? '(you write this)' : mealPlan[slot][d].name}`);
    week.push(`Day ${d + 1} — ${parts.join(' | ')}`);
  }
  const toWrite = slots.map((s) => {
    const kcal = budgets.get(`${s.day}:${s.slot}`);
    const protein = ctx.proteinGoal ? `, about ${Math.round(ctx.proteinGoal * SLOT_SHARES[s.slot])} g protein` : '';
    return `- day ${s.day + 1} ${s.slot}: about ${kcal} kcal${protein}`;
  });
  const typical = MEAL_TYPES.map((slot) => `${slot}: ${(ctx.catalog[slot] || []).slice(0, 12).join(', ') || 'any common dish'}`);
  const location = [userData.city, userData.state].filter(Boolean).join(', ') || ctx.region || 'India';
  const prefs = ctx.prefs || {};
  const conditions = [...(userData.medicalConditions || []), userData.diabetesInfo ? 'diabetes' : ''].filter(Boolean);

  const system = `You are an Indian clinical dietitian completing a weekly home-food meal plan. ${DIET_LINES[ctx.diet] || DIET_LINES.other} Respond ONLY with valid JSON.`;
  const prompt = `Most of this 7-day plan was built from our food database. Write the meals marked "(you write this)".

USER
- Diet: ${DIET_LINES[ctx.diet] || DIET_LINES.other}
- Never include (allergies and exclusions, also inside masalas and garnishes): ${listOrNone([...(userData.allergies || []), ...(prefs.foodsToAvoid || []), ...(prefs.dietaryDont || [])])}
- Medical conditions: ${listOrNone(conditions)}
- Goal: ${ctx.goal || 'maintain'}
- Lives in: ${location}
- Favourite dishes: ${listOrNone([...(prefs.preferredFoods || []), ...Object.values(prefs.mealPreferences || {}).flat()])}

THE WEEK
${week.join('\n')}

MEALS TO WRITE
${toWrite.join('\n')}

DISHES TYPICAL OF THE USER'S REGION
${typical.join('\n')}

RULES
1. Each meal is 1 to ${MAX_ITEMS - 1} dishes eaten together, served the way an ordinary home serves them (dal + sabzi + roti + salad; idli + sambar + chutney; paratha + curd).
2. Each item is ONE dish or staple under its common Indian name ("Moong Dal Tadka", "Bhindi Sabzi", "Chapati", "Steamed Rice", "Cucumber Raita"). Never combine two dishes in one item. No brand names, no "special" or "restaurant style".
3. Fit the week: the same style of food as the other meals, but do not repeat a main dish already in the week or in another meal you write.
4. Everyday dishes cooked at home in the user's region. Nothing exotic, nothing chosen only to be different.
5. "grams" = cooked weight eaten. Together the items should come close to the meal's kcal.
6. "role": "main" (dal, sabzi, curry, egg or meat dish, or a one-dish meal such as poha or khichdi), "flatbread", "rice", or "side" (curd, raita, salad, chutney, sambar).

Return exactly:
{"meals":[{"day":1,"slot":"lunch","items":[{"name":"","role":"main","grams":0}]}]}`;
  return { system, prompt };
}

/** Model reply → Map("day:slot" → [{ name, role, grams }]) for the slots asked for. */
function parseMeals(raw, slots) {
  const wanted = new Set(slots.map((s) => `${s.day}:${s.slot}`));
  const out = new Map();
  for (const m of Array.isArray(raw?.meals) ? raw.meals : []) {
    const key = `${Number(m?.day) - 1}:${String(m?.slot || '').toLowerCase()}`;
    if (!wanted.has(key) || out.has(key)) continue;
    const items = (Array.isArray(m.items) ? m.items : [])
      .map((i) => ({ name: String(i?.name || '').trim().slice(0, 80), role: String(i?.role || 'main').toLowerCase(), grams: Number(i?.grams) }))
      .filter((i) => i.name)
      .slice(0, MAX_ITEMS);
    if (items.length) out.set(key, items);
  }
  return out;
}

// ─── 3. one AI meal → a DB meal ─────────────────────────────────────────────

/** The generator's role for an AI item: what the food is, guided by what the AI said it was. */
function internalRole(aiRole, food, slot) {
  const roles = G.rolesOf(food);
  if (aiRole === 'flatbread' && roles.includes('flatbread')) return 'flatbread';
  if (aiRole === 'rice' || roles.includes('rice')) return 'rice';
  if (roles.includes('flatbread')) return 'flatbread';
  if (aiRole === 'side') return roles.find((r) => ['sambar', 'curd', 'salad', 'chutney'].includes(r)) || 'salad';
  const dish = roles.find((r) => G.DISH_ROLES.has(r));
  if (dish) return dish;
  if (roles.includes('sambar')) return 'sambar';
  return slot === 'breakfast' ? 'bfMain' : 'oneDish';
}

/** Portion model for an AI item, starting from the grams the AI chose rather than the default serving. */
function aiComponent(food, role, aiGrams) {
  const def = food.serving.defaultGrams;
  const grams = Number.isFinite(aiGrams) && aiGrams >= 10 && aiGrams <= 1000 ? aiGrams : def;
  const entry = { food, role, family: G.familyOf(food), score: 0 };
  if (FIXED_ROLES.has(role)) {
    const cap = role === 'chutney' ? 30 : 150;
    return { entry, kind: 'fixed', grams: Math.round(Math.min(grams, cap)) };
  }
  if (G.isCountUnit(food.serving.defaultUnit)) {
    const count = Math.max(1, Math.round(grams / def));
    return { entry, kind: 'count', unitGrams: def, base: count, min: 1, max: Math.max(count + 1, role === 'flatbread' ? 4 : 3), count };
  }
  const [lo, hi] = role === 'rice' ? [0.5, 1.4] : [0.6, 1.6];
  return { entry, kind: 'grams', base: grams, min: grams * lo, max: grams * hi, grams };
}

/**
 * @returns {{ meal: object } | { error: string }}
 */
function buildAiMeal(items, foodsByName, { slot, budget, ctx, blockedIds }) {
  const comps = [];
  for (const item of items) {
    const food = foodsByName.get(nameKey(item.name));
    if (!food?.foodId) return { error: `"${item.name}" not in the food DB` };
    const reason = G.dishReason(food, ctx);
    if (reason) return { error: `"${item.name}" → ${food.foodId}: ${reason}` };
    if (comps.some((c) => c.entry.food.foodId === food.foodId)) continue; // same food named twice
    comps.push(aiComponent(food, internalRole(item.role, food, slot), item.grams));
  }
  if (!comps.length) return { error: 'no dishes' };
  const dishes = comps.filter((c) => G.DISH_ROLES.has(c.entry.role));
  if (!dishes.length) return { error: 'no main dish' };
  const repeat = dishes.find((c) => blockedIds.has(c.entry.food.foodId));
  if (repeat) return { error: `repeats ${repeat.entry.food.name}` };
  // Live test: "Masala Omelette, Egg Curry with 2 Roti and Thalipeeth" for breakfast. Two dishes of
  // one kind (two egg dishes, two dals), or a ready-made plate ("X with Rice/Roti") plus other
  // dishes, is not a meal anyone serves. The DB generator has the same rule.
  const kindOf = (c) => (EGG_DISH.test(c.entry.food.name) ? 'egg' : c.entry.family); // omelette + bhurji = two egg dishes
  const families = dishes.map(kindOf).filter((f) => !f.startsWith('id:'));
  const dup = families.find((f, i) => families.indexOf(f) !== i);
  if (dup) return { error: `two ${dup} dishes` };
  const plate = dishes.find((c) => c.entry.food.classification?.category === 'one-dish meal or breakfast item' && /\bwith\b/i.test(c.entry.food.name));
  if (plate && comps.some((c) => c !== plate && c.kind !== 'fixed' && c.entry.role !== 'sambar')) {
    return { error: `${plate.entry.food.name} is a full plate, served with other dishes` };
  }
  if (!G.fitPortions(comps, budget)) return { error: 'portions cannot reach the calorie budget' };

  const meal = { ...G.toMeal(comps, ctx), source: AI_SOURCE };
  const guard = checkMeal({ meal, slot, diet: ctx.diet, jain: ctx.jain, avoidTerms: ctx.avoidTerms, location: ctx.location });
  if (guard.hard.length) return { error: guard.hard.join('; ') };
  return { meal };
}

/** Dish foodIds the meal at (day, slot) must not repeat: the same slot all week, and the same day. */
function blockedFor(mealPlan, day, slot) {
  const ids = new Set();
  const add = (meal) => (meal?.items || []).forEach((i) => G.DISH_ROLES.has(i.role) && ids.add(i.foodId));
  mealPlan[slot].forEach((meal, d) => d !== day && add(meal));
  MEAL_TYPES.forEach((s) => s !== slot && add(mealPlan[s][day]));
  return ids;
}

// ─── 4. dish names → foods ──────────────────────────────────────────────────

/**
 * Default resolver (Mongo + matcher + aiFoodFallback). Map(nameKey → food) plus what it created.
 * Unknown dishes run through the fallback one at a time (its id allocation is sequential).
 */
async function resolveDishNames(names, { userId = null, maxNew = MAX_NEW_FOODS } = {}) {
  const M = require('./foodMatcher');
  const Food = require('../../models/Food');
  const { makeAiFallback } = require('./aiFoodFallback');

  const index = await M.getIndex();
  const byKey = new Map();
  const matchedIds = new Map();
  const unknown = [];
  for (const name of names) {
    const key = nameKey(name);
    if (!key || byKey.has(key) || matchedIds.has(key) || unknown.some((u) => nameKey(u) === key)) continue;
    const best = M.rankFoods(index, name, { limit: 1 })[0];
    if (best && best.score >= M.MATCH_THRESHOLD) matchedIds.set(key, best.food.foodId);
    else unknown.push(name);
  }

  const docs = matchedIds.size ? await Food.find({ foodId: { $in: [...new Set(matchedIds.values())] }, isActive: true }).lean() : [];
  const docById = new Map(docs.map((d) => [d.foodId, d]));
  for (const [key, id] of matchedIds) if (docById.has(id)) byKey.set(key, docById.get(id));

  const created = [];
  const aiFallback = makeAiFallback({ userId });
  for (const name of unknown.slice(0, maxNew)) {
    const fb = await aiFallback({ name, candidates: [], portionText: '', estGrams: null }).catch(() => null);
    // Only saved foods: an unsaved estimate has no foodId, so the meal could not be logged from it.
    if (fb?.saved && fb.food?.foodId) {
      byKey.set(nameKey(name), fb.food);
      if (fb.outcome === 'created') created.push(fb.food.foodId);
    }
  }

  const hitIds = [...new Set([...byKey.values()].map((f) => f.foodId))];
  if (hitIds.length) {
    Food.updateMany({ foodId: { $in: hitIds } }, { $inc: { 'stats.hitCount': 1 }, $set: { 'stats.lastMatchedAt': new Date() } })
      .catch((err) => console.error('[HybridPlan] hitCount update failed:', err.message));
  }
  return { foodsByName: byKey, createdFoodIds: created, skippedUnknown: unknown.slice(maxNew) };
}

/** Default model call: the same Claude client and retries as the AI diet generator. */
async function callModel({ system, prompt, userId }) {
  const dietAI = require('../dietRecommendationAI');
  const { robustJsonParse } = require('../../utils/aiParser');
  const text = await dietAI.makeAIRequest({
    max_tokens: MODEL_MAX_TOKENS,
    system,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    userId,
  });
  const json = String(text || '').match(/\{[\s\S]*\}/);
  return json ? robustJsonParse(json[0]) : null;
}

// ─── public ─────────────────────────────────────────────────────────────────

/**
 * Write `slots` of `mealPlan` with AI meals, in place. Shared by the whole-plan and single-meal paths.
 * @param {{ day: number, slot: string, budget?: number }[]} slots
 * @param {{ callModel?, resolveDishNames?, userId? }} deps
 * @returns {Promise<{ replaced: object[], kept: object[], createdFoodIds: string[], modelError?: string }>}
 */
async function fillAiSlots(userData, mealPlan, slots, deps = {}, extraBlocked = new Map()) {
  const ctx = G.buildContext(userData);
  ctx.proteinGoal = userData.nutritionGoals?.protein || null;
  const budgets = new Map(slots.map((s) => [`${s.day}:${s.slot}`, Math.round(s.budget || mealPlan[s.slot][s.day]?.calories || 0)]));
  const result = { replaced: [], kept: [], createdFoodIds: [] };

  let raw;
  try {
    const { system, prompt } = buildPrompt(userData, ctx, mealPlan, slots, budgets);
    raw = await (deps.callModel || callModel)({ system, prompt, userId: deps.userId || null });
  } catch (err) {
    result.modelError = err.message;
    return result;
  }
  const aiMeals = parseMeals(raw, slots);
  if (!aiMeals.size) {
    result.modelError = 'model returned no usable meals';
    return result;
  }

  const names = [...aiMeals.values()].flat().map((i) => i.name);
  const resolved = await (deps.resolveDishNames || resolveDishNames)(names, { userId: deps.userId || null });
  result.createdFoodIds = resolved.createdFoodIds || [];

  for (const s of slots) {
    const key = `${s.day}:${s.slot}`;
    const items = aiMeals.get(key);
    if (!items) { result.kept.push({ ...s, reason: 'not in the reply' }); continue; }
    const blockedIds = blockedFor(mealPlan, s.day, s.slot);
    for (const id of extraBlocked.get(key) || []) blockedIds.add(id);
    const built = buildAiMeal(items, resolved.foodsByName, { slot: s.slot, budget: budgets.get(key), ctx, blockedIds });
    if (built.error) { result.kept.push({ ...s, reason: built.error }); continue; }
    mealPlan[s.slot][s.day] = built.meal;
    result.replaced.push({ ...s, name: built.meal.name });
  }
  return result;
}

/**
 * DB plan + AI meals. Never worse than the DB plan: AI problems only mean fewer AI meals.
 * @returns {Promise<{ok: true, plan, stats} | {ok: false, reason}>}
 */
async function generateHybridPlan(userData, opts = {}, deps = {}) {
  const db = await (deps.generatePlan || G.generatePlan)(userData, { previousFoodIds: opts.previousFoodIds || [], seed: opts.seed });
  if (!db.ok) return db;

  const share = opts.share ?? G.aiShare();
  const rng = G.mulberry32(G.hashSeed(`${opts.seed ?? Date.now()}:ai`));
  const slots = chooseAiSlots(share, rng, db.plan.mealPlan.breakfast.length);
  if (!slots.length) return db;

  const fill = await fillAiSlots(userData, db.plan.mealPlan, slots, { ...deps, userId: opts.userId });
  const plan = { ...db.plan, generator: fill.replaced.length ? 'hybrid' : 'food_db' };
  const dayTotals = db.plan.mealPlan.breakfast.map((_, d) => MEAL_TYPES.reduce((s, m) => s + (plan.mealPlan[m][d].calories || 0), 0));
  return {
    ok: true,
    plan,
    stats: {
      ...db.stats,
      aiSlotsAsked: slots.length,
      aiMeals: fill.replaced.length,
      aiKept: fill.kept,
      createdFoodIds: fill.createdFoodIds,
      modelError: fill.modelError || null,
      dayTotals,
      maxDayErrorPct: Math.max(...dayTotals.map((t) => Math.abs(t - plan.dailyCalorieTarget) / plan.dailyCalorieTarget * 100)),
    },
  };
}

/**
 * One AI meal for a stored plan's slot (regenerating an AI meal). null when the AI meal fails,
 * so the caller can try the DB next.
 * @param {{ mealPlan: object, slot: string, dayIndex: number, budget: number, excludeFoodIds?: string[], userId? }} opts
 */
async function generateHybridMeal(userData, opts, deps = {}) {
  const mealPlan = {};
  for (const s of MEAL_TYPES) mealPlan[s] = [...(opts.mealPlan?.[s] || [])];
  if (!mealPlan[opts.slot]?.[opts.dayIndex]) return null;
  const slot = { day: opts.dayIndex, slot: opts.slot, budget: opts.budget };
  const extra = new Map([[`${opts.dayIndex}:${opts.slot}`, opts.excludeFoodIds || []]]);
  const fill = await fillAiSlots(userData, mealPlan, [slot], { ...deps, userId: opts.userId }, extra);
  if (!fill.replaced.length) {
    console.log(`[HybridPlan] AI ${opts.slot} not used: ${fill.modelError || fill.kept[0]?.reason}`);
    return null;
  }
  return mealPlan[opts.slot][opts.dayIndex];
}

module.exports = {
  generateHybridPlan,
  generateHybridMeal,
  // for tests
  chooseAiSlots,
  buildPrompt,
  parseMeals,
  buildAiMeal,
  internalRole,
  fillAiSlots,
  nameKey,
  AI_SOURCE,
};
