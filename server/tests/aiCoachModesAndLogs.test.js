/**
 * 25 Nov (user request):
 * 1. Reply modes: casual talk gets no data at all; a question about one number
 *    gets only that number; advice gets what the decision needs.
 * 2. The coach logs water, sleep, cigarettes and alcohol (shown first, saved
 *    only after "yes", through the app's own log code), never guessing amounts.
 * 3. Asked-for numbers are always fetched, never answered from memory.
 * No DB, no API.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { provisionalReplyMode, scopeData, specialistsForMetrics } = require('../modules/ai-coach/orchestrator/replyMode');
const { createActivityLogTools, istDateKey } = require('../modules/ai-coach/tools/activityLogTools');
const { habitsSpecialist } = require('../modules/ai-coach/specialists/habits');
const { sanitize } = require('../modules/ai-coach/orchestrator/intentClassifier');
const { runCoach } = require('../modules/ai-coach/orchestrator/mainCoachGraph');
const { createMemoryCoachStateRepo } = require('../modules/ai-coach/orchestrator/coachStateRepo');

const NOW = new Date('2026-11-25T05:00:00Z'); // 10:30 IST

// ── modes ──────────────────────────────────────────────────────────────────

test('provisional mode: venting is chat (incl. rhetorical "kya batau"); requests and plans are coaching; "kitne steps" is specific', () => {
    for (const m of ['kya batau bhai kuch sahi nahi lag raha', 'kyaa batau bhaai kuch shi nai lagg raha hai', 'aaj mood off hai', 'thak gaya yaar', 'I feel low today']) {
        assert.equal(provisionalReplyMode(m).replyMode, 'chat', m);
    }
    for (const m of ['I am feeling tired today, and I have to go to the gym today', 'bhai mere liye meal generate karo', 'meal do', 'dinner mein kya khaun?', 'how can I sleep better']) {
        assert.equal(provisionalReplyMode(m).replyMode, 'coaching', m);
    }
    assert.deepEqual(provisionalReplyMode('aaj kitne steps hue?'), { replyMode: 'specific', askedMetrics: ['steps'] });
    assert.deepEqual(provisionalReplyMode('is hafte kitni cigarette pi?'), { replyMode: 'specific', askedMetrics: ['smoking'] });
});

test('scopeData: chat sends nothing; specific sends only the asked specialist (+ targets when they matter); coaching sends all', () => {
    const results = [{ specialist: 'fitness' }, { specialist: 'sleep' }, { specialist: 'recovery' }];
    const targets = { targets: {} };
    const chat = scopeData({ classification: { replyMode: 'chat' }, specialistResults: results, targets });
    assert.deepEqual(chat, { specialistResults: [], targets: null, focusMetrics: [], unavailableMetrics: [], chat: true });
    const steps = scopeData({ classification: { replyMode: 'specific', askedMetrics: ['steps'] }, specialistResults: results, targets });
    assert.deepEqual(steps.specialistResults.map((r) => r.specialist), ['fitness']);
    assert.equal(steps.targets, targets);
    const weight = scopeData({ classification: { replyMode: 'specific', askedMetrics: ['weight'] }, specialistResults: results, targets });
    assert.deepEqual(weight.specialistResults, []); // weight comes from the profile
    assert.equal(weight.targets, null);
    const bp = scopeData({ classification: { replyMode: 'specific', askedMetrics: ['bp'] }, specialistResults: [], targets });
    assert.deepEqual(bp.unavailableMetrics, ['bp']);
    assert.equal(scopeData({ classification: {}, specialistResults: results, targets }).specialistResults.length, 3);
    assert.deepEqual(specialistsForMetrics(['steps', 'smoking', 'weight']), ['fitness', 'habits']);
});

test('classifier sanitize: new fields default safely; bad log amounts become "not said"', () => {
    const c = sanitize({ intent: 'other' });
    assert.equal(c.replyMode, 'coaching');
    assert.deepEqual(c.askedMetrics, []);
    assert.deepEqual(c.activityLogs, []);
    const s = sanitize({ intent: 'other', replyMode: 'chat', askedMetrics: ['steps', 'nonsense'], activityLogs: [
        { kind: 'water', amount: 2, unit: 'glass', drinkType: '', drinkSize: 'unknown', when: 'today' },
        { kind: 'smoke', amount: 999, unit: 'count', drinkType: '', drinkSize: 'unknown', when: 'today' },
        { kind: 'teleport', amount: 1 },
    ] });
    assert.equal(s.replyMode, 'chat');
    assert.deepEqual(s.askedMetrics, ['steps']);
    assert.equal(s.activityLogs.length, 2);
    assert.equal(s.activityLogs[1].amount, -1);
});

// ── activity log tools ─────────────────────────────────────────────────────

function fakeService() {
    const calls = [];
    let waterTotal = 750;
    return {
        calls,
        getGlassSizeMl: async () => 250,
        getWaterTotal: async () => waterTotal,
        setWaterTotal: async (u, total, dateKey) => { calls.push(['water', total, dateKey]); waterTotal = total; return { totalMl: total }; },
        saveSleep: async (u, { sleepData }) => { calls.push(['sleep', sleepData]); },
        addSmokes: async (u, { count, dateKey }) => { calls.push(['smoke', count, dateKey]); return { dayCount: count + 3 }; },
        logAlcoholDrink: async (u, body) => { calls.push(['alcohol', body]); return { day: { count: 1 } }; },
    };
}

test('prepare: exact entries in the user\'s units; standard drink size shown in ml; no amount or unknown drink -> ask, never guess', async () => {
    const tools = createActivityLogTools({ service: fakeService(), logger: { error: () => {} } });
    const out = await tools.prepare('u', [
        { kind: 'water', amount: 2, unit: 'glass', when: 'today' },
        { kind: 'sleep', amount: 6.5, unit: 'hours', when: 'last_night' },
        { kind: 'smoke', amount: 3, unit: 'count', when: 'today' },
        { kind: 'alcohol', amount: 2, unit: 'count', drinkType: 'beer', drinkSize: 'unknown', when: 'today' },
        { kind: 'water', amount: -1, unit: 'none', when: 'today' },
        { kind: 'alcohol', amount: 1, unit: 'count', drinkType: 'mystery', drinkSize: 'unknown', when: 'today' },
    ], { now: NOW });
    assert.deepEqual(out.entries.map((e) => e.label), [
        'Water: 2 glasses (500 ml)',
        'Sleep last night: 6h 30m',
        'Cigarettes: 3',
        '2 × beer (330 ml each)',
    ]);
    assert.equal(out.entries[1].dateKey, '2026-11-25'); // dated by the morning you wake up (IST)
    assert.deepEqual(out.needsAmount, ['water']);
    assert.equal(out.needsDrinkType, true);
});

test('save: water is ADDED to today\'s total (the app stores the day total); each drink is one session; one failure doesn\'t stop the rest', async () => {
    const svc = fakeService();
    svc.saveSleep = async () => { throw new Error('db down'); };
    const tools = createActivityLogTools({ service: svc, logger: { error: () => {} } });
    const { entries } = await tools.prepare('u', [
        { kind: 'water', amount: 2, unit: 'glass', when: 'today' },
        { kind: 'sleep', amount: 7, unit: 'hours', when: 'last_night' },
        { kind: 'alcohol', amount: 2, unit: 'count', drinkType: 'whisky', drinkSize: 'small', when: 'today' },
    ], { now: NOW });
    const results = await tools.save('u', entries, { now: NOW });
    assert.deepEqual(svc.calls[0], ['water', 1250, istDateKey(NOW)]); // 750 already + 500
    assert.equal(svc.calls.filter((c) => c[0] === 'alcohol').length, 2);
    assert.deepEqual(results.map((r) => [r.kind, r.ok]), [['water', true], ['sleep', false], ['alcohol', true]]);
});

test('habits specialist: reads the smoke and alcohol logs (no guessing), no user -> no_data', async () => {
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const r = await habitsSpecialist({ userId: 'u', deps: { loadUser: async () => ({ smokeLog: { [key]: { count: 4 } }, alcoholLog: {}, profile: { lifestyle: {} } }) } });
    assert.equal(r.status, 'completed');
    assert.match(r.findings.join(' '), /Smoke tracker today: 4 cigarettes/);
    assert.equal((await habitsSpecialist({ userId: 'u', deps: { loadUser: async () => null } })).status, 'no_data');
});

// ── graph ──────────────────────────────────────────────────────────────────

const USER = String(new mongoose.Types.ObjectId());
const CLS = (over = {}) => ({ intent: 'health_coaching', replyMode: 'coaching', askedMetrics: [], activityLogs: [], topics: ['general'], specialists: [], timeframe: 'today', lookbackDays: 0, symptoms: [], symptomUpdates: [], redFlag: false, distress: false, language: 'hinglish', recommendsFoodOrSupplement: false, facts: [], mealLog: { isLogging: false, mealType: 'unknown', description: '', statedCalories: -1, statedProtein: -1, statedCarbs: -1, statedFats: -1 }, ...over });

function setup() {
    const calls = { answer: 0, params: [], fetched: [] };
    let next = CLS();
    const svc = fakeService();
    const memory = createMemoryCoachStateRepo();
    const spec = (name, findings) => async () => { calls.fetched.push(name); return findings; };
    const deps = {
        client: {
            messages: { create: async () => ({ stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: JSON.stringify(next) }] }) },
            beta: { messages: { stream: (p) => { calls.answer++; calls.params.push(p); return { async *[Symbol.asyncIterator]() { yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'ok' } }; }, finalMessage: async () => ({ usage: {}, stop_reason: 'end_turn' }) }; } } },
        },
        coachStateRepo: memory,
        getProfileContext: async () => ({ basic: { age: 24, gender: 'male' }, allergies: { state: 'none' }, medications: { state: 'none' }, conditions: { state: 'none', items: [] }, fitness: { limitations: ['none'] }, diet: { preference: 'vegetarian' } }),
        getTargets: async () => ({ targets: { steps: 7500, waterMl: 3000 }, remaining: { waterMl: 1750 } }),
        getFreshness: async () => ({ weight: { at: new Date('2026-10-01'), value: 70 }, activity: { foodDays14: 10, workouts14: 5 } }),
        activityLogTools: createActivityLogTools({ service: svc, logger: { error: () => {} } }),
        logger: { warn: () => {}, error: () => {} },
        specialistDeps: {
            recovery: { getRecoveryAnalytics: spec('recovery', { entries: [{ date: '2026-11-25', recoveryScore: 38, band: { label: 'Very low' } }], personalBaselineRange: { low: 47, high: 68 } }) },
            sleep: { getSleepAnalytics: spec('sleep', { entries: [{ date: '2026-11-25', totalHours: 5.2 }] }) },
            fitness: { getActivityAnalytics: spec('fitness', { days: [{ date: '2026-11-25', device: { steps: 4200 }, manual: {} }] }), recentWorkouts: async () => [] },
            nutrition: { getNutritionTrends: spec('nutrition', { daysLogged: 0 }) },
        },
    };
    const send = async (message, cls, now = NOW) => {
        if (cls) next = cls;
        const events = [];
        const final = await runCoach({ input: { userId: USER, userName: 'Rahul', message, history: [], now, startedAt: Date.now() }, deps, onEvent: (e) => events.push(e) });
        return { final, events, text: events.filter((e) => e.type === 'token').map((e) => e.text).join(''), data: calls.params.at(-1)?.messages.at(-1).content || '' };
    };
    return { send, calls, svc, memory };
}

test('graph CHAT: "kuch sahi nahi lag raha" gets no data, no targets, no check-in; the model is told to be a friend and ask what happened', async () => {
    const t = setup();
    const r = await t.send('kya batau bhai kuch sahi nahi lag raha', CLS({ replyMode: 'chat', symptoms: [] }));
    assert.deepEqual(t.calls.fetched, []); // nothing read for the answer
    assert.match(r.data, /Mode: CHAT/);
    assert.match(r.data, /none given on purpose/);
    assert.doesNotMatch(r.data, /App targets|Recovery score|38\/100|weight now/);
    assert.equal(r.final.checkIn ?? null, null);
});

test('graph SPECIFIC: "aaj kitne steps hue?" fetches and sends only steps data', async () => {
    const t = setup();
    const r = await t.send('aaj kitne steps hue?', CLS({ replyMode: 'specific', askedMetrics: ['steps'], topics: ['fitness'], specialists: ['fitness', 'recovery'] }));
    assert.match(r.data, /Mode: SPECIFIC\. The user asked only about: steps/);
    assert.match(r.data, /4200 steps/);
    assert.doesNotMatch(r.data, /Recovery score|5h 12m/);
    assert.equal(r.final.checkIn ?? null, null); // no weight check-in on a steps question
});

test('graph LOG: "2 glass paani aur 3 cigarette" -> shown for yes / no; "haan" saves through the app path with a fixed reply (no model)', async () => {
    const t = setup();
    const logs = [
        { kind: 'water', amount: 2, unit: 'glass', drinkType: '', drinkSize: 'unknown', when: 'today' },
        { kind: 'smoke', amount: 3, unit: 'count', drinkType: '', drinkSize: 'unknown', when: 'today' },
    ];
    const r = await t.send('maine 2 glass paani piya aur 3 cigarette pi', CLS({ activityLogs: logs, replyMode: 'chat' }));
    const confirm = r.events.find((e) => e.type === 'activity_log_confirm');
    assert.deepEqual(confirm.entries.map((e) => e.label), ['Water: 2 glasses (500 ml)', 'Cigarettes: 3']);
    assert.match(r.data, /log them in the app \(yes \/ no\)/);
    assert.equal(t.svc.calls.length, 0); // nothing saved before yes

    const answersBefore = t.calls.answer;
    const yes = await t.send('haan', null, new Date(NOW.getTime() + 60000));
    assert.equal(t.calls.answer, answersBefore); // fixed reply, no model call
    assert.equal(yes.text, 'Log kar diya: Water: 2 glasses (500 ml); Cigarettes: 3. Aaj ke liye 1750 ml paani aur bacha hai.');
    assert.deepEqual(t.svc.calls.map((c) => c[0]), ['water', 'smoke']);
    assert.ok(yes.events.some((e) => e.type === 'activity_logged'));
});

test('graph LOG: "nahi" saves nothing; no amount -> the coach asks how much and logs nothing', async () => {
    const t = setup();
    await t.send('3 cigarette pi aaj', CLS({ activityLogs: [{ kind: 'smoke', amount: 3, unit: 'count', drinkType: '', drinkSize: 'unknown', when: 'today' }] }));
    const no = await t.send('nahi', null, new Date(NOW.getTime() + 60000));
    assert.equal(no.text, 'Theek hai, log nahi kiya. Sahi numbers bata doge to log kar dunga.');
    assert.equal(t.svc.calls.length, 0);

    const t2 = setup();
    const r = await t2.send('maine paani piya', CLS({ activityLogs: [{ kind: 'water', amount: -1, unit: 'none', drinkType: '', drinkSize: 'unknown', when: 'today' }] }));
    assert.match(r.data, /mentioned water but not how much[\s\S]*ask how much/);
    assert.ok(!r.events.some((e) => e.type === 'activity_log_confirm'));
});
