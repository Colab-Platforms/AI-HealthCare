// Gateway-agnostic feature-access checks, based on User.subscription state.
// Must run after `protect` (needs req.user).

const cache = require('../utils/cache');
const { PAST_DUE_GRACE_DAYS } = require('../services/subscriptionLifecycleService');

const FREE_PLAN_KEY = 'free';
const PLAN_CACHE_TTL = 300; // 5 min — plans change rarely (management edits + re-run the sync script)

// True while status is 'active' and still within its paid period, OR status is
// 'past_due' and still within the grace window since it flipped — this is what
// actually keeps paid features working during the grace period; without the
// past_due branch, access would cut off the instant currentPeriodEnd passes,
// before the grace period the lifecycle cron enforces ever gets a chance to apply.
const isEntitled = (sub) => {
  if (sub.status === 'active') {
    return !sub.currentPeriodEnd || sub.currentPeriodEnd > new Date();
  }
  if (sub.status === 'past_due') {
    const graceDeadline = new Date((sub.statusUpdatedAt || 0).valueOf() + PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000);
    return sub.statusUpdatedAt && graceDeadline > new Date();
  }
  return false;
};

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

  if (!isEntitled(sub)) {
    return res.status(403).json({ success: false, message: 'Your subscription is not active.' });
  }

  next();
};

// Blocks the request unless the effective plan's feature map has `featureKey: true`.
// All features are plain access flags now — no numeric usage limits (Pro/Pro Plus
// both get unlimited use of every paid feature; abuse protection is handled by
// rate-limit middleware like `aiLimiter`, not a monthly ceiling here).
exports.requireFeature = (featureKey) => {
  return async (req, res, next) => {
    const sub = req.user.subscription || { plan: FREE_PLAN_KEY, billingCycle: 'monthly' };

    // A lapsed paid subscription (cancelled, or period end passed) must not keep
    // granting paid-tier access just because `subscription.plan` wasn't reset —
    // fall back to the free plan's entitlement the moment it's no longer active.
    const entitled = sub.plan === FREE_PLAN_KEY || isEntitled(sub);
    const effectivePlanKey = entitled ? sub.plan : FREE_PLAN_KEY;

    const plan = await getCachedPlan(effectivePlanKey, sub.billingCycle || 'monthly');
    if (!plan) {
      return res.status(403).json({ success: false, message: 'No active plan found for this account.' });
    }

    if (plan.features?.[featureKey] !== true) {
      return res.status(403).json({ success: false, message: `Your plan does not include ${featureKey}.`, code: 'UPGRADE_REQUIRED', feature: featureKey, currentPlan: effectivePlanKey });
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
