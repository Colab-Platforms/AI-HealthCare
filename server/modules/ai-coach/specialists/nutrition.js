const { dayStr, result, noData, cachedLongRange, monthLabel } = require('./common');
const { windowFor, LONG_RANGE_DAYS } = require('../context/lookback');

// Calories today vs goal, and the 7-day picture (how regularly they log, how
// close they stay to the goal, how healthy the choices are). Monthly averages
// when asked about months back (straight from daily NutritionSummary rows,
// indexed on { userId, date }).
async function nutritionSpecialist({ userId, now = new Date(), deps = {}, lookbackDays = 0 }) {
    const getNutritionTrends = deps.getNutritionTrends || require('../../../services/nutritionTrendService').getNutritionTrends;
    const monthlyNutrition = deps.monthlyNutrition || defaultMonthlyNutrition;
    const long = lookbackDays > LONG_RANGE_DAYS;
    const win = long ? windowFor(lookbackDays, now) : null;
    const [week, monthly] = await Promise.all([
        getNutritionTrends(userId, 'W'),
        long ? cachedLongRange(deps, `nutrition:${userId}:${win.startDate}:${win.endDate}`,
            () => monthlyNutrition(userId, win)) : null,
    ]);
    const trendLine = monthly?.length
        ? `Monthly nutrition averages on logged days (${win.startDate} to ${win.endDate}): ${monthly.map((m) => `${monthLabel(m.period)} ${m.avgCalories} kcal, protein ${m.avgProtein} g (${m.daysLogged} days logged)`).join('; ')}.`
        : null;

    if (!week || !week.daysLogged) {
        if (trendLine) return result('nutrition', { findings: ['No meals logged in the last 7 days.', trendLine], data_used: ['nutrition_monthly'], missing_data: ['food_logs_recent'], confidence: 'low' });
        return noData('nutrition', ['food_logs'], 'No meals logged in the last 7 days.');
    }

    const findings = [];
    const missing = [];
    if (trendLine) findings.push(trendLine);
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

async function defaultMonthlyNutrition(userId, { startDate, endDate }) {
    const NutritionSummary = require('../../../models/NutritionSummary');
    const mongoose = require('mongoose');
    const rows = await NutritionSummary.aggregate([
        { $match: {
            userId: new mongoose.Types.ObjectId(String(userId)),
            date: { $gte: new Date(`${startDate}T00:00:00Z`), $lte: new Date(`${endDate}T23:59:59Z`) },
            totalCalories: { $gt: 0 },
        } },
        { $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
            avgCalories: { $avg: '$totalCalories' },
            avgProtein: { $avg: '$totalProtein' },
            daysLogged: { $sum: 1 },
        } },
        { $sort: { _id: 1 } },
    ]);
    return rows.map((r) => ({ period: r._id, avgCalories: Math.round(r.avgCalories), avgProtein: Math.round(r.avgProtein || 0), daysLogged: r.daysLogged }));
}

module.exports = { nutritionSpecialist };
