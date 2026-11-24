const { dayStr, result, noData } = require('./common');

// Calories today vs goal, and the 7-day picture (how regularly they log, how
// close they stay to the goal, how healthy the choices are).
async function nutritionSpecialist({ userId, now = new Date(), deps = {} }) {
    const getNutritionTrends = deps.getNutritionTrends || require('../../../services/nutritionTrendService').getNutritionTrends;
    const week = await getNutritionTrends(userId, 'W');
    if (!week || !week.daysLogged) {
        return noData('nutrition', ['food_logs'], 'No meals logged in the last 7 days.');
    }

    const findings = [];
    const missing = [];
    const todayKey = dayStr(now);
    const today = (week.calories?.series || []).find((p) => p.date === todayKey);
    const goal = week.calories?.goalAverage;

    if (today?.value) {
        findings.push(`Logged today: ${today.value} kcal${goal ? ` of a ~${goal} kcal goal` : ''}.`);
    } else {
        missing.push('food_logs_today');
        findings.push('Nothing logged today yet.');
    }
    findings.push(`Last 7 days: meals logged on ${week.daysLogged} of 7 days`
        + `${week.calories?.dailyAverage ? `, average ${week.calories.dailyAverage} kcal/day` : ''}`
        + `${goal ? ` vs goal ~${goal}` : ''}.`);
    if (typeof week.quality?.average === 'number') findings.push(`Healthy food share (7-day average): ${week.quality.average}%.`);
    if (typeof week.score?.average === 'number') findings.push(`Nutrition score (7-day average): ${week.score.average}/100.`);

    return result('nutrition', {
        findings,
        data_used: ['nutrition_7d', ...(today?.value ? ['food_logs_today'] : [])],
        missing_data: missing,
        confidence: week.daysLogged >= 4 ? 'high' : 'moderate',
    });
}

module.exports = { nutritionSpecialist };
