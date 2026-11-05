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

// The live card may compare with the day before only while the new day has
// barely begun (before noon, almost nothing logged). Once real data builds
// up, "less than the day before" would compare half a day with a whole one.
const barelyStarted = (data) => {
  const actual = data.activityDetail?.steps?.actual ?? data.steps;
  const goal = data.activityDetail?.steps?.goal ?? data.stepGoal;
  return ['not_logged', 'not_started', 'just_started'].includes(progressBand(actual, goal))
    && (data.meals?.length || 0) <= 1;
};

const dayStatus = (data) => {
  if (!data.isPartialDay) return 'full_day';
  return data.beforeNoon && barelyStarted(data) ? 'day_just_started' : 'day_in_progress';
};

const isLiveDay = (status) => status === 'day_in_progress' || status === 'day_just_started';

// ------------------------------------------------- overall: links and tiers
//
// The overall insight explains how one pillar affected the others ("short
// sleep held back recovery"). The model never decides that connection: it
// is picked here, from the user's actual data, and the text is checked
// against it afterwards (insightTextRules.findLabelProblems).

const LOW_STEPS = new Set(['not_started', 'just_started', 'low']);
const GOOD = new Set(['good', 'excellent']);
const LOW_SCORE = new Set(['needs_attention', 'fair']);
const MEANINGFUL_SHORT = new Set(['moderately_short', 'well_short']);
// Calories/protein "under goal" only means the user ate too little when the
// day was actually logged — one logged meal is a logging gap, not undereating.
const MIN_MEALS_FOR_INTAKE = 2;
const enoughMealsLogged = (data) => (data.meals?.length || 0) >= MIN_MEALS_FOR_INTAKE;

const sleepVsGoal = (minutes, goalHours) => {
  if (!minutes || !goalHours) return { vs: 'not_logged', shortBy: null };
  const shortfall = goalHours * 60 - minutes;
  return shortfall > 0
    ? { vs: 'below', shortBy: sleepShortfallBand(shortfall) }
    : { vs: 'within', shortBy: null };
};

const alcoholBand = (units) => {
  if (units == null) return 'not_logged';
  if (units === 0) return 'none';
  return units <= 2 ? 'moderate' : 'high';
};

// A logged workout counts as real activity even on a low-step day.
const activityLevel = (c) => {
  if (c.stepsVsGoal === 'goal_met' || (c.workout === 'workout_logged' && c.activity === 'excellent')) return 'high';
  if (LOW_STEPS.has(c.stepsVsGoal) && c.workout !== 'workout_logged') return 'low';
  return 'medium';
};

function pickTier(c, data) {
  if (isLiveDay(c.dayStatus)) return 'in_progress';
  const sleepOk = c.sleepVsGoal === 'within';
  const activityOk = c.stepsVsGoal === 'goal_met';
  const nutritionOk = enoughMealsLogged(data) && GOOD.has(c.nutrition);
  // Recovery needs a wearable most users don't have, so it can't be a
  // requirement — but when it is there, it has to be good too.
  const recoveryOk = c.recovery === 'not_logged' || GOOD.has(c.recovery);
  if (sleepOk && activityOk && nutritionOk && recoveryOk && scoreBand(data.healthScore) === 'excellent') {
    return 'reward';
  }
  // A high score built from only the pillars that were logged is not a
  // reward day — the missing ones were never measured.
  const sleepLogged = c.sleepVsGoal !== 'not_logged';
  const activityLogged = c.stepsVsGoal !== 'not_logged' || c.workout === 'workout_logged';
  const mealsLogged = c.meals !== 'none_logged';
  const loggedAreGood = (!sleepLogged || sleepOk) && (!activityLogged || activityOk)
    && (!mealsLogged || nutritionOk) && recoveryOk;
  const anyLogged = sleepLogged || activityLogged || mealsLogged;
  const anyMissing = !sleepLogged || !activityLogged || !mealsLogged;
  return anyLogged && anyMissing && loggedAreGood ? 'incomplete_data' : 'improve';
}

const streakLabel = (daysBefore = 0) => {
  if (daysBefore <= 0) return 'first_day';
  if (daysBefore === 1) return 'second_day';
  if (daysBefore === 2) return 'third_day';
  return 'several_days';
};

// Strongest connection first. Only last night's sleep is known while the day
// is still in progress — activity and meals aren't finished yet, so links
// built on them would be premature.
function pickLink(c) {
  const sleepShort = c.sleepVsGoal === 'below' && MEANINGFUL_SHORT.has(c.sleepShortBy);
  const recoveryLow = LOW_SCORE.has(c.recovery);
  if (['moderate', 'high'].includes(c.alcohol) && (sleepShort || recoveryLow)) return 'alcohol_sleep';
  if (sleepShort && recoveryLow) return 'sleep_recovery';
  if (isLiveDay(c.dayStatus)) return 'none';

  const activity = activityLevel(c);
  if (sleepShort && activity === 'low') return 'sleep_activity';
  if (c.recovery === 'needs_attention' && activity === 'high') return 'recovery_push';
  if (c.calories === 'under_goal' && activity === 'high') return 'underfuel_active';
  if (c.calories === 'under_goal' && activity === 'low') return 'underfuel_inactive';
  if (c.workout === 'workout_logged' && c.protein === 'under_goal') return 'workout_protein';
  if (c.calories === 'over_goal' && activity === 'low') return 'surplus_inactive';
  if (['just_started', 'low'].includes(c.water) && activity === 'high') return 'water_active';
  if (c.sleepVsGoal === 'within' && GOOD.has(c.recovery) && activity === 'low') return 'rested_inactive';
  if (c.tier === 'reward') return 'all_good';
  return 'none';
}

// ------------------------------------------- single pillars: tier + reason
//
// Same idea as the overall link, for one pillar: a reward day when that
// pillar fully came together, otherwise at most one reason the data
// actually shows. Picked here, checked against the text afterwards.

const isMeaningfullyShort = (minutes, goalHours) => MEANINGFUL_SHORT.has(sleepVsGoal(minutes, goalHours).shortBy);

function withTier(c, data, rewardWhen, reason) {
  if (rewardWhen) {
    c.tier = 'reward';
    c.rewardStreak = streakLabel(data.rewardStreakBefore);
  } else {
    c.tier = isLiveDay(c.dayStatus) ? 'in_progress' : 'improve';
    c.reason = reason || 'none';
  }
  return c;
}

function sleepReason(c) {
  if (c.lastNightVsGoal !== 'below') return null;
  if (['insufficient_data', 'raw_comparison'].includes(c.historyDepth)) return null;
  if (c.bedtimeRegularity === 'irregular') return 'irregular_bedtime';
  if (c.sleepDebt === 'large') return 'sleep_debt';
  return null;
}

function fitnessReason(c, data) {
  if (!LOW_STEPS.has(c.stepsVsGoal)) return null;
  if (c.workout === 'workout_logged') return 'workout_counted';
  if (isMeaningfullyShort(data.sleepMinutes, data.sleepGoalHours)) return 'short_sleep';
  return null;
}

function nutritionReason(c, data) {
  const worked = (data.workouts?.length || 0) > 0;
  if (worked && c.proteinVsGoal === 'under_goal') return 'workout_needs_protein';
  const active = worked || progressBand(data.steps, data.stepGoal) === 'goal_met';
  if (active && c.caloriesVsGoal === 'under_goal') return 'underfuel_active';
  return null;
}

function recoveryReason(c, data) {
  if (!LOW_SCORE.has(c.recoveryLevel)) return null;
  if (isMeaningfullyShort(data.sleepMinutes, data.sleepGoalHours)) return 'short_sleep';
  if (c.hrv === 'worse_than_usual') return 'hrv_below_usual';
  if (c.restingHeartRate === 'worse_than_usual') return 'rhr_above_usual';
  return null;
}

// patterns: what the user's own last two weeks show (see
// dailyInsightService.getPersonalPatterns). Without one the text has to hedge.
const LINK_PATTERN = { sleep_recovery: 'sleepRecovery', sleep_activity: 'sleepActivity' };

function buildOverall(data) {
  const sleep = sleepVsGoal(data.sleepMinutes, data.sleepGoalHours);
  const sleepScore = scoreBand(data.scoreComponents?.sleep);
  const enoughMeals = enoughMealsLogged(data);
  const c = {
    dayStatus: dayStatus(data),
    // A night short of the goal is never "excellent" here, even when the
    // duration-only score is high — the Sleep card would be saying "short".
    sleep: sleep.vs === 'below' && sleepScore === 'excellent' ? 'good' : sleepScore,
    sleepVsGoal: sleep.vs,
    activity: scoreBand(data.scoreComponents?.activity),
    stepsVsGoal: progressBand(data.activityDetail?.steps?.actual, data.activityDetail?.steps?.goal),
    workout: data.workouts?.length ? 'workout_logged' : 'no_workout_logged',
    nutrition: scoreBand(data.scoreComponents?.nutrition),
    meals: mealsBand(data.meals?.length),
    calories: enoughMeals ? intakeBand(data.calories, data.calorieGoal) : 'not_enough_meals_logged',
    protein: enoughMeals ? intakeBand(data.protein, data.proteinGoal) : 'not_enough_meals_logged',
    water: progressBand(data.waterGlasses, data.waterGoalMl),
    recovery: data.recovery ? scoreBand(data.recovery.recoveryScore) : 'not_logged',
    alcohol: alcoholBand(data.alcoholUnits),
  };
  if (sleep.shortBy) c.sleepShortBy = sleep.shortBy;
  c.tier = pickTier(c, data);
  if (c.tier === 'reward') c.rewardStreak = streakLabel(data.rewardStreakBefore);
  c.link = pickLink(c);
  if (c.link !== 'none' && c.link !== 'all_good') {
    c.linkEvidence = data.patterns?.[LINK_PATTERN[c.link]] ? 'personal_pattern' : 'general';
  }
  return c;
}

const builders = {
  fitness: (data) => {
    const c = {
      dayStatus: dayStatus(data),
      stepsVsGoal: progressBand(data.steps, data.stepGoal),
      activityScore: scoreBand(data.activityScore),
      workout: data.workouts?.length ? 'workout_logged' : 'no_workout_logged',
    };
    return withTier(c, data, c.stepsVsGoal === 'goal_met', fitnessReason(c, data));
  },

  sleep: (data) => {
    const night = data.lastNight || {};
    const c = {
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
    // A night only counts as a full win with the quality to match — or no
    // quality reading at all, which is no reason to withhold it.
    const reward = ['within', 'above'].includes(c.lastNightVsGoal)
      && (GOOD.has(c.sleepQuality) || c.sleepQuality === 'not_logged');
    return withTier(c, data, reward, sleepReason(c));
  },

  nutrition: (data) => {
    const c = {
      dayStatus: dayStatus(data),
      meals: mealsBand(data.meals?.length),
      caloriesVsGoal: enoughMealsLogged(data) ? intakeBand(data.calories, data.calorieGoal) : 'not_enough_meals_logged',
      proteinVsGoal: enoughMealsLogged(data) ? intakeBand(data.protein, data.proteinGoal) : 'not_enough_meals_logged',
      foodQuality: foodQualityBand(data.healthyFoodsCount, data.junkFoodsCount),
      waterVsGoal: progressBand(data.waterGlasses, data.waterGoalMl),
    };
    // Only a finished day can be judged as a whole.
    const reward = c.dayStatus === 'full_day' && c.caloriesVsGoal === 'on_track'
      && ['on_track', 'over_goal'].includes(c.proteinVsGoal)
      && ['mostly_healthy', 'mostly_healthy_some_junk'].includes(c.foodQuality);
    return withTier(c, data, reward, nutritionReason(c, data));
  },

  hydration: (data) => ({
    dayStatus: dayStatus(data),
    waterVsGoal: progressBand(data.waterGlasses, data.waterGoalMl),
  }),

  recovery: (data) => {
    const c = {
      recoveryLevel: scoreBand(data.recoveryScore),
      hrv: vsBaseline(data.hrvToday, data.hrvBaseline14, 0.1, { higherIsBetter: true }),
      restingHeartRate: vsBaseline(data.rhrToday, data.rhrBaseline14, 0.05, { higherIsBetter: false }),
    };
    const reward = GOOD.has(c.recoveryLevel)
      && c.hrv !== 'worse_than_usual' && c.restingHeartRate !== 'worse_than_usual';
    return withTier(c, data, reward, recoveryReason(c, data));
  },

  smoking: (data) => ({
    cigarettes: data.cigarettes == null ? 'not_logged'
      : data.cigarettes === 0 ? 'none' : data.cigarettes <= 3 ? 'a_few' : 'several',
    resistedCravings: data.cigarettesResisted > 0 ? 'yes' : 'no',
  }),

  alcohol: (data) => ({
    alcohol: data.alcoholUnits == null ? 'not_logged'
      : data.alcoholUnits === 0 ? 'none' : data.alcoholUnits <= 2 ? 'moderate' : 'high',
  }),

  overall: buildOverall,
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

module.exports = { buildCategories, sameCategories, progressBand, scoreBand, isLiveDay };
