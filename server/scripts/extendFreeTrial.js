// Extends every free_trial user's expiry by EXTEND_DAYS (adds to their existing end date).
//
// Usage (from server/):
//   node scripts/extendFreeTrial.js                    -> dry run, prints what would change
//   node scripts/extendFreeTrial.js --apply            -> applies to users still on free_trial
//   node scripts/extendFreeTrial.js --apply --include-expired
//        -> also restores trial users the lifecycle cron already downgraded to free/expired
//           (identified by a ~14-day startDate->endDate window) and extends them.

const mongoose = require('mongoose');
const dns = require('dns');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const EXTEND_DAYS = 2;
const TRIAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const apply = process.argv.includes('--apply');
const includeExpired = process.argv.includes('--include-expired');

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

async function run() {
    const mongoUri = resolveMongoUri();
    if (!mongoUri) {
        throw new Error('No Mongo URI resolved — check MONGODB_URI / MONGODB_URI_STAGING / USE_STAGING_DB in .env');
    }
    await ensureSrvResolvable(mongoUri);
    await mongoose.connect(mongoUri);
    console.log(`Connected to MongoDB${process.env.USE_STAGING_DB === 'true' ? ' (STAGING)' : ''}`);
    console.log(apply ? 'MODE: APPLY' : 'MODE: DRY RUN (pass --apply to write changes)');

    // 1) Users still on free_trial — just push the end date out.
    const activeFilter = { 'subscription.plan': 'free_trial', 'subscription.currentPeriodEnd': { $type: 'date' } };
    const activeCount = await User.countDocuments(activeFilter);
    console.log(`Active free_trial users: ${activeCount}`);

    // 2) Trial users the cron already flipped to free/expired. A trial window is ~14 days;
    //    paid periods are longer, so the startDate->endDate gap tells them apart.
    const expiredFilter = {
        'subscription.plan': 'free',
        'subscription.status': 'expired',
        'subscription.startDate': { $type: 'date' },
        'subscription.endDate': { $type: 'date' },
        $expr: {
            $lte: [
                { $subtract: ['$subscription.endDate', '$subscription.startDate'] },
                (TRIAL_DAYS + 1) * DAY_MS,
            ],
        },
    };
    const expiredCount = await User.countDocuments(expiredFilter);
    console.log(`Already-downgraded trial-looking users (free/expired, <=${TRIAL_DAYS + 1}d window): ${expiredCount}${includeExpired ? '' : '  [skipped, pass --include-expired]'}`);

    if (!apply) {
        console.log('Dry run complete — nothing written.');
        await mongoose.disconnect();
        return;
    }

    const newEnd = { $add: ['$subscription.currentPeriodEnd', EXTEND_DAYS * DAY_MS] };

    const activeResult = await User.updateMany(activeFilter, [
        { $set: { 'subscription.currentPeriodEnd': newEnd, 'subscription.endDate': newEnd } },
    ]);
    console.log(`Extended ${activeResult.modifiedCount} active free_trial users by ${EXTEND_DAYS} days`);

    if (includeExpired) {
        // Use endDate as the base here: currentPeriodEnd may be missing on older docs.
        const restoreEnd = { $add: ['$subscription.endDate', EXTEND_DAYS * DAY_MS] };
        const expiredResult = await User.updateMany(expiredFilter, [
            {
                $set: {
                    'subscription.plan': 'free_trial',
                    'subscription.status': 'active',
                    'subscription.currentPeriodEnd': restoreEnd,
                    'subscription.endDate': restoreEnd,
                },
            },
        ]);
        console.log(`Restored + extended ${expiredResult.modifiedCount} downgraded trial users by ${EXTEND_DAYS} days`);
    }

    console.log('Done.');
    await mongoose.disconnect();
}

run().catch((err) => {
    console.error('extendFreeTrial failed:', err);
    process.exit(1);
});
