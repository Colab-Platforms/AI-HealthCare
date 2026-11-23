/**
 * ProfileWriteService rules: transaction + mirror + history, run against an
 * in-memory repo (no DB). Covers rollback, conflicts, concurrency and undo.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { createProfileWriteService } = require('../modules/health-profile/services/profileWriteService');
const { createMemoryProfileRepo } = require('./helpers/memoryProfileRepo');

const USER = String(new mongoose.Types.ObjectId());

const legacyUser = () => ({
    _id: USER,
    profile: {
        age: 32, gender: 'male', height: 175, weight: 78,
        dietaryPreference: 'vegetarian',
        allergies: ['Peanut'],
        isDiabetic: 'yes',
        medicalHistory: { currentMedications: [] },
        lifestyle: { smoker: false, waterGoalMl: 2500, stepGoal: 8000 },
    },
    nutritionGoal: { targetWeight: 70 },
});

function setup() {
    const repo = createMemoryProfileRepo({ users: { [USER]: legacyUser() } });
    const committed = [];
    const svc = createProfileWriteService({ repo, afterCommit: async (u, s) => { committed.push(s); } });
    return { repo, svc, committed, profile: () => repo.state.profiles[USER], user: () => repo.state.users[USER] };
}

test('first write on an unmigrated user builds the profile from legacy data', async () => {
    const { svc, profile, user, repo } = setup();
    await svc.updateSection(USER, 'body', { weightKg: 76 }, { source: 'manual' });

    assert.equal(profile().version, 1);
    assert.equal(profile().body.weightKg, 76);
    assert.equal(profile().allergies.items[0].allergen, 'Peanut'); // legacy facts kept
    assert.equal(user().profile.weight, 76);                        // mirrored
    assert.equal(user().profile.lifestyle.waterGoalMl, 2500);       // app setting untouched
    assert.deepEqual(repo.state.history.map((h) => h.action), ['create', 'set']);
});

test('no-op update does not bump version, mirror or history', async () => {
    const { svc, profile, repo, committed } = setup();
    await svc.updateSection(USER, 'body', { weightKg: 76 }, { source: 'manual' });
    const res = await svc.updateSection(USER, 'body', { weightKg: 76 }, { source: 'manual' });
    assert.equal(res.changed, false);
    assert.equal(profile().version, 1);
    assert.equal(repo.state.history.length, 2);
    assert.equal(committed.length, 1);
});

test('unknown section, unknown field and bad source are rejected with 400', async () => {
    const { svc } = setup();
    await assert.rejects(svc.updateSection(USER, 'wallet', { x: 1 }, { source: 'manual' }), { status: 400 });
    await assert.rejects(svc.updateSection(USER, 'body', { shoeSize: 9 }, { source: 'manual' }), { status: 400 });
    await assert.rejects(svc.updateSection(USER, 'body', { weightKg: 70 }, { source: 'hacker' }), { status: 400 });
});

test('updateSections: several sections, one version, mirror only for changed sections', async () => {
    const { svc, profile, user, repo, committed } = setup();
    await svc.updateSection(USER, 'body', { weightKg: 76 }, { source: 'manual' });
    await svc.updateSections(USER, { basic: { age: 33 }, body: { weightKg: 76 }, goals: { targetWeightKg: 68 } }, { source: 'manual' });

    assert.equal(profile().version, 2);
    assert.equal(profile().basic.age, 33);
    assert.equal(user().profile.age, 33);
    assert.equal(user().nutritionGoal.targetWeight, 68);
    // body was unchanged: no history entry, and only changed sections mirrored
    assert.deepEqual(repo.state.history.filter((h) => h.profileVersion === 2).map((h) => h.field).sort(), ['basic.age', 'goals.targetWeightKg']);
    assert.deepEqual(committed.at(-1).sort(), ['basic', 'goals']);
});

test('updateSections: bad input rejected with 400 before anything is written', async () => {
    const { svc, profile } = setup();
    await assert.rejects(svc.updateSections(USER, {}, { source: 'manual' }), { status: 400 });
    await assert.rejects(svc.updateSections(USER, null, { source: 'manual' }), { status: 400 });
    await assert.rejects(svc.updateSections(USER, { body: { weightKg: 70 }, wallet: { x: 1 } }, { source: 'manual' }), { status: 400 });
    await assert.rejects(svc.updateSections(USER, { body: { weightKg: 70 }, basic: { shoe: 9 } }, { source: 'manual' }), { status: 400 });
    await assert.rejects(svc.updateSections(USER, { body: [70] }, { source: 'manual' }), { status: 400 });
    await assert.rejects(svc.updateSections(USER, { allergies: { x: 1 } }, { source: 'manual' }), { status: 400 });
    assert.equal(profile(), undefined);
});

test('updateSections: one invalid value rolls back the other sections too', async () => {
    const { svc, profile, user } = setup();
    await assert.rejects(svc.updateSections(USER, { basic: { age: 33 }, body: { weightKg: 900 } }, { source: 'manual' }), { status: 400 });
    assert.equal(profile(), undefined);
    assert.equal(user().profile.age, 32);
});

test('schema violation rolls back everything', async () => {
    const { svc, profile, user, repo, committed } = setup();
    await assert.rejects(svc.updateSection(USER, 'basic', { gender: 'robot' }, { source: 'chat' }), { status: 400 });
    assert.equal(profile(), undefined);
    assert.equal(user().profile.gender, 'male');
    assert.equal(repo.state.history.length, 0);
    assert.equal(committed.length, 0);
});

test('mirror failure rolls back the profile and history (no half saves)', async () => {
    const { svc, profile, repo } = setup();
    repo.failures.patchUser = new Error('mongo down');
    await assert.rejects(svc.updateSection(USER, 'body', { weightKg: 70 }, { source: 'manual' }), /mongo down/);
    assert.equal(profile(), undefined);
    assert.equal(repo.state.history.length, 0);
});

test('addItem saves, mirrors, and a case-insensitive duplicate updates instead of adding', async () => {
    const { svc, profile, user } = setup();
    const { value: id } = await svc.addItem(USER, 'medications', { name: 'Metformin', dose: '500mg' }, { source: 'chat' });
    assert.ok(id);
    assert.deepEqual(user().profile.medicalHistory.currentMedications, ['Metformin 500mg']);
    assert.equal(profile().medications.state, 'has_items');

    await svc.addItem(USER, 'medications', { name: 'metformin', dose: '1000mg' }, { source: 'chat' });
    assert.equal(profile().medications.items.length, 1);
    // Stored spelling kept ("Metformin"), only the dose changed.
    assert.deepEqual(user().profile.medicalHistory.currentMedications, ['Metformin 1000mg']);
});

test('addItem requires the key field', async () => {
    const { svc } = setup();
    await assert.rejects(svc.addItem(USER, 'allergies', { severity: 'severe' }, { source: 'chat' }), { status: 400 });
});

test('markNone is refused while items exist, allowed when empty', async () => {
    const { svc, profile, user } = setup();
    await assert.rejects(svc.markNone(USER, 'allergies', { source: 'chat' }), { status: 400 });
    await svc.markNone(USER, 'medications', { source: 'chat' });
    assert.equal(profile().medications.state, 'none');
    assert.deepEqual(user().profile.medicalHistory.currentMedications, []);
});

test('removing the last item sets state back to missing, not none', async () => {
    const { svc, profile, user } = setup();
    await svc.updateSection(USER, 'body', { weightKg: 77 }, { source: 'manual' }); // creates profile
    const peanut = profile().allergies.items[0];
    await svc.removeItem(USER, 'allergies', peanut._id, { source: 'manual' });
    assert.equal(profile().allergies.state, 'missing');
    assert.deepEqual(user().profile.allergies, []);
});

test('stale expectedVersion is rejected with 409', async () => {
    const { svc } = setup();
    await svc.updateSection(USER, 'body', { weightKg: 77 }, { source: 'manual' });
    await svc.updateSection(USER, 'body', { weightKg: 76 }, { source: 'manual' });
    await assert.rejects(
        svc.updateSection(USER, 'body', { weightKg: 75 }, { source: 'manual', expectedVersion: 1 }),
        { status: 409 },
    );
});

test('two concurrent writes both land (no lost update)', async () => {
    const { svc, profile, user } = setup();
    await Promise.all([
        svc.addItem(USER, 'medications', { name: 'Metformin' }, { source: 'chat' }),
        svc.addItem(USER, 'medications', { name: 'Thyroxine' }, { source: 'manual' }),
    ]);
    assert.deepEqual(profile().medications.items.map((m) => m.name).sort(), ['Metformin', 'Thyroxine']);
    assert.deepEqual([...user().profile.medicalHistory.currentMedications].sort(), ['Metformin', 'Thyroxine']);
});

test('undo of a chat-added item removes it and restores the mirror', async () => {
    const { svc, profile, user, repo } = setup();
    await svc.markNone(USER, 'medications', { source: 'chat' });
    await svc.addItem(USER, 'medications', { name: 'Metformin' }, { source: 'chat' });
    const addEntry = repo.state.history.find((h) => h.action === 'add_item');

    await svc.undo(USER, addEntry._id);
    assert.equal(profile().medications.items.length, 0);
    assert.equal(profile().medications.state, 'none'); // back to what it was
    assert.deepEqual(user().profile.medicalHistory.currentMedications, []);
    assert.ok(repo.state.history.find((h) => h._id === addEntry._id).undoneAt);
});

test('undo of a set restores the old value; an older change cannot be undone over a newer one', async () => {
    const { svc, profile, repo } = setup();
    await svc.updateSection(USER, 'body', { weightKg: 76 }, { source: 'manual' });
    await svc.updateSection(USER, 'body', { weightKg: 74 }, { source: 'manual' });
    const [first, second] = repo.state.history.filter((h) => h.action === 'set');

    await assert.rejects(svc.undo(USER, first._id), { status: 400 });
    await svc.undo(USER, second._id);
    assert.equal(profile().body.weightKg, 76);
    await svc.undo(USER, first._id); // now it is the latest active change
    assert.equal(profile().body.weightKg, 78);
});

test('createFromOnboarding creates once, does not rewrite User, and refuses a second create', async () => {
    const { svc, profile, user, repo } = setup();
    const before = JSON.stringify(user());
    await svc.createFromOnboarding(USER, legacyUser(), { source: 'manual' });
    assert.equal(profile().basic.meta.source, 'manual');
    assert.equal(JSON.stringify(user()), before);
    assert.deepEqual(repo.state.history.map((h) => h.action), ['create']);
    await assert.rejects(svc.createFromOnboarding(USER, legacyUser(), { source: 'manual' }), { status: 409 });
});

test('cache invalidation runs after commit only, and not inside a caller transaction', async () => {
    const { svc, committed } = setup();
    await svc.updateSection(USER, 'body', { weightKg: 76 }, { source: 'manual' });
    assert.deepEqual(committed, [['body']]);
    // Inside a caller's transaction: nothing is applied or invalidated until the caller commits.
    const outer = { ops: [] };
    await svc.updateSection(USER, 'body', { weightKg: 75 }, { source: 'manual', session: outer });
    assert.equal(committed.length, 1);
    assert.ok(outer.ops.length > 0);
});
