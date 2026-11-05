const test = require('node:test');
const assert = require('node:assert');
const { buildCategories, sameCategories, progressBand } = require('../services/insightCategories');

test('progressBand: small step changes inside a band do not change the label', () => {
  assert.strictEqual(progressBand(1099, 7500), 'just_started');
  assert.strictEqual(progressBand(1121, 7500), 'just_started');
});

test('progressBand: crossing a band boundary changes the label', () => {
  assert.strictEqual(progressBand(0, 7500), 'not_started');
  assert.strictEqual(progressBand(3000, 7500), 'low');
  assert.strictEqual(progressBand(4000, 7500), 'about_half');
  assert.strictEqual(progressBand(6000, 7500), 'close_to_goal');
  assert.strictEqual(progressBand(7500, 7500), 'goal_met');
  assert.strictEqual(progressBand(null, 7500), 'not_logged');
});

test('categories never carry raw numbers', () => {
  const overall = buildCategories('overall', {
    isPartialDay: true,
    scoreComponents: { activity: 11.2, sleep: 92 },
    activityDetail: { steps: { actual: 1121, goal: 7500 } },
    meals: [],
    waterGlasses: 500,
    waterGoalMl: 2000,
    recovery: { recoveryScore: 52 },
  });
  for (const value of Object.values(overall)) {
    assert.strictEqual(typeof value, 'string');
    assert.ok(!/\d/.test(value), `label "${value}" contains a digit`);
  }
  assert.strictEqual(overall.activity, 'needs_attention');
  assert.strictEqual(overall.sleep, 'excellent');
  assert.strictEqual(overall.meals, 'none_logged');
  assert.strictEqual(overall.water, 'low');
});

test('sleep categories follow the goal-based vsIdeal and size the shortfall', () => {
  const cats = buildCategories('sleep', {
    tier: 'full_analysis',
    lastNight: { vsIdeal: 'below', shortfallMinutesToMin: 45, qualityScore: 72, efficiencyStatus: 'good' },
    trend: 'declining',
    sleepDebtHours: 9.9,
    goalAdherence7d: '1/8',
    regularityStatus: 'irregular',
  });
  assert.strictEqual(cats.lastNightVsGoal, 'below');
  assert.strictEqual(cats.shortBy, 'moderately_short');
  assert.strictEqual(cats.sleepDebt, 'large');
  assert.strictEqual(cats.goalConsistency, 'rarely_meets_goal');
});

// A finished day; each test overrides only what it is about.
const day = (over = {}) => ({
  isPartialDay: false,
  healthScore: 70,
  scoreComponents: { sleep: 80, activity: 60, nutrition: 70 },
  sleepMinutes: 480,
  sleepGoalHours: 8,
  activityDetail: { steps: { actual: 4000, goal: 8000 } },
  workouts: [],
  meals: [{}, {}, {}],
  calories: 1800, calorieGoal: 2000,
  protein: 80, proteinGoal: 90,
  waterGlasses: 1800, waterGoalMl: 2000,
  recovery: { recoveryScore: 75 },
  alcoholUnits: null,
  ...over,
});

test('overall: a well-short night with low recovery links sleep to recovery', () => {
  const c = buildCategories('overall', day({ sleepMinutes: 330, recovery: { recoveryScore: 35 } }));
  assert.strictEqual(c.sleepVsGoal, 'below');
  assert.strictEqual(c.sleepShortBy, 'well_short');
  assert.strictEqual(c.link, 'sleep_recovery');
  assert.strictEqual(c.linkEvidence, 'general');
});

test('overall: the link says personal_pattern only when the user\'s own history shows it', () => {
  const c = buildCategories('overall', day({ sleepMinutes: 330, recovery: { recoveryScore: 35 }, patterns: { sleepRecovery: true } }));
  assert.strictEqual(c.linkEvidence, 'personal_pattern');
});

test('overall: a slightly short night is not enough to blame recovery on sleep', () => {
  const c = buildCategories('overall', day({ sleepMinutes: 465, recovery: { recoveryScore: 35 } }));
  assert.strictEqual(c.sleepShortBy, 'slightly_short');
  assert.notStrictEqual(c.link, 'sleep_recovery');
});

test('overall: one logged meal is a logging gap, never "ate too little"', () => {
  const c = buildCategories('overall', day({
    meals: [{}], calories: 400, activityDetail: { steps: { actual: 9000, goal: 8000 } },
  }));
  assert.strictEqual(c.calories, 'not_enough_meals_logged');
  assert.notStrictEqual(c.link, 'underfuel_active');
});

test('overall: light meals on a very active day link food to activity', () => {
  const c = buildCategories('overall', day({ calories: 1200, activityDetail: { steps: { actual: 9000, goal: 8000 } } }));
  assert.strictEqual(c.link, 'underfuel_active');
});

test('overall: a fully good day is a reward, with the streak from the days before', () => {
  const perfect = {
    healthScore: 92,
    scoreComponents: { sleep: 95, activity: 100, nutrition: 90 },
    activityDetail: { steps: { actual: 9000, goal: 8000 } },
    calories: 2000, protein: 90, waterGlasses: 2000,
    recovery: { recoveryScore: 88 },
  };
  const first = buildCategories('overall', day(perfect));
  assert.strictEqual(first.tier, 'reward');
  assert.strictEqual(first.rewardStreak, 'first_day');
  assert.strictEqual(first.link, 'all_good');
  assert.strictEqual(buildCategories('overall', day({ ...perfect, rewardStreakBefore: 2 })).rewardStreak, 'third_day');
});

test('overall: a high score with pillars missing is incomplete, not a reward', () => {
  const c = buildCategories('overall', day({
    healthScore: 95,
    scoreComponents: { sleep: 95, activity: 100 },
    activityDetail: { steps: { actual: 9000, goal: 8000 } },
    meals: [], recovery: null,
  }));
  assert.strictEqual(c.tier, 'incomplete_data');
});

test('overall: a short night is never labelled excellent sleep', () => {
  const c = buildCategories('overall', day({ sleepMinutes: 450, scoreComponents: { sleep: 96, activity: 60, nutrition: 70 } }));
  assert.strictEqual(c.sleep, 'good');
});

test('overall: while the day is in progress only last night can be linked', () => {
  const c = buildCategories('overall', day({ isPartialDay: true, calories: 1000, activityDetail: { steps: { actual: 9000, goal: 8000 } } }));
  assert.strictEqual(c.tier, 'in_progress');
  assert.strictEqual(c.link, 'none');
});

test('live day: "just started" only before noon with almost nothing logged', () => {
  const morning = { isPartialDay: true, beforeNoon: true, meals: [], activityDetail: { steps: { actual: 800, goal: 8000 } } };
  assert.strictEqual(buildCategories('overall', day(morning)).dayStatus, 'day_just_started');
  // More data, or past noon: the day is underway and no longer compared with the day before.
  assert.strictEqual(buildCategories('overall', day({ ...morning, activityDetail: { steps: { actual: 3000, goal: 8000 } } })).dayStatus, 'day_in_progress');
  assert.strictEqual(buildCategories('overall', day({ ...morning, beforeNoon: false })).dayStatus, 'day_in_progress');
  assert.strictEqual(buildCategories('nutrition', { isPartialDay: true, beforeNoon: true, meals: [{}, {}] }).dayStatus, 'day_in_progress');
});

test('overall: only steps synced gives no connection, and a met goal asks for the rest', () => {
  const stepsOnly = {
    sleepMinutes: null, meals: [], recovery: null, healthScore: 90,
    scoreComponents: { activity: 100 }, calories: null, protein: null, waterGlasses: null,
  };
  const low = buildCategories('overall', day({ ...stepsOnly, activityDetail: { steps: { actual: 2000, goal: 8000 } } }));
  assert.strictEqual(low.link, 'none');
  assert.strictEqual(low.tier, 'improve');
  const met = buildCategories('overall', day({ ...stepsOnly, activityDetail: { steps: { actual: 9000, goal: 8000 } } }));
  assert.strictEqual(met.tier, 'incomplete_data');
});

test('sameCategories ignores key order and treats missing as stale', () => {
  assert.ok(sameCategories({ a: 'x', b: 'y' }, { b: 'y', a: 'x' }));
  assert.ok(!sameCategories({ a: 'x' }, { a: 'z' }));
  assert.ok(!sameCategories({ a: 'x' }, undefined));
});
