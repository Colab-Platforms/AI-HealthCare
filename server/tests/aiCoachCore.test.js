/**
 * AI Coach V2 building blocks: safety rules, gap engine, classifier (fake
 * client), specialists (fake services) and the parallel runner. No DB, no API.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { checkMessage, safetyReply, EMERGENCY, MENTAL_HEALTH } = require('../modules/ai-coach/safety/safetyRules');
const { pickGapQuestion } = require('../modules/ai-coach/orchestrator/gapEngine');
const { classify, fastPath, keywordFallback } = require('../modules/ai-coach/orchestrator/intentClassifier');
const { recoverySpecialist } = require('../modules/ai-coach/specialists/recovery');
const { sleepSpecialist } = require('../modules/ai-coach/specialists/sleep');
const { fitnessSpecialist } = require('../modules/ai-coach/specialists/fitness');
const { nutritionSpecialist } = require('../modules/ai-coach/specialists/nutrition');
const { medicalLabSpecialist } = require('../modules/ai-coach/specialists/medicalLab');
const { runSpecialists } = require('../modules/ai-coach/specialists');

const NOW = new Date('2026-11-24T08:00:00Z');
const silent = { warn: () => {}, error: () => {} };

// ── safety ─────────────────────────────────────────────────────────────────

test('safety: emergencies in English and Hinglish are flagged', () => {
    for (const msg of [
        'I have chest pain since morning',
        'seene mein dard ho raha hai',
        "I can't breathe properly",
        'saans lene mein dikkat ho rahi hai',
        'I fainted at the gym',
        'my face is drooping and speech is slurred speech',
        'my sugar is 45 and I am shaking',
        'glucose reading 480 mg/dl',
    ]) {
        const r = checkMessage(msg);
        assert.equal(r.flagged, true, msg);
        assert.equal(r.kind, EMERGENCY, msg);
    }
});

test('safety: self-harm is a mental-health crisis, never negation-filtered', () => {
    for (const msg of ["I don't want to live anymore", 'I want to kill myself', 'marna chahta hoon', 'jeena nahi chahti']) {
        const r = checkMessage(msg);
        assert.equal(r.flagged, true, msg);
        assert.equal(r.kind, MENTAL_HEALTH, msg);
    }
});

test('safety: negations and normal messages are not flagged', () => {
    for (const msg of [
        'no chest pain, just tired',
        'seene mein dard nahi hai, bas thakan',
        "I'm feeling tired today, and I've to go to the gym today",
        'my sugar was 110 after lunch',
        'how much protein should I eat?',
    ]) {
        assert.equal(checkMessage(msg).flagged, false, msg);
    }
});

test('safety: replies give India numbers, in the user\'s language', () => {
    assert.match(safetyReply(EMERGENCY), /112/);
    assert.match(safetyReply(MENTAL_HEALTH), /14416/);
    assert.match(safetyReply(EMERGENCY, { language: 'hinglish' }), /turant/);
});

// ── gap engine ─────────────────────────────────────────────────────────────

const ctx = (over = {}) => ({
    basic: { age: 30 }, body: { heightCm: 170, weightKg: 70 },
    allergies: { state: 'missing' }, medications: { state: 'missing' }, conditions: { state: 'missing' },
    fitness: { limitations: [] }, diet: null, ...over,
});

test('gap: tired + gym asks about injuries, at the end (not blocking)', () => {
    const q = pickGapQuestion({ intent: 'health_coaching', topics: ['recovery', 'fitness'], language: 'english' }, ctx());
    assert.equal(q.field, 'fitness.limitations');
    assert.equal(q.blocking, false);
    assert.match(q.question, /injury/);
});

test('gap: supplements with medicines unknown BLOCK; food recommendation with allergies unknown BLOCKS', () => {
    const s = pickGapQuestion({ intent: 'health_coaching', topics: ['supplements'] }, ctx());
    assert.deepEqual([s.field, s.blocking], ['medications', true]);
    const f = pickGapQuestion({ intent: 'health_coaching', topics: ['nutrition'], recommendsFoodOrSupplement: true }, ctx());
    assert.deepEqual([f.field, f.blocking], ['allergies', true]);
});

test('gap: "none" counts as answered; injuries "none" stored as [\'none\']', () => {
    const q = pickGapQuestion({ intent: 'health_coaching', topics: ['fitness'] },
        ctx({ fitness: { limitations: ['none'] }, conditions: { state: 'none' } }));
    assert.equal(q, null);
});

test('gap: snoozed for 7 days after asking, then asked again', () => {
    const c = { intent: 'health_coaching', topics: ['fitness'] };
    const asked = { 'fitness.limitations': '2026-11-20T00:00:00Z' };
    assert.equal(pickGapQuestion(c, ctx(), asked, NOW).field, 'conditions'); // next field instead
    assert.equal(pickGapQuestion(c, ctx(), { 'fitness.limitations': '2026-11-10T00:00:00Z' }, NOW).field, 'fitness.limitations');
});

test('gap: never during red flag, distress, greeting or thanks; Hinglish question for Hinglish users', () => {
    const base = { topics: ['fitness'] };
    for (const c of [{ ...base, intent: 'health_coaching', redFlag: true }, { ...base, intent: 'health_coaching', distress: true }, { ...base, intent: 'greeting' }, { ...base, intent: 'thanks' }]) {
        assert.equal(pickGapQuestion(c, ctx()), null);
    }
    assert.match(pickGapQuestion({ intent: 'health_coaching', topics: ['fitness'], language: 'hinglish' }, ctx()).question, /dard/);
});

// ── classifier ─────────────────────────────────────────────────────────────

function fakeClient(reply, { delayMs = 0, error = null, stopReason = 'end_turn' } = {}) {
    const calls = [];
    return {
        calls,
        messages: {
            create: async (params, opts) => {
                calls.push({ params, opts });
                if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
                if (error) throw error;
                return { stop_reason: stopReason, usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(reply) }] };
            },
        },
    };
}

const MODEL_REPLY = {
    intent: 'health_coaching', topics: ['recovery', 'fitness', 'bogus'], specialists: ['recovery', 'sleep', 'fitness', 'oracle'],
    timeframe: 'today', symptoms: ['fatigue'], redFlag: false, distress: false, language: 'english',
    recommendsFoodOrSupplement: false,
    facts: [{ target: 'allergies', value: 'Peanut', none: false, statedAs: 'volunteered', aboutSelf: true }, { target: 'pets', value: 'dog' }],
};

test('classifier: greetings and thanks skip the model', async () => {
    const client = fakeClient(MODEL_REPLY);
    assert.equal((await classify({ message: 'hi', client })).intent, 'greeting');
    assert.equal((await classify({ message: 'Thank you so much 🙏', client })).intent, 'thanks');
    assert.equal(client.calls.length, 0);
    assert.equal(fastPath('hi, I slept badly'), null);
});

test('classifier: model output is sanitised (unknown values dropped) and request is shaped for Haiku 5.5', async () => {
    const client = fakeClient(MODEL_REPLY);
    const usage = [];
    const r = await classify({ message: "I'm feeling tired today, and I've to go to the gym today", client, onUsage: (u, m) => usage.push(m) });
    assert.deepEqual(r.specialists, ['recovery', 'sleep', 'fitness']);
    assert.deepEqual(r.topics, ['recovery', 'fitness']);
    assert.equal(r.facts.length, 1);
    assert.equal(r.source, 'model');

    const { params, opts } = client.calls[0];
    assert.equal(params.model, 'claude-haiku-5-5');
    assert.equal(params.temperature, undefined);       // rejected by 5.5 models
    assert.equal(params.tool_choice, undefined);       // forced tool use rejected too
    assert.equal(params.output_config.format.type, 'json_schema');
    assert.equal(params.output_config.effort, 'low');
    assert.equal(opts.maxRetries, 0);
    assert.deepEqual(usage, ['claude-haiku-5-5']);
});

test('classifier: pending question is passed so answers are marked "answer"; greeting fast path is off then', async () => {
    const client = fakeClient(MODEL_REPLY);
    await classify({ message: 'no', client, pendingQuestion: { field: 'allergies', question: 'Any allergies?' } });
    assert.match(client.calls[0].params.messages[0].content, /pending question.*allergies/s);
});

test('classifier: error, timeout and refusal fall back to keyword routing, never throw', async () => {
    const msg = 'aaj bahut thakan hai aur gym jana hai';
    const err = await classify({ message: msg, client: fakeClient(null, { error: new Error('overloaded') }) });
    assert.equal(err.source, 'fallback');
    assert.deepEqual(err.specialists.sort(), ['fitness', 'recovery']);
    assert.equal(err.language, 'hinglish');

    const refused = await classify({ message: msg, client: fakeClient(MODEL_REPLY, { stopReason: 'refusal' }) });
    assert.equal(refused.source, 'fallback');

    const bad = await classify({ message: msg, client: { messages: { create: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] }) } } });
    assert.equal(bad.source, 'fallback');
});

test('keyword fallback: supplements topic, general when nothing matches', () => {
    assert.ok(keywordFallback('should I take vitamin D?').topics.includes('supplements'));
    assert.deepEqual(keywordFallback('what is the capital of France').topics, ['general']);
});

// ── specialists ────────────────────────────────────────────────────────────

test('recovery: score vs usual range, 7-day average, warnings and patterns', async () => {
    const r = await recoverySpecialist({
        userId: 'u', now: NOW, deps: {
            getRecoveryAnalytics: async () => ({
                entries: [
                    { date: '2026-11-20', recoveryScore: 60 }, { date: '2026-11-22', recoveryScore: 64 },
                    { date: '2026-11-24', recoveryScore: 38, band: { key: 'low', label: 'Low' }, warnings: [{ code: 'x', message: 'HRV below typical range.' }] },
                ],
                personalBaselineRange: { low: 55, high: 70 },
                patterns: [{ text: 'Short nights are followed by low mornings.', basis: 'own history' }],
            }),
        },
    });
    assert.equal(r.status, 'completed');
    assert.match(r.findings[0], /today: 38\/100 \(Low\)/);
    assert.ok(r.findings.some((f) => /below the user's usual range \(55-70\)/.test(f)));
    assert.ok(r.findings.some((f) => /previous 7 days: 62/.test(f)));
    assert.ok(r.findings.some((f) => /Warning: HRV/.test(f)));
    assert.ok(r.findings.some((f) => /Pattern: Short nights/.test(f)));
});

test('recovery: no data is reported as missing, a stale score lowers confidence', async () => {
    const none = await recoverySpecialist({ userId: 'u', now: NOW, deps: { getRecoveryAnalytics: async () => ({ entries: [] }) } });
    assert.equal(none.status, 'no_data');
    assert.deepEqual(none.missing_data, ['recovery_score']);
    const stale = await recoverySpecialist({ userId: 'u', now: NOW, deps: { getRecoveryAnalytics: async () => ({ entries: [{ date: '2026-11-18', recoveryScore: 70 }] }) } });
    assert.equal(stale.confidence, 'low');
    assert.ok(stale.missing_data.includes('recovery_score_today'));
});

test('sleep: last night vs previous 7 nights in hours and minutes', async () => {
    const r = await sleepSpecialist({
        userId: 'u', now: NOW, deps: {
            getSleepAnalytics: async () => ({
                entries: [
                    { date: '2026-11-21', totalHours: 7 }, { date: '2026-11-22', totalHours: 7.2 }, { date: '2026-11-23', totalHours: 6.8 },
                    { date: '2026-11-24', totalHours: 5.2, sleepScore: 61, scoreType: 'device', source: 'wearable', stages: { deepPct: 12, remPct: 18, lightPct: 70 }, efficiency: 88 },
                ],
            }),
        },
    });
    assert.match(r.findings[0], /5h 12m, sleep score 61\/100 \(from device\)/);
    assert.ok(r.findings.some((f) => /Previous 7 nights average 7h 00m \(last night 108 min less\)/.test(f)));
    assert.equal(r.confidence, 'high');
});

test('fitness: today\'s activity, weekly average and recent workouts', async () => {
    const r = await fitnessSpecialist({
        userId: 'u', now: NOW, deps: {
            getActivityAnalytics: async () => ({
                hasWearableConnected: true,
                days: [
                    { date: '2026-11-22', device: { steps: 9000 }, manual: {} },
                    { date: '2026-11-23', device: { steps: 11000 }, manual: {} },
                    { date: '2026-11-24', device: { steps: 1200, activeMinutes: 5 }, manual: { sessionsCount: 0, strengthMinutesLast7Days: 90 }, goals: { steps: 8000 } },
                ],
            }),
            recentWorkouts: async () => [{ activityType: 'leg_day', category: 'strength', duration: 60, intensity: 'high', timestamp: '2026-11-23T18:00:00Z' }],
        },
    });
    assert.match(r.findings[0], /1200 steps \(goal 8000\), 5 active minutes/);
    assert.ok(r.findings.some((f) => /previous 7 days: 10000/.test(f)));
    assert.ok(r.findings.some((f) => /leg_day \(strength\) 60 min, high intensity yesterday/.test(f)));
});

test('nutrition: today vs goal and 7-day logging', async () => {
    const r = await nutritionSpecialist({
        userId: 'u', now: NOW, deps: {
            getNutritionTrends: async () => ({
                daysLogged: 5, calories: { dailyAverage: 1900, goalAverage: 2000, series: [{ date: '2026-11-24', value: 650 }] },
                quality: { average: 60 }, score: { average: 72 },
            }),
        },
    });
    assert.match(r.findings[0], /650 kcal of a ~2000 kcal goal/);
    assert.ok(r.findings.some((f) => /5 of 7 days, average 1900 kcal\/day/.test(f)));
    const none = await nutritionSpecialist({ userId: 'u', now: NOW, deps: { getNutritionTrends: async () => ({ daysLogged: 0 }) } });
    assert.equal(none.status, 'no_data');
});

test('medical lab: out-of-range values first, with previous value; old report = low confidence', async () => {
    const r = await medicalLabSpecialist({
        userId: 'u', now: NOW, deps: {
            latestReports: async () => [
                { reportType: 'Blood test', reportDate: '2026-01-10', aiAnalysis: { summary: 'Vitamin D low.', metrics: { Hemoglobin: { value: 14, unit: 'g/dL', status: 'normal' }, 'Vitamin D': { value: 15, unit: 'ng/mL', normalRange: '30-100', status: 'low' } } } },
                { reportType: 'Blood test', reportDate: '2025-06-01', aiAnalysis: { metrics: { 'Vitamin D': { value: 22, unit: 'ng/mL' } } } },
            ],
        },
    });
    const vitD = r.findings.findIndex((f) => f.startsWith('Vitamin D'));
    const hb = r.findings.findIndex((f) => f.startsWith('Hemoglobin'));
    assert.ok(vitD < hb);
    assert.match(r.findings[vitD], /15 ng\/mL \(normal 30-100\) \[low\], previous 22 ng\/mL/);
    assert.equal(r.confidence, 'low');
});

// ── runner ─────────────────────────────────────────────────────────────────

test('runner: parallel, a slow one times out and a failing one errors; others still return', async () => {
    const started = Date.now();
    const out = await runSpecialists(['recovery', 'sleep', 'nutrition', 'unknown'], {
        userId: 'u', now: NOW, timeoutMs: 100, logger: silent, deps: {
            recovery: { getRecoveryAnalytics: async () => { await new Promise((r) => setTimeout(r, 500)); return { entries: [] }; } },
            sleep: { getSleepAnalytics: async () => { throw new Error('db down'); } },
            nutrition: { getNutritionTrends: async () => ({ daysLogged: 2, calories: { series: [] } }) },
        },
    });
    assert.ok(Date.now() - started < 400); // did not wait for the slow one
    const by = Object.fromEntries(out.map((o) => [o.specialist, o.status]));
    assert.deepEqual(by, { recovery: 'timeout', sleep: 'error', nutrition: 'completed' });
});
