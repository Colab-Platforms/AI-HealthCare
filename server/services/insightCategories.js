// Turns an insight's raw numeric data into qualitative category labels.
//
// The LLM only ever sees these labels, never the numbers, so the insight text
// can't quote a figure that disagrees with what the app shows next to it.
// The same labels also decide staleness: an insight is regenerated only when
// a label changes (steps moving from "low" to "about_half", a first meal
// logged), not on every small sync — 1,099 -> 1,121 steps no longer costs an
// LLM call. Raw numbers stay stored in dataSnapshot for debugging/support.

const progressBand = (actual, goal) => {
  if (actual == null || !goal) return 'not_logged';
  if (actual <= 0) return 'not_started';
  const ratio = actual / goal;
  if (ratio < 0.25) return 'just_started';
  if (ratio < 0.5) return 'low';
  if (ratio < 0.75) return 'about_half';
  if (ratio < 1) return 'close_to_goal';
  return 'goal_met';
};

const scoreBand = (score) => {
  if (score == null) return 'not_logged';
  if (score < 40) return 'needs_attention';
  if (score < 70) return 'fair';
  if (score < 85) return 'good';
  return 'excellent';
};

const intakeBand = (actual, goal) => {
  if (actual == null || !goal) return 'not_logged';
  const ratio = actual / goal;
  if (ratio < 0.8) return 'under_goal';
  if (ratio <= 1.15) return 'on_track';
  return 'over_goal';
};

const mealsBand = (count) => {
  if (!count) return 'none_logged';
  if (count === 1) return 'one_meal';
  if (count === 2) return 'two_meals';
  return 'three_or_more';
};

const foodQualityBand = (healthy, junk) => {
  if (!healthy && !junk) return 'not_logged';
  if (!junk) return 'mostly_healthy';
  if (!healthy) return 'mostly_junk';
  return healthy >= junk ? 'mostly_healthy_some_junk' : 'more_junk_than_healthy';
};

const vsBaseline = (today, baseline, tolerance, { higherIsBetter }) => {
  if (today == null || baseline == null || !baseline) return 'not_available';
  const ratio = today / baseline;
  if (ratio > 1 + tolerance) return higherIsBetter ? 'better_than_usual' : 'worse_than_usual';
  if (ratio < 1 - tolerance) return higherIsBetter ? 'worse_than_usual' : 'better_than_usual';
  return 'usual';
};

const sleepShortfallBand = (minutes) => {
  if (minutes == null) return null;
  if (minutes <= 30) return 'slightly_short';
  if (minutes <= 90) return 'moderately_short';
  return 'well_short';
};

const adherenceBand = (fraction) => {
  if (!fraction) return null;
  const [met, total] = String(fraction).split('/').map(Number);
  if (!total) return null;
  const ratio = met / total;
  if (ratio < 0.34) return 'rarely_meets_goal';
  if (ratio < 0.67) return 'sometimes_meets_goal';
  return 'usually_meets_goal';
};

const sleepDebtBand = (hours) => {
  if (hours == null) return null;
  if (hours < 1) return 'none';
  if (hours < 5) return 'small';
  return 'large';
};

const dayStatus = (data) => (data.isPartialDay ? 'day_in_progress' : 'full_day');

const builders = {
  fitness: (data) => ({
    dayStatus: dayStatus(data),
    stepsVsGoal: progressBand(data.steps, data.stepGoal),
    activityScore: scoreBand(data.activityScore),
    workout: data.workouts?.length ? 'workout_logged' : 'no_workout_logged',
  }),

  sleep: (data) => {
    const night = data.lastNight || {};
    return {
      lastNightVsGoal: night.vsIdeal ?? 'not_logged', // below | within | above
      shortBy: night.vsIdeal === 'below' ? sleepShortfallBand(night.shortfallMinutesToMin) : null,
      sleepQuality: scoreBand(night.qualityScore),
      efficiency: night.efficiencyStatus ?? null,
      historyDepth: data.tier, // insufficient_data | raw_comparison | trend_analysis | full_analysis
      weeklyTrend: data.trend ?? null, // improving | stable | declining
      sleepDebt: sleepDebtBand(data.sleepDebtHours),
      goalConsistency: adherenceBand(data.goalAdherence7d),
      bedtimeRegularity: data.regularityStatus ?? null,
    };
  },

  nutrition: (data) => ({
    meals: mealsBand(data.meals?.length),
    caloriesVsGoal: intakeBand(data.calories, data.calorieGoal),
    proteinVsGoal: intakeBand(data.protein, data.proteinGoal),
    foodQuality: foodQualityBand(data.healthyFoodsCount, data.junkFoodsCount),
    waterVsGoal: progressBand(data.waterGlasses, data.waterGoalMl),
  }),

  hydration: (data) => ({
    waterVsGoal: progressBand(data.waterGlasses, data.waterGoalMl),
  }),

  recovery: (data) => ({
    recoveryLevel: scoreBand(data.recoveryScore),
    hrv: vsBaseline(data.hrvToday, data.hrvBaseline14, 0.1, { higherIsBetter: true }),
    restingHeartRate: vsBaseline(data.rhrToday, data.rhrBaseline14, 0.05, { higherIsBetter: false }),
  }),

  smoking: (data) => ({
    cigarettes: data.cigarettes == null ? 'not_logged'
      : data.cigarettes === 0 ? 'none' : data.cigarettes <= 3 ? 'a_few' : 'several',
    resistedCravings: data.cigarettesResisted > 0 ? 'yes' : 'no',
  }),

  alcohol: (data) => ({
    alcohol: data.alcoholUnits == null ? 'not_logged'
      : data.alcoholUnits === 0 ? 'none' : data.alcoholUnits <= 2 ? 'moderate' : 'high',
  }),

  overall: (data) => ({
    dayStatus: dayStatus(data),
    sleep: scoreBand(data.scoreComponents?.sleep),
    activity: scoreBand(data.scoreComponents?.activity),
    stepsVsGoal: progressBand(data.activityDetail?.steps?.actual, data.activityDetail?.steps?.goal),
    nutrition: scoreBand(data.scoreComponents?.nutrition),
    meals: mealsBand(data.meals?.length),
    water: progressBand(data.waterGlasses, data.waterGoalMl),
    recovery: data.recovery ? scoreBand(data.recovery.recoveryScore) : 'not_logged',
  }),
};

function buildCategories(insightType, data) {
  const build = builders[insightType];
  return build && data ? build(data) : null;
}

// Stable comparison regardless of key order.
function sameCategories(a, b) {
  if (!a || !b) return false;
  const norm = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k] ?? null]));
  return norm(a) === norm(b);
}

module.exports = { buildCategories, sameCategories, progressBand, scoreBand };
