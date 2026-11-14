// "Buy from the Shopify store, get 30 days of the free trial in the app."
//
// This reuses the existing trial exactly as signup grants it — plan 'free_trial'
// (all PAID_FEATURES, see scripts/syncRazorpayPlans.js), only with a different
// currentPeriodEnd. Everything downstream already handles that plan:
//   - subscriptionAccess.isEntitled         -> feature access until currentPeriodEnd
//   - subscriptionLifecycleService cron     -> downgrade to 'free' when it passes
//   - trial-ending reminder cron            -> email before it ends
//
// What a buyer gets (offer days = SHOPIFY_OFFER_DAYS, 30):
//   A. on the 14-day trial, bought after joining -> +30 days after the trial ends
//   B. bought first, joined the app later        -> 30 days from joining (replaces the 14)
//   C. trial / plan already over                 -> 30 days from today
//   D. on a live paid plan                       -> 30 days after the paid plan ends
//      (kept 'pending' and applied by the lifecycle cron, so a Razorpay renewal
//       webhook can't overwrite it)
//
// If the offer product is returned/refunded or the order cancelled AFTER the
// offer was given, the offer is revoked: the account goes back to exactly what
// it had before (previousSubscription), and the person still can't claim again.
//
// Safety:
//   - An order number alone proves nothing (they're sequential): the order's
//     email or verified phone must match the account.
//   - Once per account (unique redeemedBy) and once per person (no other
//     redeemed order may share this order's email/phone) — revoked ones included.
//   - Only eligible orders: paid, not cancelled/refunded, offer product.

const crypto = require('crypto');
const User = require('../models/User');
const ShopifyPurchase = require('../models/ShopifyPurchase');
const ProcessedWebhook = require('../models/ProcessedWebhook');
const shopifyAdmin = require('./shopifyAdminService');
const { isEntitled, FREE_PLAN_KEY } = require('../middleware/subscriptionAccess');
const {
    getOfferConfig, parseOrderNumberInput, normalizeOrderName, normalizeEmail, normalizePhone,
    hashIdentifier, identityHashes, normalizeWebhookOrder, normalizeGraphqlOrder, normalizeRefund,
    finalEligibility,
} = require('../utils/shopifyOrder');

const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_PLAN_KEY = 'free_trial';
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
// anything that isn't free or the free trial, and still live per isEntitled.
const hasActivePaidPlan = (sub) => Boolean(
    sub && sub.plan !== FREE_PLAN_KEY && sub.plan !== TRIAL_PLAN_KEY && isEntitled(sub)
);

const snapshotOf = (sub = {}) => ({
    plan: sub.plan || FREE_PLAN_KEY,
    status: sub.status,
    startDate: sub.startDate,
    currentPeriodEnd: sub.currentPeriodEnd,
});

// ---------------------------------------------------------------------------
// revoking (offer product returned / refunded, or order cancelled)
// ---------------------------------------------------------------------------

/**
 * Take the offer back. The purchase is flipped to 'revoked' with a conditional
 * update first, so this runs once even if several refund webhooks race.
 *   pending -> nothing on the account yet; the lifecycle cron will now skip it.
 *   applied -> the account goes back to previousSubscription: the trial end it
 *              had before (A: original 14-day end, B: signup's 14 days), or
 *              'free' if it had no live trial (C, D).
 * The account is only touched if it is still on exactly the trial this offer
 * gave — if the user has since bought a plan, that plan is left alone.
 */
const revokeOffer = async (purchase, reason, now = new Date()) => {
    const before = await ShopifyPurchase.findOneAndUpdate(
        { _id: purchase._id, redeemedBy: { $ne: null }, grantStatus: { $in: ['applied', 'pending'] } },
        { $set: { grantStatus: 'revoked', revokedAt: now, revokeReason: reason } },
        { new: false }
    ).lean();
    if (!before) return false;

    if (before.grantStatus === 'pending') {
        console.log(`↩️  [ShopifyOffer] ${before.orderName} revoked (${reason}) before it started — user ${before.redeemedBy}`);
        return true;
    }

    const prev = before.previousSubscription || {};
    const restoreTrial = prev.plan === TRIAL_PLAN_KEY && prev.currentPeriodEnd && new Date(prev.currentPeriodEnd) > now;
    const set = restoreTrial
        ? {
            'subscription.currentPeriodEnd': prev.currentPeriodEnd,
            'subscription.endDate': prev.currentPeriodEnd,
            ...(prev.startDate ? { 'subscription.startDate': prev.startDate } : {}),
            'subscription.statusUpdatedAt': now,
            'subscription.renewalReminderSentAt': null,
        }
        : {
            // Same downgrade the lifecycle cron applies when a trial ends.
            'subscription.plan': FREE_PLAN_KEY,
            'subscription.status': 'expired',
            'subscription.autoRenew': false,
            'subscription.currentPeriodEnd': now,
            'subscription.endDate': now,
            'subscription.statusUpdatedAt': now,
        };

    const res = await User.updateOne(
        { _id: before.redeemedBy, 'subscription.plan': TRIAL_PLAN_KEY, 'subscription.currentPeriodEnd': before.grantedUntil },
        { $set: set }
    );
    console.log(`↩️  [ShopifyOffer] ${before.orderName} revoked (${reason}) — user ${before.redeemedBy} `
        + (res.modifiedCount ? (restoreTrial ? `back to trial ending ${new Date(prev.currentPeriodEnd).toISOString()}` : 'back to free') : 'changed plan since, left as is'));
    return true;
};

// Re-check an order after it or its refunds changed: fix `eligible`, and if the
// offer was already given on an order that is no longer eligible, revoke it.
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
    if (current.redeemedBy && !current.eligible && current.grantStatus !== 'revoked') {
        await revokeOffer(current, current.ineligibleReason || 'not_eligible');
        current = await ShopifyPurchase.findById(current._id);
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
    if (user.isPhoneVerified) {
        const phone = normalizePhone(user.phone);
        if (phone && purchase.phoneHashes.includes(hashIdentifier('phone', phone, secret))) return true;
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

    const trialRunning = sub.plan === TRIAL_PLAN_KEY && isEntitled(sub) && Boolean(sub.currentPeriodEnd);
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

// Subscription fields for a trial ending at `end`, same shape signup writes.
const trialFields = (end, now, keepStart) => ({
    'subscription.plan': TRIAL_PLAN_KEY,
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

// Once per person: has any other order sharing this order's email/phone already
// been redeemed (by any account, revoked included)?
const personAlreadyRedeemed = async (purchase) => {
    const or = [];
    if (purchase.emailHashes?.length) or.push({ emailHashes: { $in: purchase.emailHashes } });
    if (purchase.phoneHashes?.length) or.push({ phoneHashes: { $in: purchase.phoneHashes } });
    if (!or.length) return false;
    return Boolean(await ShopifyPurchase.exists({ _id: { $ne: purchase._id }, redeemedBy: { $ne: null }, $or: or }));
};

/**
 * Claim `purchase` for `user`, then apply the offer. The claim is a conditional
 * update (redeemedBy must still be null), so two people redeeming one order at
 * the same moment can't both win; the unique index on redeemedBy stops one
 * account claiming twice. If the trial update fails, the claim is released.
 */
const claimAndGrant = async (purchase, user, via, now = new Date()) => {
    if (await personAlreadyRedeemed(purchase)) {
        throw new OfferError(409, 'OFFER_ALREADY_USED', 'This offer has already been used. It can be claimed only once per customer.');
    }

    const days = getOfferConfig().days;
    const decision = decideOffer(user, purchase, now, days);

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
                    ...(decision.kind === 'pending'
                        ? { pendingDays: days }
                        : { previousSubscription: snapshotOf(user.subscription) }),
                },
            },
            { new: true }
        );
    } catch (err) {
        if (err && err.code === 11000) throw new OfferError(409, 'OFFER_ALREADY_USED', 'This offer has already been used. It can be claimed only once per customer.');
        throw err;
    }
    if (!claimed) {
        const current = await ShopifyPurchase.findById(purchase._id).lean();
        if (current?.redeemedBy && String(current.redeemedBy) === String(user._id)) return statusOf(current, true);
        throw new OfferError(409, 'ORDER_ALREADY_USED', 'This order has already been used to claim the offer.');
    }

    // D: nothing to change on the account yet — the lifecycle cron applies it.
    if (decision.kind === 'pending') {
        console.log(`🎁 [ShopifyOffer] ${claimed.orderName} -> user ${user._id} (${via}), ${days} days pending until the paid plan ends`);
        return statusOf(claimed, false);
    }

    const set = trialFields(decision.end, now, decision.keepStart);
    try {
        // updateOne by _id also drops the cached copy `protect` uses (User model hook).
        await User.updateOne({ _id: user._id }, { $set: set });
    } catch (err) {
        await ShopifyPurchase.updateOne(
            { _id: claimed._id, redeemedBy: user._id },
            { $set: { redeemedBy: null }, $unset: { redeemedAt: '', redeemedVia: '', grantStatus: '', previousSubscription: '' } }
        ).catch((e) => console.error(`[ShopifyOffer] could not release claim on ${claimed._id}:`, e.message));
        throw err;
    }

    await ShopifyPurchase.updateOne({ _id: claimed._id }, { $set: { grantedUntil: decision.end } });
    console.log(`🎁 [ShopifyOffer] ${claimed.orderName} -> user ${user._id} (${via}), trial until ${decision.end.toISOString()}`);
    return { ...statusOf({ ...claimed.toObject(), grantedUntil: decision.end }, false), subscriptionSet: set };
};

function statusOf(purchase, alreadyRedeemed) {
    return {
        alreadyRedeemed,
        orderName: purchase.orderName,
        grantStatus: purchase.grantStatus,
        grantedUntil: purchase.grantStatus === 'applied' ? purchase.grantedUntil || null : null,
        pendingDays: purchase.grantStatus === 'pending' ? purchase.pendingDays : null,
        revokeReason: purchase.grantStatus === 'revoked' ? purchase.revokeReason || null : null,
    };
}

/**
 * Rule D, second half: give the waiting days to users whose paid plan has ended.
 * Called by the subscription lifecycle cron BEFORE its downgrade, so the user
 * moves straight from the paid plan to the trial instead of to 'free'. Also
 * catches users a Razorpay webhook already set to 'free'.
 */
const applyPendingCredits = async (now = new Date()) => {
    const pending = await ShopifyPurchase.find({ grantStatus: 'pending' })
        .select('redeemedBy pendingDays orderName').limit(PENDING_BATCH).lean();

    let applied = 0;
    for (const p of pending) {
        try {
            const user = await User.findById(p.redeemedBy).select('subscription').lean();
            if (!user || hasActivePaidPlan(user.subscription)) continue; // still paying — keep waiting

            const end = new Date(now.getTime() + (p.pendingDays || getOfferConfig().days) * DAY_MS);
            // Flip pending -> applied first so a second cron run can't apply it twice.
            const flipped = await ShopifyPurchase.updateOne(
                { _id: p._id, grantStatus: 'pending' },
                { $set: { grantStatus: 'applied', grantedUntil: end, previousSubscription: snapshotOf(user.subscription) } }
            );
            if (flipped.modifiedCount !== 1) continue;
            try {
                await User.updateOne({ _id: user._id }, { $set: trialFields(end, now, false) });
                applied += 1;
                console.log(`🎁 [ShopifyOffer] pending ${p.orderName} applied to user ${user._id}, trial until ${end.toISOString()}`);
            } catch (err) {
                await ShopifyPurchase.updateOne({ _id: p._id }, { $set: { grantStatus: 'pending' }, $unset: { grantedUntil: '', previousSubscription: '' } });
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

const getStatusForUser = async (userId) => {
    const purchase = await ShopifyPurchase.findOne({ redeemedBy: userId })
        .select('orderName redeemedAt grantStatus grantedUntil pendingDays revokeReason').lean();
    return purchase ? { redeemed: true, redeemedAt: purchase.redeemedAt, ...statusOf(purchase, true) } : { redeemed: false };
};

// ---------------------------------------------------------------------------
// signup: automatic match on the (verified) signup email
// ---------------------------------------------------------------------------

/**
 * Called right after a new account is created (all three signup paths). Never
 * throws — a problem here must not break signup; the Redeem screen still works
 * later. Updates the passed user document in memory so the signup response
 * already shows the 30-day trial.
 */
const applyOnSignup = async (user) => {
    try {
        const cfg = getOfferConfig();
        if (!cfg.matchSecret || !user?.isEmailVerified) return null;
        const email = normalizeEmail(user.email);
        if (!email) return null;

        const purchase = await ShopifyPurchase.findOne({
            emailHashes: hashIdentifier('email', email, cfg.matchSecret),
            eligible: true,
            redeemedBy: null,
        }).sort({ orderCreatedAt: -1 });
        if (!purchase) return null;

        const result = await claimAndGrant(purchase, user, 'signup');
        if (result.subscriptionSet && typeof user.set === 'function') {
            for (const [path, value] of Object.entries(result.subscriptionSet)) user.set(path, value);
        }
        delete result.subscriptionSet;
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
// eligible. Only verified emails / phones are trusted for this.
const grantToExistingUser = async (purchase, order) => {
    if (!purchase?.eligible || purchase.redeemedBy) return null;
    const emails = [...new Set(order.emails.map(normalizeEmail).filter(Boolean))];
    const phones = [...new Set(order.phones.map(normalizePhone).filter(Boolean))];
    const or = [];
    if (emails.length) or.push({ email: { $in: emails }, isEmailVerified: true });
    if (phones.length) or.push({ phone: { $in: phones }, isPhoneVerified: true });
    if (!or.length) return null;

    const user = await User.findOne({ $or: or, isActive: true }).select(USER_FIELDS).lean();
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
    revokeOffer,
    redeemForUser,
    getStatusForUser,
    applyOnSignup,
    handleWebhook,
    // exposed for tests
    _internal: { hasActivePaidPlan, identityMatches, decideOffer, trialFields },
};
