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

// ── Read side + operations (admin phase) ───────────────────────────────────
const adminService = require('../services/adminService');

const handle = (tag, fn) => async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store');
        res.json(await fn(req));
    } catch (err) {
        sendError(res, err, `ShopAdmin/${tag}`);
    }
};

// GET /api/shop/admin/overview?range=today|7d|30d|90d
exports.overview = handle('overview', (req) => adminService.overview({ range: req.query.range }));
// GET /api/shop/admin/orders?status=&paymentMethod=&q=&from=&to=&attention=&page=&limit=
exports.listOrders = handle('listOrders', (req) => adminService.listOrders(req.query));
// GET /api/shop/admin/orders/:orderId
exports.getOrder = handle('getOrder', (req) => adminService.getOrder(req.params.orderId));
// POST /api/shop/admin/orders/:orderId/retry-sync
exports.retrySync = handle('retrySync', (req) => adminService.retryShopifySync(req.params.orderId, adminId(req)));
// POST /api/shop/admin/orders/:orderId/review/resolve   { note }
exports.resolveReview = handle('resolveReview', (req) => adminService.resolveReview(req.params.orderId, { adminId: adminId(req), note: req.body?.note }));
// GET /api/shop/admin/attention
exports.attention = handle('attention', () => adminService.attention());
// GET /api/shop/admin/products
exports.products = handle('products', async () => ({ items: await adminService.products() }));
// POST /api/shop/admin/products/sync   (pull the whole catalog from Shopify now)
exports.syncCatalog = handle('syncCatalog', async () => ({ ok: true, stats: await adminService.syncCatalog() }));
// GET /api/shop/admin/carts?abandoned=&page=&limit=
exports.carts = handle('carts', (req) => adminService.carts(req.query));
// GET /api/shop/admin/customers?q=
exports.customers = handle('customers', async (req) => ({ items: await adminService.customers({ q: req.query.q }) }));
// GET /api/shop/admin/customers/:userId
exports.customerJourney = handle('customerJourney', (req) => adminService.customerJourney(req.params.userId));
// GET /api/shop/admin/refunds?status=
exports.refunds = handle('refunds', async (req) => ({ items: await adminService.refunds({ status: req.query.status }) }));
