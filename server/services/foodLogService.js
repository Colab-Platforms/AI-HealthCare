// Saving a meal that has already been reviewed (nutrition known), for callers
// other than the app's own POST /api/nutrition/log-meal: today the AI coach
// ("maine dal chawal khaya, ~500 kcal").
//
// Writes what logMeal writes for a simple text meal, through the same pieces:
//   - FoodLog with totalNutrition summed from the items (same rule as logMeal)
//   - the day's NutritionSummary via nutritionController.updateDailySummaryInternal
//     (the exact function logMeal / exercise logging use: totals, goals, score recompute)
//   - activity log + gamification points, same as logMeal
// logMeal itself still has its own copy of the item/total normalisation
// (it also handles photos, dish edits, micronutrients); moving it onto this
// service is a follow-up so the two can't drift.

const FoodLog = require('../models/FoodLog');
const { logActivity } = require('../utils/activityLogger');

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const num = (v) => Number(v) || 0;

function normaliseItems(foodItems = []) {
    return foodItems.map((item) => ({
        name: String(item.name || 'Food Item').slice(0, 200),
        quantity: String(item.quantity || '1 serving').slice(0, 100),
        nutrition: {
            calories: num(item.nutrition?.calories),
            protein: num(item.nutrition?.protein),
            carbs: num(item.nutrition?.carbs),
            fats: num(item.nutrition?.fats),
            fiber: num(item.nutrition?.fiber),
        },
    }));
}

function totalsOf(items) {
    const t = { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, sugar: 0, sodium: 0, saturatedFat: 0 };
    for (const i of items) {
        t.calories += i.nutrition.calories;
        t.protein += i.nutrition.protein;
        t.carbs += i.nutrition.carbs;
        t.fats += i.nutrition.fats;
        t.fiber += i.nutrition.fiber;
    }
    return t;
}

async function saveMealLog({ userId, mealType, foodItems, notes = '', source = 'chat', timestamp = new Date() }) {
    if (!MEAL_TYPES.includes(mealType)) throw new Error(`Invalid meal type: ${mealType}`);
    const items = normaliseItems(foodItems);
    if (!items.length) throw new Error('At least one food item is required');

    const foodLog = await new FoodLog({
        userId,
        mealType,
        foodItems: items,
        totalNutrition: totalsOf(items),
        notes,
        source,
        timestamp,
    }).save();

    // Same daily summary update the app's meal log runs (lazy require: the
    // controller module is large and loads this service's callers too).
    await require('../controllers/nutritionController').updateDailySummaryInternal(userId, foodLog.timestamp);

    await logActivity(userId, 'LOG_MEAL', 'nutrition', {
        mealType, itemCount: items.length, calories: foodLog.totalNutrition.calories,
        foodNames: items.map((i) => i.name).join(', '), source,
    }).catch(() => {});
    await require('./gamificationService').awardPoints(userId, 'food_log', `Logged ${mealType}`, mealType)
        .catch((err) => console.error('[FoodLog] gamification failed:', err.message));

    return foodLog;
}

module.exports = { saveMealLog, normaliseItems, totalsOf, MEAL_TYPES };
