/**
 * Speed step (24 Nov): when the routing rules know the topic, the answer
 * starts without waiting for the classifier; the classifier's result is
 * applied after the answer (reconcile). Also: symptom replies read by code.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { runCoach } = require('../modules/ai-coach/orchestrator/mainCoachGraph');
const { createMemoryCoachStateRepo } = require('../modules/ai-coach/orchestrator/coachStateRepo');
const { createSymptomTools, createMemorySymptomRepo, parseSymptomReply } = require('../modules/ai-coach/tools/symptomTools');

const USER = String(new mongoose.Types.ObjectId());
const NOW = new Date('2026-11-24T08:00:00Z');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const C = (over = {}) => ({ intent: 'health_coaching', topics: ['fitness'], specialists: ['fitness'], timeframe: 'today', lookbackDays: 0, symptoms: [], symptomUpdates: [], redFlag: false, distress: false, language: 'english', recommendsFoodOrSupplement: false, facts: [], mealLog: { isLogging: false, mealType: 'unknown', description: '', statedCalories: -1, statedProtein: -1, statedCarbs: -1, statedFats: -1 }, ...over });

function setup({ classification = C(), classifierDelayMs = 300, symptomRepo = createMemorySymptomRepo() } = {}) {
    const order = [];
    const deps = {
        client: {
            messages: { create: async () => { await sleep(classifierDelayMs); order.push('classifier done'); return { stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: 'text', text: JSON.stringify(classification) }] }; } },
            beta: { messages: { stream: () => ({ async *[Symbol.asyncIterator]() { order.push('answer token'); yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Go light today.' } }; }, finalMessage: async () => ({ usage: { input_tokens: 100, output_tokens: 5 }, stop_reason: 'end_turn' }) }) } },
        },
        coachStateRepo: createMemoryCoachStateRepo(),
        getProfileContext: async () => ({ summary: '', completeness: {}, allergies: { state: 'none' }, medications: { state: 'none' }, conditions: { state: 'none', items: [] }, fitness: { limitations: ['none'] }, diet: { preference: 'vegetarian' } }),
        getTargets: async () => null,
        symptomTools: createSymptomTools({ repo: symptomRepo, logger: { error: () => {} } }),
        profileTools: { saveFacts: async () => [], undoSaved: async () => 0 },
        logger: { warn: () => {}, error: () => {} },
        specialistDeps: {
            recovery: { getRecoveryAnalytics: async () => ({ entries: [] }) },
            sleep: { getSleepAnalytics: async () => ({ entries: [] }) },
            fitness: { getActivityAnalytics: async () => ({ days: [] }), recentWorkouts: async () => [] },
        },
    };
    const send = async (message) => {
        const events = [];
        const final = await runCoach({ input: { userId: USER, userName: 'Rahul', message, history: [], now: NOW, startedAt: Date.now() }, deps, onEvent: (e) => events.push(e) });
        return { final, events, text: events.filter((e) => e.type === 'token').map((e) => e.text).join('') };
    };
    return { send, order, deps, symptomRepo };
}

test('fast path: the answer streams before the classifier finishes; its usage is counted once', async () => {
    const t = setup({ classifierDelayMs: 800 });
    const r = await t.send("I'm tired, gym today?");
    assert.deepEqual(t.order, ['answer token', 'classifier done']);
    assert.equal(r.final.timings.path, 'fast');
    assert.ok(r.final.timings.firstTokenMs < 700, `first token at ${r.final.timings.firstTokenMs} ms`);
    assert.deepEqual(r.final.usage.map((u) => u.feature).sort(), ['ai_coach_classify', 'ai_coach_v2']);
});

test('slow path when the classifier must decide first: no topic matched, a meal eaten, a stated health fact, a stomach symptom', async () => {
    for (const msg of ['what is python?', 'lunch mein dal chawal khaya', 'I take metformin, what should I eat?', 'pait mein jalan, dinner mein kya khaun?']) {
        const t = setup({ classifierDelayMs: 50, classification: C({ intent: 'off_topic', topics: [], specialists: [] }) });
        const r = await t.send(msg);
        assert.notEqual(r.final.timings.path, 'fast', msg);
        assert.equal(t.order[0], 'classifier done', msg);
    }
});

test('reconcile: a red flag only the classifier caught is appended to the same reply', async () => {
    const t = setup({ classification: C({ redFlag: true }) });
    const r = await t.send('gym today? my left arm feels heavy and weird');
    assert.match(r.text, /^Go light today\.\n\n[\s\S]*112/);
    assert.match(r.final.reply, /112/);
});

test('reconcile: a volunteered fact is asked about at the end (one question), and "haan" then saves it', async () => {
    const saved = [];
    const t = setup({ classification: C({ facts: [{ target: 'lifestyle.stressLevel', value: 'high', none: false, statedAs: 'volunteered', aboutSelf: true }] }) });
    t.deps.profileTools = { saveFacts: async (u, f) => { saved.push(...f); return f.map((x) => ({ ...x, historyId: 'h1' })); }, undoSaved: async () => 0 };
    const r = await t.send('work has been crazy, should I still train today?');
    assert.equal(r.final.timings.path, 'fast');
    assert.match(r.text, /you mentioned stress level: high\. Should I save this to your profile\? \(yes \/ no\)/);
    assert.ok(r.events.some((e) => e.type === 'profile_confirm'));
    await t.send('yes');
    assert.equal(saved[0].target, 'lifestyle.stressLevel');
});

test('reconcile: symptoms from the classifier are recorded after the answer', async () => {
    const t = setup({ classification: C({ symptoms: ['fatigue'] }) });
    await t.send("I'm so tired, gym today?");
    assert.equal(t.symptomRepo.rows[0].name, 'fatigue');
});

test('symptom replies read by code: "ab thik hai" closes, "thoda kam" better, "theek nahi" same; long or ambiguous replies ignored', () => {
    const one = [{ name: 'stomach burning', key: 'stomach burning' }];
    assert.deepEqual(parseSymptomReply('ab thik hai', one), [{ name: 'stomach burning', status: 'resolved' }]);
    assert.deepEqual(parseSymptomReply('haan bilkul theek hoon', one), [{ name: 'stomach burning', status: 'resolved' }]);
    assert.deepEqual(parseSymptomReply('thoda kam hai', one), [{ name: 'stomach burning', status: 'better' }]);
    assert.deepEqual(parseSymptomReply('abhi bhi theek nahi hai', one), [{ name: 'stomach burning', status: 'same' }]);
    assert.deepEqual(parseSymptomReply('ab thik hai', []), []);
    const two = [...one, { name: 'knee pain', key: 'knee pain' }];
    assert.deepEqual(parseSymptomReply('ab thik hai', two), []); // which one? leave it to the classifier
    assert.deepEqual(parseSymptomReply('knee ab thik hai', two), [{ name: 'knee pain', status: 'resolved' }]);
    assert.deepEqual(parseSymptomReply('thik hai par mujhe ek lamba sawaal poochna hai diet ke baare mein aaj', one), []);
});

test('graph: "ab thik hai" closes the open symptom in the same turn (the classifier had missed it on staging)', async () => {
    const symptomRepo = createMemorySymptomRepo();
    await createSymptomTools({ repo: symptomRepo }).record(USER, { symptoms: ['stomach burning'] }, new Date(NOW.getTime() - 3600000));
    const t = setup({ symptomRepo, classifierDelayMs: 10, classification: C({ intent: 'small_talk', topics: [], specialists: [] }) });
    const r = await t.send('ab thik hai');
    assert.deepEqual(r.final.symptomChanges, [{ name: 'stomach burning', status: 'resolved' }]);
    assert.equal((await t.deps.symptomTools.listActive(USER)).length, 0);
});
