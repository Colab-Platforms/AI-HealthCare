/**
 * /api/health-profile controller: input checks, provenance protection,
 * optimistic locking, user scoping, side effects, error mapping.
 * In-memory repo, no DB, no HTTP server.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const { createProfileWriteService } = require('../modules/health-profile/services/profileWriteService');
const { createProfileReadService } = require('../modules/health-profile/services/profileContextService');
const { createHealthProfileController } = require('../modules/health-profile/controllers/healthProfileController');
const { computeCompleteness } = require('../modules/health-profile/services/completeness');
const { createMemoryProfileRepo } = require('./helpers/memoryProfileRepo');

const USER = String(new mongoose.Types.ObjectId());
const OTHER = String(new mongoose.Types.ObjectId());

const legacy = (id, overrides = {}) => ({
    _id: id,
    profile: {
        age: 32, gender: 'male', height: 175, weight: 78,
        allergies: ['Peanut'],
        lifestyle: { smoker: false, waterGoalMl: 2500 },
        ...overrides,
    },
    nutritionGoal: { targetWeight: 70 },
});

function memoryCache() {
    const store = new Map();
    return {
        store,
        async getOrSet(key, fn) {
            if (store.has(key)) return store.get(key);
            const v = await fn();
            if (v) store.set(key, v);
            return v;
        },
    };
}

function setup({ users } = {}) {
    const repo = createMemoryProfileRepo({ users: users || { [USER]: legacy(USER), [OTHER]: legacy(OTHER) } });
    const write = createProfileWriteService({ repo, afterCommit: async () => {} });
    const logs = [];
    const logger = { error: (...a) => logs.push(a.join(' ')), warn: () => {} };
    const read = createProfileReadService({ repo, service: write, cache: memoryCache(), logger });
    const effects = [];
    const sideEffects = { afterProfileChange: async (u, sections) => { effects.push(sections); } };
    const c = createHealthProfileController({ write, read, repo, sideEffects, logger });

    const call = async (handler, { user = USER, params = {}, body = {}, query = {} } = {}) => {
        const res = {
            statusCode: 200,
            body: null,
            status(code) { this.statusCode = code; return this; },
            json(b) { this.body = b; return this; },
        };
        await c[handler]({ user: { _id: user }, params, body, query, method: 'TEST', originalUrl: `/${handler}` }, res);
        return res;
    };
    return { repo, write, c, call, effects, logs, profile: (id = USER) => repo.state.profiles[id], user: (id = USER) => repo.state.users[id] };
}

// ── GET ────────────────────────────────────────────────────────────────────

test('GET: first call builds the profile once, items get stable ids', async () => {
    const { call, repo } = setup();
    const a = await call('getProfile');
    assert.equal(a.statusCode, 200);
    assert.equal(a.body.exists, true);
    assert.equal(a.body.version, 1);
    const peanut = a.body.profile.allergies.items[0];
    assert.ok(peanut._id);
    assert.equal(a.body.profile.user, undefined); // no internal fields

    const b = await call('getProfile');
    assert.equal(String(b.body.profile.allergies.items[0]._id), String(peanut._id));
    assert.equal(repo.state.history.length, 1); // second GET wrote nothing
});

test('GET: unknown user is 404; bad legacy data is shown read-only, not created', async () => {
    const { call, profile } = setup({ users: { [USER]: legacy(USER, { gender: 'robot' }) } });
    assert.equal((await call('getProfile', { user: OTHER })).statusCode, 404);
    const res = await call('getProfile');
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.readOnly, true);
    assert.equal(res.body.exists, false);
    assert.equal(profile(), undefined);
});

test('GET completeness: lists missing fields, most important first; "none" counts as answered', async () => {
    const { call } = setup();
    const before = await call('getCompleteness');
    assert.equal(before.statusCode, 200);
    assert.equal(before.body.missing[0].priority, 'critical');
    assert.ok(before.body.missing.some((m) => m.field === 'medications'));

    await call('markNone', { params: { section: 'medications' } });
    const after = await call('getCompleteness');
    assert.ok(!after.body.missing.some((m) => m.field === 'medications'));
    assert.ok(after.body.percent > before.body.percent);
    assert.ok(Array.isArray(after.body.sections) && after.body.sections.length === 7);
});

test('GET profile and writes return a completeness block that moves after a save', async () => {
    const { call } = setup();
    const got = await call('getProfile');
    assert.equal(typeof got.body.completeness.percent, 'number');
    assert.equal(got.body.completeness.sections.length, 7);
    const saved = await call('markNone', { params: { section: 'medications' } });
    assert.ok(saved.body.completeness.percent > got.body.completeness.percent);
    assert.notEqual(saved.body.completeness.next?.field, 'medications');
});

// ── PATCH /:section ────────────────────────────────────────────────────────

test('PATCH section: saves, mirrors, returns the fresh profile, runs side effects', async () => {
    const { call, user, effects } = setup();
    const res = await call('updateSection', { params: { section: 'body' }, body: { data: { weightKg: 74 } } });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.changed, true);
    assert.equal(res.body.profile.body.weightKg, 74);
    assert.equal(res.body.profile.body.meta.source, 'manual');
    assert.equal(user().profile.weight, 74);
    assert.deepEqual(effects, [['body']]);
});

test('PATCH section: same value again is a no-op, no side effects', async () => {
    const { call, effects } = setup();
    await call('updateSection', { params: { section: 'body' }, body: { data: { weightKg: 74 } } });
    const res = await call('updateSection', { params: { section: 'body' }, body: { data: { weightKg: 74 } } });
    assert.equal(res.body.changed, false);
    assert.equal(effects.length, 1);
});

test('PATCH section: stale version -> 409, current version -> ok', async () => {
    const { call } = setup();
    const { body: { version } } = await call('getProfile');
    await call('updateSection', { params: { section: 'body' }, body: { data: { weightKg: 74 }, version } });
    const stale = await call('updateSection', { params: { section: 'body' }, body: { data: { weightKg: 73 }, version } });
    assert.equal(stale.statusCode, 409);
    assert.equal(stale.body.code, 'PROFILE_VERSION_CONFLICT');
    const ok = await call('updateSection', { params: { section: 'body' }, body: { data: { weightKg: 73 }, version: version + 1 } });
    assert.equal(ok.statusCode, 200);
});

test('PATCH section: every bad input is a 400 and writes nothing', async () => {
    const { call, profile } = setup();
    const bad = [
        { params: { section: 'wallet' }, body: { data: { x: 1 } } },
        { params: { section: 'allergies' }, body: { data: { x: 1 } } },          // list, not scalar
        { params: { section: 'body' }, body: {} },
        { params: { section: 'body' }, body: { data: {} } },
        { params: { section: 'body' }, body: { data: [74] } },
        { params: { section: 'body' }, body: { data: { weightKg: 74 }, version: '1' } },
        { params: { section: 'body' }, body: { data: { weightKg: 74 }, version: -1 } },
        { params: { section: 'body' }, body: { data: { meta: { source: 'device' } } } }, // provenance
        { params: { section: 'body' }, body: { data: { shoeSize: 9 } } },
        { params: { section: 'body' }, body: { data: { weightKg: 900 } } },
        { params: { section: 'basic' }, body: { data: { gender: 'robot' } } },
    ];
    for (const req of bad) {
        const res = await call('updateSection', req);
        assert.equal(res.statusCode, 400, JSON.stringify(req));
        assert.equal(res.body.success, false);
    }
    assert.equal(profile(), undefined);
});

// ── list items ─────────────────────────────────────────────────────────────

test('POST item: saved with server provenance; client cannot set source/verified/_id', async () => {
    const { call, profile, user } = setup();
    for (const forged of [{ source: 'device' }, { verified: false }, { _id: String(new mongoose.Types.ObjectId()) }, { updatedAt: '2020-01-01' }, { colour: 'red' }]) {
        const res = await call('addItem', { params: { section: 'allergies' }, body: { item: { allergen: 'Shellfish', ...forged } } });
        assert.equal(res.statusCode, 400, JSON.stringify(forged));
    }
    const res = await call('addItem', { params: { section: 'allergies' }, body: { item: { allergen: 'Shellfish', severity: 'severe', type: 'food' } } });
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.itemId);
    const item = profile().allergies.items.find((i) => i.allergen === 'Shellfish');
    assert.equal(item.source, 'manual');
    assert.equal(item.verified, true);
    assert.deepEqual(user().profile.allergies, ['Peanut', 'Shellfish']);
});

test('POST item: missing key field, unknown list, scalar section -> 400', async () => {
    const { call } = setup();
    assert.equal((await call('addItem', { params: { section: 'allergies' }, body: { item: { severity: 'mild' } } })).statusCode, 400);
    assert.equal((await call('addItem', { params: { section: 'pets' }, body: { item: { name: 'x' } } })).statusCode, 400);
    assert.equal((await call('addItem', { params: { section: 'body' }, body: { item: { name: 'x' } } })).statusCode, 400);
    assert.equal((await call('addItem', { params: { section: 'allergies' }, body: { item: { allergen: 'x', severity: 'deadly' } } })).statusCode, 400);
});

test('PATCH item: updates details; bad / unknown ids handled', async () => {
    const { call, profile } = setup();
    const { body } = await call('getProfile');
    const peanutId = String(body.profile.allergies.items[0]._id);

    assert.equal((await call('updateItem', { params: { section: 'allergies', itemId: 'nope' }, body: { data: { severity: 'mild' } } })).statusCode, 400);
    assert.equal((await call('updateItem', { params: { section: 'allergies', itemId: String(new mongoose.Types.ObjectId()) }, body: { data: { severity: 'mild' } } })).statusCode, 404);
    assert.equal((await call('updateItem', { params: { section: 'allergies', itemId: peanutId }, body: { data: { verified: false } } })).statusCode, 400);
    assert.equal((await call('updateItem', { params: { section: 'allergies', itemId: peanutId }, body: { data: { allergen: '' } } })).statusCode, 400);

    const ok = await call('updateItem', { params: { section: 'allergies', itemId: peanutId }, body: { data: { severity: 'severe', reaction: 'swelling' } } });
    assert.equal(ok.statusCode, 200);
    assert.equal(profile().allergies.items[0].severity, 'severe');
    assert.equal(profile().allergies.items[0].allergen, 'Peanut');
});

test('DELETE item + POST none: last removal -> missing, then none allowed; none refused while items exist', async () => {
    const { call, profile } = setup();
    const { body } = await call('getProfile');
    const peanutId = String(body.profile.allergies.items[0]._id);

    assert.equal((await call('markNone', { params: { section: 'allergies' } })).statusCode, 400);
    assert.equal((await call('removeItem', { params: { section: 'allergies', itemId: peanutId } })).statusCode, 200);
    assert.equal(profile().allergies.state, 'missing');
    assert.equal((await call('markNone', { params: { section: 'allergies' } })).statusCode, 200);
    assert.equal(profile().allergies.state, 'none');
    assert.equal((await call('removeItem', { params: { section: 'allergies', itemId: peanutId } })).statusCode, 404);
});

// ── history + undo ─────────────────────────────────────────────────────────

test('history: newest first, field filter, pagination, never another user\'s rows', async () => {
    const { call } = setup();
    for (const w of [74, 73, 72]) await call('updateSection', { params: { section: 'body' }, body: { data: { weightKg: w } } });
    await call('updateSection', { user: OTHER, params: { section: 'body' }, body: { data: { weightKg: 60 } } });

    const page1 = await call('getHistory', { query: { field: 'body.weightKg', limit: '2' } });
    assert.equal(page1.statusCode, 200);
    assert.deepEqual(page1.body.history.map((h) => h.newValue), [72, 73]);
    assert.ok(page1.body.nextBefore);
    const page2 = await call('getHistory', { query: { field: 'body.weightKg', limit: '2', before: String(page1.body.nextBefore) } });
    assert.deepEqual(page2.body.history.map((h) => h.newValue), [74]);
    assert.equal(page2.body.nextBefore, null);

    const all = await call('getHistory');
    assert.ok(all.body.history.every((h) => h.newValue !== 60));
});

test('history: bad query params -> 400', async () => {
    const { call } = setup();
    for (const query of [{ limit: '0' }, { limit: '101' }, { limit: 'abc' }, { before: 'x' }, { field: '$where' }, { field: ['a'] }]) {
        assert.equal((await call('getHistory', { query })).statusCode, 400, JSON.stringify(query));
    }
});

test('undo: restores the old value; another user\'s change is 404; bad id 400', async () => {
    const { call, repo, profile, user } = setup();
    await call('updateSection', { params: { section: 'body' }, body: { data: { weightKg: 74 } } });
    await call('updateSection', { user: OTHER, params: { section: 'body' }, body: { data: { weightKg: 60 } } });
    const mine = repo.state.history.find((h) => h.user === USER && h.field === 'body.weightKg');
    const theirs = repo.state.history.find((h) => h.user === OTHER && h.field === 'body.weightKg');

    assert.equal((await call('undo', { params: { historyId: 'bad' } })).statusCode, 400);
    assert.equal((await call('undo', { params: { historyId: theirs._id } })).statusCode, 404);
    assert.equal(profile(OTHER).body.weightKg, 60);

    const res = await call('undo', { params: { historyId: mine._id } });
    assert.equal(res.statusCode, 200);
    assert.equal(profile().body.weightKg, 78);
    assert.equal(user().profile.weight, 78);
});

// ── errors ─────────────────────────────────────────────────────────────────

test('unexpected errors are a 500 with no internal detail', async () => {
    const { call, repo, logs } = setup();
    repo.failures.patchUser = new Error('E11000 secret index details');
    const res = await call('updateSection', { params: { section: 'body' }, body: { data: { weightKg: 74 } } });
    assert.equal(res.statusCode, 500);
    assert.ok(!JSON.stringify(res.body).includes('secret'));
    assert.equal(logs.length, 1);
});

// ── completeness (pure) ────────────────────────────────────────────────────

test('completeness: empty profile is 0%, fully answered is 100%', () => {
    assert.equal(computeCompleteness({}).percent, 0);
    assert.equal(computeCompleteness(null).percent, 0);
    const full = {
        basic: { dateOfBirth: '1990-01-01', gender: 'male', bloodGroup: 'O+' },
        body: { heightCm: 175, weightKg: 70 },
        allergies: { state: 'none' }, medications: { state: 'none' }, conditions: { state: 'has_items' },
        familyHistory: { state: 'none' }, surgeries: { state: 'none' },
        intolerances: { state: 'none' }, mentalHealth: { state: 'none' }, disabilities: { state: 'none' },
        diet: { preference: 'vegetarian' }, goals: { primary: ['Better Sleep'] },
        lifestyle: { activityLevel: 'sedentary', smoking: 'no', alcohol: 'no', sleepHours: 7, stressLevel: 'low', profession: 'desk_job' },
        fitness: { experience: 'beginner' },
    };
    const c = computeCompleteness(full);
    assert.equal(c.percent, 100);
    assert.deepEqual(c.missing, []);
    assert.ok(c.sections.every((s) => s.percent === 100 && s.missing.length === 0));
});

test('completeness: per-section percent, labels and edit section on missing fields', () => {
    const c = computeCompleteness({
        basic: { age: 30, gender: 'female' }, body: { heightCm: 160, weightKg: 55 },
        allergies: { state: 'none' }, medications: { state: 'missing' }, conditions: { state: 'has_items' },
    });
    const sec = Object.fromEntries(c.sections.map((s) => [s.key, s]));
    assert.deepEqual(c.sections.map((s) => s.key), ['basic', 'body', 'medical', 'lifestyle', 'diet', 'goals', 'fitness']);
    assert.equal(sec.body.percent, 100);
    assert.equal(sec.basic.percent, Math.round((6 / 7) * 100)); // age 3 + gender 3 of 7 (blood group 1 missing)
    assert.equal(sec.lifestyle.percent, 0);
    assert.ok(sec.medical.missing.includes('medications') && sec.medical.missing.includes('mentalHealth'));
    const med = c.missing[0];
    assert.equal(med.field, 'medications');
    assert.equal(med.editSection, 'medications');
    assert.ok(med.label.english && med.label.hinglish);
    assert.equal(c.missing.find((m) => m.field === 'lifestyle.smoking').editSection, 'lifestyle');
    assert.equal(c.missingCritical, 1);
});

test('completeness: new sections (intolerances, mental health, disabilities) count; "none" answers them', () => {
    const base = { allergies: { state: 'none' } };
    const before = computeCompleteness(base);
    const after = computeCompleteness({ ...base, intolerances: { state: 'none' }, mentalHealth: { state: 'has_items' }, disabilities: { state: 'none' } });
    for (const f of ['intolerances', 'mentalHealth', 'disabilities']) {
        assert.ok(before.missing.some((m) => m.field === f));
        assert.ok(!after.missing.some((m) => m.field === f));
    }
    assert.ok(after.percent > before.percent);
});

test('completeness: summary for profile responses has percent, sections and next step', () => {
    const { completenessSummary } = require('../modules/health-profile/services/completeness');
    const s = completenessSummary({ allergies: { state: 'none' } });
    assert.equal(typeof s.percent, 'number');
    assert.equal(s.sections.length, 7);
    assert.equal(s.next.field, 'medications');
    assert.equal(completenessSummary(null).percent, 0);
});

// ── DPDPA ──────────────────────────────────────────────────────────────────

test('DPDPA: account deletion and data export cover HealthProfile + ProfileHistory', () => {
    const privacy = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'privacyController.js'), 'utf8');
    assert.match(privacy, /HealthProfile\.deleteMany\(\{ user: uid \}\)/);
    assert.match(privacy, /ProfileHistory\.deleteMany\(\{ user: uid \}\)/);
    assert.match(privacy, /health_profile\.json/);
    assert.match(privacy, /health_profile_history\.json/);
    assert.match(privacy, /CoachState\.deleteMany\(\{ user: uid \}\)/);
    assert.match(privacy, /coach_state\.json/);
    assert.match(privacy, /SymptomLog\.deleteMany\(\{ user: uid \}\)/);
    assert.match(privacy, /symptom_log\.json/);
    const admin = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'adminController.js'), 'utf8');
    assert.match(admin, /HealthProfile'\)\.deleteMany\(\{ user: id \}\)/);
    assert.match(admin, /ProfileHistory'\)\.deleteMany\(\{ user: id \}\)/);
    assert.match(admin, /CoachState'\)\.deleteMany\(\{ user: id \}\)/);
    assert.match(admin, /SymptomLog'\)\.deleteMany\(\{ user: id \}\)/);
});

test('admin delete: every deleteMany filter uses a field the model actually has', () => {
    // A wrong field name matches nothing (strictQuery is off), so the data silently survives.
    const admin = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'adminController.js'), 'utf8');
    const block = admin.slice(admin.indexOf('exports.deleteUser'), admin.indexOf('// Report Oversight'));
    const models = {
        HealthReport: '../models/HealthReport', WearableData: '../models/WearableData', ChatHistory: '../models/ChatHistory',
        Appointment: '../models/Appointment', Otp: '../models/Otp',
    };
    for (const [name, file] of Object.entries(models)) {
        const m = block.match(new RegExp(`${name}\\.deleteMany\\(\\{ (\\w+):`));
        assert.ok(m, `${name}.deleteMany not found in deleteUser`);
        const schema = require(path.join(__dirname, '..', 'controllers', file)).schema;
        assert.ok(schema.path(m[1]), `${name} has no field "${m[1]}"`);
    }
});
