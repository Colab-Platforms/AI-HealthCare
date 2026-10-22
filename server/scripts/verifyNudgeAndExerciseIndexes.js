/**
 * One-off STAGING verification (refuses to run unless USE_STAGING_DB=true):
 *
 *   1. ExerciseLog indexes as they exist right now        (read-only)
 *   2. Real duplicate (userId, sourceRecordId) strings    (read-only)
 *   3. NudgeLog backfill end-to-end: inserts 2 dummy inactivity rows, runs the
 *      real backfillNudgePeriodKey.js --apply, prints their periodKey, then
 *      deletes exactly those 2 rows (by their own _ids), even if a step fails.
 *
 *     node scripts/verifyNudgeAndExerciseIndexes.js
 */
const mongoose = require('mongoose');
const dns = require('dns');
const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');

dotenv.config();

if (process.env.USE_STAGING_DB !== 'true' || !process.env.MONGODB_URI_STAGING) {
    console.error('Refusing to run: set USE_STAGING_DB=true and MONGODB_URI_STAGING in .env (staging only).');
    process.exit(1);
}

async function ensureSrvResolvable(uri) {
    if (!uri.startsWith('mongodb+srv://')) return;
    const host = new URL(uri).hostname;
    try {
        await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
    } catch (e) {
        dns.setServers(['8.8.8.8', '1.1.1.1']);
        await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
    }
}

async function run() {
    await ensureSrvResolvable(process.env.MONGODB_URI_STAGING);
    await mongoose.connect(process.env.MONGODB_URI_STAGING);
    const db = mongoose.connection.db;
    console.log(`Connected to ${mongoose.connection.host}/${db.databaseName} [STAGING]\n`);

    // 1 ─ ExerciseLog indexes
    console.log('=== 1. ExerciseLog indexes ===');
    console.log(JSON.stringify(await db.collection('exerciselogs').indexes(), null, 2));

    // 2 ─ real duplicates among string sourceRecordIds
    console.log('\n=== 2. Duplicate (userId, sourceRecordId) among string ids ===');
    const dups = await db.collection('exerciselogs').aggregate([
        { $match: { sourceRecordId: { $type: 'string' } } },
        { $group: { _id: { u: '$userId', s: '$sourceRecordId' }, n: { $sum: 1 } } },
        { $match: { n: { $gt: 1 } } },
        { $limit: 10 },
    ]).toArray();
    console.log(dups.length ? JSON.stringify(dups, null, 2) : 'none');

    const manualDupUsers = await db.collection('exerciselogs').aggregate([
        { $match: { sourceRecordId: null } },
        { $group: { _id: '$userId', n: { $sum: 1 } } },
        { $match: { n: { $gt: 1 } } },
        { $count: 'usersWithMultipleManualLogs' },
    ]).toArray();
    console.log('users with 2+ logs lacking sourceRecordId (what broke the index):',
        manualDupUsers[0]?.usersWithMultipleManualLogs ?? 0);

    // 3 ─ backfill end to end
    console.log('\n=== 3. NudgeLog $isoWeek backfill ===');
    const nudgelogs = db.collection('nudgelogs');
    const userId = new mongoose.Types.ObjectId();
    const { insertedIds } = await nudgelogs.insertMany([
        { userId, type: 'inactivity_7d', sentAt: new Date('2026-10-21T10:00:00Z') }, // expect 2026-W43
        { userId, type: 'inactivity_7d', sentAt: new Date('2026-01-02T10:00:00Z') }, // expect 2026-W01
    ]);
    const ids = Object.values(insertedIds);
    try {
        const r = spawnSync(process.execPath, [path.join(__dirname, 'backfillNudgePeriodKey.js'), '--apply'], {
            stdio: 'inherit',
            env: process.env,
        });
        if (r.status !== 0) console.error('backfill script exited with', r.status);

        const rows = await nudgelogs.find({ _id: { $in: ids } }).sort({ sentAt: -1 }).toArray();
        for (const row of rows) console.log(`${row.sentAt.toISOString()}  ->  periodKey: ${row.periodKey}`);
        const got = rows.map((x) => x.periodKey);
        console.log(got[0] === '2026-W43' && got[1] === '2026-W01' ? 'RESULT: OK' : 'RESULT: MISMATCH (expected 2026-W43, 2026-W01)');
    } finally {
        const del = await nudgelogs.deleteMany({ _id: { $in: ids } });
        console.log(`cleanup: deleted ${del.deletedCount} dummy row(s)`);
    }

    await mongoose.disconnect();
}

run().catch(async (err) => {
    console.error('verify script failed:', err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
