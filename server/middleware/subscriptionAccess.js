// Gateway-agnostic feature-access checks, based on User.subscription state.
// Must run after `protect` (needs req.user).

const FREE_PLAN_KEY = 'free';

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
    const Plan = require('../models/Plan');
    const sub = req.user.subscription || { plan: FREE_PLAN_KEY, billingCycle: 'monthly' };

    const plan = await Plan.findOne({ key: sub.plan, billingCycle: sub.billingCycle || 'monthly', isActive: true });
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
