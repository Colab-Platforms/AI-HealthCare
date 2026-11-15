// Refunds (M4). Money goes back through Fastrr; Shopify only records it.
//
// Life of a refund (Order.refunds[]):
//   requested    created (customer cancel / store cancel / duplicate payment / admin)
//   initiating   claimed by exactly one worker (conditional update) — no double send
//   initiated    Fastrr accepted it (we have its ref_id)
//   processing   Fastrr's report says it's on the way
//   completed    money returned (Fastrr report, or an admin marked a manual refund)
//   failed       Fastrr refused — an admin may retry
//   unknown      the call timed out: it MAY have gone through. Never re-sent
//                automatically; matched from Fastrr's refund report (order + amount)
//
// Safety:
//   - total of active refunds never exceeds what was paid (optimistic lock on refundVersion)
//   - auto-send only if SHOP_AUTO_REFUND and amount <= limit; otherwise an admin approves
//   - order payment status: paid -> refund_pending -> partially_refunded | refunded

const crypto = require('crypto');
const Order = require('../../../models/Order');
const config = require('../config');
const fastrr = require('./fastrrClient');
const shopifyClient = require('./shopifyOrderClient');
const notifier = require('./orderNotifier');
const { transition } = require('../lib/orderStateMachine');
const { ShopError } = require('../lib/shopError');

const ACTIVE = new Set(['requested', 'initiating', 'initiated', 'processing', 'unknown', 'completed']);
const OPEN = ['initiated', 'processing', 'unknown'];
const SYSTEM_SOURCES = new Set(['user_cancel', 'store_cancel', 'duplicate_payment']);
const MANUAL_METHODS = ['manual_upi', 'bank_transfer', 'store_credit', 'other'];

const newRefundId = () => `R-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
const alert = (order, msg) => console.error(`[ALERT][Shop/refund] ${order.internalOrderId}: ${msg}`);

/** What the customer actually paid online for the order (paise). 0 for COD. */
const paidAmount = (order) => {
    if (order.paymentMethod !== 'prepaid') return 0;
    return order.payment?.amountReceived ?? order.pricing?.total ?? order.amount;
};

const sumOf = (order, kind, statuses) => (order.refunds || [])
    .filter((r) => r.kind === kind && statuses.has(r.status))
    .reduce((n, r) => n + r.amount, 0);

/** Amount still refundable on the order's own payment (paise). */
const remainingRefundable = (order) => Math.max(0, paidAmount(order) - sumOf(order, 'order', ACTIVE));

const findRefund = (order, refundId) => (order.refunds || []).find((r) => r.refundId === refundId) || null;

const canAutoSend = (source, amount) =>
    SYSTEM_SOURCES.has(source) && config.autoRefund() && amount <= config.autoRefundMaxPaise();

// Positional update of one refund entry, guarded on its current status.
const setRefund = (orderId, refundId, fromStatuses, fields) => {
    const $set = { 'refunds.$.updatedAt': new Date() };
    for (const [k, v] of Object.entries(fields)) $set[`refunds.$.${k}`] = v;
    return Order.findOneAndUpdate(
        { _id: orderId, refunds: { $elemMatch: { refundId, status: { $in: fromStatuses } } } },
        { $set },
        { new: true }
    ).lean();
};

// ── Create ─────────────────────────────────────────────────────────────────

/**
 * Create a refund request and, if allowed, send it to Fastrr right away.
 *
 * @param {object} p
 * @param {*}      p.orderId         Order _id
 * @param {string} p.source          user_cancel | admin_cancel | store_cancel | admin | duplicate_payment
 * @param {number} [p.amountPaise]   default: everything still refundable (order) / required (duplicate)
 * @param {string} [p.reason]
 * @param {string} [p.kind]          order | duplicate_payment
 * @param {string} [p.fastrrOrderId] duplicate_payment: the second Fastrr order to refund
 * @param {string} [p.requestedBy]
 * @param {boolean} [p.approve]      admin-initiated: send now regardless of auto rules
 * @returns {Promise<{ order, refund }>}
 */
const requestRefund = async ({ orderId, source, amountPaise, reason = '', kind = 'order', fastrrOrderId = null, requestedBy = 'system', approve = false }) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
        const order = await Order.findById(orderId).lean();
        if (!order) throw new ShopError(404, 'ORDER_NOT_FOUND', 'Order not found');

        let amount = amountPaise;
        if (kind === 'order') {
            if (order.paymentMethod !== 'prepaid' || !['paid', 'refund_pending', 'partially_refunded'].includes(order.paymentStatus)) {
                throw new ShopError(409, 'REFUND_NOT_ALLOWED', 'Only paid prepaid orders can be refunded online. Use a manual refund for COD.', { status: order.paymentStatus });
            }
            const remaining = remainingRefundable(order);
            if (amount === undefined || amount === null) amount = remaining;
            if (!Number.isInteger(amount) || amount <= 0 || amount > remaining) {
                throw new ShopError(400, 'INVALID_REFUND_AMOUNT', `Refund must be between ₹0.01 and ₹${(remaining / 100).toFixed(2)}`, { maxPaise: remaining });
            }
        } else {
            if (!fastrrOrderId || !Number.isInteger(amount) || amount <= 0) throw new Error('duplicate_payment refund needs fastrrOrderId and amount');
            const already = (order.refunds || []).some((r) => r.kind === 'duplicate_payment' && r.fastrrOrderId === fastrrOrderId && ACTIVE.has(r.status));
            if (already) return { order, refund: (order.refunds || []).find((r) => r.fastrrOrderId === fastrrOrderId && r.kind === kind) };
        }

        const refund = {
            refundId: newRefundId(),
            kind,
            source,
            amount,
            reason: String(reason || '').slice(0, 500),
            method: 'fastrr',
            status: 'requested',
            fastrrOrderId: fastrrOrderId || order.paidFastrrOrderId,
            requestedBy: String(requestedBy),
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const version = order.refundVersion || 0;
        const saved = await Order.findOneAndUpdate(
            { _id: order._id, refundVersion: version === 0 ? { $in: [0, null] } : version },
            { $push: { refunds: refund }, $inc: { refundVersion: 1 } },
            { new: true }
        ).lean();
        if (!saved) continue; // someone else changed the refunds meanwhile: re-check the cap

        let current = saved;
        if (kind === 'order' && current.paymentStatus !== 'refund_pending') {
            current = (await transition(Order, { orderId: order._id, field: 'paymentStatus', to: 'refund_pending', source: 'system', eventId: refund.refundId })) || current;
        }
        console.log(`[Shop/refund] ${order.internalOrderId}: ${refund.refundId} requested (${source}, ${amount} paise, ${kind})`);

        if (approve || canAutoSend(source, amount)) {
            return executeRefund({ orderId: order._id, refundId: refund.refundId, approvedBy: approve ? requestedBy : 'auto' });
        }
        alert(current, `refund ${refund.refundId} of ₹${(amount / 100).toFixed(2)} awaits admin approval (${source})`);
        return { order: current, refund: findRefund(current, refund.refundId) };
    }
    throw new ShopError(409, 'REFUND_CONFLICT', 'Refunds on this order changed at the same time. Please try again.');
};

// ── Send to Fastrr ─────────────────────────────────────────────────────────

/**
 * Send a requested refund to Fastrr. Exactly one caller wins the claim.
 * @returns {Promise<{ order, refund }>}
 */
const executeRefund = async ({ orderId, refundId, approvedBy = 'admin' }) => {
    if (!fastrr.isConfigured()) {
        throw new ShopError(503, 'REFUND_UNAVAILABLE', 'Refunds are not available right now (Fastrr not configured)');
    }
    const claimed = await setRefund(orderId, refundId, ['requested'], { status: 'initiating', approvedBy: String(approvedBy) });
    if (!claimed) {
        const order = await Order.findById(orderId).lean();
        const r = order && findRefund(order, refundId);
        if (!r) throw new ShopError(404, 'REFUND_NOT_FOUND', 'Refund not found');
        throw new ShopError(409, 'REFUND_NOT_PENDING', `Refund is already ${r.status}`, { status: r.status });
    }
    const refund = findRefund(claimed, refundId);

    try {
        const res = await fastrr.initiateRefund({ orderId: refund.fastrrOrderId, amountPaise: refund.amount });
        const order = await setRefund(orderId, refundId, ['initiating'], {
            status: 'initiated', fastrrRefundId: res.refundId, fastrrTransactionId: res.transactionId, initiatedAt: new Date(), error: null,
        });
        console.log(`[Shop/refund] ${claimed.internalOrderId}: ${refundId} sent to Fastrr (${res.refundId})`);
        if (refund.kind === 'order') await notifier.notify(order, 'refund_initiated', { refundId, amountPaise: refund.amount });
        return { order, refund: findRefund(order, refundId) };
    } catch (err) {
        // Timeout / network / 5xx: Fastrr may have accepted it. Never re-send blindly.
        const maybeSent = err.retryable || err.code === 'TIMEOUT' || err.code === 'NETWORK';
        const order = await setRefund(orderId, refundId, ['initiating'], {
            status: maybeSent ? 'unknown' : 'failed', error: String(err.message).slice(0, 500),
        });
        alert(claimed, maybeSent
            ? `refund ${refundId} outcome UNKNOWN (${err.message}) — will be matched from Fastrr's refund report; do NOT resend manually without checking the Fastrr dashboard`
            : `refund ${refundId} FAILED: ${err.message} — admin can retry`);
        return { order, refund: findRefund(order, refundId) };
    }
};

/** Admin: send a failed refund again. */
const retryRefund = async ({ orderId, refundId, approvedBy }) => {
    const reopened = await setRefund(orderId, refundId, ['failed'], { status: 'requested', error: null });
    if (!reopened) throw new ShopError(409, 'REFUND_NOT_RETRYABLE', 'Only failed refunds can be retried');
    return executeRefund({ orderId, refundId, approvedBy });
};

// ── Completion ─────────────────────────────────────────────────────────────

/** After a refund completes: order payment status, push, Shopify bookkeeping. */
const afterCompleted = async (orderId, refundId) => {
    let order = await Order.findById(orderId).lean();
    const refund = findRefund(order, refundId);
    if (!refund || refund.kind !== 'order') return order;

    const paid = paidAmount(order);
    const done = sumOf(order, 'order', new Set(['completed']));
    const stillOpen = (order.refunds || []).some((r) => r.kind === 'order' && ['requested', 'initiating', 'initiated', 'processing', 'unknown'].includes(r.status));
    if (!stillOpen && order.paymentStatus === 'refund_pending') {
        order = (await transition(Order, {
            orderId, field: 'paymentStatus', to: done >= paid ? 'refunded' : 'partially_refunded', source: 'system', eventId: refundId,
        })) || order;
    }
    await notifier.notify(order, 'refunded', { refundId, amountPaise: refund.amount });

    if (config.shopifyRecordRefunds() && order.shopifyOrderId && !refund.shopifyRecorded && refund.method === 'fastrr') {
        try {
            const r = await shopifyClient.recordRefund({ shopifyOrderId: order.shopifyOrderId, amountPaise: refund.amount, note: `Refund ${refundId} via Fastrr ${refund.fastrrRefundId || ''}`.trim() });
            if (r.userErrors.length) alert(order, `Shopify refund record failed: ${r.userErrors.map((e) => e.message).join('; ')}`);
            else if (!r.skipped) await setRefund(orderId, refundId, ['completed'], { shopifyRecorded: true });
        } catch (err) {
            alert(order, `Shopify refund record failed: ${err.message}`);
        }
    }
    return Order.findById(orderId).lean();
};

/**
 * Admin: a refund paid outside Fastrr (COD order refunded by UPI, or a stuck
 * refund settled manually). Marks an existing refund, or records a new one.
 */
const markManualRefund = async ({ orderId, refundId = null, amountPaise, method = 'manual_upi', reference, reason = '', adminId }) => {
    if (!MANUAL_METHODS.includes(method)) throw new ShopError(400, 'INVALID_REFUND_METHOD', `Method must be one of: ${MANUAL_METHODS.join(', ')}`);
    if (!reference || String(reference).trim().length < 3) throw new ShopError(400, 'REFERENCE_REQUIRED', 'Enter the UPI / bank reference');
    if (refundId) {
        const order = await setRefund(orderId, refundId, ['requested', 'failed', 'unknown'], {
            status: 'completed', method, reference: String(reference).trim(), approvedBy: String(adminId), completedAt: new Date(),
        });
        if (!order) throw new ShopError(409, 'REFUND_NOT_MANUALLY_COMPLETABLE', 'Only requested, failed or unknown refunds can be marked as paid manually');
        const after = await afterCompleted(orderId, refundId);
        return { order: after, refund: findRefund(after, refundId) };
    }
    const order = await Order.findById(orderId).lean();
    if (!order) throw new ShopError(404, 'ORDER_NOT_FOUND', 'Order not found');
    if (!Number.isInteger(amountPaise) || amountPaise <= 0) throw new ShopError(400, 'INVALID_REFUND_AMOUNT', 'Enter the refunded amount');
    if (order.paymentMethod === 'prepaid' && amountPaise > remainingRefundable(order)) {
        throw new ShopError(400, 'INVALID_REFUND_AMOUNT', 'More than what is left to refund', { maxPaise: remainingRefundable(order) });
    }
    const refund = {
        refundId: newRefundId(), kind: 'order', source: 'admin', amount: amountPaise, reason: String(reason).slice(0, 500),
        method, status: 'completed', reference: String(reference).trim(), requestedBy: String(adminId), approvedBy: String(adminId),
        createdAt: new Date(), updatedAt: new Date(), completedAt: new Date(),
    };
    await Order.updateOne({ _id: order._id }, { $push: { refunds: refund }, $inc: { refundVersion: 1 } });
    if (order.paymentMethod === 'prepaid' && order.paymentStatus === 'paid') {
        await transition(Order, { orderId: order._id, field: 'paymentStatus', to: 'refund_pending', source: 'manual', eventId: refund.refundId });
    }
    const after = order.paymentMethod === 'prepaid' ? await afterCompleted(order._id, refund.refundId) : await Order.findById(order._id).lean();
    return { order: after, refund: findRefund(after, refund.refundId) };
};

// ── Status sync from Fastrr's refund report (cron) ─────────────────────────

const mapReportStatus = (r) => {
    const s = String(r?.status || '').toUpperCase();
    if (r?.refunded === true || ['SUCCESS', 'COMPLETED', 'REFUNDED', 'PROCESSED', 'SETTLED'].includes(s)) return 'completed';
    if (/FAIL|REJECT|CANCEL|DECLIN/.test(s)) return 'failed';
    if (s === 'INITIATED' || s === 'QUEUED') return 'initiated'; // accepted, not moving yet
    return 'processing'; // PENDING / IN_PROGRESS / anything else in flight
};

const ymd = (d) => new Date(d).toISOString().slice(0, 10);

/**
 * Update every open refund from Fastrr's refund report. Unknown refunds (timed
 * out) are matched by Fastrr order number + amount, never re-sent.
 */
const syncRefundStatuses = async ({ now = Date.now(), log = () => {} } = {}) => {
    const stats = { open: 0, updated: 0, completed: 0, failed: 0, adopted: 0 };
    if (!fastrr.isConfigured()) return stats;
    const orders = await Order.find({ 'refunds.status': { $in: OPEN } }).limit(200).lean();
    const open = orders.flatMap((o) => (o.refunds || []).filter((r) => OPEN.includes(r.status)).map((r) => ({ o, r })));
    stats.open = open.length;
    if (!open.length) return stats;

    const oldest = Math.min(...open.map(({ r }) => new Date(r.createdAt).getTime()));
    const from = ymd(oldest - 24 * 60 * 60 * 1000);
    const to = ymd(now + 24 * 60 * 60 * 1000);
    const report = [];
    for (let page = 0; page < config.refundReportMaxPages; page++) {
        const { total, refunds } = await fastrr.refundReport({ from, to, page });
        report.push(...refunds);
        if (!refunds.length || report.length >= total) break;
    }
    const byRef = new Map(report.map((x) => [String(x.ref_id), x]));
    const usedRefs = new Set(orders.flatMap((o) => (o.refunds || []).map((r) => r.fastrrRefundId).filter(Boolean)));

    for (const { o, r } of open) {
        let hit = r.fastrrRefundId ? byRef.get(String(r.fastrrRefundId)) : null;
        let adopted = false;
        if (!hit && r.status === 'unknown') {
            hit = report.find((x) => !usedRefs.has(String(x.ref_id))
                && o.fastrrNumericOrderId && String(x.order_id) === String(o.fastrrNumericOrderId)
                && Math.round(Number(x.refund_amount ?? x.amount) * 100) === r.amount);
            if (hit) { adopted = true; usedRefs.add(String(hit.ref_id)); }
        }
        if (!hit) continue;
        const status = mapReportStatus(hit);
        if (status === r.status && !adopted) continue;
        const fields = { status, error: status === 'failed' ? String(hit.message || 'refund failed') : null };
        if (adopted) fields.fastrrRefundId = String(hit.ref_id);
        if (status === 'completed') fields.completedAt = new Date(hit.updated_at || now);
        const updated = await setRefund(o._id, r.refundId, [r.status], fields);
        if (!updated) continue;
        stats.updated += 1;
        if (adopted) stats.adopted += 1;
        if (status === 'completed') { stats.completed += 1; await afterCompleted(o._id, r.refundId); }
        if (status === 'failed') { stats.failed += 1; alert(o, `refund ${r.refundId} failed at Fastrr: ${hit.message || ''} — admin can retry`); }
    }
    log(`[Shop/refunds] ${JSON.stringify(stats)}`);
    return stats;
};

module.exports = {
    requestRefund, executeRefund, retryRefund, markManualRefund, syncRefundStatuses,
    paidAmount, remainingRefundable,
    _internal: { mapReportStatus, canAutoSend },
};
