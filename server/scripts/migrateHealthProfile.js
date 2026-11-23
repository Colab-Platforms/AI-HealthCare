/**
 * Backfill: create a HealthProfile for every existing user from their legacy
 * User.profile. Idempotent: users who already have one are skipped, so it is
 * safe to re-run (and to run while the app is live; writes go through the
 * same ProfileWriteService.ensureProfile the app uses).
 *
 * Run from server/:
 *
 *   node scripts/migrateHealthProfile.js                    # DRY RUN: report only, writes nothing
 *   node scripts/migrateHealthProfile.js --apply            # create missing profiles
 *   node scripts/migrateHealthProfile.js --verify           # compare User.profile vs HealthProfile for users that have one
 *   node scripts/migrateHealthProfile.js --sample=10        # also print 10 users' facts side by side
 *   node scripts/migrateHealthProfile.js --limit=50         # only the first 50 users (trial run)
 *   node scripts/migrateHealthProfile.js --user=<userId>    # one user
 *
 * Target DB (same rule as the other scripts):
 *   USE_STAGING_DB=true  -> MONGODB_URI_STAGING; the db name must end with "staging"
 *   otherwise            -> MONGODB_URI (production); refused unless --prod is passed
 *
 * --apply also refuses to run unless the unique index on health_profiles.user
 * exists (production has autoIndex off). Create it first with:
 *   node scripts/syncIndexes.js --only=HealthProfile,ProfileHistory
 *
 * Output has user ids only, never names or emails.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
    const a = args.find((x) => x.startsWith(`--${name}=`));
    return a ? a.slice(name.length + 3) : undefined;
};

const APPLY = flag('apply');
const VERIFY = flag('verify');
const PROD = flag('prod');
const LIMIT = value('limit') ? Number(value('limit')) : 0;
const SAMPLE = value('sample') ? Number(value('sample')) : 0;
const ONE_USER = value('user');
const useStaging = process.env.USE_STAGING_DB === 'true';

function refuse(msg) {
    console.error(`Refusing to run: ${msg}`);
    process.exit(1);
}

if (!useStaging && !PROD) refuse('this targets PRODUCTION (USE_STAGING_DB is not true). Pass --prod if you mean it.');
if (useStaging && !process.env.MONGODB_URI_STAGING) refuse('USE_STAGING_DB=true but MONGODB_URI_STAGING is not set.');
if (LIMIT && (!Number.isInteger(LIMIT) || LIMIT < 1)) refuse('--limit must be a positive integer.');
if (SAMPLE && (!Number.isInteger(SAMPLE) || SAMPLE < 1)) refuse('--sample must be a positive integer.');
if (ONE_USER && !mongoose.isValidObjectId(ONE_USER)) refuse('--user must be a valid user id.');

async function main() {
    const connectDB = require('../config/db');
    await connectDB();
    const dbName = mongoose.connection.name;
    if (useStaging && !/staging$/i.test(dbName)) refuse(`connected database "${dbName}" is not a staging database.`);
    console.log(`\nDB: ${mongoose.connection.host} / ${dbName} [${useStaging ? 'STAGING' : 'PRODUCTION'}]`);
    console.log(`MODE: ${APPLY ? 'APPLY (creates missing profiles)' : 'DRY RUN (writes nothing)'}${VERIFY ? ' + VERIFY' : ''}\n`);

    const User = require('../models/User');
    const HealthProfile = require('../modules/health-profile/models/HealthProfile');
    const { createProfileWriteService } = require('../modules/health-profile/services/profileWriteService');
    const { migrateOne, compareFacts } = require('../modules/health-profile/services/profileMigration');

    if (APPLY) {
        const indexes = await HealthProfile.collection.indexes().catch(() => []);
        const unique = indexes.some((i) => i.unique && JSON.stringify(i.key) === JSON.stringify({ user: 1 }));
        if (!unique) refuse('unique index on health_profiles.user is missing. Run: node scripts/syncIndexes.js --only=HealthProfile,ProfileHistory');
    }

    // No cache invalidation per user: new profiles have nothing cached, and a
    // SCAN per user would burn Redis quota for nothing.
    const service = createProfileWriteService({ afterCommit: async () => {} });

    const existing = new Set((await HealthProfile.distinct('user')).map(String));
    const filter = { role: { $nin: ['admin', 'superadmin'] } };
    if (ONE_USER) filter._id = ONE_USER;
    let query = User.find(filter).select('_id profile nutritionGoal').sort({ _id: 1 }).lean();
    if (LIMIT) query = query.limit(LIMIT);

    const counts = { scanned: 0, exists: 0, would_create: 0, created: 0, invalid: 0, error: 0, mismatched: 0 };
    const invalid = [];
    const errors = [];
    const mismatches = [];
    let sampled = 0;
    const started = Date.now();

    for await (const user of query.cursor()) {
        counts.scanned++;
        const id = String(user._id);
        const had = existing.has(id);
        const res = await migrateOne(user, { existing: had, apply: APPLY, service });
        counts[res.status]++;
        if (res.status === 'invalid') invalid.push({ userId: id, reasons: res.reasons });
        if (res.status === 'error') errors.push({ userId: id, reasons: res.reasons });

        const hasProfileNow = had || res.status === 'created';
        if ((VERIFY || SAMPLE) && hasProfileNow) {
            const hp = await HealthProfile.findOne({ user: user._id }).lean();
            const diff = hp ? compareFacts(user, hp) : [{ field: '*', legacy: 'user', profile: null }];
            if (diff.length) {
                counts.mismatched++;
                mismatches.push({ userId: id, diff });
            }
            if (sampled < SAMPLE && hp) {
                sampled++;
                console.log(`  sample ${id}: weight ${user.profile?.weight ?? '-'} -> ${hp.body?.weightKg ?? '-'}, `
                    + `allergies ${(user.profile?.allergies || []).length} -> ${hp.allergies?.items?.length || 0}, `
                    + `conditions -> ${hp.conditions?.items?.length || 0} (${hp.conditions?.state}), `
                    + `medications ${(user.profile?.medicalHistory?.currentMedications || []).length} -> ${hp.medications?.items?.length || 0}`
                    + `${diff.length ? `  MISMATCH ${diff.map((d) => d.field).join(',')}` : ''}`);
            }
        }
        if (counts.scanned % 200 === 0) console.log(`  ... ${counts.scanned} users (${Math.round((Date.now() - started) / 1000)}s)`);
    }

    console.log('\nSummary');
    for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(13)} ${v}`);

    if (invalid.length) {
        console.log(`\nInvalid legacy data (${invalid.length}): no profile possible until fixed`);
        for (const r of invalid.slice(0, 100)) console.log(`  ${r.userId}: ${r.reasons.join(' | ')}`);
        if (invalid.length > 100) console.log(`  ... and ${invalid.length - 100} more`);
    }
    if (errors.length) {
        console.log(`\nErrors (${errors.length}): safe to re-run`);
        for (const r of errors.slice(0, 50)) console.log(`  ${r.userId}: ${r.reasons.join(' | ')}`);
    }
    if (mismatches.length) {
        console.log(`\nUser.profile vs HealthProfile mismatches (${mismatches.length})`);
        for (const m of mismatches.slice(0, 50)) {
            console.log(`  ${m.userId}: ${m.diff.map((d) => `${d.field} ${JSON.stringify(d.legacy)} != ${JSON.stringify(d.profile)}`).join(' ; ')}`);
        }
    }
    if (!APPLY && counts.would_create) console.log(`\nDry run: ${counts.would_create} profile(s) would be created. Re-run with --apply.`);
    return counts.error ? 1 : 0;
}

main()
    .then((code) => { process.exitCode = code; })
    .catch((err) => {
        console.error('\nMigration crashed:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect().catch(() => {});
        process.exit(process.exitCode || 0);
    });
