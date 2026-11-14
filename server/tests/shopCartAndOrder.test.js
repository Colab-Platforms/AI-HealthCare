const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluateCart, indexVariants } = require('../modules/shop/lib/cartEvaluator');
const { canTransition, allowedFrom, TRANSITIONS, INITIAL } = require('../modules/shop/lib/orderStateMachine');

const product = (over = {}) => ({
    shopifyProductId: 'P1',
    handle: 'berberine',
    title: 'Berberine',
    status: 'active',
    images: [{ url: 'https://cdn/p.jpg' }],
    variants: [
        { shopifyVariantId: 'V1', title: '60 caps', price: 79900, inventoryQty: 5, inventoryTracked: true, inventoryPolicy: 'deny' },
        { shopifyVariantId: 'V2', title: '120 caps', price: 149900, inventoryQty: 0, inventoryTracked: true, inventoryPolicy: 'deny' },
        { shopifyVariantId: 'V3', title: 'Trial', price: 9900, inventoryQty: 0, inventoryTracked: true, inventoryPolicy: 'continue' },
    ],
    ...over,
});

const item = (variantId, quantity, addedPrice) => ({ variantId, productId: 'P1', quantity, addedPrice });

// ── Cart ───────────────────────────────────────────────────────────────────

test('cart: clean lines sum into the subtotal and allow checkout', () => {
    const r = evaluateCart([item('V1', 2, 79900), item('V3', 1, 9900)], indexVariants([product()]));
    assert.equal(r.summary.subtotal.paise, 2 * 79900 + 9900);
    assert.equal(r.summary.itemCount, 3);
    assert.equal(r.summary.checkoutAllowed, true);
    assert.equal(r.lines[1].availableQty, null); // oversell allowed = no limit
    assert.equal(r.lines[0].imageUrl, 'https://cdn/p.jpg'); // falls back to product image
});

test('cart: price change is flagged (not blocking) and uses the new price', () => {
    const r = evaluateCart([item('V1', 1, 69900)], indexVariants([product()]));
    const l = r.lines[0];
    assert.equal(l.priceChanged, true);
    assert.equal(l.previousPrice.paise, 69900);
    assert.equal(l.unitPrice.paise, 79900);
    assert.equal(r.summary.subtotal.paise, 79900);
    assert.equal(r.summary.checkoutAllowed, true);
});

test('cart: out of stock / not enough stock / removed product block checkout and are left out of the subtotal', () => {
    const r = evaluateCart(
        [item('V1', 9, 79900), item('V2', 1, 149900), item('GONE', 1, 5000)],
        indexVariants([product()])
    );
    assert.deepEqual(r.lines.map((l) => l.issue), ['INSUFFICIENT_STOCK', 'OUT_OF_STOCK', 'UNAVAILABLE']);
    assert.equal(r.lines[0].availableQty, 5);
    assert.equal(r.lines[2].unitPrice.paise, 5000); // removed product still shows its last known price
    assert.equal(r.summary.subtotal.paise, 0);
    assert.equal(r.summary.hasIssues, true);
    assert.equal(r.summary.checkoutAllowed, false);
});

test('cart: archived product makes its lines unavailable', () => {
    const r = evaluateCart([item('V1', 1, 79900)], indexVariants([product({ status: 'archived' })]));
    assert.equal(r.lines[0].issue, 'UNAVAILABLE');
});

test('cart: empty cart cannot check out', () => {
    const r = evaluateCart([], new Map());
    assert.equal(r.summary.checkoutAllowed, false);
    assert.equal(r.summary.subtotal.paise, 0);
});

// ── Order state machine ────────────────────────────────────────────────────

test('state machine: happy paths', () => {
    assert.ok(canTransition('paymentStatus', 'pending', 'paid'));
    assert.ok(canTransition('paymentStatus', 'pending', 'cod_pending'));
    assert.ok(canTransition('paymentStatus', 'cod_pending', 'paid')); // cash collected on delivery
    assert.ok(canTransition('shopifySyncStatus', 'pending', 'synced'));
    assert.ok(canTransition('fulfillmentStatus', 'fulfilled', 'delivered'));
});

test('state machine: late / out-of-order events cannot move an order backwards', () => {
    assert.equal(canTransition('paymentStatus', 'paid', 'failed'), false);   // FAILED after SUCCESS
    assert.equal(canTransition('paymentStatus', 'paid', 'pending'), false);
    assert.equal(canTransition('paymentStatus', 'refunded', 'paid'), false);
    assert.equal(canTransition('shopifySyncStatus', 'synced', 'pending'), false); // never create the Shopify order twice
    assert.equal(canTransition('fulfillmentStatus', 'delivered', 'unfulfilled'), false);
});

test('state machine: a late-confirmed payment can still rescue an expired order', () => {
    assert.ok(canTransition('paymentStatus', 'expired', 'paid'));
    assert.deepEqual(allowedFrom('paymentStatus', 'paid').sort(), ['cod_pending', 'expired', 'failed', 'pending']);
});

test('state machine: every target state exists and initial states are defined', () => {
    for (const [field, map] of Object.entries(TRANSITIONS)) {
        assert.ok(map[INITIAL[field]], `${field} initial state missing`);
        for (const targets of Object.values(map)) {
            for (const t of targets) assert.ok(t in map, `${field}: unknown target ${t}`);
        }
    }
    assert.throws(() => allowedFrom('nope', 'x'));
});
