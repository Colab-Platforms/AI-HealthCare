

const mongoose = require('mongoose');
const dns = require('dns');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const TRIAL_DAYS = 14;

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

    const trialUsers = await User.find({ 'subscription.plan': 'free_trial' }).select('_id').lean();
    if (trialUsers.length === 0) {
        console.log('No free_trial users found — nothing to fix.');
        await mongoose.disconnect();
        return;
    }

    const now = new Date();
    const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const result = await User.updateMany(
        { 'subscription.plan': 'free_trial' },
        {
            $set: {
                'subscription.startDate': now,
                'subscription.currentPeriodEnd': trialEnd,
                'subscription.endDate': trialEnd,
            },
        }
    );

    console.log(`Reset ${result.modifiedCount} free_trial users to a 14-day window expiring ${trialEnd.toISOString()}`);

    console.log('Done.');
    await mongoose.disconnect();
}

run().catch((err) => {
    console.error('fixFreeTrialExpiry failed:', err);
    process.exit(1);
});
