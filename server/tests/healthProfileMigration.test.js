/**
 * Migration logic (scripts/migrateHealthProfile.js): validation, idempotency,
 * dry run, and the User.profile vs HealthProfile fact check. No DB.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { createProfileWriteService } = require('../modules/health-profile/services/profileWriteService');
const { validateLegacy, compareFacts, migrateOne } = require('../modules/health-profile/services/profileMigration');
const { createMemoryProfileRepo } = require('./helpers/memoryProfileRepo');

const id = () => String(new mongoose.Types.ObjectId());

const legacy = (_id, overrides = {}) => ({
    _id,
    profile: {
        age: 41, gender: 'female', height: 160, weight: 62, dietaryPreference: 'vegetarian',
        allergies: ['Peanut', 'peanut ', 'Dust'],
        medicalHistory: { currentMedications: ['Thyroxine 50mcg'] },
        healthConditions: ['Thyroid'],
        ...overrides,
    },
});

function setup(users) {
    const repo = createMemoryProfileRepo({ users: Object.fromEntries(users.map((u) => [u._id, u])) });
    const service = createProfileWriteService({ repo, afterCommit: async () => {} });
    return { repo, service };
}

test('validateLegacy: good data is null, bad data lists the field and reason', () => {
    assert.equal(validateLegacy(legacy(id())), null);
    const reasons = validateLegacy(legacy(id(), { gender: 'robot', weight: 900 }));
    assert.equal(reasons.length, 2);
    assert.ok(reasons.some((r) => r.startsWith('basic.gender')));
    assert.ok(reasons.some((r) => r.startsWith('body.weightKg')));
});

test('validateLegacy: an empty or almost-empty user is still valid', () => {
    assert.equal(validateLegacy({ _id: id() }), null);
    assert.equal(validateLegacy({ _id: id(), profile: {} }), null);
    assert.equal(validateLegacy({ _id: id(), profile: { allergies: [], lifestyle: { waterGoalMl: 2000 } } }), null);
});

test('migrateOne: dry run writes nothing', async () => {
    const u = legacy(id());
    const { repo, service } = setup([u]);
    assert.deepEqual(await migrateOne(u, { existing: false, apply: false, service }), { status: 'would_create' });
    assert.equal(repo.state.profiles[u._id], undefined);
});

test('migrateOne: apply creates once; second run is "exists" and writes nothing', async () => {
    const u = legacy(id());
    const { repo, service } = setup([u]);
    assert.deepEqual(await migrateOne(u, { existing: false, apply: true, service }), { status: 'created' });
    assert.equal(repo.state.profiles[u._id].body.meta.source, 'migration');
    const historyBefore = repo.state.history.length;

    assert.deepEqual(await migrateOne(u, { existing: true, apply: true, service }), { status: 'exists' });
    // Even if the scan missed it (created by live traffic meanwhile): no second create.
    assert.deepEqual(await migrateOne(u, { existing: false, apply: true, service }), { status: 'exists' });
    assert.equal(repo.state.history.length, historyBefore);
});

test('migrateOne: invalid legacy data is reported, never written; User untouched', async () => {
    const u = legacy(id(), { gender: 'robot' });
    const { repo, service } = setup([u]);
    const before = JSON.stringify(repo.state.users[u._id]);
    const res = await migrateOne(u, { existing: false, apply: true, service });
    assert.equal(res.status, 'invalid');
    assert.match(res.reasons[0], /basic\.gender/);
    assert.equal(repo.state.profiles[u._id], undefined);
    assert.equal(JSON.stringify(repo.state.users[u._id]), before);
});

test('migrateOne: a DB error is reported as error (re-runnable), not thrown', async () => {
    const u = legacy(id());
    const service = { ensureProfile: async () => { throw new Error('socket hang up'); } };
    const res = await migrateOne(u, { existing: false, apply: true, service });
    assert.deepEqual(res, { status: 'error', reasons: ['socket hang up'] });
});

test('compareFacts: a migrated user matches its legacy data (dedupe and case ignored)', async () => {
    const u = legacy(id());
    const { repo, service } = setup([u]);
    await migrateOne(u, { existing: false, apply: true, service });
    assert.deepEqual(compareFacts(u, repo.state.profiles[u._id]), []);
});

test('compareFacts: still matches after app/chat edits go through the mirror', async () => {
    const u = legacy(id());
    const { repo, service } = setup([u]);
    await service.ensureProfile(u._id);
    await service.addItem(u._id, 'medications', { name: 'Metformin', dose: '500mg' }, { source: 'chat' });
    await service.updateSection(u._id, 'body', { weightKg: 60 }, { source: 'device' });
    assert.deepEqual(compareFacts(repo.state.users[u._id], repo.state.profiles[u._id]), []);
});

test('compareFacts: reports drift field by field', () => {
    const u = legacy(id());
    const hp = {
        basic: { age: 41, gender: 'female' },
        body: { heightCm: 160, weightKg: 70 },
        diet: { preference: 'vegetarian' },
        allergies: { items: [{ allergen: 'Peanut' }] },
        medications: { items: [{ name: 'Thyroxine', dose: '50mcg' }, { name: 'Old', active: false }] },
    };
    const diff = compareFacts(u, hp);
    assert.deepEqual(diff.map((d) => d.field).sort(), ['allergies', 'weight']);
    assert.equal(diff.find((d) => d.field === 'weight').profile, 70);
});
