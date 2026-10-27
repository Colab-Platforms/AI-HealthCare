/**
 * Backfill the FCMToken collection from the legacy User.fcmToken field.
 *
 * POST /users/fcm-token (the mobile app's launch-time registration) used to
 * write only User.fcmToken. Every push sender reads FCMToken, so those users
 * had a token on file that no push was ever sent to. The route is fixed now;
 * this recovers the users it already affected without waiting for each of them
 * to reopen the app.
 *
 * Idempotent (skips tokens already in FCMToken, never overwrites an existing
 * row) and DRY-RUN by default:
 *
 *     node scripts/backfillFcmTokens.js            # counts only
 *     node scripts/backfillFcmTokens.js --apply    # writes
 *
 * Platform isn't recorded on the legacy field, so rows are stamped 'android'.
 * Senders never branch on platform; the next real registration corrects it.
 */
const mongoose = require('mongoose');
const dns = require('dns');
const dotenv = require('dotenv');
const User = require('../models/User');
const FCMToken = require('../models/FCMToken');
const { normalizeToken } = require('../services/fcmTokenService');

dotenv.config();

const APPLY = process.argv.includes('--apply');
const BATCH = 500;

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

async function flush(batch, stats) {
    if (batch.length === 0) return;

    const tokens = batch.map((u) => u.token);
    const existing = new Set(
        (await FCMToken.find({ token: { $in: tokens } }).select('token').lean()).map((d) => d.token)
    );
    const missing = batch.filter((u) => !existing.has(u.token));

    stats.alreadyPresent += batch.length - missing.length;
    stats.toInsert += missing.length;

    if (APPLY && missing.length) {
        // $setOnInsert: a row that appeared between the check and the write is left alone.
        const ops = missing.map((u) => ({
            updateOne: {
                filter: { token: u.token },
                update: { $setOnInsert: { userId: u.userId, platform: 'android', deviceLabel: 'Unknown Device', isActive: true, lastUsedAt: new Date() } },
                upsert: true,
            },
        }));
        await FCMToken.bulkWrite(ops, { ordered: false });
    }
}

async function run() {
    const mongoUri = resolveMongoUri();
    if (!mongoUri) {
        throw new Error('No Mongo URI resolved — check MONGODB_URI / MONGODB_URI_STAGING / USE_STAGING_DB in .env');
    }
    await ensureSrvResolvable(mongoUri);
    await mongoose.connect(mongoUri);
    console.log(`Connected to ${mongoose.connection.host}/${mongoose.connection.name}${process.env.USE_STAGING_DB === 'true' ? ' (STAGING)' : ''}`);
    console.log(APPLY ? 'MODE: APPLY (writing)\n' : 'MODE: DRY RUN (no writes — pass --apply to write)\n');

    const stats = { scanned: 0, invalid: 0, duplicateOnUsers: 0, alreadyPresent: 0, toInsert: 0 };
    const seen = new Set();
    let batch = [];

    const cursor = User.find({ fcmToken: { $type: 'string', $ne: '' } }).select('_id fcmToken').lean().cursor();
    for await (const user of cursor) {
        stats.scanned++;
        const token = normalizeToken(user.fcmToken);
        if (!token) { stats.invalid++; continue; }
        // Same token on two User rows (shared device): FCMToken.token is unique, keep the first.
        if (seen.has(token)) { stats.duplicateOnUsers++; continue; }
        seen.add(token);

        batch.push({ userId: user._id, token });
        if (batch.length >= BATCH) {
            await flush(batch, stats);
            batch = [];
        }
    }
    await flush(batch, stats);

    console.log(`Users with a legacy fcmToken:        ${stats.scanned}`);
    console.log(`  malformed / too short (skipped):   ${stats.invalid}`);
    console.log(`  same token on several users:       ${stats.duplicateOnUsers}`);
    console.log(`  already in FCMToken:               ${stats.alreadyPresent}`);
    console.log(`  ${APPLY ? 'inserted' : 'to insert'}:                          ${stats.toInsert}`);

    console.log('\nDone.');
    await mongoose.disconnect();
}

run().catch((err) => {
    console.error('backfillFcmTokens failed:', err);
    process.exit(1);
});
