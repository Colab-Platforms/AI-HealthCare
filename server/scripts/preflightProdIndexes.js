/**
 * READ-ONLY preflight before running backfillNudgePeriodKey.js / syncIndexes.js.
 * Writes nothing. Works against whichever DB the same rule as the other scripts
 * picks (USE_STAGING_DB=true -> staging, otherwise MONGODB_URI) and prints it first.
 *
 *     node scripts/preflightProdIndexes.js
 *
 * Reports what could make the index steps fail or surprise you:
 *   - NudgeLog: row counts, rows lacking periodKey, which indexes exist
 *   - ExerciseLog: real (userId, sourceRecordId) duplicates among string ids
 *     (these would make the new partial unique index fail to build)
 *   - AIAnalysis: collection size (syncIndexes will build 3 indexes on it)
 */
const mongoose = require('mongoose');
const dns = require('dns');
const dotenv = require('dotenv');

dotenv.config();

const useStaging = process.env.USE_STAGING_DB === 'true';
const uri = useStaging ? process.env.MONGODB_URI_STAGING : process.env.MONGODB_URI;

async function ensureSrvResolvable(u) {
    if (!u.startsWith('mongodb+srv://')) return;
    const host = new URL(u).hostname;
    try {
        await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
    } catch (e) {
        dns.setServers(['8.8.8.8', '1.1.1.1']);
        await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
    }
}

const indexNames = async (coll) => {
    try { return (await coll.indexes()).map((i) => i.name); } catch (e) { return [`(unreadable: ${e.message})`]; }
};

async function run() {
    if (!uri) throw new Error(`${useStaging ? 'MONGODB_URI_STAGING' : 'MONGODB_URI'} is not set`);
    await ensureSrvResolvable(uri);
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    console.log(`Connected to ${mongoose.connection.host}/${db.databaseName} [${useStaging ? 'STAGING' : 'PRODUCTION'}]`);
    console.log('MODE: READ-ONLY (nothing is written)\n');

    console.log('=== NudgeLog ===');
    const nl = db.collection('nudgelogs');
    const [total, noKey] = await Promise.all([
        nl.estimatedDocumentCount(),
        nl.countDocuments({ periodKey: { $exists: false } }),
    ]);
    console.log(`rows: ${total} | without periodKey: ${noKey}`);
    console.log('indexes:', (await indexNames(nl)).join(', '));

    console.log('\n=== ExerciseLog ===');
    const el = db.collection('exerciselogs');
    console.log('rows:', await el.estimatedDocumentCount());
    console.log('indexes:', (await indexNames(el)).join(', '));
    const dups = await el.aggregate([
        { $match: { sourceRecordId: { $type: 'string' } } },
        { $group: { _id: { u: '$userId', s: '$sourceRecordId' }, n: { $sum: 1 } } },
        { $match: { n: { $gt: 1 } } },
        { $limit: 10 },
    ], { allowDiskUse: true }).toArray();
    console.log(dups.length
        ? `DUPLICATES FOUND (index build would FAIL) - first ${dups.length}:\n${JSON.stringify(dups, null, 2)}`
        : 'duplicate (userId, sourceRecordId) among string ids: none  -> partial unique index will build');

    console.log('\n=== AIAnalysis ===');
    const ai = db.collection('aianalyses');
    console.log('rows:', await ai.estimatedDocumentCount());
    console.log('indexes:', (await indexNames(ai)).join(', '));

    console.log('\nDone.');
    await mongoose.disconnect();
}

run().catch(async (err) => {
    console.error('preflight failed:', err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
