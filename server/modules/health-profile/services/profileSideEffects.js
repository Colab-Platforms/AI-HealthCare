// What else must change when the app edits the profile through
// /api/health-profile. The old profile edit (authController.updateProfile) did
// these inline; without them a weight edit here would leave BMI, calorie
// targets and the active HealthGoal stale.
//
// Runs AFTER the profile write has committed, from the controller. Best effort:
// the profile change is already saved, so a failure here is logged, never
// returned to the user. Every step reads the fresh User mirror, so it is safe
// to run twice.

const NUTRITION_SECTIONS = ['basic', 'body', 'goals', 'lifestyle'];

function createProfileSideEffects({
    User = require('../../../models/User'),
    HealthGoal = require('../../../models/HealthGoal'),
    PersonalizedDietPlan = require('../../../models/PersonalizedDietPlan'),
    calculateNutritionGoals = require('../../../services/nutritionGoalCalculator').calculateNutritionGoals,
    reconcileFoodPreferences = require('../../../utils/dietConstraints').reconcileFoodPreferences,
    normalizeDietaryPreference = require('../../../utils/dietaryPreference').normalizeDietaryPreference,
    regenerateDietPlan = (userId) => require('../../../controllers/dietRecommendationController').generateDietAfterReport(userId),
    cache = require('../../../utils/cache'),
    logger = console,
} = {}) {

    // BMI + active HealthGoal + nutritionGoal targets, same rules as updateProfile.
    async function syncNutrition(userId, sections) {
        const user = await User.findById(userId).select('profile nutritionGoal').lean();
        if (!user) return;
        const p = user.profile || {};
        const $set = {};

        if (p.height && p.weight) {
            $set['healthMetrics.bmi'] = Number((p.weight / Math.pow(p.height / 100, 2)).toFixed(1));
        }

        const healthGoal = await HealthGoal.findOne({ userId, isActive: true });
        if (healthGoal) {
            healthGoal.height = p.height || healthGoal.height;
            healthGoal.currentWeight = p.weight || healthGoal.currentWeight;
            healthGoal.age = p.age || healthGoal.age;
            healthGoal.gender = p.gender || healthGoal.gender;
            // Target weight is a profile fact now (goals.targetWeightKg). Keep the
            // goal in step, or the next weight log would copy the old one back.
            const target = user.nutritionGoal?.targetWeight;
            if (sections.includes('goals') && target > 0) healthGoal.targetWeight = target;
            await healthGoal.save(); // pre-save hook recalculates calorie/macro targets
            Object.assign($set, {
                'nutritionGoal.calorieGoal': healthGoal.dailyCalorieTarget,
                'nutritionGoal.proteinGoal': healthGoal.macroTargets?.protein || user.nutritionGoal?.proteinGoal,
                'nutritionGoal.carbsGoal': healthGoal.macroTargets?.carbs || user.nutritionGoal?.carbsGoal,
                'nutritionGoal.fatGoal': healthGoal.macroTargets?.fats || user.nutritionGoal?.fatGoal,
                'nutritionGoal.lastUpdated': new Date(),
            });
        } else if (user.nutritionGoal?.calorieGoal && p.age && p.gender && p.height && p.weight) {
            const ng = user.nutritionGoal;
            const goals = calculateNutritionGoals({
                age: p.age,
                gender: p.gender,
                weight: p.weight,
                height: p.height,
                activityLevel: p.activityLevel || 'sedentary',
                goal: ng.goal || 'general_health',
                targetWeight: ng.targetWeight,
                weeklyGoal: ng.weeklyGoal || 0.5,
                isDiabetic: p.isDiabetic === 'yes',
            });
            // Field by field, only the stored targets: never replace nutritionGoal
            // as a whole (targetWeight is mirrored from the profile).
            for (const k of ['calorieGoal', 'proteinGoal', 'carbsGoal', 'fatGoal', 'lastUpdated']) {
                if (goals?.[k] !== undefined) $set[`nutritionGoal.${k}`] = goals[k];
            }
        }

        // Undefined values would make Mongo unset the path; drop them.
        for (const k of Object.keys($set)) if ($set[k] === undefined) delete $set[k];
        if (Object.keys($set).length) await User.updateOne({ _id: userId }, { $set });
        await Promise.all([
            cache.delete(`dashboard:${userId}`),
            cache.delete(`health_goal:${userId}`),
        ]);
    }

    // Diet type changed: drop Jain leftovers from food preferences and rebuild
    // an active plan made for the old diet, same as updateProfile.
    async function onDietChanged(userId) {
        const user = await User.findById(userId).select('profile.dietaryPreference foodPreferences').lean();
        const diet = normalizeDietaryPreference(user?.profile?.dietaryPreference);
        if (!diet) return;

        if (user.foodPreferences) {
            const { prefs, dropped } = reconcileFoodPreferences(diet, user.foodPreferences);
            if (dropped.length) await User.updateOne({ _id: userId }, { $set: { foodPreferences: prefs } });
        }

        const hasActivePlan = await PersonalizedDietPlan.exists({ userId, isActive: true, status: 'completed' });
        if (hasActivePlan) {
            // AI call, minutes long: never on the request path.
            setImmediate(() => Promise.resolve(regenerateDietPlan(userId)).catch((e) =>
                logger.error(`[HealthProfile] diet plan regenerate failed for user ${userId}: ${e.message}`)));
        }
    }

    async function afterProfileChange(userId, sections = []) {
        const tasks = [];
        if (sections.some((s) => NUTRITION_SECTIONS.includes(s))) tasks.push(['nutrition', () => syncNutrition(userId, sections)]);
        if (sections.includes('diet')) tasks.push(['diet', () => onDietChanged(userId)]);
        for (const [name, run] of tasks) {
            try {
                await run();
            } catch (err) {
                logger.error(`[HealthProfile] side effect "${name}" failed for user ${userId}: ${err.message}`);
            }
        }
    }

    return { afterProfileChange };
}

module.exports = { createProfileSideEffects, NUTRITION_SECTIONS };
