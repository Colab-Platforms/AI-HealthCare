/**
 * HealthProfile is the only source of health facts (26 Nov):
 *   - reads: User.profile's health keys are built from HealthProfile
 *     (profileView / overlayDocs), app settings kept as stored;
 *   - writes (HEALTH_PROFILE_ONLY=true): health keys never reach the User
 *     document (save / update stripped), $unset still allowed;
 *   - the old app's profile edit syncs from what the request sent.
 * No DB: models are mocked.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { profileView, overlayDocs, withProfile, isOverlaid, userIdsMatching } = require('../modules/health-profile/services/profileReadService');
const { HEALTH_PATHS, stripUpdate, wantsProfile } = require('../modules/health-profile/services/userProfilePlugin');

const ID = new mongoose.Types.ObjectId();
const HP = {
    user: ID,
    basic: { age: 67, gender: 'female' },
    body: { heightCm: 158, weightKg: 85 },
    conditions: { state: 'has_items', items: [{ name: 'Type 2 Diabetes', status: 'active' }, { name: 'Hypertension', status: 'active' }] },
    medications: { items: [{ name: 'Metformin', dose: '500mg', active: true }, { name: 'Old pill', active: false }] },
    allergies: { items: [{ allergen: 'Peanut' }] },
    lifestyle: { smoking: 'no', alcohol: 'current', activityLevel: 'lightly_active', profession: 'retired' },
    diet: { preference: 'eggetarian' },
    goals: { primary: ['lose_weight'] },
};
const fakeHP = (doc = HP) => ({
    findOne: () => ({ select: () => ({ lean: async () => doc }) }),
    find: () => ({ select: () => ({ lean: async () => (doc ? [doc] : []) }) }),
});

test('profileView: health keys from HealthProfile, app settings as stored, stale stored facts replaced', () => {
    const stored = {
        age: 60, weight: 90, allergies: ['Dust'], avatar: 'a.png',
        lifestyle: { smoker: true, waterGoalMl: 2500, stepGoal: 9000, sleepGoalHours: 7.5 },
        medicalHistory: { conditions: ['old junk'] },
    };
    const v = profileView(stored, HP);
    assert.equal(v.age, 67);
    assert.equal(v.gender, 'female');
    assert.equal(v.height, 158);
    assert.equal(v.weight, 85);
    assert.deepEqual(v.allergies, ['Peanut']);
    assert.equal(v.isDiabetic, 'yes');
    assert.deepEqual(v.healthConditions, ['Diabetes', 'Hypertension']);
    assert.deepEqual(v.medicalHistory.currentMedications, ['Metformin 500mg']); // inactive not shown
    assert.deepEqual(v.medicalHistory.conditions, []);
    assert.equal(v.lifestyle.smoker, false);
    assert.equal(v.lifestyle.alcohol, true);
    assert.equal(v.activityLevel, 'lightly_active');
    assert.equal(v.dietaryPreference, 'eggetarian');
    // app settings untouched
    assert.equal(v.avatar, 'a.png');
    assert.equal(v.lifestyle.waterGoalMl, 2500);
    assert.equal(v.lifestyle.stepGoal, 9000);
    assert.equal(v.lifestyle.sleepGoalHours, 7.5);
    // input not mutated
    assert.equal(stored.age, 60);
    // no HealthProfile -> stored kept
    assert.equal(profileView(stored, null).age, 60);
});

test('profileView: a query that selected only some profile keys gets only those (no medicines for profile.avatar)', () => {
    const avatarOnly = profileView({ avatar: 'a.png' }, HP, ['avatar']);
    assert.deepEqual(avatarOnly, { avatar: 'a.png' });
    const some = profileView({}, HP, ['gender', 'isDiabetic', 'lifestyle']);
    assert.equal(some.gender, 'female');
    assert.equal(some.isDiabetic, 'yes');
    assert.equal(some.lifestyle.alcohol, true);
    assert.equal(some.age, undefined);
    assert.equal(some.medicalHistory, undefined);
    const nested = profileView({}, HP, ['medicalHistory.currentMedications']);
    assert.deepEqual(nested.medicalHistory, { currentMedications: ['Metformin 500mg'] });
});

test('profileView: works when nothing is stored (health keys removed from User)', () => {
    const v = profileView(undefined, HP);
    assert.equal(v.age, 67);
    assert.deepEqual(v.allergies, ['Peanut']);
});

test('overlayDocs: lean objects in place, marked; second call reads nothing', async () => {
    const user = { _id: ID, profile: { age: 1, avatar: 'x' } };
    let reads = 0;
    const HealthProfile = { ...fakeHP(), findOne: () => { reads++; return fakeHP().findOne(); } };
    await overlayDocs([user], { HealthProfile });
    assert.equal(user.profile.age, 67);
    assert.equal(user.profile.avatar, 'x');
    assert.ok(isOverlaid(user));
    await overlayDocs([user], { HealthProfile });
    const same = await withProfile(user, { HealthProfile });
    assert.equal(reads, 1);
    assert.equal(same, user);
});

test('overlayDocs: a Mongoose document gets the values without being marked modified', async () => {
    const User = require('../models/User');
    const doc = User.hydrate({ _id: ID, name: 'B', email: 'b@example.invalid', profile: { age: 1, lifestyle: { stepGoal: 8000 } } });
    await overlayDocs([doc], { HealthProfile: fakeHP() });
    assert.equal(doc.profile.age, 67);
    assert.equal(doc.toObject().profile.weight, 85);
    assert.equal(doc.profile.lifestyle.stepGoal, 8000);
    assert.equal(doc.isModified('profile'), false);
    assert.equal(doc.isModified('profile.age'), false);
});

test('wantsProfile: only queries that return profile are filled', () => {
    const q = (projection, options = {}) => ({ projection: () => projection, getOptions: () => options });
    assert.equal(wantsProfile(q(undefined)), true);
    assert.equal(wantsProfile(q({ password: 0 })), true);
    assert.deepEqual(wantsProfile(q({ 'profile.age': 1, 'profile.lifestyle': 1, name: 1 })), ['profile.age', 'profile.lifestyle']);
    assert.deepEqual(wantsProfile(q({ foodPreferences: 1 })), ['foodPreferences']);
    assert.deepEqual(wantsProfile(q({ profile: 1, name: 1 })), ['profile']); // foodPreferences not selected: not filled
    assert.equal(wantsProfile(q({ name: 1, email: 1 })), false);
    assert.equal(wantsProfile(q({ profile: 0 })), true); // foodPreferences still returned
    assert.equal(wantsProfile(q({ profile: 0, foodPreferences: 0 })), false);
    assert.equal(wantsProfile(q(undefined, { skipProfileOverlay: true })), false);
});

test('stripUpdate: health keys removed from every write, app settings and $unset kept', () => {
    const u = {
        $set: {
            'profile.age': 30, 'profile.allergies': ['x'], 'profile.lifestyle.waterGoalMl': 2500, name: 'n',
            'profile.lifestyle': { smoker: true, stepGoal: 9000 },
            'profile.medicalHistory': { conditions: ['a'], currentMedications: ['m'] },
        },
        $unset: { 'profile.weight': '' },
        $push: { 'profile.allergies': 'y' },
    };
    stripUpdate(u);
    assert.deepEqual(u.$set, { 'profile.lifestyle.waterGoalMl': 2500, name: 'n', 'profile.lifestyle': { stepGoal: 9000 }, 'profile.medicalHistory': {} });
    assert.deepEqual(u.$unset, { 'profile.weight': '' });
    assert.equal(u.$push, undefined);
    const whole = { profile: { age: 3, avatar: 'a', lifestyle: { alcohol: true, sleepGoalHours: 8 } } };
    stripUpdate(whole);
    assert.deepEqual(whole, { profile: { avatar: 'a', lifestyle: { sleepGoalHours: 8 } } });
    assert.ok(HEALTH_PATHS.includes('medicalHistory.currentMedications'));
    assert.ok(!HEALTH_PATHS.includes('lifestyle.waterGoalMl'));
});

test('save with HEALTH_PROFILE_ONLY=true: the document keeps no health keys', async (t) => {
    const User = require('../models/User');
    const prev = process.env.HEALTH_PROFILE_ONLY;
    process.env.HEALTH_PROFILE_ONLY = 'true';
    t.after(() => { process.env.HEALTH_PROFILE_ONLY = prev; });
    const doc = new User({ name: 'N', email: 'n@example.invalid', password: 'Secret123!', profile: { age: 30, allergies: ['Peanut'], lifestyle: { smoker: true, stepGoal: 7000 } } });
    let saved;
    t.mock.method(doc.collection, 'insertOne', async (obj) => { saved = obj; return { acknowledged: true, insertedId: obj._id }; });
    await doc.save();
    assert.equal(saved.profile.age, undefined);
    assert.equal(saved.profile.allergies, undefined);
    assert.equal(saved.profile.lifestyle.smoker, undefined);
    assert.equal(saved.profile.lifestyle.stepGoal, 7000);
});

test('save with the flag off: unchanged (mirror still written during rollout)', async (t) => {
    const User = require('../models/User');
    const prev = process.env.HEALTH_PROFILE_ONLY;
    delete process.env.HEALTH_PROFILE_ONLY;
    t.after(() => { if (prev !== undefined) process.env.HEALTH_PROFILE_ONLY = prev; });
    const doc = new User({ name: 'N', email: 'm@example.invalid', password: 'Secret123!', profile: { age: 30 } });
    let saved;
    t.mock.method(doc.collection, 'insertOne', async (obj) => { saved = obj; return { acknowledged: true, insertedId: obj._id }; });
    await doc.save();
    assert.equal(saved.profile.age, 30);
});

test('userIdsMatching: admin filters become HealthProfile queries; none -> null', async () => {
    let query;
    const HealthProfile = { find: (q) => { query = q; return { select: () => ({ lean: async () => [{ user: ID }] }) }; } };
    assert.equal(await userIdsMatching({}, { HealthProfile }), null);
    const ids = await userIdsMatching({ ageMin: '60', gender: 'female', isDiabetic: 'yes', dietaryPreference: 'eggetarian', activityLevel: 'lightly_active' }, { HealthProfile });
    assert.deepEqual(ids, [ID]);
    assert.deepEqual(query['basic.age'], { $gte: 60 });
    assert.equal(query['basic.gender'], 'female');
    assert.equal(query['diet.preference'], 'eggetarian');
    assert.equal(query['lifestyle.activityLevel'], 'lightly_active');
    assert.ok(query['conditions.items'].$elemMatch);
    await userIdsMatching({ genderPrefix: 'fe(' }, { HealthProfile });
    assert.equal(query['basic.gender'].$regex, '^fe\\(');
    await userIdsMatching({ isDiabetic: 'no' }, { HealthProfile });
    assert.ok(query['conditions.items'].$not);
});

// ── production risks (26 Nov) ───────────────────────────────────────────────

function withFlag(t, value) {
    const prev = process.env.HEALTH_PROFILE_ONLY;
    if (value === undefined) delete process.env.HEALTH_PROFILE_ONLY; else process.env.HEALTH_PROFILE_ONLY = value;
    t.after(() => { if (prev === undefined) delete process.env.HEALTH_PROFILE_ONLY; else process.env.HEALTH_PROFILE_ONLY = prev; });
}

test('cache: repeated reads of the same user hit Mongo once; a profile write clears it', async (t) => {
    withFlag(t, 'true'); // read even without a live connection (the model is mocked)
    const HealthProfile = require('../modules/health-profile/models/HealthProfile');
    const { loadProfile, invalidateProfileCache } = require('../modules/health-profile/services/profileReadService');
    const id = String(new mongoose.Types.ObjectId());
    let reads = 0;
    t.mock.method(HealthProfile, 'findOne', () => { reads++; return { select: () => ({ lean: async () => ({ ...HP, user: id }) }) }; });
    t.mock.method(HealthProfile.collection, 'indexes', async () => [{ key: { user: 1 }, unique: true }]);
    assert.equal((await loadProfile(id)).basic.age, 67);
    await loadProfile(id);
    await loadProfile(id);
    assert.equal(reads, 1);
    invalidateProfileCache(id);
    await loadProfile(id);
    assert.equal(reads, 2);
});

test('cache: "no HealthProfile" is cached too (no repeated misses)', async (t) => {
    withFlag(t, 'true');
    const HealthProfile = require('../modules/health-profile/models/HealthProfile');
    const { loadProfile } = require('../modules/health-profile/services/profileReadService');
    const id = String(new mongoose.Types.ObjectId());
    let reads = 0;
    t.mock.method(HealthProfile, 'findOne', () => { reads++; return { select: () => ({ lean: async () => null }) }; });
    assert.equal(await loadProfile(id), null);
    assert.equal(await loadProfile(id), null);
    assert.equal(reads, 1);
});

test('read failure: HEALTH_PROFILE_ONLY on -> the request fails (never an empty "no allergies" profile); off -> stored copy used', async (t) => {
    const { loadProfiles } = require('../modules/health-profile/services/profileReadService');
    const broken = { findOne: () => ({ select: () => ({ lean: async () => { throw new Error('db down'); } }) }) };
    withFlag(t, 'true');
    await assert.rejects(loadProfiles(['a'], { HealthProfile: broken }), /db down/);
    process.env.HEALTH_PROFILE_ONLY = 'false';
    const errors = [];
    const m = await loadProfiles(['a'], { HealthProfile: broken, logger: { error: (e) => errors.push(e) } });
    assert.equal(m.size, 0);
    assert.match(errors[0], /stored profile used/);
});

test('save with HEALTH_PROFILE_ONLY: a document filled by the read hook and saved for another reason keeps its in-memory facts and writes none', async (t) => {
    withFlag(t, 'true');
    const User = require('../models/User');
    const doc = User.hydrate({ _id: ID, name: 'B', email: 'b@example.invalid', password: 'hashed', profile: { lifestyle: { stepGoal: 8000 } } });
    await overlayDocs([doc], { HealthProfile: fakeHP() });
    doc.lastLogin = new Date();
    let update;
    t.mock.method(doc.collection, 'updateOne', async (_f, u) => { update = u; return { acknowledged: true, matchedCount: 1, modifiedCount: 1 }; });
    await doc.save();
    assert.equal(doc.profile.age, 67); // still there for the rest of the request
    const written = Object.keys(update.$set || {}).filter((k) => k.startsWith('profile.'));
    const health = written.filter((k) => HEALTH_PATHS.some((p) => k === `profile.${p}` || k.startsWith(`profile.${p}.`)));
    assert.deepEqual(health, [], JSON.stringify(written)); // app-setting defaults may be written, health keys never
});

test('save with HEALTH_PROFILE_ONLY: a changed health key is not written', async (t) => {
    withFlag(t, 'true');
    const User = require('../models/User');
    const doc = User.hydrate({ _id: ID, name: 'B', email: 'b@example.invalid', password: 'hashed', profile: { lifestyle: { stepGoal: 8000 } } });
    doc.profile = { age: 30, allergies: ['Peanut'], lifestyle: { stepGoal: 9000, smoker: true } };
    let update;
    t.mock.method(doc.collection, 'updateOne', async (_f, u) => { update = u; return { acknowledged: true, matchedCount: 1, modifiedCount: 1 }; });
    await doc.save();
    const s = JSON.stringify(update);
    assert.ok(s.includes('9000'), s);
    assert.ok(!s.includes('Peanut') && !s.includes('"age"') && !s.includes('smoker'), s);
});

// ── the 19 keys moved on 26 Nov (diabetesProfile, dietPreferences, fitnessProfile) ──

test('moved keys: read from HealthProfile; while HealthProfile has none yet (backfill pending) the stored value is kept', () => {
    const stored = { diabetesProfile: { type: 'Type 1', hba1c: 9 }, dietPreferences: { mealsPerDay: '2' }, fitnessProfile: { primaryGoal: 'run', timeframe: '1 month' } };
    const notYet = profileView(stored, HP); // HP has no diabetes / new diet / fitness keys
    assert.equal(notYet.diabetesProfile.type, 'Type 1');
    assert.equal(notYet.dietPreferences.mealsPerDay, '2');
    assert.equal(notYet.fitnessProfile.timeframe, '1 month');
    const moved = profileView(stored, { ...HP, diabetes: { type: 'Type 2', hba1c: 7.6, onMedication: false }, diet: { ...HP.diet, mealsPerDay: '3', restrictions: [] }, fitness: { primaryGoal: 'walk daily' }, goals: { ...HP.goals, timeline: '6 months' } });
    assert.equal(moved.diabetesProfile.type, 'Type 2');
    assert.equal(moved.diabetesProfile.hba1c, 7.6);
    assert.equal(moved.diabetesProfile.onMedication, false);
    assert.equal(moved.dietPreferences.mealsPerDay, '3');
    assert.deepEqual(moved.dietPreferences.restrictions, []); // cleared by the user = cleared
    assert.equal(moved.fitnessProfile.primaryGoal, 'walk daily');
    assert.equal(moved.fitnessProfile.timeframe, '6 months');
});

test('moved keys: the old app editing diabetes details lands them in HealthProfile', async () => {
    const { createProfileWriteService } = require('../modules/health-profile/services/profileWriteService');
    const { createMemoryProfileRepo } = require('./helpers/memoryProfileRepo');
    const U = String(new mongoose.Types.ObjectId());
    const repo = createMemoryProfileRepo({ users: { [U]: { _id: U, profile: { age: 60, gender: 'female', diabetesProfile: { type: 'Type 2' } } } } });
    const svc = createProfileWriteService({ repo, afterCommit: async () => {} });
    await svc.ensureProfile(U);
    assert.equal(repo.state.profiles[U].diabetes.type, 'Type 2'); // from the stored copy at creation
    const sent = { age: 60, gender: 'female', diabetesProfile: { type: 'Type 2', hba1c: 7.1, onMedication: true, medicationType: ['Metformin'] }, fitnessProfile: { biggestChallenge: 'time' } };
    await svc.syncFromLegacy(U, { legacy: { _id: U, profile: sent } });
    const p = repo.state.profiles[U];
    assert.equal(p.diabetes.hba1c, 7.1);
    assert.equal(p.diabetes.onMedication, true);
    assert.deepEqual(p.diabetes.medicationType, ['Metformin']);
    assert.equal(p.fitness.biggestChallenge, 'time');
    assert.equal(p.basic.age, 60);
});

test('moved keys: HEALTH_PROFILE_ONLY strips them from User writes too', () => {
    const u = { $set: { 'profile.diabetesProfile.hba1c': 7, 'profile.dietPreferences': { mealsPerDay: '3' }, 'profile.fitnessProfile.timeframe': 'x', 'profile.lifestyle.stepGoal': 8000 } };
    stripUpdate(u);
    assert.deepEqual(u.$set, { 'profile.dietPreferences': {}, 'profile.lifestyle.stepGoal': 8000 });
    assert.ok(HEALTH_PATHS.includes('diabetesProfile.insulinTiming'));
    assert.ok(HEALTH_PATHS.includes('fitnessProfile.timeframe'));
});

test('coach context: diabetes details, diet and fitness preferences reach the prompt summary', () => {
    const { buildContext } = require('../modules/health-profile/services/profileContextService');
    const c = buildContext({ basic: { age: 67 }, diabetes: { type: 'Type 2', hba1c: 7.6, onMedication: true, medicationType: ['Metformin'] }, diet: { preference: 'eggetarian', mealsPerDay: '3' }, fitness: { biggestChallenge: 'knee pain' } });
    assert.match(c.summary, /Diabetes: Type 2.*HbA1c 7\.6%.*on medication \(Metformin\)/);
    assert.match(c.summary, /Diet: eggetarian, 3 meals a day/);
    assert.match(c.summary, /Fitness: biggest challenge: knee pain/);
});

// ── physical disabilities (26 Nov) ─────────────────────────────────────────

test('disabilities: a list section like allergies (add, same name updates, "none"), shown to the coach', async () => {
    const { createProfileWriteService } = require('../modules/health-profile/services/profileWriteService');
    const { createMemoryProfileRepo } = require('./helpers/memoryProfileRepo');
    const { buildContext } = require('../modules/health-profile/services/profileContextService');
    const U = String(new mongoose.Types.ObjectId());
    const repo = createMemoryProfileRepo({ users: { [U]: { _id: U, profile: { age: 40 } } } });
    const svc = createProfileWriteService({ repo, afterCommit: async () => {} });
    await svc.addItem(U, 'disabilities', { name: 'Left leg amputation', area: 'lower_limb', aid: 'prosthetic leg' }, { source: 'manual' });
    await svc.addItem(U, 'disabilities', { name: 'left leg amputation', severity: 'severe' }, { source: 'manual' });
    const p = repo.state.profiles[U];
    assert.equal(p.disabilities.state, 'has_items');
    assert.equal(p.disabilities.items.length, 1);
    assert.equal(p.disabilities.items[0].severity, 'severe');
    assert.match(buildContext(p).summary, /Physical disabilities: Left leg amputation, severe, uses prosthetic leg/);
    await assert.rejects(svc.addItem(U, 'disabilities', { name: 'x', area: 'flying' }, { source: 'manual' }), { status: 400 });

    const U2 = String(new mongoose.Types.ObjectId());
    const repo2 = createMemoryProfileRepo({ users: { [U2]: { _id: U2, profile: {} } } });
    const svc2 = createProfileWriteService({ repo: repo2, afterCommit: async () => {} });
    await svc2.markNone(U2, 'disabilities', { source: 'manual' });
    assert.equal(repo2.state.profiles[U2].disabilities.state, 'none');
    assert.match(buildContext(repo2.state.profiles[U2]).summary, /Physical disabilities: none/);
    assert.ok(!/disabilit/i.test(buildContext({}).summary)); // never asked: no line
});

test('disabilities: the coach can save one from chat (fact target), and asks which one for a bare "yes"', () => {
    const { triageFacts, listItem, isVague, specifyQuestion, describeFact } = require('../modules/ai-coach/tools/profileTools');
    const { confirm } = triageFacts([{ target: 'disabilities', value: 'polio in right leg', statedAs: 'volunteered', aboutSelf: true }]);
    assert.equal(confirm.length, 1);
    assert.deepEqual(listItem('disabilities', 'polio in right leg'), { name: 'polio in right leg' });
    assert.equal(isVague({ target: 'disabilities', value: 'yes' }), true);
    assert.equal(specifyQuestion('disabilities', true), 'Kaunsi disability hai?');
    assert.match(describeFact({ target: 'disabilities', value: 'polio' }), /physical disability: polio/);
});
