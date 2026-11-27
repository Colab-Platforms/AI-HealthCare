// The user's goal and daily nutrition targets: ONE stored source, HealthGoal.
//
// Until 26 Nov the app also stored `User.nutritionGoal`, calculated at signup
// by a second formula (services/nutritionGoalCalculator) and copied over from
// HealthGoal by some flows but not others. The two disagreed (staging persona
// b: 1625 vs 1476 kcal). That field is removed; everything reads and writes
// the goal here.
//
//   getActiveGoal(userId)        the active HealthGoal (lean) or null
//   getNutritionGoal(userId)     targets in the old nutritionGoal shape, for
//                                readers and API responses (app compatibility)
//   syncGoal(userId, opts)       create / update the active HealthGoal from the
//                                profile (+ goal input from onboarding)
//
// A user without a complete body profile (age, gender, height, weight) has no
// goal: there is nothing to calculate from. Readers then use their defaults,
// as they did when nutritionGoal had no calorieGoal.

const HealthGoal = require('../models/HealthGoal');

const GOAL_TYPES = HealthGoal.schema.path('goalType').enumValues;
const ACTIVITY_LEVELS = HealthGoal.schema.path('activityLevel').enumValues;
const GENDERS = HealthGoal.schema.path('gender').enumValues;
// Pace used when onboarding sends a goal without one (what the old signup
// calculator assumed, so first-day targets match what users were shown).
const DEFAULT_WEEKLY_GOAL = 0.5;

const positive = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
};

// services/dietTargets.js's test + onboarding conditions (where the
// HealthProfile mirror writes "Diabetes").
function isDiabeticProfile(p = {}) {
    const has = (list) => (Array.isArray(list) ? list : []).some((c) => /diabet/i.test(String(c)));
    return p.isDiabetic === 'yes' || p.isDiabetic === true
        || Boolean(p.diabetesProfile?.type)
        || has(p.medicalHistory?.conditions)
        || has(p.chronicConditions)
        || has(p.healthConditions);
}

async function getActiveGoal(userId, { session } = {}) {
    if (!userId) return null;
    let q = HealthGoal.findOne({ userId, isActive: true }).sort({ createdAt: -1 });
    if (session) q = q.session(session);
    return q.lean();
}

// Read-only bridge for the deploy window: a user the migration has not reached
// yet still has the old stored field in Mongo (the schema no longer knows it,
// so it is read from the raw collection). Never written. Gone after
// scripts/migrateNutritionGoal.js --apply --unset.
async function legacyNutritionGoal(userId) {
    const User = require('../models/User');
    const { Types } = require('mongoose');
    if (!Types.ObjectId.isValid(String(userId))) return null;
    const raw = await User.collection.findOne({ _id: new Types.ObjectId(String(userId)) }, { projection: { nutritionGoal: 1 } });
    const ng = raw?.nutritionGoal;
    return ng && ng.calorieGoal ? ng : null;
}

// No goal at all: the same object the old schema default gave every user
// ({ goal: 'general_health', autoCalculated: true }), never null, so an app
// that reads nutritionGoal.goal keeps working. No calorieGoal: readers use
// their defaults, as before.
const NO_GOAL = Object.freeze({ goal: 'general_health', autoCalculated: true });

async function getNutritionGoal(userId) {
    const goal = await getActiveGoal(userId);
    if (goal) return HealthGoal.toNutritionGoal(goal);
    return (await legacyNutritionGoal(userId)) || { ...NO_GOAL };
}

// Body facts for the goal from the legacy User.profile mirror (kept in step
// with HealthProfile by the write bridge).
function bodyFrom(profile = {}) {
    const gender = GENDERS.includes(profile.gender) ? profile.gender : undefined;
    return {
        age: positive(profile.age),
        gender,
        height: positive(profile.height),
        currentWeight: positive(profile.weight),
        activityLevel: ACTIVITY_LEVELS.includes(profile.activityLevel) ? profile.activityLevel : undefined,
        isDiabetic: isDiabeticProfile(profile),
    };
}

/**
 * Create or update the active HealthGoal so it matches the profile.
 *
 * @param userId
 * @param opts.profile      User.profile (legacy mirror); read from the DB when omitted
 * @param opts.input        onboarding / profile-form goal: { goal, targetWeight, weeklyGoal }
 * @param opts.targetWeight target weight from HealthProfile goals.targetWeightKg
 * @param opts.create       create a goal when there is none (onboarding); default: only when `input` has a goal
 * @param opts.syncActivity copy the profile activity into an EXISTING goal (the user changed it
 *                          in the profile). A new goal always takes it. Off by default: the goal
 *                          screen's own pick must not be overwritten by an older profile value.
 * @returns the saved HealthGoal document, or null (incomplete profile / nothing to do)
 */
async function syncGoal(userId, { profile, input = null, targetWeight, create, syncActivity = false, session, logger = console } = {}) {
    const User = require('../models/User');
    if (!profile) {
        let q = User.findById(userId).select('profile');
        if (session) q = q.session(session);
        // Health facts from HealthProfile (the only source).
        profile = (await q.lean().then((u) => require('../modules/health-profile/services/profileReadService').withProfile(u)))?.profile || {};
    }
    const body = bodyFrom(profile);
    if (!body.age || !body.gender || !body.height || !body.currentWeight) return null;

    let isNew = false;
    let goal = await (session
        ? HealthGoal.findOne({ userId, isActive: true }).sort({ createdAt: -1 }).session(session)
        : HealthGoal.findOne({ userId, isActive: true }).sort({ createdAt: -1 }));

    const goalType = GOAL_TYPES.includes(input?.goal) ? input.goal : undefined;
    const inputTarget = positive(input?.targetWeight) ?? positive(targetWeight);
    const inputPace = positive(input?.weeklyGoal);

    if (!goal) {
        const shouldCreate = create ?? Boolean(input?.goal);
        if (!shouldCreate) return null;
        isNew = true;
        goal = new HealthGoal({
            userId,
            goalType: goalType || 'general_health',
            targetWeight: inputTarget || body.currentWeight,
            weeklyGoal: inputPace || DEFAULT_WEEKLY_GOAL,
            isActive: true,
        });
    } else {
        if (goalType) goal.goalType = goalType;
        if (inputTarget) goal.targetWeight = inputTarget;
        if (inputPace) goal.weeklyGoal = inputPace;
    }

    goal.age = body.age;
    goal.gender = body.gender;
    goal.height = body.height;
    goal.currentWeight = body.currentWeight;
    if (body.activityLevel && (isNew || syncActivity)) goal.activityLevel = body.activityLevel;
    goal.isDiabetic = body.isDiabetic;

    try {
        await goal.save(session ? { session } : undefined); // pre-save hook calculates the targets
    } catch (err) {
        // A value outside the goal's ranges (e.g. weight 25 kg) must not fail
        // the caller's request: the profile is saved, the goal is not.
        logger.error(`[HealthGoal] user ${userId}: goal not saved (${err.message})`);
        return null;
    }
    await clearCaches(userId);
    return goal;
}

async function clearCaches(userId) {
    const cache = require('../utils/cache');
    await Promise.all([
        cache.delete(`dashboard:${userId}`),
        cache.delete(`health_goal:${userId}`),
    ]).catch(() => {});
}

module.exports = {
    getActiveGoal,
    getNutritionGoal,
    legacyNutritionGoal,
    syncGoal,
    isDiabeticProfile,
    bodyFrom,
    clearCaches,
    DEFAULT_WEEKLY_GOAL,
};
