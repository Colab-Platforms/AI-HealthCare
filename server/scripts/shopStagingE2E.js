/**
 * Shop end-to-end check against the REAL staging MongoDB, through the real
 * routes and the real `protect` (real JWT). Fastrr is a local mock (with HMAC
 * check) until staging keys arrive. Run from server/:
 *
 *   node scripts/shopStagingE2E.js            # run + clean up
 *   node scripts/shopStagingE2E.js --keep     # leave the test user / orders for inspection
 *
 * Safety:
 *   - refuses to run unless USE_STAGING_DB=true AND the database name ends with "staging"
 *   - never writes to the catalog (shop_products / shop_collections are read only)
 *   - creates one throwaway user (shop-e2e-<time>@example.invalid) and only
 *     touches that user's cart and orders; deletes all of it at the end
 *   - does not run the reconciliation cron (it would scan other staging orders)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

if (process.env.USE_STAGING_DB !== 'true' || !process.env.MONGODB_URI_STAGING) {
    console.error('Refusing to run: needs USE_STAGING_DB=true and MONGODB_URI_STAGING (staging only).');
    process.exit(1);
}

const http = require('http');
const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFastrrMock, placedOrder, fastrrOrder, API_KEY, API_SECRET } = require('../tests/helpers/fastrrMock');

const KEEP = process.argv.includes('--keep');
const results = [];
let failures = 0;

const check = (label, cond, detail = '') => {
    results.push({ ok: Boolean(cond), label, detail });
    if (!cond) failures += 1;
    console.log(`${cond ? '  PASS' : '  FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};

async function main() {
    // Fastrr mock + local-only settings BEFORE the shop modules load their config.
    const mock = await startFastrrMock();
    Object.assign(process.env, { FASTRR_BASE_URL: mock.baseUrl, FASTRR_API_KEY: API_KEY, FASTRR_API_SECRET: API_SECRET, FASTRR_CATALOG_PUSH: 'false' });
    delete process.env.REDIS_URL; // per-process rate limits; don't touch shared Redis

    const connectDB = require('../config/db');
    await connectDB();
    const dbName = mongoose.connection.name;
    if (!/staging$/i.test(dbName)) {
        console.error(`Refusing to continue: connected database "${dbName}" is not a staging database.`);
        process.exit(1);
    }
    console.log(`\nDB: ${mongoose.connection.host} / ${dbName}\n`);

    const User = require('../models/User');
    const Order = require('../models/Order');
    const Cart = require('../modules/shop/models/Cart');
    const Product = require('../modules/shop/models/Product');
    const { isHiddenVariant, availableQty } = require('../modules/shop/lib/catalogMapper');

    await Order.createIndexes();
    const idx = await Order.collection.indexes();
    check('orders has unique {user, idempotencyKey} index', idx.some((i) => i.unique && i.key.user === 1 && i.key.idempotencyKey === 1));
    check('orders has fastrrOrderIds index', idx.some((i) => i.key.fastrrOrderIds === 1));

    // Pick a real sellable variant from the staging catalog (read only).
    const prods = await Product.find({ status: 'active' }).lean();
    let pick = null;
    for (const p of prods) {
        const v = (p.variants || []).find((x) => !isHiddenVariant(x) && availableQty(p, x) >= 3);
        if (v) { pick = { p, v }; break; }
    }
    if (!pick) throw new Error('No active staging product with a visible variant and stock >= 3');
    const { p: product, v: variant } = pick;
    console.log(`Catalog: ${prods.length} active product(s); using "${product.title}" / "${variant.title}" ₹${variant.price / 100}\n`);

    // Throwaway user + real JWT (real `protect` loads it from staging).
    const email = `shop-e2e-${Date.now()}@example.invalid`;
    const user = await User.create({ name: 'Shop E2E (delete me)', email, password: crypto.randomBytes(16).toString('hex') });
    const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '30m' });

    const app = express();
    app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf.toString('utf8'); } }));
    app.use('/api/shop', require('../modules/shop/routes'));
    const server = http.createServer(app);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    process.env.SHOP_PUBLIC_BASE_URL = base;
    const api = `${base}/api/shop`;

    const call = async (method, p, { auth = true, headers = {}, body } = {}) => {
        const res = await fetch(`${api}${p}`, {
            method,
            headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth ? { Authorization: `Bearer ${token}` } : {}), ...headers },
            body: body ? JSON.stringify(body) : undefined,
        });
        const text = await res.text();
        let json = null;
        try { json = JSON.parse(text); } catch { /* html */ }
        return { status: res.status, json, text };
    };
    const V = variant.shopifyVariantId;
    const price = variant.price;

    try {
        console.log('1. Browsing');
        let r = await call('GET', '/products', { auth: false });
        check('GET /products -> 200 with real catalog', r.status === 200 && r.json.items.length > 0, `${r.json?.items?.length} items`);
        r = await call('GET', `/products/${product.handle}`, { auth: false });
        check(`GET /products/${product.handle} -> 200`, r.status === 200 && r.json.variants.some((x) => x.id === V));
        check('subscribe variants hidden in detail', r.json.variants.every((x) => !/subscri/i.test(x.title)), r.json.variants.map((x) => x.title).join(' | '));
        r = await call('GET', '/collections', { auth: false });
        check('GET /collections -> 200', r.status === 200, r.json.items.map((c) => c.handle).join(', '));

        console.log('\n2. Cart (real staging writes)');
        r = await call('GET', '/cart', { auth: false });
        check('GET /cart without token -> 401', r.status === 401);
        r = await call('POST', '/cart/items', { body: { variantId: V, quantity: 2 } });
        check('add x2 -> 200 (cart upserted)', r.status === 200 && r.json.lines[0]?.quantity === 2, `subtotal ₹${r.json?.summary?.subtotal?.rupees}`);
        r = await call('POST', '/cart/items', { body: { variantId: V, quantity: 1 } });
        check('add +1 -> merged to 3', r.json.lines[0]?.quantity === 3);
        r = await call('POST', '/cart/items', { body: { variantId: V, quantity: 11 } });
        check('qty 11 -> 400 INVALID_QUANTITY', r.status === 400 && r.json.code === 'INVALID_QUANTITY');
        const parallel = await Promise.all(Array.from({ length: 6 }, () => call('POST', '/cart/items', { body: { variantId: V, quantity: 2 } })));
        const after = await Cart.findOne({ user: user._id }).lean();
        check('6 parallel +2 adds never pass the qty cap (real atomic update)', after.items[0].quantity <= 10, `qty=${after.items[0].quantity}, statuses=${parallel.map((x) => x.status).join(',')}`);
        r = await call('PATCH', `/cart/items/${V}`, { body: { quantity: 2 } });
        check('set qty 2 -> 200', r.status === 200 && r.json.lines[0].quantity === 2);

        console.log('\n3. Checkout');
        r = await call('POST', '/checkout');
        check('no Idempotency-Key -> 400', r.status === 400 && r.json.code === 'IDEMPOTENCY_KEY_REQUIRED');
        const key = `e2e-${crypto.randomUUID()}`;
        const taps = await Promise.all([1, 2, 3].map(() => call('POST', '/checkout', { headers: { 'Idempotency-Key': key } })));
        const okTaps = taps.filter((x) => x.status === 200);
        const ordersForKey = await Order.countDocuments({ user: user._id, idempotencyKey: key });
        check('triple tap -> exactly 1 order in real DB (unique index)', ordersForKey === 1, `statuses=${taps.map((x) => x.status).join(',')}`);
        check('triple tap -> 1 Fastrr token call', mock.callsTo('/api/v1/access-token/checkout').length === 1);
        const again = await call('POST', '/checkout', { headers: { 'Idempotency-Key': key } });
        check('same key again -> 200, same order', again.status === 200 && okTaps.every((x) => x.json.orderId === again.json.orderId));
        const { orderId, checkoutPageUrl } = again.json;
        let o = await Order.findOne({ internalOrderId: orderId }).lean();
        check('order saved pending with price snapshot', o.paymentStatus === 'pending' && o.items[0].priceSnapshot === price && o.amount === 2 * price, `${orderId} ₹${o.amount / 100}`);
        const pu = new URL(checkoutPageUrl);
        const page = await call('GET', pu.pathname.replace('/api/shop', '') + pu.search, { auth: false });
        check('checkout page -> 200 with Fastrr JS', page.status === 200 && page.text.includes('HeadlessCheckout'));
        r = await call('GET', `/orders/${orderId}`);
        check('poll -> awaiting_payment', r.json.status === 'awaiting_payment');

        console.log('\n4. Payment (UPI)');
        mock.state.orders.set(o.fastrrOrderId, placedOrder(o.fastrrOrderId, { items: [{ variantId: V, quantity: 2 }], subtotal: (2 * price) / 100 }));
        r = await call('POST', '/fastrr/webhook', { auth: false, body: { order_id: o.fastrrOrderId, status: 'SUCCESS' } });
        check('webhook -> 200', r.status === 200);
        o = await Order.findOne({ internalOrderId: orderId }).lean();
        check('order paid in real DB, Shopify sync queued', o.paymentStatus === 'paid' && o.shopifySyncStatus === 'pending', `${o.paymentStatus}/${o.shopifySyncStatus}`);
        check('address + payment saved', o.shippingAddress?.city === 'Pune' && o.payment?.pgTransactionId === 'pay_ABC');
        r = await call('POST', '/fastrr/webhook', { auth: false, body: { order_id: o.fastrrOrderId } });
        o = await Order.findOne({ internalOrderId: orderId }).lean();
        check('duplicate webhook -> still one "paid" in history', o.statusHistory.filter((h) => h.status === 'paid').length === 1);
        r = await call('GET', '/cart');
        check('cart emptied of bought items', r.json.lines.length === 0);
        r = await call('GET', `/checkout/${orderId}/return?oid=${o.fastrrOrderId}&ost=SUCCESS`, { auth: false });
        check('return page deep-links with status=confirmed', r.text.includes(`status=confirmed`));
        r = await call('GET', '/orders');
        check('My Orders lists it', r.json.items.some((x) => x.orderId === orderId && x.status === 'confirmed'));
        r = await call('POST', '/checkout', { headers: { 'Idempotency-Key': key } });
        check('retry old checkout -> 409 ORDER_ALREADY_PLACED', r.status === 409 && r.json.code === 'ORDER_ALREADY_PLACED');

        console.log('\n5. COD order + failed-then-paid order');
        await call('POST', '/cart/items', { body: { variantId: V, quantity: 1 } });
        r = await call('POST', '/checkout', { headers: { 'Idempotency-Key': `e2e-${crypto.randomUUID()}` } });
        const codId = r.json.orderId;
        let c = await Order.findOne({ internalOrderId: codId }).lean();
        mock.state.orders.set(c.fastrrOrderId, placedOrder(c.fastrrOrderId, { items: [{ variantId: V, quantity: 1 }], subtotal: price / 100, cod: true, codCharges: 50 }));
        await call('POST', '/fastrr/webhook', { auth: false, body: { order_id: c.fastrrOrderId } });
        c = await Order.findOne({ internalOrderId: codId }).lean();
        check('COD -> cod_pending, COD charge saved', c.paymentStatus === 'cod_pending' && c.pricing.codCharges === 5000);

        await call('POST', '/cart/items', { body: { variantId: V, quantity: 1 } });
        r = await call('POST', '/checkout', { headers: { 'Idempotency-Key': `e2e-${crypto.randomUUID()}` } });
        const failId = r.json.orderId;
        let f = await Order.findOne({ internalOrderId: failId }).lean();
        mock.state.orders.set(f.fastrrOrderId, fastrrOrder(f.fastrrOrderId, { status: 'FAILED' }));
        await call('POST', '/fastrr/webhook', { auth: false, body: { order_id: f.fastrrOrderId } });
        r = await call('GET', `/orders/${failId}`);
        check('UPI failed -> payment_failed', r.json.status === 'payment_failed');
        mock.state.orders.set(f.fastrrOrderId, placedOrder(f.fastrrOrderId, { items: [{ variantId: V, quantity: 1 }], subtotal: price / 100 }));
        await call('POST', '/fastrr/webhook', { auth: false, body: { order_id: f.fastrrOrderId } });
        r = await call('GET', `/orders/${failId}`);
        check('retry on same Fastrr page -> confirmed', r.json.status === 'confirmed');

        console.log('\n6. Security');
        r = await call('POST', '/fastrr/webhook', { auth: false, body: { order_id: '<script>' } });
        check('garbage webhook -> 400 INVALID_ORDER_ID', r.status === 400 && r.json.code === 'INVALID_ORDER_ID');
        const other = jwt.sign({ id: new mongoose.Types.ObjectId().toString() }, process.env.JWT_SECRET, { expiresIn: '5m' });
        const res = await fetch(`${api}/orders/${orderId}`, { headers: { Authorization: `Bearer ${other}` } });
        check('token for a non-existent user -> 401', res.status === 401);
        r = await call('POST', '/internal/reconcile-orders', { auth: false, body: {} });
        check('unsigned cron call rejected', r.status === 401 || r.status === 503, `status ${r.status}`);
    } finally {
        if (KEEP) {
            console.log(`\n--keep: left user ${email} (${user._id}) and their cart/orders in staging.`);
        } else {
            const [ord, crt] = await Promise.all([Order.deleteMany({ user: user._id }), Cart.deleteMany({ user: user._id })]);
            await User.deleteOne({ _id: user._id });
            console.log(`\nCleanup: deleted ${ord.deletedCount} order(s), ${crt.deletedCount} cart(s), 1 user from staging.`);
        }
        await new Promise((r) => server.close(r));
        await mock.close();
        await mongoose.disconnect();
    }

    console.log(`\n${results.length - failures}/${results.length} checks passed${failures ? ` — ${failures} FAILED` : ''}`);
    process.exit(failures ? 1 : 0);
}

main().catch(async (err) => {
    console.error('E2E aborted:', err.message);
    try { await mongoose.disconnect(); } catch { /* ignore */ }
    process.exit(1);
});
