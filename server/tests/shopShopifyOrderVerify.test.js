// Part 3: a Shopify order that Fastrr created from our WebView URL is checked
// against the order our server priced. The URL is readable on the phone, so a
// tampered cart (cheaper price, extra item, other order id) must be caught.
const test = require('node:test');
const assert = require('node:assert/strict');

const { extractInternalOrderId, verifyShopifyOrderAgainstOurs, VERIFY_ORDER_FIELDS } = require('../modules/shop/lib/shopifyOrderVerify');

const TH = 'TH-261116-AB12CD34';
const V1 = '57199514222897';
const V9 = '777';

// Amish: 2 x Berberine ₹1499 + 1 x Magnesium ₹99 = ₹3097
const ours = () => ({
    internalOrderId: TH,
    amount: 2 * 149900 + 9900,
    items: [
        { variantId: V1, quantity: 2, priceSnapshot: 149900 },
        { variantId: V9, quantity: 1, priceSnapshot: 9900 },
    ],
});

const gqlLine = (variantId, quantity, amount, attrs) => ({
    quantity,
    variant: { legacyResourceId: variantId },
    originalUnitPriceSet: { shopMoney: { amount } },
    customAttributes: attrs || [{ key: 'internal_order_id', value: TH }],
});
const gqlOrder = (over = {}) => ({
    currencyCode: 'INR',
    customAttributes: [{ key: 'internal_order_id', value: TH }],
    totalDiscountsSet: { shopMoney: { amount: '0.0' } },
    lineItems: { nodes: [gqlLine(V1, 2, '1499.00'), gqlLine(V9, 1, '99.0')] },
    ...over,
});

// The same order as a REST orders/create webhook body.
const restOrder = (over = {}) => ({
    currency: 'INR',
    note_attributes: [{ name: 'internal_order_id', value: TH }],
    total_discounts: '0.00',
    line_items: [
        { variant_id: Number(V1), quantity: 2, price: '1499.00', properties: [{ name: 'internal_order_id', value: TH }] },
        { variant_id: Number(V9), quantity: 1, price: '99.00', properties: [] },
    ],
    ...over,
});

test('verify: honest order matches (GraphQL and webhook shapes)', () => {
    for (const node of [gqlOrder(), restOrder()]) {
        const r = verifyShopifyOrderAgainstOurs(ours(), node);
        assert.deepEqual(r.reasons, []);
        assert.equal(r.ok, true);
        assert.deepEqual(r.summary, { internalOrderId: TH, linkSource: 'cart', expectedPaise: 309700, shopifySubtotalPaise: 309700, discountPaise: 0 });
    }
});

test('verify: price edited in the URL (₹1499 -> ₹1) -> PRICE_MISMATCH + SUBTOTAL_MISMATCH', () => {
    const r = verifyShopifyOrderAgainstOurs(ours(), gqlOrder({ lineItems: { nodes: [gqlLine(V1, 2, '1.00'), gqlLine(V9, 1, '99.00')] } }));
    assert.equal(r.ok, false);
    assert.deepEqual(r.reasons, [`PRICE_MISMATCH:${V1}`, 'SUBTOTAL_MISMATCH']);
    assert.equal(r.summary.shopifySubtotalPaise, 200 + 9900);
});

test('verify: a higher price is flagged too (never charge more than we showed)', () => {
    const r = verifyShopifyOrderAgainstOurs(ours(), restOrder({ line_items: [
        { variant_id: V1, quantity: 2, price: '1599.00' }, { variant_id: V9, quantity: 1, price: '99.00' },
    ] }));
    assert.deepEqual(r.reasons, [`PRICE_MISMATCH:${V1}`, 'SUBTOTAL_MISMATCH']);
});

test('verify: quantity changed, item added, item removed -> ITEMS_MISMATCH', () => {
    const qty = verifyShopifyOrderAgainstOurs(ours(), gqlOrder({ lineItems: { nodes: [gqlLine(V1, 5, '1499.00'), gqlLine(V9, 1, '99.00')] } }));
    assert.deepEqual(qty.reasons, ['ITEMS_MISMATCH', 'SUBTOTAL_MISMATCH']);

    const extra = verifyShopifyOrderAgainstOurs(ours(), gqlOrder({ lineItems: { nodes: [gqlLine(V1, 2, '1499.00'), gqlLine(V9, 1, '99.00'), gqlLine('888', 1, '0.00')] } }));
    assert.deepEqual(extra.reasons, ['ITEMS_MISMATCH']); // a free extra item: subtotal still equal, still caught

    const missing = verifyShopifyOrderAgainstOurs(ours(), gqlOrder({ lineItems: { nodes: [gqlLine(V1, 2, '1499.00')] } }));
    assert.deepEqual(missing.reasons, ['ITEMS_MISMATCH', 'SUBTOTAL_MISMATCH']);
});

test('verify: one variant split over two Shopify lines is still the same order', () => {
    const r = verifyShopifyOrderAgainstOurs(ours(), gqlOrder({ lineItems: { nodes: [gqlLine(V1, 1, '1499.00'), gqlLine(V1, 1, '1499.00'), gqlLine(V9, 1, '99.00')] } }));
    assert.equal(r.ok, true);
});

test('verify: price in paise without float drift (1586.68 style amounts)', () => {
    const order = { internalOrderId: TH, amount: 3 * 52889, items: [{ variantId: V1, quantity: 3, priceSnapshot: 52889 }] };
    const r = verifyShopifyOrderAgainstOurs(order, gqlOrder({ lineItems: { nodes: [gqlLine(V1, 3, '528.89')] } }));
    assert.equal(r.ok, true);
});

test('verify: missing price / other currency are flagged', () => {
    const r = verifyShopifyOrderAgainstOurs(ours(), gqlOrder({
        currencyCode: 'USD',
        lineItems: { nodes: [{ quantity: 2, variant: { legacyResourceId: V1 } }, gqlLine(V9, 1, '99.00')] },
    }));
    assert.deepEqual(r.reasons, ['CURRENCY_MISMATCH', `PRICE_MISSING:${V1}`, 'SUBTOTAL_MISMATCH']);
});

test('verify: a store coupon used on Fastrr\'s page is reported, not flagged', () => {
    const r = verifyShopifyOrderAgainstOurs(ours(), gqlOrder({ totalDiscountsSet: { shopMoney: { amount: '150.00' } } }));
    assert.equal(r.ok, true);
    assert.equal(r.summary.discountPaise, 15000);
});

test('verify: order id swapped to someone else\'s TH id -> ORDER_ID_MISMATCH', () => {
    const other = 'TH-261116-ZZZZZZZZ';
    const r = verifyShopifyOrderAgainstOurs(ours(), gqlOrder({ customAttributes: [{ key: 'internal_order_id', value: other }], lineItems: { nodes: [gqlLine(V1, 2, '1499.00', []), gqlLine(V9, 1, '99.00', [])] } }));
    assert.deepEqual(r.reasons, ['ORDER_ID_MISMATCH']);
});

test('link id: cart attributes first, line-item properties as backup, conflicts reported', () => {
    assert.deepEqual(extractInternalOrderId(gqlOrder()), { internalOrderId: TH, source: 'cart', conflict: false });
    assert.deepEqual(extractInternalOrderId(restOrder({ note_attributes: [] })), { internalOrderId: TH, source: 'line_item', conflict: false });
    assert.deepEqual(extractInternalOrderId(gqlOrder({ customAttributes: [{ key: 'internal_order_id', value: '  ' }] })), { internalOrderId: TH, source: 'line_item', conflict: false });
    assert.deepEqual(extractInternalOrderId({ line_items: [{ variant_id: 1, quantity: 1, price: '1' }] }), { internalOrderId: null, source: null, conflict: false });
    assert.deepEqual(extractInternalOrderId(null), { internalOrderId: null, source: null, conflict: false });

    const mixed = gqlOrder({ lineItems: { nodes: [gqlLine(V1, 2, '1499.00', [{ key: 'internal_order_id', value: 'TH-261116-OTHER000' }])] } });
    assert.equal(extractInternalOrderId(mixed).conflict, true);
    assert.ok(verifyShopifyOrderAgainstOurs(ours(), mixed).reasons.includes('ORDER_ID_CONFLICT'));

    const edges = { lineItems: { edges: [{ node: gqlLine(V1, 2, '1499.00') }] } };
    assert.equal(extractInternalOrderId(edges).internalOrderId, TH);
});

test('verify: the GraphQL field list asks for everything the verifier reads', () => {
    for (const f of ['currencyCode', 'customAttributes', 'totalDiscountsSet', 'lineItems', 'legacyResourceId', 'originalUnitPriceSet', 'quantity']) {
        assert.ok(VERIFY_ORDER_FIELDS.includes(f), f);
    }
});
