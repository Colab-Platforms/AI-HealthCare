/**
 * Two Recovery fixes, pure-function parts only (no DB needed):
 *
 * 1. Personal baseline gate — under 7 days of history, a 1-2 point mean/SD
 *    is too unstable to score against (a real case swung one user's score
 *    37 -> 64 -> 68 across 3 days). Below the gate, the published
 *    population reference is used instead.
 * 2. Stale-HRV guard — a repeated raw HRV value from the previous day is
 *    not treated as a fresh reading (see isRepeatedValue, exercised
 *    end-to-end with real data in the chat history that led to this fix).
 *
 * Native-score passthrough (WHOOP/Oura/etc.) needs a live DB lookup
 * (WearableScoreSample), so it isn't unit-tested here — verified manually
 * against real WHOOP data instead (see getNativeRecoveryScore).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  zScoreWithFallback,
  isRepeatedValue,
  MIN_PERSONAL_BASELINE_DAYS,
} = require('../services/recoveryScoreService');

const POP = { mean: 42, sd: 15 };

test('baseline gate is 7 days', () => {
  assert.equal(MIN_PERSONAL_BASELINE_DAYS, 7);
});

test('under 7 personal days: population reference used even with a valid SD', () => {
  // The real 2-point case from 3-5 Oct: mean 37.5, sd 26.2
  const r = zScoreWithFallback(56, 37.5, 26.2, POP, 2);
  assert.equal(r.source, 'population');
  assert.ok(Math.abs(r.z - (56 - 42) / 15) < 1e-9);
});

test('exactly 6 days still falls back to population', () => {
  assert.equal(zScoreWithFallback(50, 45, 5, POP, 6).source, 'population');
});

test('7 days or more: personal baseline is used', () => {
  const r = zScoreWithFallback(50, 45, 5, POP, 7);
  assert.equal(r.source, 'personal');
  assert.equal(r.z, 1);
});

test('no personal SD and no days: population, never a divide-by-null', () => {
  assert.equal(zScoreWithFallback(50, 45, null, POP, 10).source, 'population');
  assert.equal(zScoreWithFallback(50, null, null, POP, 0).source, 'population');
});

test('null value gives no z-score from either source', () => {
  assert.deepEqual(zScoreWithFallback(null, 45, 5, POP, 14), { z: null, source: null });
});

test('stale guard: identical raw floats (the real Amish case) are a repeat', () => {
  assert.equal(isRepeatedValue(55.980047503534536, 55.980047503534536), true);
});

test('stale guard: different floats that round to the same integer are NOT a repeat', () => {
  assert.equal(isRepeatedValue(55.98, 56.02), false);
});

test('stale guard: missing values never count as a repeat', () => {
  assert.equal(isRepeatedValue(undefined, 70), false);
  assert.equal(isRepeatedValue(70, null), false);
  assert.equal(isRepeatedValue(null, null), false);
});
