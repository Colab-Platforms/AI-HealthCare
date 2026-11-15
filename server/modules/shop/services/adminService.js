// Shop admin — read side + operational actions. Everything is behind
// protect + authorize('admin', 'superadmin') (see routes.js).

const mongoose = require('mongoose');
const Order = require('../../../models/Order');
const User = require('../../../models/User');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const StockReservation = require('../models/StockReservation');
const ShopEvent = require('../models/ShopEvent');
const config = require('../config');
const shopifyOrderSync = require('./shopifyOrderSyncService');
const catalogSyncService = require('./catalogSyncService');
const { transition } = require('../lib/orderStateMachine');
const { ShopError } = require('../lib/shopError');
const { money, displayStatus } = require('../lib/orderView');
const { computeOverview, rangeWindow } = require('../lib/adminStats');
const { evaluateCart, indexVariants } = require('../lib/cartEvaluator');
const { isHiddenVariant, availableQty } = require('../lib/catalogMapper');
const { isValidInternalOrderId } = require('../lib/checkoutLogic');

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pageArgs = ({ page, limit }, max = 100) => {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(max, Math.max(1, parseInt(limit, 10) || 20));
    return { page: p, limit: l, skip: (p - 1) * l };
};
const paged = (items, total, { page, limit }) => ({ items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });

const shopifyAdminUrl = (shopifyOrderId) => {
    const domain = process.env.SHOPIFY_ADMIN_STORE_DOMAIN || '';
    const handle = domain.split('.')[0];
    return shopifyOrderId && handle ? `https://admin.shopify.com/store/${handle}/orders/${shopifyOrderId}` : null;
};

const usersById = async (ids) => {
    const unique = [...new Set(ids.filter(Boolean).map(String))].filter((id) => mongoose.isValidObjectId(id));
    if (!unique.length) return new Map();
    const users = await User.find({ _id: { $in: unique.map((id) => new mongoose.Types.ObjectId(id)) } }).select('name email phone').lean();
    return new Map(users.map((u) => [String(u._id), { id: String(u._id), name: u.name || null, email: u.email || null, phone: u.phone || null }]));
};

// Admin status filter (same vocabulary as the app's `status`).
const STATUS_FILTERS = {
    awaiting_payment: { paymentStatus: 'pending' },
    payment_failed: { paymentStatus: 'failed' },
    expired: { paymentStatus: 'expired' },
    confirmed: { paymentStatus: { $in: ['paid', 'cod_pending'] }, fulfillmentStatus: 'unfulfilled' },
    shipped: { paymentStatus: { $in: ['paid', 'cod_pending'] }, fulfillmentStatus: { $in: ['partial', 'fulfilled'] } },
    delivered: { paymentStatus: { $in: ['paid', 'cod_pending'] }, fulfillmentStatus: 'delivered' },
    returned: { fulfillmentStatus: 'rto' },
    cancelled: { $or: [{ paymentStatus: 'cancelled' }, { fulfillmentStatus: 'cancelled', paymentStatus: { $in: ['paid', 'cod_pending'] } }] },
    refund_initiated: { paymentStatus: 'refund_pending' },
    partially_refunded: { paymentStatus: 'partially_refunded' },
    refunded: { paymentStatus: 'refunded' },
    placed: { paymentStatus: { $in: ['paid', 'cod_pending', 'refund_pending', 'partially_refunded', 'refunded', 'cancelled'] } },
};

const flagsOf = (o) => {
    const f = [];
    if (o.review?.needed) f.push('review');
    if (['needs_attention', 'failed'].includes(o.shopifySyncStatus)) f.push('shopify_sync');
    if ((o.refunds || []).some((r) => r.status === 'requested')) f.push('refund_approval');
    if ((o.refunds || []).some((r) => ['failed', 'unknown'].includes(r.status))) f.push('refund_problem');
    return f;
};

const orderRow = (o, user) => ({
    orderId: o.internalOrderId,
    createdAt: o.createdAt,
    placedAt: o.placedAt || null,
    customer: user || { id: String(o.user), name: null, email: o.customer?.email || null, phone: o.customer?.phone || null },
    itemCount: (o.items || []).reduce((n, i) => n + i.quantity, 0),
    firstItem: o.items?.[0]?.title || null,
    total: money(o.pricing?.total ?? o.amount),
    paymentMethod: o.paymentMethod || null,
    status: displayStatus(o),
    paymentStatus: o.paymentStatus,
    fulfillmentStatus: o.fulfillmentStatus,
    shopifySyncStatus: o.shopifySyncStatus,
    shopifyOrderName: o.shopifyOrderName || null,
    flags: flagsOf(o),
});

// ── Overview ───────────────────────────────────────────────────────────────

const attentionCounts = async (now = Date.now()) => {
    const [sync, review, approval, problem, stuck] = await Promise.all([
        Order.countDocuments({ shopifySyncStatus: { $in: ['needs_attention', 'failed'] } }),
        Order.countDocuments({ 'review.needed': true }),
        Order.countDocuments({ 'refunds.status': 'requested' }),
        Order.countDocuments({ 'refunds.status': { $in: ['failed', 'unknown'] } }),
        Order.countDocuments({ paymentStatus: 'pending', createdAt: { $lt: new Date(now - 60 * 60 * 1000), $gt: new Date(now - 48 * 60 * 60 * 1000) } }),
    ]);
    return { shopifySync: sync, review, refundApproval: approval, refundProblem: problem, stuckPayments: stuck, total: sync + review + approval + problem + stuck };
};

const overview = async ({ range = '7d', now = Date.now() } = {}) => {
    const window = rangeWindow(range, now);
    const [orders, events, attention] = await Promise.all([
        Order.find({ $or: [{ createdAt: { $gte: window.from } }, { placedAt: { $gte: window.from } }, { 'refunds.completedAt': { $gte: window.from } }] })
            .select('internalOrderId createdAt placedAt paymentStatus fulfillmentStatus paymentMethod pricing amount items refunds')
            .limit(20000).lean(),
        ShopEvent.find({ createdAt: { $gte: window.from }, type: { $in: ['product_view', 'cart_add', 'checkout_start', 'payment_success', 'search'] } })
            .select('type user').limit(200000).lean(),
        attentionCounts(now),
    ]);
    return { ...computeOverview({ orders, events, window, now }), attention };
};

// ── Orders ─────────────────────────────────────────────────────────────────

const searchFilter = async (q) => {
    const term = String(q || '').trim().slice(0, 100);
    if (!term) return null;
    if (/^TH-/i.test(term)) return { internalOrderId: { $regex: `^${escapeRegex(term.toUpperCase())}` } };
    if (/^#?TAKE\d+$/i.test(term)) return { shopifyOrderName: { $regex: `^#?${escapeRegex(term.replace('#', ''))}$`, $options: 'i' } };
    const digits = term.replace(/\D/g, '');
    if (digits.length >= 10) return { 'customer.phone': { $regex: `${digits.slice(-10)}$` } };
    const users = await User.find({ $or: [{ email: { $regex: escapeRegex(term), $options: 'i' } }, { name: { $regex: escapeRegex(term), $options: 'i' } }] })
        .select('_id').limit(200).lean();
    return { $or: [{ 'customer.email': { $regex: escapeRegex(term), $options: 'i' } }, { user: { $in: users.map((u) => u._id) } }] };
};

const listOrders = async (query = {}) => {
    const pg = pageArgs(query);
    const and = [];
    if (query.status) {
        if (!STATUS_FILTERS[query.status]) throw new ShopError(400, 'INVALID_STATUS', `Unknown status: ${query.status}`);
        and.push(STATUS_FILTERS[query.status]);
    }
    if (query.paymentMethod) and.push({ paymentMethod: query.paymentMethod });
    if (query.from) and.push({ createdAt: { $gte: new Date(query.from) } });
    if (query.to) and.push({ createdAt: { $lte: new Date(query.to) } });
    if (query.attention === 'true') {
        and.push({ $or: [
            { shopifySyncStatus: { $in: ['needs_attention', 'failed'] } }, { 'review.needed': true },
            { 'refunds.status': { $in: ['requested', 'failed', 'unknown'] } },
        ] });
    }
    const s = await searchFilter(query.q);
    if (s) and.push(s);
    const filter = and.length ? { $and: and } : {};

    const [docs, totalCount] = await Promise.all([
        Order.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).lean(),
        Order.countDocuments(filter),
    ]);
    const users = await usersById(docs.map((o) => o.user));
    return paged(docs.map((o) => orderRow(o, users.get(String(o.user)))), totalCount, pg);
};

const orderDoc = async (internalOrderId) => {
    if (!isValidInternalOrderId(internalOrderId)) throw new ShopError(404, 'ORDER_NOT_FOUND', 'Order not found');
    const o = await Order.findOne({ internalOrderId }).lean();
    if (!o) throw new ShopError(404, 'ORDER_NOT_FOUND', 'Order not found');
    return o;
};

/** Everything about one order, plus one merged timeline. */
const getOrder = async (internalOrderId) => {
    const o = await orderDoc(internalOrderId);
    const [users, events] = await Promise.all([
        usersById([o.user]),
        ShopEvent.find({ orderId: o.internalOrderId }).sort({ createdAt: 1, _id: 1 }).limit(500).lean(),
    ]);
    const timeline = [
        { at: o.createdAt, kind: 'order', label: 'Checkout started (order created)' },
        ...(o.statusHistory || []).map((h) => ({ at: h.changedAt, kind: 'status', label: `${h.field} → ${h.status}`, source: h.source })),
        ...events.map((e) => ({ at: e.createdAt, kind: 'event', label: e.type, meta: e.meta })),
        ...(o.refunds || []).flatMap((r) => [
            { at: r.createdAt, kind: 'refund', label: `Refund ${r.refundId} requested (${r.source}, ₹${(r.amount / 100).toFixed(2)})` },
            r.initiatedAt && { at: r.initiatedAt, kind: 'refund', label: `Refund ${r.refundId} sent to Fastrr` },
            r.completedAt && { at: r.completedAt, kind: 'refund', label: `Refund ${r.refundId} completed (${r.method})` },
        ].filter(Boolean)),
    ].filter((t) => t.at).sort((a, b) => new Date(a.at) - new Date(b.at));

    const { fastrrToken, tokenLeaseUntil, shopifySyncLeaseUntil, fastrrCheckedAt, ...rest } = o; // internals
    return {
        ...rest,
        status: displayStatus(o),
        flags: flagsOf(o),
        customer: { ...(users.get(String(o.user)) || { id: String(o.user) }), checkoutPhone: o.customer?.phone || null, checkoutEmail: o.customer?.email || null },
        shopifyAdminUrl: shopifyAdminUrl(o.shopifyOrderId),
        timeline,
    };
};

// ── Attention ──────────────────────────────────────────────────────────────

const attention = async ({ now = Date.now() } = {}) => {
    const pick = async (filter) => {
        const docs = await Order.find(filter).sort({ updatedAt: -1 }).limit(50).lean();
        const users = await usersById(docs.map((o) => o.user));
        return docs.map((o) => ({
            ...orderRow(o, users.get(String(o.user))),
            shopifySyncError: o.shopifySyncError || null,
            reviewReasons: o.review?.reasons || [],
            refunds: (o.refunds || []).filter((r) => ['requested', 'failed', 'unknown'].includes(r.status))
                .map((r) => ({ refundId: r.refundId, status: r.status, amount: money(r.amount), source: r.source, error: r.error || null, createdAt: r.createdAt })),
        }));
    };
    const [shopifySync, review, refundApproval, refundProblem, stuckPayments] = await Promise.all([
        pick({ shopifySyncStatus: { $in: ['needs_attention', 'failed'] } }),
        pick({ 'review.needed': true }),
        pick({ 'refunds.status': 'requested' }),
        pick({ 'refunds.status': { $in: ['failed', 'unknown'] } }),
        pick({ paymentStatus: 'pending', createdAt: { $lt: new Date(now - 60 * 60 * 1000), $gt: new Date(now - 48 * 60 * 60 * 1000) } }),
    ]);
    return { shopifySync, review, refundApproval, refundProblem, stuckPayments };
};

// ── Actions ────────────────────────────────────────────────────────────────

/** Send a failed / needs-attention order to Shopify again (now). */
const retryShopifySync = async (internalOrderId, adminId) => {
    const o = await orderDoc(internalOrderId);
    if (o.review?.needed) throw new ShopError(409, 'REVIEW_REQUIRED', 'Resolve the review flag first');
    if (!['needs_attention', 'failed'].includes(o.shopifySyncStatus)) {
        throw new ShopError(409, 'SYNC_NOT_RETRYABLE', `Shopify sync is ${o.shopifySyncStatus}`, { shopifySyncStatus: o.shopifySyncStatus });
    }
    if (!config.shopifyOrderSync()) throw new ShopError(503, 'SHOPIFY_SYNC_DISABLED', 'Shopify order sync is switched off (SHOP_SHOPIFY_ORDER_SYNC)');
    await transition(Order, {
        orderId: o._id, field: 'shopifySyncStatus', to: 'pending', source: 'manual', eventId: `admin:${adminId}`,
        set: { shopifySyncAttempts: 0, shopifySyncError: null },
    });
    const r = await shopifyOrderSync.syncOrder(o._id);
    return { result: r.result, order: await getOrder(internalOrderId) };
};

/** An admin checked a review-flagged order and accepts it. */
const resolveReview = async (internalOrderId, { adminId, note }) => {
    const o = await orderDoc(internalOrderId);
    if (!o.review?.needed) throw new ShopError(409, 'NOTHING_TO_RESOLVE', 'This order is not flagged for review');
    if (!note || String(note).trim().length < 3) throw new ShopError(400, 'NOTE_REQUIRED', 'Write what you checked');
    await Order.updateOne({ _id: o._id, 'review.needed': true }, {
        $set: { 'review.needed': false, 'review.resolvedAt': new Date(), 'review.resolvedBy': String(adminId), 'review.note': String(note).trim().slice(0, 500) },
    });
    return getOrder(internalOrderId);
};

const syncCatalog = () => catalogSyncService.fullSync({ log: () => {} });

// ── Products ───────────────────────────────────────────────────────────────

const products = async ({ now = Date.now() } = {}) => {
    const since = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const [docs, holds, sold] = await Promise.all([
        Product.find({ status: { $ne: 'deleted' } }).sort({ title: 1 }).lean(),
        StockReservation.find({ expiresAt: { $gt: new Date(now) } }).select('variantId quantity').lean(),
        Order.find({ placedAt: { $gte: since }, paymentStatus: { $in: ['paid', 'cod_pending', 'refund_pending', 'partially_refunded', 'refunded'] }, fulfillmentStatus: { $ne: 'cancelled' } })
            .select('items').limit(20000).lean(),
    ]);
    const held = new Map();
    for (const h of holds) held.set(h.variantId, (held.get(h.variantId) || 0) + h.quantity);
    const sold30 = new Map();
    for (const o of sold) for (const i of o.items || []) sold30.set(i.variantId, (sold30.get(i.variantId) || 0) + i.quantity);

    return docs.map((p) => ({
        id: p.shopifyProductId,
        handle: p.handle,
        title: p.title,
        status: p.status,
        imageUrl: p.images?.[0]?.url || null,
        lastSyncedAt: p.lastSyncedAt || null,
        collections: (p.collections || []).map((c) => c.title),
        variants: (p.variants || []).map((v) => {
            const stock = availableQty(p, v);
            return {
                id: v.shopifyVariantId,
                title: v.title,
                sku: v.sku || null,
                price: money(v.price),
                compareAtPrice: v.compareAtPrice ? money(v.compareAtPrice) : null,
                stock: stock === Infinity ? null : stock, // null = not tracked
                held: held.get(v.shopifyVariantId) || 0,
                soldLast30Days: sold30.get(v.shopifyVariantId) || 0,
                hiddenInApp: isHiddenVariant(v),
                weightGrams: v.weightGrams || 0,
            };
        }),
    }));
};

// ── Carts ──────────────────────────────────────────────────────────────────

const carts = async (query = {}, now = Date.now()) => {
    const pg = pageArgs(query);
    const filter = { 'items.0': { $exists: true } };
    if (query.abandoned === 'true') filter.updatedAt = { $lt: new Date(now - 60 * 60 * 1000) };
    const [docs, count] = await Promise.all([
        Cart.find(filter).sort({ updatedAt: -1 }).skip(pg.skip).limit(pg.limit).lean(),
        Cart.countDocuments(filter),
    ]);
    const ids = [...new Set(docs.flatMap((c) => c.items.map((i) => i.variantId)))];
    const [prods, users] = await Promise.all([
        Product.find({ 'variants.shopifyVariantId': { $in: ids } }).lean(),
        usersById(docs.map((c) => c.user)),
    ]);
    const index = indexVariants(prods);
    const items = docs.map((c) => {
        const ev = evaluateCart(c.items, index);
        return {
            user: users.get(String(c.user)) || { id: String(c.user) },
            items: ev.lines.map((l) => ({ title: l.title, variantTitle: l.variantTitle, quantity: l.quantity, issue: l.issue })),
            itemCount: ev.lines.reduce((n, l) => n + l.quantity, 0),
            value: ev.summary.subtotal,
            updatedAt: c.updatedAt,
            abandoned: now - new Date(c.updatedAt).getTime() > 60 * 60 * 1000,
        };
    });
    return paged(items, count, pg);
};

// ── Customers / journey ────────────────────────────────────────────────────

/** Search by name / email / phone, or (no query) the most recently active shoppers. */
const customers = async ({ q } = {}) => {
    const term = String(q || '').trim();
    let ids;
    if (term) {
        const digits = term.replace(/\D/g, '');
        const or = [{ email: { $regex: escapeRegex(term), $options: 'i' } }, { name: { $regex: escapeRegex(term), $options: 'i' } }];
        if (digits.length >= 6) or.push({ phone: { $regex: escapeRegex(digits) } });
        ids = (await User.find({ $or: or }).select('_id').limit(30).lean()).map((u) => String(u._id));
    } else {
        const recent = await ShopEvent.find({ user: { $ne: null } }).sort({ createdAt: -1 }).select('user createdAt').limit(3000).lean();
        ids = [...new Set(recent.map((e) => String(e.user)))].slice(0, 50);
    }
    const objIds = ids.map((id) => new mongoose.Types.ObjectId(id));
    const [users, orders, lastEvents, cartDocs] = await Promise.all([
        usersById(ids),
        Order.find({ user: { $in: objIds } }).select('user paymentStatus pricing amount placedAt createdAt').lean(),
        ShopEvent.find({ user: { $in: objIds } }).sort({ createdAt: -1 }).select('user createdAt').limit(5000).lean(),
        Cart.find({ user: { $in: objIds } }).select('user items').lean(),
    ]);
    const placedStates = STATUS_FILTERS.placed.paymentStatus.$in;
    return ids.map((id) => {
        const mine = orders.filter((o) => String(o.user) === id);
        const placed = mine.filter((o) => placedStates.includes(o.paymentStatus));
        return {
            ...(users.get(id) || { id }),
            orders: placed.length,
            spent: money(placed.reduce((n, o) => n + (o.pricing?.total ?? o.amount), 0)),
            abandonedCheckouts: mine.filter((o) => ['expired', 'failed'].includes(o.paymentStatus)).length,
            cartItems: (cartDocs.find((c) => String(c.user) === id)?.items || []).reduce((n, i) => n + i.quantity, 0),
            lastActivityAt: lastEvents.find((e) => String(e.user) === id)?.createdAt || mine.map((o) => o.createdAt).sort().pop() || null,
        };
    });
};

/** One shopper: profile, current cart, every checkout / order, and their event timeline. */
const customerJourney = async (userId) => {
    if (!mongoose.isValidObjectId(userId)) throw new ShopError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
    const uid = new mongoose.Types.ObjectId(userId);
    const [users, cart, orders, events] = await Promise.all([
        usersById([userId]),
        Cart.findOne({ user: uid }).lean(),
        Order.find({ user: uid }).sort({ createdAt: -1 }).limit(100).lean(),
        ShopEvent.find({ user: uid }).sort({ createdAt: -1, _id: -1 }).limit(500).lean(),
    ]);
    const user = users.get(String(userId));
    if (!user && !orders.length && !events.length && !cart) throw new ShopError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');

    let cartView = null;
    if (cart?.items?.length) {
        const prods = await Product.find({ 'variants.shopifyVariantId': { $in: cart.items.map((i) => i.variantId) } }).lean();
        const ev = evaluateCart(cart.items, indexVariants(prods));
        cartView = { items: ev.lines.map((l) => ({ title: l.title, variantTitle: l.variantTitle, quantity: l.quantity, issue: l.issue })), value: ev.summary.subtotal, updatedAt: cart.updatedAt };
    }
    return {
        customer: user || { id: String(userId) },
        cart: cartView,
        orders: orders.map((o) => orderRow(o, user)),
        events: events.map((e) => ({ at: e.createdAt, type: e.type, orderId: e.orderId, productId: e.productId, variantId: e.variantId, meta: e.meta })),
    };
};

// ── Refunds ────────────────────────────────────────────────────────────────

const refunds = async ({ status } = {}) => {
    const filter = status ? { 'refunds.status': status } : { 'refunds.0': { $exists: true } };
    const docs = await Order.find(filter).sort({ updatedAt: -1 }).limit(300).lean();
    const users = await usersById(docs.map((o) => o.user));
    return docs.flatMap((o) => (o.refunds || [])
        .filter((r) => !status || r.status === status)
        .map((r) => ({
            orderId: o.internalOrderId,
            customer: users.get(String(o.user)) || { id: String(o.user) },
            refundId: r.refundId, kind: r.kind, source: r.source, status: r.status, method: r.method,
            amount: money(r.amount), reason: r.reason || null, error: r.error || null, reference: r.reference || null,
            fastrrRefundId: r.fastrrRefundId || null, requestedBy: r.requestedBy || null, approvedBy: r.approvedBy || null,
            createdAt: r.createdAt, completedAt: r.completedAt || null,
        })))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

module.exports = {
    overview, listOrders, getOrder, attention, retryShopifySync, resolveReview, syncCatalog,
    products, carts, customers, customerJourney, refunds,
    _internal: { STATUS_FILTERS, searchFilter, shopifyAdminUrl },
};
