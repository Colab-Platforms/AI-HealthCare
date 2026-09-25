// One-time / re-runnable script: creates Plan records in our DB and mirrors them as
// Razorpay Plans (Razorpay plans are immutable — price changes require a new Razorpay
// plan id, this script detects that and creates a fresh one instead of editing).
//
// Usage: node scripts/syncRazorpayPlans.js

const mongoose = require('mongoose');
const dns = require('dns');
const dotenv = require('dotenv');
const Plan = require('../models/Plan');
const { getClient } = require('../services/razorpayService');

dotenv.config();

// Some local networks (VPN/router/antivirus DNS filtering) block Node's direct SRV
// queries (used by mongodb+srv:// URIs) even though the OS's own resolver works fine
// via nslookup. If the machine's configured DNS can't resolve the SRV record, retry
// once against a public resolver before giving up — this script-only workaround
// doesn't touch config/db.js, which already connects fine for the main app.
async function ensureSrvResolvable(uri) {
    if (!uri.startsWith('mongodb+srv://')) return;
    // new URL() parses any scheme:// generically, so this correctly pulls just the
    // hostname (e.g. cluster0.ij9yb3s.mongodb.net) regardless of userinfo/db-name/query string.
    const host = new URL(uri).hostname;
    try {
        await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
    } catch (e) {
        console.warn(`Default DNS couldn't resolve the SRV record (${e.code}) — retrying via public DNS (8.8.8.8, 1.1.1.1)...`);
        dns.setServers(['8.8.8.8', '1.1.1.1']);
        await dns.promises.resolveSrv(`_mongodb._tcp.${host}`); // let this throw if it still fails — real problem, not just DNS
    }
}

// Retired tiers — Pro and Pro Plus are replaced by the single Take Plus plan below.
// Kept here only so this script actively disables any still-active Plan record for
// them; existing subscribers on these keep their current access until it lapses.
const RETIRED_PLAN_KEYS = ['basic', 'premium'];

// Every paid feature — Take Plus is the only paid tier now.
const PAID_FEATURES = {
    // Free features, included on paid tiers too:
    waterLogging: true, healthScore: true, activityStepLogging: true, alcoholTracking: true,
    sleepTracking: true, weightTracking: true, healthTimelineInsights: true, medicalVault: true,
    darkModeSettings: true, healthStreaks: true, badgesAchievements: true, healthChallenges: true,
    // Paid-only features:
    aiHealthCoach: true, mealRecommendations: true, aiFoodAnalysis: true, aiMedicalReportAnalysis: true,
    smartHealthAlerts: true, goalPlanner: true, detailedNutritionLogging: true, diabetesGlucoseLog: true,
    nutritionDeficiencyDetection: true, advancedDataExport: true,
};

const FREE_FEATURES = {
    waterLogging: true, healthScore: true, activityStepLogging: true, alcoholTracking: true,
    sleepTracking: true, weightTracking: true, healthTimelineInsights: true, medicalVault: true,
    darkModeSettings: true, healthStreaks: true, badgesAchievements: true, healthChallenges: true,
    // Not AI-usage-cost features, so free tier gets them too:
    smartHealthAlerts: true, detailedNutritionLogging: true, diabetesGlucoseLog: true,
    nutritionDeficiencyDetection: true, advancedDataExport: true,
    // True differentiators — AI/compute cost, paid-only:
    aiHealthCoach: false, mealRecommendations: false, aiFoodAnalysis: false, aiMedicalReportAnalysis: false,
    goalPlanner: false,
};

// Source of truth for pricing/features — edit here, then re-run this script.
const PLAN_DEFINITIONS = [
    {
        key: 'free', name: 'Free', billingCycle: 'monthly', price: 0,
        features: FREE_FEATURES,
    },
    {
        // Time-boxed trial (14 days new signups / 30 days waitlisted+old-user migration) — see
        // authController.js register() and scripts/grantOldUsersFreeTrial.js. Never charged;
        // full paid-tier feature set, same shape as basic/premium so nothing else has to special-case it.
        key: 'free_trial', name: 'Free Trial', billingCycle: 'monthly', price: 0,
        features: PAID_FEATURES,
    },
    {
        // "Take Plus" — replaces Pro/Pro Plus as the only paid tier.
        key: 'take_plus', name: 'Take Plus', billingCycle: 'monthly', price: 299,
        features: PAID_FEATURES,
    },
];

// Same resolution as config/db.js — this repo runs against a staging DB by
// default (USE_STAGING_DB=true in .env), with MONGODB_URI reserved for production.
const resolveMongoUri = () =>
    process.env.USE_STAGING_DB === 'true' ? process.env.MONGODB_URI_STAGING : process.env.MONGODB_URI;

async function run() {
    const mongoUri = resolveMongoUri();
    if (!mongoUri) {
        throw new Error('No Mongo URI resolved — check MONGODB_URI / MONGODB_URI_STAGING / USE_STAGING_DB in .env');
    }
    await ensureSrvResolvable(mongoUri);
    await mongoose.connect(mongoUri);
    console.log(`Connected to MongoDB${process.env.USE_STAGING_DB === 'true' ? ' (STAGING)' : ''}`);

    const razorpay = getClient();

    for (const def of PLAN_DEFINITIONS) {
        let plan = await Plan.findOne({ key: def.key, billingCycle: def.billingCycle, isActive: true });

        if (def.key === 'free' || def.key === 'free_trial') {
            // Never charged, so never touches Razorpay.
            if (!plan) {
                plan = await Plan.create({ ...def, razorpayPlanId: null });
                console.log(`Created ${def.key} plan record`);
            } else {
                plan.features = def.features;
                plan.name = def.name;
                await plan.save();
                console.log(`Plan ${def.key} unchanged — updated features only`);
            }
            continue;
        }

        let existsInRazorpay = false;
        if (plan?.razorpayPlanId) {
            try {
                await razorpay.plans.fetch(plan.razorpayPlanId);
                existsInRazorpay = true;
            } catch (e) {
                // Plan id not found under the current Razorpay account/keys (e.g. keys were
                // rotated to a different account) — treat as if we need to (re)create it.
                existsInRazorpay = false;
            }
        }

        const needsNewRazorpayPlan = !plan || !plan.razorpayPlanId || plan.price !== def.price || !existsInRazorpay;

        if (needsNewRazorpayPlan) {
            // Razorpay's `period` only accepts daily/weekly/monthly/yearly — a 3-month
            // cycle is expressed as period 'monthly' with interval 3, not a 'quarterly' period.
            const rzpPeriod = def.billingCycle === 'yearly' ? 'yearly' : 'monthly';
            const rzpInterval = def.billingCycle === 'quarterly' ? 3 : 1;
            const rzpPlan = await razorpay.plans.create({
                period: rzpPeriod,
                interval: rzpInterval,
                item: {
                    name: `${def.name} (${def.billingCycle})`,
                    amount: def.price * 100, // paise
                    currency: 'INR',
                },
            });

            if (plan) {
                // Price changed — deactivate the old plan record, existing subscribers keep
                // their current Razorpay subscription untouched; new signups get the new one.
                plan.isActive = false;
                await plan.save();
                console.log(`Deactivated stale plan ${def.key}/${def.billingCycle} (price changed)`);
            }

            plan = await Plan.create({ ...def, razorpayPlanId: rzpPlan.id, isActive: true });
            console.log(`Created Razorpay plan ${rzpPlan.id} for ${def.key}/${def.billingCycle} @ ₹${def.price}`);
        } else {
            plan.features = def.features;
            plan.name = def.name;
            await plan.save();
            console.log(`Plan ${def.key}/${def.billingCycle} unchanged — updated features only`);
        }
    }

    // Disable retired tiers (Pro/Pro Plus) — new signups can no longer pick them,
    // existing subscribers on them keep access until their current period lapses
    // (cancelSubscription/webhook flows don't check isActive).
    const retiredResult = await Plan.updateMany(
        { key: { $in: RETIRED_PLAN_KEYS }, isActive: true },
        { $set: { isActive: false } }
    );
    if (retiredResult.modifiedCount) {
        console.log(`Disabled ${retiredResult.modifiedCount} retired plan(s): ${RETIRED_PLAN_KEYS.join(', ')}`);
    }

    // Feature-gating middleware caches Plan lookups for 5 min (utils/cache) —
    // clear it so a price/feature edit here takes effect immediately instead
    // of waiting out the TTL.
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
    console.error('syncRazorpayPlans failed:', err);
    process.exit(1);
});
