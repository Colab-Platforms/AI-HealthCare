// Shop admin actions (M4: cancel + refunds). Mounted at /api/shop/admin behind
// protect + authorize('admin', 'superadmin'). Read-only admin APIs (lists,
// dashboards) are added next to these in the admin phase.

const Order = require('../../../models/Order');
const cancelService = require('../services/cancelService');
const refundService = require('../services/refundService');
const { ShopError, sendError } = require('../lib/shopError');
const { isValidInternalOrderId } = require('../lib/checkoutLogic');

const adminId = (req) => String(req.user?._id || 'admin');

// Admin views get the full order (refund ids, Fastrr / Shopify ids, history).
const orderIdOf = async (internalOrderId) => {
    if (!isValidInternalOrderId(internalOrderId)) throw new ShopError(404, 'ORDER_NOT_FOUND', 'Order not found');
    const o = await Order.findOne({ internalOrderId }).select('_id').lean();
    if (!o) throw new ShopError(404, 'ORDER_NOT_FOUND', 'Order not found');
    return o._id;
};

const parsePaise = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));

// POST /api/shop/admin/orders/:orderId/cancel   { reason }
exports.cancelOrder = async (req, res) => {
    try {
        const order = await cancelService.cancelOrder({ orderId: req.params.orderId, by: 'admin', reason: req.body?.reason, adminId: adminId(req) });
        res.json({ order });
    } catch (err) {
        sendError(res, err, 'ShopAdmin/cancel');
    }
};

// POST /api/shop/admin/orders/:orderId/refunds   { amountPaise?, reason }   (admin = approved, sent now)
exports.createRefund = async (req, res) => {
    try {
        const r = await refundService.requestRefund({
            orderId: await orderIdOf(req.params.orderId), source: 'admin', amountPaise: parsePaise(req.body?.amountPaise),
            reason: req.body?.reason, requestedBy: adminId(req), approve: true,
        });
        res.json(r);
    } catch (err) {
        sendError(res, err, 'ShopAdmin/createRefund');
    }
};

// POST /api/shop/admin/orders/:orderId/refunds/:refundId/approve
exports.approveRefund = async (req, res) => {
    try {
        res.json(await refundService.executeRefund({ orderId: await orderIdOf(req.params.orderId), refundId: req.params.refundId, approvedBy: adminId(req) }));
    } catch (err) {
        sendError(res, err, 'ShopAdmin/approveRefund');
    }
};

// POST /api/shop/admin/orders/:orderId/refunds/:refundId/retry   (failed refunds only)
exports.retryRefund = async (req, res) => {
    try {
        res.json(await refundService.retryRefund({ orderId: await orderIdOf(req.params.orderId), refundId: req.params.refundId, approvedBy: adminId(req) }));
    } catch (err) {
        sendError(res, err, 'ShopAdmin/retryRefund');
    }
};

// POST /api/shop/admin/orders/:orderId/refunds/:refundId/mark-paid   { method, reference }
// POST /api/shop/admin/orders/:orderId/refunds/manual                { amountPaise, method, reference, reason }
exports.markManualRefund = async (req, res) => {
    try {
        res.json(await refundService.markManualRefund({
            orderId: await orderIdOf(req.params.orderId),
            refundId: req.params.refundId || null,
            amountPaise: parsePaise(req.body?.amountPaise),
            method: req.body?.method || 'manual_upi',
            reference: req.body?.reference,
            reason: req.body?.reason,
            adminId: adminId(req),
        }));
    } catch (err) {
        sendError(res, err, 'ShopAdmin/manualRefund');
    }
};
