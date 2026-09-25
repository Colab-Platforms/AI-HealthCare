

const mongoose = require('mongoose');
const dns = require('dns');
const dotenv = require('dotenv');
const User = require('../models/User');
const WaitlistUserEmail = require('../models/WaitlistUserEmail');

dotenv.config();

const TRIAL_DAYS = 30;
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
        await dns.promises.resolveSrv(`_mongodb._tcp.${host}`); // let this throw if it still fails — real problem, not just DNS
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

    const oldUsers = await User.find({ 'subscription.plan': 'free' }).select('_id email').lean();
    if (oldUsers.length === 0) {
        console.log('No free-plan users found — nothing to migrate.');
        await mongoose.disconnect();
        return;
    }

    // Load the waitlist once into a Set so isWaitlistedUser stays accurate for
    // analytics even though every old user gets the same 30-day trial regardless.
    const waitlistEmails = new Set(
        (await WaitlistUserEmail.find({}).select('email').lean()).map((w) => w.email)
    );

    const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const now = new Date();

    const ops = oldUsers.map((u) => ({
        updateOne: {
            filter: { _id: u._id },
            update: {
                $set: {
                    isWaitlistedUser: waitlistEmails.has(u.email),
                    'subscription.plan': 'free_trial',
                    'subscription.status': 'active',
                    'subscription.startDate': now,
                    'subscription.currentPeriodEnd': trialEnd,
                    'subscription.endDate': trialEnd,
                    'subscription.autoRenew': false,
                },
            },
        },
    }));

    const result = await User.bulkWrite(ops);
    console.log(`Migrated ${result.modifiedCount} old users to free_trial, expiring ${trialEnd.toISOString()}`);

    try {
        const cache = require('../utils/cache');
        await cache.deletePattern('plan:*');
        console.log('Cleared plan cache.');
    } catch (e) {
        console.warn('Could not clear plan cache (non-fatal):', e.message);
    }

    console.log('Done.');
    await mongoose.disconnect();
}

run().catch((err) => {
    console.error('grantOldUsersFreeTrial failed:', err);
    process.exit(1);
});
