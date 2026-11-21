// "Buy from the Shopify store, get 30 days of Take+ per item."
//
// Days for an order = offer units (items bought minus items refunded, see
// utils/shopifyOrder.offerUnits) x SHOPIFY_OFFER_DAYS (30). 1 order with 3 items
// = 90 days, given at once. Every order can be claimed once; a user can claim
// many orders and the days add up.
//
// The buyer is moved to the real paid plan, 'take_plus', with autoRenew off and
// subscription.grantSource = 'shopify_offer' so it is never mistaken for a paid
// subscription (admin paid list, vault upgrade prompt, renewal email). The rest
// is the existing machinery:
//   - subscriptionAccess.isEntitled         -> feature access until currentPeriodEnd
//   - subscriptionLifecycleService cron     -> downgrade to 'free' when it passes
//   - trial-ending reminder cron            -> "your free Take+ ends soon" email
// If the user subscribes while the offer runs, the Razorpay subscription starts
// when the offer ends (subscriptionController.subscribe), so the free days are
// used up first and the paid period follows.
//
// What a buyer gets for an order worth N days:
//   + already on the offer (free Take+ running) -> N more days after the current end
//   A. on the 14-day trial, bought after joining -> N days after the trial ends
//   B. bought first, joined the app later        -> N days from joining (replaces the 14)
//   C. trial / plan already over                 -> N days from today
//   D. on a live paid plan                       -> N days after the paid plan ends
//      (kept 'pending' and applied by the lifecycle cron, so a Razorpay renewal
//       webhook can't overwrite it)
//
// Refunds take back exactly the refunded items' days (1 of 3 returned -> -30).
// When no offer days are left, the account goes back to what it had before the
// offer started (previousSubscription): the 14-day trial if it is still running,
// otherwise 'free'. A plan the user paid for is never touched.
//
// Safety:
//   - An order number alone proves nothing (they're sequential): the order's
//     email must match the account (or the checkout email the user enters).
//   - Each order is claimed once (conditional update on redeemedBy: null).
//   - Phone is NOT used for matching for now (no OTP verification yet); phone
//     hashes are still stored so it can be switched back on later.
//   - Only eligible orders: paid, not cancelled/refunded, offer product
//     (SHOPIFY_OFFER_PRODUCT_IDS / SHOPIFY_OFFER_SKUS; both empty = every product).

const crypto = require('crypto');
const User = require('../models/User');
const ShopifyPurchase = require('../models/ShopifyPurchase');
const ProcessedWebhook = require('../models/ProcessedWebhook');
const shopifyAdmin = require('./shopifyAdminService');
const { isEntitled, FREE_PLAN_KEY } = require('../middleware/subscriptionAccess');
const {
    getOfferConfig, parseOrderNumberInput, normalizeOrderName, normalizeEmail,
    hashIdentifier, identityHashes, normalizeWebhookOrder, normalizeGraphqlOrder, normalizeRefund,
    finalEligibility, offerUnits,
} = require('../utils/shopifyOrder');

const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_PLAN_KEY = 'free_trial';
const OFFER_PLAN_KEY = 'take_plus';
const GRANT_SOURCE = 'shopify_offer';
const PENDING_BATCH = 500;
const USER_FIELDS = 'email isEmailVerified phone isPhoneVerified subscription createdAt';

const NOT_FOUND_MESSAGE = 'We couldn’t find an eligible order with these details. '
    + 'Check the order number on your invoice and enter the email address you used at checkout.';

const INELIGIBLE_MESSAGES = {
    cancelled: 'This order was cancelled, so it isn’t eligible for the offer.',
    refunded: 'This order was refunded, so it isn’t eligible for the offer.',
    not_paid: 'This order isn’t marked as paid yet. Please try again after it’s paid.',
    product_not_in_offer: 'This order doesn’t include a product that’s part of the offer.',
    test_order: 'This is a test order.',
};

class OfferError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

// Same definition of "paid" as the admin subscription list and the renewal cron:
// anything that isn't free, the free trial or a free grant, and still live.
const hasActivePaidPlan = (sub) => Boolean(
    sub && sub.plan !== FREE_PLAN_KEY && sub.plan !== TRIAL_PLAN_KEY && !sub.grantSource && isEntitled(sub)
);

const snapshotOf = (sub = {}) => ({
    plan: sub.plan || FREE_PLAN_KEY,
    status: sub.status,
    startDate: sub.startDate,
    currentPeriodEnd: sub.currentPeriodEnd,
});

// Is the account on free Take+ from this offer right now?
const onOfferGrant = (sub, now = new Date()) => Boolean(
    sub && sub.grantSource === GRANT_SOURCE && sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) > now
);

// Orders claimed before per-item days existed have no units/grantedDays: each
// was worth exactly one unit then.
const unitsOf = (p) => (p.units != null ? p.units : 1);
const grantedDaysOf = (p) => (p.grantedDays != null ? p.grantedDays : (p.grantStatus === 'applied' ? getOfferConfig().days : 0));

const CAS_TRIES = 3;

/**
 * Add `days` to a running offer grant: end = max(now, current end) + days.
 * Compare-and-set on the current end, so two orders applied at the same moment
 * both count. Returns the new end, or null if the user is not on the offer.
 */
const extendOfferGrant = async (userId, days, now = new Date()) => {
    for (let i = 0; i < CAS_TRIES; i += 1) {
        const user = await User.findById(userId).select('subscription').lean();
        const sub = user?.subscription;
        if (!onOfferGrant(sub, now)) return null;
        const end = new Date(Math.max(now.getTime(), new Date(sub.currentPeriodEnd).getTime()) + days * DAY_MS);
        const res = await User.updateOne(
            { _id: userId, 'subscription.grantSource': GRANT_SOURCE, 'subscription.currentPeriodEnd': sub.currentPeriodEnd },
            { $set: {
                'subscription.currentPeriodEnd': end,
                'subscription.endDate': end,
                'subscription.statusUpdatedAt': now,
                'subscription.renewalReminderSentAt': null, // new end -> "ending soon" email due again
            } }
        );
        if (res.modifiedCount === 1) return end;
    }
    throw new Error(`offer end of user ${userId} kept changing, try again`);
};

// Days still credited to the user from claimed orders (applied ones only).
const remainingOfferDays = async (userId) => {
    const orders = await ShopifyPurchase.find({ redeemedBy: userId, grantStatus: 'applied' })
        .select('grantStatus grantedDays').lean();
    return orders.reduce((sum, p) => sum + grantedDaysOf(p), 0);
};

// What the account goes back to when no offer days are left: the trial it had
// before the offer started if that trial is still running, otherwise 'free'.
const restoreFields = async (userId, now) => {
    const starter = await ShopifyPurchase.findOne({ redeemedBy: userId, 'previousSubscription.plan': { $ne: null } })
        .sort({ redeemedAt: -1 }).select('previousSubscription').lean();
    const prev = starter?.previousSubscription || {};
    if (prev.plan === TRIAL_PLAN_KEY && prev.currentPeriodEnd && new Date(prev.currentPeriodEnd) > now) {
        return { label: `back to trial ending ${new Date(prev.currentPeriodEnd).toISOString()}`, set: {
            'subscription.plan': TRIAL_PLAN_KEY,
            'subscription.status': 'active',
            'subscription.currentPeriodEnd': prev.currentPeriodEnd,
            'subscription.endDate': prev.currentPeriodEnd,
            ...(prev.startDate ? { 'subscription.startDate': prev.startDate } : {}),
            'subscription.statusUpdatedAt': now,
            'subscription.renewalReminderSentAt': null,
        } };
    }
    // Same downgrade the lifecycle cron applies when a plan ends.
    return { label: 'back to free', set: {
        'subscription.plan': FREE_PLAN_KEY,
        'subscription.status': 'expired',
        'subscription.autoRenew': false,
        'subscription.currentPeriodEnd': now,
        'subscription.endDate': now,
        'subscription.statusUpdatedAt': now,
    } };
};

/**
 * Take `days` off the user's free Take+. If no offer days are left afterwards,
 * or the new end is already past (the days were used up), the account goes back
 * to restoreFields. Only touches an account still on the offer: once the user
 * has paid (grantSource cleared) or the offer has been downgraded, nothing changes.
 */
const shortenOfferGrant = async (userId, days, now = new Date()) => {
    for (let i = 0; i < CAS_TRIES; i += 1) {
        const user = await User.findById(userId).select('subscription').lean();
        const sub = user?.subscription;
        // Paid since (marker cleared), or the free days already ran out (the
        // nightly downgrade may not have run yet): nothing left to take back.
        if (!onOfferGrant(sub, now)) return 'left as is (paid or already ended)';

        const newEnd = new Date(new Date(sub.currentPeriodEnd).getTime() - days * DAY_MS);
        const restore = newEnd <= now || (await remainingOfferDays(userId)) <= 0;
        const { set, label } = restore
            ? await restoreFields(userId, now)
            : { set: { 'subscription.currentPeriodEnd': newEnd, 'subscription.endDate': newEnd, 'subscription.statusUpdatedAt': now },
                label: `offer now ends ${newEnd.toISOString()}` };

        const res = await User.updateOne(
            { _id: userId, 'subscription.grantSource': GRANT_SOURCE, 'subscription.currentPeriodEnd': sub.currentPeriodEnd },
            restore ? { $set: set, $unset: { 'subscription.grantSource': '' } } : { $set: set }
        );
        if (res.modifiedCount === 1) return label;
    }
    throw new Error(`offer end of user ${userId} kept changing, try again`);
};

// ---------------------------------------------------------------------------
// refunds / cancellations: take back the days of what was returned
// ---------------------------------------------------------------------------

/**
 * The order now counts for `newUnits` instead of its stored units (items were
 * refunded, or the whole order cancelled/refunded -> 0). Takes back exactly the
 * difference. The order row is updated first with a compare-and-set on its
 * units, so a refund webhook delivered twice takes the days back once.
 *   pending -> only the waiting days shrink (0 -> revoked).
 *   applied -> the user's offer end moves back by the difference (0 -> revoked).
 */
const takeBackDays = async (purchase, newUnits, reason, now = new Date()) => {
    const days = getOfferConfig().days;
    const oldUnits = unitsOf(purchase);
    if (newUnits >= oldUnits || !['applied', 'pending'].includes(purchase.grantStatus)) return false;
    const revoke = newUnits === 0;
    const revokeSet = revoke ? { grantStatus: 'revoked', revokedAt: now, revokeReason: reason } : {};
    const unitsFilter = purchase.units != null ? purchase.units : null;

    if (purchase.grantStatus === 'pending') {
        const res = await ShopifyPurchase.updateOne(
            { _id: purchase._id, grantStatus: 'pending', units: unitsFilter },
            { $set: { units: newUnits, pendingDays: newUnits * days, ...revokeSet } }
        );
        if (res.modifiedCount === 1) {
            console.log(`↩️  [ShopifyOffer] ${purchase.orderName} (${reason}) pending ${oldUnits} -> ${newUnits} items — user ${purchase.redeemedBy}`);
        }
        return res.modifiedCount === 1;
    }

    const removeDays = grantedDaysOf(purchase) - newUnits * days;
    const res = await ShopifyPurchase.updateOne(
        { _id: purchase._id, grantStatus: 'applied', units: unitsFilter },
        { $set: { units: newUnits, grantedDays: newUnits * days, ...revokeSet } }
    );
    if (res.modifiedCount !== 1) return false;

    const outcome = removeDays > 0 ? await shortenOfferGrant(purchase.redeemedBy, removeDays, now) : 'no days to take back';
    console.log(`↩️  [ShopifyOffer] ${purchase.orderName} (${reason}) ${oldUnits} -> ${newUnits} items, -${Math.max(0, removeDays)} days — user ${purchase.redeemedBy}: ${outcome}`);
    return true;
};

// Re-check an order after it or its refunds changed: fix `eligible`, and if the
// order was already claimed, take back the days of whatever is no longer bought.
const reconcile = async (doc) => {
    if (!doc) return doc;
    const verdict = finalEligibility(doc);
    let current = doc;
    if (verdict.eligible !== doc.eligible || (verdict.reason || null) !== (doc.ineligibleReason || null)) {
        current = await ShopifyPurchase.findOneAndUpdate(
            { _id: doc._id },
            { $set: { eligible: verdict.eligible, ineligibleReason: verdict.reason } },
            { new: true }
        );
    }
    if (current.redeemedBy && ['applied', 'pending'].includes(current.grantStatus)) {
        const units = current.eligible ? offerUnits(current.lineItems, current.refundLines) : 0;
        if (units < unitsOf(current)) {
            const reason = current.eligible ? 'partial_refund' : (current.ineligibleReason || 'not_eligible');
            if (await takeBackDays(current, units, reason)) current = await ShopifyPurchase.findById(current._id);
        }
    }
    return current;
};

// ---------------------------------------------------------------------------
// storing orders
// ---------------------------------------------------------------------------

/**
 * Save the latest state of one Shopify order, then reconcile it. Idempotent and
 * stale-safe: a write only applies if its Shopify updated_at is at least as new
 * as what's stored, so a delayed "paid" webhook can never undo a later
 * "cancelled". A stale write hits the unique shopifyOrderId on the upsert and is
 * dropped.
 */
const upsertPurchase = async (order, source) => {
    if (!order.shopifyOrderId || !order.orderName) throw new Error('order is missing id or name');
    const { emailHashes, phoneHashes } = identityHashes(order);

    const fields = {
        orderName: order.orderName,
        orderNumber: order.orderNumber,
        emailHashes,
        phoneHashes,
        skus: order.skus,
        lineItems: order.lineItems || [],
        financialStatus: order.financialStatus,
        cancelledAt: order.cancelledAt,
        isTest: order.isTest,
        orderCreatedAt: order.orderCreatedAt,
        orderUpdatedAt: order.orderUpdatedAt,
    };

    let doc;
    try {
        doc = await ShopifyPurchase.findOneAndUpdate(
            {
                shopifyOrderId: order.shopifyOrderId,
                $or: [{ orderUpdatedAt: { $lte: order.orderUpdatedAt } }, { orderUpdatedAt: null }],
            },
            { $set: fields, $setOnInsert: { shopifyOrderId: order.shopifyOrderId, firstSource: source, eligible: false } },
            { upsert: true, new: true }
        );
    } catch (err) {
        if (err && err.code === 11000) return ShopifyPurchase.findOne({ shopifyOrderId: order.shopifyOrderId });
        throw err;
    }
    return reconcile(doc);
};

// refunds/create: record the refunded units (once per refund id), then reconcile.
const applyRefund = async (refund) => {
    if (!refund.orderId) return { ignored: true };

    let doc = await ShopifyPurchase.findOne({ shopifyOrderId: refund.orderId });
    if (!doc && shopifyAdmin.isConfigured()) {
        const node = await shopifyAdmin.fetchOrderById(refund.orderId);
        if (node) doc = await upsertPurchase(normalizeGraphqlOrder(node), 'webhook');
    }
    if (!doc) return { ignored: 'unknown_order' }; // never stored -> nothing was given, nothing to take back

    if (refund.refundId && refund.items.length) {
        doc = (await ShopifyPurchase.findOneAndUpdate(
            { _id: doc._id, processedRefundIds: { $ne: refund.refundId } },
            {
                $push: {
                    processedRefundIds: refund.refundId,
                    refundLines: { $each: refund.items.map((i) => ({ ...i, refundId: refund.refundId })) },
                },
            },
            { new: true }
        )) || doc;
    }

    // Amount-only refunds carry no line items; Shopify's own financial status
    // ('refunded' vs 'partially_refunded') then decides.
    if (shopifyAdmin.isConfigured()) {
        const node = await shopifyAdmin.fetchOrderById(refund.orderId);
        if (node) doc = await upsertPurchase(normalizeGraphqlOrder(node), 'webhook');
    }
    doc = await reconcile(doc);
    return { orderName: doc?.orderName, eligible: doc?.eligible, revoked: doc?.grantStatus === 'revoked' };
};

// ---------------------------------------------------------------------------
// deciding and granting the offer
// ---------------------------------------------------------------------------

const identityMatches = (purchase, user, secret) => {
    if (user.isEmailVerified) {
        const email = normalizeEmail(user.email);
        if (email && purchase.emailHashes.includes(hashIdentifier('email', email, secret))) return true;
    }
    return false;
};

/**
 * Rules A-D from the top of this file. Pure: returns what to do, writes nothing.
 *   { kind: 'pending' }                         -> D
 *   { kind: 'applied', end: Date, keepStart }   -> A / B / C
 * "Bought before joining" compares the Shopify order date with the account's
 * createdAt, so a buyer who signs up gets 30 days, not 14 + 30.
 */
const decideOffer = (user, purchase, now, days) => {
    const sub = user.subscription || {};
    if (hasActivePaidPlan(sub)) return { kind: 'pending' };

    // Judged at `now` (not the wall clock) so the rules are one consistent moment.
    const trialRunning = sub.plan === TRIAL_PLAN_KEY && sub.status === 'active'
        && Boolean(sub.currentPeriodEnd) && new Date(sub.currentPeriodEnd) > now;
    const joinedAt = user.createdAt ? new Date(user.createdAt) : null;
    const boughtBeforeJoining = Boolean(joinedAt && purchase.orderCreatedAt && new Date(purchase.orderCreatedAt) < joinedAt);

    let end;
    if (trialRunning && boughtBeforeJoining) {
        end = new Date(joinedAt.getTime() + days * DAY_MS);                          // B
        if (end <= now) end = new Date(now.getTime() + days * DAY_MS);
    } else if (trialRunning) {
        end = new Date(new Date(sub.currentPeriodEnd).getTime() + days * DAY_MS);  // A
    } else {
        end = new Date(now.getTime() + days * DAY_MS);                               // C
    }
    return { kind: 'applied', end, keepStart: trialRunning && Boolean(sub.startDate) };
};

// Subscription fields for the offer: take_plus until `end`, marked as a grant.
const offerFields = (end, now, keepStart) => ({
    'subscription.plan': OFFER_PLAN_KEY,
    'subscription.grantSource': GRANT_SOURCE,
    'subscription.status': 'active',
    'subscription.currentPeriodEnd': end,
    'subscription.endDate': end,
    'subscription.autoRenew': false,
    'subscription.statusUpdatedAt': now,
    ...(keepStart ? {} : { 'subscription.startDate': now }),
    // The trial-ending email cron only picks users with this unset. Someone who
    // already got the email for their 14-day trial must get it again before the
    // new end (the Razorpay renewal webhook clears it the same way).
    'subscription.renewalReminderSentAt': null,
});

const CLAIM_FIELDS = ['redeemedAt', 'redeemedVia', 'grantStatus', 'previousSubscription', 'units', 'grantedDays', 'pendingDays', 'grantedUntil'];

// Undo a claim whose account update failed, so the order can be claimed again.
const releaseClaim = (purchaseId, userId) => ShopifyPurchase.updateOne(
    { _id: purchaseId, redeemedBy: userId },
    { $set: { redeemedBy: null }, $unset: Object.fromEntries(CLAIM_FIELDS.map((f) => [f, ''])) }
).catch((e) => console.error(`[ShopifyOffer] could not release claim on ${purchaseId}:`, e.message));

/**
 * Claim `purchase` for `user`, then give its days (units x SHOPIFY_OFFER_DAYS).
 * The claim is a conditional update (redeemedBy must still be null), so two
 * people redeeming one order at the same moment can't both win. One user may
 * claim many orders: if their free Take+ is already running the days are added
 * after its current end, otherwise rules A-D decide. If the account update
 * fails, the claim is released.
 */
const claimAndGrant = async (purchase, user, via, now = new Date()) => {
    const units = offerUnits(purchase.lineItems, purchase.refundLines);
    const days = units * getOfferConfig().days;
    if (!days) throw new OfferError(422, 'NOT_ELIGIBLE', INELIGIBLE_MESSAGES.product_not_in_offer);

    const stack = onOfferGrant(user.subscription, now);
    const decision = stack ? { kind: 'applied' } : decideOffer(user, purchase, now, days);
    const pending = decision.kind === 'pending';

    let claimed;
    try {
        claimed = await ShopifyPurchase.findOneAndUpdate(
            { _id: purchase._id, redeemedBy: null, eligible: true },
            {
                $set: {
                    redeemedBy: user._id,
                    redeemedAt: now,
                    redeemedVia: via,
                    grantStatus: decision.kind,
                    units,
                    ...(pending ? { pendingDays: days, grantedDays: 0 } : { grantedDays: days }),
                    // Only the order that starts the offer remembers what to go back to.
                    ...(!pending && !stack ? { previousSubscription: snapshotOf(user.subscription) } : {}),
                },
            },
            { new: true }
        );
    } catch (err) {
        // Until scripts/migrateShopifyRedeemIndex.js has run, the old unique
        // index refuses a user's second order.
        if (err && err.code === 11000) throw new OfferError(503, 'TRY_LATER', 'We couldn’t add this order right now. Please try again later.');
        throw err;
    }
    if (!claimed) {
        const current = await ShopifyPurchase.findById(purchase._id).lean();
        if (current?.redeemedBy && String(current.redeemedBy) === String(user._id)) return statusOf(current, true);
        throw new OfferError(409, 'ORDER_ALREADY_USED', 'This order has already been used to claim the offer.');
    }

    // D: nothing to change on the account yet — the lifecycle cron applies it.
    if (pending) {
        console.log(`🎁 [ShopifyOffer] ${claimed.orderName} -> user ${user._id} (${via}), ${units} items = ${days} days pending until the paid plan ends`);
        return statusOf(claimed, false);
    }

    let end;
    let set = null;
    try {
        if (stack) {
            end = await extendOfferGrant(user._id, days, now);
            if (!end) throw new Error('the free Take+ ended while this order was being added');
        } else {
            end = decision.end;
            set = offerFields(end, now, decision.keepStart);
            // updateOne by _id also drops the cached copy `protect` uses (User model hook).
            await User.updateOne({ _id: user._id }, { $set: set });
        }
    } catch (err) {
        await releaseClaim(claimed._id, user._id);
        throw err;
    }

    await ShopifyPurchase.updateOne({ _id: claimed._id }, { $set: { grantedUntil: end } });
    console.log(`🎁 [ShopifyOffer] ${claimed.orderName} -> user ${user._id} (${via}), ${units} items = ${days} days, take_plus until ${end.toISOString()}${stack ? ' (added to running offer)' : ''}`);
    return { ...statusOf({ ...claimed.toObject(), grantedUntil: end }, false), subscriptionSet: set };
};

function statusOf(purchase, alreadyRedeemed) {
    return {
        alreadyRedeemed,
        orderName: purchase.orderName,
        grantStatus: purchase.grantStatus,
        units: unitsOf(purchase),
        days: purchase.grantStatus === 'pending' ? purchase.pendingDays : grantedDaysOf(purchase),
        grantedUntil: purchase.grantStatus === 'applied' ? purchase.grantedUntil || null : null,
        pendingDays: purchase.grantStatus === 'pending' ? purchase.pendingDays : null,
        revokeReason: purchase.grantStatus === 'revoked' ? purchase.revokeReason || null : null,
    };
}

/**
 * Rule D, second half: give the waiting days to users whose paid plan has ended.
 * Called by the subscription lifecycle cron BEFORE its downgrade, so the user
 * moves straight from the paid plan to the offer instead of to 'free'. Also
 * catches users a Razorpay webhook already set to 'free'. A user with several
 * waiting orders gets them one after another (the 2nd adds to the 1st).
 */
const applyPendingCredits = async (now = new Date()) => {
    const pending = await ShopifyPurchase.find({ grantStatus: 'pending' })
        .sort({ redeemedAt: 1 })
        .select('redeemedBy pendingDays units orderName').limit(PENDING_BATCH).lean();

    let applied = 0;
    for (const p of pending) {
        try {
            const user = await User.findById(p.redeemedBy).select('subscription').lean();
            if (!user || hasActivePaidPlan(user.subscription)) continue; // still paying — keep waiting

            const days = p.pendingDays != null ? p.pendingDays : getOfferConfig().days;
            const stack = onOfferGrant(user.subscription, now);
            // Flip pending -> applied first so a second cron run can't apply it twice.
            const flipped = await ShopifyPurchase.updateOne(
                { _id: p._id, grantStatus: 'pending' },
                { $set: {
                    grantStatus: 'applied',
                    grantedDays: days,
                    units: unitsOf(p),
                    ...(stack ? {} : { previousSubscription: snapshotOf(user.subscription) }),
                } }
            );
            if (flipped.modifiedCount !== 1) continue;
            try {
                let end;
                if (stack) {
                    end = await extendOfferGrant(user._id, days, now);
                    if (!end) throw new Error('the free Take+ ended while applying');
                } else {
                    end = new Date(now.getTime() + days * DAY_MS);
                    await User.updateOne({ _id: user._id }, { $set: offerFields(end, now, false) });
                }
                await ShopifyPurchase.updateOne({ _id: p._id }, { $set: { grantedUntil: end } });
                applied += 1;
                console.log(`🎁 [ShopifyOffer] pending ${p.orderName} applied to user ${user._id}, ${days} days, take_plus until ${end.toISOString()}`);
            } catch (err) {
                await ShopifyPurchase.updateOne({ _id: p._id }, { $set: { grantStatus: 'pending', grantedDays: 0 }, $unset: { grantedUntil: '', previousSubscription: '' } });
                throw err;
            }
        } catch (err) {
            console.error(`[ShopifyOffer] applying pending ${p.orderName} failed:`, err.message);
        }
    }
    return applied;
};

// ---------------------------------------------------------------------------
// Redeem screen
// ---------------------------------------------------------------------------

const findPurchaseForInput = async (parsed) => {
    const byName = await ShopifyPurchase.findOne({ orderName: parsed.orderName });
    if (byName) return byName;
    return parsed.orderNumber ? ShopifyPurchase.findOne({ orderNumber: parsed.orderNumber }) : null;
};

// Pull the order from Shopify when we don't have it (missed webhook, or an order
// from before the webhooks existed) or when what we have may be outdated (e.g. a
// COD order stored as 'pending' that has since been marked paid).
const refreshFromShopify = async (orderName) => {
    if (!shopifyAdmin.isConfigured()) return null;
    try {
        const node = await shopifyAdmin.findOrderByName(orderName, normalizeOrderName);
        return node ? upsertPurchase(normalizeGraphqlOrder(node), 'lookup') : null;
    } catch (err) {
        console.error(`[ShopifyOffer] Admin API lookup failed for ${orderName}:`, err.message);
        return null;
    }
};

// The buyer may have used a different email at checkout than in the app. Typing
// that checkout email next to the order number proves the order is theirs the
// same way the account email does: order numbers are guessable, the email on
// someone else's order is not. Optional — without it the account email is used.
const checkoutEmailMatches = (purchase, checkoutEmail, secret) => Boolean(
    checkoutEmail && purchase.emailHashes.includes(hashIdentifier('email', checkoutEmail, secret))
);

const redeemForUser = async (userId, input, checkoutEmailInput) => {
    const cfg = getOfferConfig();
    if (!cfg.matchSecret) throw new OfferError(503, 'NOT_CONFIGURED', 'This offer isn’t available right now.');

    const parsed = parseOrderNumberInput(input);
    if (!parsed) throw new OfferError(400, 'INVALID_ORDER_NUMBER', 'Please enter a valid order number, for example TAKE11005.');

    const hasCheckoutEmail = checkoutEmailInput != null && String(checkoutEmailInput).trim() !== '';
    const checkoutEmail = hasCheckoutEmail ? normalizeEmail(checkoutEmailInput) : null;
    if (hasCheckoutEmail && !checkoutEmail) {
        throw new OfferError(400, 'INVALID_EMAIL', 'Please enter the email address you used when placing the order.');
    }

    const user = await User.findById(userId).select(USER_FIELDS).lean();
    if (!user) throw new OfferError(404, 'USER_NOT_FOUND', 'Account not found.');

    let purchase = await findPurchaseForInput(parsed);
    if (!purchase || (!purchase.eligible && !purchase.redeemedBy)) {
        purchase = (await refreshFromShopify(purchase?.orderName || parsed.orderName)) || purchase;
    }

    // Same answer whether the order doesn't exist or isn't this user's, so the
    // response never confirms that someone else's order number is real.
    if (!purchase || !(identityMatches(purchase, user, cfg.matchSecret)
        || checkoutEmailMatches(purchase, checkoutEmail, cfg.matchSecret))) {
        throw new OfferError(404, 'NOT_FOUND', NOT_FOUND_MESSAGE);
    }

    if (purchase.redeemedBy && String(purchase.redeemedBy) === String(user._id)) return statusOf(purchase, true);
    if (purchase.redeemedBy) throw new OfferError(409, 'ORDER_ALREADY_USED', 'This order has already been used to claim the offer.');
    if (!purchase.eligible) {
        throw new OfferError(422, 'NOT_ELIGIBLE', INELIGIBLE_MESSAGES[purchase.ineligibleReason] || 'This order isn’t eligible for the offer.');
    }

    const result = await claimAndGrant(purchase, user, 'redeem');
    delete result.subscriptionSet;
    return result;
};

/**
 * Everything the app shows about the user's store orders. The top-level order
 * fields describe the latest claimed order (kept for older app builds);
 * `orders` lists all of them, `totalDays` adds up the days still credited
 * (given + waiting) and `offerEndsAt` is when the free Take+ ends, if running.
 * Users can keep adding orders, so the Redeem screen should stay available.
 */
const getStatusForUser = async (userId) => {
    const orders = await ShopifyPurchase.find({ redeemedBy: userId })
        .sort({ redeemedAt: -1 })
        .select('orderName redeemedAt grantStatus grantedUntil pendingDays revokeReason units grantedDays').lean();
    if (!orders.length) return { redeemed: false, orders: [], totalDays: 0, offerEndsAt: null };

    const user = await User.findById(userId).select('subscription').lean();
    const live = orders.filter((o) => o.grantStatus === 'applied' || o.grantStatus === 'pending');
    return {
        redeemed: true,
        redeemedAt: orders[0].redeemedAt,
        ...statusOf(orders[0], true),
        totalDays: live.reduce((sum, o) => sum + (statusOf(o, true).days || 0), 0),
        offerEndsAt: onOfferGrant(user?.subscription) ? user.subscription.currentPeriodEnd : null,
        orders: orders.map((o) => ({ redeemedAt: o.redeemedAt, ...statusOf(o, true) })),
    };
};

// ---------------------------------------------------------------------------
// signup: automatic match on the (verified) signup email
// ---------------------------------------------------------------------------

/**
 * Called right after a new account is created (all three signup paths). Never
 * throws — a problem here must not break signup; the Redeem screen still works
 * later. Claims EVERY unclaimed order on the signup email (oldest first, so
 * rule B dates from the first one and the rest add their days). Updates the
 * passed user document in memory so the signup response already shows it.
 * Returns the latest claim's status, or null if nothing matched.
 */
const applyOnSignup = async (user) => {
    try {
        const cfg = getOfferConfig();
        if (!cfg.matchSecret || !user?.isEmailVerified) return null;
        const email = normalizeEmail(user.email);
        if (!email) return null;

        const purchases = await ShopifyPurchase.find({
            emailHashes: hashIdentifier('email', email, cfg.matchSecret),
            eligible: true,
            redeemedBy: null,
        }).sort({ orderCreatedAt: 1 }).limit(50);
        if (!purchases.length) return null;

        let result = null;
        for (const purchase of purchases) {
            try {
                // Fresh subscription each time: the previous order may have started the offer.
                const current = await User.findById(user._id).select(USER_FIELDS).lean();
                result = await claimAndGrant(purchase, current || user, 'signup');
            } catch (err) {
                console.error(`[ShopifyOffer] signup claim of ${purchase.orderName} failed for user ${user._id}:`, err.message);
            }
        }
        if (result && typeof user.set === 'function') {
            const fresh = await User.findById(user._id).select('subscription').lean();
            if (fresh?.subscription) user.set('subscription', fresh.subscription);
        }
        if (result) delete result.subscriptionSet;
        return result;
    } catch (err) {
        console.error(`[ShopifyOffer] signup auto-match failed for user ${user?._id}:`, err.message);
        return null;
    }
};

// ---------------------------------------------------------------------------
// webhooks
// ---------------------------------------------------------------------------

// A buyer who already has an account gets the offer as soon as the order is
// eligible. Only verified emails are trusted for this (phone ignored for now).
const grantToExistingUser = async (purchase, order) => {
    if (!purchase?.eligible || purchase.redeemedBy) return null;
    const emails = [...new Set(order.emails.map(normalizeEmail).filter(Boolean))];
    if (!emails.length) return null;

    const user = await User.findOne({ email: { $in: emails }, isEmailVerified: true, isActive: true }).select(USER_FIELDS).lean();
    if (!user) return null;
    try {
        return await claimAndGrant(purchase, user, 'webhook');
    } catch (err) {
        if (err instanceof OfferError) return null; // already used — nothing to do
        throw err;
    }
};

const ORDER_TOPICS = new Set(['orders/create', 'orders/paid', 'orders/updated', 'orders/cancelled']);

/**
 * Handle one verified Shopify webhook. Idempotent; a repeated delivery is a no-op.
 * Throws on a transient failure so the route answers 500 and Shopify retries.
 */
const handleWebhook = async ({ topic, webhookId, rawBody, body }) => {
    if (webhookId && await ProcessedWebhook.exists({ source: 'shopify', eventId: webhookId })) {
        return { duplicate: true };
    }

    let result = { ignored: true, topic };
    if (ORDER_TOPICS.has(topic)) {
        const order = normalizeWebhookOrder(body);
        const purchase = await upsertPurchase(order, 'webhook');
        const granted = await grantToExistingUser(purchase, order);
        result = {
            orderName: purchase?.orderName,
            eligible: purchase?.eligible,
            granted: Boolean(granted && !granted.alreadyRedeemed),
            revoked: purchase?.grantStatus === 'revoked',
        };
    } else if (topic === 'refunds/create') {
        result = await applyRefund(normalizeRefund(body));
    }

    if (webhookId) {
        const payloadHash = crypto.createHash('sha256').update(rawBody || '').digest('hex');
        await ProcessedWebhook.create({ source: 'shopify', eventId: webhookId, payloadHash })
            .catch((err) => { if (err.code !== 11000) throw err; });
    }
    return result;
};

module.exports = {
    OfferError,
    upsertPurchase,
    claimAndGrant,
    applyPendingCredits,
    takeBackDays,
    redeemForUser,
    getStatusForUser,
    applyOnSignup,
    handleWebhook,
    // exposed for tests
    _internal: { hasActivePaidPlan, identityMatches, decideOffer, offerFields, onOfferGrant },
    GRANT_SOURCE,
};
