// "My Orders" for the app. Always scoped to the logged-in user.

const mongoose = require('mongoose');
const Order = require('../../../models/Order');
const config = require('../config');
const { ShopError } = require('../lib/shopError');
const { isValidInternalOrderId } = require('../lib/checkoutLogic');
const { toAppOrder, toAppOrderSummary, PLACED_PAYMENT_STATES } = require('../lib/orderView');
const fastrrOrderService = require('./fastrrOrderService');

// Cursor (opaque): base64url of { t: createdAt, id: _id }
const encodeCursor = (o) => Buffer.from(JSON.stringify({ t: new Date(o.createdAt).toISOString(), id: String(o._id) })).toString('base64url');
const decodeCursor = (cursor) => {
    try {
        const { t, id } = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
        const date = new Date(t);
        if (!mongoose.isValidObjectId(id) || Number.isNaN(date.getTime())) return null;
        return { t: date, id: new mongoose.Types.ObjectId(id) };
    } catch {
        return null;
    }
};

/**
 * Orders the user actually placed (paid / COD and later states), newest first.
 * Abandoned / failed checkouts are not "orders" to the user and are left out.
 */
const listOrders = async (userId, { cursor, limit } = {}) => {
    const n = parseInt(limit, 10);
    const pageSize = Number.isFinite(n) ? Math.min(config.maxPageSize, Math.max(1, n)) : config.defaultPageSize;
    const filter = { user: userId, paymentStatus: { $in: PLACED_PAYMENT_STATES } };
    if (cursor) {
        const c = decodeCursor(cursor);
        if (!c) throw new ShopError(400, 'INVALID_CURSOR', 'Invalid cursor');
        filter.$or = [{ createdAt: { $lt: c.t } }, { createdAt: c.t, _id: { $lt: c.id } }];
    }
    const docs = await Order.find(filter).sort({ createdAt: -1, _id: -1 }).limit(pageSize + 1).lean();
    const hasMore = docs.length > pageSize;
    const page = hasMore ? docs.slice(0, pageSize) : docs;
    return { items: page.map(toAppOrderSummary), nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null };
};

/**
 * One order. While payment is pending, also asks Fastrr (at most once per
 * `onDemandSyncGapMs`) so the app's poll after the WebView closes is answered
 * even if Fastrr's webhook is late.
 */
const getOrder = async (userId, orderId) => {
    if (!isValidInternalOrderId(orderId)) throw new ShopError(404, 'ORDER_NOT_FOUND', 'Order not found');
    let order = await Order.findOne({ internalOrderId: orderId, user: userId }).lean();
    if (!order) throw new ShopError(404, 'ORDER_NOT_FOUND', 'Order not found');
    if (order.paymentStatus === 'pending') order = await fastrrOrderService.syncPendingThrottled(order, { source: 'poll' });
    return toAppOrder(order);
};

module.exports = { listOrders, getOrder, _internal: { encodeCursor, decodeCursor } };
