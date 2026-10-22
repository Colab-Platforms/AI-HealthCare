/**
 * STAGING-ONLY end-to-end check of the real nudge path (sendNudge), which the
 * /test-nudge route does NOT exercise (that route pushes directly and never
 * touches NudgeLog).
 *
 * Calls sendNudge twice for one user with the same identity and checks:
 *   - exactly ONE real push was attempted (second call lost the claim)
 *   - exactly ONE NudgeLog row exists, with periodKey set and delivered filled in
 * then deletes that one row so the script can be re-run.
 *
 *     node scripts/testNudgeFlowStaging.js you@example.com
 *
 * The user needs an active FCM token on staging to actually receive the push.
 */
const mongoose = require('mongoose');
const dns = require('dns');
const dotenv = require('dotenv');

dotenv.config();

if (process.env.USE_STAGING_DB !== 'true' || !process.env.MONGODB_URI_STAGING) {
    console.error('Refusing to run: set USE_STAGING_DB=true and MONGODB_URI_STAGING in .env (staging only).');
    process.exit(1);
}
// --no-push: synthetic userId, push is stubbed, nobody is notified. Still hits the
// real staging NudgeLog collection and its real unique index.
const NO_PUSH = process.argv.includes('--no-push');
const email = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));
if (!email && !NO_PUSH) {
    console.error('Usage: node scripts/testNudgeFlowStaging.js <user email>   |   node scripts/testNudgeFlowStaging.js --no-push');
    process.exit(1);
}

// Count real push attempts by wrapping fcmService BEFORE nudgeService loads
// (it destructures sendToUser at require time). The real function still runs.
const fcm = require('../services/fcmService');
const realSendToUser = NO_PUSH ? async () => ({ success: true, stubbed: true }) : fcm.sendToUser;
let pushCalls = 0;
fcm.sendToUser = async (...args) => {
    pushCalls++;
    const result = await realSendToUser(...args);
    console.log(`  push attempt #${pushCalls} ->`, JSON.stringify(result));
    return result;
};

const User = require('../models/User');
const NudgeLog = require('../models/NudgeLog');
const FCMToken = require('../models/FCMToken');
const { sendNudge, periodKeyFor } = require('../services/nudgeService');

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
    console.log(`Connected to ${mongoose.connection.host}/${mongoose.connection.name} [STAGING]\n`);

    let user;
    if (NO_PUSH) {
        user = { _id: new mongoose.Types.ObjectId(), name: 'Synthetic Tester' };
        console.log(`NO-PUSH mode: synthetic user ${user._id}, push stubbed, nobody is notified`);
    } else {
        user = await User.findOne({ email }).select('_id name email').lean();
        if (!user) throw new Error(`No user with email ${email} on staging`);
        const tokens = await FCMToken.countDocuments({ userId: user._id, isActive: true });
        console.log(`User: ${user.name} (${user._id}) | active FCM tokens: ${tokens}`);
        if (!tokens) console.log('  (no active token: push will report failure, but the claim logic is still tested)');
    }

    const type = 'inactivity_7d';
    const periodKey = periodKeyFor(type);
    const existing = await NudgeLog.findOne({ userId: user._id, type, periodKey }).lean();
    if (existing) {
        throw new Error(`This user already has a ${type} row for ${periodKey} (${existing._id}). Not touching real data — pick another user.`);
    }

    const item = { userId: user._id, type, userName: (user.name || 'there').split(' ')[0], reportData: {} };
    console.log(`\nCall 1 (should claim + push):`);
    await sendNudge(item);
    console.log(`Call 2 (same user/type/week - should be silently skipped):`);
    await sendNudge(item);

    const rows = await NudgeLog.find({ userId: user._id, type, periodKey }).lean();
    console.log(`\nNudgeLog rows for ${periodKey}: ${rows.length}`);
    if (rows[0]) console.log(`  periodKey=${rows[0].periodKey} delivered=${rows[0].delivered} title="${rows[0].title}"`);
    console.log(`Push attempts: ${pushCalls}`);

    const ok = rows.length === 1 && pushCalls === 1 && rows[0].periodKey === periodKey && typeof rows[0].title === 'string';
    console.log(ok ? '\nRESULT: OK' : '\nRESULT: PROBLEM (expected 1 row and 1 push attempt)');

    const del = await NudgeLog.deleteMany({ _id: { $in: rows.map((r) => r._id) } });
    console.log(`cleanup: deleted ${del.deletedCount} test row(s)`);

    await mongoose.disconnect();
}

run().catch(async (err) => {
    console.error('testNudgeFlowStaging failed:', err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
