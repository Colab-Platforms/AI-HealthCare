// Logging food from chat ("maine 2 roti dal khayi", "lunch 500 kcal, 30 g
// protein"):
//   1. the classifier extracts the meal + any numbers the user SAID;
//   2. the app's own food estimator (nutritionAI.quickFoodCheck, basic tier)
//      fills in what wasn't said;
//   3. user numbers always win; when they gave calories but not every macro,
//      the estimated macros are scaled to their calories so the parts add up;
//   4. the coach shows it and asks "save?"; only on "yes" is it written,
//      through services/foodLogService.js (FoodLog + daily summary + points).

const { MEAL_TYPES } = require('../../../services/foodLogService');

const KEYS = ['calories', 'protein', 'carbs', 'fats'];
const STATED = { calories: 'statedCalories', protein: 'statedProtein', carbs: 'statedCarbs', fats: 'statedFats' };

// Meal type when the user didn't say: by India time of day.
function mealTypeFromTime(now = new Date()) {
    const ist = new Date(now.getTime() + 330 * 60000);
    const h = ist.getUTCHours() + ist.getUTCMinutes() / 60;
    if (h >= 4 && h < 11) return 'breakfast';
    if (h >= 11 && h < 16) return 'lunch';
    if (h >= 16 && h < 19) return 'snack';
    return 'dinner';
}

function buildEntry(mealLog, estimate, now = new Date()) {
    const said = (k) => (Number.isFinite(mealLog[STATED[k]]) && mealLog[STATED[k]] >= 0 ? mealLog[STATED[k]] : null);
    const est = estimate?.nutrition || {};
    const nutrition = {};
    const source = {};
    // Scale estimated macros to the user's calories when they gave calories.
    const ratio = said('calories') !== null && est.calories > 0 ? said('calories') / est.calories : 1;
    for (const k of KEYS) {
        if (said(k) !== null) {
            nutrition[k] = Math.round(said(k));
            source[k] = 'user';
        } else if (Number.isFinite(est[k])) {
            nutrition[k] = Math.round(k === 'calories' ? est[k] : est[k] * ratio);
            source[k] = 'estimate';
        } else {
            nutrition[k] = 0;
            source[k] = 'unknown';
        }
    }
    nutrition.fiber = Math.round((Number(est.fiber) || 0) * ratio);
    const typeGiven = MEAL_TYPES.includes(mealLog.mealType);
    return {
        mealType: typeGiven ? mealLog.mealType : mealTypeFromTime(now),
        mealTypeGuessed: !typeGiven,
        name: (estimate?.foodName || mealLog.description).slice(0, 200),
        description: mealLog.description.slice(0, 500),
        quantity: estimate?.quantity || '1 serving',
        nutrition,
        source,
    };
}

function describeEntry(e) {
    const v = (k, unit) => `${e.source[k] === 'estimate' ? '~' : ''}${e.nutrition[k]}${unit}`;
    return `${e.description} as ${e.mealType}${e.mealTypeGuessed ? ' (guessed from the time)' : ''}: `
        + `${v('calories', ' kcal')}, protein ${v('protein', ' g')}, carbs ${v('carbs', ' g')}, fat ${v('fats', ' g')}`
        + ` (~ = estimated, the rest is what they said)`;
}

function createFoodLogTools({
    estimateFood = async (description, userId) => {
        const nutritionAI = require('../../../services/nutritionAI');
        const out = await nutritionAI.quickFoodCheck(description, '', userId, '', 'basic');
        return out?.data || null;
    },
    saveMealLog = (args) => require('../../../services/foodLogService').saveMealLog(args),
    logger = console,
} = {}) {
    // Returns the entry to confirm, or null when nothing usable was said.
    // `prefetched`: an estimate started earlier (in parallel with the
    // classifier, from the raw message) to reuse instead of a second call.
    async function prepare(userId, mealLog, now = new Date(), { prefetched } = {}) {
        if (!mealLog?.isLogging || !String(mealLog.description || '').trim()) return null;
        let estimate = null;
        const allSaid = KEYS.every((k) => Number.isFinite(mealLog[STATED[k]]) && mealLog[STATED[k]] >= 0);
        if (!allSaid) {
            try {
                estimate = (prefetched ? await prefetched : null) || await estimateFood(mealLog.description, userId);
            } catch (err) {
                logger.warn(`[AICoach] food estimate failed: ${err.message}`);
            }
        }
        return buildEntry(mealLog, estimate, now);
    }

    const estimate = (description, userId) => estimateFood(description, userId);

    async function save(userId, entry, now = new Date()) {
        return saveMealLog({
            userId,
            mealType: entry.mealType,
            foodItems: [{ name: entry.name, quantity: entry.quantity, nutrition: entry.nutrition }],
            notes: `Logged via AI coach: ${entry.description}`,
            source: 'chat',
            timestamp: now,
        });
    }

    return { prepare, save, estimate };
}

module.exports = { createFoodLogTools, buildEntry, describeEntry, mealTypeFromTime };
