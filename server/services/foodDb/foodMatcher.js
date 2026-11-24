/**
 * Food matcher: ranks foods in the `foods` collection against a name (docs/FOOD_DB_FLOW.md section 10).
 *
 * Active foods are held in a small in-memory index (only the fields needed to rank and list them),
 * loaded on first use and refreshed every INDEX_TTL_MS. ~1.3k foods score in a few milliseconds,
 * so there is no Mongo query per search. Full documents (ingredients, micronutrients) are fetched
 * by foodId only when a caller needs them.
 *
 * Scoring for one query against one name variant (name or alias):
 *   recall    = query words matched / query words      (did we explain what was asked?)
 *   precision = query words matched / variant words    (does the food add unrelated words?)
 *   spelling  = similarity of the word-sorted strings  (catches typos and joined words)
 *   score     = 0.45·recall + 0.25·precision + 0.30·spelling, or 1 for an exact normalised match
 * The food's score is the best over its variants.
 */
const { tokens, ratio, countTokenMatches } = require('./normalize');

const MATCH_THRESHOLD = 0.8; // ≥ → use the food
const SUGGEST_THRESHOLD = 0.6; // ≥ → use the best food but also return suggestions; below → AI fallback
const INDEX_TTL_MS = 10 * 60 * 1000;
const WEIGHTS = { recall: 0.45, precision: 0.25, spelling: 0.3 };
const STATUS_RANK = { verified: 0, estimated: 1, ai_pending: 2 };

const INDEX_PROJECTION = {
  foodId: 1, name: 1, aliases: 1, classification: 1, allergens: 1, tags: 1, serving: 1,
  nutritionPer100g: 1, glycemicIndex: 1, 'dataQuality.status': 1, 'stats.hitCount': 1,
};

// Words that describe the default version of a dish. Ignored on both sides so "omelette"
// prefers "Plain Omelette" over "Corn Omelette", and "plain rice" finds "Steamed Rice (White)".
const NEUTRAL = new Set(['plain', 'simple', 'regular', 'basic', 'classic', 'normal', 'steamed', 'boiled',
  'white', 'cooked', 'hot', 'homestyle', 'traditional']);

function variantOf(text, { isQuery = false } = {}) {
  let toks = [...new Set(tokens(text))];
  // "2 roti" → "roti": a leading count is a portion. Numbers elsewhere stay ("chicken 65").
  if (isQuery) while (toks.length > 1 && /^\d+$/.test(toks[0])) toks = toks.slice(1);
  const core = toks.filter((t) => !NEUTRAL.has(t));
  if (core.length) toks = core;
  return { toks, sorted: [...toks].sort().join(' ') };
}

/** Build an in-memory index from food documents (lean objects). Exported for tests. */
function buildIndex(foods) {
  return foods.map((food) => {
    const seen = new Set();
    const variants = [];
    for (const [text, kind] of [[food.name, 'name'], ...(food.aliases || []).map((a) => [a, 'alias'])]) {
      const v = variantOf(text);
      if (!v.toks.length || seen.has(v.sorted)) continue;
      seen.add(v.sorted);
      variants.push({ ...v, kind });
    }
    return { food, variants };
  });
}

function scoreVariant(q, v, { prefixLast }) {
  if (q.sorted === v.sorted) return 1;
  const m = countTokenMatches(q.toks, v.toks, { prefixLast });
  const recall = m / q.toks.length;
  const precision = m / v.toks.length;
  const spelling = ratio(q.sorted, v.sorted);
  return WEIGHTS.recall * recall + WEIGHTS.precision * precision + WEIGHTS.spelling * spelling;
}

/**
 * Rank foods for one or more query names (e.g. the LLM's name + its candidates).
 * Returns [{ food, score, matchedOn, matchedText }] sorted best first.
 */
function rankFoods(index, queries, { limit = 5, minScore = 0, prefixLast = false } = {}) {
  const qs = [].concat(queries).filter(Boolean).map((q) => variantOf(q, { isQuery: true })).filter((q) => q.toks.length);
  if (!qs.length) return [];
  const results = [];
  for (const entry of index) {
    let best = null;
    for (const q of qs) {
      for (const v of entry.variants) {
        const s = scoreVariant(q, v, { prefixLast });
        if (!best || s > best.score) best = { score: s, variant: v };
      }
    }
    if (!best || best.score < minScore) continue;
    const exact = best.score === 1;
    results.push({
      food: entry.food,
      score: Math.round(best.score * 1000) / 1000,
      matchedOn: exact ? best.variant.kind : 'fuzzy',
    });
  }
  results.sort((a, b) => (b.score - a.score)
    || ((STATUS_RANK[a.food.dataQuality?.status] ?? 9) - (STATUS_RANK[b.food.dataQuality?.status] ?? 9))
    || ((b.food.stats?.hitCount || 0) - (a.food.stats?.hitCount || 0))
    || (a.food.name.length - b.food.name.length));
  return results.slice(0, limit);
}

// ── index cache ─────────────────────────────────────────────────────────────
let cache = { index: null, loadedAt: 0, loading: null };

async function loadIndex() {
  const Food = require('../../models/Food'); // lazy: keeps this module usable in tests without Mongo
  const foods = await Food.find({ isActive: true, 'dataQuality.status': { $ne: 'rejected' } }, INDEX_PROJECTION).lean();
  return buildIndex(foods);
}

async function getIndex() {
  const fresh = cache.index && Date.now() - cache.loadedAt < INDEX_TTL_MS;
  if (fresh) return cache.index;
  if (!cache.loading) {
    cache.loading = loadIndex()
      .then((index) => {
        cache = { index, loadedAt: Date.now(), loading: null };
        return index;
      })
      .catch((err) => {
        cache.loading = null;
        if (cache.index) return cache.index; // keep serving the old index if a refresh fails
        throw err;
      });
  }
  return cache.loading;
}

/** Drop the cached index (call after admin edits or an AI-created food is saved). */
function invalidateIndex() {
  cache = { index: null, loadedAt: 0, loading: null };
}

async function searchFoods(query, opts = {}) {
  return rankFoods(await getIndex(), query, opts);
}

// ── response helpers ────────────────────────────────────────────────────────
const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10);

/**
 * Nutrition for `grams` of a food. Grams: 1 decimal; mg and kcal: whole numbers; iron and
 * vitamin C (small mg values): 1 decimal. `saturatedFat` uses the FoodLog field name (stored as
 * `satFat` in the foods collection). null = not known for this food.
 */
function nutritionFor(food, grams) {
  const n = food.nutritionPer100g || {};
  const f = grams / 100;
  const val = (k) => (n[k] == null ? null : n[k] * f);
  const whole = (k) => (val(k) == null ? null : Math.round(val(k)));
  return {
    calories: whole('calories'),
    protein: round1(val('protein')),
    carbs: round1(val('carbs')),
    fats: round1(val('fats')),
    fiber: round1(val('fiber')),
    sugar: round1(val('sugar')),
    sodium: whole('sodium'),
    saturatedFat: round1(val('satFat')),
    cholesterol: whole('cholesterol'),
    potassium: whole('potassium'),
    calcium: whole('calcium'),
    iron: round1(val('iron')),
    vitaminC: round1(val('vitaminC')),
  };
}

/** Shape of one result in GET /api/foods/search (section 7.1). */
function toSearchResult({ food, score, matchedOn }) {
  return {
    foodId: food.foodId,
    name: food.name,
    matchScore: score,
    matchedOn,
    dietType: food.classification?.dietType,
    category: food.classification?.category,
    defaultServing: { unit: food.serving.defaultUnit, grams: food.serving.defaultGrams },
    nutritionPerServing: nutritionFor(food, food.serving.defaultGrams),
    glycemicIndex: food.glycemicIndex ?? null,
    dataStatus: food.dataQuality?.status,
  };
}

module.exports = {
  MATCH_THRESHOLD, SUGGEST_THRESHOLD,
  buildIndex, rankFoods, getIndex, invalidateIndex, searchFoods, nutritionFor, toSearchResult,
};
