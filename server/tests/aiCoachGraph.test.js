/**
 * Coach V2 LangGraph flow end to end with fakes: fake Claude client, in-memory
 * coach state, real profile tools on the in-memory profile repo, fake
 * specialist services. Multi-turn conversations, no DB, no API.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { runCoach } = require('../modules/ai-coach/orchestrator/mainCoachGraph');
const { createMemoryCoachStateRepo } = require('../modules/ai-coach/orchestrator/coachStateRepo');
const { createProfileTools } = require('../modules/ai-coach/tools/profileTools');
const { createProfileWriteService } = require('../modules/health-profile/services/profileWriteService');
const { buildContext } = require('../modules/health-profile/services/profileContextService');
const { createMemoryProfileRepo } = require('./helpers/memoryProfileRepo');

const USER = String(new mongoose.Types.ObjectId());
const NOW = new Date('2026-11-24T08:00:00Z');

const classification = (over = {}) => ({
    intent: 'health_coaching', topics: [], specialists: [], timeframe: 'unspecified', symptoms: [],
    redFlag: false, distress: false, language: 'english', recommendsFoodOrSupplement: false, facts: [], ...over,
});

function setup({ answer = 'Take it easy today.', answerError = null } = {}) {
    const profileRepo = createMemoryProfileRepo({
        users: { [USER]: { _id: USER, profile: { age: 29, gender: 'male', height: 175, weight: 74, allergies: ['Peanut'] } } },
    });
    const service = createProfileWriteService({ repo: profileRepo, afterCommit: async () => {} });
    const coachStateRepo = createMemoryCoachStateRepo();
    const calls = { classify: 0, answer: 0, answerParams: [] };
    let nextClassification = classification();

    const client = {
        messages: {
            create: async () => {
                calls.classify++;
                return { stop_reason: 'end_turn', usage: { input_tokens: 50, output_tokens: 20 }, content: [{ type: 'text', text: JSON.stringify(nextClassification) }] };
            },
        },
        beta: {
            messages: {
                stream: (params) => {
                    calls.answer++;
                    calls.answerParams.push(params);
                    if (answerError) throw answerError;
                    const words = answer.split(/(\s+)/);
                    return {
                        async *[Symbol.asyncIterator]() { for (const w of words) yield { type: 'content_block_delta', delta: { type: 'text_delta', text: w } }; },
                        finalMessage: async () => ({ stop_reason: 'end_turn', model: 'claude-sonnet-5-5', usage: { input_tokens: 900, output_tokens: 40 } }),
                    };
                },
            },
        },
    };

    const deps = {
        client,
        coachStateRepo,
        logger: { warn: () => {}, error: () => {} },
        getProfileContext: async (userId) => buildContext(profileRepo.state.profiles[userId] || { basic: { age: 29 } }, NOW),
        profileTools: createProfileTools({ service, repo: profileRepo, sideEffects: { afterProfileChange: async () => {} }, logger: { warn: () => {}, error: () => {} } }),
        specialistDeps: {
            nutrition: { getNutritionTrends: async () => ({ daysLogged: 0 }) },
            medical_lab: { latestReports: async () => [] },
            progress: { getTargets: async () => null, getActivityAnalytics: async () => ({ days: [] }), getSleepAnalytics: async () => ({ entries: [] }), loadNutritionDays: async () => [], loadWorkouts: async () => [] },
            recovery: { getRecoveryAnalytics: async () => ({ entries: [{ date: '2026-11-24', recoveryScore: 38, band: { label: 'Very low' } }], personalBaselineRange: { low: 60, high: 72 } }) },
            sleep: { getSleepAnalytics: async () => ({ entries: [{ date: '2026-11-24', totalHours: 5.2, source: 'wearable' }] }) },
            fitness: {
                getActivityAnalytics: async () => ({ days: [{ date: '2026-11-24', device: { steps: 1200 }, manual: {} }] }),
                recentWorkouts: async () => [{ activityType: 'weight_training', category: 'strength', duration: 60, intensity: 'high', timestamp: '2026-11-23T13:00:00Z' }],
            },
        },
    };

    const send = async (message, cls) => {
        if (cls) nextClassification = cls;
        const events = [];
        const final = await runCoach({ input: { userId: USER, userName: 'Coach Test', message, history: [], now: NOW }, deps, onEvent: (e) => events.push(e) });
        const text = events.filter((e) => e.type === 'token').map((e) => e.text).join('');
        return { final, events, text };
    };
    return { send, calls, coachStateRepo, profileRepo, hp: () => profileRepo.state.profiles[USER] };
}

test('tired + gym: classify -> recovery/sleep/fitness data -> streamed answer -> injury question remembered', async () => {
    const t = setup({ answer: 'Recovery is low today, keep the gym light.' });
    const r = await t.send("I'm feeling tired today, and I've to go to the gym today", classification({
        topics: ['recovery', 'fitness'], specialists: ['recovery', 'sleep', 'fitness'], timeframe: 'today', symptoms: ['fatigue'],
    }));

    assert.equal(r.final.route, 'coach');
    assert.equal(r.text, 'Recovery is low today, keep the gym light.');
    assert.deepEqual(r.final.specialistResults.map((s) => [s.specialist, s.status]).sort(), [['fitness', 'completed'], ['recovery', 'completed'], ['sleep', 'completed']]);

    const dataMsg = t.calls.answerParams[0].messages.at(-1);
    assert.equal(dataMsg.role, 'system');
    assert.match(dataMsg.content, /Recovery score today: 38\/100/);
    assert.match(dataMsg.content, /5h 12m/);
    assert.match(dataMsg.content, /weight_training \(strength\) 60 min, high intensity yesterday/);
    assert.match(dataMsg.content, /ask this one question as the last line: "Any injury or pain/);

    const saved = await t.coachStateRepo.load(USER);
    assert.equal(saved.pendingQuestion.field, 'fitness.limitations');
    assert.ok(saved.askedLog['fitness.limitations']);
    assert.deepEqual(r.final.usage.map((u) => u.feature).sort(), ['ai_coach_classify', 'ai_coach_v2']); // each counted once
    assert.equal(r.final.timings.path, 'fast'); // rules knew the topic: answer did not wait for the classifier
});

test('red flag: fixed safety reply, no model calls, no profile question', async () => {
    const t = setup();
    const r = await t.send('I have chest pain and feel dizzy, should I still go to the gym?');
    assert.equal(r.final.route, 'safety');
    assert.match(r.text, /112/);
    assert.equal(t.calls.classify, 0);
    assert.equal(t.calls.answer, 0);
});

test('classifier red flag (phrasing the rules miss) also routes to safety', async () => {
    const t = setup();
    const r = await t.send('my left arm feels heavy and weird since an hour', classification({ redFlag: true }));
    assert.equal(r.final.route, 'safety');
    assert.equal(t.calls.answer, 0);
});

test('greeting: instant reply with first name, no model calls', async () => {
    const t = setup();
    const r = await t.send('hi');
    assert.equal(r.final.route, 'quick');
    assert.equal(r.text, 'Hi Coach! How can I help you today?');
    assert.equal(t.calls.classify + t.calls.answer, 0);
});

test('answer to the coach\'s question is saved now, then "undo" reverts it', async () => {
    const t = setup();
    await t.send('tired, gym?', classification({ topics: ['fitness'], specialists: [] })); // coach asks about injuries
    const r = await t.send('knee pain since last week', classification({
        intent: 'profile_update',
        facts: [{ target: 'fitness.limitations', value: 'knee pain', none: false, statedAs: 'answer', aboutSelf: true }],
    }));
    assert.deepEqual(t.hp().fitness.limitations, ['knee pain']);
    assert.equal(t.hp().fitness.meta.source, 'chat');
    const savedEvent = r.events.find((e) => e.type === 'profile_saved');
    assert.equal(savedEvent.items[0].target, 'fitness.limitations');
    assert.ok(savedEvent.items[0].historyId);
    assert.match(t.calls.answerParams.at(-1).messages.at(-1).content, /Just saved to their profile: injury \/ limitation: knee pain/);

    const u = await t.send('undo');
    assert.equal(u.events.find((e) => e.type === 'profile_undone').count, 1);
    assert.equal(t.hp().fitness.limitations.length, 0);
    assert.match(t.calls.answerParams.at(-1).messages.at(-1).content, /removed 1 item/);
    assert.ok(!(await t.coachStateRepo.load(USER)).lastSaved);
});

test('volunteered fact: asked first ("save this?"), saved on "haan", not before', async () => {
    const t = setup();
    const r = await t.send('btw I take metformin 500mg daily, what should I eat for breakfast?', classification({
        topics: ['nutrition'], recommendsFoodOrSupplement: false,
        facts: [{ target: 'medications', value: 'Metformin 500mg', none: false, statedAs: 'volunteered', aboutSelf: true }],
    }));
    assert.ok(r.events.some((e) => e.type === 'profile_confirm'));
    assert.equal(t.hp()?.medications?.items?.length || 0, 0);
    assert.match(t.calls.answerParams.at(-1).messages.at(-1).content, /ask if you should save this/);
    assert.ok(!/ask this one question/.test(t.calls.answerParams.at(-1).messages.at(-1).content)); // no stacked gap question

    await t.send('haan');
    assert.equal(t.hp().medications.items[0].name, 'Metformin');
    assert.equal(t.hp().medications.items[0].dose, '500mg');
});

test('"no" to the save question saves nothing and clears it', async () => {
    const t = setup();
    await t.send('I smoke sometimes', classification({ facts: [{ target: 'lifestyle.smoking', value: 'current', none: false, statedAs: 'volunteered', aboutSelf: true }] }));
    await t.send('nahi');
    assert.notEqual(t.hp()?.lifestyle?.smoking, 'current'); // nothing saved
    assert.ok(!(await t.coachStateRepo.load(USER)).pendingConfirm);
});

test('blocking gap (supplements, medicines unknown): asks first, specialists skipped', async () => {
    const t = setup();
    const r = await t.send('should I take vitamin D?', classification({ topics: ['supplements'], specialists: ['medical_lab'], recommendsFoodOrSupplement: true }));
    assert.equal(r.final.gapQuestion.field, 'medications');
    assert.equal(r.final.specialistResults, undefined);
    assert.match(t.calls.answerParams.at(-1).messages.at(-1).content, /Do NOT give the recommendation yet/);
});

test('answer model failing before any token rejects (route falls back to the old chat)', async () => {
    const t = setup({ answerError: new Error('overloaded') });
    await assert.rejects(t.send('how did I sleep?', classification({ specialists: ['sleep'] })), /overloaded/);
});
