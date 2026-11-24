/**
 * "Add this meal pattern to my 7-day plan": offer after meal suggestions,
 * extract + save only on yes, never while a stomach symptom is active.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { createMealPrefTools, mergePatterns } = require('../modules/ai-coach/tools/mealPrefTools');
const { runCoach } = require('../modules/ai-coach/orchestrator/mainCoachGraph');
const { createMemoryCoachStateRepo } = require('../modules/ai-coach/orchestrator/coachStateRepo');
const { createSymptomTools, createMemorySymptomRepo } = require('../modules/ai-coach/tools/symptomTools');

const USER = String(new mongoose.Types.ObjectId());
const NOW = new Date('2026-11-24T08:00:00Z');

test('merge: new patterns first, case-insensitive dedupe, max 6 per slot, other slots kept', () => {
    const existing = { breakfast: ['Poha', 'Upma', 'Idli', 'Dosa', 'Oats', 'Paratha'], dinner: ['Khichdi'] };
    const m = mergePatterns(existing, [{ slot: 'breakfast', pattern: 'paneer bhurji with roti' }, { slot: 'breakfast', pattern: 'poha' }]);
    assert.deepEqual(m.breakfast, ['paneer bhurji with roti', 'poha', 'Upma', 'Idli', 'Dosa', 'Oats']);
    assert.deepEqual(m.dinner, ['Khichdi']);
    assert.deepEqual(m.lunch, []);
});

test('savePatternsFromReply: Haiku extracts (no thinking, schema), saved into mealPreferences; errors never throw', async () => {
    let saved;
    let params;
    const tools = createMealPrefTools({
        loadPrefs: async () => ({ breakfast: ['Poha'] }),
        savePrefs: async (u, prefs) => { saved = prefs; },
        logger: { error: () => {} },
    });
    const client = { messages: { create: async (p) => { params = p; return { stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: JSON.stringify({ patterns: [{ slot: 'breakfast', pattern: 'paneer bhurji with multigrain roti' }, { slot: 'dinner', pattern: 'tofu tikka with dal' }, { slot: 'brunch', pattern: 'x' }] }) }] }; } } };
    const out = await tools.savePatternsFromReply(USER, { client, replyText: 'Breakfast: paneer bhurji...' });
    assert.equal(out.length, 2);
    assert.deepEqual(saved.breakfast, ['paneer bhurji with multigrain roti', 'Poha']);
    assert.deepEqual(saved.dinner, ['tofu tikka with dal']);
    assert.deepEqual(params.thinking, { type: 'disabled' });

    const broken = createMealPrefTools({ logger: { error: () => {} } });
    assert.deepEqual(await broken.savePatternsFromReply(USER, { client: { messages: { create: async () => { throw new Error('overloaded'); } } }, replyText: 'x' }), []);
});

function setup({ symptoms = [] } = {}) {
    const calls = { answers: [], extracts: 0 };
    const symptomRepo = createMemorySymptomRepo();
    const saved = [];
    let classification = { intent: 'health_coaching', topics: ['nutrition'], specialists: [], timeframe: 'unspecified', lookbackDays: 0, symptoms, symptomUpdates: [], redFlag: false, distress: false, language: 'hinglish', recommendsFoodOrSupplement: true, facts: [] };
    const deps = {
        client: {
            messages: {
                create: async (p) => {
                    if (p.system && String(p.system).startsWith('Extract the meal patterns')) {
                        calls.extracts++;
                        return { stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: JSON.stringify({ patterns: [{ slot: 'breakfast', pattern: 'paneer bhurji with roti' }] }) }] };
                    }
                    return { stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: JSON.stringify(classification) }] };
                },
            },
            beta: { messages: { stream: (p) => { calls.answers.push(p); return { async *[Symbol.asyncIterator]() { yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Breakfast: paneer bhurji + roti. Dinner: dal + roti.' } }; }, finalMessage: async () => ({ usage: {}, stop_reason: 'end_turn' }) }; } } },
        },
        coachStateRepo: createMemoryCoachStateRepo(),
        getProfileContext: async () => ({ summary: '', completeness: {}, allergies: { state: 'has_items', items: [{ allergen: 'Peanut' }] }, medications: { state: 'none' }, conditions: { state: 'none', items: [] }, diet: { preference: 'vegetarian' }, fitness: { limitations: ['none'] } }),
        getTargets: async () => null,
        symptomTools: createSymptomTools({ repo: symptomRepo, logger: { error: () => {} } }),
        profileTools: { saveFacts: async () => [], undoSaved: async () => 0 },
        mealPrefTools: createMealPrefTools({ loadPrefs: async () => ({}), savePrefs: async (u, p) => { saved.push(p); }, logger: { error: () => {} } }),
        logger: { warn: () => {}, error: () => {} },
        specialistDeps: { nutrition: { getNutritionTrends: async () => ({ daysLogged: 0 }) } },
    };
    const send = async (message) => {
        const events = [];
        const final = await runCoach({ input: { userId: USER, userName: 'Rahul', message, history: [], now: NOW, startedAt: Date.now() }, deps, onEvent: (e) => events.push(e) });
        return { final, events };
    };
    return { send, calls, saved, deps, setClassification: (c) => { classification = { ...classification, ...c }; } };
}

test('graph: meal suggestions end with the plan offer; "haan" extracts + saves the pattern; nothing extracted before yes', async () => {
    const t = setup();
    const r = await t.send('bhai mere liye meal generate karo');
    assert.equal(r.final.mealOffer, true);
    assert.match(t.calls.answers[0].messages.at(-1).content, /added to their 7-day meal plan \(yes \/ no\)/);
    assert.equal(t.calls.extracts, 0);
    assert.match((await t.deps.coachStateRepo.load(USER)).pendingMealPref.replyText, /paneer bhurji/);

    const yes = await t.send('haan');
    assert.equal(t.calls.extracts, 1);
    assert.deepEqual(t.saved[0].breakfast, ['paneer bhurji with roti']);
    assert.ok(yes.events.some((e) => e.type === 'meal_pref_saved'));
    assert.match(t.calls.answers.at(-1).messages.at(-1).content, /Saved to their meal-plan favourites: breakfast: paneer bhurji with roti[\s\S]*different dishes each day/);
    assert.ok(!(await t.deps.coachStateRepo.load(USER)).pendingMealPref);
});

test('graph: "nahi" saves nothing; no plan offer while a stomach symptom is active', async () => {
    const t = setup();
    await t.send('meal do');
    await t.send('nahi');
    assert.equal(t.calls.extracts, 0);
    assert.equal(t.saved.length, 0);
    assert.match(t.calls.answers.at(-1).messages.at(-1).content, /said no to adding the meal/);

    const s = setup({ symptoms: ['stomach burning'] });
    const r = await s.send('pait mein jalan hai, dinner mein kya khaun?');
    assert.equal(r.final.mealOffer, false);
    assert.ok(!/7-day meal plan/.test(s.calls.answers[0].messages.at(-1).content));
});
