const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
    parseOrderNumberInput, normalizeOrderName, normalizeEmail, normalizePhone, hashIdentifier,
    identityHashes, normalizeWebhookOrder, normalizeGraphqlOrder, evaluateEligibility, verifyShopifyHmac,
    normalizeRefund, offerProductFullyRefunded, finalEligibility,
} = require('../utils/shopifyOrder');

const cfg = (over = {}) => ({
    days: 30,
    qualifyingSkus: new Set(),
    eligibleStatuses: new Set(['paid', 'partially_refunded']),
    allowTestOrders: false,
    orderPrefix: 'TAKE',
    matchSecret: 's3cret',
    ...over,
});

test('order number input: every way a user might type it maps to one canonical name', () => {
    for (const input of ['TAKE11005', '#TAKE11005', 'take11005', ' take-11005 ', '11005', 11005]) {
        assert.deepEqual(parseOrderNumberInput(input, 'TAKE'), { orderName: 'TAKE11005', orderNumber: 11005 }, String(input));
    }
});

test('order number input: junk is rejected', () => {
    for (const input of ['', '   ', 'abc', 'TAKE', null, undefined, {}, 'x'.repeat(50), 'TAKE11005; drop']) {
        assert.equal(parseOrderNumberInput(input, 'TAKE'), null, String(input));
    }
    assert.equal(normalizeOrderName({ $ne: null }), null);
});

test('email / phone normalization', () => {
    assert.equal(normalizeEmail('  Rahul@Gmail.COM '), 'rahul@gmail.com');
    assert.equal(normalizeEmail('not-an-email'), null);
    for (const p of ['+91 98765 43210', '09876543210', '9876543210', '+91-98765-43210']) {
        assert.equal(normalizePhone(p), '9876543210', p);
    }
    assert.equal(normalizePhone('12345'), null);
});

test('identity hashes are keyed: same input + secret matches, other secret does not', () => {
    const a = hashIdentifier('email', 'a@b.com', 'k1');
    assert.equal(a, hashIdentifier('email', 'a@b.com', 'k1'));
    assert.notEqual(a, hashIdentifier('email', 'a@b.com', 'k2'));
    assert.notEqual(a, crypto.createHash('sha256').update('a@b.com').digest('hex'), 'must not be a plain sha256');
    assert.throws(() => hashIdentifier('email', 'a@b.com', ''), /OFFER_MATCH_SECRET/);
});

test('identityHashes de-duplicates the many places an order carries email/phone', () => {
    const h = identityHashes({ emails: ['A@b.com', 'a@b.com', null], phones: ['+919876543210', '9876543210', ''] }, 'k');
    assert.equal(h.emailHashes.length, 1);
    assert.equal(h.phoneHashes.length, 1);
});

const WEBHOOK_ORDER = {
    id: 5512345678901,
    name: '#TAKE11005',
    order_number: 11005,
    email: 'Buyer@Example.com',
    phone: null,
    customer: { email: 'buyer@example.com', phone: '+91 98765 43210' },
    shipping_address: { phone: '09876543210' },
    line_items: [{ sku: 'ber-500', quantity: 1 }, { sku: null, quantity: 1 }],
    financial_status: 'paid',
    cancelled_at: null,
    test: false,
    created_at: '2026-11-01T10:00:00+05:30',
    updated_at: '2026-11-01T10:05:00+05:30',
};

test('webhook payload and Admin GraphQL node normalize to the same shape', () => {
    const w = normalizeWebhookOrder(WEBHOOK_ORDER);
    assert.equal(w.shopifyOrderId, '5512345678901');
    assert.equal(w.orderName, 'TAKE11005');
    assert.equal(w.orderNumber, 11005);
    assert.deepEqual(w.skus, ['BER-500']);
    assert.equal(w.financialStatus, 'paid');

    const g = normalizeGraphqlOrder({
        legacyResourceId: '5512345678901', name: '#TAKE11005', email: 'buyer@example.com', phone: null,
        test: false, createdAt: '2026-11-01T04:30:00Z', updatedAt: '2026-11-01T04:35:00Z', cancelledAt: null,
        displayFinancialStatus: 'PARTIALLY_REFUNDED', billingAddress: { phone: '+919876543210' }, shippingAddress: null,
        lineItems: { nodes: [{ sku: 'BER-500', quantity: 1 }] },
    });
    assert.deepEqual(w.lineItems, [{ sku: 'BER-500', quantity: 1 }]);
    assert.deepEqual(g.lineItems, w.lineItems);
    assert.deepEqual(g.skus, ['BER-500']);
    assert.equal(g.shopifyOrderId, w.shopifyOrderId);
    assert.equal(g.orderName, w.orderName);
    assert.equal(g.orderNumber, 11005);
    assert.equal(g.financialStatus, 'partially_refunded');
    assert.equal(g.orderUpdatedAt.toISOString(), w.orderUpdatedAt.toISOString());
});

test('eligibility: paid order of an offer product is eligible', () => {
    const o = normalizeWebhookOrder(WEBHOOK_ORDER);
    assert.deepEqual(evaluateEligibility(o, cfg()), { eligible: true, reason: null });
    assert.deepEqual(evaluateEligibility(o, cfg({ qualifyingSkus: new Set(['BER-500']) })), { eligible: true, reason: null });
});

test('eligibility: each reason an order can fail', () => {
    const base = normalizeWebhookOrder(WEBHOOK_ORDER);
    assert.equal(evaluateEligibility({ ...base, cancelledAt: new Date() }, cfg()).reason, 'cancelled');
    assert.equal(evaluateEligibility({ ...base, financialStatus: 'refunded' }, cfg()).reason, 'refunded');
    assert.equal(evaluateEligibility({ ...base, financialStatus: 'pending' }, cfg()).reason, 'not_paid');
    assert.equal(evaluateEligibility({ ...base, isTest: true }, cfg()).reason, 'test_order');
    assert.equal(evaluateEligibility(base, cfg({ qualifyingSkus: new Set(['COQ-200']) })).reason, 'product_not_in_offer');
    // COD can be opted in by config
    assert.equal(evaluateEligibility({ ...base, financialStatus: 'pending' }, cfg({ eligibleStatuses: new Set(['paid', 'pending']) })).eligible, true);
    // test orders allowed on staging
    assert.equal(evaluateEligibility({ ...base, isTest: true }, cfg({ allowTestOrders: true })).eligible, true);
});

test('refund payload normalizes to sku + quantity lines', () => {
    const r = normalizeRefund({
        id: 991, order_id: 5512345678901,
        refund_line_items: [{ quantity: 1, line_item: { sku: 'ber-500' } }, { quantity: 0, line_item: { sku: 'X' } }, { quantity: 2, line_item: {} }],
    });
    assert.deepEqual(r, { refundId: '991', orderId: '5512345678901', items: [{ sku: 'BER-500', quantity: 1 }] });
    assert.deepEqual(normalizeRefund({ id: 5, order_id: 6 }).items, []);
});

test('returning the offer product ends the offer; returning something else does not', () => {
    const offerOnly = cfg({ qualifyingSkus: new Set(['BER-500']) });
    const lineItems = [{ sku: 'BER-500', quantity: 2 }, { sku: 'SHAKER', quantity: 1 }];
    assert.equal(offerProductFullyRefunded(lineItems, [], offerOnly), false);
    assert.equal(offerProductFullyRefunded(lineItems, [{ sku: 'SHAKER', quantity: 1 }], offerOnly), false, 'other product returned');
    assert.equal(offerProductFullyRefunded(lineItems, [{ sku: 'BER-500', quantity: 1 }], offerOnly), false, 'only 1 of 2 returned');
    assert.equal(offerProductFullyRefunded(lineItems, [{ sku: 'BER-500', quantity: 1 }, { sku: 'BER-500', quantity: 1 }], offerOnly), true);
    // no SKU list = every product is an offer product: everything must come back
    assert.equal(offerProductFullyRefunded(lineItems, [{ sku: 'BER-500', quantity: 2 }], cfg()), false);
    assert.equal(offerProductFullyRefunded(lineItems, [{ sku: 'BER-500', quantity: 2 }, { sku: 'SHAKER', quantity: 1 }], cfg()), true);
});

test('product with NO SKU (live Berberine): webhook, Admin API and refund all use the same TITLE key', () => {
    const key = 'TITLE:LIPOSOMAL BERBERINE HCL';
    const w = normalizeWebhookOrder({ ...WEBHOOK_ORDER, line_items: [{ sku: '', title: 'Liposomal  Berberine HCL', quantity: 1 }] });
    const g = normalizeGraphqlOrder({
        legacyResourceId: '1', name: '#TAKE11005', lineItems: { nodes: [{ sku: null, title: 'Liposomal Berberine HCL', quantity: 1 }] },
    });
    const r = normalizeRefund({ id: 9, order_id: 1, refund_line_items: [{ quantity: 1, line_item: { sku: null, title: 'Liposomal Berberine HCL' } }] });
    assert.deepEqual(w.lineItems, [{ sku: key, quantity: 1 }]);
    assert.deepEqual(g.lineItems, [{ sku: key, quantity: 1 }]);
    assert.deepEqual(r.items, [{ sku: key, quantity: 1 }]);

    const berberineOnly = cfg({ qualifyingSkus: new Set([key]) });
    assert.equal(evaluateEligibility(w, berberineOnly).eligible, true);
    assert.equal(offerProductFullyRefunded(w.lineItems, r.items, berberineOnly), true, 'returning it must end the offer');
});

test('product ID: every variant of the offer product qualifies, other products do not', () => {
    const berberine = cfg({ productIds: new Set(['10790037291313']) });
    const order = (lines) => normalizeWebhookOrder({ ...WEBHOOK_ORDER, line_items: lines });
    // 1 pack (LBHCLOT1), subscription (LBHCLSB1), an old line with no SKU, a renamed title — all the same product
    for (const li of [
        { product_id: 10790037291313, sku: 'LBHCLOT1', title: 'Liposomal Berberine HCL', quantity: 1 },
        { product_id: 10790037291313, sku: 'LBHCLSB1', title: 'Liposomal Berberine HCL', quantity: 1 },
        { product_id: 10790037291313, sku: null, title: 'Liposomal Berberine HCL', quantity: 1 },
        { product_id: 10790037291313, sku: 'NEW-2PACK', title: 'Berberine 500mg (2 pack)', quantity: 1 },
    ]) {
        assert.equal(evaluateEligibility(order([li]), berberine).eligible, true, JSON.stringify(li));
    }
    assert.equal(evaluateEligibility(order([{ product_id: 555, sku: 'COQ10', title: 'CoQ10', quantity: 1 }]), berberine).reason, 'product_not_in_offer');
    // a custom line item has no product ID: only the SKU/title backup can catch it
    const custom = order([{ product_id: null, sku: null, title: 'Liposomal Berberine HCL', quantity: 1 }]);
    assert.equal(evaluateEligibility(custom, berberine).eligible, false);
    assert.equal(evaluateEligibility(custom, cfg({ productIds: new Set(['10790037291313']), qualifyingSkus: new Set(['TITLE:LIPOSOMAL BERBERINE HCL']) })).eligible, true);
});

test('product ID comes through from webhook, Admin API and refund payloads alike', () => {
    const w = normalizeWebhookOrder({ ...WEBHOOK_ORDER, line_items: [{ product_id: 10790037291313, sku: 'LBHCLOT1', quantity: 1 }] });
    const g = normalizeGraphqlOrder({ legacyResourceId: '1', name: '#TAKE11010',
        lineItems: { nodes: [{ sku: 'LBHCLOT1', title: 'x', quantity: 1, product: { legacyResourceId: '10790037291313' } }] } });
    const r = normalizeRefund({ id: 1, order_id: 1, refund_line_items: [{ quantity: 1, line_item: { product_id: 10790037291313, sku: 'LBHCLOT1' } }] });
    for (const line of [w.lineItems[0], g.lineItems[0], r.items[0]]) assert.equal(line.productId, '10790037291313');
});

test('returning the offer product is detected by product ID even if the variant SKU differs', () => {
    const berberine = cfg({ productIds: new Set(['10790037291313']) });
    const lines = [{ productId: '10790037291313', sku: 'LBHCLOT1', quantity: 2 }, { productId: '999', sku: 'SHAKER', quantity: 1 }];
    assert.equal(offerProductFullyRefunded(lines, [{ productId: '999', sku: 'SHAKER', quantity: 1 }], berberine), false, 'other product returned');
    assert.equal(offerProductFullyRefunded(lines, [{ productId: '10790037291313', sku: 'LBHCLOT1', quantity: 1 }], berberine), false, '1 of 2');
    assert.equal(offerProductFullyRefunded(lines, [{ productId: '10790037291313', quantity: 2 }], berberine), true);
});

test('finalEligibility combines order status with line refunds', () => {
    const doc = { skus: ['BER-500'], lineItems: [{ sku: 'BER-500', quantity: 1 }], refundLines: [], financialStatus: 'partially_refunded', cancelledAt: null, isTest: false };
    assert.deepEqual(finalEligibility(doc, cfg()), { eligible: true, reason: null });
    assert.deepEqual(finalEligibility({ ...doc, refundLines: [{ sku: 'BER-500', quantity: 1 }] }, cfg()), { eligible: false, reason: 'refunded' });
    assert.deepEqual(finalEligibility({ ...doc, financialStatus: 'refunded' }, cfg()), { eligible: false, reason: 'refunded' });
});

test('webhook HMAC: valid signature passes, any change fails, missing secret fails closed', () => {
    const body = JSON.stringify(WEBHOOK_ORDER);
    const sig = crypto.createHmac('sha256', 'shpss_test').update(body, 'utf8').digest('base64');
    assert.equal(verifyShopifyHmac(body, sig, 'shpss_test'), true);
    assert.equal(verifyShopifyHmac(body + ' ', sig, 'shpss_test'), false);
    assert.equal(verifyShopifyHmac(body, sig, 'other'), false);
    assert.equal(verifyShopifyHmac(body, 'short', 'shpss_test'), false);
    assert.equal(verifyShopifyHmac(body, sig, ''), false);
    assert.equal(verifyShopifyHmac(undefined, sig, 'shpss_test'), false);
});
