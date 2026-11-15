// One shopper ("Amish") going through the whole shop, step by step, through the
// REAL routes (modules/shop/routes.js) — catalog, cart, checkout, payment,
// orders — asserting the HTTP status and response body of every call.
// Only the DB (in-memory fake), Fastrr (local mock with HMAC check) and
// `protect` (header-based test user) are stand-ins.
//
// SHOP_JOURNEY_REPORT=<file.json> also writes every request/response to a file.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const mongoose = require('mongoose');
const express = require('express');

const { FakeCollection } = require('./helpers/fakeMongo');
const { startFastrrMock, placedOrder, fastrrOrder, API_KEY, API_SECRET } = require('./helpers/fastrrMock');

const ENV = {
    FASTRR_API_KEY: API_KEY, FASTRR_API_SECRET: API_SECRET, FASTRR_TIMEOUT_MS: '500',
    JWT_SECRET: 'test-jwt-secret', SHOP_PUBLIC_BASE_URL: 'https://shop.test',
    SHOP_APP_DEEP_LINK: undefined, SHOP_HIDE_SUBSCRIBE_VARIANTS: undefined, SHOP_CHECKOUT_PAGE_SECRET: undefined,
    SHOP_MAX_QTY_PER_ITEM: undefined, SHOP_MAX_CART_LINES: undefined,
    FASTRR_FALLBACK_URL: undefined, FASTRR_CHECKOUT_UI_URL: undefined, FASTRR_CATALOG_PUSH: undefined,
    QSTASH_CURRENT_SIGNING_KEY: undefined, REDIS_URL: undefined,
};
const savedEnv = {};

const authPath = require.resolve('../middleware/auth');
const savedAuth = require.cache[authPath];
require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true,
    exports: {
        protect: (req, res, next) => {
            const id = (req.headers.authorization || '').replace(/^Bearer /, '');
            if (!mongoose.isValidObjectId(id)) return res.status(401).json({ message: 'Not authorized, no token' });
            req.user = { _id: new mongoose.Types.ObjectId(id) };
            next();
        },
    },
};

const Order = require('../models/Order');
const Cart = require('../modules/shop/models/Cart');
const Product = require('../modules/shop/models/Product');
const Collection = require('../modules/shop/models/Collection');

const orders = new FakeCollection(Order, { unique: [['internalOrderId'], ['user', 'idempotencyKey']] });
const carts = new FakeCollection(Cart, { unique: [['user']] });
const products = new FakeCollection(Product, { unique: [['shopifyProductId']] });
const collections = new FakeCollection(Collection, { unique: [['shopifyCollectionId']] });
const restores = [];
let mock;
let server;
let api;

// ── Report ─────────────────────────────────────────────────────────────────
const report = [];
let phase = '';

const summarize = (res) => {
    if (res.json) {
        const s = JSON.stringify(res.json);
        return s.length > 700 ? `${s.slice(0, 700)}…` : s;
    }
    const title = /<title>([^<]*)<\/title>/.exec(res.text)?.[1];
    const deep = /takehealth:\/\/[^"'<\s]+/.exec(res.text)?.[0];
    return `HTML page "${title}"${deep ? ` -> ${deep}` : ''}${res.text.includes('HeadlessCheckout') ? ' (loads Fastrr checkout JS)' : ''}`;
};

const AMISH = new mongoose.Types.ObjectId().toString();
const RIYA = new mongoose.Types.ObjectId().toString();

/** One app action: call the API, record it, return { status, json, text, headers }. */
const act = async (action, method, path, { user = AMISH, headers = {}, body } = {}) => {
    const res = await fetch(`${api}${path}`, {
        method,
        headers: {
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            ...(user ? { Authorization: `Bearer ${user}` } : {}),
            ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* html */ }
    const out = { status: res.status, json, text, headers: res.headers };
    report.push({ phase, action, request: `${method} /api/shop${path}`, status: res.status, response: summarize(out) });
    return out;
};

const expectError = (r, status, code) => {
    assert.equal(r.status, status, `${r.status} ${r.text.slice(0, 200)}`);
    assert.equal(r.json.code, code);
    assert.equal(typeof r.json.message, 'string');
};

// ── Setup ──────────────────────────────────────────────────────────────────
const V1 = '57199514222897'; // Berberine 1 pack One-Time ₹1499 (stock 20)
const V2 = '57199514222898'; // Berberine 1 pack Subscribe ₹1349 (hidden)
const V3 = '57199514222899'; // Berberine 3 pack One-Time ₹4497 (stock 1)
const V9 = '777';            // Magnesium ₹99 (untracked)
const VD = '888';            // Draft product variant

test.before(async () => {
    for (const [k, v] of Object.entries(ENV)) {
        savedEnv[k] = process.env[k];
        if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    mock = await startFastrrMock();
    process.env.FASTRR_BASE_URL = mock.baseUrl;
    for (const c of [orders, carts, products, collections]) restores.push(c.install());

    collections.seed({ shopifyCollectionId: '501', handle: 'frontpage', title: 'Home page', imageUrl: null });
    collections.seed({ shopifyCollectionId: '502', handle: 'all-take-products', title: 'All Take Products' });
    const inFront = [{ shopifyCollectionId: '501', handle: 'frontpage', title: 'Home page' }];
    const inAll = [{ shopifyCollectionId: '502', handle: 'all-take-products', title: 'All Take Products' }];
    products.seed({
        shopifyProductId: '9001', handle: 'berberine', title: 'Berberine', status: 'active', vendor: 'Take',
        images: [{ url: 'https://cdn/berberine.jpg', alt: 'Berberine' }], collections: [...inFront, ...inAll],
        shopifyCreatedAt: new Date('2026-10-01'), shopifyUpdatedAt: new Date('2026-11-01'),
        variants: [
            { shopifyVariantId: V1, title: '1 pack / One-Time', sku: 'BRB-1', price: 149900, compareAtPrice: 179900, inventoryQty: 20, options: [{ name: 'Pack', value: '1 pack' }, { name: 'Purchase', value: 'One-Time' }] },
            { shopifyVariantId: V2, title: '1 pack / Subscribe', sku: 'BRB-1S', price: 134900, inventoryQty: 20, options: [{ name: 'Pack', value: '1 pack' }, { name: 'Purchase', value: 'Subscribe' }] },
            { shopifyVariantId: V3, title: '3 pack / One-Time', sku: 'BRB-3', price: 449700, inventoryQty: 1, options: [{ name: 'Pack', value: '3 pack' }, { name: 'Purchase', value: 'One-Time' }] },
        ],
        minPrice: 134900,
    });
    products.seed({
        shopifyProductId: '9002', handle: 'magnesium', title: 'Magnesium Glycinate', status: 'active', images: [],
        collections: inAll, shopifyCreatedAt: new Date('2026-09-01'),
        variants: [{ shopifyVariantId: V9, title: 'Default Title', price: 9900, inventoryTracked: false, inventoryQty: 0 }],
        minPrice: 9900,
    });
    products.seed({
        shopifyProductId: '9003', handle: 'second-product', title: 'Second product', status: 'draft', images: [],
        shopifyCreatedAt: new Date('2026-11-01'),
        variants: [{ shopifyVariantId: VD, title: 'Default Title', price: 50000, inventoryQty: 5 }],
        minPrice: 50000,
    });

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
    if (process.env.SHOP_JOURNEY_REPORT) fs.writeFileSync(process.env.SHOP_JOURNEY_REPORT, JSON.stringify(report, null, 2));
});

// Shared journey state
let orderId;
let pageUrl;
const key1 = 'amish-checkout-0001';

// ── 1. Browsing ────────────────────────────────────────────────────────────
test('1. Amish browses the shop', async () => {
    phase = '1. Browsing';
    let r = await act('Opens the shop (product list)', 'GET', '/products', { user: null });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.items.map((p) => p.handle), ['berberine', 'magnesium']); // draft hidden, newest first
    assert.equal(r.json.items[0].minPrice.rupees, 1499); // not the hidden ₹1349 subscribe price
    assert.equal(r.json.nextCursor, null);

    r = await act('Searches "berb"', 'GET', '/products?q=berb', { user: null });
    assert.deepEqual(r.json.items.map((p) => p.handle), ['berberine']);

    r = await act('Searches something that does not exist', 'GET', '/products?q=xyz', { user: null });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { items: [], nextCursor: null });

    r = await act('Scrolls: first page of 1', 'GET', '/products?limit=1', { user: null });
    assert.equal(r.json.items.length, 1);
    assert.ok(r.json.nextCursor);
    r = await act('Scrolls: next page', 'GET', `/products?limit=1&cursor=${r.json.nextCursor}`, { user: null });
    assert.deepEqual(r.json.items.map((p) => p.handle), ['magnesium']);

    r = await act('App sends a broken cursor', 'GET', '/products?cursor=garbage', { user: null });
    expectError(r, 400, 'INVALID_CURSOR');

    r = await act('Home screen sections (collections)', 'GET', '/collections', { user: null });
    assert.deepEqual(r.json.items.map((c) => c.handle), ['all-take-products', 'frontpage']);
    for (const c of r.json.items) assert.deepEqual(Object.keys(c).sort(), ['descriptionHtml', 'handle', 'id', 'imageUrl', 'title']);

    r = await act('"Featured" section (frontpage collection)', 'GET', '/products?collection=frontpage', { user: null });
    assert.deepEqual(r.json.items.map((p) => p.handle), ['berberine']);

    r = await act('Unknown collection', 'GET', '/products?collection=nope', { user: null });
    assert.deepEqual(r.json, { items: [], nextCursor: null });

    r = await act('Opens Berberine', 'GET', '/products/berberine', { user: null });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.variants.map((v) => v.id), [V1, V3]); // Subscribe hidden
    for (const k of ['descriptionHtml', 'vendor', 'productType', 'tags', 'images', 'collections']) assert.ok(k in r.json, k);
    assert.equal(r.json.variants[0].compareAtPrice.rupees, 1799);
    assert.equal(r.json.variants[0].inStock, true);

    r = await act('Opens a draft product by link', 'GET', '/products/second-product', { user: null });
    expectError(r, 404, 'PRODUCT_NOT_FOUND');
    r = await act('Opens a product that does not exist', 'GET', '/products/nothing-here', { user: null });
    expectError(r, 404, 'PRODUCT_NOT_FOUND');
});

// ── 2. Cart ────────────────────────────────────────────────────────────────
test('2. Amish fills his cart', async () => {
    phase = '2. Cart';
    let r = await act('Opens cart without logging in', 'GET', '/cart', { user: null });
    assert.equal(r.status, 401);

    r = await act('Opens cart (empty)', 'GET', '/cart');
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.lines, []);
    assert.equal(r.json.summary.checkoutAllowed, false);

    r = await act('Adds Berberine 1 pack x2', 'POST', '/cart/items', { body: { variantId: V1, quantity: 2 } });
    assert.equal(r.status, 200);
    assert.equal(r.json.lines[0].quantity, 2);
    assert.equal(r.json.summary.subtotal.rupees, 2998);
    assert.equal(r.json.summary.checkoutAllowed, true);

    r = await act('Taps "Add" again (+1, merges into same line)', 'POST', '/cart/items', { body: { variantId: V1, quantity: 1 } });
    assert.equal(r.json.lines.length, 1);
    assert.equal(r.json.lines[0].quantity, 3);

    r = await act('Tries the Subscribe variant (old app version / deep link)', 'POST', '/cart/items', { body: { variantId: V2, quantity: 1 } });
    expectError(r, 404, 'PRODUCT_UNAVAILABLE');

    r = await act('Tries a draft product', 'POST', '/cart/items', { body: { variantId: VD, quantity: 1 } });
    expectError(r, 404, 'PRODUCT_UNAVAILABLE');

    r = await act('Quantity 11 (max is 10)', 'POST', '/cart/items', { body: { variantId: V9, quantity: 11 } });
    expectError(r, 400, 'INVALID_QUANTITY');
    assert.equal(r.json.maxQty, 10);

    r = await act('Quantity 0', 'POST', '/cart/items', { body: { variantId: V9, quantity: 0 } });
    expectError(r, 400, 'INVALID_QUANTITY');

    r = await act('Quantity "abc"', 'POST', '/cart/items', { body: { variantId: V9, quantity: 'abc' } });
    expectError(r, 400, 'INVALID_QUANTITY');

    r = await act('No variantId', 'POST', '/cart/items', { body: { quantity: 1 } });
    expectError(r, 400, 'VARIANT_REQUIRED');

    r = await act('Adds 8 more of Berberine (3 + 8 > 10)', 'POST', '/cart/items', { body: { variantId: V1, quantity: 8 } });
    expectError(r, 409, 'MAX_QTY_REACHED');

    r = await act('Adds 3 pack x2 (only 1 in stock)', 'POST', '/cart/items', { body: { variantId: V3, quantity: 2 } });
    expectError(r, 409, 'INSUFFICIENT_STOCK');
    assert.equal(r.json.availableQty, 1);

    r = await act('Adds Magnesium x1', 'POST', '/cart/items', { body: { variantId: V9, quantity: 1 } });
    assert.equal(r.json.lines.length, 2);

    r = await act('Changes Berberine qty to 2', 'PATCH', `/cart/items/${V1}`, { body: { quantity: 2 } });
    assert.equal(r.status, 200);
    assert.equal(r.json.lines.find((l) => l.variantId === V1).quantity, 2);

    r = await act('Changes qty of an item not in cart', 'PATCH', `/cart/items/${V3}`, { body: { quantity: 1 } });
    expectError(r, 404, 'ITEM_NOT_IN_CART');

    r = await act('Removes Magnesium', 'DELETE', `/cart/items/${V9}`);
    assert.equal(r.status, 200);
    assert.equal(r.json.lines.length, 1);

    r = await act('Removes Magnesium again (double tap)', 'DELETE', `/cart/items/${V9}`);
    assert.equal(r.status, 200); // idempotent

    r = await act('Adds Magnesium back, then sets qty 0 (= remove)', 'POST', '/cart/items', { body: { variantId: V9, quantity: 1 } });
    r = await act('Sets Magnesium qty 0', 'PATCH', `/cart/items/${V9}`, { body: { quantity: 0 } });
    assert.deepEqual(r.json.lines.map((l) => l.variantId), [V1]);

    // Shopify price change while Amish is shopping
    products.raw({ shopifyProductId: '9001' }).variants[0].price = 159900;
    r = await act('Opens cart after Berberine price went ₹1499 -> ₹1599', 'GET', '/cart');
    assert.equal(r.json.lines[0].priceChanged, true);
    assert.equal(r.json.lines[0].previousPrice.rupees, 1499);
    assert.equal(r.json.lines[0].unitPrice.rupees, 1599);
    r = await act('Opens cart again (change already shown once)', 'GET', '/cart');
    assert.equal(r.json.lines[0].priceChanged, false);
    products.raw({ shopifyProductId: '9001' }).variants[0].price = 149900;
    await act('Price back to ₹1499 — opens cart (shown once)', 'GET', '/cart');
});

// ── 3. Checkout ────────────────────────────────────────────────────────────
test('3. Amish checks out', async () => {
    phase = '3. Checkout';
    let r = await act('App bug: no Idempotency-Key', 'POST', '/checkout');
    expectError(r, 400, 'IDEMPOTENCY_KEY_REQUIRED');

    // Price changes between "open cart" and "checkout" — he must see it first.
    products.raw({ shopifyProductId: '9001' }).variants[0].price = 159900;
    r = await act('Taps Checkout, price changed since he last saw the cart', 'POST', '/checkout', { headers: { 'Idempotency-Key': 'amish-checkout-0000' } });
    expectError(r, 409, 'PRICE_CHANGED');
    assert.equal(r.json.cart.lines[0].previousPrice.rupees, 1499);
    assert.equal(orders.docs.length, 0);
    products.raw({ shopifyProductId: '9001' }).variants[0].price = 149900;
    await act('Sees the cart again (price back to ₹1499)', 'GET', '/cart');

    r = await act('Taps Checkout', 'POST', '/checkout', { headers: { 'Idempotency-Key': key1 } });
    assert.equal(r.status, 200, r.text);
    ({ orderId } = r.json);
    pageUrl = r.json.checkoutPageUrl;
    assert.match(orderId, /^TH-\d{6}-[0-9A-Z]{8}$/);
    assert.equal(r.json.status, 'awaiting_payment');
    assert.equal(r.json.amount.rupees, 2998);
    assert.equal(orders.docs.length, 1);
    assert.equal(mock.callsTo('/api/v1/access-token/checkout').length, 1);

    r = await act('Double-taps Checkout (same key)', 'POST', '/checkout', { headers: { 'Idempotency-Key': key1 } });
    assert.equal(r.status, 200);
    assert.equal(r.json.orderId, orderId);
    assert.equal(orders.docs.length, 1);
    assert.equal(mock.callsTo('/api/v1/access-token/checkout').length, 1);

    const pagePath = (u) => { const x = new URL(u); return x.pathname.replace('/api/shop', '') + x.search; };
    r = await act('App opens the payment page in WebView', 'GET', pagePath(pageUrl), { user: null });
    assert.equal(r.status, 200);
    assert.ok(r.text.includes('HeadlessCheckout'));
    assert.equal(r.headers.get('cache-control'), 'no-store, max-age=0');

    r = await act('Someone tampers with the page link', 'GET', pagePath(pageUrl).replace(/sig=./, 'sig=X'), { user: null });
    assert.equal(r.status, 403);

    r = await act('While paying, app checks order status', 'GET', `/orders/${orderId}`);
    assert.equal(r.status, 200);
    assert.equal(r.json.status, 'awaiting_payment');

    r = await act('My Orders (unpaid checkout is not an order yet)', 'GET', '/orders');
    assert.deepEqual(r.json, { items: [], nextCursor: null });
});

// ── 4. Payment ─────────────────────────────────────────────────────────────
test('4. Amish pays by UPI on Fastrr', async () => {
    phase = '4. Payment';
    const o = orders.raw({ internalOrderId: orderId });
    // Fastrr side: Amish entered phone + address and paid ₹2998 by UPI.
    mock.state.orders.set(o.fastrrOrderId, placedOrder(o.fastrrOrderId, { items: [{ variantId: V1, quantity: 2 }], subtotal: 2998 }));

    let r = await act('Attacker posts a fake webhook body', 'POST', '/fastrr/webhook', { user: null, body: { order_id: '<script>', status: 'SUCCESS' } });
    assert.equal(r.status, 400);
    assert.deepEqual(r.json, { received: false, code: 'INVALID_ORDER_ID', message: 'order_id is missing or malformed' });

    r = await act('Fastrr webhook: order placed', 'POST', '/fastrr/webhook', { user: null, body: { order_id: o.fastrrOrderId, status: 'SUCCESS' } });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { received: true });

    r = await act('Fastrr sends the same webhook again', 'POST', '/fastrr/webhook', { user: null, body: { order_id: o.fastrrOrderId, status: 'SUCCESS' } });
    assert.equal(r.status, 200);

    r = await act('Fastrr redirects WebView back (ost=SUCCESS)', 'GET', `/checkout/${orderId}/return?oid=${o.fastrrOrderId}&ost=SUCCESS`, { user: null });
    assert.equal(r.status, 200);
    assert.ok(r.text.includes(`takehealth://shop/order/${orderId}?status=confirmed`));

    r = await act('App polls the order after WebView closes', 'GET', `/orders/${orderId}`);
    assert.equal(r.json.status, 'confirmed');
    assert.equal(r.json.paymentMethod, 'prepaid');
    assert.equal(r.json.total.rupees, 2998);
    assert.equal(r.json.shippingAddress.city, 'Pune');

    const saved = orders.raw({ internalOrderId: orderId });
    assert.equal(saved.paymentStatus, 'paid');
    assert.equal(saved.shopifySyncStatus, 'pending'); // M3 will create the Shopify order
    assert.equal(saved.payment.pgTransactionId, 'pay_ABC');

    r = await act('Opens cart: bought items are gone', 'GET', '/cart');
    assert.deepEqual(r.json.lines, []);

    r = await act('My Orders', 'GET', '/orders');
    assert.deepEqual(r.json.items.map((x) => [x.orderId, x.status]), [[orderId, 'confirmed']]);

    r = await act('App retries the old checkout request', 'POST', '/checkout', { headers: { 'Idempotency-Key': key1 } });
    expectError(r, 409, 'ORDER_ALREADY_PLACED');
    assert.equal(r.json.orderId, orderId);

    r = await act('Re-opens the old payment link', 'GET', new URL(pageUrl).pathname.replace('/api/shop', '') + new URL(pageUrl).search, { user: null });
    assert.ok(r.text.includes('status=confirmed'));
    assert.equal(r.text.includes('HeadlessCheckout'), false);

    r = await act('Riya tries to open Amish\'s order', 'GET', `/orders/${orderId}`, { user: RIYA });
    expectError(r, 404, 'ORDER_NOT_FOUND');
});

// ── 5. Second order: COD, then problems ───────────────────────────────────
test('5. Amish orders again with COD, and hits the edge cases', async () => {
    phase = '5. COD + edge cases';
    let r = await act('Checkout with empty cart', 'POST', '/checkout', { headers: { 'Idempotency-Key': 'amish-checkout-0002' } });
    expectError(r, 400, 'CART_EMPTY');

    await act('Adds 3 pack x1 (last one in stock)', 'POST', '/cart/items', { body: { variantId: V3, quantity: 1 } });
    products.raw({ shopifyProductId: '9001' }).variants[2].inventoryQty = 0; // sold on the website meanwhile
    r = await act('Checkout after the last 3 pack sold on the website', 'POST', '/checkout', { headers: { 'Idempotency-Key': 'amish-checkout-0003' } });
    expectError(r, 409, 'CART_HAS_ISSUES');
    assert.equal(r.json.cart.lines[0].issue, 'OUT_OF_STOCK');
    await act('Removes the 3 pack', 'DELETE', `/cart/items/${V3}`);

    await act('Adds Magnesium x2', 'POST', '/cart/items', { body: { variantId: V9, quantity: 2 } });

    mock.state.next.push({ path: '/api/v1/access-token/checkout', status: 503, body: {} }, { path: '/api/v1/access-token/checkout', status: 503, body: {} });
    r = await act('Checkout while Fastrr is down', 'POST', '/checkout', { headers: { 'Idempotency-Key': 'amish-checkout-0004' } });
    expectError(r, 502, 'CHECKOUT_PROVIDER_ERROR');
    assert.equal(r.json.retryable, true);

    r = await act('Retries (same key) once Fastrr is back', 'POST', '/checkout', { headers: { 'Idempotency-Key': 'amish-checkout-0004' } });
    assert.equal(r.status, 200);
    const codOrderId = r.json.orderId;

    await act('Adds Berberine to cart while checkout is open', 'POST', '/cart/items', { body: { variantId: V1, quantity: 1 } });
    r = await act('Same key but the cart changed', 'POST', '/checkout', { headers: { 'Idempotency-Key': 'amish-checkout-0004' } });
    expectError(r, 409, 'IDEMPOTENCY_KEY_REUSED');

    const o = orders.raw({ internalOrderId: codOrderId });
    mock.state.orders.set(o.fastrrOrderId, placedOrder(o.fastrrOrderId, { items: [{ variantId: V9, quantity: 2 }], subtotal: 198, cod: true, codCharges: 50 }));
    r = await act('Pays by COD — Fastrr webhook', 'POST', '/fastrr/webhook', { user: null, body: { order_id: o.fastrrOrderId } });
    assert.equal(r.status, 200);

    r = await act('Order detail (COD)', 'GET', `/orders/${codOrderId}`);
    assert.equal(r.json.status, 'confirmed');
    assert.equal(r.json.paymentMethod, 'cod');
    assert.equal(r.json.pricing.codCharges.rupees, 50);
    assert.equal(r.json.total.rupees, 248);

    r = await act('Cart keeps the Berberine he added later', 'GET', '/cart');
    assert.deepEqual(r.json.lines.map((l) => l.variantId), [V1]);

    r = await act('My Orders (2 orders, newest first)', 'GET', '/orders');
    assert.deepEqual(r.json.items.map((x) => x.orderId), [codOrderId, orderId]);
});

// ── 6. Payment fails, then succeeds ───────────────────────────────────────
test('6. Amish\'s UPI fails, he retries and it works', async () => {
    phase = '6. Failed payment';
    let r = await act('Checkout (Berberine x1)', 'POST', '/checkout', { headers: { 'Idempotency-Key': 'amish-checkout-0005' } });
    const id = r.json.orderId;
    const o = orders.raw({ internalOrderId: id });

    mock.state.orders.set(o.fastrrOrderId, fastrrOrder(o.fastrrOrderId, { status: 'FAILED' }));
    r = await act('Fastrr webhook: payment failed', 'POST', '/fastrr/webhook', { user: null, body: { order_id: o.fastrrOrderId } });
    assert.equal(r.status, 200);
    r = await act('Order status', 'GET', `/orders/${id}`);
    assert.equal(r.json.status, 'payment_failed');

    mock.state.orders.set(o.fastrrOrderId, placedOrder(o.fastrrOrderId, { items: [{ variantId: V1, quantity: 1 }], subtotal: 1499 }));
    r = await act('Retries in the same Fastrr page, pays — webhook', 'POST', '/fastrr/webhook', { user: null, body: { order_id: o.fastrrOrderId } });
    r = await act('Order status', 'GET', `/orders/${id}`);
    assert.equal(r.json.status, 'confirmed');
});

// ── 7. Other actors ────────────────────────────────────────────────────────
test('7. Fastrr catalog pull, webhooks, internal jobs and limits', async () => {
    phase = '7. Fastrr / system / limits';
    let r = await act('Fastrr pulls our products', 'GET', '/fastrr/products?page=1&limit=100', { user: null });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.total, 3); // draft goes as status "draft" so Fastrr stops selling it
    const brb = r.json.data.products.find((p) => p.handle === 'berberine');
    assert.equal(brb.variants.length, 2); // subscribe hidden
    assert.equal(brb.variants[0].price, '1499.00');

    r = await act('Fastrr pulls collections', 'GET', '/fastrr/collections', { user: null });
    assert.equal(r.json.data.total, 2);

    r = await act('Fastrr pulls a collection\'s products', 'GET', '/fastrr/collection-products?collection_id=501', { user: null });
    assert.deepEqual(r.json.data.products.map((p) => p.handle), ['berberine']);

    r = await act('Fastrr forgets collection_id', 'GET', '/fastrr/collection-products', { user: null });
    expectError(r, 400, 'COLLECTION_ID_REQUIRED');

    r = await act('Webhook for an order we never created', 'POST', '/fastrr/webhook', { user: null, body: { order_id: 'cccccccccccccccccccccccc' } });
    assert.equal(r.status, 200);

    r = await act('Unsigned call to the reconciliation job', 'POST', '/internal/reconcile-orders', { user: null, body: {} });
    assert.equal(r.status, 503);
    r = await act('Unsigned call to the catalog sync job', 'POST', '/internal/catalog-sync', { user: null, body: {} });
    assert.equal(r.status, 503);

    delete process.env.FASTRR_API_SECRET;
    r = await act('Checkout while Fastrr keys are not configured', 'POST', '/checkout', { user: RIYA, headers: { 'Idempotency-Key': 'riya-checkout-0001' } });
    expectError(r, 503, 'CHECKOUT_UNAVAILABLE');
    process.env.FASTRR_API_SECRET = API_SECRET;

    // A script hammering checkout: 20/min per user, then 429.
    let last;
    for (let i = 0; i < 21; i++) {
        last = await fetch(`${api}/checkout`, { method: 'POST', headers: { Authorization: `Bearer ${RIYA}`, 'Idempotency-Key': `riya-spam-${String(i).padStart(4, '0')}` } });
    }
    report.push({ phase, action: 'A script hits checkout 21 times in a minute', request: 'POST /api/shop/checkout x21', status: last.status, response: await last.text() });
    assert.equal(last.status, 429);
});
