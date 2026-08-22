// One-time / re-runnable script: creates Plan records in our DB and mirrors them as
// Razorpay Plans (Razorpay plans are immutable — price changes require a new Razorpay
// plan id, this script detects that and creates a fresh one instead of editing).
//
// Usage: node scripts/syncRazorpayPlans.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Plan = require('../models/Plan');
const { getClient } = require('../services/razorpayService');

dotenv.config();

// Source of truth for pricing — edit here, then re-run this script.
const PLAN_DEFINITIONS = [
    {
        key: 'free', name: 'Free', billingCycle: 'monthly', price: 0,
        features: { reportAnalysesPerMonth: 1, aiChatPerDay: 3, dietPlansPerMonth: 0, supplementRecommendations: false, videoConsultAccess: false, prioritySupport: false },
    },
    {
        key: 'basic', name: 'Basic', billingCycle: 'monthly', price: 299,
        features: { reportAnalysesPerMonth: 5, aiChatPerDay: 15, dietPlansPerMonth: 1, supplementRecommendations: true, videoConsultAccess: false, prioritySupport: true },
    },
    {
        key: 'basic', name: 'Basic', billingCycle: 'yearly', price: 239, // effective per-month rate, billed yearly
        features: { reportAnalysesPerMonth: 5, aiChatPerDay: 15, dietPlansPerMonth: 1, supplementRecommendations: true, videoConsultAccess: false, prioritySupport: true },
    },
    {
        key: 'premium', name: 'Premium', billingCycle: 'monthly', price: 599,
        features: { reportAnalysesPerMonth: -1, aiChatPerDay: -1, dietPlansPerMonth: -1, supplementRecommendations: true, videoConsultAccess: true, prioritySupport: true },
    },
    {
        key: 'premium', name: 'Premium', billingCycle: 'yearly', price: 479,
        features: { reportAnalysesPerMonth: -1, aiChatPerDay: -1, dietPlansPerMonth: -1, supplementRecommendations: true, videoConsultAccess: true, prioritySupport: true },
    },
];

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const razorpay = getClient();

    for (const def of PLAN_DEFINITIONS) {
        let plan = await Plan.findOne({ key: def.key, billingCycle: def.billingCycle, isActive: true });

        if (def.key === 'free') {
            // Free plan never touches Razorpay.
            if (!plan) {
                plan = await Plan.create({ ...def, razorpayPlanId: null });
                console.log(`Created free plan record`);
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
            const rzpPlan = await razorpay.plans.create({
                period: def.billingCycle === 'yearly' ? 'yearly' : 'monthly',
                interval: 1,
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
