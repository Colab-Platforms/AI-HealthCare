/**
 * Remove the copy of health facts from User.profile (26 Nov): HealthProfile is
 * the only source; reads build `profile` from it (userProfilePlugin).
 *
 * Order (each step on BOTH Vercel and Render where it is an env var):
 *   1. deploy the code (reads already come from HealthProfile)
 *   2. node scripts/migrateHealthProfile.js --apply          (every user has a HealthProfile)
 *   3. HEALTH_PROFILE_ONLY=true                              (nothing writes the copy any more)
 *   4. node scripts/migrateProfileMirror.js                  (dry run: what would be removed)
 *   5. node scripts/migrateProfileMirror.js --apply          (remove it)
 *
 * Users WITHOUT a HealthProfile are never touched (their stored facts are the
 * only copy): the report lists them; run migrateHealthProfile.js --apply first.
 *
 *   node scripts/migrateProfileMirror.js [--apply] [--user=<id>] [--limit=N]
 *
 * Target DB: USE_STAGING_DB=true -> staging (name must end with "staging");
 * otherwise production, refused unless --prod. Idempotent. Ids only in output.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const value = (n) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : undefined; };
const APPLY = flag('apply');
const PROD = flag('prod');
const LIMIT = value('limit') ? Number(value('limit')) : 0;
const ONE_USER = value('user');
const useStaging = process.env.USE_STAGING_DB === 'true';

function refuse(msg) { console.error(`Refusing to run: ${msg}`); process.exit(1); }
if (!useStaging && !PROD) refuse('this targets PRODUCTION (USE_STAGING_DB is not true). Pass --prod if you mean it.');
if (LIMIT && (!Number.isInteger(LIMIT) || LIMIT < 1)) refuse('--limit must be a positive integer.');
if (ONE_USER && !mongoose.isValidObjectId(ONE_USER)) refuse('--user must be a valid user id.');
if (APPLY && process.env.HEALTH_PROFILE_ONLY !== 'true') {
    console.warn('Warning: HEALTH_PROFILE_ONLY is not "true" in this shell. Make sure it is set on the running servers, or they will write the copy back.\n');
}

async function main() {
    await require('../config/db')();
    const dbName = mongoose.connection.name;
    if (useStaging && !/staging$/i.test(dbName)) refuse(`connected database "${dbName}" is not a staging database.`);
    console.log(`\nDB: ${dbName} [${useStaging ? 'STAGING' : 'PRODUCTION'}]  MODE: ${APPLY ? 'APPLY' : 'DRY RUN (writes nothing)'}\n`);

    const User = require('../models/User');
    const HealthProfile = require('../modules/health-profile/models/HealthProfile');
    // After this, every profile read goes to health_profiles: without the
    // unique index each read is a collection scan (production has autoIndex off).
    const indexes = await HealthProfile.collection.indexes().catch(() => []);
    const unique = indexes.some((i) => i.unique && JSON.stringify(i.key) === JSON.stringify({ user: 1 }));
    if (!unique) {
        if (APPLY) refuse('unique index on health_profiles.user is missing. Run: node scripts/syncIndexes.js --only=HealthProfile,ProfileHistory');
        console.warn('Warning: unique index on health_profiles.user is missing (--apply will refuse).\n');
    }
    const { MIRROR_PATHS } = require('../modules/health-profile/services/userProfilePlugin'); // full paths: profile.* and foodPreferences.*

    const filter = ONE_USER ? { _id: new mongoose.Types.ObjectId(ONE_USER) } : {};
    let cursor = User.collection.find(filter, { projection: { profile: 1, foodPreferences: 1 } });
    if (LIMIT) cursor = cursor.limit(LIMIT);

    const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
    const { KEEP_STORED_PATHS, mirrorValues, MIRRORED_SECTIONS } = require('../modules/health-profile/services/profileMapper');
    const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    const counts = { removed: 0, nothing_stored: 0, no_health_profile: 0 };
    const missing = [];
    const notBackfilled = {};
    for await (const u of cursor) {
        let stored = MIRROR_PATHS.filter((p) => get(u, p) !== undefined);
        if (!stored.length) { counts.nothing_stored++; continue; }
        const hp = await HealthProfile.findOne({ user: u._id }).lean();
        if (!hp) { counts.no_health_profile++; missing.push(String(u._id)); continue; }
        // The 19 keys moved on 26 Nov: removed only once HealthProfile holds them
        // (or the stored value is empty), otherwise the stored copy is the only one.
        const view = Object.assign({}, ...MIRRORED_SECTIONS.map((s) => mirrorValues(hp, s)));
        stored = stored.filter((p) => {
            if (!KEEP_STORED_PATHS.has(p) || isEmpty(get(u, p)) || !isEmpty(view[p])) return true;
            notBackfilled[p] = (notBackfilled[p] || 0) + 1;
            return false;
        });
        if (!stored.length) continue;
        if (APPLY) {
            const $unset = Object.fromEntries(stored.map((p) => [p, '']));
            await User.collection.updateOne({ _id: u._id }, { $unset });
        }
        counts.removed++;
    }
    console.log(`${APPLY ? 'Removed' : 'Would remove'} the health copy from ${counts.removed} user(s); ${counts.nothing_stored} had none.`);
    if (Object.keys(notBackfilled).length) {
        console.log(`Kept (not in HealthProfile yet, run migrateProfileMovedFields.js --apply first): ${JSON.stringify(notBackfilled)}`);
    }
    if (missing.length) {
        console.log(`${missing.length} user(s) have NO HealthProfile and were left alone (run migrateHealthProfile.js --apply first):`);
        console.log(`  ${missing.slice(0, 50).join('\n  ')}${missing.length > 50 ? '\n  ...' : ''}`);
    }
    if (APPLY) require('../utils/userCache').clear?.();
    await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
