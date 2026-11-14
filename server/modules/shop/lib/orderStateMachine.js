// Order state machine. An order has three independent status fields, each with
// its own allowed moves. A move is applied with ONE conditional update:
//
//     findOneAndUpdate({ _id, [field]: { $in: allowedFrom(to) } }, { $set: { [field]: to } })
//
// If two actors race (Fastrr webhook + reconciliation cron, or a duplicate
// delivery), exactly one wins; the loser gets null and does nothing. Late or
// out-of-order events (FAILED arriving after SUCCESS) are rejected the same way,
// because "failed" is not reachable from "paid".

const TRANSITIONS = {
    paymentStatus: {
        // initial: pending
        pending: ['paid', 'cod_pending', 'failed', 'expired'],
        expired: ['paid', 'cod_pending'], // payment confirmed late (reconciliation found it)
        failed: ['paid', 'cod_pending'],  // user retried on the same Fastrr order and it went through
        cod_pending: ['paid', 'cancelled'], // COD: cash collected on delivery / order cancelled or RTO
        paid: ['refund_pending', 'partially_refunded', 'refunded'],
        refund_pending: ['partially_refunded', 'refunded'],
        partially_refunded: ['refund_pending', 'partially_refunded', 'refunded'],
        refunded: [],
        cancelled: [],
    },
    shopifySyncStatus: {
        // initial: not_started
        not_started: ['pending'],
        pending: ['synced', 'failed', 'needs_attention'],
        failed: ['pending', 'synced', 'needs_attention'],
        needs_attention: ['pending', 'synced'], // admin manual retry
        synced: [],
    },
    fulfillmentStatus: {
        // initial: unfulfilled
        unfulfilled: ['partial', 'fulfilled', 'cancelled'],
        partial: ['fulfilled', 'cancelled'],
        fulfilled: ['delivered', 'rto'],
        delivered: ['rto'], // rare: returned after delivery is handled as a refund, but courier may report it
        rto: [],
        cancelled: [],
    },
};

const INITIAL = { paymentStatus: 'pending', shopifySyncStatus: 'not_started', fulfillmentStatus: 'unfulfilled' };

const statesOf = (field) => {
    const map = TRANSITIONS[field];
    if (!map) throw new Error(`Unknown order status field: ${field}`);
    return map;
};

const canTransition = (field, from, to) => (statesOf(field)[from] || []).includes(to);

// Every state that may move to `to`.
const allowedFrom = (field, to) =>
    Object.entries(statesOf(field)).filter(([, next]) => next.includes(to)).map(([from]) => from);

/**
 * Atomically move one status field. Returns the updated order, or null if the
 * order wasn't in a state that allows this move (already moved / invalid / raced).
 *
 * @param {Model}  Order
 * @param {object} p
 * @param {*}      p.orderId
 * @param {string} p.field      paymentStatus | shopifySyncStatus | fulfillmentStatus
 * @param {string} p.to
 * @param {object} [p.set]      extra fields to set in the same write
 * @param {string} [p.source]   webhook | reconciliation | manual | system
 * @param {string} [p.eventId]
 * @param {object} [p.extraFilter]  extra conditions (e.g. lease checks)
 */
const transition = async (Order, { orderId, field, to, set = {}, source = 'system', eventId = null, extraFilter = {} }) => {
    const from = allowedFrom(field, to);
    if (!from.length) throw new Error(`No state can move to ${field}=${to}`);
    return Order.findOneAndUpdate(
        { _id: orderId, [field]: { $in: from }, ...extraFilter },
        {
            $set: { [field]: to, ...set },
            $push: { statusHistory: { field, status: to, source, eventId, changedAt: new Date() } },
        },
        { new: true }
    );
};

module.exports = { TRANSITIONS, INITIAL, canTransition, allowedFrom, transition };
