// Cancel an order before it ships (M4) — by the customer (app) or an admin.
//
// Order of steps matters:
//   1. checks          placed (paid / COD), not shipped, not already cancelled
//   2. Shopify first   live re-check that the warehouse hasn't fulfilled it, then
//                      orderCancel (restock). If Shopify refuses, NOTHING changes
//                      on our side — we never refund an order that will still ship.
//   3. our order       fulfilment -> cancelled; COD -> payment cancelled
//   4. money           prepaid -> refund request (auto or admin, see refundService)
//   5. stock hold released, push sent
//
// An order whose Shopify creation is in flight right now can't be cancelled
// for a moment (409 CANCEL_IN_PROGRESS). One that was never sent to Shopify is
// simply never sent (sync only picks up paid / COD orders).

const Order = require('../../../models/Order');
const config = require('../config');
const shopifyClient = require('./shopifyOrderClient');
const shopifyOrderSync = require('./shopifyOrderSyncService');
const refunds = require('./refundService');
const reservations = require('./stockReservationService');
const notifier = require('./orderNotifier');
const events = require('./eventService');
const { transition } = require('../lib/orderStateMachine');
const { ShopError } = require('../lib/shopError');
const { isValidInternalOrderId } = require('../lib/checkoutLogic');

const SHIPPED_IN_SHOPIFY = new Set(['FULFILLED', 'PARTIALLY_FULFILLED', 'IN_PROGRESS', 'RESTOCKED']);

const notCancellable = (order, why) => new ShopError(409, 'CANCEL_NOT_ALLOWED', why, {
    orderId: order.internalOrderId, paymentStatus: order.paymentStatus, fulfillmentStatus: order.fulfillmentStatus,
});

/**
 * @param {object} p
 * @param {string} p.orderId     internal order id (TH-...)
 * @param {*}      [p.userId]    customer cancel: must own the order
 * @param {'user'|'admin'} p.by
 * @param {string} [p.reason]
 * @param {string} [p.adminId]
 * @returns {Promise<object>}    the updated order (lean)
 */
const cancelOrder = async ({ orderId, userId = null, by, reason = '', adminId = null }) => {
    if (by === 'user' && !config.userCancelEnabled()) {
        throw new ShopError(403, 'CANCEL_DISABLED', 'Orders can’t be cancelled from the app. Please contact support.');
    }
    if (!isValidInternalOrderId(orderId)) throw new ShopError(404, 'ORDER_NOT_FOUND', 'Order not found');
    const filter = { internalOrderId: orderId, ...(userId ? { user: userId } : {}) };
    let order = await Order.findOne(filter).lean();
    if (!order) throw new ShopError(404, 'ORDER_NOT_FOUND', 'Order not found');

    if (!['paid', 'cod_pending'].includes(order.paymentStatus)) throw notCancellable(order, 'This order can’t be cancelled');
    if (order.fulfillmentStatus !== 'unfulfilled') throw notCancellable(order, 'This order has already been shipped');
    if (order.shopifySyncLeaseUntil && new Date(order.shopifySyncLeaseUntil) > new Date()) {
        throw new ShopError(409, 'CANCEL_IN_PROGRESS', 'Your order is being processed. Please try again in a minute.', { retryAfterMs: 60000 });
    }

    const note = `Cancelled by ${by}${adminId ? ` (${adminId})` : ''}${reason ? `: ${reason}` : ''}`;

    // 2. Shopify first.
    if (order.shopifyOrderId) {
        const node = await shopifyClient.fetchOrder(order.shopifyOrderId);
        if (node && !node.cancelledAt) {
            const shipped = SHIPPED_IN_SHOPIFY.has(node.displayFulfillmentStatus) || (node.fulfillments || []).some((f) => f.displayStatus !== 'CANCELED');
            if (shipped) {
                await shopifyOrderSync.applyShopifyOrder(order, node); // bring our copy up to date
                throw notCancellable(order, 'This order has already been shipped');
            }
            const { userErrors } = await shopifyClient.cancelOrder(order.shopifyOrderId, { reason: by === 'user' ? 'CUSTOMER' : 'STAFF', staffNote: note });
            if (userErrors.length) {
                console.error(`[ALERT][Shop/cancel] ${order.internalOrderId}: Shopify refused cancel: ${userErrors.map((e) => e.message).join('; ')}`);
                throw new ShopError(502, 'SHOPIFY_CANCEL_FAILED', 'Could not cancel the order right now. Please try again or contact support.');
            }
        }
    }

    // 3. Our order.
    const moved = await transition(Order, {
        orderId: order._id, field: 'fulfillmentStatus', to: 'cancelled', source: by,
        set: { cancelledAt: new Date(), cancelledBy: by, cancelReason: String(reason || '').slice(0, 500) },
    });
    if (!moved) throw notCancellable(await Order.findById(order._id).lean(), 'This order can’t be cancelled any more');
    order = moved;

    // 4. Money.
    if (order.paymentStatus === 'cod_pending') {
        order = (await transition(Order, { orderId: order._id, field: 'paymentStatus', to: 'cancelled', source: by })) || order;
    } else if (order.paymentStatus === 'paid') {
        const r = await refunds.requestRefund({
            orderId: order._id,
            source: by === 'user' ? 'user_cancel' : 'admin_cancel',
            reason: reason || 'Order cancelled before shipping',
            requestedBy: by === 'user' ? String(userId) : String(adminId),
            approve: by === 'admin', // an admin cancelling is also approving the refund
        });
        order = r.order;
    }

    // 5. Stock + push.
    await reservations.release(order._id);
    await notifier.notify(order, 'cancelled');
    events.track('order_cancelled', { user: order.user, orderId: order.internalOrderId, meta: { by, reason: String(reason || '') } });
    console.log(`[Shop/cancel] ${order.internalOrderId}: cancelled by ${by}`);
    return Order.findById(order._id).lean();
};

module.exports = { cancelOrder };
