const test = require('node:test');
const assert = require('node:assert/strict');

const { startFastrrMock, API_KEY, API_SECRET, sign } = require('./helpers/fastrrMock');

const ENV = ['FASTRR_BASE_URL', 'FASTRR_API_KEY', 'FASTRR_API_SECRET', 'FASTRR_TIMEOUT_MS'];
const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
let mock;
let fastrr;

test.before(async () => {
    mock = await startFastrrMock();
    process.env.FASTRR_BASE_URL = mock.baseUrl;
    process.env.FASTRR_API_KEY = API_KEY;
    process.env.FASTRR_API_SECRET = API_SECRET;
    process.env.FASTRR_TIMEOUT_MS = '300';
    fastrr = require('../modules/shop/services/fastrrClient');
});
test.after(async () => {
    await mock.close();
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});
test.beforeEach(() => mock.reset());

const TOKEN = '/api/v1/access-token/checkout';
const DETAILS = '/api/v1/custom-platform-order/details';
const payload = { cart_data: { items: [{ variant_id: '1', quantity: 1 }], mobile_app: true }, redirect_url: 'https://x/r' };

test('client: signs the exact raw body with key + base64 HMAC and a fresh timestamp', async () => {
    const t = await fastrr.createCheckoutToken(payload);
    assert.equal(t.token, 'tok_1');
    assert.ok(t.expiresAt instanceof Date && t.expiresAt > new Date());
    assert.match(t.fastrrOrderId, /^fo\d+$/);
    const [call] = mock.callsTo(TOKEN);
    assert.equal(call.headers['x-api-key'], API_KEY);
    assert.equal(call.headers['content-type'], 'application/json');
    assert.ok(call.body.timestamp && !Number.isNaN(Date.parse(call.body.timestamp)));
    assert.deepEqual(call.body.cart_data, payload.cart_data);
    // The mock already rejects bad signatures with 511 — make the check explicit too.
    assert.equal(call.headers['x-api-hmac-sha256'], sign(JSON.stringify(call.body)));
});

test('client: wrong secret -> 511 -> auth error, not retried', async () => {
    process.env.FASTRR_API_SECRET = 'wrong';
    try {
        await assert.rejects(fastrr.getOrderDetails('fo1'), (e) => e.name === 'FastrrApiError' && e.status === 511 && e.code === 'AUTH' && !e.retryable);
        assert.equal(mock.callsTo(DETAILS).length, 1);
    } finally {
        process.env.FASTRR_API_SECRET = API_SECRET;
    }
});

test('client: 5xx and 429 are retried (details), then succeed', async () => {
    mock.state.next.push({ path: DETAILS, status: 502, body: 'bad gateway' }, { path: DETAILS, status: 429, body: {} });
    mock.state.orders.set('fo1', { order_id: 'fo1', status: 'INITIATED' });
    const d = await fastrr.getOrderDetails('fo1');
    assert.equal(d.status, 'INITIATED');
    assert.equal(mock.callsTo(DETAILS).length, 3);
});

test('client: gives up after 3 attempts on persistent 5xx', async () => {
    for (let i = 0; i < 3; i++) mock.state.next.push({ path: DETAILS, status: 503, body: {} });
    await assert.rejects(fastrr.getOrderDetails('fo1'), (e) => e.status === 503 && e.retryable);
    assert.equal(mock.callsTo(DETAILS).length, 3);
});

test('client: 4xx is not retried', async () => {
    mock.state.next.push({ path: DETAILS, status: 400, body: { ok: false, error: { message: 'bad order id' } } });
    await assert.rejects(fastrr.getOrderDetails('fo1'), (e) => e.status === 400 && /bad order id/.test(e.message));
    assert.equal(mock.callsTo(DETAILS).length, 1);
});

test('client: ok:false in a 200 is an application error', async () => {
    await assert.rejects(fastrr.getOrderDetails('missing'), (e) => e.code === 'REJECTED' && /order not found/.test(e.message));
});

test('client: token creation is NOT retried after a timeout (Fastrr may have created the order)', async () => {
    mock.state.next.push({ path: TOKEN, delayMs: 600, body: {} });
    await assert.rejects(fastrr.createCheckoutToken(payload), (e) => e.code === 'TIMEOUT');
    assert.equal(mock.callsTo(TOKEN).length, 1);
});

test('client: token creation IS retried once on a 5xx (nothing was created)', async () => {
    mock.state.next.push({ path: TOKEN, status: 500, body: {} });
    const t = await fastrr.createCheckoutToken(payload);
    assert.equal(t.token, 'tok_1');
    assert.equal(mock.callsTo(TOKEN).length, 2);
});

test('client: details timeouts are retried', async () => {
    mock.state.next.push({ path: DETAILS, delayMs: 600, body: {} });
    mock.state.orders.set('fo1', { order_id: 'fo1', status: 'SUCCESS' });
    assert.equal((await fastrr.getOrderDetails('fo1')).status, 'SUCCESS');
});

test('client: malformed token response is rejected', async () => {
    mock.state.next.push({ path: TOKEN, body: { ok: true, result: { token: 't', data: {} } } });
    await assert.rejects(fastrr.createCheckoutToken(payload), (e) => e.code === 'BAD_RESPONSE');
});

test('client: unreachable Fastrr is a network error', async () => {
    process.env.FASTRR_BASE_URL = 'http://127.0.0.1:1';
    try {
        await assert.rejects(fastrr.getOrderDetails('fo1'), (e) => e.code === 'NETWORK' && e.retryable);
    } finally {
        process.env.FASTRR_BASE_URL = mock.baseUrl;
    }
});

test('client: not configured fails fast without a request', async () => {
    delete process.env.FASTRR_API_KEY;
    try {
        assert.equal(fastrr.isConfigured(), false);
        await assert.rejects(fastrr.getOrderDetails('fo1'), (e) => e.code === 'NOT_CONFIGURED');
        assert.equal(mock.state.calls.length, 0);
    } finally {
        process.env.FASTRR_API_KEY = API_KEY;
    }
});

test('client: catalog push sends the product as-is (no timestamp) in one attempt', async () => {
    await fastrr.pushProduct({ id: 1, title: 'P' });
    const [call] = mock.callsTo('/wh/v1/custom/product');
    assert.deepEqual(call.body, { id: 1, title: 'P' });
    mock.state.next.push({ path: '/wh/v1/custom/collection', status: 500, body: {} });
    await assert.rejects(fastrr.pushCollection({ id: 2 }));
    assert.equal(mock.callsTo('/wh/v1/custom/collection').length, 1);
});
