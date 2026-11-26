/**
 * HealthProfile <-> legacy User.profile mapping. Pure functions, no DB.
 * The round-trip tests guard the mirror: existing features read User.profile,
 * so a HealthProfile write must reproduce what they read today.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { fromLegacyUser, toLegacyPatch, MIRRORED_SECTIONS } = require('../modules/health-profile/services/profileMapper');
const HealthProfile = require('../modules/health-profile/models/HealthProfile');
const medicalContext = require('../utils/medicalContext');

const AT = new Date('2026-11-23T00:00:00Z');

const rahul = () => ({
    profile: {
        age: 32, gender: 'male', height: 175, weight: 78, bloodGroup: 'B+',
        dietaryPreference: 'vegetarian',
        allergies: ['Peanut', 'peanut '],
        isDiabetic: 'yes',
        diabetesProfile: { type: 'Type 2', status: 'Controlled', diagnosisYear: 2021 },
        healthConditions: ['Diabetes', 'Hypertension', 'Other'],
        healthConditionOther: 'Asthma',
        chronicConditions: ['asthma'],
        medicalHistory: { conditions: [], currentMedications: ['Metformin 500mg'], surgeries: ['ACL'], familyHistory: [] },
        lifestyle: { smoker: false, alcohol: true, alcoholFrequency: 'occasional', stressLevel: 'moderate', waterGoalMl: 2500, stepGoal: 8000 },
        profession: 'desk_job',
        goals: ['Weight Management', 'Other'],
        goalOther: 'Run 5k',
    },
    nutritionGoal: { targetWeight: 70 },
});

// Applies a { $set, $unset } patch to a plain object, like MongoDB would.
function applyPatch(doc, patch) {
    const out = structuredClone(doc);
    for (const [path, value] of Object.entries(patch.$set || {})) {
        const keys = path.split('.');
        let o = out;
        for (const k of keys.slice(0, -1)) o = o[k] ??= {};
        o[keys.at(-1)] = value;
    }
    for (const path of Object.keys(patch.$unset || {})) {
        const keys = path.split('.');
        let o = out;
        for (const k of keys.slice(0, -1)) { o = o?.[k]; }
        if (o) delete o[keys.at(-1)];
    }
    return out;
}

test('fromLegacyUser: maps every section and passes schema validation', () => {
    const s = fromLegacyUser(rahul(), 'migration', AT);
    assert.equal(s.basic.age, 32);
    assert.equal(s.body.weightKg, 78);
    assert.equal(s.diet.preference, 'vegetarian');
    assert.equal(s.goals.targetWeightKg, 70);
    assert.deepEqual(s.goals.primary, ['Weight Management', 'Other']);
    assert.equal(s.basic.meta.source, 'migration');

    const doc = new HealthProfile({ user: new mongoose.Types.ObjectId(), ...s });
    assert.equal(doc.validateSync(), undefined);
});

test('fromLegacyUser: conditions merged from all 4 legacy fields, deduped, specific diabetes name kept', () => {
    const { conditions } = fromLegacyUser(rahul(), 'migration', AT);
    const names = conditions.items.map((c) => c.name);
    assert.deepEqual(names, ['Hypertension', 'Asthma', 'Type 2 Diabetes']);
    const diabetes = conditions.items.find((c) => c.name === 'Type 2 Diabetes');
    assert.equal(diabetes.status, 'controlled');
    assert.equal(diabetes.diagnosedYear, 2021);
    assert.equal(conditions.state, 'has_items');
});

test('fromLegacyUser: allergies deduped, type/severity never guessed', () => {
    const { allergies } = fromLegacyUser(rahul(), 'migration', AT);
    assert.equal(allergies.items.length, 1);
    assert.equal(allergies.items[0].allergen, 'Peanut');
    const doc = new HealthProfile({ user: new mongoose.Types.ObjectId(), allergies });
    assert.equal(doc.allergies.items[0].type, 'unknown');
    assert.equal(doc.allergies.items[0].severity, 'unknown');
});

test('fromLegacyUser: smoker false becomes "no", not "never"', () => {
    const { lifestyle } = fromLegacyUser(rahul(), 'migration', AT);
    assert.equal(lifestyle.smoking, 'no');
    assert.equal(lifestyle.alcohol, 'current');
});

test('fromLegacyUser: empty arrays are "missing", "None of these" is "none"', () => {
    const s = fromLegacyUser({ profile: { allergies: [], healthConditions: ['None of these'] } }, 'manual', AT);
    assert.equal(s.allergies.state, 'missing');
    assert.equal(s.medications.state, 'missing');
    assert.equal(s.conditions.state, 'none');
});

test('fromLegacyUser: empty user gives no scalar sections and does not throw', () => {
    const s = fromLegacyUser({}, 'manual', AT);
    assert.equal(s.basic, undefined);
    assert.equal(s.body, undefined);
    assert.equal(s.conditions.state, 'missing');
});

test('toLegacyPatch: only touches paths of the sections passed in', () => {
    const hp = fromLegacyUser(rahul(), 'migration', AT);
    const patch = toLegacyPatch(hp, ['body']);
    assert.deepEqual(patch, { $set: { 'profile.height': 175, 'profile.weight': 78 } });
});

test('toLegacyPatch: never touches app settings under User.profile', () => {
    const hp = fromLegacyUser(rahul(), 'migration', AT);
    const patch = toLegacyPatch(hp, MIRRORED_SECTIONS);
    const paths = [...Object.keys(patch.$set || {}), ...Object.keys(patch.$unset || {})];
    for (const forbidden of ['waterGoalMl', 'waterGlassSizeMl', 'stepGoal', 'sleepGoalHours', 'avatar', 'diabetesProfile', 'foodPreferences']) {
        assert.ok(!paths.some((p) => p.includes(forbidden)), `mirror touched ${forbidden}`);
    }
});

test('toLegacyPatch: conditions layout keeps legacy enum valid and isDiabetic correct', () => {
    const hp = fromLegacyUser(rahul(), 'migration', AT);
    const { $set } = toLegacyPatch(hp, ['conditions']);
    assert.deepEqual($set['profile.healthConditions'], ['Hypertension', 'Diabetes']);
    assert.deepEqual($set['profile.chronicConditions'], ['Asthma']);
    assert.equal($set['profile.isDiabetic'], 'yes');

    const User = require('../models/User');
    const u = new User(applyPatch({ name: 'x', email: 'x@x.com', password: 'secret1' }, { $set }));
    assert.equal(u.validateSync('profile.healthConditions'), undefined);
});

test('toLegacyPatch: resolved conditions and inactive medicines leave the mirror', () => {
    const hp = {
        conditions: { state: 'has_items', items: [{ name: 'Type 2 Diabetes', status: 'resolved' }, { name: 'Thyroid', status: 'active' }] },
        medications: { state: 'has_items', items: [{ name: 'Metformin', dose: '500mg', active: false }, { name: 'Thyroxine', dose: '50mcg' }] },
    };
    const { $set } = toLegacyPatch(hp, ['conditions', 'medications']);
    assert.equal($set['profile.isDiabetic'], 'no');
    assert.deepEqual($set['profile.healthConditions'], ['Thyroid']);
    assert.deepEqual($set['profile.medicalHistory.currentMedications'], ['Thyroxine 50mcg']);
});

test('round trip: legacy -> HealthProfile -> mirror -> legacy keeps the same health facts', () => {
    const original = rahul();
    const hp = fromLegacyUser(original, 'migration', AT);
    const mirrored = applyPatch(original, toLegacyPatch(hp, MIRRORED_SECTIONS));
    const again = fromLegacyUser(mirrored, 'migration', AT);

    const strip = (s) => JSON.parse(JSON.stringify(s, (k, v) => (k === 'meta' || k === 'updatedAt' ? undefined : v)));
    assert.deepEqual(strip(again), strip(hp));
    // App settings untouched
    assert.equal(mirrored.profile.lifestyle.waterGoalMl, 2500);
    assert.equal(mirrored.profile.lifestyle.stepGoal, 8000);
});

test('round trip: existing medical context reader sees the same facts after the mirror', () => {
    const original = rahul();
    const hp = fromLegacyUser(original, 'migration', AT);
    const mirrored = applyPatch(original, toLegacyPatch(hp, MIRRORED_SECTIONS));

    // Lower-cased: the reader keeps the first spelling it meets, so only casing may differ.
    const before = medicalContext.buildMedicalContextForAI(original).toLowerCase();
    const after = medicalContext.buildMedicalContextForAI(mirrored).toLowerCase();
    for (const fact of ['peanut', 'hypertension', 'asthma', 'metformin', 'diabet']) {
        assert.equal(before.includes(fact), after.includes(fact), `"${fact}" changed after mirror`);
    }
});
