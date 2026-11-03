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

test('sameCategories ignores key order and treats missing as stale', () => {
  assert.ok(sameCategories({ a: 'x', b: 'y' }, { b: 'y', a: 'x' }));
  assert.ok(!sameCategories({ a: 'x' }, { a: 'z' }));
  assert.ok(!sameCategories({ a: 'x' }, undefined));
});
