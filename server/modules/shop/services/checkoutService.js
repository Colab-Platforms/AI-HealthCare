// Checkout: server cart -> our Order (saved FIRST) -> Fastrr checkout token ->
// signed WebView page -> Fastrr -> return page -> app deep link.
//
// Idempotency: the app sends an Idempotency-Key per checkout attempt.
//   same user + same key + same cart  -> the same order (and a still-valid token)
//   same user + same key + other cart -> 409 IDEMPOTENCY_KEY_REUSED
// A unique index on { user, idempotencyKey } makes a concurrent double tap
// collapse into one order; a short "token lease" on the order makes sure only
// one request at a time asks Fastrr for a token.

const crypto = require('crypto');
const Order = require('../../../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const config = require('../config');
const fastrr = require('./fastrrClient');
const fastrrOrderService = require('./fastrrOrderService');
const reservations = require('./stockReservationService');
const { ShopError } = require('../lib/shopError');
const { evaluateCart, indexVariants } = require('../lib/cartEvaluator');
const {
    isValidIdempotencyKey, cartHash, newInternalOrderId, isValidInternalOrderId,
    buildCheckoutTokenPayload, signPageParams, verifyPageParams, fillTemplate,
} = require('../lib/checkoutLogic');
const { displayStatus, money, PLACED_PAYMENT_STATES } = require('../lib/orderView');
const { renderCheckoutPage, renderReturnPage, renderMessagePage } = require('../lib/checkoutPage');
const { paiseToRupees } = require('../lib/money');

// ── Helpers ────────────────────────────────────────────────────────────────

// Separate key for page links, derived from JWT_SECRET unless set explicitly,
// so a leaked page signature can't be turned into anything else.
const pageSecret = () => {
    if (process.env.SHOP_CHECKOUT_PAGE_SECRET) return process.env.SHOP_CHECKOUT_PAGE_SECRET;
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET (or SHOP_CHECKOUT_PAGE_SECRET) is not set');
    return crypto.createHmac('sha256', process.env.JWT_SECRET).update('shop-checkout-page-v1').digest('hex');
};

const urls = (baseUrl, internalOrderId) => {
    const base = `${baseUrl}/api/shop/checkout/${encodeURIComponent(internalOrderId)}`;
    return { page: `${base}/page`, ret: `${base}/return` };
};

const pageUrl = (baseUrl, internalOrderId) => {
    const { exp, sig } = signPageParams(pageSecret(), internalOrderId, config.checkoutPageTtlMs());
    return `${urls(baseUrl, internalOrderId).page}?exp=${exp}&sig=${sig}`;
};

const deepLink = (internalOrderId, status) => fillTemplate(config.appDeepLink(), { orderId: internalOrderId, status });

const tokenUsable = (order, now = Date.now()) =>
    Boolean(order.fastrrToken && order.fastrrTokenExpiresAt
        && new Date(order.fastrrTokenExpiresAt).getTime() - now > config.tokenMinRemainingMs);

const checkoutResponse = (order, baseUrl) => ({
    orderId: order.internalOrderId,
    status: displayStatus(order),
    amount: money(order.amount),
    itemCount: (order.items || []).reduce((n, i) => n + i.quantity, 0),
    checkoutPageUrl: pageUrl(baseUrl, order.internalOrderId),
    expiresAt: order.fastrrTokenExpiresAt,
});

// An existing order for this key that is no longer awaiting payment.
const assertStillPending = (order) => {
    if (order.paymentStatus === 'pending') return;
    if (PLACED_PAYMENT_STATES.includes(order.paymentStatus)) {
        throw new ShopError(409, 'ORDER_ALREADY_PLACED', 'This order has already been placed', { orderId: order.internalOrderId });
    }
    throw new ShopError(409, 'CHECKOUT_CLOSED', 'This checkout has ended. Please start checkout again.', {
        orderId: order.internalOrderId, status: displayStatus(order),
    });
};

// ── Cart -> order lines ────────────────────────────────────────────────────

const evaluateUserCart = async (userId) => {
    const cart = await Cart.findOne({ user: userId }).lean();
    const items = cart?.items || [];
    if (!items.length) return { items, evaluation: evaluateCart([], new Map()), index: new Map() };
    const products = await Product.find({ 'variants.shopifyVariantId': { $in: items.map((i) => i.variantId) } }).lean();
    const index = indexVariants(products);
    return { items, evaluation: evaluateCart(items, index), index };
};

const toOrderItems = (lines, index) => lines.map((l) => {
    const { product, variant } = index.get(l.variantId);
    return {
        variantId: l.variantId,
        productId: product.shopifyProductId,
        title: product.title,
        variantTitle: variant.title,
        imageUrl: variant.imageUrl || product.images?.[0]?.url || undefined,
        sku: variant.sku || undefined,
        quantity: l.quantity,
        priceSnapshot: l.unitPrice.paise,
    };
});

// ── Token ──────────────────────────────────────────────────────────────────

/**
 * Make sure the order has a usable Fastrr token, fetching a new one if needed.
 * Only one request per order talks to Fastrr at a time (token lease).
 */
const ensureToken = async (order, baseUrl) => {
    if (tokenUsable(order)) return order;

    const now = Date.now();
    const leased = await Order.findOneAndUpdate(
        { _id: order._id, paymentStatus: 'pending', $or: [{ tokenLeaseUntil: null }, { tokenLeaseUntil: { $lt: new Date(now) } }] },
        { $set: { tokenLeaseUntil: new Date(now + config.tokenLeaseMs) } },
        { new: true }
    ).lean();

    if (!leased) {
        const current = await Order.findById(order._id).lean();
        if (!current) throw new ShopError(404, 'ORDER_NOT_FOUND', 'Order not found');
        assertStillPending(current);
        if (tokenUsable(current)) return current;
        throw new ShopError(409, 'CHECKOUT_IN_PROGRESS', 'Checkout is being prepared. Please try again in a moment.', { retryAfterMs: 2000 });
    }
    if (tokenUsable(leased)) { // another request finished just before we took the lease
        await Order.updateOne({ _id: order._id }, { $set: { tokenLeaseUntil: null } });
        return leased;
    }

    // Hold the stock before the user can pay (released / re-tied to the token below).
    try {
        await reservations.reserve(leased, new Date(Date.now() + config.reservationHoldMs()));
    } catch (err) {
        await Order.updateOne({ _id: order._id }, { $set: { tokenLeaseUntil: null } });
        throw err;
    }

    let token;
    try {
        token = await fastrr.createCheckoutToken(buildCheckoutTokenPayload({
            items: leased.items,
            internalOrderId: leased.internalOrderId,
            redirectUrl: urls(baseUrl, leased.internalOrderId).ret,
            placeholderImageUrl: config.placeholderImageUrl(),
        }));
    } catch (err) {
        await Order.updateOne({ _id: order._id }, { $set: { tokenLeaseUntil: null } });
        await reservations.release(order._id);
        console.error(`[Shop/checkout] ${leased.internalOrderId}: Fastrr token failed: ${err.message}`);
        throw new ShopError(502, 'CHECKOUT_PROVIDER_ERROR', 'Could not start checkout. Please try again.', { retryable: true });
    }

    const saved = await Order.findOneAndUpdate(
        { _id: order._id },
        {
            $set: {
                fastrrToken: token.token,
                fastrrTokenExpiresAt: token.expiresAt,
                fastrrOrderId: token.fastrrOrderId,
                tokenLeaseUntil: null,
            },
            $addToSet: { fastrrOrderIds: token.fastrrOrderId },
        },
        { new: true }
    ).lean();
    // Payment is possible until the token expires; hold a little past that.
    await reservations.extend(order._id, new Date(token.expiresAt.getTime() + config.reservationAfterTokenMs));
    console.log(`[Shop/checkout] ${saved.internalOrderId}: Fastrr token issued (fastrr order ${token.fastrrOrderId})`);
    return saved;
};

// ── Start checkout ─────────────────────────────────────────────────────────

const resumeExisting = async (existing, hash, baseUrl) => {
    assertStillPending(existing);
    if (existing.cartHash !== hash) {
        throw new ShopError(409, 'IDEMPOTENCY_KEY_REUSED', 'This checkout key was already used for a different cart', {
            orderId: existing.internalOrderId,
        });
    }
    return checkoutResponse(await ensureToken(existing, baseUrl), baseUrl);
};

const createOrder = async ({ userId, idempotencyKey, hash, items, amount }) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const doc = await Order.create({
                internalOrderId: newInternalOrderId(),
                user: userId,
                idempotencyKey,
                cartHash: hash,
                items,
                amount,
                pricing: { subtotal: amount },
                statusHistory: [{ field: 'paymentStatus', status: 'pending', source: 'system', changedAt: new Date() }],
            });
            return { order: doc.toObject ? doc.toObject() : doc, created: true };
        } catch (err) {
            if (err.code !== 11000) throw err;
            // Same user + key: a concurrent request created it — use that one.
            const existing = await Order.findOne({ user: userId, idempotencyKey }).lean();
            if (existing) return { order: existing, created: false };
            // Otherwise an internalOrderId collision (40 random bits): new id.
        }
    }
    throw new Error('Could not allocate an order id');
};

/**
 * POST /api/shop/checkout
 * @returns {{ orderId, status, amount, itemCount, checkoutPageUrl, expiresAt }}
 */
const startCheckout = async (userId, { idempotencyKey, baseUrl }) => {
    if (!isValidIdempotencyKey(idempotencyKey)) {
        throw new ShopError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Send an Idempotency-Key header (8-128 characters: letters, digits, . _ : -)');
    }
    if (!fastrr.isConfigured()) {
        throw new ShopError(503, 'CHECKOUT_UNAVAILABLE', 'Checkout is not available right now');
    }

    // A retry of a finished checkout must learn the outcome, not hit "cart empty".
    const existing = await Order.findOne({ user: userId, idempotencyKey }).lean();
    if (existing) assertStillPending(existing);

    const { evaluation, index } = await evaluateUserCart(userId);
    const { lines, summary } = evaluation;

    const hash = cartHash(lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice.paise })));
    if (existing) return resumeExisting(existing, hash, baseUrl);

    if (!lines.length) throw new ShopError(400, 'CART_EMPTY', 'Your cart is empty');
    if (summary.hasIssues) {
        throw new ShopError(409, 'CART_HAS_ISSUES', 'Some items in your cart need attention', { cart: evaluation });
    }
    const changed = lines.filter((l) => l.priceChanged);
    if (changed.length) {
        // Never charge a price the user hasn't seen. Record that they have now.
        await Cart.bulkWrite(changed.map((l) => ({
            updateOne: {
                filter: { user: userId, 'items.variantId': l.variantId },
                update: { $set: { 'items.$.addedPrice': l.unitPrice.paise } },
            },
        })));
        throw new ShopError(409, 'PRICE_CHANGED', 'Prices in your cart have changed. Please review your cart.', { cart: evaluation });
    }

    const items = toOrderItems(lines, index);
    const amount = summary.subtotal.paise;
    const { order, created } = await createOrder({ userId, idempotencyKey, hash, items, amount });
    if (!created) return resumeExisting(order, hash, baseUrl);

    console.log(`[Shop/checkout] ${order.internalOrderId}: created (${summary.itemCount} items, ${amount} paise)`);
    return checkoutResponse(await ensureToken(order, baseUrl), baseUrl);
};

// ── WebView pages ──────────────────────────────────────────────────────────

/**
 * GET /api/shop/checkout/:orderId/page?exp=&sig=
 * @returns {{ status: number, html: string }}
 */
const checkoutPage = async ({ orderId, exp, sig, baseUrl }) => {
    if (!isValidInternalOrderId(orderId) || !verifyPageParams(pageSecret(), orderId, exp, sig)) {
        return { status: 403, html: renderMessagePage({ title: 'Link expired', message: 'Please go back to the app and start checkout again.' }) };
    }
    const order = await Order.findOne({ internalOrderId: orderId }).lean();
    if (!order) return { status: 404, html: renderMessagePage({ title: 'Order not found', message: 'Please go back to the app and try again.' }) };

    if (order.paymentStatus !== 'pending') {
        const status = displayStatus(order);
        return { status: 200, html: renderReturnPage({ deepLink: deepLink(orderId, status), ...returnCopy(status) }) };
    }

    let ready;
    try {
        ready = await ensureToken(order, baseUrl);
    } catch (err) {
        const retry = err.code === 'CHECKOUT_IN_PROGRESS' || err.code === 'CHECKOUT_PROVIDER_ERROR';
        if (!retry) console.error(`[Shop/checkoutPage] ${orderId}: ${err.message}`);
        return {
            status: 503,
            html: renderMessagePage({ title: 'Checkout is not available', message: 'Please try again in a moment.', deepLink: deepLink(orderId, 'awaiting_payment') }),
        };
    }

    const html = renderCheckoutPage({
        token: ready.fastrrToken,
        uiBaseUrl: config.fastrr.uiBaseUrl(),
        fallbackUrl: config.fallbackUrl() || `${urls(baseUrl, orderId).ret}?fallback=1`,
        amountText: `Order ${orderId} · ₹${paiseToRupees(ready.amount).toFixed(2)}`,
    });
    return { status: 200, html };
};

const returnCopy = (status) => {
    switch (status) {
        case 'confirmed':
        case 'shipped':
        case 'delivered': return { title: 'Order placed', message: 'Thank you! Taking you back to the app…' };
        case 'payment_failed': return { title: 'Payment failed', message: 'No money was taken. Taking you back to the app…' };
        case 'expired': return { title: 'Checkout expired', message: 'Taking you back to the app…' };
        case 'awaiting_payment': return { title: 'Checking your payment…', message: 'Taking you back to the app — your order status will update there.' };
        default: return { title: 'Done', message: 'Taking you back to the app…' };
    }
};

/**
 * GET /api/shop/checkout/:orderId/return?oid=&ost=   (Fastrr's redirect_url)
 * Fastrr's `ost` is never trusted: we ask Fastrr (throttled) and show OUR status.
 */
const checkoutReturn = async ({ orderId, oid }) => {
    if (!isValidInternalOrderId(orderId)) {
        return { status: 404, html: renderMessagePage({ title: 'Order not found', message: 'Please go back to the app.' }) };
    }
    let order = await Order.findOne({ internalOrderId: orderId }).lean();
    if (!order) return { status: 404, html: renderMessagePage({ title: 'Order not found', message: 'Please go back to the app.' }) };

    const ids = typeof oid === 'string' && order.fastrrOrderIds?.includes(oid) ? [oid] : null;
    order = await fastrrOrderService.syncPendingThrottled(order, { ids, source: 'return' });
    const status = displayStatus(order);
    return { status: 200, html: renderReturnPage({ deepLink: deepLink(orderId, status), ...returnCopy(status) }) };
};

module.exports = { startCheckout, checkoutPage, checkoutReturn, ensureToken, _internal: { pageSecret, pageUrl, tokenUsable } };
