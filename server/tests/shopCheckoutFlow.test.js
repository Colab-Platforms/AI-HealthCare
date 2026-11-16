// End-to-end scenarios for M2 (checkout -> Fastrr -> webhook / poll / cron),
// run through the real services and the real routes, with:
//   - an in-memory stand-in for Mongo (tests/helpers/fakeMongo.js)
//   - a local Fastrr API that checks our HMAC (tests/helpers/fastrrMock.js)
//   - `protect` replaced by a header-based test user
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const express = require('express');

const { FakeCollection } = require('./helpers/fakeMongo');
const { startFastrrMock, placedOrder, fastrrOrder, API_KEY, API_SECRET } = require('./helpers/fastrrMock');

// ── Environment ────────────────────────────────────────────────────────────

const ENV = {
    SHOP_CHECKOUT_MODE: 'custom_api',
    FASTRR_API_KEY: API_KEY,
    FASTRR_API_SECRET: API_SECRET,
    FASTRR_TIMEOUT_MS: '3000',
    JWT_SECRET: 'test-jwt-secret',
    SHOP_PUBLIC_BASE_URL: 'https://shop.test',
    SHOP_APP_DEEP_LINK: 'takehealth://shop/order/{orderId}?status={status}',
    SHOP_HIDE_SUBSCRIBE_VARIANTS: undefined,
    SHOP_CHECKOUT_PAGE_SECRET: undefined,
    FASTRR_FALLBACK_URL: undefined,
    FASTRR_CHECKOUT_UI_URL: undefined,
    FASTRR_CATALOG_PUSH: undefined,
    QSTASH_CURRENT_SIGNING_KEY: undefined,
    REDIS_URL: undefined,
};
const savedEnv = {};

// `protect` stub: "Authorization: Bearer <userId>" -> req.user
const authPath = require.resolve('../middleware/auth');
const savedAuth = require.cache[authPath];
require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true,
    exports: {
        protect: (req, res, next) => {
            const id = (req.headers.authorization || '').replace(/^Bearer /, '');
            if (!mongoose.isValidObjectId(id)) return res.status(401).json({ message: 'Not authorized' });
            req.user = { _id: new mongoose.Types.ObjectId(id), role: req.headers['x-test-role'] || 'user' };
            next();
        },
        authorize: (...roles) => (req, res, next) => (roles.includes(req.user?.role) ? next() : res.status(403).json({ message: 'Not authorized for this action' })),
    },
};

const Order = require('../models/Order');
const Cart = require('../modules/shop/models/Cart');
const Product = require('../modules/shop/models/Product');
const Collection = require('../modules/shop/models/Collection');
const checkoutService = require('../modules/shop/services/checkoutService');
const fastrrOrderService = require('../modules/shop/services/fastrrOrderService');
const orderService = require('../modules/shop/services/orderService');
const catalogSyncService = require('../modules/shop/services/catalogSyncService');

const orders = new FakeCollection(Order, { unique: [['internalOrderId'], ['user', 'idempotencyKey']] });
const carts = new FakeCollection(Cart, { unique: [['user']] });
const products = new FakeCollection(Product, { unique: [['shopifyProductId']] });
const collections = new FakeCollection(Collection, { unique: [['shopifyCollectionId']] });
const StockReservation = require('../modules/shop/models/StockReservation');
const holds = new FakeCollection(StockReservation, { unique: [['order', 'variantId']] });
// Any model call that isn't faked fails at once instead of waiting on a DB that isn't there.
mongoose.set('bufferCommands', false);
// Push notifications: recorded, never sent.
const fcm = require('../services/fcmService');
const pushes = [];
fcm.sendToUser = async (userId, payload) => { pushes.push({ userId: String(userId), ...payload }); return { success: true }; };
const restores = [];

let mock;
let server;
let api;

const TOKEN = '/api/v1/access-token/checkout';
const DETAILS = '/api/v1/custom-platform-order/details';
const BASE = 'https://shop.test';

test.before(async () => {
    for (const [k, v] of Object.entries(ENV)) {
        savedEnv[k] = process.env[k];
        if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    mock = await startFastrrMock();
    process.env.FASTRR_BASE_URL = mock.baseUrl;
    for (const c of [orders, carts, products, collections, holds]) restores.push(c.install());

    const app = express();
    app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf.toString('utf8'); } }));
    app.use('/api/shop', require('../modules/shop/routes'));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    api = `http://127.0.0.1:${server.address().port}/api/shop`;
});

test.after(async () => {
    restores.forEach((r) => r());
    await new Promise((r) => server.close(r));
    await mock.close();
    for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    delete process.env.FASTRR_BASE_URL;
    if (savedAuth) require.cache[authPath] = savedAuth; else delete require.cache[authPath];
});

// ── Fixtures ───────────────────────────────────────────────────────────────

const V1 = '57199514222897'; // 1 pack One-Time ₹1499, stock 50
const V2 = '57199514222898'; // 1 pack Subscribe ₹1349 (hidden)
const V3 = '57199514222899'; // 3 pack ₹4497, stock 1
const V9 = '777';            // other product, untracked ₹99

const seedCatalog = () => {
    products.seed({
        shopifyProductId: '9001', handle: 'berberine', title: 'Berberine', status: 'active',
        images: [{ url: 'https://cdn/berberine.jpg', alt: '' }],
        variants: [
            { shopifyVariantId: V1, title: '1 pack / One-Time', sku: 'BRB-1', price: 149900, inventoryQty: 50, options: [{ name: 'Pack', value: '1 pack' }, { name: 'Purchase', value: 'One-Time' }] },
            { shopifyVariantId: V2, title: '1 pack / Subscribe', sku: 'BRB-1S', price: 134900, inventoryQty: 50, options: [{ name: 'Pack', value: '1 pack' }, { name: 'Purchase', value: 'Subscribe' }] },
            { shopifyVariantId: V3, title: '3 pack / One-Time', sku: 'BRB-3', price: 449700, inventoryQty: 1, options: [{ name: 'Pack', value: '3 pack' }, { name: 'Purchase', value: 'One-Time' }] },
        ],
        minPrice: 134900,
    });
    products.seed({
        shopifyProductId: '9002', handle: 'magnesium', title: 'Magnesium', status: 'active', images: [],
        variants: [{ shopifyVariantId: V9, title: 'Default Title', price: 9900, inventoryTracked: false, inventoryQty: 0 }],
        minPrice: 9900,
    });
};

const newUser = () => new mongoose.Types.ObjectId();
const setCart = (user, items) => {
    carts.docs = carts.docs.filter((c) => String(c.user) !== String(user));
    carts.seed({ user, items: items.map(([variantId, quantity, addedPrice]) => ({ variantId, productId: variantId === V9 ? '9002' : '9001', quantity, addedPrice })) });
};
const cartOf = (user) => carts.raw({ user });
const orderOf = (internalOrderId) => orders.raw({ internalOrderId });

let keySeq = 0;
const newKey = () => `test-key-${Date.now()}-${++keySeq}`;
const start = (user, key = newKey()) => checkoutService.startCheckout(user, { idempotencyKey: key, baseUrl: BASE });
const rejectsCode = (p, code, status) => assert.rejects(p, (e) => {
    assert.equal(e.code, code);
    if (status) assert.equal(e.status, status);
    return true;
});

const pay = (order, opts = {}) => {
    const id = opts.fastrrOrderId || order.fastrrOrderId;
    const items = order.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity }));
    mock.state.orders.set(id, placedOrder(id, { items, subtotal: order.amount / 100, ...opts }));
    return id;
};
const webhook = (body) => fastrrOrderService.handleWebhook(body);

test.beforeEach(() => {
    orders.docs = []; carts.docs = []; products.docs = []; collections.docs = []; holds.docs = []; pushes.length = 0;
    mock.reset();
    seedCatalog();
});

// ── Checkout start ─────────────────────────────────────────────────────────

test('checkout: creates the order first, then a Fastrr token with our prices', async () => {
    const user = newUser();
    setCart(user, [[V1, 2, 149900], [V9, 1, 9900]]);
    const r = await start(user);

    assert.match(r.orderId, /^TH-\d{6}-[0-9A-Z]{8}$/);
    assert.equal(r.status, 'awaiting_payment');
    assert.equal(r.amount.paise, 2 * 149900 + 9900);
    assert.equal(r.itemCount, 3);
    assert.match(r.checkoutPageUrl, new RegExp(`^${BASE}/api/shop/checkout/${r.orderId}/page\\?exp=\\d+&sig=[\\w-]+$`));

    const o = orderOf(r.orderId);
    assert.equal(o.paymentStatus, 'pending');
    assert.equal(o.shopifySyncStatus, 'not_started');
    assert.deepEqual(o.items.map((i) => [i.variantId, i.quantity, i.priceSnapshot]), [[V1, 2, 149900], [V9, 1, 9900]]);
    assert.equal(o.items[0].title, 'Berberine');
    assert.equal(o.items[0].imageUrl, 'https://cdn/berberine.jpg');
    assert.equal(o.fastrrToken, 'tok_1');
    assert.deepEqual(o.fastrrOrderIds, [o.fastrrOrderId]);
    assert.equal(o.tokenLeaseUntil ?? null, null);

    const [call] = mock.callsTo(TOKEN);
    assert.equal(call.body.cart_data.mobile_app, true);
    assert.equal(call.body.cart_data.custom_attributes.internal_order_id, r.orderId);
    assert.deepEqual(call.body.cart_data.items[0].catalog_data, { price: 1499, name: 'Berberine - 1 pack / One-Time', image_url: 'https://cdn/berberine.jpg' });
    assert.equal(call.body.redirect_url, `${BASE}/api/shop/checkout/${r.orderId}/return`);

    // "Order saved BEFORE Fastrr call": the create happened before the token was stored.
    const createIdx = orders.calls.findIndex(([op]) => op === 'create');
    const tokenSaveIdx = orders.calls.findIndex(([op, , u]) => op === 'findOneAndUpdate' && u?.$set?.fastrrToken);
    assert.ok(createIdx >= 0 && tokenSaveIdx > createIdx);
    // The cart is untouched until payment is confirmed.
    assert.equal(cartOf(user).items.length, 2);
});

test('checkout: same key + same cart = same order, token reused (no second Fastrr call)', async () => {
    const user = newUser();
    setCart(user, [[V1, 1, 149900]]);
    const key = newKey();
    const a = await start(user, key);
    const b = await start(user, key);
    assert.equal(a.orderId, b.orderId);
    assert.equal(orders.docs.length, 1);
    assert.equal(mock.callsTo(TOKEN).length, 1);
});

test('checkout: same key reused for a different cart -> 409 IDEMPOTENCY_KEY_REUSED', async () => {
    const user = newUser();
    setCart(user, [[V1, 1, 149900]]);
    const key = newKey();
    await start(user, key);
    setCart(user, [[V1, 2, 149900]]);
    await rejectsCode(start(user, key), 'IDEMPOTENCY_KEY_REUSED', 409);
    assert.equal(orders.docs.length, 1);
});

test('checkout: the same key from two users is two separate checkouts', async () => {
    const [u1, u2] = [newUser(), newUser()];
    setCart(u1, [[V1, 1, 149900]]);
    setCart(u2, [[V9, 1, 9900]]);
    const key = newKey();
    const [a, b] = await Promise.all([start(u1, key), start(u2, key)]);
    assert.notEqual(a.orderId, b.orderId);
    assert.equal(orders.docs.length, 2);
});

test('checkout: concurrent double tap -> one order, one Fastrr token', async () => {
    const user = newUser();
    setCart(user, [[V1, 1, 149900]]);
    const key = newKey();
    const results = await Promise.allSettled([start(user, key), start(user, key), start(user, key)]);
    assert.equal(orders.docs.length, 1);
    assert.equal(mock.callsTo(TOKEN).length, 1);
    const ok = results.filter((r) => r.status === 'fulfilled');
    assert.ok(ok.length >= 1);
    ok.forEach((r) => assert.equal(r.value.orderId, orders.docs[0].internalOrderId));
    results.filter((r) => r.status === 'rejected').forEach((r) => assert.equal(r.reason.code, 'CHECKOUT_IN_PROGRESS'));
    // ...and a retry a moment later gets the same order.
    assert.equal((await start(user, key)).orderId, orders.docs[0].internalOrderId);
});

test('checkout: empty cart / out of stock / removed product are refused before any order exists', async () => {
    const user = newUser();
    await rejectsCode(start(user), 'CART_EMPTY', 400);
    setCart(user, [[V3, 2, 449700]]); // only 1 in stock
    await assert.rejects(start(user), (e) => e.code === 'CART_HAS_ISSUES' && e.details.cart.lines[0].issue === 'INSUFFICIENT_STOCK');
    setCart(user, [['404404', 1, 100]]);
    await assert.rejects(start(user), (e) => e.code === 'CART_HAS_ISSUES' && e.details.cart.lines[0].issue === 'UNAVAILABLE');
    assert.equal(orders.docs.length, 0);
    assert.equal(mock.callsTo(TOKEN).length, 0);
});

test('checkout: a price change is shown to the user first (409), then checkout goes through at the new price', async () => {
    const user = newUser();
    setCart(user, [[V1, 1, 139900]]); // user saw ₹1399, now ₹1499
    await assert.rejects(start(user), (e) => e.code === 'PRICE_CHANGED' && e.details.cart.lines[0].previousPrice.paise === 139900);
    assert.equal(orders.docs.length, 0);
    assert.equal(cartOf(user).items[0].addedPrice, 149900); // now "seen"
    const r = await start(user);
    assert.equal(r.amount.paise, 149900);
});

test('checkout: subscribe variant in the cart blocks checkout (hidden by default)', async () => {
    const user = newUser();
    setCart(user, [[V2, 1, 134900]]);
    await assert.rejects(start(user), (e) => e.code === 'CART_HAS_ISSUES' && e.details.cart.lines[0].issue === 'UNAVAILABLE');
});

test('checkout: missing / malformed key -> 400; Fastrr not configured -> 503; nothing created', async () => {
    const user = newUser();
    setCart(user, [[V1, 1, 149900]]);
    for (const k of [undefined, '', 'short', 'bad key with spaces']) {
        await rejectsCode(checkoutService.startCheckout(user, { idempotencyKey: k, baseUrl: BASE }), 'IDEMPOTENCY_KEY_REQUIRED', 400);
    }
    delete process.env.FASTRR_API_SECRET;
    try {
        await rejectsCode(start(user), 'CHECKOUT_UNAVAILABLE', 503);
    } finally {
        process.env.FASTRR_API_SECRET = API_SECRET;
    }
    assert.equal(orders.docs.length, 0);
});

test('checkout: Fastrr down -> 502, order kept with lease released; retry with the same key reuses it', async () => {
    const user = newUser();
    setCart(user, [[V1, 1, 149900]]);
    const key = newKey();
    mock.state.next.push({ path: TOKEN, status: 503, body: {} }, { path: TOKEN, status: 503, body: {} });
    await rejectsCode(start(user, key), 'CHECKOUT_PROVIDER_ERROR', 502);
    assert.equal(orders.docs.length, 1);
    const o = orders.docs[0];
    assert.equal(o.paymentStatus, 'pending');
    assert.equal(o.fastrrToken, undefined);
    assert.equal(o.tokenLeaseUntil, null);

    const r = await start(user, key);
    assert.equal(r.orderId, o.internalOrderId);
    assert.equal(orders.docs.length, 1);
    assert.ok(orderOf(r.orderId).fastrrToken);
});

test('checkout: a token close to expiry is replaced on the SAME order; the old Fastrr id is remembered', async () => {
    const user = newUser();
    setCart(user, [[V1, 1, 149900]]);
    const key = newKey();
    mock.state.tokenTtlMs = 60 * 1000; // shorter than the 2-minute minimum
    const a = await start(user, key);
    mock.state.tokenTtlMs = 30 * 60 * 1000;
    const b = await start(user, key);
    assert.equal(a.orderId, b.orderId);
    const o = orderOf(a.orderId);
    assert.equal(mock.callsTo(TOKEN).length, 2);
    assert.equal(o.fastrrOrderIds.length, 2);
    assert.equal(o.fastrrOrderId, o.fastrrOrderIds[1]);
    assert.equal(o.fastrrToken, 'tok_2');
});

test('checkout: retrying a finished checkout tells the app what happened', async () => {
    const user = newUser();
    setCart(user, [[V1, 1, 149900]]);
    const key = newKey();
    const r = await start(user, key);
    pay(orderOf(r.orderId));
    await webhook({ order_id: orderOf(r.orderId).fastrrOrderId });
    // cart is now empty, but the app learns the order was placed (not "cart empty")
    await assert.rejects(start(user, key), (e) => e.code === 'ORDER_ALREADY_PLACED' && e.details.orderId === r.orderId);

    const key2 = newKey();
    setCart(user, [[V9, 1, 9900]]);
    const r2 = await start(user, key2);
    orders.raw({ internalOrderId: r2.orderId }).paymentStatus = 'expired';
    await assert.rejects(start(user, key2), (e) => e.code === 'CHECKOUT_CLOSED' && e.details.status === 'expired');
});

// ── Webhook (fetch-back) ───────────────────────────────────────────────────

const checkedOut = async (items = [[V1, 2, 149900]]) => {
    const user = newUser();
    setCart(user, items);
    const r = await start(user);
    return { user, orderId: r.orderId, order: orderOf(r.orderId) };
};

test('webhook: prepaid success -> paid, details saved, bought lines removed from cart, Shopify sync queued', async () => {
    const { user, orderId, order } = await checkedOut([[V1, 2, 149900]]);
    // user added something after starting checkout — must survive
    cartOf(user).items.push({ variantId: V9, productId: '9002', quantity: 1, addedPrice: 9900 });
    pay(order, { discount: 100, shipping: 49 });

    const r = await webhook({ order_id: order.fastrrOrderId, status: 'SUCCESS' });
    assert.equal(r.result, 'paid');
    const o = orderOf(orderId);
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(o.paymentMethod, 'prepaid');
    assert.equal(o.paidFastrrOrderId, order.fastrrOrderId);
    assert.equal(o.pricing.total, 299800 - 10000 + 4900);
    assert.equal(o.payment.pgTransactionId, 'pay_ABC');
    assert.equal(o.razorpayPaymentId, 'pay_ABC');
    assert.equal(o.shippingAddress.city, 'Pune');
    assert.equal(o.customer.phone, '9876543210');
    assert.equal(o.rtoPrediction, 'low');
    assert.ok(o.placedAt instanceof Date);
    assert.equal(o.review.needed, false);
    assert.equal(o.shopifySyncStatus, 'pending');
    assert.deepEqual(cartOf(user).items.map((i) => i.variantId), [V9]);
    assert.deepEqual(o.statusHistory.map((h) => `${h.field}:${h.status}:${h.source}`), [
        'paymentStatus:pending:system', 'paymentStatus:paid:webhook', 'shopifySyncStatus:pending:webhook',
    ]);
});

test('webhook: the body is never trusted — a forged SUCCESS does nothing while Fastrr says INITIATED', async () => {
    const { orderId, order } = await checkedOut();
    const forged = placedOrder(order.fastrrOrderId, { items: [{ variantId: V1, quantity: 2 }], subtotal: 2998 });
    const r = await webhook(forged);
    assert.equal(r.result, 'pending');
    assert.equal(orderOf(orderId).paymentStatus, 'pending');
    assert.equal(mock.callsTo(DETAILS).length, 1); // we asked Fastrr
});

test('webhook: repeat delivery after confirmation is a no-op without another Fastrr call', async () => {
    const { orderId, order } = await checkedOut();
    pay(order);
    await webhook({ order_id: order.fastrrOrderId });
    const before = mock.callsTo(DETAILS).length;
    const r = await webhook({ order_id: order.fastrrOrderId });
    assert.equal(r.duplicate, true);
    assert.equal(mock.callsTo(DETAILS).length, before);
    assert.equal(orderOf(orderId).statusHistory.filter((h) => h.status === 'paid').length, 1);
});

test('webhook: COD -> cod_pending (order placed, nothing paid yet)', async () => {
    const { orderId, order } = await checkedOut();
    pay(order, { cod: true, codCharges: 50 });
    await webhook({ platform_order_id: order.fastrrOrderId });
    const o = orderOf(orderId);
    assert.equal(o.paymentStatus, 'cod_pending');
    assert.equal(o.paymentMethod, 'cod');
    assert.equal(o.pricing.codCharges, 5000);
    assert.equal(o.pricing.total, 299800 + 5000);
    assert.equal(o.payment, undefined);
    assert.equal(o.shopifySyncStatus, 'pending');
});

test('webhook: paid but amount / items differ -> payment recorded, order held for review (not sent to Shopify)', async () => {
    const { orderId, order } = await checkedOut();
    mock.state.orders.set(order.fastrrOrderId, placedOrder(order.fastrrOrderId, { items: [{ variantId: V1, quantity: 2 }], subtotal: 1 }));
    await webhook({ order_id: order.fastrrOrderId });
    const o = orderOf(orderId);
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(o.review.needed, true);
    assert.match(o.review.reasons[0], /^SUBTOTAL_MISMATCH/);
    assert.equal(o.shopifySyncStatus, 'needs_attention');
});

test('webhook: payment failed -> failed; a later successful retry still confirms the order', async () => {
    const { orderId, order } = await checkedOut();
    mock.state.orders.set(order.fastrrOrderId, fastrrOrder(order.fastrrOrderId, { status: 'FAILED' }));
    await webhook({ order_id: order.fastrrOrderId });
    assert.equal(orderOf(orderId).paymentStatus, 'failed');
    pay(order);
    await webhook({ order_id: order.fastrrOrderId });
    assert.equal(orderOf(orderId).paymentStatus, 'paid');
});

test('webhook: unknown order is ignored without calling Fastrr; malformed id -> 400', async () => {
    assert.deepEqual(await webhook({ order_id: 'aaaaaaaaaaaaaaaaaaaaaaaa' }), { ignored: 'unknown order' });
    for (const bad of [{}, { order_id: '' }, { order_id: { $gt: '' } }, { order_id: '../../x' }, null]) {
        assert.equal((await webhook(bad)).httpStatus, 400);
    }
    assert.equal(mock.callsTo(DETAILS).length, 0);
});

test('webhook: Fastrr unreachable during fetch-back -> throws (route answers 500 so Fastrr retries)', async () => {
    const { orderId, order } = await checkedOut();
    for (let i = 0; i < 3; i++) mock.state.next.push({ path: DETAILS, status: 500, body: {} });
    await assert.rejects(webhook({ order_id: order.fastrrOrderId }));
    assert.equal(orderOf(orderId).paymentStatus, 'pending');
});

test('webhook: two completed Fastrr checkouts for one order -> second flagged for refund, never double-confirmed', async () => {
    const user = newUser();
    setCart(user, [[V1, 1, 149900]]);
    const key = newKey();
    mock.state.tokenTtlMs = 60 * 1000;
    const { orderId } = await start(user, key);
    mock.state.tokenTtlMs = 30 * 60 * 1000;
    await start(user, key); // refreshed token -> second Fastrr order
    const o = orderOf(orderId);
    const [first, second] = o.fastrrOrderIds;
    pay(o, { fastrrOrderId: second });
    pay(o, { fastrrOrderId: first });

    assert.equal((await webhook({ order_id: second })).result, 'paid');
    assert.equal((await webhook({ order_id: first })).result, 'duplicate_payment');
    const after = orderOf(orderId);
    assert.equal(after.paidFastrrOrderId, second);
    assert.equal(after.review.needed, true);
    assert.deepEqual(after.review.reasons, [`DUPLICATE_PAYMENT:${first}`]);
    assert.equal(after.statusHistory.filter((h) => h.status === 'paid').length, 1);
    await webhook({ order_id: first }); // repeated: reason not duplicated
    assert.equal(orderOf(orderId).review.reasons.length, 1);
});

test('webhook: failure of an OLD token does not fail an order whose new token is live', async () => {
    const user = newUser();
    setCart(user, [[V1, 1, 149900]]);
    const key = newKey();
    mock.state.tokenTtlMs = 60 * 1000;
    const { orderId } = await start(user, key);
    mock.state.tokenTtlMs = 30 * 60 * 1000;
    await start(user, key);
    const [first] = orderOf(orderId).fastrrOrderIds;
    mock.state.orders.set(first, fastrrOrder(first, { status: 'FAILED' }));
    assert.equal((await webhook({ order_id: first })).result, 'ignored_stale_failure');
    assert.equal(orderOf(orderId).paymentStatus, 'pending');
});

test('race: webhook x3 + app poll + cron at the same moment -> exactly one confirmation', async () => {
    const { orderId, order } = await checkedOut();
    pay(order);
    orders.raw({ internalOrderId: orderId }).createdAt = new Date(Date.now() - 20 * 60 * 1000); // cron-eligible
    await Promise.all([
        webhook({ order_id: order.fastrrOrderId }),
        webhook({ order_id: order.fastrrOrderId }),
        webhook({ order_id: order.fastrrOrderId }),
        orderService.getOrder(order.user, orderId),
        fastrrOrderService.reconcile({ log: () => {} }),
    ]);
    const o = orderOf(orderId);
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(o.statusHistory.filter((h) => h.status === 'paid').length, 1);
    assert.equal(o.statusHistory.filter((h) => h.field === 'shopifySyncStatus').length, 1);
});

// ── Reconciliation cron ────────────────────────────────────────────────────

const ago = (ms) => new Date(Date.now() - ms);
const MIN = 60 * 1000;

test('reconcile: confirms missed payments, expires abandoned checkouts, leaves fresh / leased ones alone', async () => {
    const make = async (items) => (await checkedOut(items)).orderId;
    const missedWebhook = await make([[V1, 1, 149900]]);
    const abandoned = await make([[V1, 1, 149900]]);
    const fresh = await make([[V1, 1, 149900]]);
    const tokenless = await make([[V9, 1, 9900]]);
    const leased = await make([[V9, 2, 9900]]);
    const lateExpired = await make([[V9, 3, 9900]]);
    const veryOld = await make([[V9, 4, 9900]]);

    const set = (id, fields) => Object.assign(orders.raw({ internalOrderId: id }), fields);
    set(missedWebhook, { createdAt: ago(20 * MIN) });
    pay(orderOf(missedWebhook));
    set(abandoned, { createdAt: ago(60 * MIN), fastrrTokenExpiresAt: ago(20 * MIN) });
    set(fresh, { createdAt: ago(5 * MIN) });
    set(tokenless, { createdAt: ago(40 * MIN), fastrrToken: undefined, fastrrTokenExpiresAt: undefined, fastrrOrderIds: [], fastrrOrderId: undefined });
    set(leased, { createdAt: ago(60 * MIN), fastrrTokenExpiresAt: ago(20 * MIN), tokenLeaseUntil: new Date(Date.now() + 10_000) });
    set(lateExpired, { createdAt: ago(3 * 60 * MIN), paymentStatus: 'expired', updatedAt: ago(30 * MIN) });
    pay(orderOf(lateExpired));
    set(veryOld, { createdAt: ago(72 * 60 * MIN), fastrrTokenExpiresAt: ago(71 * 60 * MIN) });

    const stats = await fastrrOrderService.reconcile({ log: () => {} });

    assert.equal(orderOf(missedWebhook).paymentStatus, 'paid');
    assert.equal(orderOf(missedWebhook).statusHistory.at(-2).source, 'reconciliation');
    assert.equal(orderOf(abandoned).paymentStatus, 'expired');
    assert.equal(orderOf(fresh).paymentStatus, 'pending');
    assert.equal(orderOf(tokenless).paymentStatus, 'expired');
    assert.equal(orderOf(leased).paymentStatus, 'pending');       // someone is fetching a token right now
    assert.equal(orderOf(lateExpired).paymentStatus, 'paid');     // late payment rescued
    assert.equal(orderOf(veryOld).paymentStatus, 'pending');      // outside the 48h window
    assert.equal(stats.confirmed, 2);
    assert.equal(stats.expired, 2);
    assert.equal(stats.errors, 0);
    assert.equal(mock.callsTo(DETAILS).some((c) => c.body.order_id === orderOf(fresh).fastrrOrderId), false);
});

test('reconcile: a token refreshed after the cron read the order keeps it alive', async () => {
    const { orderId } = await checkedOut();
    Object.assign(orders.raw({ internalOrderId: orderId }), { createdAt: ago(60 * MIN), fastrrTokenExpiresAt: ago(20 * MIN) });
    // Fastrr answers slowly; meanwhile the user re-opens checkout and gets a fresh token.
    mock.state.next.push({ path: DETAILS, delayMs: 100, body: { ok: true, result: fastrrOrder(orderOf(orderId).fastrrOrderId) } });
    const run = fastrrOrderService.reconcile({ log: () => {} });
    await new Promise((r) => setTimeout(r, 30));
    orders.raw({ internalOrderId: orderId }).fastrrTokenExpiresAt = new Date(Date.now() + 30 * MIN);
    await run;
    assert.equal(orderOf(orderId).paymentStatus, 'pending');
});

test('reconcile: repairs a confirmed order whose Shopify sync never started; skips review-flagged ones', async () => {
    const a = await checkedOut();
    const b = await checkedOut();
    Object.assign(orders.raw({ internalOrderId: a.orderId }), { paymentStatus: 'paid' });
    Object.assign(orders.raw({ internalOrderId: b.orderId }), { paymentStatus: 'paid', review: { needed: true, reasons: ['X'] } });
    const stats = await fastrrOrderService.reconcile({ log: () => {} });
    assert.equal(stats.repaired, 1);
    assert.equal(orderOf(a.orderId).shopifySyncStatus, 'pending');
    assert.equal(orderOf(b.orderId).shopifySyncStatus, 'not_started');
});

test('reconcile: one bad order does not stop the batch', async () => {
    const bad = await checkedOut();
    const good = await checkedOut();
    for (const x of [bad, good]) orders.raw({ internalOrderId: x.orderId }).createdAt = ago(20 * MIN);
    mock.state.orders.delete(bad.order.fastrrOrderId); // Fastrr: "order not found"
    pay(good.order);
    const stats = await fastrrOrderService.reconcile({ log: () => {} });
    assert.equal(stats.errors, 1);
    assert.equal(orderOf(good.orderId).paymentStatus, 'paid');
});

// ── Orders API (app) ───────────────────────────────────────────────────────

test('orders: poll asks Fastrr at most once per 10s; order is visible only to its owner', async () => {
    const { user, orderId, order } = await checkedOut();
    const v1 = await orderService.getOrder(user, orderId);
    assert.equal(v1.status, 'awaiting_payment');
    await orderService.getOrder(user, orderId);
    await orderService.getOrder(user, orderId);
    assert.equal(mock.callsTo(DETAILS).length, 1);

    pay(order);
    orders.raw({ internalOrderId: orderId }).fastrrCheckedAt = ago(11 * 1000);
    const v2 = await orderService.getOrder(user, orderId);
    assert.equal(v2.status, 'confirmed');
    assert.equal(v2.total.paise, 299800);

    await rejectsCode(orderService.getOrder(newUser(), orderId), 'ORDER_NOT_FOUND', 404);
    await rejectsCode(orderService.getOrder(user, 'not-an-id'), 'ORDER_NOT_FOUND', 404);
});

test('orders: poll still answers when Fastrr is down', async () => {
    const { user, orderId } = await checkedOut();
    for (let i = 0; i < 3; i++) mock.state.next.push({ path: DETAILS, status: 500, body: {} });
    assert.equal((await orderService.getOrder(user, orderId)).status, 'awaiting_payment');
});

test('orders: list shows only placed orders, newest first, with cursor paging', async () => {
    const user = newUser();
    const placed = [];
    for (let i = 0; i < 5; i++) {
        setCart(user, [[V9, i + 1, 9900]]);
        const r = await start(user);
        const raw = orders.raw({ internalOrderId: r.orderId });
        raw.createdAt = ago((10 - i) * MIN);
        if (i !== 2) { raw.paymentStatus = i % 2 ? 'cod_pending' : 'paid'; placed.push(r.orderId); }
    }
    const other = newUser();
    setCart(other, [[V9, 1, 9900]]);
    orders.raw({ internalOrderId: (await start(other)).orderId }).paymentStatus = 'paid';

    const p1 = await orderService.listOrders(user, { limit: 3 });
    assert.equal(p1.items.length, 3);
    assert.ok(p1.nextCursor);
    const p2 = await orderService.listOrders(user, { limit: 3, cursor: p1.nextCursor });
    assert.equal(p2.nextCursor, null);
    assert.deepEqual([...p1.items, ...p2.items].map((o) => o.orderId), [...placed].reverse());
    await rejectsCode(orderService.listOrders(user, { cursor: 'garbage' }), 'INVALID_CURSOR', 400);
});

// ── WebView pages ──────────────────────────────────────────────────────────

const pageParams = (url) => Object.fromEntries(new URL(url).searchParams);

test('page: signed link renders Fastrr checkout with the token; bad / expired / foreign links get 403', async () => {
    const user = newUser();
    setCart(user, [[V1, 1, 149900]]);
    const r = await start(user);
    const { exp, sig } = pageParams(r.checkoutPageUrl);

    const ok = await checkoutService.checkoutPage({ orderId: r.orderId, exp, sig, baseUrl: BASE });
    assert.equal(ok.status, 200);
    assert.ok(ok.html.includes('"tok_1"'));
    assert.ok(ok.html.includes('https://checkout-ui.shiprocket.com/assets/js/channels/shopify.js') || ok.html.includes('/assets/js/channels/shopify.js'));
    assert.ok(ok.html.includes(`${BASE}/api/shop/checkout/${r.orderId}/return?fallback=1`)); // fallback stays in our app
    assert.ok(ok.html.includes('₹1499.00'));

    for (const [o, e, s] of [[r.orderId, exp, `${sig}x`], [r.orderId, String(Number(exp) + 1), sig], [r.orderId, '1', sig], ['TH-261115-ZZZZZZZZ', exp, sig], ['../x', exp, sig]]) {
        const bad = await checkoutService.checkoutPage({ orderId: o, exp: e, sig: s, baseUrl: BASE });
        assert.equal(bad.status, 403);
        assert.equal(bad.html.includes('tok_'), false);
    }
});

test('page: expired Fastrr token is refreshed when the page opens; finished orders bounce to the app', async () => {
    const user = newUser();
    setCart(user, [[V1, 1, 149900]]);
    const r = await start(user);
    const { exp, sig } = pageParams(r.checkoutPageUrl);
    orders.raw({ internalOrderId: r.orderId }).fastrrTokenExpiresAt = ago(MIN);
    const page = await checkoutService.checkoutPage({ orderId: r.orderId, exp, sig, baseUrl: BASE });
    assert.ok(page.html.includes('"tok_2"'));

    pay(orderOf(r.orderId));
    await webhook({ order_id: orderOf(r.orderId).fastrrOrderId });
    const done = await checkoutService.checkoutPage({ orderId: r.orderId, exp, sig, baseUrl: BASE });
    assert.equal(done.html.includes('tok_'), false);
    assert.ok(done.html.includes(`takehealth://shop/order/${r.orderId}?status=confirmed`));
});

test('page: Fastrr down while refreshing -> friendly 503 page, no token leaked', async () => {
    const user = newUser();
    setCart(user, [[V1, 1, 149900]]);
    const r = await start(user);
    const { exp, sig } = pageParams(r.checkoutPageUrl);
    orders.raw({ internalOrderId: r.orderId }).fastrrTokenExpiresAt = ago(MIN);
    mock.state.next.push({ path: TOKEN, status: 500, body: {} }, { path: TOKEN, status: 500, body: {} });
    const page = await checkoutService.checkoutPage({ orderId: r.orderId, exp, sig, baseUrl: BASE });
    assert.equal(page.status, 503);
    assert.equal(page.html.includes('tok_'), false);
});

test('return: Fastrr\'s ost=SUCCESS is not trusted — the deep link carries OUR status', async () => {
    const { orderId, order } = await checkedOut();
    const lied = await checkoutService.checkoutReturn({ orderId, oid: order.fastrrOrderId, ost: 'SUCCESS' });
    assert.ok(lied.html.includes(`takehealth://shop/order/${orderId}?status=awaiting_payment`));

    orders.raw({ internalOrderId: orderId }).fastrrCheckedAt = ago(MIN);
    pay(order);
    const real = await checkoutService.checkoutReturn({ orderId, oid: order.fastrrOrderId });
    assert.ok(real.html.includes(`takehealth://shop/order/${orderId}?status=confirmed`));
    assert.equal(orderOf(orderId).paymentStatus, 'paid');

    assert.equal((await checkoutService.checkoutReturn({ orderId: 'nope' })).status, 404);
    // a foreign oid is not used to query Fastrr
    const { orderId: o2 } = await checkedOut();
    const before = mock.callsTo(DETAILS).length;
    await checkoutService.checkoutReturn({ orderId: o2, oid: 'someone-elses-order' });
    assert.ok(mock.callsTo(DETAILS).every((c, i) => i < before || c.body.order_id === orderOf(o2).fastrrOrderId));
});

// ── Catalog push ───────────────────────────────────────────────────────────

test('catalog push: written product goes to Fastrr (subscribe variants hidden, options included); stale / failures are safe', async () => {
    assert.equal(await catalogSyncService.pushToFastrr({ kind: 'product', id: '9001', result: 'written' }), 'pushed');
    const [call] = mock.callsTo('/wh/v1/custom/product');
    assert.equal(call.body.id, 9001);
    assert.deepEqual(call.body.variants.map((v) => v.id), [Number(V1), Number(V3)]);
    assert.deepEqual(call.body.options, [{ name: 'Pack', values: ['1 pack', '3 pack'] }, { name: 'Purchase', values: ['One-Time'] }]);

    assert.equal(await catalogSyncService.pushToFastrr({ kind: 'product', id: '9001', result: 'stale' }), 'skipped');
    mock.state.next.push({ path: '/wh/v1/custom/product', status: 500, body: {} });
    assert.equal(await catalogSyncService.pushToFastrr({ kind: 'product', id: '9001', result: 'written' }), 'failed');

    products.raw({ shopifyProductId: '9001' }).status = 'deleted';
    await catalogSyncService.pushToFastrr({ kind: 'product', id: '9001', result: 'deleted' });
    assert.equal(mock.callsTo('/wh/v1/custom/product').at(-1).body.status, 'draft');

    collections.seed({ shopifyCollectionId: '55', handle: 'all', title: 'All' });
    assert.equal(await catalogSyncService.pushToFastrr({ kind: 'collection', id: '55', result: 'written' }), 'pushed');
    assert.equal(await catalogSyncService.pushToFastrr({ kind: 'collection', id: '55', result: 'deleted' }), 'skipped');

    process.env.FASTRR_CATALOG_PUSH = 'false';
    try {
        assert.equal(await catalogSyncService.pushToFastrr({ kind: 'product', id: '9002', result: 'written' }), 'skipped');
    } finally {
        delete process.env.FASTRR_CATALOG_PUSH;
    }
});

// ── HTTP layer (real routes.js) ────────────────────────────────────────────

const call = async (method, p, { user, headers = {}, body } = {}) => {
    const res = await fetch(`${api}${p}`, {
        method,
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(user ? { Authorization: `Bearer ${user}` } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, json, text, headers: res.headers };
};

test('http: checkout via Idempotency-Key header, then poll, page and webhook through the real routes', async () => {
    const user = newUser();
    setCart(user, [[V1, 1, 149900]]);

    assert.equal((await call('POST', '/checkout', { headers: { 'Idempotency-Key': newKey() } })).status, 401);
    const noKey = await call('POST', '/checkout', { user });
    assert.equal(noKey.status, 400);
    assert.equal(noKey.json.code, 'IDEMPOTENCY_KEY_REQUIRED');

    const key = newKey();
    const r = await call('POST', '/checkout', { user, headers: { 'Idempotency-Key': key } });
    assert.equal(r.status, 200);
    const { orderId, checkoutPageUrl } = r.json;
    const again = await call('POST', '/checkout', { user, body: { idempotencyKey: key } }); // body form also accepted
    assert.equal(again.json.orderId, orderId);

    const pagePath = new URL(checkoutPageUrl).pathname.replace('/api/shop', '') + new URL(checkoutPageUrl).search;
    const page = await call('GET', pagePath);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
    assert.equal(page.headers.get('cache-control'), 'no-store, max-age=0');
    assert.equal(page.headers.get('referrer-policy'), 'no-referrer');

    const pending = await call('GET', `/orders/${orderId}`, { user });
    assert.equal(pending.json.status, 'awaiting_payment');
    assert.equal(pending.headers.get('cache-control'), 'no-store');

    pay(orderOf(orderId));
    const wh = await call('POST', '/fastrr/webhook', { body: { order_id: orderOf(orderId).fastrrOrderId, status: 'SUCCESS' } });
    assert.equal(wh.status, 200);
    assert.deepEqual(wh.json, { received: true });
    assert.equal((await call('GET', `/orders/${orderId}`, { user })).json.status, 'confirmed');
    assert.equal((await call('GET', '/orders', { user })).json.items[0].orderId, orderId);
    assert.equal((await call('GET', `/orders/${orderId}`, { user: newUser() })).status, 404);

    const ret = await call('GET', `/checkout/${orderId}/return?oid=x&ost=SUCCESS`);
    assert.equal(ret.status, 200);
    assert.ok(ret.text.includes('status=confirmed'));
});

test('http: webhook answers 200 (received:false) for garbage, 200 for unknown orders, 500 when the fetch-back fails', async () => {
    const garbage = await call('POST', '/fastrr/webhook', { body: { order_id: '<script>' } });
    assert.equal(garbage.status, 200);
    assert.equal(garbage.json.received, false);
    assert.equal((await call('POST', '/fastrr/webhook', { body: { order_id: 'bbbbbbbbbbbbbbbbbbbbbbbb' } })).status, 200);
    const { order } = await checkedOut();
    for (let i = 0; i < 3; i++) mock.state.next.push({ path: DETAILS, status: 500, body: {} });
    const r = await call('POST', '/fastrr/webhook', { body: { order_id: order.fastrrOrderId } });
    assert.equal(r.status, 500);
    assert.deepEqual(r.json, { received: false }); // no internals leaked
});

test('http: internal reconcile endpoint fails closed without a QStash signature', async () => {
    const { orderId } = await checkedOut();
    orders.raw({ internalOrderId: orderId }).createdAt = ago(60 * MIN);
    orders.raw({ internalOrderId: orderId }).fastrrTokenExpiresAt = ago(30 * MIN);
    const r = await call('POST', '/internal/reconcile-orders', { body: {} });
    assert.equal(r.status, 503); // QSTASH_CURRENT_SIGNING_KEY unset -> rejected before any work
    assert.equal(orderOf(orderId).paymentStatus, 'pending');
});

test('http: error responses keep the {code, message} contract', async () => {
    const user = newUser();
    const r = await call('POST', '/checkout', { user, headers: { 'Idempotency-Key': newKey() } });
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys(r.json).sort(), ['code', 'message']);
    assert.equal(r.json.code, 'CART_EMPTY');
});
