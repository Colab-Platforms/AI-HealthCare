// M3: our confirmed Order -> a Shopify order (so the warehouse ships it), and
// Shopify's fulfilment / cancel / paid updates -> back to our Order.
//
// Create flow (one order at a time, safe to repeat):
//   1. claim      conditional update: status pending|failed, no live lease -> take a 60s lease
//   2. look up    is there already a Shopify order tagged TH-...? (a previous attempt
//                 may have created it and crashed before recording it) -> adopt it
//   3. create     orderCreate (stock decremented, never rejected for stock)
//   4. record     synced + shopifyOrderId, or failed (retry by cron after 2 min),
//                 or needs_attention (permanent error / too many attempts) — a human looks
//
// Triggers: QStash right after payment confirmation, plus the 10-minute cron
// sweep as the safety net. Everything is behind SHOP_SHOPIFY_ORDER_SYNC.

const Order = require('../../../models/Order');
const config = require('../config');
const client = require('./shopifyOrderClient');
const reservations = require('./stockReservationService');
const notifier = require('./orderNotifier');
const refunds = require('./refundService');
const events = require('./eventService');
const { transition, TRANSITIONS } = require('../lib/orderStateMachine');
const { toOrderCreateVariables, readShopifyOrder, tagFor, legacyId, SHOP_TAG } = require('../lib/shopifyOrderMapper');

const CONFIRMED = ['paid', 'cod_pending'];
const SYNCABLE = ['pending', 'failed'];

const alert = (order, msg) => console.error(`[ALERT][Shop/shopifySync] ${order.internalOrderId}: ${msg}`);

const markSynced = async (order, shopifyOrder, how) => {
    const updated = await transition(Order, {
        orderId: order._id,
        field: 'shopifySyncStatus',
        to: 'synced',
        source: 'system',
        eventId: `shopify:${legacyId(shopifyOrder.id || shopifyOrder.legacyResourceId)}`,
        set: {
            shopifyOrderId: String(shopifyOrder.legacyResourceId || legacyId(shopifyOrder.id)),
            shopifyOrderName: shopifyOrder.name || null,
            shopifySyncError: null,
            shopifySyncLeaseUntil: null,
        },
    });
    if (updated) {
        // Shopify stock is reduced now; keep a short hold until its inventory webhook updates our copy.
        await reservations.extend(order._id, new Date(Date.now() + config.reservationAfterSyncedMs));
        console.log(`[Shop/shopifySync] ${order.internalOrderId} -> Shopify ${updated.shopifyOrderName || updated.shopifyOrderId} (${how})`);
    }
    return updated;
};

const markFailed = async (order, err, { permanent }) => {
    const attempts = order.shopifySyncAttempts || 0;
    const giveUp = permanent || attempts >= config.shopifySyncMaxAttempts();
    const to = giveUp ? 'needs_attention' : 'failed';
    const set = { shopifySyncError: String(err.message || err).slice(0, 500), shopifySyncLeaseUntil: null };
    const moved = await transition(Order, { orderId: order._id, field: 'shopifySyncStatus', to, source: 'system', set });
    // failed -> failed isn't a state change, but the error and the lease must still update.
    if (!moved && to === 'failed') await Order.updateOne({ _id: order._id, shopifySyncStatus: 'failed' }, { $set: set });
    if (giveUp) alert(order, `needs attention after ${attempts} attempt(s): ${err.message || err}`);
    else console.warn(`[Shop/shopifySync] ${order.internalOrderId} attempt ${attempts} failed (will retry): ${err.message || err}`);
    return to;
};

// The customer cancelled while we were creating the Shopify order: cancel it
// there too, so the warehouse never ships it.
const cancelIfCancelledMeanwhile = async (orderId, shopifyNode) => {
    const now = await Order.findById(orderId).select('cancelledAt internalOrderId').lean();
    if (!now?.cancelledAt) return;
    try {
        const { userErrors } = await client.cancelOrder(shopifyNode.legacyResourceId || legacyId(shopifyNode.id), { reason: 'CUSTOMER', staffNote: 'Cancelled in the app while the order was being created' });
        if (userErrors.length) alert(now, `cancelled in app but Shopify cancel failed: ${userErrors.map((e) => e.message).join('; ')} — CANCEL IN SHOPIFY MANUALLY`);
    } catch (err) {
        alert(now, `cancelled in app but Shopify cancel failed: ${err.message} — CANCEL IN SHOPIFY MANUALLY`);
    }
};

/**
 * Create (or adopt) the Shopify order for one of our orders.
 * @returns {Promise<{ result: string }>} synced | adopted | failed | needs_attention | skipped:<why>
 */
const syncOrder = async (orderId) => {
    if (!config.shopifyOrderSync()) return { result: 'skipped:disabled' };
    const now = Date.now();
    const order = await Order.findOneAndUpdate(
        {
            _id: orderId,
            shopifySyncStatus: { $in: SYNCABLE },
            paymentStatus: { $in: CONFIRMED },
            'review.needed': { $ne: true },
            $or: [{ shopifySyncLeaseUntil: null }, { shopifySyncLeaseUntil: { $lt: new Date(now) } }],
        },
        { $set: { shopifySyncLeaseUntil: new Date(now + config.shopifySyncLeaseMs) }, $inc: { shopifySyncAttempts: 1 } },
        { new: true }
    ).lean();
    if (!order) return { result: 'skipped:not-claimable' };

    try {
        const existing = await client.findOrderByTag(tagFor(order));
        if (existing) {
            await markSynced(order, existing, 'adopted existing');
            if (!existing.cancelledAt) await cancelIfCancelledMeanwhile(order._id, existing);
            return { result: 'adopted' };
        }
        const { order: created, userErrors } = await client.createOrder(toOrderCreateVariables(order, {
            test: config.shopifyTestOrders(),
            sendReceipt: config.shopifySendReceipt(),
        }));
        if (userErrors.length || !created) {
            const msg = userErrors.map((e) => `${(e.field || []).join('.')}: ${e.message}`).join('; ') || 'orderCreate returned no order';
            return { result: await markFailed(order, new Error(msg), { permanent: true }) };
        }
        await markSynced(order, created, 'created');
        await cancelIfCancelledMeanwhile(order._id, created);
        return { result: 'synced' };
    } catch (err) {
        return { result: await markFailed(order, err, { permanent: !client.isTransient(err) }) };
    }
};

// ── Triggers ───────────────────────────────────────────────────────────────

let qstash;
const qstashClient = () => {
    if (qstash === undefined) {
        const { Client } = require('@upstash/qstash');
        qstash = process.env.QSTASH_TOKEN ? new Client({ token: process.env.QSTASH_TOKEN }) : null;
    }
    return qstash;
};

/**
 * Right after payment is confirmed. In production a QStash job (survives the
 * serverless request ending); without QStash (local dev) it runs inline. Never
 * throws — the cron sweep picks up anything that didn't go through.
 */
const enqueue = async (order) => {
    if (!config.shopifyOrderSync()) return 'disabled';
    const base = config.publicBaseUrl();
    const q = qstashClient();
    try {
        if (q && base && /^https:\/\//.test(base)) {
            await q.publishJSON({ url: `${base}/api/shop/internal/shopify-sync`, body: { orderId: String(order._id) }, retries: 0 });
            return 'queued';
        }
        await syncOrder(order._id);
        return 'inline';
    } catch (err) {
        console.warn(`[Shop/shopifySync] ${order.internalOrderId}: enqueue failed, cron will retry: ${err.message}`);
        return 'deferred';
    }
};

/** Cron safety net: confirmed orders still waiting for (or failed) Shopify creation. */
const sweep = async ({ limit = 20, deadline = Date.now() + 30 * 1000 } = {}) => {
    const stats = { attempted: 0, synced: 0, failed: 0, needsAttention: 0 };
    if (!config.shopifyOrderSync()) return stats;
    const due = await Order.find({
        paymentStatus: { $in: CONFIRMED },
        shopifySyncStatus: { $in: SYNCABLE },
        'review.needed': { $ne: true },
        updatedAt: { $lt: new Date(Date.now() - config.shopifyRetryAfterMs) },
    }).select('_id').sort({ updatedAt: 1 }).limit(limit).lean();
    for (const { _id } of due) {
        if (Date.now() > deadline) break;
        stats.attempted += 1;
        const { result } = await syncOrder(_id);
        if (result === 'synced' || result === 'adopted') stats.synced += 1;
        else if (result === 'failed') stats.failed += 1;
        else if (result === 'needs_attention') stats.needsAttention += 1;
    }
    return stats;
};

// ── Shopify -> us (fulfilment / cancel / paid) ─────────────────────────────

// Shortest path of allowed moves (e.g. unfulfilled -> fulfilled -> delivered).
const pathTo = (field, from, to) => {
    const map = TRANSITIONS[field];
    const prev = new Map([[from, null]]);
    const queue = [from];
    while (queue.length) {
        const s = queue.shift();
        if (s === to) break;
        for (const n of map[s] || []) if (!prev.has(n)) { prev.set(n, s); queue.push(n); }
    }
    if (!prev.has(to) || from === to) return [];
    const path = [];
    for (let s = to; s !== from; s = prev.get(s)) path.unshift(s);
    return path;
};

const moveFulfillment = async (order, target, extraSet = {}) => {
    let current = order;
    for (const step of pathTo('fulfillmentStatus', order.fulfillmentStatus, target)) {
        const next = await transition(Order, {
            orderId: order._id, field: 'fulfillmentStatus', to: step, source: 'shopify',
            set: step === target ? extraSet : {},
        });
        if (!next) return current; // someone else moved it; stop
        current = next;
    }
    return current;
};

/**
 * Apply a freshly fetched Shopify order to ours. Idempotent: replaying the
 * same state changes nothing (state machine + one push per event).
 */
const applyShopifyOrder = async (order, node) => {
    const s = readShopifyOrder(node);
    let current = order;
    const changes = [];

    // Our order should know its Shopify id (heals a crash between create and record).
    if (order.shopifySyncStatus !== 'synced' && (node.tags || []).includes(tagFor(order))) {
        const synced = await markSynced(order, node, 'healed from webhook');
        if (synced) { current = synced; changes.push('synced'); }
    }

    if (s.tracking && JSON.stringify(s.tracking) !== JSON.stringify(current.tracking || null)) {
        await Order.updateOne({ _id: order._id }, { $set: { tracking: s.tracking } });
        current = { ...current, tracking: s.tracking };
        changes.push('tracking');
    }

    if (s.cancelled) {
        const c = await moveFulfillment(current, 'cancelled');
        if (c.fulfillmentStatus === 'cancelled' && current.fulfillmentStatus !== 'cancelled') changes.push('fulfillment:cancelled');
        current = c;
        if (current.paymentStatus === 'cod_pending') {
            const p = await transition(Order, { orderId: order._id, field: 'paymentStatus', to: 'cancelled', source: 'shopify' });
            if (p) { current = p; changes.push('payment:cancelled'); }
        } else if (current.paymentStatus === 'paid') {
            // Money was taken and the store cancelled: refund it (auto or admin
            // approval, per SHOP_AUTO_REFUND). Skipped if a refund already exists
            // (e.g. the customer's own cancel, which also cancels in Shopify).
            const hasRefund = (current.refunds || []).some((r) => r.kind === 'order' && r.status !== 'failed');
            if (!hasRefund) {
                await Order.updateOne({ _id: order._id, cancelledAt: null }, { $set: { cancelledAt: new Date(), cancelledBy: 'store' } });
                const r = await refunds.requestRefund({ orderId: order._id, source: 'store_cancel', reason: 'Cancelled by the store', requestedBy: 'shopify' });
                current = r.order;
                changes.push('refund:requested');
            }
        }
        await reservations.release(order._id);
        await notifier.notify(current, 'cancelled');
        return { changes };
    }

    if (s.fulfillment) {
        const before = current.fulfillmentStatus;
        current = await moveFulfillment(current, s.fulfillment, s.fulfillment === 'delivered' ? { deliveredAt: s.deliveredAt || new Date() } : {});
        if (current.fulfillmentStatus !== before) {
            changes.push(`fulfillment:${current.fulfillmentStatus}`);
            if (before === 'unfulfilled') events.track('order_shipped', { user: order.user, orderId: order.internalOrderId, meta: { courier: current.tracking?.courier } });
            if (current.fulfillmentStatus === 'delivered') events.track('order_delivered', { user: order.user, orderId: order.internalOrderId });
        }
        if (['partial', 'fulfilled', 'delivered'].includes(current.fulfillmentStatus)) await notifier.notify(current, 'shipped');
        if (current.fulfillmentStatus === 'delivered') await notifier.notify(current, 'delivered');
    }

    // COD: cash collected (store marks the order paid).
    if (s.financialPaid && current.paymentStatus === 'cod_pending') {
        const p = await transition(Order, { orderId: order._id, field: 'paymentStatus', to: 'paid', source: 'shopify' });
        if (p) { current = p; changes.push('payment:paid'); }
    }
    return { changes };
};

const ORDER_TOPICS = new Set(['orders/create', 'orders/updated', 'orders/paid', 'orders/cancelled', 'orders/fulfilled', 'orders/partially_fulfilled']);
const FULFILLMENT_TOPICS = new Set(['fulfillments/create', 'fulfillments/update']);

/**
 * Is this Shopify webhook about one of OUR app orders? Returns our order or null.
 * orders/*: tagged take-app (or already linked by id); fulfillments/*: linked by order_id.
 */
const findAppOrder = async (topic, body) => {
    if (ORDER_TOPICS.has(topic)) {
        const id = String(body?.id || '');
        const tags = String(body?.tags || '').split(',').map((t) => t.trim());
        const tag = tags.find((t) => /^TH-\d{6}-[0-9A-Z]{8}$/.test(t));
        if (tag && tags.includes(SHOP_TAG)) return Order.findOne({ internalOrderId: tag }).lean();
        return id ? Order.findOne({ shopifyOrderId: id }).lean() : null;
    }
    if (FULFILLMENT_TOPICS.has(topic)) {
        const id = String(body?.order_id || '');
        return id ? Order.findOne({ shopifyOrderId: id }).lean() : null;
    }
    return null;
};

const isOrderLifecycleTopic = (topic) => ORDER_TOPICS.has(topic) || FULFILLMENT_TOPICS.has(topic);

/**
 * Verified Shopify webhook for an app order: fetch the order back from Shopify
 * (never trust the payload) and apply it. Throws on transient failure so the
 * route answers 500 and Shopify retries.
 */
const handleWebhook = async (order, topic, body) => {
    const shopifyId = order.shopifyOrderId || (ORDER_TOPICS.has(topic) ? body?.id : body?.order_id);
    if (!shopifyId) return { ignored: 'no shopify order id' };
    const node = await client.fetchOrder(shopifyId);
    if (!node) return { ignored: 'order not found in Shopify' };
    return applyShopifyOrder(order, node);
};

module.exports = {
    syncOrder, enqueue, sweep, applyShopifyOrder, handleWebhook, findAppOrder, isOrderLifecycleTopic,
    _internal: { pathTo },
};
