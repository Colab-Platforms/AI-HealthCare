/**
 * Warm greeting (25 Nov, user request): "Hii" gets a friendly, personal reply,
 * a true compliment from this week's data on the first chat of the day, and
 * "want me to plan your day?"; "yes" gets the day plan. Code only for the
 * greeting itself. No DB, no API.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { buildGreeting, toneFor } = require('../modules/ai-coach/orchestrator/greeting');
const { runCoach } = require('../modules/ai-coach/orchestrator/mainCoachGraph');
const { createMemoryCoachStateRepo } = require('../modules/ai-coach/orchestrator/coachStateRepo');

const MORNING = new Date('2026-11-25T03:00:00Z'); // 08:30 IST
const EVENING = new Date('2026-11-25T13:30:00Z'); // 19:00 IST
const young = { basic: { age: 24, gender: 'male' } };
const senior = { basic: { age: 67, gender: 'female' } };
const stepsUp = { thisWeek: { stepDays: 7, stepsAvg: 9500, stepGoalDays: 4, sleepGoalNights: 2 }, lastWeek: { stepDays: 7, stepsAvg: 7000 } };
const flat = { thisWeek: { stepDays: 7, stepsAvg: 7000, stepGoalDays: 2, sleepGoalNights: 2 }, lastWeek: { stepDays: 7, stepsAvg: 7000 } };

test('greeting: casual Hinglish user gets the friendly "bhai" hello, a true compliment and the day-plan offer', () => {
    const g = buildGreeting({ message: 'hii bhai', userName: 'Rahul Sharma', profileContext: young, coachState: {}, language: 'hinglish', now: MORNING, progressSummary: stepsUp });
    assert.equal(g.text, 'Hii Rahul! Kaisa hai bhai? Is hafte steps badhe hain, bahut sahi ja raha hai!\nAaj ka din start hua hai, batau aaj kya karna hai?');
    assert.equal(g.offer, true);
});

test('greeting: plain "hi" is English (decision 25 Nov) and friendly, not "bhai"', () => {
    const g = buildGreeting({ message: 'hi', userName: 'Rahul', profileContext: young, coachState: {}, language: 'english', now: MORNING, progressSummary: stepsUp });
    assert.equal(g.text, 'Hey Rahul! How\'s it going? Your steps are up this week, nice work!\nYour day\'s just getting started. Want me to tell you what to focus on today?');
});

test('greeting: 60+ users get "aap" + "ji", even if they write casually', () => {
    assert.equal(toneFor({ message: 'hii bhai', profileContext: senior }), 'respectful');
    const g = buildGreeting({ message: 'namaste', userName: 'Sushila', profileContext: senior, coachState: {}, language: 'hinglish', now: EVENING, progressSummary: null });
    assert.equal(g.text, 'Namaste Sushila ji! Aap kaise hain?\nKya main bataun aaj ke baaki din mein aapko kya karna chahiye?');
});

test('greeting: no compliment unless the data shows one (never made up); casual woman gets "Kaisi hai yaar"', () => {
    const g = buildGreeting({ message: 'hii yaar', userName: 'Priya', profileContext: { basic: { age: 28, gender: 'female' } }, coachState: {}, language: 'hinglish', now: MORNING, progressSummary: flat });
    assert.equal(g.text, 'Hii Priya! Kaisi hai yaar?\nAaj ka din start hua hai, batau aaj kya karna hai?');
});

test('greeting: later the same day (already chatted) it just asks what to help with, no offer', () => {
    const g = buildGreeting({ message: 'hi', userName: 'Rahul', profileContext: young, coachState: { lastChatAt: new Date('2026-11-25T02:00:00Z') }, language: 'english', now: MORNING });
    assert.equal(g.text, 'Hey Rahul! How\'s it going? What can I help you with?');
    assert.equal(g.offer, false);
});

// ── graph: hi -> offer -> yes / no ─────────────────────────────────────────

const USER = String(new mongoose.Types.ObjectId());
const CLS = { intent: 'health_coaching', topics: ['fitness'], specialists: ['fitness'], timeframe: 'today', lookbackDays: 0, symptoms: [], symptomUpdates: [], redFlag: false, distress: false, language: 'hinglish', recommendsFoodOrSupplement: true, facts: [], mealLog: { isLogging: false, mealType: 'unknown', description: '', statedCalories: -1, statedProtein: -1, statedCarbs: -1, statedFats: -1 } };

function setup() {
    const calls = { classify: 0, answer: 0, params: [] };
    const memory = createMemoryCoachStateRepo();
    const deps = {
        client: {
            messages: { create: async () => { calls.classify++; return { stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: JSON.stringify(CLS) }] }; } },
            beta: { messages: { stream: (p) => { calls.answer++; calls.params.push(p); return { async *[Symbol.asyncIterator]() { yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Plan' } }; }, finalMessage: async () => ({ usage: {}, stop_reason: 'end_turn' }) }; } } },
        },
        coachStateRepo: memory,
        getProfileContext: async () => ({ ...young, allergies: { state: 'none' }, medications: { state: 'none' }, conditions: { state: 'none', items: [] }, fitness: { limitations: ['none'] }, diet: { preference: 'vegetarian' } }),
        logger: { warn: () => {}, error: () => {} },
        specialistDeps: {
            progress: { getTargets: async () => ({ targets: { steps: 7500 } }), getActivityAnalytics: async () => ({ days: [] }), getSleepAnalytics: async () => ({ entries: [] }), loadNutritionDays: async () => [], loadWorkouts: async () => [] },
            recovery: { getRecoveryAnalytics: async () => ({ entries: [] }) },
            sleep: { getSleepAnalytics: async () => ({ entries: [] }) },
            fitness: { getActivityAnalytics: async () => ({ days: [] }), recentWorkouts: async () => [] },
            nutrition: { getNutritionTrends: async () => ({ daysLogged: 0 }) },
        },
    };
    const send = async (message, now = MORNING) => {
        const events = [];
        const final = await runCoach({ input: { userId: USER, userName: 'Rahul', message, history: [], now, startedAt: Date.now() }, deps, onEvent: (e) => events.push(e) });
        return { final, text: events.filter((e) => e.type === 'token').map((e) => e.text).join('') };
    };
    return { send, calls, memory };
}

test('graph: "hii bhai" is instant (no model call) and offers the day plan; "haan" gets the plan from the data', async () => {
    const t = setup();
    const hi = await t.send('hii bhai');
    assert.equal(hi.final.route, 'quick');
    assert.equal(t.calls.classify + t.calls.answer, 0);
    assert.match(hi.text, /^Hii Rahul! Kaisa hai bhai\?[\s\S]*batau aaj kya karna hai\?$/);
    assert.equal((await t.memory.load(USER)).pendingOffer.kind, 'day_plan');

    const yes = await t.send('haan', new Date(MORNING.getTime() + 60000));
    assert.equal(yes.final.route, 'coach');
    assert.equal(yes.final.timings.dayPlanFromOffer, true);
    assert.deepEqual([...yes.final.specialistResults.map((s) => s.specialist)].sort(), ['fitness', 'nutrition', 'recovery', 'sleep']);
    const lastUser = yes.final.dataBlock ? t.calls.params.at(-1).messages.filter((m) => m.role === 'user').at(-1).content : '';
    assert.match(lastUser, /Aaj ka plan batao/);
    assert.equal((await t.memory.load(USER)).pendingOffer, null);
});

test('graph: "nahi" to the offer gets one friendly line and no model call; any other message drops the offer', async () => {
    const t = setup();
    await t.send('hii bhai');
    const no = await t.send('nahi', new Date(MORNING.getTime() + 60000));
    assert.equal(no.final.route, 'quick');
    assert.equal(no.text, 'Theek hai! Jab chahiye ho, bata dena.');
    assert.equal(t.calls.classify + t.calls.answer, 0);

    const t2 = setup();
    await t2.send('hii bhai');
    await t2.send('protein kitna lu?', new Date(MORNING.getTime() + 60000));
    assert.equal((await t2.memory.load(USER)).pendingOffer, null);
});
