// Fastrr order status -> our Order. ONE code path for every trigger:
//
//   webhook (Fastrr -> us)   unsigned, may repeat  -> only the order_id is used
//   return page              user lands back from checkout
//   app poll                 GET /orders/:id while payment is pending (throttled)
//   reconciliation cron      safety net for missed webhooks; expires abandoned checkouts
//
// Each trigger only says "look at Fastrr order X". We then fetch the order from
// Fastrr's Order Details API (fetch-back) and apply it through the state
// machine, so duplicates, races and out-of-order deliveries are harmless: the
// first conditional update wins, the rest find nothing to change.

const Order = require('../../../models/Order');
const Cart = require('../models/Cart');
const config = require('../config');
const fastrr = require('./fastrrClient');
const reservations = require('./stockReservationService');
const refunds = require('./refundService');
const { toPaise } = require('../lib/money');
const notifier = require('./orderNotifier');
const shopifyOrderSync = require('./shopifyOrderSyncService');
const { transition } = require('../lib/orderStateMachine');
const { interpretStatus, verifyAgainstOrder, confirmedOrderFields } = require('../lib/fastrrOrderMapper');
const { isValidFastrrOrderId } = require('../lib/checkoutLogic');

const CONFIRMED = new Set(['paid', 'cod_pending']);
// States in which a (second) successful Fastrr payment means money to refund.
const PLACED = new Set(['paid', 'cod_pending', 'refund_pending', 'partially_refunded', 'refunded', 'cancelled']);

const flagForReview = (orderId, reason) => Order.updateOne(
    { _id: orderId, 'review.reasons': { $ne: reason } },
    { $set: { 'review.needed': true, 'review.flaggedAt': new Date() }, $push: { 'review.reasons': reason } }
);

/**
 * Apply one Fastrr Order Details result to our order.
 * @returns {Promise<{ result: string, status?: string }>}
 */
const applyDetails = async (order, details, { source, eventId = null }) => {
    const fid = String(details?.order_id || '');
    if (!fid || !(order.fastrrOrderIds || []).includes(fid)) {
        console.error(`[Shop/fastrr] ${order.internalOrderId}: details for foreign Fastrr order ${fid || '?'} — ignored`);
        return { result: 'foreign' };
    }

    const { outcome, method } = interpretStatus(details);

    if (outcome === 'pending') return { result: 'pending' };

    if (outcome === 'failed') {
        // A failed *older* token doesn't fail an order that has a newer live one.
        if (fid !== order.fastrrOrderId) return { result: 'ignored_stale_failure' };
        const updated = await transition(Order, { orderId: order._id, field: 'paymentStatus', to: 'failed', source, eventId });
        return { result: updated ? 'failed' : 'unchanged' };
    }

    // Confirmed: paid (prepaid) or cod_pending.
    const reasons = verifyAgainstOrder(order, details, outcome);
    const set = confirmedOrderFields(details, method);
    if (reasons.length) set.review = { needed: true, reasons, flaggedAt: new Date() };

    const updated = await transition(Order, { orderId: order._id, field: 'paymentStatus', to: outcome, set, source, eventId });

    if (!updated) {
        const current = await Order.findById(order._id).select('paymentStatus paidFastrrOrderId internalOrderId').lean();
        if (current && PLACED.has(current.paymentStatus) && current.paidFastrrOrderId && current.paidFastrrOrderId !== fid) {
            // The customer completed two Fastrr checkouts for one order (e.g. an
            // old WebView and a refreshed one). Money for the second must be refunded.
            await flagForReview(order._id, `DUPLICATE_PAYMENT:${fid}`);
            console.error(`[Shop/fastrr] ${order.internalOrderId}: second confirmed Fastrr order ${fid} — flagged for refund`);
            // Money was actually taken a second time (prepaid): refund that payment.
            const received = set.payment?.amountReceived ?? toPaise(details.total_amount_payable); // paise
            if (outcome === 'paid' && received > 0) {
                try {
                    await refunds.requestRefund({
                        orderId: order._id, kind: 'duplicate_payment', source: 'duplicate_payment', fastrrOrderId: fid,
                        amountPaise: received, reason: `Second payment for the same order (Fastrr ${fid})`,
                    });
                } catch (err) {
                    console.error(`[ALERT][Shop/fastrr] ${order.internalOrderId}: duplicate-payment refund request failed: ${err.message}`);
                }
            }
            return { result: 'duplicate_payment', status: current.paymentStatus };
        }
        return { result: 'unchanged', status: current?.paymentStatus };
    }

    if (reasons.length) {
        console.error(`[Shop/fastrr] ${order.internalOrderId} confirmed with review flags: ${reasons.join(', ')}`);
    }
    await afterConfirmed(updated, { needsReview: reasons.length > 0, source, eventId });
    return { result: outcome, status: updated.paymentStatus };
};

/**
 * Side effects of a confirmed order. Each step is idempotent, and the
 * reconciliation cron repairs a confirmed order whose Shopify sync never
 * started (e.g. the process died right here).
 */
const afterConfirmed = async (order, { needsReview = false, source = 'system', eventId = null } = {}) => {
    // Only the lines that were bought — anything added to the cart since stays.
    const variantIds = (order.items || []).map((i) => i.variantId);
    try {
        await Cart.updateOne({ user: order.user }, { $pull: { items: { variantId: { $in: variantIds } } } });
    } catch (err) {
        console.error(`[Shop/fastrr] ${order.internalOrderId}: cart clear failed: ${err.message}`);
    }
    // Stock stays held until the Shopify order exists (Shopify reduces stock then).
    try {
        await reservations.extend(order._id, new Date(Date.now() + config.reservationUntilSyncedMs));
    } catch (err) {
        console.error(`[Shop/fastrr] ${order.internalOrderId}: reservation extend failed: ${err.message}`);
    }
    const queued = await transition(Order, {
        orderId: order._id, field: 'shopifySyncStatus', to: needsReview ? 'needs_attention' : 'pending', source, eventId,
    });
    await notifier.notify(order, 'confirmed');
    // M3: create the Shopify order (behind SHOP_SHOPIFY_ORDER_SYNC; the cron sweep is the backup).
    if (queued && !needsReview) await shopifyOrderSync.enqueue(queued);
};

/**
 * Fetch-back + apply for the given Fastrr ids of one order (default: its most
 * recent ones). Returns the order's payment status afterwards.
 */
const syncOrder = async (order, { ids = null, source = 'system', eventId = null } = {}) => {
    const all = order.fastrrOrderIds || [];
    const toCheck = (ids || all.slice(-config.reconcile.maxFastrrIdsPerOrder).reverse()).filter((id) => all.includes(id));
    const results = [];
    for (const id of toCheck) {
        const details = await fastrr.getOrderDetails(id);
        results.push(await applyDetails(order, details, { source, eventId }));
    }
    const current = await Order.findById(order._id).lean();
    return { order: current, results };
};

// ── Webhook ────────────────────────────────────────────────────────────────

/**
 * POST /api/shop/fastrr/webhook. The body is unsigned, so nothing in it is
 * trusted except as a pointer: the order id we look up and re-fetch.
 * Throws on a transient failure so the controller answers 500 (Fastrr retries,
 * and the cron is the backup).
 */
const handleWebhook = async (body) => {
    const fid = String(body?.order_id || body?.platform_order_id || '');
    if (!isValidFastrrOrderId(fid)) return { ignored: 'invalid order id', httpStatus: 400 };

    const order = await Order.findOne({ fastrrOrderIds: fid }).lean();
    if (!order) return { ignored: 'unknown order' };
    // Repeat delivery for the order that already confirmed: nothing to fetch.
    if (order.paidFastrrOrderId === fid) return { orderId: order.internalOrderId, duplicate: true };

    const { order: after, results } = await syncOrder(order, { ids: [fid], source: 'webhook', eventId: `${fid}:${String(body?.status || '')}` });
    return { orderId: order.internalOrderId, result: results[0]?.result, status: after?.paymentStatus };
};

// ── On-demand (return page / app poll) ─────────────────────────────────────

/**
 * Check Fastrr for a pending order at most once per `onDemandSyncGapMs`, no
 * matter how often the app polls. Never throws — the caller just shows the
 * status we have.
 */
const syncPendingThrottled = async (order, { ids = null, source = 'poll' } = {}) => {
    if (!order || order.paymentStatus !== 'pending' || !order.fastrrOrderIds?.length || !fastrr.isConfigured()) return order;
    const now = Date.now();
    const won = await Order.findOneAndUpdate(
        {
            _id: order._id,
            paymentStatus: 'pending',
            $or: [{ fastrrCheckedAt: null }, { fastrrCheckedAt: { $lt: new Date(now - config.onDemandSyncGapMs) } }],
        },
        { $set: { fastrrCheckedAt: new Date(now) } },
        { new: true }
    ).lean();
    if (!won) return order;
    try {
        const { order: after } = await syncOrder(won, { ids: ids || [won.fastrrOrderId], source });
        return after || won;
    } catch (err) {
        console.warn(`[Shop/fastrr] ${order.internalOrderId}: on-demand status check failed: ${err.message}`);
        return won;
    }
};

// ── Reconciliation (QStash cron) ───────────────────────────────────────────

const runPool = async (items, concurrency, deadline, worker) => {
    let i = 0;
    let skipped = 0;
    const next = async () => {
        while (i < items.length) {
            if (Date.now() > deadline) { skipped += items.length - i; i = items.length; return; }
            const item = items[i++];
            await worker(item);
        }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
    return skipped;
};

const reconcile = async ({ now = Date.now(), log = console.log } = {}) => {
    const rc = config.reconcile;
    const deadline = now + rc.timeBudgetMs;
    const stats = { repaired: 0, checked: 0, confirmed: 0, failed: 0, expired: 0, errors: 0, skipped: 0 };

    // 1) Confirmed orders whose Shopify sync never started (crash after payment).
    const stuck = await Order.find({
        paymentStatus: { $in: [...CONFIRMED] },
        shopifySyncStatus: 'not_started',
        'review.needed': { $ne: true },
    }).select('_id internalOrderId').limit(rc.batchSize).lean();
    for (const o of stuck) {
        if (await transition(Order, { orderId: o._id, field: 'shopifySyncStatus', to: 'pending', source: 'reconciliation' })) stats.repaired += 1;
    }

    // 2) Pending checkouts old enough that the webhook should have come, and
    //    recently expired ones (a late payment can still land).
    const candidates = await Order.find({
        createdAt: { $gt: new Date(now - rc.lookbackMs) },
        $or: [
            { paymentStatus: 'pending', createdAt: { $lt: new Date(now - rc.pendingOlderThanMs) } },
            { paymentStatus: 'expired', updatedAt: { $gt: new Date(now - rc.recheckExpiredForMs) } },
        ],
    }).sort({ createdAt: 1 }).limit(rc.batchSize).lean();

    stats.skipped = await runPool(candidates, rc.concurrency, deadline, async (order) => {
        stats.checked += 1;
        try {
            let current = order;
            if (order.fastrrOrderIds?.length && fastrr.isConfigured()) {
                ({ order: current } = await syncOrder(order, { source: 'reconciliation' }));
            }
            if (!current) return;
            if (CONFIRMED.has(current.paymentStatus) && !CONFIRMED.has(order.paymentStatus)) stats.confirmed += 1;
            if (current.paymentStatus === 'failed' && order.paymentStatus !== 'failed') stats.failed += 1;
            if (current.paymentStatus !== 'pending') return;

            // Still pending: expire it once its token is long dead (or it never got one).
            // The filter re-checks that inside the update, so a token refreshed a
            // moment ago (or being fetched right now) keeps the order alive.
            const expired = await transition(Order, {
                orderId: order._id,
                field: 'paymentStatus',
                to: 'expired',
                source: 'reconciliation',
                extraFilter: {
                    $and: [
                        {
                            $or: [
                                { fastrrTokenExpiresAt: { $lt: new Date(now - rc.expireAfterTokenExpiryMs) } },
                                { fastrrTokenExpiresAt: null, createdAt: { $lt: new Date(now - rc.expireTokenlessAfterMs) } },
                            ],
                        },
                        { $or: [{ tokenLeaseUntil: null }, { tokenLeaseUntil: { $lt: new Date(now) } }] },
                    ],
                },
            });
            if (expired) {
                stats.expired += 1;
                await reservations.release(order._id);
            }
        } catch (err) {
            stats.errors += 1;
            console.error(`[Shop/reconcile] ${order.internalOrderId}: ${err.message}`);
        }
    });

    // 3) M4: refund statuses from Fastrr's refund report (only when refunds are open).
    try {
        stats.refunds = await refunds.syncRefundStatuses({ now });
    } catch (err) {
        stats.errors += 1;
        console.error(`[Shop/reconcile] refund status sync failed: ${err.message}`);
    }

    // 4) M3: create Shopify orders that are waiting / failed earlier (no-op while the flag is off).
    try {
        stats.shopify = await shopifyOrderSync.sweep({ deadline });
    } catch (err) {
        stats.errors += 1;
        console.error(`[Shop/reconcile] Shopify sweep failed: ${err.message}`);
    }

    log(`[Shop/reconcile] ${JSON.stringify(stats)}`);
    return stats;
};

module.exports = { applyDetails, afterConfirmed, syncOrder, handleWebhook, syncPendingThrottled, reconcile };
