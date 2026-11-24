/**
 * Logging food from chat: user numbers win, the app's estimator fills the
 * rest (scaled to the user's calories), shown for "save?", written only on yes
 * through foodLogService. No DB, no API.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { buildEntry, describeEntry, mealTypeFromTime, createFoodLogTools } = require('../modules/ai-coach/tools/foodLogTools');
const { sanitizeMealLog } = require('../modules/ai-coach/orchestrator/intentClassifier');
const { normaliseItems, totalsOf } = require('../services/foodLogService');
const { runCoach } = require('../modules/ai-coach/orchestrator/mainCoachGraph');
const { createMemoryCoachStateRepo } = require('../modules/ai-coach/orchestrator/coachStateRepo');

const USER = String(new mongoose.Types.ObjectId());
const NOW = new Date('2026-11-24T08:00:00Z'); // 13:30 IST -> lunch
const meal = (over = {}) => ({ isLogging: true, mealType: 'unknown', description: '2 roti, 1 bowl dal', statedCalories: -1, statedProtein: -1, statedCarbs: -1, statedFats: -1, ...over });
const estimate = { foodName: 'Roti with dal', quantity: '2 roti + 1 bowl', nutrition: { calories: 400, protein: 16, carbs: 60, fats: 10, fiber: 8 } };

test('meal type from India time when not said', () => {
    assert.equal(mealTypeFromTime(new Date('2026-11-24T02:30:00Z')), 'breakfast'); // 08:00 IST
    assert.equal(mealTypeFromTime(NOW), 'lunch');                                   // 13:30 IST
    assert.equal(mealTypeFromTime(new Date('2026-11-24T11:30:00Z')), 'snack');      // 17:00 IST
    assert.equal(mealTypeFromTime(new Date('2026-11-24T15:30:00Z')), 'dinner');     // 21:00 IST
});

test('entry: user numbers win; unstated macros are scaled to the user\'s calories; estimates marked ~', () => {
    const e = buildEntry(meal({ statedCalories: 500, statedProtein: 30, mealType: 'lunch' }), estimate, NOW);
    assert.deepEqual(e.nutrition, { calories: 500, protein: 30, carbs: 75, fats: 13, fiber: 10 }); // 60*1.25, 10*1.25
    assert.deepEqual(e.source, { calories: 'user', protein: 'user', carbs: 'estimate', fats: 'estimate' });
    assert.match(describeEntry(e), /as lunch: 500 kcal, protein 30 g, carbs ~75 g, fat ~13 g/);

    const guessed = buildEntry(meal(), estimate, NOW);
    assert.equal(guessed.mealType, 'lunch');
    assert.equal(guessed.mealTypeGuessed, true);
    assert.equal(guessed.nutrition.calories, 400);
    assert.match(describeEntry(guessed), /guessed from the time/);

    const noEstimate = buildEntry(meal({ statedCalories: 300 }), null, NOW);
    assert.deepEqual(noEstimate.source, { calories: 'user', protein: 'unknown', carbs: 'unknown', fats: 'unknown' });
});

test('classifier meal log is sanitised: not logging -> empty; bad numbers -> -1 (not said)', () => {
    assert.equal(sanitizeMealLog(null).isLogging, false);
    assert.equal(sanitizeMealLog({ isLogging: true, description: '  ' }).isLogging, false);
    const m = sanitizeMealLog({ isLogging: true, mealType: 'brunch', description: 'oats', statedCalories: 99999, statedProtein: 20, statedCarbs: -5, statedFats: 'x' });
    assert.deepEqual(m, { isLogging: true, mealType: 'unknown', description: 'oats', statedCalories: -1, statedProtein: 20, statedCarbs: -1, statedFats: -1 });
});

test('estimator is skipped when the user gave every number; estimator failure still gives an entry', async () => {
    let calls = 0;
    const tools = createFoodLogTools({ estimateFood: async () => { calls++; return estimate; }, logger: { warn: () => {} } });
    await tools.prepare(USER, meal({ statedCalories: 500, statedProtein: 30, statedCarbs: 60, statedFats: 15 }), NOW);
    assert.equal(calls, 0);
    const failing = createFoodLogTools({ estimateFood: async () => { throw new Error('openrouter down'); }, logger: { warn: () => {} } });
    const e = await failing.prepare(USER, meal({ statedCalories: 500 }), NOW);
    assert.equal(e.nutrition.calories, 500);
    assert.equal(await tools.prepare(USER, { isLogging: false }, NOW), null);
});

test('foodLogService: items normalised and totals summed the same way as logMeal', () => {
    const items = normaliseItems([{ name: 'Roti', nutrition: { calories: '200', protein: 6 } }, { nutrition: { calories: 150, fats: 'x' } }]);
    assert.equal(items[1].name, 'Food Item');
    assert.equal(items[1].nutrition.fats, 0);
    assert.equal(totalsOf(items).calories, 350);
});

test('graph: "I ate X" -> shown with estimates + "save?"; "haan" saves through the meal log path and refreshes what\'s left', async () => {
    const saved = [];
    let targetsCalls = 0;
    const answers = [];
    let cls = { intent: 'profile_update', topics: ['nutrition'], specialists: [], timeframe: 'today', lookbackDays: 0, symptoms: [], symptomUpdates: [], redFlag: false, distress: false, language: 'hinglish', recommendsFoodOrSupplement: false, facts: [], mealLog: meal({ statedCalories: 500, statedProtein: 30, mealType: 'lunch' }) };
    const deps = {
        client: {
            messages: { create: async () => ({ stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: JSON.stringify(cls) }] }) },
            beta: { messages: { stream: (p) => { answers.push(p); return { async *[Symbol.asyncIterator]() { yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'ok' } }; }, finalMessage: async () => ({ usage: {}, stop_reason: 'end_turn' }) }; } } },
        },
        coachStateRepo: createMemoryCoachStateRepo(),
        getProfileContext: async () => ({ summary: '', completeness: {}, allergies: { state: 'none' }, medications: { state: 'none' }, conditions: { state: 'none', items: [] }, diet: { preference: 'vegetarian' } }),
        getTargets: async () => { targetsCalls++; return { targets: { calories: 2400 }, today: { calories: targetsCalls > 1 ? 500 : 0 }, remaining: { calories: targetsCalls > 1 ? 1900 : 2400 }, loggedToday: targetsCalls > 1 }; },
        profileTools: { saveFacts: async () => [], undoSaved: async () => 0 },
        foodLogTools: createFoodLogTools({ estimateFood: async () => estimate, saveMealLog: async (args) => { saved.push(args); return {}; } }),
        logger: { warn: () => {}, error: () => {} },
        specialistDeps: { nutrition: { getNutritionTrends: async () => ({ daysLogged: 0 }) } },
    };
    const send = async (message) => {
        const events = [];
        const final = await runCoach({ input: { userId: USER, userName: 'Rahul', message, history: [], now: NOW, startedAt: Date.now() }, deps, onEvent: (e) => events.push(e) });
        return { final, events };
    };

    const first = await send('lunch mein dal chawal khaya, 500 kcal tha aur 30 g protein');
    assert.equal(saved.length, 0);
    assert.ok(first.events.some((e) => e.type === 'food_log_confirm'));
    const block = answers[0].messages.at(-1).content;
    assert.match(block, /wants to log a meal: 2 roti, 1 bowl dal as lunch: 500 kcal, protein 30 g, carbs ~75 g, fat ~13 g/);
    assert.match(block, /save it to their lunch log \(yes \/ no\)/);
    assert.equal(first.final.checkIn, null); // one question per reply

    const answerCalls = answers.length;
    const yes = await send('haan');
    assert.equal(saved.length, 1);
    assert.deepEqual([saved[0].mealType, saved[0].source, saved[0].foodItems[0].nutrition.calories], ['lunch', 'chat', 500]);
    assert.ok(yes.events.some((e) => e.type === 'food_logged'));
    // Fixed reply, no answer-model call; "left" uses targets re-read after saving.
    assert.equal(answers.length, answerCalls);
    assert.equal(yes.final.reply, 'Ho gaya, lunch log mein save kar diya: 500 kcal, 30 g protein. Aaj ke liye ab 1900 kcal bacha hai.');
    assert.equal(yes.events.filter((e) => e.type === 'token').map((e) => e.text).join(''), yes.final.reply);
    assert.ok(!(await deps.coachStateRepo.load(USER)).pendingFoodLog); // cleared, a second "haan" won't save again

    // "nahi" path
    cls = { ...cls, mealLog: meal({ statedCalories: 300 }) };
    await send('aur ek kela khaya');
    await send('nahi');
    assert.equal(saved.length, 1);
    assert.match(answers.at(-1).messages.at(-1).content, /chose not to save that meal/);
});
