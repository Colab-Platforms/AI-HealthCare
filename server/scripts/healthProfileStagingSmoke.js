/**
 * HealthProfile smoke test against the REAL staging MongoDB. Checks what the
 * offline tests can't: real transactions, the version guard, the unique index
 * and the User.profile mirror on a real User document. Run from server/:
 *
 *   node scripts/healthProfileStagingSmoke.js           # run + clean up
 *   node scripts/healthProfileStagingSmoke.js --keep    # leave test data for inspection
 *
 * Safety:
 *   - refuses to run unless USE_STAGING_DB=true AND the database name ends with "staging"
 *   - creates one throwaway user (hp-smoke-<time>@example.invalid) and only
 *     touches that user's User / HealthProfile / ProfileHistory docs
 *   - never touches Redis (cache invalidation is replaced by a recorder)
 *   - deletes everything it created in `finally`, even when a check fails
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

if (process.env.USE_STAGING_DB !== 'true' || !process.env.MONGODB_URI_STAGING) {
    console.error('Refusing to run: needs USE_STAGING_DB=true and MONGODB_URI_STAGING (staging only).');
    process.exit(1);
}

const crypto = require('crypto');
const mongoose = require('mongoose');

const KEEP = process.argv.includes('--keep');
let failures = 0;

const check = (label, cond, detail = '') => {
    if (!cond) failures += 1;
    console.log(`${cond ? '  PASS' : '  FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};

// Runs fn and returns the error it throws (or null), so a check can assert on it.
const errorOf = async (fn) => {
    try { await fn(); return null; } catch (err) { return err; }
};

async function main() {
    const connectDB = require('../config/db');
    await connectDB();
    const dbName = mongoose.connection.name;
    if (!/staging$/i.test(dbName)) {
        console.error(`Refusing to continue: connected database "${dbName}" is not a staging database.`);
        process.exit(1);
    }
    console.log(`\nDB: ${mongoose.connection.host} / ${dbName}\n`);

    const User = require('../models/User');
    const HealthProfile = require('../modules/health-profile/models/HealthProfile');
    const ProfileHistory = require('../modules/health-profile/models/ProfileHistory');
    const { createProfileWriteService } = require('../modules/health-profile/services/profileWriteService');

    // Collections + indexes must exist before the first transaction
    // (unique `user` index is what blocks a second profile).
    await HealthProfile.init();
    await ProfileHistory.init();

    const committed = [];
    const svc = createProfileWriteService({ afterCommit: async (u, sections) => { committed.push(sections); } });

    const email = `hp-smoke-${Date.now()}@example.invalid`;
    const user = await User.create({
        name: 'HealthProfile smoke (delete me)',
        email,
        password: crypto.randomBytes(16).toString('hex'),
        profile: {
            age: 32, gender: 'male', height: 175, weight: 78,
            dietaryPreference: 'vegetarian',
            allergies: ['Peanut'],
            isDiabetic: 'yes',
            medicalHistory: { currentMedications: [] },
            lifestyle: { smoker: false, waterGoalMl: 2500, stepGoal: 8000 },
        },
    });
    const userId = user._id;
    console.log(`Test user: ${email} (${userId})\n`);

    const profile = () => HealthProfile.findOne({ user: userId }).lean();
    const legacy = async () => (await User.findById(userId).select('profile').lean()).profile;
    const history = () => ProfileHistory.find({ user: userId }).sort({ createdAt: 1, _id: 1 }).lean();

    try {
        // 1. Rollback: a schema violation on the very first write leaves nothing behind.
        const bad = await errorOf(() => svc.updateSection(userId, 'basic', { gender: 'robot' }, { source: 'chat' }));
        check('1. schema violation rejected with 400', bad?.status === 400, bad?.message);
        check('1. ...and nothing was saved (profile, history, mirror)',
            !(await profile()) && (await history()).length === 0 && (await legacy()).gender === 'male');

        // 2. Lazy creation on first write + mirror + app settings untouched.
        await svc.updateSection(userId, 'body', { weightKg: 76 }, { source: 'manual' });
        let p = await profile();
        let u = await legacy();
        check('2. first write builds the profile from legacy data', p?.version === 1 && p.allergies?.items?.[0]?.allergen === 'Peanut');
        check('2. body.weightKg saved', p?.body?.weightKg === 76);
        check('2. mirrored to User.profile.weight', u.weight === 76, `got ${u.weight}`);
        check('2. app settings untouched (waterGoalMl, stepGoal)', u.lifestyle?.waterGoalMl === 2500 && u.lifestyle?.stepGoal === 8000);
        check('2. history = [create, set]', JSON.stringify((await history()).map((h) => h.action)) === '["create","set"]');
        check('2. cache invalidation ran after commit', JSON.stringify(committed) === '[["body"]]');

        // 3. No-op write does not bump version or add history.
        const noop = await svc.updateSection(userId, 'body', { weightKg: 76 }, { source: 'manual' });
        check('3. no-op write changes nothing', noop.changed === false && (await profile()).version === 1 && (await history()).length === 2);

        // 4. addItem + case-insensitive duplicate updates instead of adding.
        const { value: medId } = await svc.addItem(userId, 'medications', { name: 'Metformin', dose: '500mg' }, { source: 'chat' });
        u = await legacy();
        check('4. addItem saved and mirrored', Boolean(medId) && JSON.stringify(u.medicalHistory?.currentMedications) === '["Metformin 500mg"]',
            JSON.stringify(u.medicalHistory?.currentMedications));
        await svc.addItem(userId, 'medications', { name: 'metformin', dose: '1000mg' }, { source: 'chat' });
        p = await profile();
        check('4. duplicate (different case) updated, not added', p.medications.items.length === 1 && p.medications.items[0].dose === '1000mg');

        // 5. markNone refused while items exist; removing the last item -> missing.
        const noneErr = await errorOf(() => svc.markNone(userId, 'allergies', { source: 'chat' }));
        check('5. markNone refused while allergies exist (400)', noneErr?.status === 400);
        const peanutId = (await profile()).allergies.items[0]._id;
        await svc.removeItem(userId, 'allergies', peanutId, { source: 'manual' });
        p = await profile();
        u = await legacy();
        check('5. removing last allergy -> state missing, mirror empty', p.allergies.state === 'missing' && (u.allergies || []).length === 0);
        await svc.markNone(userId, 'allergies', { source: 'chat' });
        check('5. markNone allowed once empty', (await profile()).allergies.state === 'none');

        // 6. Stale expectedVersion -> 409 (real replaceOne version guard path).
        const current = (await profile()).version;
        const stale = await errorOf(() => svc.updateSection(userId, 'body', { weightKg: 75 }, { source: 'manual', expectedVersion: current - 1 }));
        check('6. stale expectedVersion rejected with 409', stale?.status === 409, stale?.message);

        // 7. Concurrent writes both land (Mongo transaction retry on write conflict).
        await Promise.all([
            svc.addItem(userId, 'conditions', { name: 'Hypertension' }, { source: 'chat' }),
            svc.addItem(userId, 'surgeries', { name: 'Appendectomy' }, { source: 'manual' }),
            svc.updateSection(userId, 'lifestyle', { stressLevel: 'high' }, { source: 'chat' }),
        ]);
        p = await profile();
        check('7. three concurrent writes all saved',
            p.conditions.items.some((c) => c.name === 'Hypertension')
            && p.surgeries.items.some((s) => s.name === 'Appendectomy')
            && p.lifestyle?.stressLevel === 'high',
            `version ${p.version}`);

        // 8. Undo of a set restores the old value; older change blocked by newer.
        await svc.updateSection(userId, 'body', { weightKg: 74 }, { source: 'manual' });
        const sets = (await history()).filter((h) => h.field === 'body.weightKg' && h.action === 'set');
        const older = await errorOf(() => svc.undo(userId, sets[0]._id));
        check('8. undo of an older change blocked (400)', older?.status === 400);
        await svc.undo(userId, sets[sets.length - 1]._id);
        u = await legacy();
        check('8. undo restored weight 76 in profile and mirror', (await profile()).body.weightKg === 76 && u.weight === 76, `mirror ${u.weight}`);

        // 9. createFromOnboarding refuses when a profile exists; unique index blocks a raw duplicate.
        const dup = await errorOf(() => svc.createFromOnboarding(userId, { profile: {} }, { source: 'manual' }));
        check('9. createFromOnboarding on existing profile -> 409', dup?.status === 409);
        const raw = await errorOf(() => HealthProfile.collection.insertOne({ user: userId, version: 1 }));
        check('9. unique index on user blocks a second profile doc', raw?.code === 11000, raw ? `code ${raw.code}` : 'insert succeeded!');

        // ── profileSync bridge (what the controllers now call) ──────────────
        const { createProfileSync } = require('../modules/health-profile/services/profileSync');
        const { mongoRepo } = require('../modules/health-profile/services/profileRepo');
        const flag = { on: true };
        const sync = createProfileSync({ service: svc, repo: mongoRepo, invalidate: async () => {}, enabled: () => flag.on });
        // A caller's own User fields (User.nutritionGoal was removed 26 Nov; the
        // goal lives in HealthGoal, so the caller patch here is BMI only).
        const callerPatch = { $set: { 'healthMetrics.bmi': 25.2 } };

        // 10. Health goal style write: caller patch + age/height/weight/target in one transaction.
        await sync.writeWithUser(userId, {
            basic: { age: 34 }, body: { heightCm: 177, weightKg: 79 }, goals: { targetWeightKg: 66 },
        }, callerPatch, { source: 'manual' });
        p = await profile();
        let full = await User.findById(userId).select('profile healthMetrics').lean();
        check('10. writeWithUser saved profile facts', p.basic.age === 34 && p.body.heightCm === 177 && p.body.weightKg === 79 && p.goals.targetWeightKg === 66);
        check('10. ...mirror + caller patch on the real User',
            full.profile.age === 34 && full.profile.weight === 79 && full.healthMetrics?.bmi === 25.2,
            JSON.stringify({ age: full.profile.age, w: full.profile.weight, bmi: full.healthMetrics?.bmi }));

        // 11. Kill switch off: legacy write + caller patch still work on real Mongo.
        flag.on = false;
        const offErr = await errorOf(() => sync.writeWithUser(userId, { body: { weightKg: 81 }, goals: { targetWeightKg: 65 } },
            { $set: { 'healthMetrics.bmi': 25.9 } }, { source: 'manual' }));
        full = await User.findById(userId).select('profile healthMetrics').lean();
        check('11. kill switch off: legacy write works on real Mongo (no $set conflict)', !offErr && full.profile.weight === 81 && full.healthMetrics?.bmi === 25.9, offErr?.message);
        check('11. ...and HealthProfile was not touched', (await profile()).body.weightKg === 79);
        flag.on = true;

        // 12. Smart scale inside a real outer transaction (like the wearable sync).
        const outer = await mongoose.startSession();
        try {
            await outer.withTransaction(async () => {
                await sync.setDeviceWeight(userId, '77.4', { session: outer });
            });
        } finally {
            await outer.endSession();
        }
        p = await profile();
        u = await legacy();
        check('12. device weight via outer session committed', p.body.weightKg === 77.4 && p.body.meta.source === 'device' && u.weight === 77.4, `profile ${p.body.weightKg}, mirror ${u.weight}`);

        // 13. Outer transaction aborts -> device weight rolled back.
        const outer2 = await mongoose.startSession();
        const aborted = await errorOf(() => outer2.withTransaction(async () => {
            await sync.setDeviceWeight(userId, 70, { session: outer2 });
            throw new Error('later sync step failed');
        }).finally(() => outer2.endSession()));
        check('13. aborted outer transaction rolls back device weight', Boolean(aborted) && (await profile()).body.weightKg === 77.4 && (await legacy()).weight === 77.4);

        // 14. Bad device reading skipped, nothing written.
        const vBefore = (await profile()).version;
        const skipped = await sync.setDeviceWeight(userId, 900);
        check('14. 900 kg device reading skipped', skipped.synced === false && (await profile()).version === vBefore && (await legacy()).weight === 77.4);

        // ── /api/health-profile controller on real Mongo (no Redis: caches stubbed) ──
        const { createHealthProfileController } = require('../modules/health-profile/controllers/healthProfileController');
        const { createProfileReadService } = require('../modules/health-profile/services/profileContextService');
        const { createProfileSideEffects } = require('../modules/health-profile/services/profileSideEffects');
        const noCache = { getOrSet: async (k, fn) => fn(), delete: async () => {} };
        const api = createHealthProfileController({
            write: svc,
            read: createProfileReadService({ service: svc, cache: noCache }),
            sideEffects: createProfileSideEffects({ cache: noCache }),
        });
        const call = async (handler, { params = {}, body = {}, query = {} } = {}) => {
            const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
            await api[handler]({ user: { _id: userId }, params, body, query, method: 'SMOKE', originalUrl: handler }, res);
            return res;
        };

        // 15. GET
        const got = await call('getProfile');
        check('15. GET returns the profile with version and item ids',
            got.statusCode === 200 && got.body.exists === true && got.body.version === (await profile()).version
            && got.body.profile.conditions.items.every((i) => i._id) && got.body.profile.user === undefined,
            `status ${got.statusCode}, version ${got.body?.version}`);

        // 16. PATCH with version; stale version -> 409
        const patched = await call('updateSection', { params: { section: 'body' }, body: { data: { weightKg: 75.5 }, version: got.body.version } });
        const stale409 = await call('updateSection', { params: { section: 'body' }, body: { data: { weightKg: 75 }, version: got.body.version } });
        check('16. PATCH body with current version saved', patched.statusCode === 200 && patched.body.profile.body.weightKg === 75.5 && (await legacy()).weight === 75.5);
        check('16. ...same version again -> 409', stale409.statusCode === 409, `status ${stale409.statusCode}`);

        // 17. Side effects on real models: BMI recalculated; no User.nutritionGoal written (removed 26 Nov)
        full = await User.findById(userId).select('profile healthMetrics').lean();
        const rawUser = await User.collection.findOne({ _id: new mongoose.Types.ObjectId(String(userId)) }, { projection: { nutritionGoal: 1 } });
        const expectedBmi = Number((75.5 / Math.pow(full.profile.height / 100, 2)).toFixed(1));
        check('17. side effects: BMI updated from the new weight', full.healthMetrics?.bmi === expectedBmi, `bmi ${full.healthMetrics?.bmi}, expected ${expectedBmi}`);
        check('17. ...no User.nutritionGoal written', !rawUser?.nutritionGoal, JSON.stringify(rawUser?.nutritionGoal));

        // 18. POST item; forged provenance rejected
        const forged = await call('addItem', { params: { section: 'allergies' }, body: { item: { allergen: 'Shellfish', source: 'device' } } });
        const added = await call('addItem', { params: { section: 'allergies' }, body: { item: { allergen: 'Shellfish', severity: 'severe', type: 'food' } } });
        const shellfish = (await profile()).allergies.items.find((i) => i.allergen === 'Shellfish');
        check('18. forged source rejected (400), real item saved as manual',
            forged.statusCode === 400 && added.statusCode === 200 && String(added.body.itemId) === String(shellfish?._id) && shellfish.source === 'manual' && shellfish.severity === 'severe');

        // 19. History pagination on real ObjectIds
        const page1 = await call('getHistory', { query: { limit: '2' } });
        const page2 = await call('getHistory', { query: { limit: '2', before: String(page1.body.nextBefore) } });
        const ids = [...page1.body.history, ...page2.body.history].map((h) => String(h.id));
        check('19. history newest first, pages do not overlap',
            page1.body.history[0]?.field === 'allergies' && page1.body.history[0].action === 'add_item'
            && page2.body.history.length === 2 && new Set(ids).size === 4 && ids[0] > ids[3]);

        // 20. Undo via API
        const undone = await call('undo', { params: { historyId: String(page1.body.history[0].id) } });
        check('20. undo via API removes the item and its mirror',
            undone.statusCode === 200 && !(await profile()).allergies.items.some((i) => i.allergen === 'Shellfish')
            && !((await legacy()).allergies || []).includes('Shellfish'));

        // 21. Completeness
        const comp = await call('getCompleteness');
        check('21. completeness returns percent + missing list', comp.statusCode === 200 && comp.body.percent > 0 && Array.isArray(comp.body.missing), `${comp.body?.percent}%`);

        // ── 5b: old app profile edit (legacy save, then syncFromLegacy) ─────
        await svc.updateSection(userId, 'basic', { dateOfBirth: new Date('1990-05-17T00:00:00Z') }, { source: 'manual' });
        await svc.addItem(userId, 'allergies', { allergen: 'Peanut', severity: 'severe', reaction: 'swelling' }, { source: 'chat' });

        // 22. Nothing changed in legacy -> nothing written (real Date/number types from Mongo).
        //     The target weight has no legacy copy since 26 Nov (User.nutritionGoal removed),
        //     so check 11's legacy-only write could not move it.
        await svc.syncFromLegacy(userId);
        check('22. target weight not taken from a legacy copy (none since 26 Nov)', (await profile()).goals.targetWeightKg === 66);
        const vNoop = (await profile()).version;
        const noopSync = await svc.syncFromLegacy(userId);
        check('22. sync with unchanged legacy data writes nothing', noopSync.changed === false && (await profile()).version === vNoop,
            `changed ${noopSync.changed}, sections ${JSON.stringify(noopSync.sections)}`);

        // 23. Old app adds an allergy + changes weight (saves User.profile directly, like updateProfile)
        await User.updateOne({ _id: userId }, { $set: { 'profile.allergies': ['Peanut', 'Dust'], 'profile.weight': 74.5 } });
        const legacySync = await sync.syncLegacyEdit(userId);
        p = await profile();
        const peanutItem = p.allergies.items.find((i) => i.allergen === 'Peanut');
        check('23. old-app edit synced: Dust added, weight 74.5',
            legacySync.synced && p.allergies.items.some((i) => i.allergen === 'Dust') && p.body.weightKg === 74.5,
            JSON.stringify(legacySync.sections));
        check('23. ...Peanut kept its severity and reaction', peanutItem?.severity === 'severe' && peanutItem?.reaction === 'swelling');
        check('23. ...facts match after sync', require('../modules/health-profile/services/profileMigration').compareFacts(
            await User.findById(userId).select('profile').lean(), p).length === 0);
    } finally {
        if (KEEP) {
            console.log(`\n--keep: left user ${userId} and its profile/history on staging.`);
        } else {
            const [h, pr] = await Promise.all([
                ProfileHistory.deleteMany({ user: userId }),
                HealthProfile.deleteMany({ user: userId }),
            ]);
            await User.deleteOne({ _id: userId });
            console.log(`\nCleanup: deleted 1 user, ${pr.deletedCount} profile(s), ${h.deletedCount} history row(s) from staging.`);
        }
    }

    console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
}

main()
    .catch((err) => {
        failures += 1;
        console.error('\nSmoke test crashed:', err);
    })
    .finally(async () => {
        await mongoose.disconnect().catch(() => {});
        process.exit(failures ? 1 : 0);
    });
