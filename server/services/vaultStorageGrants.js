/**
 * Vault storage grants: +GRANT_BYTES_PER_PAYMENT for every successful paid
 * payment, recorded in the VaultStorageGrant ledger.
 *
 *   webhook (payment.captured / subscription.charged)
 *     -> safeGrantForPayment()   inserts a ledger row (unique key => idempotent)
 *                                then bumps VaultUsage.grantedBytes
 *   syncGrantsFromPayments()     re-derives missing grants from Payment rows
 *                                (one-time backfill + nightly safety net)
 *   reconcileUsage()             rebuilds grantedBytes/quotaBytes from the ledger
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const Payment = require('../models/Payment');
require('../models/Plan'); // registers the model: Payment.populate('plan') fails in standalone scripts without it
const VaultUsage = require('../models/VaultUsage');
const VaultStorageGrant = require('../models/VaultStorageGrant');
const { ensureUsage, refreshQuota } = require('./vaultService');
const { FREE_BASE_BYTES, GRANT_BYTES_PER_PAYMENT, GRANTING_PLAN_KEYS } = require('../config/vault');

/** Pure: the idempotency key for a payment. Order matters: payment id wins. */
const grantKeyForPayment = (payment, periodEnd) => {
  if (payment?.razorpayPaymentId) return `rzp:${payment.razorpayPaymentId}`;
  if (payment?.razorpaySubscriptionId && periodEnd) {
    return `sub:${payment.razorpaySubscriptionId}:${Math.floor(new Date(periodEnd).getTime() / 1000)}`;
  }
  return `pay:${payment._id}`;
};

/**
 * Insert one ledger row and add it to the user's usage. Returns true when a
 * new grant was created, false when this key was already granted.
 */
const addGrant = async ({ userId, key, bytes = GRANT_BYTES_PER_PAYMENT, source, planKey = '', paymentId }) => {
  try {
    await VaultStorageGrant.create({ userId, key, bytes, source, planKey, paymentId });
  } catch (err) {
    if (err.code === 11000) return false; // already granted
    throw err;
  }

  // If anything below fails, the row above still exists and reconcileUsage()
  // will fold it into grantedBytes.
  await ensureUsage(userId);
  await VaultUsage.updateOne({ userId }, { $inc: { grantedBytes: bytes } });
  await refreshQuota(userId);
  return true;
};

/** Grant for one paid payment. Ignores plans that don't earn storage (free, free_trial). */
const grantForPayment = async ({ userId, payment, planKey, periodEnd }) => {
  if (!GRANTING_PLAN_KEYS.includes(planKey)) return { granted: false, reason: 'plan_not_eligible' };
  const key = grantKeyForPayment(payment, periodEnd);
  const granted = await addGrant({ userId, key, source: 'payment', planKey, paymentId: payment._id });
  return { granted, key };
};

/**
 * For the webhook: must never throw. A storage problem must not fail (and so
 * make Razorpay retry) a payment that has already been recorded; the nightly
 * sync picks up anything missed here.
 */
const safeGrantForPayment = async (args) => {
  try {
    const res = await grantForPayment(args);
    if (res.granted) console.log('[VaultGrant] granted', JSON.stringify({ userId: String(args.userId), key: res.key }));
    return res;
  } catch (err) {
    console.error('[VaultGrant] grant failed (nightly sync will retry):', err.message);
    return { granted: false, reason: 'error' };
  }
};

/**
 * Rebuild grantedBytes (and the stored quota) from the ledger. Fixes any drift
 * between the ledger and VaultUsage. Returns how many usage rows changed.
 */
const reconcileUsage = async ({ userId, dryRun = false } = {}) => {
  // Aggregation $match does not cast strings the way find() does.
  const match = userId ? [{ $match: { userId: new mongoose.Types.ObjectId(String(userId)) } }] : [];
  const sums = await VaultStorageGrant.aggregate([...match, { $group: { _id: '$userId', total: { $sum: '$bytes' } } }]);

  let changed = 0;
  for (const { _id, total } of sums) {
    const current = await VaultUsage.findOne({ userId: _id }).select('grantedBytes').lean();
    if (current && current.grantedBytes === total) continue;
    changed += 1;
    if (dryRun) continue;
    await ensureUsage(_id);
    await VaultUsage.updateOne({ userId: _id }, { $set: { grantedBytes: total, quotaBytes: FREE_BASE_BYTES + total } });
  }
  return { usersChecked: sums.length, usersChanged: changed };
};

/**
 * Create any missing grants from paid Payment rows (plan must be eligible).
 * Idempotent: safe to run any number of times.
 *
 * includeManualPaidUsers: a user who is on a paid plan right now but has no
 * eligible Payment row at all (e.g. an admin set the plan by hand) gets one
 * grant keyed backfill:<userId>.
 */
const syncGrantsFromPayments = async ({ userId, dryRun = false, includeManualPaidUsers = true } = {}) => {
  const stats = {
    dryRun,
    paymentsScanned: 0,
    grantsCreated: 0,
    alreadyGranted: 0,
    skippedIneligiblePlan: 0,
    manualPaidBackfills: 0,
  };
  const usersWithPayments = new Set();

  const query = { status: 'paid' };
  if (userId) query.user = userId;

  for await (const payment of Payment.find(query).populate('plan', 'key').sort({ _id: 1 }).cursor()) {
    stats.paymentsScanned += 1;
    const planKey = payment.plan?.key;
    if (!GRANTING_PLAN_KEYS.includes(planKey)) { stats.skippedIneligiblePlan += 1; continue; }

    usersWithPayments.add(String(payment.user));
    const key = grantKeyForPayment(payment);

    if (dryRun) {
      if (await VaultStorageGrant.exists({ key })) stats.alreadyGranted += 1;
      else stats.grantsCreated += 1;
      continue;
    }
    const created = await addGrant({ userId: payment.user, key, source: 'payment', planKey, paymentId: payment._id });
    if (created) stats.grantsCreated += 1;
    else stats.alreadyGranted += 1;
  }

  if (includeManualPaidUsers) {
    const now = new Date();
    const userQuery = {
      'subscription.plan': { $in: GRANTING_PLAN_KEYS },
      'subscription.status': { $nin: ['expired', 'inactive'] },
      'subscription.currentPeriodEnd': { $gt: now },
    };
    if (userId) userQuery._id = userId;

    for await (const user of User.find(userQuery).select('_id subscription.plan').lean().cursor()) {
      if (usersWithPayments.has(String(user._id))) continue;
      const key = `backfill:${user._id}`;
      if (await VaultStorageGrant.exists({ userId: user._id })) continue; // already has some grant

      if (dryRun) { stats.manualPaidBackfills += 1; continue; }
      const created = await addGrant({ userId: user._id, key, source: 'backfill', planKey: user.subscription.plan });
      if (created) stats.manualPaidBackfills += 1;
    }
  }

  stats.reconcile = await reconcileUsage({ userId, dryRun });
  return stats;
};

module.exports = {
  grantKeyForPayment,
  addGrant,
  grantForPayment,
  safeGrantForPayment,
  reconcileUsage,
  syncGrantsFromPayments,
};
