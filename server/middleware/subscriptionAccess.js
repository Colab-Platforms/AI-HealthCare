// Gateway-agnostic feature-access checks, based on User.subscription state.
// Must run after `protect` (needs req.user).

const cache = require('../utils/cache');

const FREE_PLAN_KEY = 'free';
const PLAN_CACHE_TTL = 300; // 5 min — plans change rarely (management edits + re-run the sync script)

// Plan lookups happen on every gated request (chat, upload, diet-gen...), so this
// avoids a DB round trip per call. syncRazorpayPlans.js invalidates this on write.
const getCachedPlan = (key, billingCycle) => {
  const Plan = require('../models/Plan');
  return cache.getOrSet(
    `plan:${key}:${billingCycle}`,
    () => Plan.findOne({ key, billingCycle, isActive: true }).lean(),
    PLAN_CACHE_TTL
  );
};

// Blocks the request unless the user's subscription is currently entitled to paid features.
// Checks currentPeriodEnd (not just status) so a stale/lagging webhook can't grant access
// past what was actually paid for.
exports.requireActiveSubscription = (req, res, next) => {
  const sub = req.user.subscription;

  if (!sub || sub.plan === FREE_PLAN_KEY) {
    return res.status(403).json({ success: false, message: 'This feature requires a paid plan.' });
  }

  const entitled = ['active', 'past_due'].includes(sub.status)
    && (!sub.currentPeriodEnd || sub.currentPeriodEnd > new Date());

  if (!entitled) {
    return res.status(403).json({ success: false, message: 'Your subscription is not active.' });
  }

  next();
};

// Blocks the request if a plan-specific numeric/boolean feature limit is exhausted.
// `getUsage(req)` should return the count already used in the current period (for numeric limits);
// ignored for boolean features. -1 in Plan.features means unlimited.
exports.requireFeature = (featureKey, getUsage) => {
  return async (req, res, next) => {
    const sub = req.user.subscription || { plan: FREE_PLAN_KEY, billingCycle: 'monthly' };

    // A lapsed paid subscription (cancelled, or period end passed) must not keep
    // granting paid-tier limits just because `subscription.plan` wasn't reset —
    // fall back to the free plan's entitlement the moment it's no longer active.
    const entitled = sub.plan === FREE_PLAN_KEY
      || (['active', 'past_due'].includes(sub.status) && (!sub.currentPeriodEnd || sub.currentPeriodEnd > new Date()));
    const effectivePlanKey = entitled ? sub.plan : FREE_PLAN_KEY;

    const plan = await getCachedPlan(effectivePlanKey, sub.billingCycle || 'monthly');
    if (!plan) {
      return res.status(403).json({ success: false, message: 'No active plan found for this account.' });
    }

    const limit = plan.features?.[featureKey];

    if (typeof limit === 'boolean') {
      if (!limit) {
        return res.status(403).json({ success: false, message: `Your plan does not include ${featureKey}.` });
      }
      return next();
    }

    if (limit === -1) return next(); // unlimited

    const used = typeof getUsage === 'function' ? await getUsage(req) : 0;
    if (used >= limit) {
      return res.status(403).json({ success: false, message: `You've reached your ${featureKey} limit for this plan.` });
    }

    next();
  };
};

// /doctors/book handles both video and in-person appointments — only video
// consults are plan-gated, so this only runs the check when req.body.type
// is 'video', letting in-person bookings through untouched.
exports.requireVideoConsultIfBooked = async (req, res, next) => {
  if (req.body?.type !== 'video') return next();
  return exports.requireFeature('videoConsultAccess')(req, res, next);
};
