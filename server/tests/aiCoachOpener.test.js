/**
 * Chat opener (POST /api/coach/opener): the coach's first message when the
 * user opens the coach screen. Code only, once a day, never "irritating".
 * No DB, no API.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { createOpenerService, routineLine } = require('../modules/ai-coach/opener/openerService');
const { createMemoryCoachStateRepo } = require('../modules/ai-coach/orchestrator/coachStateRepo');
const { createSymptomTools, createMemorySymptomRepo } = require('../modules/ai-coach/tools/symptomTools');
const { LAST_ASK_KEY } = require('../modules/ai-coach/orchestrator/checkIns');

const USER = String(new mongoose.Types.ObjectId());
const MORNING_IST = new Date('2026-11-25T03:00:00Z'); // 08:30 IST
const later = (min) => new Date(MORNING_IST.getTime() + min * 60000);

const SUMMARY = {
    targets: { steps: 8000, sleepHours: 7, calories: 2000 },
    thisWeek: { stepsAvg: 6240, stepDays: 7, stepGoalDays: 3, sleepAvg: 6.4, sleepNights: 6, sleepGoalNights: 2, kcalAvg: 1900, kcalDays: 4, kcalOnTarget: 2, cardioMin: 60, strengthMin: 0 },
    lastWeek: {},
    today: {},
};
const fullProfile = { allergies: { state: 'none' }, medications: { state: 'none' }, conditions: { state: 'none', items: [] }, diet: { preference: 'vegetarian' }, basic: { age: 30 }, body: { heightCm: 175, weightKg: 70 }, fitness: { limitations: ['none'] } };

function setup({ summary = SUMMARY, profile = fullProfile, state = {} } = {}) {
    const coachStateRepo = createMemoryCoachStateRepo();
    const symptomRepo = createMemorySymptomRepo();
    const symptomTools = createSymptomTools({ repo: symptomRepo, logger: { error: () => {} } });
    const svc = createOpenerService({
        coachStateRepo,
        symptomTools,
        getProfileContext: async () => profile,
        progress: async () => (summary ? { summary } : { status: 'no_data' }),
        logger: { warn: () => {} },
    });
    const ready = coachStateRepo.save(USER, state);
    return { svc, coachStateRepo, symptomTools, ready, open: async (now = MORNING_IST) => { await ready; return svc.buildOpener({ userId: USER, userName: 'Rahul Sharma', now }); } };
}

test('opener: greeting by IST time + last 7 days routine; no question when the profile is complete', async () => {
    const t = setup();
    const { opener } = await t.open();
    assert.equal(opener.text, 'Good morning Rahul!\nLast 7 days: 6,240 steps a day on average (goal 8,000 met on 3 of 7 days), 6.4 h sleep a night (goal 7 h), meals logged on 4 days.');
    assert.equal(opener.question, null);
});

test('opener: an open symptom is asked first, and recorded so the reply is read as its answer', async () => {
    const t = setup();
    await t.ready;
    await t.symptomTools.record(USER, { symptoms: ['stomach burning'] }, new Date('2026-11-22T10:00:00Z'));
    const { opener } = await t.open();
    assert.match(opener.text, /\nHow is your stomach burning now\?$/);
    assert.equal(opener.question.kind, 'symptom');
    const [s] = await t.symptomTools.listActive(USER);
    assert.ok(s.lastAskedAt);
    assert.ok((await t.coachStateRepo.load(USER)).askedLog[LAST_ASK_KEY]);
});

test('opener: missing important profile fact -> one gap question, saved as the pending question; Hinglish users get Hinglish', async () => {
    const t = setup({ profile: { ...fullProfile, allergies: { state: 'missing' } }, state: { lastLanguage: 'hinglish' } });
    const { opener } = await t.open();
    assert.match(opener.text, /^Good morning Rahul!\nPichhle 7 din: roz avg 6,240 steps \(goal 8,000, 3\/7 din poora\)/);
    assert.match(opener.text, /\nKisi khane ya dawai se allergy hai\?$/);
    const state = await t.coachStateRepo.load(USER);
    assert.equal(state.pendingQuestion.field, 'allergies');
});

test('opener: once a day; not on a day the user already chatted (IST day, not UTC)', async () => {
    const t = setup();
    assert.ok((await t.open()).opener);
    assert.equal((await t.open(later(120))).reason, 'already_today');

    const chatted = setup({ state: { lastChatAt: new Date('2026-11-24T20:00:00Z') } }); // 01:30 IST on the 25th
    assert.equal((await chatted.open()).reason, 'chatted_today');
    const chattedYesterday = setup({ state: { lastChatAt: new Date('2026-11-24T18:00:00Z') } }); // 23:30 IST on the 24th
    assert.ok((await chattedYesterday.open()).opener);
});

test('opener: nothing to say -> no opener at all (no bare "Good morning")', async () => {
    const t = setup({ summary: null });
    const r = await t.open();
    assert.equal(r.opener, null);
    assert.equal(r.reason, 'nothing_to_say');
});

test('opener: inside the 30-min question cooldown it gives the routine but asks nothing', async () => {
    const t = setup({ profile: { ...fullProfile, allergies: { state: 'missing' } }, state: { askedLog: { [LAST_ASK_KEY]: later(-10) } } });
    const { opener } = await t.open();
    assert.equal(opener.question, null);
    assert.doesNotMatch(opener.text, /allergy/);
});

test('routineLine: only the parts with data; none -> null', () => {
    assert.equal(routineLine({ targets: {}, thisWeek: { stepDays: 0, sleepNights: 3, sleepAvg: 7.2, kcalDays: 0 } }, false), 'Last 7 days: 7.2 h sleep a night.');
    assert.equal(routineLine({ targets: {}, thisWeek: { stepDays: 0, sleepNights: 0, kcalDays: 1 } }, false), 'Last 7 days: meals logged on 1 day.');
    assert.equal(routineLine({ targets: {}, thisWeek: { stepDays: 0, sleepNights: 0, kcalDays: 0 } }, false), null);
    assert.equal(routineLine(null, false), null);
});

test('chat turn records lastChatAt, so the opener stays quiet that day', async () => {
    const { runCoach } = require('../modules/ai-coach/orchestrator/mainCoachGraph');
    const t = setup();
    await t.ready;
    const deps = {
        client: { messages: { create: async () => { throw new Error('not needed'); } } },
        coachStateRepo: t.coachStateRepo,
        getProfileContext: async () => fullProfile,
        logger: { warn: () => {}, error: () => {} },
    };
    await runCoach({ input: { userId: USER, userName: 'Rahul', message: 'hi', history: [], now: MORNING_IST, startedAt: Date.now() }, deps, onEvent: () => {} });
    assert.equal((await t.open(later(30))).reason, 'chatted_today');
});
