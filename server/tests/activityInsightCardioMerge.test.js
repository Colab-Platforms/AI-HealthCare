/**
 * Activity Score's Cardio pillar: Steps and Movement Minutes both describe
 * the same underlying behavior for most users (walking moves both
 * together), so dailyHealthScoreService.js now takes the BETTER of the two
 * instead of averaging both in separately (which gave cardio ~2/3 weight vs
 * Strength's 1/3). buildActivityInsight mirrors the same merge so its
 * estimated point-gain stays arithmetically consistent with the real score.
 * These tests exercise that merge in isolation via the insight function,
 * which is the pure, side-effect-free half of the fix.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { buildActivityInsight } = require('../services/activityScoreInsightService');

function baseDay(overrides = {}) {
  return {
    device: { steps: 0, caloriesBurned: 0 },
    manual: { strengthMinutesLast7Days: 0 },
    movementMinutes: null,
    goals: { cardio: { steps: 7500, movementMinutes: 21.4 }, strength: { minutesPerDay: 8.6 } },
    activityScore: 0,
    ...overrides,
  };
}

test('steps far below goal, but a logged swim clears the cardio bar: cardio shows no gap, via=movement minutes', () => {
  const day = baseDay({
    device: { steps: 2000 },
    movementMinutes: { actual: 40, goal: 21.4, source: 'manual' },
    activityScore: 50, // cardio maxed via movement; no strength, which now counts as 0
  });
  const insight = buildActivityInsight(day);
  const cardioGap = insight.topGaps.find((g) => g.signal === 'cardio');
  assert.equal(cardioGap, undefined, 'cardio should not show as a gap once movement minutes cleared the target');
});

test('good steps, no movement-minutes signal at all (e.g. Android/Health Connect): cardio scores from steps alone', () => {
  const day = baseDay({
    device: { steps: 7500 }, // exactly at goal
    movementMinutes: null,
    activityScore: 100,
  });
  const insight = buildActivityInsight(day);
  const cardioGap = insight.topGaps.find((g) => g.signal === 'cardio');
  assert.equal(cardioGap, undefined, 'hitting the steps goal alone should clear cardio with no movement-minutes data at all');
});

test('both steps and movement are short: one cardio gap shown (not two), crediting the winning sub-signal', () => {
  const day = baseDay({
    device: { steps: 3000 }, // 40% of 7500
    movementMinutes: { actual: 5, goal: 21.4, source: 'device' }, // ~23%
    activityScore: 40,
  });
  const insight = buildActivityInsight(day);
  const cardioGaps = insight.topGaps.filter((g) => g.signal === 'cardio');
  assert.equal(cardioGaps.length, 1, 'steps and movement must collapse into exactly one cardio gap entry');
  assert.equal(cardioGaps[0].via, 'steps', 'steps (40%) beats movement minutes (23%), so it should be credited as the winning sub-signal');
});

test('no strength at all counts as a 0 strength gap, not an omitted signal', () => {
  const day = baseDay({
    device: { steps: 1000 },
    movementMinutes: null,
    activityScore: 7,
  });
  const insight = buildActivityInsight(day);
  assert.deepEqual(insight.topGaps.map((g) => g.signal).sort(), ['cardio', 'strength']);
  const strengthRec = insight.recommendations.find((r) => /strength/.test(r.action));
  assert.equal(strengthRec.estimatedPointGain, 50, 'reaching the strength target adds (100-0)/2 points');
});
