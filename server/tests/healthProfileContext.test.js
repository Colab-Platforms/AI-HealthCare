/**
 * ProfileContextService (AI read path) and profileSideEffects (what a profile
 * edit must also update). No DB: in-memory repo and fake models.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { createProfileWriteService } = require('../modules/health-profile/services/profileWriteService');
const { createProfileReadService, buildContext, contextKey } = require('../modules/health-profile/services/profileContextService');
const { createProfileSideEffects } = require('../modules/health-profile/services/profileSideEffects');
const { createMemoryProfileRepo } = require('./helpers/memoryProfileRepo');

const USER = String(new mongoose.Types.ObjectId());
const NOW = new Date('2026-11-23T10:00:00Z');

// ── buildContext ───────────────────────────────────────────────────────────

test('context: missing is "not asked yet", none is "none", never confused', () => {
    const ctx = buildContext({ allergies: { state: 'none', items: [] }, medications: { state: 'missing', items: [] } }, NOW);
    assert.match(ctx.summary, /Allergies: none/);
    assert.match(ctx.summary, /Current medications: not asked yet/);
    assert.match(ctx.summary, /Conditions: not asked yet/);
    assert.match(ctx.summary, /Age: unknown/);
});

test('context: only active medications; all inactive reads as none current', () => {
    const ctx = buildContext({
        medications: { state: 'has_items', items: [{ name: 'Metformin', dose: '500mg', active: true }, { name: 'Old', active: false }] },
    }, NOW);
    assert.deepEqual(ctx.medications.items.map((m) => m.name), ['Metformin']);
    assert.match(ctx.summary, /Current medications: Metformin 500mg/);

    const none = buildContext({ medications: { state: 'has_items', items: [{ name: 'Old', active: false }] } }, NOW);
    assert.equal(none.medications.state, 'none');
});

test('context: AI-extracted (unverified) facts are flagged unconfirmed', () => {
    const ctx = buildContext({ allergies: { state: 'has_items', items: [{ allergen: 'Peanut', severity: 'severe', verified: false }] } }, NOW);
    assert.equal(ctx.allergies.items[0].unconfirmed, true);
    assert.match(ctx.summary, /Peanut \(severe\) \(unconfirmed\)/);
});

test('context: age from date of birth (birthday not yet reached), BMI, no provenance noise', () => {
    const ctx = buildContext({
        basic: { dateOfBirth: '1990-12-01', age: 99, meta: { source: 'manual' } },
        body: { heightCm: 175, weightKg: 70, meta: { source: 'device' } },
        lifestyle: { smoking: 'no', sleepHours: 7, meta: { source: 'manual' } },
    }, NOW);
    assert.equal(ctx.basic.age, 35);
    assert.equal(ctx.body.bmi, 22.9);
    assert.equal(ctx.lifestyle.meta, undefined);
    assert.match(ctx.summary, /Lifestyle: smoking no, sleep 7h/);
});

test('context: float noise from old unit conversions is rounded for the AI', () => {
    const ctx = buildContext({ body: { heightCm: 160.00000000000003, weightKg: 56.80000000000001 } }, NOW);
    assert.equal(ctx.body.weightKg, 56.8);
    assert.equal(ctx.body.heightCm, 160);
    assert.match(ctx.summary, /weight: 56\.8 kg/);
    assert.equal(buildContext({}, NOW).body.weightKg, null);
});

test('context: falls back to stored age when DOB is missing or invalid', () => {
    assert.equal(buildContext({ basic: { age: 40 } }, NOW).basic.age, 40);
    assert.equal(buildContext({ basic: { age: 40, dateOfBirth: 'garbage' } }, NOW).basic.age, 40);
});

// ── getProfileContext ──────────────────────────────────────────────────────

function readSetup(users) {
    const repo = createMemoryProfileRepo({ users });
    const store = new Map();
    let fetches = 0;
    const cache = {
        async getOrSet(key, fn) {
            if (store.has(key)) return store.get(key);
            fetches++;
            const v = await fn();
            if (v) store.set(key, v);
            return v;
        },
    };
    const service = createProfileWriteService({ repo, afterCommit: async () => {} });
    const read = createProfileReadService({ repo, service, cache, now: () => NOW });
    return { repo, read, store, fetches: () => fetches };
}

test('getProfileContext: cached under profile:ctx:{user}:v1 (matches the invalidation pattern)', async () => {
    const { read, store, fetches } = readSetup({ [USER]: { _id: USER, profile: { age: 30, allergies: ['Peanut'] } } });
    const a = await read.getProfileContext(USER);
    const b = await read.getProfileContext(USER);
    assert.equal(fetches(), 1);
    assert.deepEqual(a, b);
    assert.ok(store.has(contextKey(USER)));
    assert.ok(contextKey(USER).startsWith(`profile:ctx:${USER}:`));
    assert.match(a.summary, /Allergies: Peanut/);
});

test('getProfileContext: never writes (no profile created); unknown user -> null, not cached', async () => {
    const { read, repo, store } = readSetup({ [USER]: { _id: USER, profile: { age: 30 } } });
    await read.getProfileContext(USER);
    assert.equal(repo.state.profiles[USER], undefined);
    assert.equal(repo.state.history.length, 0);

    const ghost = String(new mongoose.Types.ObjectId());
    assert.equal(await read.getProfileContext(ghost), null);
    assert.ok(!store.has(contextKey(ghost)));
});

// ── side effects ───────────────────────────────────────────────────────────

function fakeModels({ user, healthProfile = null, hasActivePlan = false, syncGoal }) {
    const updates = [];
    const regenerated = [];
    const deleted = [];
    const goalSyncs = [];
    const query = (value) => ({ select: () => ({ lean: async () => value }) });
    const deps = {
        User: {
            findById: () => query(user),
            updateOne: async (filter, update) => { updates.push(update); },
        },
        HealthProfile: { findOne: () => query(healthProfile) },
        PersonalizedDietPlan: { exists: async () => hasActivePlan },
        syncGoal: syncGoal || (async (userId, opts) => { goalSyncs.push({ userId, ...opts }); return null; }),
        reconcileFoodPreferences: (diet, prefs) => ({ prefs: { ...prefs, likes: [] }, dropped: diet === 'jain' ? [] : ['Jain'] }),
        normalizeDietaryPreference: (d) => d || null,
        regenerateDietPlan: async (id) => { regenerated.push(id); },
        cache: { delete: async (k) => { deleted.push(k); } },
        logger: { error: () => {} },
    };
    return { deps, updates, regenerated, deleted, goalSyncs };
}

const tick = () => new Promise((r) => setImmediate(r));

// 26 Nov: HealthGoal is the only stored goal; side effects recalculate it
// through healthGoalService.syncGoal and never write User.nutritionGoal.
test('side effects: body + goals change -> BMI, goal re-synced with the profile and HealthProfile target weight; no nutritionGoal writes', async () => {
    const profile = { height: 175, weight: 74, age: 31, gender: 'male' };
    const { deps, updates, deleted, goalSyncs } = fakeModels({
        user: { profile },
        healthProfile: { goals: { targetWeightKg: 68 } },
    });
    await createProfileSideEffects(deps).afterProfileChange(USER, ['body', 'goals']);

    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0], { $set: { 'healthMetrics.bmi': 24.2 } });
    assert.ok(!JSON.stringify(updates).includes('nutritionGoal'));
    assert.equal(goalSyncs.length, 1);
    assert.equal(goalSyncs[0].userId, USER);
    assert.deepEqual(goalSyncs[0].profile, profile);
    assert.equal(goalSyncs[0].targetWeight, 68);
    assert.ok(deleted.includes(`dashboard:${USER}`));
    assert.ok(deleted.includes(`health_goal:${USER}`));
});

test('side effects: body-only change re-syncs the goal without touching the target weight; conditions (diabetes) also re-sync', async () => {
    const { deps, goalSyncs } = fakeModels({ user: { profile: { height: 175, weight: 74, age: 31, gender: 'male' } } });
    const fx = createProfileSideEffects(deps);
    await fx.afterProfileChange(USER, ['body']);
    assert.equal(goalSyncs.length, 1);
    assert.equal(goalSyncs[0].targetWeight, undefined);
    await fx.afterProfileChange(USER, ['conditions']);
    assert.equal(goalSyncs.length, 2);
});

test('side effects: diet change cleans Jain leftovers and regenerates an active plan off the request path', async () => {
    const { deps, updates, regenerated } = fakeModels({
        user: { profile: { dietaryPreference: 'vegan' }, foodPreferences: { likes: ['Jain thali'] } },
        hasActivePlan: true,
    });
    await createProfileSideEffects(deps).afterProfileChange(USER, ['diet']);
    assert.deepEqual(updates[0].$set.foodPreferences.likes, []);
    assert.deepEqual(regenerated, []); // not yet: scheduled
    await tick();
    assert.deepEqual(regenerated, [USER]);
});

test('side effects: list-only changes do nothing; failures are logged, never thrown', async () => {
    const { deps, updates, goalSyncs } = fakeModels({ user: { profile: {} } });
    await createProfileSideEffects(deps).afterProfileChange(USER, ['allergies', 'medications']);
    assert.equal(updates.length, 0);
    assert.equal(goalSyncs.length, 0);

    const errors = [];
    const broken = fakeModels({
        user: { profile: { height: 175, weight: 74 } },
        syncGoal: async () => { throw new Error('db down'); },
    });
    broken.deps.logger = { error: (m) => errors.push(m) };
    await createProfileSideEffects(broken.deps).afterProfileChange(USER, ['body']);
    assert.match(errors[0], /nutrition.*db down/);
});
