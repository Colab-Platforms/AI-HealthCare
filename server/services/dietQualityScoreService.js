const { getAdequacyTargets, getModerationCaps } = require('../utils/nutrientTargets');

/**
 * Diet Quality Score = 60 (Adequacy) + 40 (Moderation), out of 100.
 *
 * Adequacy component (60 pts): Mean Adequacy Ratio (MAR) — published nutrition
 * science methodology (Madden et al., 1970s; still the standard way to combine
 * multiple nutrients' %-of-target into one adequacy figure). For each adequacy
 * nutrient, NAR = min(1, actual / target) — capped at 1.0 so a large excess of
 * one nutrient can never mask a deficiency in another. MAR = average of all
 * NARs. Adequacy points = MAR * 60.
 *
 * Moderation component (40 pts): scored using the USDA HEI-2020 technical
 * methodology's actual moderation-component rule (the real formula HEI uses
 * for saturated fat / sodium / added sugars, not invented here): full points
 * at or below the standard (cap), zero points at 2x the standard, linear
 * in between. Moderation points = average across the 3 capped nutrients * 40.
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

/**
 * @param {Object} totals - daily nutrient totals, e.g. a NutritionSummary doc:
 *   { totalFiber, totalVitaminA, totalVitaminC, totalVitaminD, totalVitaminB12,
 *     totalIron, totalCalcium, totalPotassium, totalMagnesium, totalOmega3,
 *     totalSaturatedFat, totalSugar, totalSodium }
 * @param {Object} profile - { age, gender, calorieGoal }
 * @returns {Object} { score, adequacyScore, moderationScore, breakdown }
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

  const mar = adequacyBreakdown.reduce((sum, n) => sum + n.nar, 0) / adequacyBreakdown.length;
  const adequacyScore = mar * 60;

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
  const moderationScore = moderationAvg * 40;

  const score = Math.round(adequacyScore + moderationScore);

  return {
    score: Math.max(0, Math.min(100, score)),
    adequacyScore: Number(adequacyScore.toFixed(1)),
    moderationScore: Number(moderationScore.toFixed(1)),
    breakdown: {
      adequacy: adequacyBreakdown,
      moderation: moderationBreakdown
    }
  };
}

module.exports = { calculateDietQualityScore };
