/**
 * profileSync: the bridge the old write points (signup, health goal, weight
 * log, smart scale) use to write through HealthProfile. In-memory repo, no DB.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { createProfileWriteService } = require('../modules/health-profile/services/profileWriteService');
const { createProfileSync, cleanSections, positiveNumber } = require('../modules/health-profile/services/profileSync');
const { createMemoryProfileRepo } = require('./helpers/memoryProfileRepo');

const USER = String(new mongoose.Types.ObjectId());

const legacyUser = (overrides = {}) => ({
    _id: USER,
    profile: {
        age: 32, gender: 'male', height: 175, weight: 78,
        allergies: ['Peanut'],
        lifestyle: { smoker: false, waterGoalMl: 2500, stepGoal: 8000 },
        ...overrides,
    },
    nutritionGoal: { targetWeight: 70, calorieGoal: 2000 },
});

function setup({ user = legacyUser(), enabled = true } = {}) {
    const repo = createMemoryProfileRepo({ users: user ? { [USER]: user } : {} });
    const patches = [];
    const realPatch = repo.patchUser;
    repo.patchUser = async (id, patch, session) => { patches.push(patch); return realPatch(id, patch, session); };

    const invalidated = [];
    const logs = { warn: [], error: [] };
    const logger = { warn: (m) => logs.warn.push(m), error: (m) => logs.error.push(m) };
    // The service's own cache clearing is a no-op here; the bridge's is recorded.
    const service = createProfileWriteService({ repo, afterCommit: async () => {} });
    const flag = { on: enabled };
    const sync = createProfileSync({
        service, repo, logger,
        invalidate: async (id) => { invalidated.push(String(id)); },
        enabled: () => flag.on,
    });
    return {
        repo, sync, flag, patches, invalidated, logs,
        profile: () => repo.state.profiles[USER],
        user: () => repo.state.users[USER],
        history: () => repo.state.history,
    };
}

const goalFacts = { basic: { age: 33 }, body: { heightCm: 176, weightKg: 80 }, goals: { targetWeightKg: 72 } };
const nutritionPatch = { $set: { nutritionGoal: { goal: 'weight_loss', targetWeight: 72, calorieGoal: 1800 } } };

// ── helpers ─────────────────────────────────────────────────────────────────

test('positiveNumber: only finite numbers above zero', () => {
    assert.equal(positiveNumber('72.5'), 72.5);
    assert.equal(positiveNumber(0), undefined);
    assert.equal(positiveNumber(-3), undefined);
    assert.equal(positiveNumber('abc'), undefined);
    assert.equal(positiveNumber(null), undefined);
    assert.equal(positiveNumber(''), undefined);
    assert.equal(positiveNumber(NaN), undefined);
});

test('cleanSections: keeps valid values, reports invalid, skips blanks silently', () => {
    const { clean, dropped } = cleanSections({
        basic: { age: 200, gender: 'female' },
        body: { weightKg: 900, heightCm: undefined },
        goals: { targetWeightKg: NaN },
    });
    assert.deepEqual(clean, { basic: { gender: 'female' } });
    assert.deepEqual(dropped.sort(), ['basic.age=200', 'body.weightKg=900']);
});

// ── writeWithUser (health goal, weight log, calorie override) ───────────────

test('writeWithUser: profile facts + caller patch land together, mirror matches', async () => {
    const { sync, profile, user, invalidated } = setup();
    const res = await sync.writeWithUser(USER, goalFacts, nutritionPatch, { source: 'manual' });

    assert.equal(res.synced, true);
    assert.equal(profile().basic.age, 33);
    assert.equal(profile().body.weightKg, 80);
    assert.equal(profile().goals.targetWeightKg, 72);
    assert.equal(profile().body.meta.source, 'manual');
    // mirror
    assert.equal(user().profile.age, 33);
    assert.equal(user().profile.height, 176);
    assert.equal(user().profile.weight, 80);
    assert.equal(user().nutritionGoal.targetWeight, 72);
    // caller patch kept the rest of nutritionGoal
    assert.equal(user().nutritionGoal.calorieGoal, 1800);
    assert.equal(user().nutritionGoal.goal, 'weight_loss');
    // app settings and other health facts untouched
    assert.equal(user().profile.lifestyle.waterGoalMl, 2500);
    assert.deepEqual(user().profile.allergies, ['Peanut']);
    assert.deepEqual(invalidated, [USER]);
});

test('writeWithUser: one transaction, one version bump for several sections', async () => {
    const { sync, profile, history } = setup();
    await sync.writeWithUser(USER, goalFacts, nutritionPatch, { source: 'manual' });
    assert.equal(profile().version, 1);
    assert.deepEqual(history().map((h) => h.field).sort(),
        ['*', 'basic.age', 'body.heightCm', 'body.weightKg', 'goals.targetWeightKg']);
    assert.ok(history().every((h) => h.profileVersion === 1));
});

test('writeWithUser: 0 / NaN / out-of-range values are never written (old code wrote 0)', async () => {
    const { sync, profile, user, logs } = setup();
    await sync.writeWithUser(USER, {
        basic: { age: positiveNumber(0) },
        body: { heightCm: positiveNumber('abc'), weightKg: 900 },
    }, nutritionPatch, { source: 'manual' });

    assert.equal(user().profile.age, 32);
    assert.equal(user().profile.height, 175);
    assert.equal(user().profile.weight, 78);
    assert.equal(profile(), undefined); // nothing valid to write, no profile created
    assert.equal(user().nutritionGoal.calorieGoal, 1800); // caller's own write still saved
    assert.match(logs.warn[0], /body\.weightKg=900/);
});

test('writeWithUser: same values again change nothing in the profile', async () => {
    const { sync, profile, history } = setup();
    await sync.writeWithUser(USER, goalFacts, nutritionPatch, { source: 'manual' });
    const before = history().length;
    await sync.writeWithUser(USER, goalFacts, nutritionPatch, { source: 'manual' });
    assert.equal(profile().version, 1);
    assert.equal(history().length, before);
});

test('writeWithUser: a DB failure rolls back BOTH the caller patch and the profile', async () => {
    const { sync, repo, profile, user, invalidated } = setup();
    repo.failures.patchUser = new Error('mongo down');
    await assert.rejects(sync.writeWithUser(USER, goalFacts, nutritionPatch, { source: 'manual' }), /mongo down/);
    assert.equal(profile(), undefined);
    assert.equal(user().nutritionGoal.calorieGoal, 2000);
    assert.deepEqual(invalidated, []);
});

test('writeWithUser: bad LEGACY data never fails the request; legacy write done alone + logged', async () => {
    // A stored value the HealthProfile schema rejects (old data, not yet migrated).
    const { sync, profile, user, logs, invalidated } = setup({ user: legacyUser({ gender: 'robot' }) });
    const res = await sync.writeWithUser(USER, { body: { weightKg: 80 } }, nutritionPatch, { source: 'manual' });

    assert.equal(res.synced, false);
    assert.equal(profile(), undefined);
    assert.equal(user().profile.weight, 80);               // user's change still saved
    assert.equal(user().nutritionGoal.calorieGoal, 1800);
    assert.match(logs.error[0], /legacy write only/);
    assert.deepEqual(invalidated, [USER]);
});

test('writeWithUser: two first-ever writes at once both land (create race)', async () => {
    const { sync, profile, user } = setup();
    await Promise.all([
        sync.writeWithUser(USER, { body: { weightKg: 80 } }, {}, { source: 'manual' }),
        sync.writeWithUser(USER, { basic: { age: 40 } }, {}, { source: 'manual' }),
    ]);
    assert.equal(profile().body.weightKg, 80);
    assert.equal(profile().basic.age, 40);
    assert.equal(user().profile.weight, 80);
    assert.equal(user().profile.age, 40);
});

test('writeWithUser: unknown user is a 404, not a silent success', async () => {
    const { sync } = setup({ user: null });
    await assert.rejects(sync.writeWithUser(USER, { body: { weightKg: 80 } }, {}, { source: 'manual' }), { status: 404 });
});

test('kill switch off: old behaviour, no HealthProfile, no conflicting $set paths', async () => {
    const { sync, profile, user, patches, invalidated } = setup({ enabled: false });
    const res = await sync.writeWithUser(USER, goalFacts, nutritionPatch, { source: 'manual' });

    assert.equal(res.synced, false);
    assert.equal(profile(), undefined);
    assert.equal(user().profile.age, 33);
    assert.equal(user().profile.weight, 80);
    assert.equal(user().nutritionGoal.targetWeight, 72);
    // nutritionGoal and nutritionGoal.targetWeight in one $set is a Mongo error
    const $set = patches.at(-1).$set;
    assert.ok($set.nutritionGoal);
    assert.equal($set['nutritionGoal.targetWeight'], undefined);
    assert.deepEqual(invalidated, [USER]);
});

// ── onSignup ────────────────────────────────────────────────────────────────

test('onSignup: creates the profile from onboarding, source manual, User not rewritten', async () => {
    const { sync, profile, user, patches } = setup();
    const before = JSON.stringify(user());
    assert.equal(await sync.onSignup(USER, legacyUser()), true);
    assert.equal(profile().basic.meta.source, 'manual');
    assert.equal(profile().allergies.items[0].allergen, 'Peanut');
    assert.equal(JSON.stringify(user()), before);
    assert.ok(patches.every((p) => !p.$set && !p.$unset));
});

test('onSignup: never throws (already exists, missing user, bad data)', async () => {
    const a = setup();
    await a.sync.onSignup(USER, legacyUser());
    assert.equal(await a.sync.onSignup(USER, legacyUser()), false);
    assert.equal(a.logs.error.length, 0); // 409 is expected, not an error

    const b = setup({ user: null });
    assert.equal(await b.sync.onSignup(USER, legacyUser()), false);
    assert.equal(b.logs.error.length, 1);

    const c = setup({ user: legacyUser({ gender: 'robot' }) });
    assert.equal(await c.sync.onSignup(USER, legacyUser({ gender: 'robot' })), false);
    assert.equal(c.profile(), undefined);
});

test('onSignup: kill switch off does nothing', async () => {
    const { sync, profile } = setup({ enabled: false });
    assert.equal(await sync.onSignup(USER, legacyUser()), false);
    assert.equal(profile(), undefined);
});

// ── setDeviceWeight (smart scale) ───────────────────────────────────────────

test('setDeviceWeight: joins the caller transaction, applied only on its commit', async () => {
    const { sync, repo, profile, user, invalidated } = setup();
    await repo.withTransaction(async (session) => {
        await sync.setDeviceWeight(USER, '72.5', { session });
        assert.equal(profile(), undefined);   // not visible before commit
        assert.equal(user().profile.weight, 78);
    });
    assert.equal(profile().body.weightKg, 72.5);   // coerced to a number
    assert.equal(profile().body.meta.source, 'device');
    assert.equal(user().profile.weight, 72.5);
    assert.deepEqual(invalidated, []);             // caller clears caches after its commit
});

test('setDeviceWeight: caller transaction fails -> device weight rolled back too', async () => {
    const { sync, repo, profile, user } = setup();
    await assert.rejects(repo.withTransaction(async (session) => {
        await sync.setDeviceWeight(USER, 72.5, { session });
        throw new Error('later step in the sync failed');
    }), /later step/);
    assert.equal(profile(), undefined);
    assert.equal(user().profile.weight, 78);
});

test('setDeviceWeight: bad readings are skipped, never thrown', async () => {
    for (const bad of [0, -5, 900, 'abc', NaN]) {
        const { sync, profile, user, patches } = setup();
        assert.deepEqual(await sync.setDeviceWeight(USER, bad), { synced: false });
        assert.equal(profile(), undefined);
        assert.equal(user().profile.weight, 78);
        assert.equal(patches.length, 0);
    }
    const { sync, logs } = setup();
    await sync.setDeviceWeight(USER, null);
    assert.equal(logs.warn.length, 0); // no reading is not a warning
});

test('setDeviceWeight: without a session it runs its own transaction', async () => {
    const { sync, profile, user } = setup();
    assert.deepEqual(await sync.setDeviceWeight(USER, 74), { synced: true });
    assert.equal(profile().body.weightKg, 74);
    assert.equal(user().profile.weight, 74);
});

test('setDeviceWeight: bad legacy data -> legacy weight write only, sync not failed', async () => {
    const { sync, repo, profile, user, logs } = setup({ user: legacyUser({ gender: 'robot' }) });
    await repo.withTransaction(async (session) => {
        assert.deepEqual(await sync.setDeviceWeight(USER, 74, { session }), { synced: false });
    });
    assert.equal(profile(), undefined);
    assert.equal(user().profile.weight, 74);
    assert.equal(logs.error.length, 1);
});

test('setDeviceWeight: kill switch off -> legacy write only', async () => {
    const { sync, profile, user } = setup({ enabled: false });
    await sync.setDeviceWeight(USER, 74);
    assert.equal(profile(), undefined);
    assert.equal(user().profile.weight, 74);
});
