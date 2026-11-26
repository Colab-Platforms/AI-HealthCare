/**
 * Fixes after the first real-API staging run (24 Nov):
 *  - CoachState saves askedLog with dotted field names (was a Mongoose Map error)
 *  - app targets reach the answer, with today's remaining amounts
 *  - long-range questions (months back) use monthly trends, cached
 *  - prefetched specialists are reused, only additions fetched after
 *  - "no data fetched" note + no-retraction rule in the prompt
 *  - classifier runs without thinking, lookbackDays sanitised
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const CoachState = require('../modules/ai-coach/models/CoachState');
const { toDoc, fromDoc, createMemoryCoachStateRepo } = require('../modules/ai-coach/orchestrator/coachStateRepo');
const { computeTargets, formatTargets } = require('../modules/ai-coach/context/targets');
const { parseLookbackDays, mergeLookback, windowFor } = require('../modules/ai-coach/context/lookback');
const { sleepSpecialist } = require('../modules/ai-coach/specialists/sleep');
const { nutritionSpecialist } = require('../modules/ai-coach/specialists/nutrition');
const { classify, sanitize } = require('../modules/ai-coach/orchestrator/intentClassifier');
const { buildRequest, COACH_RULES } = require('../modules/ai-coach/response/responseGenerator');
const { runCoach } = require('../modules/ai-coach/orchestrator/mainCoachGraph');

const NOW = new Date('2026-11-24T08:00:00Z');
const USER = String(new mongoose.Types.ObjectId());

// ── Bug 1: coach memory ────────────────────────────────────────────────────

test('CoachState: dotted field names are saved as a list and round-trip (the old Map rejected them)', async () => {
    const state = { askedLog: { 'fitness.limitations': NOW, allergies: NOW }, pendingQuestion: { field: 'fitness.limitations', question: 'Any injury?', askedAt: NOW } };
    const doc = toDoc(state);
    assert.equal(new CoachState({ user: USER, ...doc }).validateSync(), undefined);
    assert.deepEqual(Object.keys(fromDoc(JSON.parse(JSON.stringify(doc))).askedLog).sort(), ['allergies', 'fitness.limitations']);

    const repo = createMemoryCoachStateRepo();
    await repo.save(USER, state); // validates against the real schema
    assert.ok((await repo.load(USER)).askedLog['fitness.limitations']);
});

test('CoachState: old docs (askedLog stored as an object by the Map) load as empty, never crash', () => {
    assert.deepEqual(fromDoc({ askedLog: {} }).askedLog, {});
    assert.deepEqual(fromDoc(null), {});
});

// ── targets ────────────────────────────────────────────────────────────────

const loaded = (over = {}) => ({
    user: { profile: { age: 29, profession: 'desk_job', lifestyle: { waterGoalMl: 2500, stepGoal: 9000 } } },
    healthGoal: { goalType: 'muscle_gain', targetWeight: 76, dailyCalorieTarget: 2400, macroTargets: { protein: 140, carbs: 280, fats: 70 } },
    dietPlan: null,
    today: { totalCalories: 650, totalProtein: 40, totalCarbs: 80, totalFats: 20, waterIntake: 1000 },
    ...over,
});

test('targets: from the active HealthGoal (the only stored goal), remaining for today', () => {
    const t = computeTargets(loaded());
    assert.equal(t.targets.calories, 2400);
    assert.equal(t.targets.steps, 9000);
    assert.equal(t.targets.waterMl, 2500);
    assert.equal(t.targets.strengthMinPerWeek, 120); // muscle_gain guidance
    assert.deepEqual(t.remaining, { calories: 1750, protein: 100, carbs: 200, fat: 50, waterMl: 1500 });
    const text = formatTargets(t);
    assert.match(text, /calories 2400 kcal, protein 140 g/);
    assert.match(text, /Left for today: 1750 kcal, 100 g protein, 1500 ml water/);
    assert.match(text, /Weekly exercise target: 60 min cardio \+ 120 min strength/);
});

test('targets: over the goal -> 0 left (never negative); nothing logged -> full targets; unknown age -> no weekly target', () => {
    const over = computeTargets(loaded({ today: { totalCalories: 2600, waterIntake: 3000 } }));
    assert.equal(over.remaining.calories, 0);
    assert.equal(over.remaining.waterMl, 0);
    const none = computeTargets(loaded({ today: null }));
    assert.match(formatTargets(none), /Nothing logged today yet/);
    const noAge = computeTargets(loaded({ user: { profile: { lifestyle: {} } } }));
    assert.equal(noAge.targets.cardioMinPerWeek, null); // not the youth 420 min/week
    assert.equal(computeTargets({ user: null }), null);
});

test('targets: no HealthGoal yet -> old stored targets of a not-yet-migrated user (read-only); HealthGoal always wins', () => {
    const legacy = { calorieGoal: 2100, proteinGoal: 120, carbsGoal: 250, fatGoal: 60, targetWeight: 70, goal: 'weight_loss' };
    const fromLegacy = computeTargets(loaded({ healthGoal: null, legacy }));
    assert.equal(fromLegacy.targets.calories, 2100);
    assert.equal(fromLegacy.targets.goalType, 'weight_loss');
    assert.equal(computeTargets(loaded({ legacy })).targets.calories, 2400);
});

test('prompt: targets and the stay-inside-targets rule reach the model', () => {
    const req = buildRequest({ message: 'what should I eat for dinner?', targets: computeTargets(loaded()) });
    assert.match(COACH_RULES, /Stay inside the app's targets/);
    assert.match(req.messages.at(-1).content, /App targets:[\s\S]*Left for today: 1750 kcal/);
});

// ── Bug 2: no retraction ───────────────────────────────────────────────────

test('prompt: capabilities are stated (can log meals; no invented offers; no "A or B?" questions)', () => {
    assert.match(COACH_RULES, /You CAN: log a meal the user says they ate/);
    assert.match(COACH_RULES, /never offer to add suggested \(not eaten\) meals to their food log/);
    assert.match(COACH_RULES, /never "A or B\?"/);
});

test('prompt: no-data note when nothing was fetched + the no-retraction rule', () => {
    const req = buildRequest({ message: 'undo', specialistResults: [] });
    assert.match(req.messages.at(-1).content, /none fetched for this message because it wasn't needed/);
    assert.match(COACH_RULES, /never take back, "correct" or apologise for earlier numbers/);
});

// ── long range ─────────────────────────────────────────────────────────────

test('lookback: English + Hinglish periods, the larger of model and parser wins, capped at a year', () => {
    assert.equal(parseLookbackDays('how was my sleep in the last 6 months?', NOW), 180);
    assert.equal(parseLookbackDays('pichle 3 mahine mein weight kaisa raha', NOW), 90);
    assert.equal(parseLookbackDays('compare with last year', NOW), 365);
    assert.equal(parseLookbackDays('since june', NOW), 177); // 1 Jun -> 24 Nov 08:00 = 176.3 days, rounded up
    assert.equal(parseLookbackDays('how did I sleep last night?', NOW), 0);
    assert.equal(parseLookbackDays('last 5 years', NOW), 365);
    assert.equal(mergeLookback(60, 'last 6 months', NOW), 180);
    assert.equal(mergeLookback(200, 'hi', NOW), 200);
    assert.equal(mergeLookback('x', 'hi', NOW), 0);
    assert.deepEqual(windowFor(180, NOW), { startDate: '2026-05-28', endDate: '2026-11-24' });
});

test('sleep: months-back question adds monthly averages, read once then served from cache', async () => {
    const store = new Map();
    const cache = { getOrSet: async (k, fn) => (store.has(k) ? store.get(k) : (store.set(k, await fn()), store.get(k))) };
    let monthlyReads = 0;
    const deps = {
        cache,
        getSleepAnalytics: async (u, range) => {
            if (range === 'monthly') {
                monthlyReads++;
                return { summary: [{ period: '2026-06', avgHours: 7.1, avgScore: 74, daysLogged: 28 }, { period: '2026-11', avgHours: 6.2, daysLogged: 20 }] };
            }
            return { entries: [{ date: '2026-11-24', totalHours: 5.2, source: 'wearable' }] };
        },
    };
    const a = await sleepSpecialist({ userId: USER, now: NOW, deps, lookbackDays: 180 });
    await sleepSpecialist({ userId: USER, now: NOW, deps, lookbackDays: 180 });
    assert.equal(monthlyReads, 1);
    assert.match(a.findings[0], /Monthly sleep averages \(2026-05-28 to 2026-11-24\): Jun 2026 7h 06m score 74 \(28 nights\); Nov 2026 6h 12m \(20 nights\)/);
    assert.ok(a.data_used.includes('sleep_monthly'));
    // normal question: no monthly read at all
    await sleepSpecialist({ userId: USER, now: NOW, deps: { ...deps, cache: { getOrSet: () => { throw new Error('should not be called'); } } } });
});

test('nutrition: months back uses monthly averages even when the last week is empty', async () => {
    const r = await nutritionSpecialist({
        userId: USER, now: NOW, lookbackDays: 120,
        deps: {
            cache: { getOrSet: async (k, fn) => fn() },
            getNutritionTrends: async () => ({ daysLogged: 0 }),
            monthlyNutrition: async () => [{ period: '2026-08', avgCalories: 2100, avgProtein: 90, daysLogged: 18 }],
        },
    });
    assert.equal(r.status, 'completed');
    assert.match(r.findings.join(' '), /Aug 2026 2100 kcal, protein 90 g \(18 days logged\)/);
});

// ── classifier ─────────────────────────────────────────────────────────────

test('classifier: no thinking, lookbackDays in the schema and clamped', async () => {
    let params;
    const client = { messages: { create: async (p) => { params = p; return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ intent: 'data_question', topics: [], specialists: [], timeframe: 'unspecified', lookbackDays: 9999, symptoms: [], redFlag: false, distress: false, language: 'english', recommendsFoodOrSupplement: false, facts: [] }) }] }; } } };
    const r = await classify({ message: 'how was my sleep this year', client });
    assert.deepEqual(params.thinking, { type: 'disabled' });
    assert.ok(params.output_config.format.schema.required.includes('lookbackDays'));
    assert.equal(r.lookbackDays, 365);
    assert.equal(sanitize({ lookbackDays: -5 }).lookbackDays, 0);
});

// ── graph: prefetch reuse + timings ────────────────────────────────────────

test('graph: specialists prefetched during classify are reused; only the classifier\'s additions run after', async () => {
    const reads = { recovery: 0, sleep: 0, fitness: 0, medical_lab: 0 };
    const classification = { intent: 'health_coaching', topics: ['fitness'], specialists: ['fitness', 'medical_lab'], timeframe: 'today', lookbackDays: 0, symptoms: ['fatigue'], redFlag: false, distress: false, language: 'english', recommendsFoodOrSupplement: false, facts: [] };
    const deps = {
        client: {
            messages: { create: async () => ({ stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: JSON.stringify(classification) }] }) },
            beta: { messages: { stream: () => ({ async *[Symbol.asyncIterator]() { yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'ok' } }; }, finalMessage: async () => ({ usage: {}, stop_reason: 'end_turn' }) }) } },
        },
        coachStateRepo: createMemoryCoachStateRepo(),
        getProfileContext: async () => ({ summary: '', completeness: {}, allergies: { state: 'none' }, medications: { state: 'none' }, conditions: { state: 'none' }, fitness: { limitations: ['none'] } }),
        getTargets: async () => computeTargets(loaded()),
        profileTools: { saveFacts: async () => [], undoSaved: async () => 0 },
        logger: { warn: () => {}, error: () => {} },
        specialistDeps: {
            recovery: { getRecoveryAnalytics: async () => { reads.recovery++; return { entries: [] }; } },
            sleep: { getSleepAnalytics: async () => { reads.sleep++; return { entries: [] }; } },
            fitness: { getActivityAnalytics: async () => { reads.fitness++; return { days: [] }; }, recentWorkouts: async () => [] },
            medical_lab: { latestReports: async () => { reads.medical_lab++; return []; } },
        },
    };
    const final = await runCoach({ input: { userId: USER, userName: 'T', message: "I'm tired, gym today?", history: [], now: NOW, startedAt: Date.now() }, deps, onEvent: () => {} });
    // fast path: rules prefetched sleep + recovery + fitness and the answer used those; the
    // classifier's extra medical_lab is NOT fetched (accepted trade-off for speed)
    assert.equal(final.timings.path, 'fast');
    assert.deepEqual(reads, { recovery: 1, sleep: 1, fitness: 1, medical_lab: 0 });
    assert.equal(final.timings.specialistsReused, 3);
    assert.equal(final.timings.specialistsFetchedAfter, 0);
    assert.deepEqual(final.specialistResults.map((s) => s.specialist).sort(), ['fitness', 'recovery', 'sleep']);
    assert.ok(final.classification.specialists.includes('medical_lab')); // reconciled classification kept for logs
    assert.ok(typeof final.timings.firstTokenMs === 'number');
    assert.ok(typeof final.timings.classifyMs === 'number');
    assert.match(final.dataBlock, /App targets:/);
});
