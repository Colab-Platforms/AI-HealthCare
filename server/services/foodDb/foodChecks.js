/**
 * Plausibility checks for per-100 g nutrition (docs/FOOD_DB_FLOW.md sections 4.3 and 8.2).
 * Shared by the seed build (scripts/foodDb/buildFoodSeed.js) and the AI fallback
 * (services/foodDb/aiFoodFallback.js), so both reject the same kinds of bad data.
 */
const LIMITS = { calories: 900, fats: 100, protein: 100, carbs: 100, sodium: 5000, macroSum: 105 };
const CONDIMENT_SODIUM_LIMIT = 10000; // pickles/sauces are salty but eaten by the spoon
const KCAL_TOLERANCE_ABS = 15; // kcal; small foods with tiny absolute gaps are fine
const CONTAINER_UNITS = new Set(['bowl', 'soup bowl', 'plate', 'dish', 'glass', 'cup', 'serving']);

const r2 = (n) => (n == null || Number.isNaN(n) ? null : Math.round(n * 100) / 100);

/** Calories vs 4·carbs + 4·protein + 9·fat. Seed build: 25 % tolerance; AI fallback: 20 %. */
function kcalCheck(n, tolerance = 0.25) {
  const calc = 4 * (n.carbs || 0) + 4 * (n.protein || 0) + 9 * (n.fats || 0);
  const diff = Math.abs(calc - (n.calories || 0));
  const rel = n.calories ? diff / n.calories : (calc > KCAL_TOLERANCE_ABS ? 1 : 0);
  return { ok: !(rel > tolerance && diff > KCAL_TOLERANCE_ABS), calc: r2(calc) };
}

/**
 * Frying oil counted into the dish: 60–90 g fat per 100 g with almost no carbs/protein
 * (Anuvaad pakoras, puris, kofta curries…). Condiments and salads can legitimately be this fatty.
 */
function oilDominant(n, category) {
  if (['chutney or condiment', 'salad'].includes(category)) return false;
  const fat = n.fats || 0;
  const kcal = n.calories || 0;
  return fat >= 30 && kcal > 0 && (9 * fat) / kcal >= 0.75 && (n.carbs || 0) + (n.protein || 0) < 25;
}

/** Per-100 g limits; returns a list of problems (empty = fine). */
function rangeCheck(n, category) {
  const problems = [];
  const limits = category === 'chutney or condiment' ? { ...LIMITS, sodium: CONDIMENT_SODIUM_LIMIT } : LIMITS;
  for (const k of ['calories', 'fats', 'protein', 'carbs', 'sodium']) {
    if (n[k] == null) problems.push(`${k} missing`);
    else if (n[k] < 0) problems.push(`${k} negative`);
    else if (n[k] > limits[k]) problems.push(`${k} ${r2(n[k])} > ${limits[k]}`);
  }
  const sum = (n.protein || 0) + (n.carbs || 0) + (n.fats || 0) + (n.fiber || 0);
  if (sum > LIMITS.macroSum) problems.push(`protein+carbs+fats+fiber ${r2(sum)} > ${LIMITS.macroSum}`);
  if (oilDominant(n, category)) problems.push(`oil-dominant: fat ${r2(n.fats)} g, carbs+protein ${r2((n.carbs || 0) + (n.protein || 0))} g`);
  return problems;
}

/** small / regular / large for containers; a single entry for countable units (piece, roti…). */
function servingUnits(unit, grams) {
  if (CONTAINER_UNITS.has(unit)) {
    return [
      { unit: `small ${unit}`, grams: Math.round(grams * 0.6) },
      { unit, grams: Math.round(grams) },
      { unit: `large ${unit}`, grams: Math.round(grams * 1.5) },
    ];
  }
  return [{ unit, grams: Math.round(grams) }];
}

module.exports = { LIMITS, CONDIMENT_SODIUM_LIMIT, kcalCheck, oilDominant, rangeCheck, servingUnits };
