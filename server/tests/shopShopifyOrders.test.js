// M3: Shopify order creation, Shopify -> us order updates, stock reservation,
// push notifications. Real services + real routes; in-memory Mongo fake, local
// Shopify Admin API mock and local Fastrr mock. Nothing touches a real store.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const http = require('http');
const mongoose = require('mongoose');
const express = require('express');

const { FakeCollection } = require('./helpers/fakeMongo');
const { startFastrrMock, placedOrder, API_KEY, API_SECRET } = require('./helpers/fastrrMock');
const { startShopifyMock, TOKEN: SHOPIFY_TOKEN } = require('./helpers/shopifyMock');

const V1 = '57199514222897'; // Berberine 1 pack ₹1499, stock 20
const V3 = '57199514222899'; // Berberine 3 pack ₹4497, stock 1
const V9 = '777';            // Magnesium ₹99, untracked

const ENV = {
    FASTRR_API_KEY: API_KEY, FASTRR_API_SECRET: API_SECRET, FASTRR_TIMEOUT_MS: '3000', FASTRR_CATALOG_PUSH: 'false',
    JWT_SECRET: 'test-jwt-secret', SHOP_PUBLIC_BASE_URL: 'https://shop.test',
    SHOPIFY_ADMIN_STORE_DOMAIN: 'take-test.myshopify.com', SHOPIFY_ADMIN_TOKEN: SHOPIFY_TOKEN, SHOPIFY_API_VERSION: '2026-10',
    SHOPIFY_WEBHOOK_SECRET: 'test-webhook-secret', SHOPIFY_CLIENT_SECRET: undefined,
    SHOP_SHOPIFY_ORDER_SYNC: 'true', SHOP_SHOPIFY_TEST_ORDERS: undefined, SHOP_SHOPIFY_SEND_RECEIPT: undefined,
    SHOP_SHOPIFY_SYNC_MAX_ATTEMPTS: undefined, SHOP_APP_ORDERS_CARD_OFFER: undefined, SHOP_ORDER_PUSH: undefined,
    SHOP_RESERVATION_MINUTES: undefined, SHOP_HIDE_SUBSCRIBE_VARIANTS: undefined,
    QSTASH_TOKEN: undefined, QSTASH_CURRENT_SIGNING_KEY: undefined, REDIS_URL: undefined,
};
const savedEnv = {};
for (const [k, v] of Object.entries(ENV)) { savedEnv[k] = process.env[k]; if (v === undefined) delete process.env[k]; else process.env[k] = v; }

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
const offerCalls = [];
let fastrr;
let shopify;
let server;
let base;

const mapper = require('../modules/shop/lib/shopifyOrderMapper');
const { stateCode } = require('../modules/shop/lib/indiaStates');
const client = require('../modules/shop/services/shopifyOrderClient');
const sync = require('../modules/shop/services/shopifyOrderSyncService');
const checkoutService = require('../modules/shop/services/checkoutService');
const fastrrOrderService = require('../modules/shop/services/fastrrOrderService');
const { newInternalOrderId } = require('../modules/shop/lib/checkoutLogic');
const { ShopifyApiError } = require('../services/shopifyAdminService');

test.before(async () => {
    fastrr = await startFastrrMock();
    process.env.FASTRR_BASE_URL = fastrr.baseUrl;
    shopify = await startShopifyMock({ variants: { [V1]: 20, [V3]: 1, [V9]: 100 } });
    process.env.SHOPIFY_ADMIN_API_BASE_URL = shopify.baseUrl;
    for (const c of [orders, carts, products, holds]) restores.push(c.install());
    const origSend = fcm.sendToUser;
    const origOffer = offer.handleWebhook;
    fcm.sendToUser = async (userId, p) => { pushes.push({ userId: String(userId), ...p }); return { success: true }; };
    offer.handleWebhook = async ({ topic }) => { offerCalls.push(topic); return { ignored: 'stub' }; };
    restores.push(() => { fcm.sendToUser = origSend; offer.handleWebhook = origOffer; });

    const app = express();
    app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf.toString('utf8'); } }));
    app.use('/api/shopify', require('../routes/shopifyWebhookRoutes'));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    restores.forEach((r) => r());
    await new Promise((r) => server.close(r));
    await fastrr.close();
    await shopify.close();
    for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    delete process.env.FASTRR_BASE_URL;
    delete process.env.SHOPIFY_ADMIN_API_BASE_URL;
});

const seedCatalog = () => {
    products.seed({
        shopifyProductId: '9001', handle: 'berberine', title: 'Berberine', status: 'active', images: [{ url: 'https://cdn/b.jpg' }],
        variants: [
            { shopifyVariantId: V1, title: '1 pack', price: 149900, inventoryQty: 20 },
            { shopifyVariantId: V3, title: '3 pack', price: 449700, inventoryQty: 1 },
        ],
        minPrice: 149900,
    });
    products.seed({
        shopifyProductId: '9002', handle: 'magnesium', title: 'Magnesium', status: 'active', images: [],
        variants: [{ shopifyVariantId: V9, title: 'Default Title', price: 9900, inventoryTracked: false }],
        minPrice: 9900,
    });
};

test.beforeEach(() => {
    orders.docs = []; carts.docs = []; products.docs = []; holds.docs = [];
    pushes.length = 0; offerCalls.length = 0;
    fastrr.reset(); shopify.reset();
    process.env.SHOP_SHOPIFY_ORDER_SYNC = 'true';
    seedCatalog();
});

const ADDRESS = { firstName: 'Amish', lastName: 'K', phone: '9876543210', line1: 'Flat 1, Tower A', line2: 'MG Road', landmark: 'Near park', city: 'Pune', state: 'Maharashtra', pincode: '411001', country: 'India' };
const ago = (ms) => new Date(Date.now() - ms);
const MIN = 60 * 1000;

/** A confirmed order as M2 leaves it (paid / COD, Shopify sync pending). */
const confirmedOrder = (over = {}) => orders.seed({
    internalOrderId: newInternalOrderId(),
    user: new mongoose.Types.ObjectId(),
    idempotencyKey: `k-${crypto.randomUUID()}`,
    items: [{ variantId: V1, productId: '9001', title: 'Berberine', variantTitle: '1 pack', quantity: 2, priceSnapshot: 149900 }],
    amount: 299800,
    pricing: { subtotal: 299800, discount: 0, shipping: 0, codCharges: 0, total: 299800, couponCodes: [] },
    paymentMethod: 'prepaid',
    paymentStatus: 'paid',
    shopifySyncStatus: 'pending',
    paidFastrrOrderId: 'fo123',
    customer: { phone: '9876543210', email: 'amish@example.com' },
    shippingAddress: ADDRESS,
    billingAddress: ADDRESS,
    payment: { gateway: 'Razorpay', method: 'UPI', pgTransactionId: 'pay_ABC', amountReceived: 299800 },
    ...over,
});
const get = (o) => orders.raw({ _id: o._id });

// ── Mapper (pure) ──────────────────────────────────────────────────────────

test('mapper: prepaid order -> Shopify input with our prices, SALE transaction, stock decrement, no customer email', () => {
    const o = confirmedOrder();
    const { order: input, options } = mapper.toOrderCreateVariables(o);
    assert.deepEqual(input.lineItems, [{ variantId: `gid://shopify/ProductVariant/${V1}`, quantity: 2, priceSet: { shopMoney: { amount: '1499.00', currencyCode: 'INR' } } }]);
    assert.deepEqual(input.tags, ['take-app', o.internalOrderId, 'Prepaid']);
    assert.equal(input.transactions[0].kind, 'SALE');
    assert.equal(input.transactions[0].status, 'SUCCESS');
    assert.equal(input.transactions[0].amountSet.shopMoney.amount, '2998.00');
    assert.equal(input.transactions[0].authorizationCode, 'pay_ABC');
    assert.equal('financialStatus' in input, false);
    assert.equal(input.phone, '+919876543210');
    assert.deepEqual(input.shippingAddress, {
        firstName: 'Amish', lastName: 'K', address1: 'Flat 1, Tower A', address2: 'MG Road, Near park', city: 'Pune',
        zip: '411001', countryCode: 'IN', provinceCode: 'MH', phone: '+919876543210',
    });
    assert.equal(input.taxesIncluded, true);
    assert.equal(input.test, false);
    assert.equal(input.sourceIdentifier, o.internalOrderId);
    assert.deepEqual(options, { inventoryBehaviour: 'DECREMENT_IGNORING_POLICY', sendReceipt: false, sendFulfillmentReceipt: false });
});

test('mapper: COD -> PENDING with no transaction; shipping, COD charge and coupon go across', () => {
    const o = confirmedOrder({
        paymentMethod: 'cod', paymentStatus: 'cod_pending', payment: undefined,
        pricing: { subtotal: 299800, discount: 10000, shipping: 4900, codCharges: 5000, total: 299800 - 10000 + 4900 + 5000, couponCodes: ['SAVE100'] },
    });
    const { order: input } = mapper.toOrderCreateVariables(o, { test: true });
    assert.equal(input.financialStatus, 'PENDING');
    assert.equal('transactions' in input, false);
    assert.deepEqual(input.shippingLines.map((s) => [s.title, s.priceSet.shopMoney.amount]), [['Shipping', '49.00'], ['COD charges', '50.00']]);
    assert.deepEqual(input.discountCode, { itemFixedDiscountCode: { code: 'SAVE100', amountSet: { shopMoney: { amount: '100.00', currencyCode: 'INR' } } } });
    assert.ok(input.tags.includes('COD'));
    assert.equal(input.test, true);
});

test('mapper: a phone Shopify would reject is left out (kept in the note); unknown state -> no province', () => {
    const o = confirmedOrder({ customer: { phone: '12345', email: 'a@b.c' }, shippingAddress: { ...ADDRESS, phone: '12345', state: 'Atlantis' } });
    const { order: input } = mapper.toOrderCreateVariables(o);
    assert.equal('phone' in input, false);
    assert.equal('phone' in input.shippingAddress, false);
    assert.equal('provinceCode' in input.shippingAddress, false);
    assert.match(input.note, /Phone: 12345/);
});

test('mapper: Indian states and phone numbers', () => {
    for (const [name, code] of [['Maharashtra', 'MH'], ['delhi', 'DL'], ['NCT of Delhi', 'DL'], ['Tamil  Nadu', 'TN'], ['Jammu & Kashmir', 'JK'], ['Telangana', 'TS'], ['Odisha', 'OR'], ['MH', 'MH'], ['ZZ', null], ['', null]]) {
        assert.equal(stateCode(name), code, name);
    }
    for (const [p, e] of [['9876543210', '+919876543210'], ['+91 98765 43210', '+919876543210'], ['09876543210', '+919876543210'], ['919876543210', '+919876543210'], ['5876543210', null], ['123', null], [null, null]]) {
        assert.equal(mapper.e164(p), e, String(p));
    }
});

test('mapper: Shopify order -> our status (shipped, delivered, partial, cancelled, COD paid, tracking)', () => {
    const f = (o) => mapper.readShopifyOrder(o);
    assert.equal(f({ displayFulfillmentStatus: 'UNFULFILLED', fulfillments: [] }).fulfillment, null);
    assert.equal(f({ displayFulfillmentStatus: 'PARTIALLY_FULFILLED', fulfillments: [{ displayStatus: 'IN_TRANSIT' }] }).fulfillment, 'partial');
    const shipped = f({ displayFulfillmentStatus: 'FULFILLED', fulfillments: [{ displayStatus: 'IN_TRANSIT', trackingInfo: [{ company: 'Delhivery', number: 'AWB1', url: 'https://t/1' }] }] });
    assert.equal(shipped.fulfillment, 'fulfilled');
    assert.deepEqual(shipped.tracking, { number: 'AWB1', url: 'https://t/1', courier: 'Delhivery' });
    const delivered = f({ displayFulfillmentStatus: 'FULFILLED', fulfillments: [{ displayStatus: 'DELIVERED', deliveredAt: '2026-11-20T10:00:00Z' }] });
    assert.equal(delivered.fulfillment, 'delivered');
    assert.equal(delivered.deliveredAt.toISOString(), '2026-11-20T10:00:00.000Z');
    assert.equal(f({ displayFulfillmentStatus: 'FULFILLED', fulfillments: [{ displayStatus: 'DELIVERED' }, { displayStatus: 'IN_TRANSIT' }] }).fulfillment, 'fulfilled');
    assert.equal(f({ cancelledAt: '2026-11-16T00:00:00Z' }).cancelled, true);
    assert.equal(f({ displayFinancialStatus: 'PAID' }).financialPaid, true);
});

test('client: which Shopify failures are worth retrying', () => {
    assert.equal(client.isTransient(new Error('fetch failed')), true);
    assert.equal(client.isTransient(new ShopifyApiError('x', [], 502)), true);
    assert.equal(client.isTransient(new ShopifyApiError('x', [], 429)), true);
    assert.equal(client.isTransient(new ShopifyApiError('x', [], 401)), false);
    assert.equal(client.isTransient(new ShopifyApiError('x', [], 403)), false);
    assert.equal(client.isTransient(new ShopifyApiError('x', [{ extensions: { code: 'ACCESS_DENIED' } }], 200)), false);
    assert.equal(client.isTransient(new ShopifyApiError('x', [{ message: 'Variable $order invalid' }], 200)), false);
    assert.equal(client.isTransient(new ShopifyApiError('x', [{ extensions: { code: 'THROTTLED' } }], 200)), true);
});

test('state path: multi-step fulfilment moves', () => {
    assert.deepEqual(sync._internal.pathTo('fulfillmentStatus', 'unfulfilled', 'delivered'), ['fulfilled', 'delivered']);
    assert.deepEqual(sync._internal.pathTo('fulfillmentStatus', 'partial', 'delivered'), ['fulfilled', 'delivered']);
    assert.deepEqual(sync._internal.pathTo('fulfillmentStatus', 'delivered', 'cancelled'), []);
    assert.deepEqual(sync._internal.pathTo('fulfillmentStatus', 'fulfilled', 'fulfilled'), []);
});

// ── Creating the Shopify order ─────────────────────────────────────────────

test('sync: flag OFF (default until Fastrr confirms) -> nothing is sent to Shopify', async () => {
    delete process.env.SHOP_SHOPIFY_ORDER_SYNC;
    const o = confirmedOrder();
    assert.deepEqual(await sync.syncOrder(o._id), { result: 'skipped:disabled' });
    assert.equal(await sync.enqueue(o), 'disabled');
    assert.deepEqual(await sync.sweep(), { attempted: 0, synced: 0, failed: 0, needsAttention: 0 });
    assert.equal(shopify.state.calls.length, 0);
    assert.equal(get(o).shopifySyncStatus, 'pending');
});

test('sync: paid order -> Shopify order created, stock reduced in Shopify, ids saved, hold shortened', async () => {
    const o = confirmedOrder();
    holds.seed({ order: o._id, variantId: V1, quantity: 2, expiresAt: new Date(Date.now() + 24 * 60 * MIN) });
    assert.deepEqual(await sync.syncOrder(o._id), { result: 'synced' });
    const after = get(o);
    assert.equal(after.shopifySyncStatus, 'synced');
    assert.equal(after.shopifyOrderId, '6000000000001');
    assert.equal(after.shopifyOrderName, '#TAKE11001');
    assert.equal(after.shopifySyncAttempts, 1);
    assert.equal(after.shopifySyncLeaseUntil, null);
    assert.equal(shopify.state.inventory[V1], 18);
    assert.equal(shopify.byTag(o.internalOrderId).displayFinancialStatus, 'PAID');
    assert.ok(holds.docs[0].expiresAt.getTime() < Date.now() + 3 * MIN);
    assert.deepEqual(shopify.callsOf('search').length, 1); // looked for an existing one first
});

test('sync: running again never creates a second Shopify order', async () => {
    const o = confirmedOrder();
    await sync.syncOrder(o._id);
    assert.deepEqual(await sync.syncOrder(o._id), { result: 'skipped:not-claimable' });
    get(o).updatedAt = ago(10 * MIN);
    await sync.sweep();
    assert.equal(shopify.callsOf('create').length, 1);
    assert.equal(shopify.state.orders.length, 1);
});

test('sync: Shopify created it but the response was lost -> retry finds it by tag and adopts it (no duplicate)', async () => {
    const o = confirmedOrder();
    shopify.state.next.push({ op: 'create', createThenFail: true, status: 502 });
    assert.deepEqual(await sync.syncOrder(o._id), { result: 'failed' });
    assert.equal(shopify.state.orders.length, 1); // exists in Shopify already
    assert.equal(get(o).shopifySyncStatus, 'failed');

    assert.equal((await sync.sweep()).attempted, 0); // too soon: wait 2 min before retrying
    get(o).updatedAt = ago(3 * MIN);
    const stats = await sync.sweep();
    assert.equal(stats.synced, 1);
    assert.equal(get(o).shopifySyncStatus, 'synced');
    assert.equal(shopify.state.orders.length, 1);
    assert.equal(shopify.callsOf('create').length, 1);
    assert.equal(shopify.state.inventory[V1], 18); // stock reduced once
});

test('sync: Shopify down -> failed, retried later, then synced', async () => {
    const o = confirmedOrder();
    shopify.state.next.push({ op: 'search', status: 503, body: {} });
    assert.equal((await sync.syncOrder(o._id)).result, 'failed');
    assert.match(get(o).shopifySyncError, /503/);
    get(o).updatedAt = ago(3 * MIN);
    await sync.sweep();
    assert.equal(get(o).shopifySyncStatus, 'synced');
    assert.equal(get(o).shopifySyncError, null);
});

test('sync: Shopify rejects the order (validation) -> needs_attention at once, with an alert', async () => {
    const o = confirmedOrder({ items: [{ variantId: '999999', quantity: 1, priceSnapshot: 100, title: 'Ghost' }], amount: 100 });
    assert.equal((await sync.syncOrder(o._id)).result, 'needs_attention');
    assert.match(get(o).shopifySyncError, /Variant not found/);
    get(o).updatedAt = ago(10 * MIN);
    assert.equal((await sync.sweep()).attempted, 0); // a human must look; no blind retries
});

test('sync: bad token (401) is permanent -> needs_attention', async () => {
    process.env.SHOPIFY_ADMIN_TOKEN = 'wrong';
    try {
        const o = confirmedOrder();
        assert.equal((await sync.syncOrder(o._id)).result, 'needs_attention');
    } finally {
        process.env.SHOPIFY_ADMIN_TOKEN = SHOPIFY_TOKEN;
    }
});

test('sync: gives up after max attempts', async () => {
    process.env.SHOP_SHOPIFY_SYNC_MAX_ATTEMPTS = '3';
    try {
        const o = confirmedOrder();
        const results = [];
        for (let i = 0; i < 3; i++) {
            shopify.state.next.push({ op: 'search', status: 500, body: {} });
            get(o).updatedAt = ago(3 * MIN);
            results.push((await sync.syncOrder(o._id)).result);
        }
        assert.deepEqual(results, ['failed', 'failed', 'needs_attention']);
        assert.equal(shopify.callsOf('create').length, 0);
    } finally {
        delete process.env.SHOP_SHOPIFY_SYNC_MAX_ATTEMPTS;
    }
});

test('sync: two workers at once (QStash + cron) -> one Shopify order', async () => {
    const o = confirmedOrder();
    get(o).updatedAt = ago(5 * MIN);
    const r = await Promise.all([sync.syncOrder(o._id), sync.syncOrder(o._id), sync.sweep()]);
    assert.equal(shopify.state.orders.length, 1);
    assert.equal(get(o).shopifySyncStatus, 'synced');
    assert.equal(r.filter((x) => x.result === 'synced').length + (r[2].synced || 0), 1);
});

test('sync: held-for-review, unpaid or already-cancelled orders are never sent', async () => {
    const flagged = confirmedOrder({ review: { needed: true, reasons: ['SUBTOTAL_MISMATCH'] } });
    const pending = confirmedOrder({ paymentStatus: 'pending', shopifySyncStatus: 'not_started' });
    const cancelled = confirmedOrder({ paymentStatus: 'cancelled' });
    for (const o of [flagged, pending, cancelled]) assert.equal((await sync.syncOrder(o._id)).result, 'skipped:not-claimable');
    assert.equal(shopify.state.calls.length, 0);
});

test('sync: test-order flag marks orders as Shopify test orders', async () => {
    process.env.SHOP_SHOPIFY_TEST_ORDERS = 'true';
    try {
        const o = confirmedOrder();
        await sync.syncOrder(o._id);
        assert.equal(shopify.byTag(o.internalOrderId).test, true);
        assert.equal(shopify.byTag(o.internalOrderId)._variables.order.transactions[0].test, true);
    } finally {
        delete process.env.SHOP_SHOPIFY_TEST_ORDERS;
    }
});

// ── End to end: Fastrr payment -> Shopify order ────────────────────────────

const checkout = async (user, items) => {
    carts.docs = carts.docs.filter((c) => String(c.user) !== String(user));
    carts.seed({ user, items: items.map(([variantId, quantity, price]) => ({ variantId, productId: variantId === V9 ? '9002' : '9001', quantity, addedPrice: price })) });
    return checkoutService.startCheckout(user, { idempotencyKey: `k-${crypto.randomUUID()}`, baseUrl: 'https://shop.test' });
};
const payFor = async (orderId, { cod = false } = {}) => {
    const o = orders.raw({ internalOrderId: orderId });
    fastrr.state.orders.set(o.fastrrOrderId, placedOrder(o.fastrrOrderId, {
        items: o.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })), subtotal: o.amount / 100, cod,
    }));
    return fastrrOrderService.handleWebhook({ order_id: o.fastrrOrderId });
};

test('e2e: Amish pays -> Shopify order created right away (no QStash locally), confirmed push sent', async () => {
    const user = new mongoose.Types.ObjectId();
    const { orderId } = await checkout(user, [[V1, 2, 149900]]);
    await payFor(orderId);
    const o = orders.raw({ internalOrderId: orderId });
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(o.shopifySyncStatus, 'synced');
    assert.equal(shopify.byTag(orderId)._variables.order.shippingAddress.provinceCode, 'MH');
    assert.equal(shopify.state.inventory[V1], 18);
    assert.deepEqual(pushes.map((p) => p.data.event), ['confirmed']);
});

test('e2e: Shopify down at payment time -> order is still paid; cron creates it later', async () => {
    const user = new mongoose.Types.ObjectId();
    const { orderId } = await checkout(user, [[V1, 1, 149900]]);
    shopify.state.next.push({ op: 'search', status: 502, body: {} });
    await payFor(orderId);
    const o = orders.raw({ internalOrderId: orderId });
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(o.shopifySyncStatus, 'failed');
    o.updatedAt = ago(3 * MIN);
    await fastrrOrderService.reconcile({ log: () => {} });
    assert.equal(orders.raw({ internalOrderId: orderId }).shopifySyncStatus, 'synced');
});

// ── Shopify -> us (via the real, signed webhook route) ─────────────────────

const shopifyWebhook = async (topic, body) => {
    const raw = JSON.stringify(body);
    const res = await fetch(`${base}/api/shopify/webhooks`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Topic': topic,
            'X-Shopify-Shop-Domain': 'take-test.myshopify.com',
            'X-Shopify-Hmac-Sha256': crypto.createHmac('sha256', 'test-webhook-secret').update(raw, 'utf8').digest('base64'),
            'X-Shopify-Webhook-Id': crypto.randomUUID(),
        },
        body: raw,
    });
    return { status: res.status, json: await res.json().catch(() => null) };
};

const syncedOrder = async (over = {}) => {
    const o = confirmedOrder(over);
    await sync.syncOrder(o._id);
    return get(o);
};

test('webhook: shipped -> fulfilled + tracking + one "shipped" push (replays change nothing)', async () => {
    const o = await syncedOrder();
    shopify.fulfil(o.internalOrderId);
    let r = await shopifyWebhook('fulfillments/create', { id: 1, order_id: Number(o.shopifyOrderId) });
    assert.equal(r.status, 200);
    let after = get(o);
    assert.equal(after.fulfillmentStatus, 'fulfilled');
    assert.deepEqual(after.tracking, { number: 'AWB123', url: 'https://track/AWB123', courier: 'Delhivery' });
    r = await shopifyWebhook('orders/fulfilled', { id: Number(o.shopifyOrderId), tags: `take-app, ${o.internalOrderId}, Prepaid` });
    assert.equal(r.status, 200);
    after = get(o);
    assert.equal(after.statusHistory.filter((h) => h.status === 'fulfilled').length, 1);
    assert.deepEqual(pushes.map((p) => p.data.event), ['shipped']);
    assert.match(pushes[0].body, /Delhivery/);
    assert.deepEqual(offerCalls, []); // orders/fulfilled isn't a card-offer topic
});

test('webhook: delivered straight from unfulfilled -> fulfilled then delivered; shipped + delivered pushes', async () => {
    const o = await syncedOrder();
    shopify.fulfil(o.internalOrderId);
    shopify.deliver(o.internalOrderId);
    await shopifyWebhook('fulfillments/update', { id: 1, order_id: Number(o.shopifyOrderId) });
    const after = get(o);
    assert.equal(after.fulfillmentStatus, 'delivered');
    assert.ok(after.deliveredAt instanceof Date);
    assert.deepEqual(after.statusHistory.filter((h) => h.field === 'fulfillmentStatus').map((h) => h.status), ['fulfilled', 'delivered']);
    assert.deepEqual(pushes.map((p) => p.data.event), ['shipped', 'delivered']);
});

test('webhook: COD cash collected (Shopify marks paid) -> paid; card offer still gets orders/paid', async () => {
    const o = await syncedOrder({ paymentMethod: 'cod', paymentStatus: 'cod_pending', payment: undefined });
    assert.equal(shopify.byTag(o.internalOrderId).displayFinancialStatus, 'PENDING');
    shopify.markPaid(o.internalOrderId);
    const r = await shopifyWebhook('orders/paid', { id: Number(o.shopifyOrderId), tags: `take-app, ${o.internalOrderId}, COD` });
    assert.equal(r.status, 200);
    assert.equal(get(o).paymentStatus, 'paid');
    assert.deepEqual(offerCalls, ['orders/paid']);
});

test('webhook: SHOP_APP_ORDERS_CARD_OFFER=false keeps app orders away from the card offer', async () => {
    process.env.SHOP_APP_ORDERS_CARD_OFFER = 'false';
    try {
        const o = await syncedOrder();
        await shopifyWebhook('orders/paid', { id: Number(o.shopifyOrderId), tags: `take-app, ${o.internalOrderId}` });
        assert.deepEqual(offerCalls, []);
        await shopifyWebhook('orders/paid', { id: 123, tags: 'website' }); // normal store order: unchanged
        assert.deepEqual(offerCalls, ['orders/paid']);
    } finally {
        delete process.env.SHOP_APP_ORDERS_CARD_OFFER;
    }
});

test('webhook: store cancels a COD order -> cancelled, stock hold released, push sent', async () => {
    const o = await syncedOrder({ paymentMethod: 'cod', paymentStatus: 'cod_pending', payment: undefined });
    holds.seed({ order: o._id, variantId: V1, quantity: 2, expiresAt: new Date(Date.now() + MIN) });
    shopify.cancel(o.internalOrderId);
    await shopifyWebhook('orders/cancelled', { id: Number(o.shopifyOrderId), tags: `take-app, ${o.internalOrderId}` });
    const after = get(o);
    assert.equal(after.fulfillmentStatus, 'cancelled');
    assert.equal(after.paymentStatus, 'cancelled');
    assert.equal(holds.docs.length, 0);
    assert.deepEqual(pushes.map((p) => p.data.event), ['cancelled']);
});

test('webhook: store cancels a PREPAID order -> flagged "refund due" for a human (refunds are M4)', async () => {
    const o = await syncedOrder();
    shopify.cancel(o.internalOrderId);
    await shopifyWebhook('orders/cancelled', { id: Number(o.shopifyOrderId), tags: `take-app, ${o.internalOrderId}` });
    const after = get(o);
    assert.equal(after.paymentStatus, 'paid');
    assert.equal(after.review.needed, true);
    assert.deepEqual(after.review.reasons, ['CANCELLED_IN_SHOPIFY_REFUND_DUE']);
});

test('webhook: orders/create for our order heals a sync that never got recorded', async () => {
    const o = confirmedOrder();
    shopify.state.next.push({ op: 'create', createThenFail: true, status: 502 });
    await sync.syncOrder(o._id);
    assert.equal(get(o).shopifySyncStatus, 'failed');
    const node = shopify.byTag(o.internalOrderId);
    await shopifyWebhook('orders/create', { id: Number(node.legacyResourceId), tags: `take-app, ${o.internalOrderId}, Prepaid` });
    assert.equal(get(o).shopifySyncStatus, 'synced');
    assert.equal(get(o).shopifyOrderId, node.legacyResourceId);
});

test('webhook: non-app store orders and bad signatures are untouched', async () => {
    let r = await shopifyWebhook('fulfillments/create', { id: 5, order_id: 424242 });
    assert.equal(r.status, 200);
    r = await shopifyWebhook('orders/create', { id: 777, tags: 'website' });
    assert.equal(r.status, 200);
    assert.deepEqual(offerCalls, ['orders/create']); // still goes to the card offer as before
    const bad = await fetch(`${base}/api/shopify/webhooks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Topic': 'orders/fulfilled', 'X-Shopify-Hmac-Sha256': 'forged' }, body: '{}',
    });
    assert.equal(bad.status, 401);
});

test('webhook: Shopify fetch-back failing -> 500 so Shopify retries', async () => {
    const o = await syncedOrder();
    shopify.state.next.push({ op: 'fetch', status: 503, body: {} });
    const r = await shopifyWebhook('fulfillments/create', { id: 1, order_id: Number(o.shopifyOrderId) });
    assert.equal(r.status, 500);
});

// ── Stock reservation (Amish vs Riya for the last 3-pack) ──────────────────

test('reservation: Amish is paying for the last 3-pack -> Riya gets STOCK_UNAVAILABLE instead of paying', async () => {
    const amish = new mongoose.Types.ObjectId();
    const riya = new mongoose.Types.ObjectId();
    const a = await checkout(amish, [[V3, 1, 449700]]);
    assert.equal(holds.docs.length, 1);
    await assert.rejects(checkout(riya, [[V3, 1, 449700]]), (e) => e.code === 'STOCK_UNAVAILABLE' && e.status === 409 && e.details.availableQty === 0);
    assert.equal(fastrr.callsTo('/api/v1/access-token/checkout').length, 1); // Riya never reached Fastrr
    assert.equal(holds.docs.length, 1); // her failed hold was removed
    assert.equal(a.status, 'awaiting_payment');
});

test('reservation: hold follows the Fastrr token; after it expires Riya can buy', async () => {
    const amish = new mongoose.Types.ObjectId();
    const riya = new mongoose.Types.ObjectId();
    const a = await checkout(amish, [[V3, 1, 449700]]);
    const tokenExp = orders.raw({ internalOrderId: a.orderId }).fastrrTokenExpiresAt.getTime();
    assert.equal(holds.docs[0].expiresAt.getTime(), tokenExp + 5 * MIN);
    holds.docs[0].expiresAt = ago(1000); // Amish walked away
    const r = await checkout(riya, [[V3, 1, 449700]]);
    assert.equal(r.status, 'awaiting_payment');
});

test('reservation: two people tapping at the same moment for the last unit never both get it', async () => {
    for (let round = 0; round < 10; round++) {
        holds.docs = [];
        const users = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
        const r = await Promise.allSettled(users.map((u) => checkout(u, [[V3, 1, 449700]])));
        const winners = r.filter((x) => x.status === 'fulfilled').length;
        assert.ok(winners <= 1, `round ${round}: ${winners} winners`);
        r.filter((x) => x.status === 'rejected').forEach((x) => assert.equal(x.reason.code, 'STOCK_UNAVAILABLE'));
        const active = holds.docs.filter((h) => h.expiresAt > new Date()).reduce((n, h) => n + h.quantity, 0);
        assert.ok(active <= 1);
    }
});

test('reservation: paid -> held 24h until Shopify has it, then 2 min', async () => {
    process.env.SHOP_SHOPIFY_ORDER_SYNC = 'false';
    const amish = new mongoose.Types.ObjectId();
    const a = await checkout(amish, [[V3, 1, 449700]]);
    await payFor(a.orderId);
    assert.ok(holds.docs[0].expiresAt.getTime() > Date.now() + 23 * 60 * MIN);
    process.env.SHOP_SHOPIFY_ORDER_SYNC = 'true';
    await sync.syncOrder(orders.raw({ internalOrderId: a.orderId })._id);
    assert.ok(holds.docs[0].expiresAt.getTime() < Date.now() + 3 * MIN);
});

test('reservation: untracked products need no hold; Fastrr failure releases the hold', async () => {
    const u = new mongoose.Types.ObjectId();
    await checkout(u, [[V9, 5, 9900]]);
    assert.equal(holds.docs.length, 0);
    fastrr.state.next.push({ path: '/api/v1/access-token/checkout', status: 503, body: {} }, { path: '/api/v1/access-token/checkout', status: 503, body: {} });
    await assert.rejects(checkout(new mongoose.Types.ObjectId(), [[V3, 1, 449700]]), (e) => e.code === 'CHECKOUT_PROVIDER_ERROR');
    assert.equal(holds.docs.length, 0);
});

test('reservation: abandoned checkout expired by the cron releases its hold', async () => {
    const a = await checkout(new mongoose.Types.ObjectId(), [[V3, 1, 449700]]);
    const raw = orders.raw({ internalOrderId: a.orderId });
    raw.createdAt = ago(60 * MIN);
    raw.fastrrTokenExpiresAt = ago(20 * MIN);
    await fastrrOrderService.reconcile({ log: () => {} });
    assert.equal(orders.raw({ internalOrderId: a.orderId }).paymentStatus, 'expired');
    assert.equal(holds.docs.length, 0);
});
