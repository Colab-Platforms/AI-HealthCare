const NutritionSummary = require('../models/NutritionSummary');
const DailyHealthScore = require('../models/DailyHealthScore');
const { calculateDailyScore } = require('./dailyHealthScoreService');
const { getActiveScoreConfig } = require('../utils/scoreConfig');

// Rolling windows ending today (UTC), matching the W / M / 3M toggle in the app.
// DailyHealthScore keeps 90 days, which is exactly the longest window (3M).
const RANGE_DAYS = { W: 7, M: 30, '3M': 90 };

class NutritionTrendInputError extends Error {}

const dayStr = (d) => d.toISOString().split('T')[0];
const mean = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);
const round = (n) => (n === null ? null : Math.round(n));

/**
 * One average per metric for the selected timeframe, plus a per-day series.
 * Averages count only days that have data; days without data appear in the
 * series as null so the chart can leave a gap.
 *
 *  - score:    the Health Score's nutrition component per day
 *              (GET /health/score -> dailyHealthScore.components.nutrition =
 *              meals logged + nutrition score + calorie closeness).
 *              Read from the persisted DailyHealthScore rows; today's is
 *              recalculated first. average = mean of the daily values.
 *  - calories: daily consumed calories (NutritionSummary.totalCalories)
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
  const startKey = dayStr(start);
  const endKey = dayStr(end);

  // Refresh today's row the same way /health/score does before reading the window.
  const config = await getActiveScoreConfig();
  await calculateDailyScore(userId, endKey, { config }).catch(() => null);

  const [scoreRows, summaries] = await Promise.all([
    DailyHealthScore.find({ userId, date: { $gte: startKey, $lte: endKey } })
      .select('date components.nutrition').lean(),
    NutritionSummary.find({
      userId,
      date: { $gte: start, $lte: end },
      totalCalories: { $gt: 0 },
    }).select('date calorieGoal healthyFoodsCount totalFoodsCount totalCalories').lean(),
  ]);

  // A day only has a nutrition score if the component exists on its row
  // (absent = nothing logged), not a fake zero.
  const scoreByDate = new Map();
  for (const r of scoreRows) {
    if (typeof r.components?.nutrition === 'number') scoreByDate.set(r.date, r.components.nutrition);
  }

  const summaryByDate = new Map();
  for (const s of summaries) {
    summaryByDate.set(dayStr(s.date), {
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
    const sc = scoreByDate.get(key);
    const row = summaryByDate.get(key);
    scoreSeries.push({ date: key, value: sc === undefined ? null : Math.round(sc) });
    calorieSeries.push({ date: key, value: row ? row.calories : null });
    qualitySeries.push({ date: key, value: row ? row.quality : null });
  }

  const rows = [...summaryByDate.values()];
  return {
    range,
    days,
    startDate: startKey,
    endDate: endKey,
    daysLogged: rows.length,
    score: { average: round(mean([...scoreByDate.values()])), series: scoreSeries },
    calories: {
      dailyAverage: round(mean(rows.map((r) => r.calories))),
      goalAverage: round(mean(rows.map((r) => r.calorieGoal).filter((g) => g))),
      series: calorieSeries,
    },
    quality: { average: round(mean(rows.map((r) => r.quality))), series: qualitySeries },
  };
}

module.exports = { getNutritionTrends, NutritionTrendInputError, RANGE_DAYS };
