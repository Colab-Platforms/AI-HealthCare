/**
 * Activity = average of Cardio (better of steps / movement minutes) and
 * Strength (last 7 days' average daily strength minutes vs a daily goal).
 * Strength used to be a session count and was skipped entirely at 0, so a
 * user who never trained strength scored higher than one who trained a little.
 *
 * Run: node --test tests/activityScoreFormula.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { scoreActivity, strengthGoalPerDay } = require('../services/activityScoreFormula');
const { getExerciseGuidance } = require('../services/exerciseGuidanceService');

const base = { stepGoal: 7500, strengthGoalMinutesPerWeek: 60 };
const move = (actual, source = 'manual') => ({ actual, goal: 150 / 7, source });

test('Ross case: 431 steps + 27 min logged cardio + 58 strength minutes', () => {
  const r = scoreActivity({ ...base, steps: 431, movementMinutes: move(27), strengthMinutes7d: 58 });
  assert.equal(r.cardio.usedFrom, 'movement');
  assert.equal(r.cardio.score, 100);
  assert.ok(r.cardio.stepsScore < 10);
  assert.deepEqual(r.strength, { score: 96.7, actualMinutesPerDay: 8.3, goalMinutesPerDay: 8.6, last7DaysMinutes: 58 });
  assert.ok(Math.abs(r.score - 98.35) < 0.01);
});

test('walker only: steps carry cardio, missing strength counts as 0', () => {
  const r = scoreActivity({ ...base, steps: 7500 });
  assert.equal(r.cardio.usedFrom, 'steps');
  assert.equal(r.cardio.movementScore, null);
  assert.equal(r.strength.score, 0);
  assert.equal(r.score, 50);
});

test('swimmer: near-zero steps, movement minutes carry cardio', () => {
  const r = scoreActivity({ ...base, steps: 300, movementMinutes: move(45, 'device'), strengthMinutes7d: 60 });
  assert.equal(r.cardio.usedFrom, 'movement');
  assert.equal(r.score, 100);
});

test('some strength never scores lower than no strength', () => {
  const none = scoreActivity({ ...base, steps: 7500 }).score;
  const some = scoreActivity({ ...base, steps: 7500, strengthMinutes7d: 30 }).score;
  assert.ok(some > none);
});

test('a 4-minute strength log is not a full session', () => {
  const r = scoreActivity({ ...base, steps: 7500, strengthMinutes7d: 4 });
  assert.ok(r.strength.score < 10);
});

test('strength minutes are capped at 100', () => {
  assert.equal(scoreActivity({ ...base, steps: 7500, strengthMinutes7d: 500 }).strength.score, 100);
});

test('no data at all: no activity score (not a strength 0)', () => {
  const r = scoreActivity(base);
  assert.equal(r.score, null);
  assert.equal(r.cardio, null);
  assert.equal(r.strength, null);
});

test('strength only (no cardio data): cardio counts as 0, capped at 50', () => {
  const r = scoreActivity({ ...base, strengthMinutes7d: 60 });
  assert.deepEqual(r.cardio, { score: 0, usedFrom: null, stepsScore: null, movementScore: null });
  assert.equal(r.strength.score, 100);
  assert.equal(r.score, 50);
});

test('mobility-limited strength-only day is scored on strength alone', () => {
  const r = scoreActivity({ ...base, strengthMinutes7d: 60, mobilityLimited: true });
  assert.equal(r.cardio, null);
  assert.equal(r.score, 100);
});

test('100 only when both cardio and strength hit target', () => {
  assert.equal(scoreActivity({ ...base, steps: 7500, strengthMinutes7d: 60 }).score, 100);
  assert.ok(scoreActivity({ ...base, steps: 7500, strengthMinutes7d: 54 }).score < 100);
  assert.ok(scoreActivity({ ...base, steps: 6000, strengthMinutes7d: 60 }).score < 100);
});

test('mobility-limited users are not scored on steps', () => {
  const r = scoreActivity({ ...base, steps: 7500, mobilityLimited: true });
  assert.equal(r.cardio, null);
});

test('a rest day inside a consistent week does not drop strength to 0', () => {
  // 60 min this week, nothing today: still on target.
  const r = scoreActivity({ ...base, steps: 7500, strengthMinutes7d: 60 });
  assert.equal(r.strength.score, 100);
});

test('strength targets are minutes only, shown per day', () => {
  assert.equal(getExerciseGuidance(25, null).strengthMinutesPerWeek, 60);
  assert.equal(getExerciseGuidance(70, null).strengthMinutesPerWeek, 90);
  assert.equal(getExerciseGuidance(15, null).strengthMinutesPerWeek, 90);
  assert.equal(getExerciseGuidance(25, 'muscle_gain').strengthMinutesPerWeek, 120);
  assert.equal(getExerciseGuidance(25, null).strengthSessionsPerWeek, undefined);
  assert.equal(strengthGoalPerDay(60), 8.6);
  assert.equal(strengthGoalPerDay(120), 17.1);
});

test('guidance exposes the per-day strength goal the app displays', () => {
  assert.equal(getExerciseGuidance(25, null).strengthMinutesPerDay, 8.6);
  assert.equal(getExerciseGuidance(25, 'muscle_gain').strengthMinutesPerDay, 17.1);
});
