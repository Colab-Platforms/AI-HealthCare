/**
 * Staging test personas (scripts/lib/coachSeedPersonas.js): the generated data
 * must keep the shapes the coach tests rely on (no DB involved).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { PERSONAS, generate, dayStr, dayUTC } = require('../scripts/lib/coachSeedPersonas');

test('personas sit in different age bands of the app\'s exercise guidance', () => {
    const { getExerciseGuidance } = require('../services/exerciseGuidanceService');
    assert.equal(getExerciseGuidance(PERSONAS.a.profile.age, null).ageBucket, 'adult');
    assert.equal(getExerciseGuidance(PERSONAS.b.profile.age, null).ageBucket, 'older_adult');
    for (const p of Object.values(PERSONAS)) {
        assert.equal(p.profile.lifestyle.stepGoal, undefined, 'step goal must come from age');
        assert.equal(p.profile.lifestyle.sleepGoalHours, undefined, 'sleep goal must come from age');
    }
});

test('persona a: the "tired + gym" day (short last night, very low recovery, hard leg day yesterday) and 6 months of history', () => {
    const d = generate.a('u');
    const today = dayStr(dayUTC(0));
    assert.equal(d.sleep.at(-1).totalSleepMinutes, 312);
    assert.equal(d.recovery.find((r) => r.date === today).recoveryScore, 38);
    const yesterday = d.workouts.filter((w) => dayStr(w.timestamp) === dayStr(dayUTC(1)));
    assert.deepEqual(yesterday.map((w) => [w.activityType, w.intensity]), [['gym_strength', 'high']]);
    assert.ok(d.sleep.length > 140 && d.activity.length > 150);
    assert.ok(d.metrics.every((m) => m.type === 'weight'));
    assert.equal(d.reports.length, 1);
    assert.equal(d.vault.length, 1);
});

test('persona b: stale weight (50 d) and sugar (9 d), two reports with improving HbA1c, no strength workouts', () => {
    const d = generate.b('u');
    const latest = (type) => d.metrics.filter((m) => m.type === type).sort((x, y) => y.recordedAt - x.recordedAt)[0];
    const age = (m) => Math.round((Date.now() - m.recordedAt) / 86400000); // days ago
    assert.ok(age(latest('weight')) >= 49);
    assert.ok(age(latest('blood_sugar')) >= 8 && age(latest('blood_sugar')) <= 10);
    assert.deepEqual(d.reports.map((r) => r.metrics.HbA1c.value), [8.4, 7.6]);
    assert.ok(d.workouts.every((w) => w.category !== 'strength'));
});

test('generators are deterministic and only use activity ids from the app catalog', () => {
    assert.deepEqual(generate.a('u').recovery, generate.a('u').recovery);
    const { isValidActivityId } = require('../config/activityCatalog');
    for (const k of ['a', 'b']) for (const w of generate[k]('u').workouts) assert.ok(isValidActivityId(w.activityType), w.activityType);
});
