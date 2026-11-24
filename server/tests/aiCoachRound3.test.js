/**
 * Fixes from the 24 Nov staging run after the speed step:
 *   - the most related symptom is asked first (dinner -> stomach, not fatigue)
 *   - progress weeks are complete days (today's half day not counted)
 *   - "haan" to a meal: fixed reply, no answer-model call
 *   - prepare: reads start together with the coach-memory load
 *   - prompt: no follow-up questions of its own, consistent tu / aap
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { pickCheckIn, relevance } = require('../modules/ai-coach/orchestrator/checkIns');
const { progressSpecialist } = require('../modules/ai-coach/specialists/progress');
const { runCoach, foodLoggedText } = require('../modules/ai-coach/orchestrator/mainCoachGraph');
const { createMemoryCoachStateRepo } = require('../modules/ai-coach/orchestrator/coachStateRepo');
const { buildRequest } = require('../modules/ai-coach/response/responseGenerator');

const NOW = new Date('2026-11-24T10:00:00Z');
const DAY = 86400000;
const ago = (days) => new Date(NOW.getTime() - days * DAY);
const dateKey = (days) => ago(days).toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── symptom ranking ─────────────────────────────────────────────────────────

test('dinner question with fatigue AND stomach burning open: stomach burning is asked (whatever the list order)', () => {
    const fatigue = { _id: 'f', name: 'fatigue', key: 'fatigue', startedAt: ago(3), lastMentionedAt: ago(3) };
    const stomach = { _id: 's', name: 'stomach burning', key: 'stomach burning', startedAt: ago(3), lastMentionedAt: ago(3) };
    const cls = { intent: 'health_coaching', topics: ['nutrition'] };
    for (const symptoms of [[fatigue, stomach], [stomach, fatigue]]) {
        const r = pickCheckIn({ classification: cls, symptoms, now: NOW });
        assert.equal(r.key, 'symptom:stomach burning');
        assert.equal(r.blocking, true);
    }
    assert.equal(relevance(stomach, ['nutrition']), 0);
    assert.equal(relevance(fatigue, ['nutrition']), 3);
    assert.equal(relevance(fatigue, ['stress']), Infinity);
});

test('gym question: fatigue (main topic fitness) beats stomach (not related); equal relevance -> most recently mentioned', () => {
    const fatigue = { _id: 'f', name: 'fatigue', key: 'fatigue', startedAt: ago(5), lastMentionedAt: ago(5) };
    const stomach = { _id: 's', name: 'stomach burning', key: 'stomach burning', startedAt: ago(3), lastMentionedAt: ago(3) };
    assert.equal(pickCheckIn({ classification: { intent: 'health_coaching', topics: ['fitness'] }, symptoms: [stomach, fatigue], now: NOW }).key, 'symptom:fatigue');

    const knee = { _id: 'k', name: 'knee pain', key: 'knee pain', startedAt: ago(9), lastMentionedAt: ago(9) };
    const back = { _id: 'b', name: 'back pain', key: 'back pain', startedAt: ago(9), lastMentionedAt: ago(2) };
    assert.equal(pickCheckIn({ classification: { intent: 'health_coaching', topics: ['fitness'] }, symptoms: [knee, back], now: NOW }).key, 'symptom:back pain');
});

// ── progress weeks ──────────────────────────────────────────────────────────

function progressDeps({ todaySteps = 1200 } = {}) {
    const days = [{ date: dateKey(0), device: { steps: todaySteps } }];
    for (let i = 1; i <= 7; i++) days.push({ date: dateKey(i), device: { steps: 10000 } });
    for (let i = 8; i <= 14; i++) days.push({ date: dateKey(i), device: { steps: 8000 } });
    return {
        getActivityAnalytics: async () => ({ days }),
        getSleepAnalytics: async () => ({ entries: [{ date: dateKey(0), totalHours: 5 }, { date: dateKey(1), totalHours: 9 }] }),
        loadNutritionDays: async () => [{ date: new Date(`${dateKey(0)}T00:00:00Z`), calories: 450 }, { date: new Date(`${dateKey(2)}T00:00:00Z`), calories: 2300 }],
        loadWorkouts: async () => [{ category: 'strength', duration: 40, timestamp: new Date(NOW.getTime() - 3600000) }, { category: 'cardio', duration: 30, timestamp: ago(3) }],
        getTargets: async () => ({ targets: { steps: 9000, sleepHours: 8, calories: 2400, cardioMinPerWeek: 60, strengthMinPerWeek: 120 } }),
    };
}

test('progress: this week = the last 7 complete days; today shown separately, not dragging the average down', async () => {
    const r = await progressSpecialist({ userId: 'u', now: NOW, deps: progressDeps() });
    const text = r.findings.join('\n');
    assert.match(text, /this week avg 10000, goal met 7\/7 days; last week avg 8000, goal met 0\/7 days/);
    assert.match(text, /Steps up 25% vs last week \(better\)/);
    assert.match(text, /Today so far \(day not over, not in the weekly numbers\): 1200 steps, 450 kcal logged, workouts 0 min cardio \+ 40 min strength/);
    assert.match(text, /this week avg 2300 on 1 logged days/); // today's 450 kcal not in the week
    assert.match(text, /this week 30 cardio \+ 0 strength/); // today's workout not in the week
    assert.match(text, /last 7 complete days/);
});

test('progress: sleep dated today (last night, already complete) IS in this week', async () => {
    const r = await progressSpecialist({ userId: 'u', now: NOW, deps: progressDeps() });
    assert.match(r.findings.join('\n'), /Sleep \(goal 8 h\): this week avg 7 h, goal met 1\/2 nights/);
});

// ── "haan" to a meal: fixed reply ───────────────────────────────────────────

test('food logged reply: Hinglish / English, what is left, failure text, no "undefined"', () => {
    const food = { mealType: 'lunch', nutrition: { calories: 450, protein: 20 } };
    const targets = { remaining: { calories: 1500, protein: 102, waterMl: 2500 } };
    assert.equal(foodLoggedText(food, targets, true), 'Ho gaya, lunch log mein save kar diya: 450 kcal, 20 g protein. Aaj ke liye ab 1500 kcal, 102 g protein, 2500 ml paani bacha hai.');
    assert.equal(foodLoggedText(food, targets, false), 'Done, saved to your lunch log: 450 kcal, 20 g protein. Left for today: 1500 kcal, 102 g protein, 2500 ml water.');
    assert.equal(foodLoggedText(food, null, false), 'Done, saved to your lunch log: 450 kcal, 20 g protein.');
    assert.match(foodLoggedText({ failed: true }, targets, true), /save nahi ho paaya/);
    assert.ok(!/undefined/.test(foodLoggedText({ mealType: 'other', nutrition: { calories: 300 } }, { remaining: {} }, false)));
});

// ── prepare: parallel reads ─────────────────────────────────────────────────

function slowDeps({ delay = 300, calls }) {
    const repo = createMemoryCoachStateRepo();
    return {
        client: {
            messages: { create: async () => ({ stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: JSON.stringify({ intent: 'health_coaching', topics: ['sleep'], specialists: ['sleep'], timeframe: 'today', lookbackDays: 0, symptoms: [], symptomUpdates: [], redFlag: false, distress: false, language: 'english', recommendsFoodOrSupplement: false, facts: [], mealLog: { isLogging: false, mealType: 'unknown', description: '', statedCalories: -1, statedProtein: -1, statedCarbs: -1, statedFats: -1 } }) }] }) },
            beta: { messages: { stream: () => ({ async *[Symbol.asyncIterator]() { yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'ok' } }; }, finalMessage: async () => ({ usage: {}, stop_reason: 'end_turn' }) }) } },
        },
        coachStateRepo: { load: async (u) => { await sleep(delay); return repo.load(u); }, save: repo.save },
        getProfileContext: async () => { calls.push('profile'); await sleep(delay); return { summary: '', completeness: {}, allergies: { state: 'none' }, medications: { state: 'none' }, conditions: { state: 'none', items: [] } }; },
        getTargets: async () => { calls.push('targets'); await sleep(delay); return null; },
        profileTools: { saveFacts: async () => [], undoSaved: async () => 0 },
        logger: { warn: () => {}, error: () => {} },
        specialistDeps: {
            sleep: { getSleepAnalytics: async () => { calls.push('sleep'); await sleep(delay); return { entries: [] }; } },
            recovery: { getRecoveryAnalytics: async () => { await sleep(delay); return { entries: [] }; } },
        },
    };
}

test('prepare: memory, profile, targets and prefetch load together (one wait, not two)', async () => {
    const calls = [];
    const final = await runCoach({ input: { userId: String(new mongoose.Types.ObjectId()), userName: 'R', message: 'how did I sleep last night?', history: [], now: NOW, startedAt: Date.now() }, deps: slowDeps({ calls }), onEvent: () => {} });
    assert.equal(final.timings.path, 'fast');
    assert.ok(final.timings.prepareMs < 550, `prepare took ${final.timings.prepareMs} ms (sequential would be ~600+)`);
    assert.deepEqual(calls.sort(), ['profile', 'sleep', 'targets']); // each once
});

test('prepare: a bare "haan" with nothing pending still gets targets (started after memory), each read once', async () => {
    const calls = [];
    const final = await runCoach({ input: { userId: String(new mongoose.Types.ObjectId()), userName: 'R', message: 'haan', history: [], now: NOW, startedAt: Date.now() }, deps: slowDeps({ delay: 20, calls }), onEvent: () => {} });
    assert.equal(final.route, 'coach');
    assert.equal(calls.filter((c) => c === 'targets').length, 1);
    assert.equal(calls.filter((c) => c === 'profile').length, 1);
});

// ── prompt ──────────────────────────────────────────────────────────────────

test('prompt: no follow-up questions of its own, never "X ya Y?", tu / aap by how the user talks', () => {
    const { system } = buildRequest({ message: 'hi', profileContext: null });
    const rules = system.map((b) => b.text).join('\n');
    assert.match(rules, /Otherwise do NOT end with a question/);
    assert.match(rules, /never "A or B\?" \/ "X ya Y\?"/);
    assert.match(rules, /use "tu" \/ "tera"/);
});

// ── round 4 (24 Nov): paused request hijack, future dates, broken sleep ─────

const { sleepSpecialist } = require('../modules/ai-coach/specialists/sleep');

function pausedSetup() {
    const calls = [];
    const deps = slowDeps({ delay: 5, calls });
    const memory = createMemoryCoachStateRepo();
    deps.coachStateRepo = memory;
    const send = (message, now = NOW) => runCoach({ input: { userId: USER2, userName: 'R', message, history: [], now, startedAt: Date.now() }, deps, onEvent: () => {} });
    return { send, memory };
}
const USER2 = String(new mongoose.Types.ObjectId());

test('paused request: a NEW request of its own wins (no resume), goes fast, paused one dropped', async () => {
    const t = pausedSetup();
    await t.memory.save(USER2, { pendingRequest: { message: 'aaj dinner mein kya khaun?', topics: ['nutrition'], specialists: ['nutrition'], askedAt: ago(0.01) } });
    const r = await t.send("I'm feeling tired today, and I've to go to the gym today");
    assert.equal(r.classification.resumeRequest, undefined);
    assert.equal(r.timings.droppedPausedRequest, true);
    assert.equal(r.timings.path, 'fast');
    assert.ok(!(await t.memory.load(USER2)).pendingRequest);
});

test('paused request: a short answer ("thoda better hai ab") resumes it', async () => {
    const t = pausedSetup();
    await t.memory.save(USER2, { pendingRequest: { message: 'aaj dinner mein kya khaun?', topics: ['nutrition'], specialists: ['nutrition'], askedAt: ago(0.01) } });
    const r = await t.send('thoda better hai ab');
    assert.equal(r.classification.resumeRequest, 'aaj dinner mein kya khaun?');
});

test('a pending request dated days in the future (time-shifted test run) is ignored; 1 min ahead (clock skew) is kept', async () => {
    const t = pausedSetup();
    await t.memory.save(USER2, { pendingRequest: { message: 'aaj dinner mein kya khaun?', topics: ['nutrition'], specialists: ['nutrition'], askedAt: ago(-3) } });
    assert.equal((await t.send('thoda better hai ab')).classification.resumeRequest, undefined);
    await t.memory.save(USER2, { pendingRequest: { message: 'aaj dinner mein kya khaun?', topics: ['nutrition'], specialists: ['nutrition'], askedAt: new Date(NOW.getTime() + 60000) } });
    assert.equal((await t.send('thoda better hai ab')).classification.resumeRequest, 'aaj dinner mein kya khaun?');
});

test('check-ins: an ask time in the future does not snooze (blocking symptom, follow-up)', () => {
    const stomach = { _id: 's', name: 'stomach burning', key: 'stomach burning', startedAt: ago(3), lastMentionedAt: ago(3), lastAskedAt: ago(-3) };
    const cls = { intent: 'health_coaching', topics: ['nutrition'] };
    assert.equal(pickCheckIn({ classification: cls, symptoms: [stomach], askedLog: { 'symptom:stomach burning': ago(-3) }, now: NOW }).key, 'symptom:stomach burning');
    assert.equal(pickCheckIn({ classification: cls, symptoms: [stomach], askedLog: { 'symptom:stomach burning': ago(0.1) }, now: NOW })?.blocking, undefined); // asked 2.4 h ago: no block
    assert.equal(pickCheckIn({ classification: { intent: 'health_coaching', topics: ['stress'] }, symptoms: [stomach], now: NOW }).key, 'symptom:stomach burning'); // follow-up despite future lastAskedAt
});

test('sleep: a night capped at 14 h (broken device reading) is left out of averages and said so', async () => {
    const entries = [];
    for (let i = 12; i >= 0; i--) entries.push({ date: dateKey(i), totalHours: i === 5 ? 14 : 7 });
    const r = await sleepSpecialist({ userId: 'u', now: NOW, deps: { getSleepAnalytics: async () => ({ entries }) } });
    const text = r.findings.join(' ');
    assert.match(text, /Previous 7 nights average 7h 00m/);
    assert.match(text, /30-night average 7h 00m over 12 logged nights/);
    assert.match(text, /1 night\(s\) had a broken device reading/);
});

test('progress: broken 14 h night not in the weekly sleep average', async () => {
    const deps = progressDeps();
    deps.getSleepAnalytics = async () => ({ entries: [{ date: dateKey(1), totalHours: 7 }, { date: dateKey(2), totalHours: 14 }, { date: dateKey(9), totalHours: 6 }] });
    const r = await progressSpecialist({ userId: 'u', now: NOW, deps });
    const text = r.findings.join(' ');
    assert.match(text, /this week avg 7 h, goal met 0\/1 nights/);
    assert.match(text, /1 night\(s\) with a broken device reading/);
});
