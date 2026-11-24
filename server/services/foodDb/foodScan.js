/**
 * Meal scan resolve (docs/FOOD_DB_FLOW.md sections 3, 7.2 and 10):
 * identified items → DB match → grams → nutrition → warnings → response data.
 *
 *   const data = await resolveMeal({ items, user, aiFallback });
 *
 * items: [{ name, candidates?, portionText?, estGrams?, foodId? }]
 *   foodId = the user picked this food (e.g. from "Did you mean…?"); it skips matching.
 * aiFallback(item) → { food, saved, outcome } | null, used for items that score below MATCH_THRESHOLD
 *   (services/foodDb/aiFoodFallback.js). `food` is Food-shaped, so the dish is built exactly like a
 *   DB match. outcome: 'created' (new ai_pending food) · 'linked' (an existing food under another
 *   name) · anything else = used for this scan only, not saved.
 */
const Food = require('../../models/Food');
const M = require('./foodMatcher');
const { buildUserHealthProfile, getMealWarnings } = require('./mealWarnings');
const WC = require('./warningConfig'); // called as WC.getWarningConfig() so tests can stub it

const MIN_GRAMS = 5;
const MAX_GRAMS = 3000;
const NUTRIENTS = ['calories', 'protein', 'carbs', 'fats', 'fiber', 'sugar', 'sodium',
  'saturatedFat', 'cholesterol', 'potassium', 'calcium', 'iron', 'vitaminC'];
const WHOLE = new Set(['calories', 'sodium', 'cholesterol', 'potassium', 'calcium']); // kcal / mg
const WORD_NUMBERS = { half: 0.5, one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

const r1 = (n) => (n == null ? null : Math.round(n * 10) / 10);

/** Grams eaten: the LLM's estimate, else the portion text mapped to the food's serving units, else the default. */
function resolveGrams(item, food) {
  const est = Number(item.estGrams);
  if (Number.isFinite(est) && est >= MIN_GRAMS && est <= MAX_GRAMS) return Math.round(est);

  const text = String(item.portionText || '').toLowerCase();
  const m = text.match(/^\s*(\d+(?:\.\d+)?|half|one|two|three|four|five|six|an?)\b/);
  const count = m ? (WORD_NUMBERS[m[1]] ?? Number(m[1])) : 1;
  const units = [...(food.serving?.units || [])].sort((a, b) => b.unit.length - a.unit.length); // "large plate" before "plate"
  const unit = units.find((u) => text.includes(u.unit));
  const base = unit ? unit.grams : food.serving.defaultGrams;
  return Math.min(MAX_GRAMS, Math.max(MIN_GRAMS, Math.round(base * (count || 1))));
}

// "0.4 g" for a pinch of cumin, whole grams otherwise
const gramsText = (g) => (g < 10 ? String(Math.round(g * 10) / 10) : String(Math.round(g)));

/** Ingredients scaled from one default serving to the grams eaten. */
function scaledIngredients(food, grams) {
  const f = grams / food.serving.defaultGrams;
  const sc = (v, round) => (v == null ? null : round(v * f));
  const whole = Math.round;
  return (food.ingredients || []).map((ing) => {
    const n = ing.nutritionPerServing;
    return {
      name: ing.name,
      quantity: ing.gramsPerServing != null ? `${gramsText(ing.gramsPerServing * f)} g` : '',
      // AI-created foods list ingredient names and grams only
      nutrition: n ? {
        calories: sc(n.calories, whole), protein: sc(n.protein, r1), carbs: sc(n.carbs, r1), fats: sc(n.fats, r1),
        fiber: sc(n.fiber, r1), sugar: sc(n.sugar, r1), sodium: sc(n.sodium, whole),
      } : null,
    };
  });
}

function sumNutrition(dishes) {
  const total = {};
  for (const k of NUTRIENTS) {
    const vals = dishes.map((d) => d.nutrition?.[k]).filter((v) => v != null);
    const sum = vals.length ? vals.reduce((s, v) => s + v, 0) : null;
    total[k] = sum == null ? null : (WHOLE.has(k) ? Math.round(sum) : r1(sum));
  }
  return total;
}

function buildDish(food, item, { matchScore, source, suggestions = [] }) {
  const grams = resolveGrams(item, food);
  const portion = item.portionText || `${food.serving.defaultUnit}`;
  return {
    foodId: food.foodId || null, // null = AI values used for this scan only (not saved)
    name: food.name,
    quantity: `${portion} (${grams} g)`,
    grams,
    matchScore,
    source,
    dataStatus: food.foodId ? food.dataQuality?.status ?? null : null,
    ingredients: scaledIngredients(food, grams),
    nutrition: M.nutritionFor(food, grams),
    glycemicIndex: food.glycemicIndex ?? null,
    allergens: food.allergens || [],
    suggestions,
  };
}

async function resolveMeal({ items, user, aiFallback = null }) {
  const index = await M.getIndex();

  // 1. Match every item (or take the food the user picked).
  //    Only a score ≥ MATCH_THRESHOLD is used. Below it the best guess is often a different dish
  //    (live test: "sauteed spinach" → Palak Paneer, "bacon" → Bacon and Mushroom Pancake), so the
  //    item goes to the AI fallback, carrying the close DB foods as "Did you mean…?" suggestions.
  const matches = items.map((item) => {
    if (item.foodId) return { item, foodId: item.foodId, score: item.matchScore ?? 1, matchedOn: 'user', suggestions: [] };
    const ranked = M.rankFoods(index, [item.name, ...(item.candidates || [])], { limit: 3 });
    const best = ranked[0];
    if (best && best.score >= M.MATCH_THRESHOLD) {
      return { item, foodId: best.food.foodId, score: best.score, matchedOn: best.matchedOn, suggestions: [] };
    }
    const suggestions = ranked.filter((r) => r.score >= M.SUGGEST_THRESHOLD)
      .map((r) => ({ foodId: r.food.foodId, name: r.food.name, matchScore: r.score }));
    return { item, foodId: null, score: best?.score ?? 0, suggestions };
  });

  // 2. Full documents (ingredients, micronutrients) for the matched foods.
  const ids = [...new Set(matches.map((m) => m.foodId).filter(Boolean))];
  const docs = ids.length ? await Food.find({ foodId: { $in: ids }, isActive: true }).lean() : [];
  const byId = new Map(docs.map((d) => [d.foodId, d]));

  // 3. Build dishes. Unmatched items (or a picked foodId that no longer exists) go to the AI fallback.
  const dishes = [];
  const forWarnings = [];
  const unresolved = [];
  const createdFoodIds = [];
  const hitIds = [];
  for (const m of matches) {
    const food = m.foodId ? byId.get(m.foodId) : null;
    if (food) {
      const dish = buildDish(food, m.item, { matchScore: m.score, source: 'food_db' });
      dishes.push(dish);
      hitIds.push(food.foodId);
      forWarnings.push({ food, grams: dish.grams });
      continue;
    }
    // Not in the DB (or a picked foodId that no longer exists): AI fallback, run one item at a time.
    const fb = aiFallback ? await aiFallback(m.item).catch((err) => {
      console.error(`[foodScan] AI fallback failed for "${m.item.name}":`, err.message);
      return null;
    }) : null;
    if (!fb?.food) { unresolved.push({ name: m.item.name, suggestions: m.suggestions || [] }); continue; }
    const linked = fb.outcome === 'linked'; // the AI's name is an existing DB food: use its stored values
    const dish = buildDish(fb.food, m.item, {
      matchScore: m.score,
      source: linked ? 'food_db' : 'ai_fallback',
      suggestions: linked ? [] : (m.suggestions || []), // close DB foods the user can switch to
    });
    dishes.push(dish);
    if (linked) hitIds.push(fb.food.foodId);
    if (fb.outcome === 'created') createdFoodIds.push(fb.food.foodId);
    forWarnings.push({ food: fb.food, grams: dish.grams });
  }

  // Popular foods rise in ties and in the admin review queue (section 8.4). Fire-and-forget.
  // (A newly created food starts at hitCount 1.)
  if (hitIds.length) {
    Food.updateMany({ foodId: { $in: hitIds } }, { $inc: { 'stats.hitCount': 1 }, $set: { 'stats.lastMatchedAt': new Date() } })
      .catch((err) => console.error('[foodScan] hitCount update failed:', err.message));
  }

  // 4. Warnings from the rules (section 9).
  const { warnings } = forWarnings.length
    ? getMealWarnings({ profile: buildUserHealthProfile(user), dishes: forWarnings, config: await WC.getWarningConfig() })
    : { warnings: [] };

  const nutrition = sumNutrition(dishes);
  const sources = new Set(dishes.map((d) => d.source));
  return {
    foodName: dishes.map((d) => d.name).join(', '),
    quantity: dishes.map((d) => d.quantity.replace(/\s*\(\d+ g\)$/, '')).filter(Boolean).join(', '),
    calories: nutrition.calories,
    protein: nutrition.protein,
    carbs: nutrition.carbs,
    fats: nutrition.fats,
    fiber: nutrition.fiber,
    nutrition,
    dishes,
    warnings,
    unresolved, // [{ name, suggestions }]: neither matched nor estimated (AI fallback off or failed)
    createdFoodIds, // ai_pending foods created by this scan (the controller links them to the saved scan)
    source: sources.size === 1 ? [...sources][0] : (sources.size ? 'mixed' : 'none'),
  };
}

/**
 * Typed text that names ONE food clearly ("chicken biryani", "2 roti") needs no LLM call.
 * Returns the items for resolveMeal, or null when the text needs the identifier.
 */
function itemsFromSimpleText(index, text, quantity) {
  const t = String(text || '').trim();
  if (!t || t.length > 60 || /,|\+|&|\band\b|\bwith\b/i.test(t)) return null;
  const best = M.rankFoods(index, t, { limit: 1 })[0];
  if (!best || best.score < M.MATCH_THRESHOLD) return null;
  const lead = t.match(/^\s*(\d+(?:\.\d+)?)\s+/);
  const portionText = quantity || (lead ? `${lead[1]} ${best.food.serving.defaultUnit}` : '');
  return [{ name: t, candidates: [], portionText, estGrams: null, foodId: best.food.foodId, matchScore: best.score }];
}

module.exports = { resolveMeal, resolveGrams, itemsFromSimpleText, sumNutrition };
