// What else must change when the app edits the profile through
// /api/health-profile. The old profile edit (authController.updateProfile) did
// these inline; without them a weight edit here would leave BMI, calorie
// targets and the active HealthGoal stale.
//
// Runs AFTER the profile write has committed, from the controller. Best effort:
// the profile change is already saved, so a failure here is logged, never
// returned to the user. Every step reads the fresh User mirror, so it is safe
// to run twice.

// 'conditions': adding / removing diabetes changes the goal's calorie and carb targets.
const NUTRITION_SECTIONS = ['basic', 'body', 'goals', 'lifestyle', 'conditions'];

function createProfileSideEffects({
    User = require('../../../models/User'),
    HealthProfile = require('../models/HealthProfile'),
    PersonalizedDietPlan = require('../../../models/PersonalizedDietPlan'),
    syncGoal = (userId, opts) => require('../../../services/healthGoalService').syncGoal(userId, opts),
    reconcileFoodPreferences = require('../../../utils/dietConstraints').reconcileFoodPreferences,
    normalizeDietaryPreference = require('../../../utils/dietaryPreference').normalizeDietaryPreference,
    regenerateDietPlan = (userId) => require('../../../controllers/dietRecommendationController').generateDietAfterReport(userId),
    cache = require('../../../utils/cache'),
    // health facts read from HealthProfile (the only source)
    withProfile = (u) => require('./profileReadService').withProfile(u),
    syncFoodPreferences = (userId, legacy) => require('./profileWriteService').syncFromLegacy(userId, { source: 'manual', legacy }),
    logger = console,
} = {}) {

    // BMI + the active HealthGoal (the only stored goal and targets; it is
    // recalculated from the profile by services/healthGoalService).
    async function syncNutrition(userId, sections) {
        const user = await User.findById(userId).select('profile').lean().then(withProfile);
        if (!user) return;
        const p = user.profile || {};

        if (p.height && p.weight) {
            const bmi = Number((p.weight / Math.pow(p.height / 100, 2)).toFixed(1));
            await User.updateOne({ _id: userId }, { $set: { 'healthMetrics.bmi': bmi } });
        }

        // Target weight is a profile fact (goals.targetWeightKg). Keep the goal
        // in step, or the next weight log would copy the old one back.
        let targetWeight;
        if (sections.includes('goals')) {
            const hp = await HealthProfile.findOne({ user: userId }).select('goals.targetWeightKg').lean();
            targetWeight = hp?.goals?.targetWeightKg;
        }
        // lifestyle changed (activity lives there) -> the goal follows the profile's activity.
        await syncGoal(userId, { profile: p, targetWeight, syncActivity: sections.includes('lifestyle'), logger });
        await Promise.all([
            cache.delete(`dashboard:${userId}`),
            cache.delete(`health_goal:${userId}`),
        ]);
    }

    // Diet type changed: drop Jain leftovers from food preferences and rebuild
    // an active plan made for the old diet, same as updateProfile.
    async function onDietChanged(userId) {
        const user = await User.findById(userId).select('profile.dietaryPreference foodPreferences').lean().then(withProfile);
        const diet = normalizeDietaryPreference(user?.profile?.dietaryPreference);
        if (!diet) return;

        if (user.foodPreferences) {
            const { prefs, dropped } = reconcileFoodPreferences(diet, user.foodPreferences);
            // Food preferences live in HealthProfile (26 Nov): only the changed lists are written.
            if (dropped.length) await syncFoodPreferences(userId, { _id: userId, profile: user.profile, foodPreferences: prefs });
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
