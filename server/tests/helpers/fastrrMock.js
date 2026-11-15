// Local stand-in for Fastrr's API (shapes from their "SRC Custom Integration"
// docs). Verifies X-Api-Key + X-Api-HMAC-SHA256 on every call, like Fastrr
// (511 on mismatch). Tests script it through `orders`, `next` and `calls`.

const http = require('http');
const crypto = require('crypto');

const API_KEY = 'test-fastrr-key';
const API_SECRET = 'test-fastrr-secret';

const sign = (raw) => crypto.createHmac('sha256', API_SECRET).update(raw, 'utf8').digest('base64');

/** A Fastrr Order Details `result` (rupee floats, like the real API). */
const fastrrOrder = (orderId, over = {}) => ({
    order_id: orderId,
    cart_data: { items: [] },
    status: 'INITIATED',
    phone: null,
    email: null,
    shipping_address: null,
    billing_address: null,
    payment_type: null,
    payment_status: null,
    payments: null,
    coupon_codes: null,
    total_discount: null,
    prepaid_discount: null,
    shipping_charges: 0,
    cod_charges: null,
    subtotal_price: null,
    total_amount_payable: null,
    platform_order_id: null,
    fastrr_order_id: null,
    cart_id: null,
    rto_prediction: null,
    edd: null,
    ...over,
});

const address = {
    phone: '9876543210', alternate_phone: null, line1: 'Flat 1, Tower A', line2: 'MG Road', city: 'Pune',
    pincode: '411001', state: 'Maharashtra', country: 'India', country_code: 'IN', landmark: null,
    first_name: 'Asha', last_name: 'K', email: 'asha@example.com', gender: null,
};

/** A paid / COD Fastrr order for the given items ([{ variantId, quantity }]) and subtotal (rupees). */
const placedOrder = (orderId, { items, subtotal, cod = false, discount = 0, shipping = 0, codCharges = 0, received } = {}) => {
    const total = subtotal - discount + shipping + (cod ? codCharges : 0);
    return fastrrOrder(orderId, {
        status: 'SUCCESS',
        cart_data: { items: items.map((i) => ({ variant_id: String(i.variantId), quantity: i.quantity })) },
        phone: '9876543210',
        email: 'asha@example.com',
        shipping_address: address,
        billing_address: address,
        payment_type: cod ? 'CASH_ON_DELIVERY' : 'PREPAID',
        payment_status: cod ? 'Pending' : 'Success',
        payments: cod ? [] : [{
            txn_id: 'Txn1', payment_status: 'Success', gateway: 'Razorpay', payment_method: 'UPI',
            amount: received ?? total, pg_transaction_id: 'pay_ABC', amount_received: received ?? total, created_at: '2026-11-15T06:52:21Z',
        }],
        coupon_codes: discount ? ['SAVE'] : [],
        total_discount: discount,
        prepaid_discount: 0,
        shipping_charges: shipping,
        cod_charges: cod ? codCharges : null,
        subtotal_price: subtotal,
        total_amount_payable: total + 0.0000000000003, // Fastrr sends float noise
        platform_order_id: orderId,
        fastrr_order_id: '113535525',
        cart_id: 'cart-1',
        rto_prediction: 'low',
        edd: '2026-11-20',
    });
};

const startFastrrMock = async () => {
    const state = {
        calls: [],          // { path, body, headers }
        orders: new Map(),  // fastrr order id -> details result
        next: [],           // queued overrides: { path, status, body, delayMs }
        tokenSeq: 0,
        refunds: [],        // refunds Fastrr has accepted (report source)
        tokenTtlMs: 30 * 60 * 1000,
    };

    const server = http.createServer((req, res) => {
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', async () => {
            const send = (status, body) => {
                res.writeHead(status, { 'Content-Type': 'application/json' });
                res.end(typeof body === 'string' ? body : JSON.stringify(body));
            };
            let body = null;
            try { body = JSON.parse(raw); } catch { /* keep null */ }
            state.calls.push({ path: req.url, body, headers: req.headers });

            if (req.headers['x-api-key'] !== API_KEY || req.headers['x-api-hmac-sha256'] !== sign(raw)) {
                return send(511, { ok: false, error: { message: 'Invalid api key or hmac' } });
            }

            const idx = state.next.findIndex((n) => n.path === req.url);
            if (idx >= 0) {
                const o = state.next.splice(idx, 1)[0];
                if (o.delayMs) await new Promise((r) => setTimeout(r, o.delayMs));
                return send(o.status ?? 200, o.body ?? { ok: true });
            }

            switch (req.url) {
                case '/api/v1/access-token/checkout': {
                    state.tokenSeq += 1;
                    const orderId = `fo${String(state.tokenSeq).padStart(22, '0')}`;
                    state.orders.set(orderId, fastrrOrder(orderId, { cart_data: { items: body.cart_data.items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })) } }));
                    return send(200, {
                        timestamp: '15-11-2026 05:36:23 PM', ok: true, latency: null, error: null,
                        result: { token: `tok_${state.tokenSeq}`, expires_at: new Date(Date.now() + state.tokenTtlMs).toISOString(), data: { order_id: orderId } },
                    });
                }
                case '/api/v1/custom-platform-order/details': {
                    const o = state.orders.get(body?.order_id);
                    if (!o) return send(200, { ok: false, error: { message: 'order not found' } });
                    return send(200, { ok: true, result: o });
                }
                case '/api/v1/external/refund/initiate': {
                    const o = state.orders.get(String(body?.order_id));
                    if (!o || o.status !== 'SUCCESS') return send(200, { status: false, message: 'Order not eligible for refund' });
                    const already = state.refunds.filter((r) => r.platform_order_id === o.order_id).reduce((n, r) => n + r.refund_amount, 0);
                    if (Number(body.amount) <= 0 || already + Number(body.amount) > Number(o.total_amount_payable) + 0.001) {
                        return send(200, { status: false, message: 'Refund amount exceeds order amount' });
                    }
                    const id = crypto.randomUUID();
                    state.refunds.push({
                        ref_id: id, payment_platform: 'Razorpay', amount: Number(body.amount), status: 'INITIATED', refunded: false,
                        message: 'Refund Request Queued', order_id: Number(o.fastrr_order_id), platform_order_id: o.order_id,
                        refund_amount: Number(body.amount), refund_type: 'FULL', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
                    });
                    return send(200, { status: true, data: { success: true, data: { id, transaction_id: 'Rfnd' + state.refunds.length, amount: Number(body.amount), status: 'INITIATED', message: 'Refund Request Queued' } } });
                }
                case '/api/v1/external/refund/reports': {
                    const list = state.refunds.map(({ platform_order_id, ...r }) => r);
                    const page = Number(body?.page || 0);
                    return send(200, { status: true, data: { total_refunds: list.length, refunds: list.slice(page * 2, page * 2 + 2) } });
                }
                case '/wh/v1/custom/product':
                case '/wh/v1/custom/collection':
                    return send(200, { ok: true, errorCode: null, result: true });
                default:
                    return send(404, { ok: false, error: { message: 'not found' } });
            }
        });
    });

    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    return {
        baseUrl,
        state,
        callsTo: (path) => state.calls.filter((c) => c.path === path),
        /** Fastrr's side finishes a refund (shows up in the next report). */
        settleRefund: (refId, status = 'SUCCESS') => {
            const r = state.refunds.find((x) => x.ref_id === refId);
            r.status = status; r.refunded = status === 'SUCCESS'; r.updated_at = new Date().toISOString();
            return r;
        },
        reset: () => { state.calls.length = 0; state.orders.clear(); state.next.length = 0; state.tokenSeq = 0; state.tokenTtlMs = 30 * 60 * 1000; state.refunds.length = 0; },
        close: () => new Promise((r) => server.close(r)),
    };
};

module.exports = { startFastrrMock, fastrrOrder, placedOrder, API_KEY, API_SECRET, sign };
