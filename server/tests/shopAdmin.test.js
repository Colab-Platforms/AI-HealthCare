// Shop admin: event log + every admin API, with data created the real way
// (shoppers using the real routes; Fastrr + Shopify mocks; in-memory Mongo fake).
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const http = require('http');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');

const { FakeCollection } = require('./helpers/fakeMongo');
const { startFastrrMock, placedOrder, fastrrOrder, API_KEY, API_SECRET } = require('./helpers/fastrrMock');
const { startShopifyMock, TOKEN: SHOPIFY_TOKEN } = require('./helpers/shopifyMock');

const V1 = '57199514222897'; // Berberine ₹1499, stock 20
const V2 = '57199514222898'; // Berberine Subscribe (hidden)
const V9 = '777';            // Magnesium ₹99, untracked

const ENV = {
    SHOP_CHECKOUT_MODE: 'custom_api', FASTRR_API_KEY: API_KEY, FASTRR_API_SECRET: API_SECRET, FASTRR_TIMEOUT_MS: '3000', FASTRR_CATALOG_PUSH: 'false',
    JWT_SECRET: 'test-jwt-secret', SHOP_PUBLIC_BASE_URL: 'https://shop.test',
    SHOPIFY_ADMIN_STORE_DOMAIN: '2jfdfm-vp.myshopify.com', SHOPIFY_ADMIN_TOKEN: SHOPIFY_TOKEN, SHOPIFY_API_VERSION: '2026-10',
    SHOP_SHOPIFY_ORDER_SYNC: 'true', SHOP_EVENTS: undefined, SHOP_AUTO_REFUND: undefined, SHOP_USER_CANCEL: undefined,
    SHOP_HIDE_SUBSCRIBE_VARIANTS: undefined, QSTASH_TOKEN: undefined, QSTASH_CURRENT_SIGNING_KEY: undefined, REDIS_URL: undefined,
};
const savedEnv = {};
for (const [k, v] of Object.entries(ENV)) { savedEnv[k] = process.env[k]; if (v === undefined) delete process.env[k]; else process.env[k] = v; }

const authPath = require.resolve('../middleware/auth');
const savedAuth = require.cache[authPath];
require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true,
    exports: {
        protect: (req, res, next) => {
            const h = (req.headers.authorization || '').replace(/^Bearer /, '');
            let id;
            try { id = jwt.verify(h, process.env.JWT_SECRET).id; } catch { return res.status(401).json({ message: 'Not authorized' }); }
            req.user = { _id: new mongoose.Types.ObjectId(id), role: req.headers['x-test-role'] || 'user' };
            next();
        },
        authorize: (...roles) => (req, res, next) => (roles.includes(req.user?.role) ? next() : res.status(403).json({ message: 'Not authorized for this action' })),
    },
};

mongoose.set('bufferCommands', false);
const Order = require('../models/Order');
const User = require('../models/User');
const Cart = require('../modules/shop/models/Cart');
const Product = require('../modules/shop/models/Product');
const StockReservation = require('../modules/shop/models/StockReservation');
const ShopEvent = require('../modules/shop/models/ShopEvent');
const fcm = require('../services/fcmService');
const catalogSyncService = require('../modules/shop/services/catalogSyncService');

const orders = new FakeCollection(Order, { unique: [['internalOrderId'], ['user', 'idempotencyKey']] });
const users = new FakeCollection(User, { unique: [['email']] });
const carts = new FakeCollection(Cart, { unique: [['user']] });
const products = new FakeCollection(Product, { unique: [['shopifyProductId']] });
const holds = new FakeCollection(StockReservation, { unique: [['order', 'variantId']] });
const events = new FakeCollection(ShopEvent);
const restores = [];

const eventService = require('../modules/shop/services/eventService');
const fastrrOrderService = require('../modules/shop/services/fastrrOrderService');
const refundService = require('../modules/shop/services/refundService');
const sync = require('../modules/shop/services/shopifyOrderSyncService');

let fastrr;
let shopify;
let server;
let api;

test.before(async () => {
    fastrr = await startFastrrMock();
    process.env.FASTRR_BASE_URL = fastrr.baseUrl;
    shopify = await startShopifyMock({ variants: { [V1]: 20, [V9]: 100 } });
    process.env.SHOPIFY_ADMIN_API_BASE_URL = shopify.baseUrl;
    for (const c of [orders, users, carts, products, holds, events]) restores.push(c.install());
    const orig = fcm.sendToUser;
    fcm.sendToUser = async () => ({ success: true });
    restores.push(() => { fcm.sendToUser = orig; });
    const app = express();
    app.use(express.json());
    app.use('/api/shop', require('../modules/shop/routes'));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    api = `http://127.0.0.1:${server.address().port}/api/shop`;
    await seedWorld();
});

test.after(async () => {
    restores.forEach((r) => r());
    await new Promise((r) => server.close(r));
    await fastrr.close();
    await shopify.close();
    for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    delete process.env.FASTRR_BASE_URL;
    delete process.env.SHOPIFY_ADMIN_API_BASE_URL;
    if (savedAuth) require.cache[authPath] = savedAuth; else delete require.cache[authPath];
});

// ── Fixture world: Amish (prepaid, shipped), Riya (COD), Rahul (abandoned), Sara (cancel + refund) ──
const person = (name, email, phone) => users.seed({ name, email, phone, password: 'x'.repeat(12) });
let amish; let riya; let rahul; let sara; let adminUser;
const tokenOf = (u) => jwt.sign({ id: String(u._id) }, process.env.JWT_SECRET);

const call = async (method, p, { as, role, body } = {}) => {
    const res = await fetch(`${api}${p}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(as ? { Authorization: `Bearer ${tokenOf(as)}` } : {}), ...(role ? { 'X-Test-Role': role } : {}), ...(method === 'POST' && p === '/checkout' ? { 'Idempotency-Key': `k-${crypto.randomUUID()}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json().catch(() => null) };
};
const admin = (method, p, body) => call(method, `/admin${p}`, { as: adminUser, role: 'admin', body });
const byId = (id) => orders.raw({ internalOrderId: id });

const pay = async (orderId, { cod = false } = {}) => {
    const o = byId(orderId);
    fastrr.state.orders.set(o.fastrrOrderId, placedOrder(o.fastrrOrderId, {
        items: o.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })), subtotal: o.amount / 100, cod,
    }));
    await fastrrOrderService.handleWebhook({ order_id: o.fastrrOrderId });
};

const ids = {};

async function seedWorld() {
    products.seed({
        shopifyProductId: '9001', handle: 'berberine', title: 'Berberine', status: 'active', images: [{ url: 'https://cdn/b.jpg' }],
        variants: [
            { shopifyVariantId: V1, title: '1 pack', price: 149900, inventoryQty: 20, options: [{ name: 'Purchase', value: 'One-Time' }] },
            { shopifyVariantId: V2, title: '1 pack / Subscribe', price: 134900, inventoryQty: 20, options: [{ name: 'Purchase', value: 'Subscribe' }] },
        ],
        minPrice: 134900, lastSyncedAt: new Date(),
    });
    products.seed({
        shopifyProductId: '9002', handle: 'magnesium', title: 'Magnesium', status: 'active', images: [],
        variants: [{ shopifyVariantId: V9, title: 'Default Title', price: 9900, inventoryTracked: false }], minPrice: 9900,
    });
    amish = person('Amish K', 'amish@example.com', '9876543210');
    riya = person('Riya S', 'riya@example.com', '9123456780');
    rahul = person('Rahul M', 'rahul@example.com', '9000000001');
    sara = person('Sara P', 'sara@example.com', '9000000002');
    adminUser = person('Ops Admin', 'ops@take.health', '9000000009');

    // Anonymous browsing
    await call('GET', '/products?q=berb');
    await call('GET', '/products/berberine');
    // Amish: search, view, cart, checkout, UPI, shipped + delivered
    await call('GET', '/products?q=berberine', { as: amish });
    await call('GET', '/products/berberine', { as: amish });
    await call('POST', '/cart/items', { as: amish, body: { variantId: V1, quantity: 1 } });
    await call('PATCH', `/cart/items/${V1}`, { as: amish, body: { quantity: 2 } });
    ids.amish = (await call('POST', '/checkout', { as: amish })).json.orderId;
    await pay(ids.amish);
    shopify.fulfil(ids.amish);
    shopify.deliver(ids.amish);
    await sync.handleWebhook(byId(ids.amish), 'fulfillments/update', { order_id: byId(ids.amish).shopifyOrderId });
    // Riya: COD magnesium x2
    await call('POST', '/cart/items', { as: riya, body: { variantId: V9, quantity: 2 } });
    ids.riya = (await call('POST', '/checkout', { as: riya })).json.orderId;
    await pay(ids.riya, { cod: true });
    // Rahul: adds Berberine, starts checkout, never pays; leaves the cart
    await call('POST', '/cart/items', { as: rahul, body: { variantId: V1, quantity: 1 } });
    ids.rahul = (await call('POST', '/checkout', { as: rahul })).json.orderId;
    Object.assign(byId(ids.rahul), { paymentStatus: 'expired' });
    carts.raw({ user: rahul._id }).updatedAt = new Date(Date.now() - 3 * 60 * 60 * 1000);
    // Sara: pays, cancels, admin approves, Fastrr completes
    await call('POST', '/cart/items', { as: sara, body: { variantId: V1, quantity: 1 } });
    ids.sara = (await call('POST', '/checkout', { as: sara })).json.orderId;
    await pay(ids.sara);
    await call('POST', `/orders/${ids.sara}/cancel`, { as: sara, body: { reason: 'changed my mind' } });
    const rid = byId(ids.sara).refunds[0].refundId;
    await admin('POST', `/orders/${ids.sara}/refunds/${rid}/approve`);
    fastrr.settleRefund(fastrr.state.refunds[0].ref_id);
    await refundService.syncRefundStatuses();
    await eventService.flush();
}

// ── Event log ──────────────────────────────────────────────────────────────

test('events: what shoppers did is recorded, linked to them when logged in', () => {
    const types = (u) => events.docs.filter((e) => String(e.user) === String(u._id)).map((e) => e.type);
    assert.deepEqual(types(amish), ['search', 'product_view', 'cart_add', 'cart_update', 'checkout_start', 'payment_success', 'order_shipped', 'order_delivered']);
    assert.deepEqual(types(sara), ['cart_add', 'checkout_start', 'payment_success', 'refund_requested', 'order_cancelled', 'refund_completed']);
    const anon = events.docs.filter((e) => !e.user).map((e) => e.type);
    assert.deepEqual(anon, ['search', 'product_view']);
    const search = events.docs.find((e) => e.type === 'search' && e.user);
    assert.deepEqual(search.meta, { q: 'berberine', results: 1 });
    const pay = events.docs.find((e) => e.type === 'payment_success' && String(e.user) === String(amish._id));
    assert.equal(pay.orderId, ids.amish);
    assert.equal(pay.meta.method, 'prepaid');
    // personal data is kept for a limited time
    assert.ok(ShopEvent.schema.indexes().some(([key, opts]) => key.createdAt === 1 && opts.expireAfterSeconds === 180 * 86400));
});

test('events: SHOP_EVENTS=false records nothing; a bad token on a public route is just anonymous', async () => {
    const before = events.docs.length;
    process.env.SHOP_EVENTS = 'false';
    await call('GET', '/products?q=magnesium', { as: amish });
    await eventService.flush();
    assert.equal(events.docs.length, before);
    delete process.env.SHOP_EVENTS;
    const res = await fetch(`${api}/products/magnesium`, { headers: { Authorization: 'Bearer not-a-jwt' } });
    assert.equal(res.status, 200);
    await eventService.flush();
    assert.equal(events.docs.at(-1).user, null);
    events.docs.pop(); // keep the shared fixture's numbers stable for the overview test
});

// ── Access ─────────────────────────────────────────────────────────────────

test('admin APIs: 401 without login, 403 for customers', async () => {
    for (const p of ['/overview', '/orders', `/orders/${ids.amish}`, '/attention', '/products', '/carts', '/customers', `/customers/${amish._id}`, '/refunds']) {
        assert.equal((await call('GET', `/admin${p}`)).status, 401, p);
        assert.equal((await call('GET', `/admin${p}`, { as: amish })).status, 403, p);
    }
});

// ── Overview ───────────────────────────────────────────────────────────────

test('overview: orders, revenue, refunds, funnel, top products, daily, attention', async () => {
    const r = await admin('GET', '/overview?range=7d');
    assert.equal(r.status, 200);
    const o = r.json;
    assert.equal(o.range, '7d');
    assert.equal(o.orders.placed, 3);           // Amish, Riya, Sara (Rahul never paid)
    assert.equal(o.orders.prepaid, 2);
    assert.equal(o.orders.cod, 1);
    assert.equal(o.orders.cancelled, 1);        // Sara
    assert.equal(o.revenue.gross.paise, 299800 + 19800 + 149900);
    assert.equal(o.revenue.refunded.paise, 149900);
    assert.equal(o.revenue.net.paise, 299800 + 19800);
    assert.equal(o.revenue.averageOrder.paise, Math.round((299800 + 19800 + 149900) / 3));
    assert.deepEqual(o.checkouts, { started: 4, abandoned: 1 });
    assert.deepEqual(o.funnel, { viewedProduct: 1, addedToCart: 4, startedCheckout: 4, paid: 3, anonymousViews: 1, searches: 2 });
    assert.deepEqual(o.topProducts.map((p) => [p.title, p.units]), [['Berberine', 2], ['Magnesium', 2]]); // Sara's cancelled order excluded
    assert.equal(o.daily.length, 7);
    assert.equal(o.daily.at(-1).orders, 3);
    assert.equal(o.attention.total, 0);
    assert.deepEqual(o.orders.byStatus, { delivered: 1, confirmed: 1, refunded: 1 });
});

// ── Orders ─────────────────────────────────────────────────────────────────

test('orders: list, filters, search by order id / phone / email / name, paging', async () => {
    let r = await admin('GET', '/orders');
    assert.equal(r.json.total, 4);
    assert.deepEqual(r.json.items.map((x) => x.orderId), [ids.sara, ids.rahul, ids.riya, ids.amish]); // newest first
    const row = r.json.items.find((x) => x.orderId === ids.amish);
    assert.equal(row.customer.name, 'Amish K');
    assert.equal(row.status, 'delivered');
    assert.equal(row.shopifyOrderName, '#TAKE11001');
    assert.equal(row.total.paise, 299800);

    const only = async (q) => (await admin('GET', `/orders?${q}`)).json.items.map((x) => x.orderId);
    assert.deepEqual(await only('status=confirmed'), [ids.riya]);
    assert.deepEqual(await only('status=expired'), [ids.rahul]);
    assert.deepEqual(await only('status=refunded'), [ids.sara]);
    assert.deepEqual(await only('status=placed&paymentMethod=cod'), [ids.riya]);
    assert.deepEqual(await only(`q=${ids.amish}`), [ids.amish]);
    // phone in any format (the Fastrr mock gives every paid order the same checkout phone)
    assert.deepEqual(await only('q=%2B91%2098765%2043210'), [ids.sara, ids.riya, ids.amish]);
    assert.deepEqual(await only('q=riya%40example.com'), [ids.riya]);           // customer email
    assert.deepEqual(await only('q=rahul'), [ids.rahul]);                       // user name
    assert.deepEqual(await only('q=%23TAKE11001'), [ids.amish]);               // Shopify order name

    r = await admin('GET', '/orders?limit=3&page=2');
    assert.deepEqual([r.json.items.length, r.json.page, r.json.totalPages], [1, 2, 2]);
    assert.equal((await admin('GET', '/orders?status=nonsense')).json.code, 'INVALID_STATUS');
});

test('order detail: everything + one timeline; payment token never exposed', async () => {
    const r = await admin('GET', `/orders/${ids.sara}`);
    assert.equal(r.status, 200);
    const o = r.json;
    assert.equal(o.status, 'refunded');
    assert.equal(o.customer.email, 'sara@example.com');
    assert.equal(o.customer.checkoutPhone, '9876543210');
    assert.equal(o.shopifyAdminUrl, `https://admin.shopify.com/store/2jfdfm-vp/orders/${o.shopifyOrderId}`);
    assert.equal('fastrrToken' in o, false);
    const labels = o.timeline.map((t) => t.label);
    for (const l of ['Checkout started (order created)', 'paymentStatus → paid', 'shopifySyncStatus → synced', 'fulfillmentStatus → cancelled', 'paymentStatus → refunded', 'order_cancelled', 'refund_completed']) {
        assert.ok(labels.includes(l), l);
    }
    assert.ok(labels.some((l) => /Refund R-\w+ completed \(fastrr\)/.test(l)));
    const times = o.timeline.map((t) => new Date(t.at).getTime());
    assert.deepEqual(times, [...times].sort((a, b) => a - b));
    assert.equal((await admin('GET', '/orders/TH-261116-ZZZZZZZZ')).status, 404);
});

// ── Attention + actions ────────────────────────────────────────────────────

test('attention: Shopify sync failure shows up, admin fixes it with retry', async () => {
    const u = person('Neha T', 'neha@example.com', '9000000003');
    await call('POST', '/cart/items', { as: u, body: { variantId: V1, quantity: 1 } });
    const id = (await call('POST', '/checkout', { as: u })).json.orderId;
    process.env.SHOPIFY_ADMIN_TOKEN = 'revoked';
    await pay(id);
    process.env.SHOPIFY_ADMIN_TOKEN = SHOPIFY_TOKEN;
    assert.equal(byId(id).shopifySyncStatus, 'needs_attention');

    let r = await admin('GET', '/attention');
    assert.deepEqual(r.json.shopifySync.map((x) => x.orderId), [id]);
    assert.match(r.json.shopifySync[0].shopifySyncError, /401|Invalid API key/);
    assert.equal((await admin('GET', '/overview')).json.attention.shopifySync, 1);
    assert.deepEqual((await admin('GET', '/orders?attention=true')).json.items.map((x) => x.orderId), [id]);

    r = await admin('POST', `/orders/${id}/retry-sync`);
    assert.equal(r.status, 200);
    assert.equal(r.json.result, 'synced');
    assert.equal(r.json.order.shopifySyncStatus, 'synced');
    assert.equal((await admin('POST', `/orders/${id}/retry-sync`)).json.code, 'SYNC_NOT_RETRYABLE');
    assert.equal((await admin('GET', '/attention')).json.shopifySync.length, 0);
});

test('attention: review-flagged order must be resolved (with a note) before it is sent to Shopify', async () => {
    const u = person('Kabir D', 'kabir@example.com', '9000000004');
    await call('POST', '/cart/items', { as: u, body: { variantId: V1, quantity: 1 } });
    const id = (await call('POST', '/checkout', { as: u })).json.orderId;
    const o = byId(id);
    fastrr.state.orders.set(o.fastrrOrderId, placedOrder(o.fastrrOrderId, { items: [{ variantId: V1, quantity: 1 }], subtotal: 1 })); // mismatch
    await fastrrOrderService.handleWebhook({ order_id: o.fastrrOrderId });
    assert.equal(byId(id).shopifySyncStatus, 'needs_attention');
    assert.deepEqual((await admin('GET', '/attention')).json.review.map((x) => x.orderId), [id]);

    assert.equal((await admin('POST', `/orders/${id}/retry-sync`)).json.code, 'REVIEW_REQUIRED');
    assert.equal((await admin('POST', `/orders/${id}/review/resolve`, {})).json.code, 'NOTE_REQUIRED');
    let r = await admin('POST', `/orders/${id}/review/resolve`, { note: 'Checked Fastrr dashboard: paid in full' });
    assert.equal(r.status, 200);
    assert.equal(r.json.review.needed, false);
    assert.equal(r.json.review.resolvedBy, String(adminUser._id));
    r = await admin('POST', `/orders/${id}/retry-sync`);
    assert.equal(r.json.result, 'synced');
});

test('attention: refunds waiting for approval and stuck payments', async () => {
    const u = person('Isha R', 'isha@example.com', '9000000005');
    await call('POST', '/cart/items', { as: u, body: { variantId: V9, quantity: 1 } });
    const id = (await call('POST', '/checkout', { as: u })).json.orderId;
    await pay(id);
    await call('POST', `/orders/${id}/cancel`, { as: u });
    const stuck = (await (async () => {
        const v = person('Om N', 'om@example.com', '9000000006');
        await call('POST', '/cart/items', { as: v, body: { variantId: V9, quantity: 1 } });
        return (await call('POST', '/checkout', { as: v })).json.orderId;
    })());
    byId(stuck).createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const r = await admin('GET', '/attention');
    assert.deepEqual(r.json.refundApproval.map((x) => x.orderId), [id]);
    assert.equal(r.json.refundApproval[0].refunds[0].status, 'requested');
    assert.ok(r.json.stuckPayments.some((x) => x.orderId === stuck));
});

// ── Products / carts / customers / refunds ─────────────────────────────────

test('products: stock, held units, 30-day sales, hidden subscribe variants', async () => {
    const u = person('Hold Test', 'hold@example.com', '9000000007');
    await call('POST', '/cart/items', { as: u, body: { variantId: V1, quantity: 3 } });
    await call('POST', '/checkout', { as: u }); // holds 3 while paying
    const r = await admin('GET', '/products');
    const brb = r.json.items.find((p) => p.handle === 'berberine');
    const v1 = brb.variants.find((v) => v.id === V1);
    assert.equal(v1.stock, 20);
    assert.ok(v1.held >= 3);
    assert.ok(v1.soldLast30Days >= 2); // Amish's 2 (Sara's cancelled 1 excluded)
    assert.equal(brb.variants.find((v) => v.id === V2).hiddenInApp, true);
    assert.equal(r.json.items.find((p) => p.handle === 'magnesium').variants[0].stock, null); // untracked
});

test('products/sync runs the Shopify catalog sync', async () => {
    const orig = catalogSyncService.fullSync;
    catalogSyncService.fullSync = async () => ({ collections: 2, products: 2, stale: 0, productsDeleted: 0, collectionsDeleted: 0, ms: 5 });
    try {
        const r = await admin('POST', '/products/sync');
        assert.deepEqual(r.json, { ok: true, stats: { collections: 2, products: 2, stale: 0, productsDeleted: 0, collectionsDeleted: 0, ms: 5 } });
    } finally {
        catalogSyncService.fullSync = orig;
    }
});

test('carts: live carts with value; "abandoned" = untouched for over an hour', async () => {
    let r = await admin('GET', '/carts');
    const rahulCart = r.json.items.find((c) => c.user.email === 'rahul@example.com');
    assert.equal(rahulCart.value.paise, 149900);
    assert.equal(rahulCart.abandoned, true);
    assert.deepEqual(rahulCart.items.map((i) => [i.title, i.quantity]), [['Berberine', 1]]);
    r = await admin('GET', '/carts?abandoned=true');
    assert.ok(r.json.items.every((c) => c.abandoned));
    assert.ok(r.json.items.some((c) => c.user.email === 'rahul@example.com'));
    assert.equal(r.json.items.some((c) => c.user.email === 'amish@example.com'), false); // bought -> cart empty
});

test('customers: search + recent shoppers; journey shows cart, every checkout and the event timeline', async () => {
    let r = await admin('GET', '/customers?q=amish');
    assert.deepEqual(r.json.items.map((c) => [c.name, c.orders, c.spent.paise]), [['Amish K', 1, 299800]]);
    r = await admin('GET', '/customers');
    assert.ok(r.json.items.length >= 4);
    const rahulRow = r.json.items.find((c) => c.email === 'rahul@example.com');
    assert.deepEqual([rahulRow.orders, rahulRow.abandonedCheckouts, rahulRow.cartItems], [0, 1, 1]);

    r = await admin('GET', `/customers/${amish._id}`);
    assert.equal(r.status, 200);
    assert.equal(r.json.customer.name, 'Amish K');
    assert.equal(r.json.cart, null);
    assert.deepEqual(r.json.orders.map((o) => [o.orderId, o.status]), [[ids.amish, 'delivered']]);
    assert.deepEqual(r.json.events.map((e) => e.type).reverse(),
        ['search', 'product_view', 'cart_add', 'cart_update', 'checkout_start', 'payment_success', 'order_shipped', 'order_delivered']);

    r = await admin('GET', `/customers/${rahul._id}`);
    assert.equal(r.json.cart.value.paise, 149900);
    assert.equal(r.json.orders[0].status, 'expired');
    assert.equal((await admin('GET', `/customers/${new mongoose.Types.ObjectId()}`)).status, 404);
});

test('refunds: all refunds across orders, filterable by status', async () => {
    let r = await admin('GET', '/refunds');
    const sar = r.json.items.find((x) => x.orderId === ids.sara);
    assert.equal(sar.status, 'completed');
    assert.equal(sar.amount.paise, 149900);
    assert.equal(sar.customer.name, 'Sara P');
    assert.equal(sar.approvedBy, String(adminUser._id));
    r = await admin('GET', '/refunds?status=completed');
    assert.ok(r.json.items.every((x) => x.status === 'completed'));
});
