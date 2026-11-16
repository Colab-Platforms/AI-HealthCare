// Shopify WebView checkout mode (default since 2026-11-16): our API builds
// Fastrr's "one click checkout" URL; no Fastrr API call, no token. Amish's
// journey: cart -> checkout -> URL with OUR prices + internal_order_id ->
// stock held for 30 min -> double tap / retry reuse the same order.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { FakeCollection } = require('./helpers/fakeMongo');
const { startFastrrMock } = require('./helpers/fastrrMock');

const ENV = {
    SHOP_CHECKOUT_MODE: undefined, // default = shopify_webview
    FASTRR_API_KEY: undefined, FASTRR_API_SECRET: undefined, // keys not needed in this mode
    FASTRR_SELLER_DOMAIN: 'take-test.myshopify.com',
    SHOPIFY_ADMIN_STORE_DOMAIN: undefined,
    FASTRR_WEBVIEW_URL: undefined, FASTRR_WEB_URL: undefined,
    SHOP_WEBVIEW_HOLD_MINUTES: undefined,
    SHOP_PLACEHOLDER_IMAGE_URL: 'https://cdn/placeholder.png',
    SHOP_HIDE_SUBSCRIBE_VARIANTS: undefined,
    FASTRR_CATALOG_PUSH: 'false',
    REDIS_URL: undefined,
};
const savedEnv = {};

const Order = require('../models/Order');
const Cart = require('../modules/shop/models/Cart');
const Product = require('../modules/shop/models/Product');
const StockReservation = require('../modules/shop/models/StockReservation');
const checkoutService = require('../modules/shop/services/checkoutService');
const fastrrOrderService = require('../modules/shop/services/fastrrOrderService');
const { decodeB64uri } = require('../modules/shop/lib/checkoutLogic');

const orders = new FakeCollection(Order, { unique: [['internalOrderId'], ['user', 'idempotencyKey']] });
const carts = new FakeCollection(Cart, { unique: [['user']] });
const products = new FakeCollection(Product, { unique: [['shopifyProductId']] });
const holds = new FakeCollection(StockReservation, { unique: [['order', 'variantId']] });
mongoose.set('bufferCommands', false);
const restores = [];
let mock;

test.before(async () => {
    for (const [k, v] of Object.entries(ENV)) {
        savedEnv[k] = process.env[k];
        if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    // A Fastrr API that must never be called in this mode.
    mock = await startFastrrMock();
    savedEnv.FASTRR_BASE_URL = process.env.FASTRR_BASE_URL;
    process.env.FASTRR_BASE_URL = mock.baseUrl;
    for (const c of [orders, carts, products, holds]) restores.push(c.install());
});

test.after(async () => {
    restores.forEach((r) => r());
    await mock.close();
    for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});

const V1 = '57199514222897'; // ₹1499, stock 50
const V3 = '57199514222899'; // ₹4497, stock 1
const V9 = '777';            // ₹99, untracked, no image

test.beforeEach(() => {
    orders.docs = []; carts.docs = []; products.docs = []; holds.docs = [];
    mock.reset();
    products.seed({
        shopifyProductId: '9001', handle: 'berberine', title: 'Berberine', status: 'active',
        images: [{ url: 'https://cdn/berberine.jpg', alt: '' }],
        variants: [
            { shopifyVariantId: V1, title: '1 pack / One-Time', price: 149900, inventoryQty: 50, options: [{ name: 'Pack', value: '1 pack' }, { name: 'Purchase', value: 'One-Time' }] },
            { shopifyVariantId: V3, title: '3 pack / One-Time', price: 449700, inventoryQty: 1, options: [{ name: 'Pack', value: '3 pack' }, { name: 'Purchase', value: 'One-Time' }] },
        ],
        minPrice: 149900,
    });
    products.seed({
        shopifyProductId: '9002', handle: 'magnesium', title: 'Magnesium', status: 'active', images: [],
        variants: [{ shopifyVariantId: V9, title: 'Default Title', price: 9900, inventoryTracked: false, inventoryQty: 0 }],
        minPrice: 9900,
    });
});

const fastrrCalls = () => mock.state.calls.length;
const newUser = () => new mongoose.Types.ObjectId();
const setCart = (user, items) => {
    carts.docs = carts.docs.filter((c) => String(c.user) !== String(user));
    carts.seed({ user, items: items.map(([variantId, quantity, addedPrice]) => ({ variantId, productId: variantId === V9 ? '9002' : '9001', quantity, addedPrice })) });
};
let seq = 0;
const newKey = () => `wv-key-${Date.now()}-${++seq}`;
const start = (user, key = newKey()) => checkoutService.startCheckout(user, { idempotencyKey: key, baseUrl: 'https://shop.test' });
const params = (url) => {
    const out = {};
    for (const part of url.slice(url.indexOf('?') + 1).split('&').filter(Boolean)) {
        const i = part.indexOf('=');
        out[part.slice(0, i)] = part.slice(i + 1);
    }
    return out;
};

test('webview: Amish checks out -> order saved, Fastrr Shopify URL with OUR prices and the TH id, no Fastrr API call', async () => {
    const amish = newUser();
    setCart(amish, [[V1, 2, 149900], [V9, 1, 9900]]);
    const before = Date.now();
    const r = await start(amish);

    assert.match(r.orderId, /^TH-\d{6}-[0-9A-Z]{8}$/);
    assert.equal(r.status, 'awaiting_payment');
    assert.equal(r.amount.paise, 2 * 149900 + 9900);
    assert.equal(r.itemCount, 3);
    assert.ok(r.checkoutPageUrl.startsWith('https://fastrr-boost-ui.pickrr.com/headless/?&platform=SHOPIFY&sellerDomain=take-test.myshopify.com&domain=undefined&cart='));
    const p = params(r.checkoutPageUrl);
    assert.ok(r.checkoutPageUrl.endsWith(`&isBaseEncode=true&isMobileApp=true&cartAttributes=${p.cartAttributes}&encodingRequired=true`));

    assert.deepEqual(decodeB64uri(p.cart), [
        { productId: Number(V1), quantity: 2, title: 'Berberine - 1 pack / One-Time', variantId: Number(V1), variantTitle: '', price: 149900, image: 'https://cdn/berberine.jpg', customAttributes: { internal_order_id: r.orderId } },
        { productId: 777, quantity: 1, title: 'Magnesium', variantId: 777, variantTitle: '', price: 9900, image: 'https://cdn/placeholder.png', customAttributes: { internal_order_id: r.orderId } },
    ]);
    assert.deepEqual(decodeB64uri(p.cartAttributes), { internal_order_id: r.orderId });
    assert.equal(p.couponCode, undefined);

    // 30-minute stock hold, and expiresAt tells the app the same.
    const expires = new Date(r.expiresAt).getTime();
    assert.ok(expires >= before + 30 * 60 * 1000 && expires <= Date.now() + 30 * 60 * 1000);
    const o = orders.raw({ internalOrderId: r.orderId });
    assert.equal(o.paymentStatus, 'pending');
    assert.equal(o.fastrrToken ?? null, null);
    assert.equal(holds.docs.length, 1); // V9 is untracked: not held
    assert.equal(holds.docs[0].variantId, V1);
    assert.equal(holds.docs[0].quantity, 2);
    assert.equal(new Date(holds.docs[0].expiresAt).getTime(), expires);

    assert.equal(fastrrCalls(), 0, 'no Fastrr API call in webview mode');
    assert.equal(carts.raw({ user: amish }).items.length, 2, 'cart kept until payment');
});

test('webview: double tap / retry with the same key -> same order and same URL; hold refreshed, not doubled', async () => {
    const amish = newUser();
    setCart(amish, [[V1, 1, 149900]]);
    const key = newKey();
    const [a, b] = await Promise.all([start(amish, key), start(amish, key)]);
    const c = await start(amish, key);
    assert.equal(a.orderId, b.orderId);
    assert.equal(a.orderId, c.orderId);
    assert.equal(a.checkoutPageUrl, c.checkoutPageUrl);
    assert.equal(orders.docs.length, 1);
    assert.equal(holds.docs.length, 1);
    assert.ok(new Date(c.expiresAt) >= new Date(a.expiresAt));
});

test('webview: same key, different cart -> 409 IDEMPOTENCY_KEY_REUSED', async () => {
    const amish = newUser();
    setCart(amish, [[V1, 1, 149900]]);
    const key = newKey();
    await start(amish, key);
    setCart(amish, [[V1, 3, 149900]]);
    await assert.rejects(start(amish, key), (e) => e.code === 'IDEMPOTENCY_KEY_REUSED' && e.status === 409);
});

test('webview: last unit held by Amish -> Rahul gets 409 STOCK_UNAVAILABLE', async () => {
    const amish = newUser(); const rahul = newUser();
    setCart(amish, [[V3, 1, 449700]]);
    setCart(rahul, [[V3, 1, 449700]]);
    await start(amish);
    await assert.rejects(start(rahul), (e) => e.code === 'STOCK_UNAVAILABLE' && e.status === 409);
});

test('webview: hold length and URL base come from env; no seller domain -> 503 and nothing created', async () => {
    process.env.SHOP_WEBVIEW_HOLD_MINUTES = '10';
    process.env.FASTRR_WEBVIEW_URL = 'https://checkout.example/headless/?';
    process.env.FASTRR_WEB_URL = 'www.take.health';
    try {
        const amish = newUser();
        setCart(amish, [[V1, 1, 149900]]);
        const r = await start(amish);
        assert.ok(r.checkoutPageUrl.startsWith('https://checkout.example/headless/?&platform=SHOPIFY&sellerDomain=take-test.myshopify.com&domain=www.take.health&cart='));
        assert.ok(new Date(r.expiresAt).getTime() <= Date.now() + 10 * 60 * 1000);

        delete process.env.FASTRR_SELLER_DOMAIN;
        process.env.SHOPIFY_ADMIN_STORE_DOMAIN = 'fallback.myshopify.com';
        const rahul = newUser();
        setCart(rahul, [[V1, 1, 149900]]);
        assert.match((await start(rahul)).checkoutPageUrl, /sellerDomain=fallback\.myshopify\.com&/);

        delete process.env.SHOPIFY_ADMIN_STORE_DOMAIN;
        const n = orders.docs.length;
        const other = newUser();
        setCart(other, [[V1, 1, 149900]]);
        await assert.rejects(start(other), (e) => e.code === 'CHECKOUT_UNAVAILABLE' && e.status === 503);
        assert.equal(orders.docs.length, n);
    } finally {
        process.env.FASTRR_SELLER_DOMAIN = ENV.FASTRR_SELLER_DOMAIN;
        delete process.env.SHOP_WEBVIEW_HOLD_MINUTES; delete process.env.FASTRR_WEBVIEW_URL;
        delete process.env.FASTRR_WEB_URL; delete process.env.SHOPIFY_ADMIN_STORE_DOMAIN;
    }
});

test('webview: SHOP_CHECKOUT_MODE=custom_api switches back to the token flow (needs Fastrr keys)', async () => {
    process.env.SHOP_CHECKOUT_MODE = 'custom_api';
    try {
        const amish = newUser();
        setCart(amish, [[V1, 1, 149900]]);
        await assert.rejects(start(amish), (e) => e.code === 'CHECKOUT_UNAVAILABLE');
    } finally { delete process.env.SHOP_CHECKOUT_MODE; }
});

test('webview: abandoned checkout is expired by the cron after 30 min, without calling Fastrr', async () => {
    const amish = newUser();
    setCart(amish, [[V1, 1, 149900]]);
    const r = await start(amish);
    orders.docs.find((d) => d.internalOrderId === r.orderId).createdAt = new Date(Date.now() - 31 * 60 * 1000);
    await fastrrOrderService.reconcile({ log: () => {} });
    assert.equal(orders.raw({ internalOrderId: r.orderId }).paymentStatus, 'expired');
    assert.equal(fastrrCalls(), 0);
});

test('webview: a finished checkout retried with its key tells the app what happened', async () => {
    const amish = newUser();
    setCart(amish, [[V1, 1, 149900]]);
    const key = newKey();
    const r = await start(amish, key);
    orders.docs.find((d) => d.internalOrderId === r.orderId).paymentStatus = 'paid';
    await assert.rejects(start(amish, key), (e) => e.status === 409 && e.code === 'ORDER_ALREADY_PLACED');
});
