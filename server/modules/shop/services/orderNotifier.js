// Push notifications for shop orders. Each event is sent at most once per
// order (claimed with a conditional $addToSet on Order.notified), and a push
// failure never breaks order processing.

const Order = require('../../../models/Order');
const fcm = require('../../../services/fcmService');
const config = require('../config');

const MESSAGES = {
    confirmed: (o) => ({ title: 'Order confirmed', body: `Your order ${o.internalOrderId} is confirmed. We'll let you know when it ships.` }),
    shipped: (o) => ({
        title: 'Your order is on the way',
        body: o.tracking?.courier ? `${o.internalOrderId} has shipped with ${o.tracking.courier}.` : `${o.internalOrderId} has shipped.`,
    }),
    delivered: (o) => ({ title: 'Order delivered', body: `Your order ${o.internalOrderId} has been delivered.` }),
    cancelled: (o) => ({ title: 'Order cancelled', body: `Your order ${o.internalOrderId} has been cancelled.` }),
    refund_initiated: (o, x) => ({
        title: 'Refund initiated',
        body: `Refund of ₹${(x.amountPaise / 100).toFixed(2)} for ${o.internalOrderId} has started. It usually reaches your account in 5–7 working days.`,
    }),
    refunded: (o, x) => ({ title: 'Refund completed', body: `₹${(x.amountPaise / 100).toFixed(2)} for ${o.internalOrderId} has been refunded.` }),
};

/**
 * @param {object} order  Order (lean) — needs _id, user, internalOrderId
 * @param {string} event  confirmed | shipped | delivered | cancelled | refund_initiated | refunded
 * @param {object} [extra] refund events: { refundId, amountPaise } (one push per refund)
 * @returns {Promise<'sent'|'already'|'disabled'|'failed'>}
 */
const notify = async (order, event, extra = {}) => {
    if (!config.orderPushNotifications() || !MESSAGES[event]) return 'disabled';
    const key = extra.refundId ? `${event}:${extra.refundId}` : event;
    const claimed = await Order.updateOne({ _id: order._id, notified: { $ne: key } }, { $addToSet: { notified: key } });
    if (!claimed.matchedCount) return 'already';
    try {
        const { title, body } = MESSAGES[event](order, extra);
        await fcm.sendToUser(order.user, {
            title,
            body,
            data: { type: 'shop_order', event, orderId: order.internalOrderId },
        });
        return 'sent';
    } catch (err) {
        console.warn(`[Shop/notify] ${order.internalOrderId} ${event}: ${err.message}`);
        return 'failed';
    }
};

module.exports = { notify, MESSAGES };
