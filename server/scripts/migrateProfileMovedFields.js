/**
 * Backfill the 19 keys moved to HealthProfile on 26 Nov:
 *   User.profile.diabetesProfile.*   -> HealthProfile.diabetes.*
 *   User.profile.dietPreferences.*   -> HealthProfile.diet.{cuisinePreference, mealsPerDay, restrictions}
 *   User.profile.fitnessProfile.*    -> HealthProfile.fitness.{preferredExercise, primaryGoal, biggestChallenge}
 *                                       + goals.timeline (timeframe)
 *
 * Only fills keys that are EMPTY in HealthProfile (a value already there, e.g.
 * from the coach, is never overwritten). Users without a HealthProfile are
 * skipped (run migrateHealthProfile.js --apply first: it builds the whole
 * profile, these keys included). Idempotent. Writes go through
 * ProfileWriteService (history, source "migration").
 *
 * Order: deploy -> migrateHealthProfile.js --apply -> THIS --apply ->
 * HEALTH_PROFILE_ONLY=true -> migrateProfileMirror.js --apply.
 *
 *   node scripts/migrateProfileMovedFields.js [--apply] [--user=<id>] [--limit=N]
 * Target DB: USE_STAGING_DB=true -> staging; otherwise production, only with --prod.
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

// HealthProfile section -> keys moved on 26 Nov.
const MOVED = {
    diabetes: null, // all keys of the section
    basic: ['state', 'city', 'country'], // from User.foodPreferences
    diet: ['cuisinePreference', 'mealsPerDay', 'restrictions',
        'region', 'likes', 'dislikes', 'dietaryRestrictions', 'dietaryDo', 'dietaryDont', 'mealPatterns'], // + User.foodPreferences
    fitness: ['preferredExercise', 'primaryGoal', 'biggestChallenge'],
    goals: ['timeline'],
};
const empty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
    || (typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && Object.values(v).every((x) => Array.isArray(x) ? !x.length : x == null));

async function main() {
    await require('../config/db')();
    const dbName = mongoose.connection.name;
    if (useStaging && !/staging$/i.test(dbName)) refuse(`connected database "${dbName}" is not a staging database.`);
    console.log(`\nDB: ${dbName} [${useStaging ? 'STAGING' : 'PRODUCTION'}]  MODE: ${APPLY ? 'APPLY' : 'DRY RUN (writes nothing)'}\n`);

    const User = require('../models/User');
    const HealthProfile = require('../modules/health-profile/models/HealthProfile');
    const { fromLegacyUser } = require('../modules/health-profile/services/profileMapper');
    const { createProfileWriteService } = require('../modules/health-profile/services/profileWriteService');
    const svc = createProfileWriteService();

    const filter = ONE_USER ? { _id: new mongoose.Types.ObjectId(ONE_USER) } : {};
    let cursor = User.collection.find(filter, { projection: { profile: 1, foodPreferences: 1 } }); // raw: the stored copy
    if (LIMIT) cursor = cursor.limit(LIMIT);

    const counts = { filled: 0, nothing_to_fill: 0, no_health_profile: 0, failed: 0 };
    const keysFilled = {};
    for await (const raw of cursor) {
        const hp = await HealthProfile.findOne({ user: raw._id }).lean();
        if (!hp) { counts.no_health_profile++; continue; }
        const candidate = fromLegacyUser(raw, 'migration');
        const patch = {};
        for (const [section, keys] of Object.entries(MOVED)) {
            const from = candidate[section] || {};
            for (const k of keys || Object.keys(from).filter((x) => x !== 'meta')) {
                if (empty(from[k]) || !empty(hp[section]?.[k])) continue;
                (patch[section] = patch[section] || {})[k] = from[k];
                keysFilled[`${section}.${k}`] = (keysFilled[`${section}.${k}`] || 0) + 1;
            }
        }
        if (!Object.keys(patch).length) { counts.nothing_to_fill++; continue; }
        if (APPLY) {
            try {
                await svc.updateSections(raw._id, patch, { source: 'migration' });
            } catch (err) {
                counts.failed++;
                console.log(`  ${raw._id}: not filled (${err.message})`);
                continue;
            }
        }
        counts.filled++;
    }
    console.log(`${APPLY ? 'Filled' : 'Would fill'} ${counts.filled} user(s); nothing to fill: ${counts.nothing_to_fill}; no HealthProfile: ${counts.no_health_profile}; failed: ${counts.failed}`);
    if (Object.keys(keysFilled).length) console.log('Keys:', JSON.stringify(keysFilled));
    await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
