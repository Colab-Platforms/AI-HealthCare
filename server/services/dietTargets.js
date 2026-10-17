/**
 * One place that decides a user's goal and daily targets for diet generation.
 *
 * Before this, three code paths each decided for themselves: the main generator
 * read the `User.nutritionGoal` mirror, the post-report generator ignored the
 * goal and used a flat 2000 (1800 diabetic), and the prompt received the raw
 * goal string with no instruction of what it means for the food. A user whose
 * HealthGoal said "gain" could therefore get a maintenance plan, and the reverse.
 *
 * Source of truth, in order (mirrors nutritionController.getHealthGoal, which
 * documents HealthGoal as authoritative and User.nutritionGoal as a mirror that
 * can lag):
 *   1. active HealthGoal
 *   2. User.nutritionGoal mirror
 *   3. computed from the profile
 *   4. safe default
 */
const HealthGoal = require('../models/HealthGoal');
const { calculateNutritionGoals } = require('./nutritionGoalCalculator');

const GOAL_ALIASES = {
  maintenance: 'maintain',
  health_improvement: 'general_health',
  disease_management: 'general_health',
};
const KNOWN_GOALS = ['weight_loss', 'weight_gain', 'muscle_gain', 'maintain', 'general_health'];

/** Collapse the many stored spellings to one of KNOWN_GOALS. */
function normalizeGoal(goal) {
  const g = typeof goal === 'string' ? goal.trim().toLowerCase() : '';
  const aliased = GOAL_ALIASES[g] || g;
  return KNOWN_GOALS.includes(aliased) ? aliased : 'general_health';
}

/**
 * Plain-language instruction for what the goal means for the food, with the
 * numbers that make it checkable. The old prompt said only "Goal: weight_gain".
 *
 * @param {{goal: string, calories: number, tdee?: number|null, protein?: number}} p
 */
function buildGoalInstructions({ goal, calories, tdee = null, protein } = {}) {
  const g = normalizeGoal(goal);
  const delta = tdee ? Math.round(calories - tdee) : null;
  const deltaNote = delta === null ? '' : delta === 0 ? ' (equal to maintenance)' : ` (${delta > 0 ? '+' : ''}${delta} kcal vs maintenance)`;
  const proteinNote = protein ? ` Aim for about ${protein} g protein per day.` : '';

  switch (g) {
    case 'weight_loss':
      return `GOAL = WEIGHT LOSS. Daily target ${calories} kcal${deltaNote} is a deficit and a CEILING: no day may exceed it. Choose naturally lighter everyday dishes — roti/millet with dal and sabzi, chilla, idli, dalia, sprouts, curd, light gravies, minimal oil. Avoid fried items, sweets, creamy/butter gravies and large rice portions. Keep protein and fibre high so the portions stay filling.${proteinNote}`;
    case 'weight_gain':
      return `GOAL = WEIGHT GAIN. Daily target ${calories} kcal${deltaNote} is a surplus and a FLOOR: no day may fall meaningfully below it. Make up the calories with traditional calorie-dense foods — ghee, paneer, dairy, nuts, banana, parathas, rice with dal and ghee, khichdi — and generous portions, not with diet or low-calorie dishes.${proteinNote}`;
    case 'muscle_gain':
      return `GOAL = MUSCLE GAIN. Daily target ${calories} kcal${deltaNote} is a lean surplus; hit it, do not undershoot. Build every meal around a protein source — dal, rajma/chole, paneer, curd, soya, sprouts, and eggs/chicken/fish when the diet allows — with enough roti/rice for training energy.${proteinNote}`;
    case 'maintain':
      return `GOAL = MAINTENANCE. Daily target ${calories} kcal${deltaNote}. Balanced everyday meals; each day should land on the target, neither a surplus nor a deficit.${proteinNote}`;
    default:
      return `GOAL = GENERAL HEALTH. Daily target ${calories} kcal${deltaNote}. Balanced, varied everyday meals that land on the target.${proteinNote}`;
  }
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * @param {object} user user document or lean object
 * @returns {Promise<{goal: string, calorieGoal: number, proteinGoal: number, carbsGoal: number, fatGoal: number, tdee: number|null, source: string}>}
 */
async function resolveDietTargets(user) {
  const isDiabetic = !!(
    user?.profile?.diabetesProfile?.type ||
    (user?.profile?.medicalHistory?.conditions || []).some((c) => /diabet/i.test(c)) ||
    (user?.profile?.chronicConditions || []).some((c) => /diabet/i.test(c))
  );
  const fallbackMacros = {
    proteinGoal: isDiabetic ? 84 : 90,
    carbsGoal: isDiabetic ? 180 : 250,
    fatGoal: 65,
  };

  // 1. HealthGoal — authoritative. A failed read must not block diet generation:
  //    degrade to the mirror rather than fail.
  try {
    const hg = await HealthGoal.findOne({ userId: user._id, isActive: true })
      .sort({ createdAt: -1 })
      .lean()
      .maxTimeMS(10000);
    const calories = toNumber(hg?.dailyCalorieTarget);
    if (hg && calories) {
      return {
        goal: normalizeGoal(hg.goalType),
        calorieGoal: Math.round(calories),
        proteinGoal: toNumber(hg.macroTargets?.protein) || fallbackMacros.proteinGoal,
        carbsGoal: toNumber(hg.macroTargets?.carbs) || fallbackMacros.carbsGoal,
        fatGoal: toNumber(hg.macroTargets?.fats) || fallbackMacros.fatGoal,
        tdee: toNumber(hg.tdee),
        source: 'health_goal',
      };
    }
  } catch (err) {
    console.warn('[DietTargets] HealthGoal lookup failed, falling back to profile mirror:', err.message);
  }

  // 2. User.nutritionGoal mirror
  const mirror = user?.nutritionGoal;
  const mirrorCalories = toNumber(mirror?.calorieGoal);
  if (mirrorCalories) {
    return {
      goal: normalizeGoal(mirror.goal),
      calorieGoal: Math.round(mirrorCalories),
      proteinGoal: toNumber(mirror.proteinGoal) || fallbackMacros.proteinGoal,
      carbsGoal: toNumber(mirror.carbsGoal) || fallbackMacros.carbsGoal,
      fatGoal: toNumber(mirror.fatGoal) || fallbackMacros.fatGoal,
      tdee: null,
      source: 'user_mirror',
    };
  }

  // 3. Compute from the profile, honouring the goal
  const goal = normalizeGoal(mirror?.goal);
  try {
    const calc = calculateNutritionGoals({
      age: user?.profile?.age || 25,
      gender: user?.profile?.gender || 'male',
      weight: user?.profile?.weight || 70,
      height: user?.profile?.height || 170,
      activityLevel: user?.profile?.activityLevel || 'moderately_active',
      goal,
      targetWeight: mirror?.targetWeight,
      weeklyGoal: mirror?.weeklyGoal || 0.5,
      isDiabetic,
    });
    return {
      goal,
      calorieGoal: calc.calorieGoal,
      proteinGoal: calc.proteinGoal,
      carbsGoal: calc.carbsGoal,
      fatGoal: calc.fatGoal,
      tdee: calc.tdee,
      source: 'calculated',
    };
  } catch (err) {
    console.warn('[DietTargets] Could not calculate targets:', err.message);
  }

  // 4. Safe default
  return { goal, calorieGoal: isDiabetic ? 1800 : 2000, ...fallbackMacros, tdee: null, source: 'default' };
}

module.exports = { resolveDietTargets, normalizeGoal, buildGoalInstructions, KNOWN_GOALS };
