// M4: cancel + refunds. Real services + real routes; in-memory Mongo fake,
// local Fastrr mock (refund initiate / report) and local Shopify mock
// (orderCancel / refundCreate). Every order goes through the real flow:
// checkout -> Fastrr payment -> Shopify order -> cancel / refund.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const http = require('http');
const mongoose = require('mongoose');
const express = require('express');

const { FakeCollection } = require('./helpers/fakeMongo');
const { startFastrrMock, placedOrder, API_KEY, API_SECRET } = require('./helpers/fastrrMock');
const { startShopifyMock, TOKEN: SHOPIFY_TOKEN } = require('./helpers/shopifyMock');

const V1 = '57199514222897'; // ₹1499, stock 20
const V9 = '777';            // ₹99, untracked

const ENV = {
    FASTRR_API_KEY: API_KEY, FASTRR_API_SECRET: API_SECRET, FASTRR_TIMEOUT_MS: '3000', FASTRR_CATALOG_PUSH: 'false',
    JWT_SECRET: 'test-jwt-secret', SHOP_PUBLIC_BASE_URL: 'https://shop.test',
    SHOPIFY_ADMIN_STORE_DOMAIN: 'take-test.myshopify.com', SHOPIFY_ADMIN_TOKEN: SHOPIFY_TOKEN, SHOPIFY_API_VERSION: '2026-10',
    SHOPIFY_WEBHOOK_SECRET: 'test-webhook-secret', SHOPIFY_CLIENT_SECRET: undefined,
    SHOP_SHOPIFY_ORDER_SYNC: 'true', SHOP_SHOPIFY_TEST_ORDERS: undefined, SHOP_SHOPIFY_SEND_RECEIPT: undefined,
    SHOP_USER_CANCEL: undefined, SHOP_AUTO_REFUND: undefined, SHOP_AUTO_REFUND_MAX_RUPEES: undefined, SHOP_SHOPIFY_RECORD_REFUNDS: undefined,
    SHOP_ORDER_PUSH: undefined, SHOP_APP_ORDERS_CARD_OFFER: undefined, SHOP_HIDE_SUBSCRIBE_VARIANTS: undefined,
    QSTASH_TOKEN: undefined, QSTASH_CURRENT_SIGNING_KEY: undefined, REDIS_URL: undefined,
};
const savedEnv = {};
for (const [k, v] of Object.entries(ENV)) { savedEnv[k] = process.env[k]; if (v === undefined) delete process.env[k]; else process.env[k] = v; }

// `protect` stub: Bearer <userId>, role from X-Test-Role
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

mongoose.set('bufferCommands', false);
const Order = require('../models/Order');
const Cart = require('../modules/shop/models/Cart');
const Product = require('../modules/shop/models/Product');
const StockReservation = require('../modules/shop/models/StockReservation');
const fcm = require('../services/fcmService');
const offer = require('../services/shopifyOfferService');

const orders = new FakeCollection(Order, { unique: [['internalOrderId'], ['user', 'idempotencyKey']] });
const carts = new FakeCollection(Cart, { unique: [['user']] });
const products = new FakeCollection(Product, { unique: [['shopifyProductId']] });
const holds = new FakeCollection(StockReservation, { unique: [['order', 'variantId']] });
const restores = [];
const pushes = [];

const checkoutService = require('../modules/shop/services/checkoutService');
const fastrrOrderService = require('../modules/shop/services/fastrrOrderService');
const refundService = require('../modules/shop/services/refundService');
const sync = require('../modules/shop/services/shopifyOrderSyncService');
const fastrrClient = require('../modules/shop/services/fastrrClient');

let fastrr;
let shopify;
let server;
let api;

test.before(async () => {
    fastrr = await startFastrrMock();
    process.env.FASTRR_BASE_URL = fastrr.baseUrl;
    shopify = await startShopifyMock({ variants: { [V1]: 20, [V9]: 100 } });
    process.env.SHOPIFY_ADMIN_API_BASE_URL = shopify.baseUrl;
    for (const c of [orders, carts, products, holds]) restores.push(c.install());
    const origSend = fcm.sendToUser;
    const origOffer = offer.handleWebhook;
    fcm.sendToUser = async (userId, p) => { pushes.push({ userId: String(userId), ...p }); return { success: true }; };
    offer.handleWebhook = async () => ({ ignored: 'stub' });
    restores.push(() => { fcm.sendToUser = origSend; offer.handleWebhook = origOffer; });

    const app = express();
    app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf.toString('utf8'); } }));
    app.use('/api/shop', require('../modules/shop/routes'));
    app.use('/api/shopify', require('../routes/shopifyWebhookRoutes'));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    api = `http://127.0.0.1:${server.address().port}`;
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

test.beforeEach(() => {
    orders.docs = []; carts.docs = []; products.docs = []; holds.docs = [];
    pushes.length = 0;
    fastrr.reset(); shopify.reset();
    for (const k of ['SHOP_USER_CANCEL', 'SHOP_AUTO_REFUND', 'SHOP_AUTO_REFUND_MAX_RUPEES', 'SHOP_SHOPIFY_RECORD_REFUNDS']) delete process.env[k];
    process.env.SHOP_SHOPIFY_ORDER_SYNC = 'true';
    products.seed({
        shopifyProductId: '9001', handle: 'berberine', title: 'Berberine', status: 'active', images: [],
        variants: [{ shopifyVariantId: V1, title: '1 pack', price: 149900, inventoryQty: 20 }], minPrice: 149900,
    });
    products.seed({
        shopifyProductId: '9002', handle: 'magnesium', title: 'Magnesium', status: 'active', images: [],
        variants: [{ shopifyVariantId: V9, title: 'Default Title', price: 9900, inventoryTracked: false }], minPrice: 9900,
    });
});

// ── Helpers ────────────────────────────────────────────────────────────────

const REFUND = '/api/v1/external/refund/initiate';
const byId = (id) => orders.raw({ internalOrderId: id });

/** Real flow: cart -> checkout -> Fastrr payment (webhook) -> Shopify order. */
const placeOrder = async ({ items = [[V1, 2, 149900]], cod = false, user = new mongoose.Types.ObjectId() } = {}) => {
    carts.docs = carts.docs.filter((c) => String(c.user) !== String(user));
    carts.seed({ user, items: items.map(([variantId, quantity, addedPrice]) => ({ variantId, productId: variantId === V9 ? '9002' : '9001', quantity, addedPrice })) });
    const { orderId } = await checkoutService.startCheckout(user, { idempotencyKey: `k-${crypto.randomUUID()}`, baseUrl: 'https://shop.test' });
    const o = byId(orderId);
    fastrr.state.orders.set(o.fastrrOrderId, placedOrder(o.fastrrOrderId, {
        items: o.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })), subtotal: o.amount / 100, cod,
    }));
    await fastrrOrderService.handleWebhook({ order_id: o.fastrrOrderId });
    return { orderId, user, order: byId(orderId) };
};

const call = async (method, p, { user, role, body } = {}) => {
    const res = await fetch(`${api}${p}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user}` } : {}), ...(role ? { 'X-Test-Role': role } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json().catch(() => null) };
};
const ADMIN = new mongoose.Types.ObjectId().toString();
const asAdmin = (method, p, body) => call(method, p, { user: ADMIN, role: 'admin', body });
const settleAll = async () => {
    for (const r of fastrr.state.refunds) if (r.status === 'INITIATED') fastrr.settleRefund(r.ref_id);
    return refundService.syncRefundStatuses();
};
const events = () => pushes.map((p) => p.data.event);

// ── Fastrr client ──────────────────────────────────────────────────────────

test('client: refund initiate sends rupees + platform order id, and is never retried (even on 5xx)', async () => {
    const { order } = await placeOrder();
    const r = await fastrrClient.initiateRefund({ orderId: order.paidFastrrOrderId, amountPaise: 149950 });
    assert.match(r.refundId, /^[0-9a-f-]{36}$/);
    const [c] = fastrr.callsTo(REFUND);
    assert.deepEqual(c.body, { amount: 1499.5, order_id: order.paidFastrrOrderId });
    fastrr.state.next.push({ path: REFUND, status: 503, body: {} });
    await assert.rejects(fastrrClient.initiateRefund({ orderId: order.paidFastrrOrderId, amountPaise: 100 }), (e) => e.status === 503);
    assert.equal(fastrr.callsTo(REFUND).length, 2); // one per call, no retry
    await assert.rejects(fastrrClient.initiateRefund({ orderId: 'not-an-order', amountPaise: 100 }), (e) => e.code === 'REJECTED' && /not eligible/.test(e.message));
});

// ── Customer cancels ───────────────────────────────────────────────────────

test('cancel (prepaid, default settings): Shopify cancelled + restocked, refund waits for admin', async () => {
    const { orderId, user } = await placeOrder();
    assert.equal(shopify.state.inventory[V1], 18);
    const r = await call('POST', `/api/shop/orders/${orderId}/cancel`, { user: String(user), body: { reason: 'Ordered by mistake' } });
    assert.equal(r.status, 200);
    assert.equal(r.json.status, 'refund_initiated');
    assert.equal(r.json.canCancel, false);
    assert.equal(r.json.refund.status, 'in_progress');
    assert.equal(r.json.refund.amount.rupees, 2998);
    assert.ok(r.json.cancelledAt);

    const node = shopify.byTag(orderId);
    assert.ok(node.cancelledAt);
    assert.equal(node._cancel.reason, 'CUSTOMER');
    assert.equal(shopify.state.inventory[V1], 20); // restocked in Shopify

    const o = byId(orderId);
    assert.equal(o.fulfillmentStatus, 'cancelled');
    assert.equal(o.paymentStatus, 'refund_pending');
    assert.equal(o.cancelledBy, 'user');
    assert.equal(o.cancelReason, 'Ordered by mistake');
    assert.equal(o.refunds[0].status, 'requested');
    assert.equal(o.refunds[0].source, 'user_cancel');
    assert.equal(fastrr.callsTo(REFUND).length, 0); // auto-refund is OFF by default
    assert.deepEqual(events(), ['confirmed', 'cancelled']);

    const again = await call('POST', `/api/shop/orders/${orderId}/cancel`, { user: String(user) });
    assert.equal(again.status, 409);
    assert.equal(again.json.code, 'CANCEL_NOT_ALLOWED');
});

test('cancel: admin approves -> sent to Fastrr once (double click safe) -> report says done -> refunded + recorded in Shopify', async () => {
    const { orderId, user } = await placeOrder();
    await call('POST', `/api/shop/orders/${orderId}/cancel`, { user: String(user) });
    const refundId = byId(orderId).refunds[0].refundId;

    const [a, b] = await Promise.all([
        asAdmin('POST', `/api/shop/admin/orders/${orderId}/refunds/${refundId}/approve`),
        asAdmin('POST', `/api/shop/admin/orders/${orderId}/refunds/${refundId}/approve`),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    assert.equal([a, b].find((x) => x.status === 409).json.code, 'REFUND_NOT_PENDING');
    assert.equal(fastrr.callsTo(REFUND).length, 1);
    assert.deepEqual(fastrr.callsTo(REFUND)[0].body, { amount: 2998, order_id: byId(orderId).paidFastrrOrderId });
    let o = byId(orderId);
    assert.equal(o.refunds[0].status, 'initiated');
    assert.equal(o.refunds[0].approvedBy, ADMIN);
    assert.ok(o.refunds[0].fastrrRefundId);
    assert.ok(events().includes('refund_initiated'));

    const stats = await settleAll();
    assert.equal(stats.completed, 1);
    o = byId(orderId);
    assert.equal(o.refunds[0].status, 'completed');
    assert.equal(o.paymentStatus, 'refunded');
    assert.equal(o.refunds[0].shopifyRecorded, true);
    assert.deepEqual(shopify.byTag(orderId).refunds.map((x) => x.amount), ['2998.00']);
    assert.ok(events().includes('refunded'));
    const view = await call('GET', `/api/shop/orders/${orderId}`, { user: String(user) });
    assert.equal(view.json.status, 'refunded');
    assert.equal(view.json.refund.status, 'completed');

    assert.equal((await settleAll()).updated, 0); // nothing open any more
    assert.equal(shopify.byTag(orderId).refunds.length, 1);
});

test('cancel: SHOP_AUTO_REFUND on -> refund goes to Fastrr straight away; above the limit it still waits', async () => {
    process.env.SHOP_AUTO_REFUND = 'true';
    process.env.SHOP_AUTO_REFUND_MAX_RUPEES = '2000';
    const small = await placeOrder({ items: [[V1, 1, 149900]] });
    await call('POST', `/api/shop/orders/${small.orderId}/cancel`, { user: String(small.user) });
    assert.equal(byId(small.orderId).refunds[0].status, 'initiated');
    assert.equal(byId(small.orderId).refunds[0].approvedBy, 'auto');

    const big = await placeOrder({ items: [[V1, 2, 149900]] }); // ₹2998 > ₹2000
    await call('POST', `/api/shop/orders/${big.orderId}/cancel`, { user: String(big.user) });
    assert.equal(byId(big.orderId).refunds[0].status, 'requested');
    assert.equal(fastrr.callsTo(REFUND).length, 1);
});

test('cancel (COD): payment cancelled, no refund, Shopify cancelled', async () => {
    const { orderId, user } = await placeOrder({ cod: true });
    const r = await call('POST', `/api/shop/orders/${orderId}/cancel`, { user: String(user) });
    assert.equal(r.status, 200);
    assert.equal(r.json.status, 'cancelled');
    assert.equal(r.json.refund, null);
    const o = byId(orderId);
    assert.equal(o.paymentStatus, 'cancelled');
    assert.equal(o.refunds.length, 0);
    assert.ok(shopify.byTag(orderId).cancelledAt);
});

test('cancel: refused once shipped — also when only Shopify knows it shipped (our copy catches up)', async () => {
    const a = await placeOrder();
    shopify.fulfil(a.orderId); // warehouse shipped; webhook not here yet
    const r = await call('POST', `/api/shop/orders/${a.orderId}/cancel`, { user: String(a.user) });
    assert.equal(r.status, 409);
    assert.equal(r.json.code, 'CANCEL_NOT_ALLOWED');
    assert.equal(byId(a.orderId).fulfillmentStatus, 'fulfilled'); // synced from Shopify during the check
    assert.equal(byId(a.orderId).refunds.length, 0);
    assert.equal(shopify.byTag(a.orderId).cancelledAt, null);
});

test('cancel: Shopify refuses -> 502 and NOTHING changes on our side', async () => {
    const { orderId, user } = await placeOrder();
    shopify.state.next.push({ op: 'cancel', body: { data: { orderCancel: { job: null, orderCancelUserErrors: [{ field: ['orderId'], message: 'Order is locked', code: 'INVALID' }] } } } });
    const r = await call('POST', `/api/shop/orders/${orderId}/cancel`, { user: String(user) });
    assert.equal(r.status, 502);
    assert.equal(r.json.code, 'SHOPIFY_CANCEL_FAILED');
    const o = byId(orderId);
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(o.fulfillmentStatus, 'unfulfilled');
    assert.equal(o.refunds.length, 0);
});

test('cancel: switched off -> 403; other user -> 404; while Shopify order is being created -> 409 retry', async () => {
    const { orderId, user } = await placeOrder();
    process.env.SHOP_USER_CANCEL = 'false';
    let r = await call('POST', `/api/shop/orders/${orderId}/cancel`, { user: String(user) });
    assert.equal(r.status, 403);
    assert.equal(r.json.code, 'CANCEL_DISABLED');
    assert.equal((await call('GET', `/api/shop/orders/${orderId}`, { user: String(user) })).json.canCancel, false);
    delete process.env.SHOP_USER_CANCEL;

    r = await call('POST', `/api/shop/orders/${orderId}/cancel`, { user: new mongoose.Types.ObjectId().toString() });
    assert.equal(r.status, 404);

    byId(orderId).shopifySyncLeaseUntil = new Date(Date.now() + 30000);
    r = await call('POST', `/api/shop/orders/${orderId}/cancel`, { user: String(user) });
    assert.equal(r.status, 409);
    assert.equal(r.json.code, 'CANCEL_IN_PROGRESS');
});

test('cancel before the Shopify order exists (sync off) -> cancelled locally, and never sent to Shopify later', async () => {
    process.env.SHOP_SHOPIFY_ORDER_SYNC = 'false';
    const { orderId, user } = await placeOrder({ cod: true });
    const r = await call('POST', `/api/shop/orders/${orderId}/cancel`, { user: String(user) });
    assert.equal(r.status, 200);
    process.env.SHOP_SHOPIFY_ORDER_SYNC = 'true';
    byId(orderId).updatedAt = new Date(Date.now() - 10 * 60 * 1000);
    await sync.sweep();
    assert.equal(shopify.callsOf('create').length, 0);
});

// ── Refund amounts / failures ──────────────────────────────────────────────

test('partial refunds add up to "refunded"; refunds can never exceed what was paid (even in parallel)', async () => {
    const { orderId } = await placeOrder(); // paid ₹2998
    let r = await asAdmin('POST', `/api/shop/admin/orders/${orderId}/refunds`, { amountPaise: 100000, reason: 'damaged item' });
    assert.equal(r.status, 200);
    await settleAll();
    assert.equal(byId(orderId).paymentStatus, 'partially_refunded');

    r = await asAdmin('POST', `/api/shop/admin/orders/${orderId}/refunds`, { amountPaise: 299800 });
    assert.equal(r.status, 400);
    assert.equal(r.json.code, 'INVALID_REFUND_AMOUNT');
    assert.equal(r.json.maxPaise, 199800);

    const both = await Promise.all([
        asAdmin('POST', `/api/shop/admin/orders/${orderId}/refunds`, { amountPaise: 199800 }),
        asAdmin('POST', `/api/shop/admin/orders/${orderId}/refunds`, { amountPaise: 199800 }),
    ]);
    assert.equal(both.filter((x) => x.status === 200).length, 1);
    const refunded = byId(orderId).refunds.filter((x) => x.status !== 'failed').reduce((n, x) => n + x.amount, 0);
    assert.equal(refunded, 299800);
    await settleAll();
    assert.equal(byId(orderId).paymentStatus, 'refunded');
    assert.deepEqual(shopify.byTag(orderId).refunds.map((x) => x.amount), ['1000.00', '1998.00']);
});

test('refund call times out / 5xx -> "unknown", NOT re-sent; matched later from Fastrr\'s report', async () => {
    const { orderId } = await placeOrder();
    const o = byId(orderId);
    fastrr.state.next.push({ path: REFUND, status: 502, body: {} });
    const r = await asAdmin('POST', `/api/shop/admin/orders/${orderId}/refunds`, {});
    assert.equal(r.status, 200);
    assert.equal(r.json.refund.status, 'unknown');
    // Fastrr actually processed it despite the error:
    fastrr.state.refunds.push({
        ref_id: 'late-ref-1', status: 'SUCCESS', refunded: true, order_id: Number(o.fastrrNumericOrderId),
        refund_amount: 2998, amount: 2998, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    assert.equal((await asAdmin('POST', `/api/shop/admin/orders/${orderId}/refunds/${r.json.refund.refundId}/retry`)).json.code, 'REFUND_NOT_RETRYABLE');
    const stats = await refundService.syncRefundStatuses();
    assert.equal(stats.adopted, 1);
    const after = byId(orderId);
    assert.equal(after.refunds[0].status, 'completed');
    assert.equal(after.refunds[0].fastrrRefundId, 'late-ref-1');
    assert.equal(after.paymentStatus, 'refunded');
    assert.equal(fastrr.callsTo(REFUND).length, 1); // never sent twice
});

test('Fastrr refuses -> failed (+alert); admin retry sends it again', async () => {
    const { orderId } = await placeOrder();
    fastrr.state.next.push({ path: REFUND, body: { status: false, message: 'Refund window closed' } });
    const r = await asAdmin('POST', `/api/shop/admin/orders/${orderId}/refunds`, {});
    assert.equal(r.json.refund.status, 'failed');
    assert.match(r.json.refund.error, /Refund window closed/);
    const retry = await asAdmin('POST', `/api/shop/admin/orders/${orderId}/refunds/${r.json.refund.refundId}/retry`);
    assert.equal(retry.status, 200);
    assert.equal(retry.json.refund.status, 'initiated');
});

test('report pages through all refunds; a FAILED refund at Fastrr is marked failed', async () => {
    const orderIds = [];
    for (let i = 0; i < 3; i++) {
        const { orderId } = await placeOrder({ items: [[V1, 1, 149900]] });
        await asAdmin('POST', `/api/shop/admin/orders/${orderId}/refunds`, {});
        orderIds.push(orderId);
    }
    fastrr.settleRefund(fastrr.state.refunds[0].ref_id);
    fastrr.settleRefund(fastrr.state.refunds[2].ref_id, 'FAILED');
    const stats = await refundService.syncRefundStatuses();
    assert.equal(stats.completed, 1);
    assert.equal(stats.failed, 1);
    assert.equal(fastrr.callsTo('/api/v1/external/refund/reports').length, 2); // 3 refunds, 2 per page
    assert.deepEqual(orderIds.map((id) => byId(id).refunds[0].status), ['completed', 'initiated', 'failed']);
});

test('refunds are not possible on COD / unpaid orders; COD money returned by hand is recorded with a reference', async () => {
    const cod = await placeOrder({ cod: true });
    let r = await asAdmin('POST', `/api/shop/admin/orders/${cod.orderId}/refunds`, {});
    assert.equal(r.status, 409);
    assert.equal(r.json.code, 'REFUND_NOT_ALLOWED');

    r = await asAdmin('POST', `/api/shop/admin/orders/${cod.orderId}/refunds/manual`, { amountPaise: 29800, method: 'manual_upi' });
    assert.equal(r.status, 400);
    assert.equal(r.json.code, 'REFERENCE_REQUIRED');
    r = await asAdmin('POST', `/api/shop/admin/orders/${cod.orderId}/refunds/manual`, { amountPaise: 29800, method: 'cash', reference: 'x123' });
    assert.equal(r.json.code, 'INVALID_REFUND_METHOD');
    r = await asAdmin('POST', `/api/shop/admin/orders/${cod.orderId}/refunds/manual`, { amountPaise: 29800, method: 'manual_upi', reference: 'UPI-4455', reason: 'returned after delivery' });
    assert.equal(r.status, 200);
    assert.equal(r.json.refund.status, 'completed');
    assert.equal(r.json.refund.reference, 'UPI-4455');
    assert.equal(fastrr.callsTo(REFUND).length, 0);
});

test('a refund stuck as "unknown" can be closed by an admin who checked the Fastrr dashboard', async () => {
    const { orderId } = await placeOrder();
    fastrr.state.next.push({ path: REFUND, status: 504, body: {} });
    const r = await asAdmin('POST', `/api/shop/admin/orders/${orderId}/refunds`, {});
    const done = await asAdmin('POST', `/api/shop/admin/orders/${orderId}/refunds/${r.json.refund.refundId}/mark-paid`, { method: 'other', reference: 'Fastrr dashboard RF-889' });
    assert.equal(done.status, 200);
    assert.equal(done.json.refund.status, 'completed');
    assert.equal(byId(orderId).paymentStatus, 'refunded');
});

// ── Store cancel, duplicate payment ────────────────────────────────────────

test('store cancels in Shopify (prepaid) -> refund requested; with auto-refund on it is sent', async () => {
    process.env.SHOP_AUTO_REFUND = 'true';
    const { orderId } = await placeOrder({ items: [[V1, 1, 149900]] });
    shopify.cancel(orderId);
    const raw = JSON.stringify({ id: Number(byId(orderId).shopifyOrderId), tags: `take-app, ${orderId}` });
    const res = await fetch(`${api}/api/shopify/webhooks`, {
        method: 'POST', body: raw, headers: {
            'Content-Type': 'application/json', 'X-Shopify-Topic': 'orders/cancelled', 'X-Shopify-Shop-Domain': 'take-test.myshopify.com',
            'X-Shopify-Hmac-Sha256': crypto.createHmac('sha256', 'test-webhook-secret').update(raw, 'utf8').digest('base64'),
        },
    });
    assert.equal(res.status, 200);
    const o = byId(orderId);
    assert.equal(o.refunds[0].source, 'store_cancel');
    assert.equal(o.refunds[0].status, 'initiated');
    assert.equal(o.cancelledBy, 'store');
});

test('duplicate payment: second Fastrr payment is refunded against ITS Fastrr order; the order stays paid', async () => {
    const user = new mongoose.Types.ObjectId();
    carts.seed({ user, items: [{ variantId: V1, productId: '9001', quantity: 1, addedPrice: 149900 }] });
    const key = `k-${crypto.randomUUID()}`;
    fastrr.state.tokenTtlMs = 60 * 1000;
    const { orderId } = await checkoutService.startCheckout(user, { idempotencyKey: key, baseUrl: 'https://shop.test' });
    fastrr.state.tokenTtlMs = 30 * 60 * 1000;
    await checkoutService.startCheckout(user, { idempotencyKey: key, baseUrl: 'https://shop.test' });
    const [first, second] = byId(orderId).fastrrOrderIds;
    for (const id of [second, first]) {
        fastrr.state.orders.set(id, placedOrder(id, { items: [{ variantId: V1, quantity: 1 }], subtotal: 1499 }));
        await fastrrOrderService.handleWebhook({ order_id: id });
    }
    let o = byId(orderId);
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(o.refunds.length, 1);
    assert.equal(o.refunds[0].kind, 'duplicate_payment');
    assert.equal(o.refunds[0].fastrrOrderId, first);
    assert.equal(o.refunds[0].amount, 149900);
    assert.equal(o.refunds[0].status, 'requested');
    await fastrrOrderService.handleWebhook({ order_id: first }); // replay: no second request
    assert.equal(byId(orderId).refunds.length, 1);

    await asAdmin('POST', `/api/shop/admin/orders/${orderId}/refunds/${o.refunds[0].refundId}/approve`);
    assert.equal(fastrr.callsTo(REFUND)[0].body.order_id, first);
    await settleAll();
    o = byId(orderId);
    assert.equal(o.refunds[0].status, 'completed');
    assert.equal(o.paymentStatus, 'paid'); // the customer's real order is untouched
    assert.equal(shopify.byTag(orderId).refunds.length, 0); // never recorded on the Shopify order
    assert.ok(!events().includes('refunded')); // internal correction, no "your order was refunded" push
    // The order's own payment is still fully refundable:
    assert.equal(refundService.remainingRefundable(o), 149900);
});

// ── Admin access / cron ────────────────────────────────────────────────────

test('admin endpoints: customers get 403; unknown order 404; refund approval when Fastrr is off -> 503', async () => {
    const { orderId, user } = await placeOrder();
    const asUser = await call('POST', `/api/shop/admin/orders/${orderId}/refunds`, { user: String(user), body: {} });
    assert.equal(asUser.status, 403);
    assert.equal((await asAdmin('POST', '/api/shop/admin/orders/TH-261116-ZZZZZZZZ/cancel', {})).status, 404);

    const cancel = await asAdmin('POST', `/api/shop/admin/orders/${orderId}/cancel`, { reason: 'out of stock in warehouse' });
    assert.equal(cancel.status, 200);
    const o = byId(orderId);
    assert.equal(o.cancelledBy, 'admin');
    assert.equal(o.refunds[0].source, 'admin_cancel');
    assert.equal(o.refunds[0].status, 'initiated'); // admin cancel = approved refund
    assert.equal(shopify.byTag(orderId)._cancel.reason, 'STAFF');

    const other = await placeOrder();
    await call('POST', `/api/shop/orders/${other.orderId}/cancel`, { user: String(other.user) });
    delete process.env.FASTRR_API_SECRET;
    try {
        const r = await asAdmin('POST', `/api/shop/admin/orders/${other.orderId}/refunds/${byId(other.orderId).refunds[0].refundId}/approve`);
        assert.equal(r.status, 503);
        assert.equal(r.json.code, 'REFUND_UNAVAILABLE');
        assert.equal(byId(other.orderId).refunds[0].status, 'requested'); // untouched, can approve later
    } finally {
        process.env.FASTRR_API_SECRET = API_SECRET;
    }
});

test('reconciliation cron also syncs refund statuses', async () => {
    const { orderId } = await placeOrder();
    await asAdmin('POST', `/api/shop/admin/orders/${orderId}/refunds`, {});
    fastrr.settleRefund(fastrr.state.refunds[0].ref_id);
    const stats = await fastrrOrderService.reconcile({ log: () => {} });
    assert.equal(stats.refunds.completed, 1);
    assert.equal(byId(orderId).paymentStatus, 'refunded');
});

test('auto-refund rules', () => {
    const { canAutoSend } = refundService._internal;
    assert.equal(canAutoSend('user_cancel', 100), false); // off by default
    process.env.SHOP_AUTO_REFUND = 'true';
    process.env.SHOP_AUTO_REFUND_MAX_RUPEES = '500';
    assert.equal(canAutoSend('user_cancel', 50000), true);
    assert.equal(canAutoSend('user_cancel', 50001), false);
    assert.equal(canAutoSend('admin', 100), false); // admin refunds are approved explicitly, not "auto"
    const { mapReportStatus } = refundService._internal;
    assert.equal(mapReportStatus({ status: 'INITIATED' }), 'initiated');
    assert.equal(mapReportStatus({ status: 'PENDING' }), 'processing');
    assert.equal(mapReportStatus({ status: 'PENDING', refunded: true }), 'completed');
    assert.equal(mapReportStatus({ status: 'SUCCESS' }), 'completed');
    assert.equal(mapReportStatus({ status: 'FAILED' }), 'failed');
});
