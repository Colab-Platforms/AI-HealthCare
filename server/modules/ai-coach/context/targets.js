// The targets the app itself has set for this user, and what is left of them
// today. Every coach suggestion must fit inside these (no new numbers, no
// going over the calorie target). Same sources the app screens use:
//   calories / macros -> User.nutritionGoal (what the dashboard shows), else the active HealthGoal
//   water             -> profile.lifestyle.waterGoalMl (default 2000, as the dashboard)
//   steps             -> utils/stepGoal      sleep -> utils/sleepGoal
//   weekly exercise   -> exerciseGuidanceService (age, goal type, profession)
//   today so far      -> today's NutritionSummary (food + water)
// Cheap: 4 indexed reads in parallel, run alongside the classifier.

const dayStart = (now) => {
    const d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    return d;
};

async function defaultLoad(userId, now) {
    const User = require('../../../models/User');
    const HealthGoal = require('../../../models/HealthGoal');
    const PersonalizedDietPlan = require('../../../models/PersonalizedDietPlan');
    const NutritionSummary = require('../../../models/NutritionSummary');
    const start = dayStart(now);
    const end = new Date(start.getTime() + 86400000);
    const [user, healthGoal, dietPlan, today] = await Promise.all([
        User.findById(userId).select('profile.age profile.profession profile.lifestyle nutritionGoal').lean(),
        HealthGoal.findOne({ userId, isActive: true }).select('goalType targetWeight dailyCalorieTarget macroTargets').lean(),
        PersonalizedDietPlan.findOne({ userId, isActive: true }).select('dailyCalorieTarget macroTargets').lean(),
        NutritionSummary.findOne({ userId, date: { $gte: start, $lt: end } })
            .select('totalCalories totalProtein totalCarbs totalFats waterIntake').lean(),
    ]);
    return { user, healthGoal, dietPlan, today };
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : null);

function computeTargets({ user, healthGoal, dietPlan, today }) {
    if (!user) return null;
    const { getStepGoal } = require('../../../utils/stepGoal');
    const { getSleepGoal } = require('../../../utils/sleepGoal');
    const { getExerciseGuidance } = require('../../../services/exerciseGuidanceService');

    const ng = user.nutritionGoal || {};
    const age = user.profile?.age;
    const goalType = healthGoal?.goalType || ng.goal || null;
    // getExerciseGuidance(null) falls into the youth bucket (`null <= 17` is
    // true in JS) and would give an adult 420 min cardio/week. Unknown age =
    // no weekly target rather than a wrong one.
    const guidance = typeof age === 'number' && age > 0
        ? (getExerciseGuidance(age, goalType, user.profile?.profession || null) || {})
        : {};
    const sleep = getSleepGoal(user);

    const t = {
        calories: num(ng.calorieGoal) ?? num(healthGoal?.dailyCalorieTarget),
        protein: num(ng.proteinGoal) ?? num(healthGoal?.macroTargets?.protein),
        carbs: num(ng.carbsGoal) ?? num(healthGoal?.macroTargets?.carbs),
        fat: num(ng.fatGoal) ?? num(healthGoal?.macroTargets?.fats),
        waterMl: num(user.profile?.lifestyle?.waterGoalMl) ?? 2000,
        steps: getStepGoal(user, age).goalSteps,
        sleepHours: sleep.goalHours,
        sleepRange: sleep.targetRange,
        cardioMinPerWeek: num(guidance.cardioMinutesPerWeek),
        strengthMinPerWeek: num(guidance.strengthMinutesPerWeek),
        // The app's own exercise note for this age / goal (65+: balance training).
        exerciseNote: typeof guidance.note === 'string' && guidance.note.trim() ? guidance.note.trim() : null,
        goalType,
        targetWeightKg: num(ng.targetWeight) ?? num(healthGoal?.targetWeight),
        dietPlanCalories: num(dietPlan?.dailyCalorieTarget),
    };
    const eaten = {
        calories: Math.round(today?.totalCalories || 0),
        protein: Math.round(today?.totalProtein || 0),
        carbs: Math.round(today?.totalCarbs || 0),
        fat: Math.round(today?.totalFats || 0),
        waterMl: Math.round(today?.waterIntake || 0),
    };
    const left = (goal, done) => (goal == null ? null : Math.max(0, goal - done));
    const remaining = {
        calories: left(t.calories, eaten.calories),
        protein: left(t.protein, eaten.protein),
        carbs: left(t.carbs, eaten.carbs),
        fat: left(t.fat, eaten.fat),
        waterMl: left(t.waterMl, eaten.waterMl),
    };
    return { targets: t, today: eaten, remaining, loggedToday: Boolean(today) };
}

// One block of text for the prompt.
function formatTargets(ctx) {
    if (!ctx) return 'App targets: not available.';
    const { targets: t, today, remaining, loggedToday } = ctx;
    const lines = [];
    const daily = [
        t.calories && `calories ${t.calories} kcal`,
        t.protein && `protein ${t.protein} g`,
        t.carbs && `carbs ${t.carbs} g`,
        t.fat && `fat ${t.fat} g`,
        t.waterMl && `water ${t.waterMl} ml`,
        t.steps && `steps ${t.steps}`,
        t.sleepHours && `sleep ${t.sleepHours} h${t.sleepRange ? ` (healthy ${t.sleepRange.min}-${t.sleepRange.max} h)` : ''}`,
    ].filter(Boolean);
    if (daily.length) lines.push(`Daily targets set by the app: ${daily.join(', ')}.`);
    if (t.cardioMinPerWeek || t.strengthMinPerWeek) {
        lines.push(`Weekly exercise target: ${t.cardioMinPerWeek || 0} min cardio + ${t.strengthMinPerWeek || 0} min strength.`);
    }
    if (t.exerciseNote) lines.push(`App exercise note: ${t.exerciseNote}`);
    if (t.goalType || t.targetWeightKg) {
        lines.push(`Goal: ${t.goalType ? t.goalType.replace(/_/g, ' ') : 'general'}${t.targetWeightKg ? `, target weight ${t.targetWeightKg} kg` : ''}.`);
    }
    if (t.dietPlanCalories && t.calories && Math.abs(t.dietPlanCalories - t.calories) > 50) {
        lines.push(`Their active diet plan is built for ${t.dietPlanCalories} kcal.`);
    }
    if (loggedToday) {
        const logged = [
            today.calories != null && `${today.calories} kcal`,
            today.protein != null && `protein ${today.protein} g`,
            today.waterMl != null && `water ${today.waterMl} ml`,
        ].filter(Boolean).join(', ');
        lines.push(`Logged today: ${logged}. `
            + `Left for today: ${[
                remaining.calories != null && `${remaining.calories} kcal`,
                remaining.protein != null && `${remaining.protein} g protein`,
                remaining.waterMl != null && `${remaining.waterMl} ml water`,
            ].filter(Boolean).join(', ')}.`);
    } else {
        lines.push('Nothing logged today yet (food or water), so the full daily targets are left.');
    }
    return lines.join('\n');
}

async function getTargets(userId, { now = new Date(), load = defaultLoad } = {}) {
    return computeTargets(await load(userId, now));
}

module.exports = { getTargets, computeTargets, formatTargets };
