const test = require('node:test');
const assert = require('node:assert/strict');

const logic = require('../modules/shop/lib/checkoutLogic');
const { interpretStatus, verifyAgainstOrder, confirmedOrderFields } = require('../modules/shop/lib/fastrrOrderMapper');
const { displayStatus, toAppOrder, toAppOrderSummary } = require('../modules/shop/lib/orderView');
const { renderCheckoutPage, renderReturnPage, jsonForScript } = require('../modules/shop/lib/checkoutPage');
const { toFastrrProduct, toAppProductDetail, toAppProductSummary, isHiddenVariant } = require('../modules/shop/lib/catalogMapper');
const { evaluateCart, indexVariants } = require('../modules/shop/lib/cartEvaluator');
const { canTransition } = require('../modules/shop/lib/orderStateMachine');
const { placedOrder, fastrrOrder } = require('./helpers/fastrrMock');

const withEnv = (vars, fn) => {
    const saved = {};
    for (const [k, v] of Object.entries(vars)) { saved[k] = process.env[k]; if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    try { return fn(); } finally {
        for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    }
};

// ── Ids / idempotency ──────────────────────────────────────────────────────

test('checkout: internal order ids are well-formed, IST-dated and unique', () => {
    const id = logic.newInternalOrderId(new Date('2026-11-14T20:00:00Z')); // 01:30 IST on the 15th
    assert.match(id, /^TH-261115-[0-9A-Z]{8}$/);
    assert.ok(logic.isValidInternalOrderId(id));
    const many = new Set(Array.from({ length: 2000 }, () => logic.newInternalOrderId()));
    assert.equal(many.size, 2000);
    for (const bad of ['TH-1', 'th-261115-ABCDEFGH', 'TH-261115-ABCDEFG!', '../etc', '', null]) {
        assert.equal(logic.isValidInternalOrderId(bad), false, String(bad));
    }
});

test('checkout: idempotency key format', () => {
    assert.ok(logic.isValidIdempotencyKey('9b2f1c1e-4f7a-4a43-9a7e-0e1d2c3b4a59'));
    assert.ok(logic.isValidIdempotencyKey('attempt:1700000000.1'));
    for (const bad of [undefined, '', 'short', 'x'.repeat(129), 'has space here', '{"$gt":""}', 123]) {
        assert.equal(logic.isValidIdempotencyKey(bad), false, String(bad));
    }
});

test('checkout: cart hash ignores line order but sees qty / price / variant changes', () => {
    const a = [{ variantId: '1', quantity: 2, unitPrice: 100 }, { variantId: '2', quantity: 1, unitPrice: 50 }];
    assert.equal(logic.cartHash(a), logic.cartHash([...a].reverse()));
    assert.notEqual(logic.cartHash(a), logic.cartHash([{ ...a[0], quantity: 3 }, a[1]]));
    assert.notEqual(logic.cartHash(a), logic.cartHash([{ ...a[0], unitPrice: 101 }, a[1]]));
    assert.notEqual(logic.cartHash(a), logic.cartHash([a[0]]));
});

test('checkout: Fastrr access-token payload carries our price, app flag and our order id', () => {
    const p = logic.buildCheckoutTokenPayload({
        items: [
            { variantId: '57199514222897', quantity: 2, priceSnapshot: 149900, title: 'Berberine', variantTitle: '1 pack / One-Time', imageUrl: 'https://cdn/b.jpg' },
            { variantId: '42', quantity: 1, priceSnapshot: 9950, title: 'Trial', variantTitle: 'Default Title', imageUrl: null },
        ],
        internalOrderId: 'TH-261115-ABCDEFGH',
        redirectUrl: 'https://www.take.health/api/shop/checkout/TH-261115-ABCDEFGH/return',
        placeholderImageUrl: 'https://cdn/placeholder.png',
        now: new Date('2026-11-15T10:00:00Z'),
    });
    assert.equal(p.cart_data.mobile_app, true);
    assert.deepEqual(p.cart_data.custom_attributes, { internal_order_id: 'TH-261115-ABCDEFGH' });
    assert.deepEqual(p.cart_data.items[0], {
        variant_id: '57199514222897', quantity: 2,
        catalog_data: { price: 1499, name: 'Berberine - 1 pack / One-Time', image_url: 'https://cdn/b.jpg' },
    });
    assert.equal(p.cart_data.items[1].catalog_data.price, 99.5);
    assert.equal(p.cart_data.items[1].catalog_data.name, 'Trial'); // Shopify's "Default Title" left out
    assert.equal(p.cart_data.items[1].catalog_data.image_url, 'https://cdn/placeholder.png');
    assert.equal(p.redirect_url, 'https://www.take.health/api/shop/checkout/TH-261115-ABCDEFGH/return');
    assert.equal(p.timestamp, '2026-11-15T10:00:00.000Z');
});

test('checkout: signed page links verify, and reject tampering / expiry / other orders', () => {
    const now = Date.now();
    const { exp, sig } = logic.signPageParams('secret', 'TH-261115-ABCDEFGH', 60_000, now);
    assert.ok(logic.verifyPageParams('secret', 'TH-261115-ABCDEFGH', String(exp), sig, now));
    assert.equal(logic.verifyPageParams('secret', 'TH-261115-ABCDEFGX', exp, sig, now), false);
    assert.equal(logic.verifyPageParams('other', 'TH-261115-ABCDEFGH', exp, sig, now), false);
    assert.equal(logic.verifyPageParams('secret', 'TH-261115-ABCDEFGH', exp + 1, sig, now), false);
    assert.equal(logic.verifyPageParams('secret', 'TH-261115-ABCDEFGH', exp, `${sig}x`, now), false);
    assert.equal(logic.verifyPageParams('secret', 'TH-261115-ABCDEFGH', exp, undefined, now), false);
    assert.equal(logic.verifyPageParams('secret', 'TH-261115-ABCDEFGH', exp, sig, now + 120_000), false); // expired
});

test('checkout: deep link template is filled and URL-encoded', () => {
    assert.equal(
        logic.fillTemplate('takehealth://shop/order/{orderId}?status={status}&x={unknown}', { orderId: 'TH-1', status: 'a b&c' }),
        'takehealth://shop/order/TH-1?status=a%20b%26c&x={unknown}'
    );
});

// ── Fastrr order details -> our state ──────────────────────────────────────

test('fastrr: status interpretation covers every documented combination', () => {
    const s = (status, payment_type, payment_status) => interpretStatus({ status, payment_type, payment_status });
    assert.deepEqual(s('SUCCESS', 'PREPAID', 'Success'), { outcome: 'paid', method: 'prepaid' });
    assert.deepEqual(s('SUCCESS', 'CASH_ON_DELIVERY', 'Pending'), { outcome: 'cod_pending', method: 'cod' });
    assert.deepEqual(s('SUCCESS', 'PREPAID', 'Pending'), { outcome: 'pending', method: 'prepaid' });
    assert.deepEqual(s('SUCCESS', 'PREPAID', 'Failed'), { outcome: 'failed', method: 'prepaid' });
    assert.equal(s('FAILED', null, null).outcome, 'failed');
    assert.equal(s('INITIATED', null, null).outcome, 'pending');
    assert.equal(s('CREATED', null, null).outcome, 'pending');
    assert.equal(s('SUCCESS', 'BNPL_SOMETHING', 'Success').outcome, 'pending'); // unknown type: don't guess
    assert.equal(s('success', 'prepaid', 'success').outcome, 'paid');          // case-insensitive
    assert.equal(interpretStatus(null).outcome, 'pending');
});

const ourOrder = { amount: 299800, items: [{ variantId: '11', quantity: 2 }] };

test('fastrr: sanity checks pass for the cart we sent', () => {
    const d = placedOrder('f1', { items: [{ variantId: '11', quantity: 2 }], subtotal: 2998, discount: 100 });
    assert.deepEqual(verifyAgainstOrder(ourOrder, d, 'paid'), []);
});

test('fastrr: sanity checks flag subtotal, items and payment amount mismatches', () => {
    const items = [{ variantId: '11', quantity: 2 }];
    assert.match(verifyAgainstOrder(ourOrder, placedOrder('f', { items, subtotal: 2000 }), 'paid')[0], /^SUBTOTAL_MISMATCH:200000!=299800$/);
    assert.deepEqual(verifyAgainstOrder(ourOrder, placedOrder('f', { items: [{ variantId: '11', quantity: 3 }], subtotal: 2998 }), 'paid'), ['ITEMS_MISMATCH']);
    assert.deepEqual(verifyAgainstOrder(ourOrder, placedOrder('f', { items: [...items, { variantId: '99', quantity: 1 }], subtotal: 2998 }), 'paid'), ['ITEMS_MISMATCH']);
    assert.match(verifyAgainstOrder(ourOrder, placedOrder('f', { items, subtotal: 2998, received: 1 }), 'paid')[0], /^PAYMENT_AMOUNT_MISMATCH/);
    assert.deepEqual(verifyAgainstOrder(ourOrder, { ...placedOrder('f', { items, subtotal: 2998 }), subtotal_price: null }, 'paid'), ['SUBTOTAL_MISSING']);
    // COD: nothing received yet, so no payment check
    assert.deepEqual(verifyAgainstOrder(ourOrder, placedOrder('f', { items, subtotal: 2998, cod: true }), 'cod_pending'), []);
});

test('fastrr: confirmed order fields are mapped to paise / our address shape, nulls dropped', () => {
    const d = placedOrder('fo1', { items: [{ variantId: '11', quantity: 2 }], subtotal: 2998, discount: 100.5, shipping: 49 });
    const set = confirmedOrderFields(d, 'prepaid', new Date('2026-11-15T00:00:00Z'));
    assert.equal(set.paymentMethod, 'prepaid');
    assert.equal(set.paidFastrrOrderId, 'fo1');
    assert.deepEqual(set.pricing, { subtotal: 299800, discount: 10050, prepaidDiscount: 0, shipping: 4900, codCharges: 0, total: 294650, couponCodes: ['SAVE'] });
    assert.equal(set.shippingAddress.firstName, 'Asha');
    assert.equal(set.shippingAddress.pincode, '411001');
    assert.equal(set.shippingAddress.landmark, undefined);
    assert.deepEqual(set.payment, { gateway: 'Razorpay', method: 'UPI', txnId: 'Txn1', pgTransactionId: 'pay_ABC', amountReceived: 294650 });
    assert.equal(set.razorpayPaymentId, 'pay_ABC');
    assert.equal('razorpayOrderId' in set, false);
    assert.equal(set.rtoPrediction, 'low');

    // Fastrr's doc example: pg_transaction_id is a Razorpay ORDER id
    const withRzpOrder = { ...d, payments: d.payments.map((p) => ({ ...p, pg_transaction_id: 'order_QnJbE6i9UScecJ' })) };
    const s2 = confirmedOrderFields(withRzpOrder, 'prepaid');
    assert.equal(s2.razorpayOrderId, 'order_QnJbE6i9UScecJ');
    assert.equal('razorpayPaymentId' in s2, false);
    assert.equal(set.fastrrNumericOrderId, '113535525');

    const sparse = confirmedOrderFields(fastrrOrder('fo2', { status: 'SUCCESS', payment_type: 'CASH_ON_DELIVERY' }), 'cod');
    assert.equal('payment' in sparse, false);
    assert.equal('shippingAddress' in sparse, false);
    assert.equal('rtoPrediction' in sparse, false);
});

// ── App order view ─────────────────────────────────────────────────────────

test('orders: display status for every payment / fulfilment combination', () => {
    const d = (paymentStatus, fulfillmentStatus = 'unfulfilled') => displayStatus({ paymentStatus, fulfillmentStatus });
    assert.equal(d('pending'), 'awaiting_payment');
    assert.equal(d('failed'), 'payment_failed');
    assert.equal(d('expired'), 'expired');
    assert.equal(d('paid'), 'confirmed');
    assert.equal(d('cod_pending'), 'confirmed');
    assert.equal(d('paid', 'fulfilled'), 'shipped');
    assert.equal(d('paid', 'partial'), 'shipped');
    assert.equal(d('cod_pending', 'delivered'), 'delivered');
    assert.equal(d('paid', 'rto'), 'returned');
    assert.equal(d('paid', 'cancelled'), 'cancelled');
    assert.equal(d('cancelled'), 'cancelled');
    assert.equal(d('refund_pending', 'delivered'), 'refund_initiated');
    assert.equal(d('refunded'), 'refunded');
    assert.equal(d('partially_refunded'), 'partially_refunded');
});

test('orders: app shape uses Fastrr total once confirmed and never leaks internals', () => {
    const o = {
        internalOrderId: 'TH-261115-ABCDEFGH', paymentStatus: 'paid', fulfillmentStatus: 'unfulfilled', paymentMethod: 'prepaid',
        amount: 299800, pricing: { subtotal: 299800, discount: 10000, shipping: 0, codCharges: 0, total: 289800, couponCodes: ['X'] },
        items: [{ variantId: '11', title: 'Berberine', variantTitle: '1 pack', quantity: 2, priceSnapshot: 149900 }],
        fastrrToken: 'secret-token', user: 'u1', review: { needed: true }, createdAt: new Date(),
        shippingAddress: { firstName: 'Asha', lastName: 'K', line1: 'L1', city: 'Pune', pincode: '411001', email: 'a@b.c' },
    };
    const v = toAppOrder(o);
    assert.equal(v.status, 'confirmed');
    assert.equal(v.total.paise, 289800);
    assert.equal(v.pricing.subtotal.rupees, 2998);
    assert.equal(v.items[0].lineTotal.paise, 299800);
    assert.equal(v.itemCount, 2);
    assert.equal(v.shippingAddress.name, 'Asha K');
    const json = JSON.stringify(v);
    for (const secret of ['secret-token', 'review', '"user"', 'a@b.c']) assert.equal(json.includes(secret), false, secret);
    assert.equal(toAppOrderSummary({ ...o, pricing: undefined }).total.paise, 299800); // pending: our subtotal
});

// ── WebView HTML ───────────────────────────────────────────────────────────

test('page: token and urls cannot break out of the script / attributes', () => {
    const evil = '</script><script>alert(1)</script>';
    const html = renderCheckoutPage({ token: evil, uiBaseUrl: 'https://ui.example"><x', fallbackUrl: 'https://f/?a=1&b=2', amountText: '<b>₹1</b>' });
    assert.equal(html.includes('</script><script>alert(1)'), false);
    assert.ok(html.includes('\\u003c/script\\u003e'));
    assert.equal(html.includes('"><x'), false);
    assert.ok(html.includes('&lt;b&gt;₹1&lt;/b&gt;'));
    assert.ok(html.includes('isInitiatedFromApp'));
    assert.equal(JSON.parse(jsonForScript({ a: 'x\u2028y</' })).a, 'x\u2028y</'); // round-trips
    assert.equal(jsonForScript('\u2028').includes('\u2028'), false);
    const ret = renderReturnPage({ deepLink: 'takehealth://shop/order/TH-1?status=confirmed', title: 'Order placed', message: 'ok' });
    assert.ok(ret.includes('takehealth://shop/order/TH-1?status=confirmed'));
});

// ── Subscribe variants + Fastrr feed shape ─────────────────────────────────

const berberine = () => ({
    shopifyProductId: '9001', handle: 'berberine', title: 'Berberine', status: 'active', images: [{ url: 'https://cdn/p.jpg' }],
    minPrice: 134900,
    variants: [
        { shopifyVariantId: '1', title: '1 pack / One-Time', price: 149900, inventoryQty: 5, inventoryTracked: true, inventoryPolicy: 'deny',
            options: [{ name: 'Pack', value: '1 pack' }, { name: 'Purchase', value: 'One-Time' }] },
        { shopifyVariantId: '2', title: '1 pack / Subscribe', price: 134900, inventoryQty: 5, inventoryTracked: true, inventoryPolicy: 'deny',
            options: [{ name: 'Pack', value: '1 pack' }, { name: 'Purchase', value: 'Subscribe' }] },
        { shopifyVariantId: '3', title: '2 pack', price: 299800, inventoryQty: 5, inventoryTracked: true, inventoryPolicy: 'deny',
            options: [{ name: 'Pack', value: '2 pack' }, { name: 'Purchase', value: 'Subscription (monthly)' }] },
    ],
});

test('subscribe variants: hidden by default from app, Fastrr feed and cart', () => withEnv({ SHOP_HIDE_SUBSCRIBE_VARIANTS: undefined }, () => {
    const p = berberine();
    assert.equal(isHiddenVariant(p.variants[1]), true);  // title
    assert.equal(isHiddenVariant(p.variants[2]), true);  // option value
    assert.deepEqual(toAppProductDetail(p).variants.map((v) => v.id), ['1']);
    assert.equal(toAppProductSummary(p).minPrice.paise, 149900); // not the cheaper hidden price
    const f = toFastrrProduct(p);
    assert.deepEqual(f.variants.map((v) => v.id), [1]);
    assert.deepEqual(f.options, [{ name: 'Pack', values: ['1 pack'] }, { name: 'Purchase', values: ['One-Time'] }]);
    const cart = evaluateCart([{ variantId: '2', productId: '9001', quantity: 1, addedPrice: 134900 }], indexVariants([p]));
    assert.equal(cart.lines[0].issue, 'UNAVAILABLE');
    assert.equal(cart.summary.checkoutAllowed, false);
}));

test('subscribe variants: sold normally when SHOP_HIDE_SUBSCRIBE_VARIANTS=false', () => withEnv({ SHOP_HIDE_SUBSCRIBE_VARIANTS: 'false' }, () => {
    const p = berberine();
    assert.equal(toAppProductDetail(p).variants.length, 3);
    assert.equal(toAppProductSummary(p).minPrice.paise, 134900);
    assert.equal(toFastrrProduct(p).options[1].values.length, 3);
}));

test('subscribe variants: a product with only hidden variants shows no price and is not in stock', () => withEnv({ SHOP_HIDE_SUBSCRIBE_VARIANTS: 'true' }, () => {
    const p = berberine();
    p.variants = [p.variants[1]];
    const s = toAppProductSummary(p);
    assert.equal(s.minPrice, null);
    assert.equal(s.inStock, false);
}));

test('state machine: a flagged order can go straight to needs_attention', () => {
    assert.ok(canTransition('shopifySyncStatus', 'not_started', 'needs_attention'));
});
