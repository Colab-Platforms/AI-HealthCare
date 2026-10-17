/**
 * Day-level calorie reconciliation for a generated meal plan.
 *
 * The plan contract is "breakfast[i] + lunch[i] + dinner[i] = daily target" for
 * every day i. The model only approximates that. The old fix scaled a day DOWN
 * when it overshot by more than 10% and did nothing when it undershot, so a
 * user on a surplus goal (bulking) could be handed a plan well under their
 * target and a user on a deficit could be handed one well over it — each the
 * opposite of what they asked for. This reconciles both directions.
 */

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];

// Every numeric nutrient the model returns. Scaled together with calories:
// scaling only calories would leave fibre/sodium/vitamins at their old values
// and inflate the nutrient-density maths in the Diet Quality Score.
const SCALED_FIELDS = [
  'calories', 'protein', 'carbs', 'fats',
  'fiber', 'sugar', 'sodium', 'saturatedFat',
  'vitaminA', 'vitaminC', 'vitaminD', 'vitaminB12',
  'iron', 'calcium', 'potassium', 'magnesium', 'omega3',
];

// A day is left alone within this band of the target (prompt asks for ±50 kcal,
// ~2.5% on 2000; the extra headroom avoids rewriting numbers over rounding).
const DEFAULT_TOLERANCE = 0.05;

// Beyond this factor the portion text ("2 rotis") no longer matches the
// numbers, so scaling would be fabricating data. Such days need regeneration,
// not arithmetic.
const MAX_SCALE_FACTOR = 1.3;
const MIN_SCALE_FACTOR = 1 / MAX_SCALE_FACTOR;

function mealCalories(meal) {
  const c = Number(meal?.calories);
  return Number.isFinite(c) && c > 0 ? c : 0;
}

/**
 * @param {object} mealPlan
 * @returns {{index: number, total: number, complete: boolean}[]}
 */
function dayTotals(mealPlan) {
  const days = Math.max(0, ...MEAL_TYPES.map((m) => (mealPlan?.[m] || []).length));
  const out = [];
  for (let i = 0; i < days; i++) {
    let total = 0;
    let complete = true;
    for (const m of MEAL_TYPES) {
      const c = mealCalories(mealPlan?.[m]?.[i]);
      if (!c) complete = false;
      total += c;
    }
    out.push({ index: i, total, complete });
  }
  return out;
}

/**
 * Days whose total is outside the tolerance band, with the direction.
 * Incomplete days (a slot missing) are reported too — they cannot be fixed by
 * scaling and must be regenerated.
 */
function findCalorieViolations(mealPlan, target, tolerance = DEFAULT_TOLERANCE) {
  if (!target) return [];
  return dayTotals(mealPlan)
    .filter((d) => !d.complete || Math.abs(d.total - target) / target > tolerance)
    .map((d) => ({ ...d, target, direction: d.total > target ? 'over' : 'under' }));
}

/**
 * Scale each out-of-band day onto the target, both directions, in place.
 *
 * @returns {{scaled: number[], unfixable: number[]}} day indexes scaled, and
 *   days too far off (or incomplete) to scale honestly.
 */
function normalizePlanCalories(mealPlan, target, tolerance = DEFAULT_TOLERANCE) {
  const scaled = [];
  const unfixable = [];
  if (!mealPlan || !target) return { scaled, unfixable };

  for (const day of findCalorieViolations(mealPlan, target, tolerance)) {
    if (!day.complete || day.total <= 0) { unfixable.push(day.index); continue; }

    const factor = target / day.total;
    if (factor > MAX_SCALE_FACTOR || factor < MIN_SCALE_FACTOR) { unfixable.push(day.index); continue; }

    for (const m of MEAL_TYPES) {
      const meal = mealPlan[m]?.[day.index];
      if (!meal) continue;
      for (const f of SCALED_FIELDS) {
        if (meal[f]) meal[f] = Math.round(meal[f] * factor * 100) / 100;
      }
    }
    scaled.push(day.index);
  }
  return { scaled, unfixable };
}

/** Rescale ONE meal to a calorie budget (single-meal regeneration). */
function rescaleMealToCalories(meal, budget, tolerance = 0.1) {
  const cals = mealCalories(meal);
  if (!meal || !cals || !budget) return meal;
  const factor = budget / cals;
  if (Math.abs(factor - 1) <= tolerance || factor > MAX_SCALE_FACTOR || factor < MIN_SCALE_FACTOR) return meal;
  for (const f of SCALED_FIELDS) {
    if (meal[f]) meal[f] = Math.round(meal[f] * factor * 100) / 100;
  }
  return meal;
}

module.exports = {
  MEAL_TYPES,
  SCALED_FIELDS,
  dayTotals,
  findCalorieViolations,
  normalizePlanCalories,
  rescaleMealToCalories,
};
