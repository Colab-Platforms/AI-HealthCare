/**
 * 5b: old app versions edit User.profile through PUT /api/auth/profile;
 * syncFromLegacy brings that into HealthProfile without losing what the
 * legacy copy can't hold. Each test: build the profile, simulate what the old
 * app saves (it re-sends the mirror it was shown, with the user's edit), sync.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { createProfileWriteService } = require('../modules/health-profile/services/profileWriteService');
const { createProfileSync } = require('../modules/health-profile/services/profileSync');
const { compareFacts } = require('../modules/health-profile/services/profileMigration');
const { createMemoryProfileRepo } = require('./helpers/memoryProfileRepo');

const USER = String(new mongoose.Types.ObjectId());

async function setup(profileOverrides = {}) {
    const repo = createMemoryProfileRepo({
        users: {
            [USER]: {
                _id: USER,
                profile: {
                    age: 45, gender: 'male', height: 172, weight: 80,
                    allergies: ['Peanut'],
                    medicalHistory: { currentMedications: [] },
                    lifestyle: { smoker: false, alcohol: false, waterGoalMl: 2500 },
                    ...profileOverrides,
                },
                nutritionGoal: { targetWeight: 72, calorieGoal: 2000 },
            },
        },
    });
    const svc = createProfileWriteService({ repo, afterCommit: async () => {} });
    await svc.ensureProfile(USER);
    const legacyProfile = () => repo.state.users[USER].profile;
    // What the old app does: change some fields of the profile it has, save it whole.
    const oldAppSaves = (mutate) => mutate(repo.state.users[USER]);
    return { repo, svc, legacyProfile, oldAppSaves, hp: () => repo.state.profiles[USER], history: () => repo.state.history };
}

const peanutWithDetails = async ({ svc }) => {
    await svc.addItem(USER, 'allergies', { allergen: 'Peanut', severity: 'severe', type: 'food', reaction: 'swelling' }, { source: 'chat' });
};

test('old app re-sends what it was shown: no change, no history', async () => {
    const t = await setup();
    await peanutWithDetails(t);
    await t.svc.addItem(USER, 'medications', { name: 'Metformin', dose: '500mg' }, { source: 'manual' });
    const before = t.history().length;
    const res = await t.svc.syncFromLegacy(USER);
    assert.equal(res.changed, false);
    assert.equal(t.history().length, before);
});

test('scalar edit: weight changed in the old app lands in HealthProfile', async () => {
    const t = await setup();
    t.oldAppSaves((u) => { u.profile.weight = 77; });
    const res = await t.svc.syncFromLegacy(USER);
    assert.equal(res.changed, true);
    assert.equal(t.hp().body.weightKg, 77);
    assert.equal(t.hp().body.meta.source, 'manual');
    assert.deepEqual(t.history().at(-1), { ...t.history().at(-1), field: 'body.weightKg', action: 'set', oldValue: 80, newValue: 77 });
});

test('list edit: added allergy is new; existing one keeps severity/reaction', async () => {
    const t = await setup();
    await peanutWithDetails(t);
    t.oldAppSaves((u) => { u.profile.allergies = ['Peanut', 'Shellfish']; });
    await t.svc.syncFromLegacy(USER);
    const items = t.hp().allergies.items;
    assert.equal(items.length, 2);
    const peanut = items.find((i) => i.allergen === 'Peanut');
    assert.equal(peanut.severity, 'severe');
    assert.equal(peanut.reaction, 'swelling');
    assert.ok(items.find((i) => i.allergen === 'Shellfish')._id);
});

test('list edit: removed allergy is removed, and can be undone', async () => {
    const t = await setup();
    await peanutWithDetails(t);
    t.oldAppSaves((u) => { u.profile.allergies = []; });
    await t.svc.syncFromLegacy(USER);
    assert.equal(t.hp().allergies.items.length, 0);
    assert.equal(t.hp().allergies.state, 'missing');
    const removal = t.history().find((h) => h.action === 'remove_item');
    await t.svc.undo(USER, removal._id);
    assert.equal(t.hp().allergies.items[0].severity, 'severe');
    assert.deepEqual(t.legacyProfile().allergies, ['Peanut']);
});

test('medicines: "Metformin 500mg" round-trip keeps the dose split; a new dose replaces it', async () => {
    const t = await setup();
    await t.svc.addItem(USER, 'medications', { name: 'Metformin', dose: '500mg', frequency: 'twice_daily' }, { source: 'manual' });
    t.oldAppSaves((u) => { u.profile.medicalHistory.currentMedications = ['Metformin 500mg', 'Thyroxine 50mcg']; });
    await t.svc.syncFromLegacy(USER);
    const metformin = t.hp().medications.items.find((m) => m.name === 'Metformin');
    assert.equal(metformin.dose, '500mg');
    assert.equal(metformin.frequency, 'twice_daily');
    assert.ok(t.hp().medications.items.some((m) => m.name === 'Thyroxine 50mcg'));

    t.oldAppSaves((u) => { u.profile.medicalHistory.currentMedications = ['Metformin 1000mg', 'Thyroxine 50mcg']; });
    await t.svc.syncFromLegacy(USER);
    const names = t.hp().medications.items.map((m) => m.name).sort();
    assert.deepEqual(names, ['Metformin 1000mg', 'Thyroxine 50mcg']);
});

test('hidden items survive: resolved conditions and stopped medicines are never removed by the old app', async () => {
    const t = await setup();
    await t.svc.addItem(USER, 'conditions', { name: 'Tuberculosis', status: 'resolved' }, { source: 'manual' });
    await t.svc.addItem(USER, 'medications', { name: 'Old Med', active: false }, { source: 'manual' });
    t.oldAppSaves((u) => {
        u.profile.chronicConditions = ['Asthma'];
        u.profile.medicalHistory.currentMedications = ['Inhaler'];
    });
    await t.svc.syncFromLegacy(USER);
    assert.deepEqual(t.hp().conditions.items.map((c) => c.name).sort(), ['Asthma', 'Tuberculosis']);
    assert.deepEqual(t.hp().medications.items.map((m) => m.name).sort(), ['Inhaler', 'Old Med']);
});

test('conditions: "Type 2 Diabetes" is not downgraded when the old app adds Hypertension', async () => {
    const t = await setup();
    await t.svc.addItem(USER, 'conditions', { name: 'Type 2 Diabetes', status: 'controlled', diagnosedYear: 2019 }, { source: 'manual' });
    assert.deepEqual(t.legacyProfile().healthConditions, ['Diabetes']);
    t.oldAppSaves((u) => { u.profile.healthConditions = ['Diabetes', 'Hypertension']; });
    await t.svc.syncFromLegacy(USER);
    const names = t.hp().conditions.items.map((c) => c.name).sort();
    assert.deepEqual(names, ['Hypertension', 'Type 2 Diabetes']);
    assert.equal(t.hp().conditions.items.find((c) => c.name === 'Type 2 Diabetes').diagnosedYear, 2019);
});

test('lossy values: smoking "never" survives an unrelated lifestyle edit; a real change applies', async () => {
    const t = await setup();
    await t.svc.updateSection(USER, 'lifestyle', { smoking: 'never' }, { source: 'chat' });
    t.oldAppSaves((u) => { u.profile.lifestyle.stressLevel = 'high'; });
    await t.svc.syncFromLegacy(USER);
    assert.equal(t.hp().lifestyle.smoking, 'never');
    assert.equal(t.hp().lifestyle.stressLevel, 'high');

    t.oldAppSaves((u) => { u.profile.lifestyle.smoker = true; });
    await t.svc.syncFromLegacy(USER);
    assert.equal(t.hp().lifestyle.smoking, 'current');
});

test('fields with no legacy copy are kept (city, waist, chat goals)', async () => {
    const t = await setup();
    await t.svc.updateSections(USER, {
        basic: { city: 'Pune' },
        body: { waistCm: 90 },
        goals: { primary: ['Better Sleep', 'Run a 10k'], timeline: '6 months' },
    }, { source: 'chat' });
    t.oldAppSaves((u) => {
        u.profile.age = 46;
        u.profile.weight = 79;
        u.profile.goals = ['Better Sleep', 'Heart Health'];
    });
    await t.svc.syncFromLegacy(USER);
    assert.equal(t.hp().basic.city, 'Pune');
    assert.equal(t.hp().basic.age, 46);
    assert.equal(t.hp().body.waistCm, 90);
    assert.deepEqual(t.hp().goals.primary.sort(), ['Better Sleep', 'Heart Health', 'Run a 10k']);
    assert.equal(t.hp().goals.timeline, '6 months');
});

test('"none" is not lost when the old app sends [] back; "None of these" marks conditions none', async () => {
    const t = await setup({ allergies: [] });
    await t.svc.markNone(USER, 'allergies', { source: 'chat' });
    t.oldAppSaves((u) => { u.profile.weight = 79; }); // allergies still []
    await t.svc.syncFromLegacy(USER);
    assert.equal(t.hp().allergies.state, 'none');

    t.oldAppSaves((u) => { u.profile.healthConditions = ['None of these']; });
    await t.svc.syncFromLegacy(USER);
    assert.equal(t.hp().conditions.state, 'none');
});

// 26 Nov: User.nutritionGoal is removed. The profile form's target weight goes
// to goals.targetWeightKg through writeWithUser (authController.updateProfile),
// not through a legacy-field sync, so a stale old field is ignored here.
test('legacy sync ignores the old nutritionGoal.targetWeight (no legacy copy of the target weight)', async () => {
    const t = await setup();
    const before = t.hp().goals?.targetWeightKg;
    t.oldAppSaves((u) => { u.nutritionGoal = { ...(u.nutritionGoal || {}), targetWeight: 70 }; });
    await t.svc.syncFromLegacy(USER);
    assert.equal(t.hp().goals?.targetWeightKg, before);
});

test('self-healing: earlier missed syncs are all caught by the next one; facts match after', async () => {
    const t = await setup();
    t.oldAppSaves((u) => { u.profile.weight = 75; u.profile.allergies = ['Peanut', 'Dust']; });
    t.oldAppSaves((u) => { u.profile.gender = 'female'; }); // two edits, no sync in between
    await t.svc.syncFromLegacy(USER);
    assert.deepEqual(compareFacts(t.repo.state.users[USER], t.hp()), []);
    assert.equal((await t.svc.syncFromLegacy(USER)).changed, false); // idempotent
});

test('bridge: never throws (unknown user, bad legacy data, kill switch off)', async () => {
    const t = await setup();
    const errors = [];
    const logger = { error: (m) => errors.push(m), warn: () => {} };
    const on = createProfileSync({ service: t.svc, repo: t.repo, logger, invalidate: async () => {}, enabled: () => true });

    assert.deepEqual(await on.syncLegacyEdit(String(new mongoose.Types.ObjectId())), { synced: false });
    t.oldAppSaves((u) => { u.profile.gender = 'robot'; });
    assert.deepEqual(await on.syncLegacyEdit(USER), { synced: false });
    assert.equal(errors.length, 2);
    assert.match(errors[1], /does not fit the schema/);

    const off = createProfileSync({ service: t.svc, repo: t.repo, logger, invalidate: async () => {}, enabled: () => false });
    t.oldAppSaves((u) => { u.profile.gender = 'male'; u.profile.weight = 70; });
    assert.deepEqual(await off.syncLegacyEdit(USER), { synced: false });
    assert.equal(t.hp().body.weightKg, 80);

    const res = await on.syncLegacyEdit(USER);
    assert.equal(res.synced, true);
    assert.deepEqual(res.sections, ['body']);
});
