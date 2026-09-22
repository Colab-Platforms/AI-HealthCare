const { getAdequacyTargets, getModerationCaps, getAmdrRanges } = require('../utils/nutrientTargets');

/**
 * Nutrition Score = 60 ("Healthy Nutrients") + 40 ("Junk Control"), out of 100.
 * These two plain names replace the nutrition-science jargon ("Adequacy" /
 * "Moderation") anywhere user- or app-team-facing — same maths, clearer
 * words: Healthy Nutrients = "how much of the good stuff did you get today",
 * Junk Control = "did you stay under the limit on sugar/salt/saturated fat".
 * Only ONE number is ever shown to the user (`score`); the two sub-scores
 * exist so an optional "why" breakdown can be shown (like the reference
 * design's "How today added up"), never as two separate score cards.
 *
 * Healthy Nutrients (60 pts): Mean Adequacy Ratio (MAR) — published nutrition
 * science methodology (Madden et al., 1970s; still the standard way to combine
 * multiple nutrients' %-of-target into one adequacy figure). For each nutrient,
 * NAR = min(1, actual / target) — capped at 1.0 so a large excess of one
 * nutrient can never mask a deficiency in another. MAR = average of all NARs.
 * Healthy Nutrients points = MAR * 60.
 *
 * The 10 micronutrients below are joined by 3 AMDR (Acceptable Macronutrient
 * Distribution Range, National Academies DRI 2005) checks for protein/carbs/
 * fat — NOT personal calorie-goal adherence (that's a separate, already-shown
 * metric), but the published %-of-calories range every adult's macro split
 * should fall within. Each is scored the same NAR way: 1.0 if inside the
 * range, decaying linearly to 0 the further outside it the day's % falls.
 *
 * Junk Control (40 pts): scored using the USDA HEI-2020 technical
 * methodology's actual moderation-component rule (the real formula HEI uses
 * for saturated fat / sodium / added sugars, not invented here): full points
 * at or below the standard (cap), zero points at 2x the standard, linear
 * in between. Junk Control points = average across the 3 capped nutrients * 40.
 *
 * Our targets are nutrient-based (age/gender/calorie-derived from NIH ODS /
 * AHA / WHO, see nutrientTargets.js), not HEI's original food-group-based
 * components — an intentional, disclosed simplification because our data
 * model tracks nutrients per log, not food-group servings.
 */

const ADEQUACY_KEYS = [
  { key: 'fiber', targetField: 'fiber' },
  { key: 'vitaminA', targetField: 'vitaminA' },
  { key: 'vitaminC', targetField: 'vitaminC' },
  { key: 'vitaminD', targetField: 'vitaminD' },
  { key: 'vitaminB12', targetField: 'vitaminB12' },
  { key: 'iron', targetField: 'iron' },
  { key: 'calcium', targetField: 'calcium' },
  { key: 'potassium', targetField: 'potassium' },
  { key: 'magnesium', targetField: 'magnesium' },
  { key: 'omega3', targetField: 'omega3' }
];

const MODERATION_KEYS = [
  { key: 'saturatedFat', capField: 'saturatedFat' },
  { key: 'sugar', capField: 'addedSugar' },
  { key: 'sodium', capField: 'sodium' }
];

// Atwater conversion factors — kcal per gram, standard across the codebase
// (same factors nutritionAI.js/dietRecommendationAI.js already assume).
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };

// AMDR NAR: 1.0 inside the range, decaying linearly to 0 at (range width)
// beyond either edge — the same "how far outside, how much penalty" shape
// used for the moderation caps below, just centered on a range instead of a
// single ceiling.
function amdrNar(percentOfCalories, [min, max]) {
  if (percentOfCalories >= min && percentOfCalories <= max) return 1;
  const distance = percentOfCalories < min ? min - percentOfCalories : percentOfCalories - max;
  const rangeWidth = max - min;
  return rangeWidth > 0 ? Math.max(0, 1 - distance / rangeWidth) : 0;
}

/**
 * @param {Object} totals - daily nutrient totals, e.g. a NutritionSummary doc:
 *   { totalFiber, totalVitaminA, totalVitaminC, totalVitaminD, totalVitaminB12,
 *     totalIron, totalCalcium, totalPotassium, totalMagnesium, totalOmega3,
 *     totalSaturatedFat, totalSugar, totalSodium }
 * @param {Object} profile - { age, gender, calorieGoal }
 * @returns {Object} { score, healthyNutrientsScore, junkControlScore, breakdown }
 */
function calculateDietQualityScore(totals, profile) {
  const { age, gender, calorieGoal } = profile;
  const adequacyTargets = getAdequacyTargets({ age, gender, calorieGoal });
  const moderationCaps = getModerationCaps({ calorieGoal });

  const adequacyBreakdown = ADEQUACY_KEYS.map(({ key, targetField }) => {
    const totalField = `total${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    const actual = Number(totals[totalField]) || 0;
    const target = Number(adequacyTargets[targetField]) || 0;
    const nar = target > 0 ? Math.min(1, actual / target) : 0;
    return { nutrient: key, actual, target, nar: Number(nar.toFixed(3)) };
  });

  // AMDR macro-balance components — scored against the day's OWN total
  // calories (not the calorie goal), since the question is "was today's
  // split balanced", not "did they hit their calorie target" (that's a
  // separate, already-displayed metric).
  const amdrRanges = getAmdrRanges();
  const totalCalories = Number(totals.totalCalories) || 0;
  const amdrBreakdown = ['protein', 'carbs', 'fat'].map((macro) => {
    const totalField = macro === 'fat' ? 'totalFats' : `total${macro.charAt(0).toUpperCase()}${macro.slice(1)}`;
    const grams = Number(totals[totalField]) || 0;
    const percentOfCalories = totalCalories > 0 ? (grams * KCAL_PER_G[macro] * 100) / totalCalories : 0;
    const nar = totalCalories > 0 ? amdrNar(percentOfCalories, amdrRanges[macro]) : 0;
    return {
      nutrient: `${macro}Amdr`,
      actual: Number(percentOfCalories.toFixed(1)),
      target: amdrRanges[macro],
      nar: Number(nar.toFixed(3))
    };
  });

  const allAdequacy = [...adequacyBreakdown, ...amdrBreakdown];
  const mar = allAdequacy.reduce((sum, n) => sum + n.nar, 0) / allAdequacy.length;
  const healthyNutrientsScore = mar * 60;

  const moderationBreakdown = MODERATION_KEYS.map(({ key, capField }) => {
    const totalField = `total${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    const actual = Number(totals[totalField]) || 0;
    const cap = Number(moderationCaps[capField]) || 0;
    let componentScore;
    if (cap <= 0) {
      componentScore = 1;
    } else if (actual <= cap) {
      componentScore = 1;
    } else if (actual >= 2 * cap) {
      componentScore = 0;
    } else {
      componentScore = (2 * cap - actual) / cap;
    }
    return { nutrient: key, actual, cap, componentScore: Number(componentScore.toFixed(3)) };
  });

  const moderationAvg = moderationBreakdown.reduce((sum, n) => sum + n.componentScore, 0) / moderationBreakdown.length;
  const junkControlScore = moderationAvg * 40;

  const score = Math.round(healthyNutrientsScore + junkControlScore);

  return {
    score: Math.max(0, Math.min(100, score)),
    healthyNutrientsScore: Number(healthyNutrientsScore.toFixed(1)),
    junkControlScore: Number(junkControlScore.toFixed(1)),
    breakdown: {
      healthyNutrients: allAdequacy,
      junkControl: moderationBreakdown
    }
  };
}

module.exports = { calculateDietQualityScore };
