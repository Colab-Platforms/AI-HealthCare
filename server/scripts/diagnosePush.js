/**
 * Why aren't pushes landing? Read-only report by default.
 *
 *     node scripts/diagnosePush.js                                  # report only
 *     node scripts/diagnosePush.js --send --email user@example.com  # + real push via sendToUsersBulk
 *
 * Report:
 *   1. reminders created in the last 24h (is the cron tick producing anything?)
 *   2. their pushDelivery outcome over the last 3 days, grouped by error
 *   3. FCMToken rows by isActive
 *
 * --send exercises the exact path real reminders take (sendToUsersBulk ->
 * FCMToken lookup -> multicast), which /test-push with a raw token does not.
 * It sends ONE real notification to the given user and nobody else.
 */
const mongoose = require('mongoose');
const dns = require('dns');
const dotenv = require('dotenv');
const Notification = require('../models/Notification');
const FCMToken = require('../models/FCMToken');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');

dotenv.config();

const args = process.argv.slice(2);
const SEND = args.includes('--send');
const emailIdx = args.indexOf('--email');
const EMAIL = emailIdx !== -1 ? args[emailIdx + 1] : null;

const REMINDER_TYPES = ['food_reminder', 'sleep_reminder', 'macro_update', 'diet_adherence', 'health_insight'];
const DAY = 24 * 3600 * 1000;

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

async function report() {
    const since1d = new Date(Date.now() - DAY);
    const since3d = new Date(Date.now() - 3 * DAY);

    const reminders24h = await Notification.countDocuments({ type: { $in: REMINDER_TYPES }, createdAt: { $gte: since1d } });
    console.log(`1) Reminders created in last 24h:  ${reminders24h}`);
    if (reminders24h === 0) {
        console.log('   -> none. The cron tick is not producing reminders (QStash schedule / NotificationPreference / time windows).');
    }

    const delivery = await Notification.aggregate([
        { $match: { createdAt: { $gte: since3d }, pushDelivery: { $exists: true } } },
        { $group: { _id: '$pushDelivery.error', notifications: { $sum: 1 }, pushesDelivered: { $sum: '$pushDelivery.successCount' } } },
        { $sort: { notifications: -1 } },
    ]);
    console.log('\n2) pushDelivery outcome, last 3 days (error -> count):');
    if (delivery.length === 0) {
        console.log('   (no notification has a pushDelivery result — no bulk push has run in this window)');
    }
    for (const row of delivery) {
        console.log(`   ${String(row._id ?? 'null (no error)').padEnd(48)} notifications=${row.notifications}  pushesDelivered=${row.pushesDelivered}`);
    }

    const tokens = await FCMToken.aggregate([{ $group: { _id: '$isActive', n: { $sum: 1 } } }]);
    console.log('\n3) FCMToken rows by isActive:');
    for (const row of tokens) console.log(`   isActive=${row._id}: ${row.n}`);

    // Who can actually be reached. A reminder is created per user with a
    // NotificationPreference, so this is what explains a high no_active_token share.
    const [totalUsers, activeUserIds, byPlatform, legacyUsers] = await Promise.all([
        User.estimatedDocumentCount(),
        FCMToken.distinct('userId', { isActive: true }),
        FCMToken.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$platform', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
        User.find({ fcmToken: { $type: 'string', $ne: '' } }).select('_id').lean(),
    ]);
    const reachable = new Set(activeUserIds.map(String));
    const legacyUnreachable = legacyUsers.filter((u) => !reachable.has(String(u._id))).length;
    const pct = totalUsers ? ((reachable.size / totalUsers) * 100).toFixed(1) : '0.0';

    console.log('\n4) Reachability:');
    console.log(`   total users:                                ${totalUsers}`);
    console.log(`   users with >=1 active token:                ${reachable.size} (${pct}%)`);
    console.log(`   legacy User.fcmToken set, no active token:  ${legacyUnreachable}`);
    console.log('   active tokens by platform:');
    for (const row of byPlatform) console.log(`     ${String(row._id).padEnd(8)} ${row.n}`);

    // Separates "most users never installed the app" from "app users whose token
    // never registered". device_id is set while a mobile session is live (see
    // User.device_id), a valid RefreshToken means a live session of any kind.
    const [loggedInIds, mobileBound] = await Promise.all([
        RefreshToken.distinct('userId', { expiresAt: { $gt: new Date() } }),
        User.find({ device_id: { $ne: null } }).select('_id').lean(),
    ]);
    const countReachable = (ids) => ids.filter((id) => reachable.has(String(id))).length;
    const loggedIn = loggedInIds.length;
    const mobile = mobileBound.length;
    const loggedInReachable = countReachable(loggedInIds);
    const mobileReachable = countReachable(mobileBound.map((u) => u._id));

    console.log('\n5) Live sessions vs reachable:');
    console.log(`   users with a valid refresh token:           ${loggedIn}  (reachable: ${loggedInReachable})`);
    console.log(`   users with a bound mobile device_id:        ${mobile}  (reachable: ${mobileReachable})`);
    console.log('   -> a large (total - reachable) gap in the mobile row = app users whose token never registered.');
}

async function sendTest() {
    if (!EMAIL) throw new Error('--send needs --email <address>');
    const user = await User.findOne({ email: EMAIL.toLowerCase() }).select('_id email').lean();
    if (!user) throw new Error(`No user with email ${EMAIL}`);

    const rows = await FCMToken.find({ userId: user._id }).select('isActive platform lastUsedAt').lean();
    console.log(`\n4) FCMToken rows for ${user.email}: ${rows.length} (${rows.filter((r) => r.isActive).length} active)`);

    // Required here, not at the top: loading fcmService pulls in firebase-admin,
    // which the read-only report doesn't need.
    const { sendToUsersBulk } = require('../services/fcmService');
    const out = await sendToUsersBulk([
        { userId: user._id, payload: { title: 'Push diagnostic', body: 'Sent via the bulk path', data: { type: 'diagnostic', n: 1 } } },
    ]);
    console.log('   sendToUsersBulk result:', JSON.stringify(out, null, 2));
}

async function run() {
    const mongoUri = resolveMongoUri();
    if (!mongoUri) {
        throw new Error('No Mongo URI resolved — check MONGODB_URI / MONGODB_URI_STAGING / USE_STAGING_DB in .env');
    }
    await ensureSrvResolvable(mongoUri);
    await mongoose.connect(mongoUri);
    console.log(`Connected to ${mongoose.connection.host}/${mongoose.connection.name}${process.env.USE_STAGING_DB === 'true' ? ' (STAGING)' : ''}`);
    console.log(SEND ? 'MODE: REPORT + SEND (one real push)\n' : 'MODE: REPORT ONLY (read-only)\n');

    await report();
    if (SEND) await sendTest();

    console.log('\nDone.');
    await mongoose.disconnect();
}

run().catch((err) => {
    console.error('diagnosePush failed:', err);
    process.exit(1);
});
