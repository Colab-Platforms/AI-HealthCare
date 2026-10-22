/**
 * Backfill NudgeLog.periodKey on rows written before the field existed.
 *
 *   report nudges (followup_3d, score_drop) -> String(reportId)
 *   inactivity_7d                           -> ISO week of sentAt, e.g. "2026-W43"
 *
 * Same keys nudgeService.periodKeyFor() writes for new rows, so old and new rows
 * share one dedupe identity.
 *
 * Idempotent (only touches rows with no periodKey) and DRY-RUN by default:
 *
 *     node scripts/backfillNudgePeriodKey.js            # counts only
 *     node scripts/backfillNudgePeriodKey.js --apply    # writes
 *
 * Order of operations on a database that already has the new index:
 *   1. run this with --apply
 *   2. NODE_ENV=production node scripts/syncIndexes.js
 *      (autoIndex is off in production; syncIndexes drops the old
 *       userId_1_reportId_1_type_1 index and builds the new one)
 */
const mongoose = require('mongoose');
const dns = require('dns');
const dotenv = require('dotenv');
const NudgeLog = require('../models/NudgeLog');

dotenv.config();

const APPLY = process.argv.includes('--apply');

const resolveMongoUri = () =>
    process.env.USE_STAGING_DB === 'true' ? process.env.MONGODB_URI_STAGING : process.env.MONGODB_URI;

async function ensureSrvResolvable(uri) {
    if (!uri.startsWith('mongodb+srv://')) return;
    const host = new URL(uri).hostname;
    try {
        await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
    } catch (e) {
        console.warn(`Default DNS couldn't resolve the SRV record (${e.code}) — retrying via public DNS (8.8.8.8, 1.1.1.1)...`);
        dns.setServers(['8.8.8.8', '1.1.1.1']);
        await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
    }
}

// $isoWeekYear / $isoWeek evaluate in UTC, matching nudgeService.isoWeekKey.
const isoWeekExpr = {
    $concat: [
        { $toString: { $isoWeekYear: '$sentAt' } },
        '-W',
        { $cond: [{ $lt: [{ $isoWeek: '$sentAt' }, 10] }, '0', ''] },
        { $toString: { $isoWeek: '$sentAt' } },
    ],
};

const missing = { periodKey: { $exists: false } };

async function run() {
    const mongoUri = resolveMongoUri();
    if (!mongoUri) {
        throw new Error('No Mongo URI resolved — check MONGODB_URI / MONGODB_URI_STAGING / USE_STAGING_DB in .env');
    }
    await ensureSrvResolvable(mongoUri);
    await mongoose.connect(mongoUri);
    console.log(`Connected to ${mongoose.connection.host}/${mongoose.connection.name}${process.env.USE_STAGING_DB === 'true' ? ' (STAGING)' : ''}`);
    console.log(APPLY ? 'MODE: APPLY (writing)\n' : 'MODE: DRY RUN (no writes — pass --apply to write)\n');

    const reportFilter = { ...missing, type: { $in: ['followup_3d', 'score_drop'] }, reportId: { $type: 'objectId' } };
    const inactivityFilter = { ...missing, type: 'inactivity_7d', sentAt: { $type: 'date' } };

    const [reportRows, inactivityRows, total, orphaned] = await Promise.all([
        NudgeLog.countDocuments(reportFilter),
        NudgeLog.countDocuments(inactivityFilter),
        NudgeLog.estimatedDocumentCount(),
        // Anything still without a key after the two passes can't be keyed
        // (report nudge with no reportId, or inactivity with no sentAt). Reported, not touched.
        NudgeLog.countDocuments({
            ...missing,
            $nor: [reportFilter, inactivityFilter],
        }),
    ]);

    console.log(`NudgeLog rows total:                 ${total}`);
    console.log(`  report nudges to key (reportId):   ${reportRows}`);
    console.log(`  inactivity nudges to key (week):   ${inactivityRows}`);
    console.log(`  rows that cannot be keyed:         ${orphaned}`);

    if (APPLY) {
        const r1 = await NudgeLog.updateMany(reportFilter, [{ $set: { periodKey: { $toString: '$reportId' } } }]);
        const r2 = await NudgeLog.updateMany(inactivityFilter, [{ $set: { periodKey: isoWeekExpr } }]);
        console.log(`\nUpdated: ${r1.modifiedCount} report rows, ${r2.modifiedCount} inactivity rows`);
    }

    console.log('\nDone.');
    await mongoose.disconnect();
}

run().catch((err) => {
    console.error('backfillNudgePeriodKey failed:', err);
    process.exit(1);
});
