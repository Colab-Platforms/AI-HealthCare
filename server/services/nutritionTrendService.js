const NutritionSummary = require('../models/NutritionSummary');
const HealthGoal = require('../models/HealthGoal');
const User = require('../models/User');
const { calculateDietQualityScore } = require('./dietQualityScoreService');

// Rolling windows ending today (UTC), matching the W / M / 3M toggle in the app.
const RANGE_DAYS = { W: 7, M: 30, '3M': 90 };

class NutritionTrendInputError extends Error {}

const TOTAL_FIELDS = [
  'totalCalories', 'totalProtein', 'totalCarbs', 'totalFats',
  'totalFiber', 'totalSugar', 'totalSodium', 'totalSaturatedFat',
  'totalVitaminA', 'totalVitaminC', 'totalVitaminD', 'totalVitaminB12',
  'totalIron', 'totalCalcium', 'totalPotassium', 'totalMagnesium', 'totalOmega3',
];

const dayStr = (d) => d.toISOString().split('T')[0];
const mean = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);
const round = (n) => (n === null ? null : Math.round(n));

/**
 * One average per metric for the selected timeframe, plus a per-day series.
 * Only LOGGED days (totalCalories > 0) count toward averages — an empty day
 * would otherwise drag every average toward zero. Missing days appear in the
 * series as null so the chart can leave a gap.
 *
 *  - score:    Nutrition Score of the averaged day (same as nutrition-score?range=weekly);
 *              the series holds each day's own score
 *  - calories: mean of daily consumed calories + the daily series
 *  - quality:  healthy foods share per day = healthyFoodsCount / totalFoodsCount * 100
 *              (average = mean of daily values)
 */
async function getNutritionTrends(userId, range) {
  const days = RANGE_DAYS[range];
  if (!days) {
    throw new NutritionTrendInputError('range must be one of W, M, 3M');
  }

  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const [user, healthGoal, summaries] = await Promise.all([
    User.findById(userId).select('profile.age profile.gender profile.weight').lean(),
    HealthGoal.findOne({ userId, isActive: true }).select('goalType currentWeight').lean(),
    NutritionSummary.find({
      userId,
      date: { $gte: start, $lte: end },
      totalCalories: { $gt: 0 },
    }).select(`date calorieGoal healthyFoodsCount totalFoodsCount ${TOTAL_FIELDS.join(' ')}`).lean(),
  ]);

  const profileBase = {
    age: user?.profile?.age,
    gender: user?.profile?.gender,
    goalType: healthGoal?.goalType,
    weightKg: healthGoal?.currentWeight ?? user?.profile?.weight,
  };

  const byDate = new Map();
  for (const s of summaries) {
    const scoreResult = calculateDietQualityScore(s, { ...profileBase, calorieGoal: s.calorieGoal });
    byDate.set(dayStr(s.date), {
      score: scoreResult.score,
      calories: Math.round(Number(s.totalCalories) || 0),
      quality: s.totalFoodsCount > 0 ? Math.round(((Number(s.healthyFoodsCount) || 0) / s.totalFoodsCount) * 100) : 0,
      calorieGoal: Number(s.calorieGoal) || null,
    });
  }

  const scoreSeries = [];
  const calorieSeries = [];
  const qualitySeries = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const key = dayStr(d);
    const row = byDate.get(key);
    scoreSeries.push({ date: key, value: row ? row.score : null });
    calorieSeries.push({ date: key, value: row ? row.calories : null });
    qualitySeries.push({ date: key, value: row ? row.quality : null });
  }

  const rows = [...byDate.values()];

  // Period score = score of the AVERAGED day (average nutrient totals across
  // logged days, then run the formula once). Same method as
  // GET /nutrition-score?range=weekly|monthly, so both endpoints agree.
  let periodScore = null;
  if (summaries.length) {
    const averagedTotals = {};
    for (const field of TOTAL_FIELDS) {
      averagedTotals[field] = mean(summaries.map((s) => Number(s[field]) || 0));
    }
    const avgCalorieGoal = mean(summaries.map((s) => Number(s.calorieGoal) || 0)) || undefined;
    periodScore = calculateDietQualityScore(averagedTotals, { ...profileBase, calorieGoal: avgCalorieGoal }).score;
  }

  return {
    range,
    days,
    startDate: dayStr(start),
    endDate: dayStr(end),
    daysLogged: rows.length,
    score: { average: periodScore, series: scoreSeries },
    calories: {
      dailyAverage: round(mean(rows.map((r) => r.calories))),
      goalAverage: round(mean(rows.map((r) => r.calorieGoal).filter((g) => g))),
      series: calorieSeries,
    },
    quality: { average: round(mean(rows.map((r) => r.quality))), series: qualitySeries },
  };
}

module.exports = { getNutritionTrends, NutritionTrendInputError, RANGE_DAYS };
