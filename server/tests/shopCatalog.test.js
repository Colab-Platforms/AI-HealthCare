const test = require('node:test');
const assert = require('node:assert/strict');

const {
    mapShopifyProduct, toFastrrProduct, toAppProductDetail, availableQty, UNLIMITED_QTY_FOR_FASTRR,
} = require('../modules/shop/lib/catalogMapper');
const { toPaise, paiseToDecimalString } = require('../modules/shop/lib/money');
const { _internal } = require('../modules/shop/services/catalogService');

const shopifyNode = (over = {}) => ({
    legacyResourceId: '10790037291313',
    title: 'Berberine',
    handle: 'berberine',
    descriptionHtml: '<p>Supports glucose</p>',
    vendor: 'Take',
    productType: 'Supplement',
    tags: ['glucose', 'metabolic'],
    status: 'ACTIVE',
    createdAt: '2026-01-10T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
    media: { nodes: [{ image: { url: 'https://cdn/img1.jpg', altText: 'front' } }, {}] },
    collections: { nodes: [{ legacyResourceId: '555', handle: 'metabolic', title: 'Metabolic' }] },
    variants: {
        pageInfo: { hasNextPage: false },
        nodes: [
            {
                legacyResourceId: '44000000000001', title: '60 caps', sku: 'LBHCLOT1',
                price: '799.00', compareAtPrice: '999.00', inventoryQuantity: 12, inventoryPolicy: 'DENY',
                taxable: true, createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-11-01T10:00:00Z',
                selectedOptions: [{ name: 'Size', value: '60 caps' }],
                media: { nodes: [] },
                inventoryItem: { legacyResourceId: '900001', tracked: true, measurement: { weight: { unit: 'GRAMS', value: 150 } } },
            },
            {
                legacyResourceId: '44000000000002', title: '120 caps', sku: 'LBHCLSB1',
                price: '1499.50', compareAtPrice: null, inventoryQuantity: 0, inventoryPolicy: 'CONTINUE',
                taxable: true, selectedOptions: [{ name: 'Size', value: '120 caps' }],
                media: { nodes: [{ image: { url: 'https://cdn/v2.jpg' } }] },
                inventoryItem: { legacyResourceId: '900002', tracked: true, measurement: { weight: { unit: 'KILOGRAMS', value: 0.3 } } },
            },
        ],
    },
    ...over,
});

test('money: decimal strings and float noise become exact integer paise', () => {
    assert.equal(toPaise('799.00'), 79900);
    assert.equal(toPaise(1586.6800000000003), 158668);
    assert.equal(toPaise('0.1'), 10);
    assert.equal(toPaise(null), null);
    assert.equal(toPaise('abc'), null);
    assert.equal(paiseToDecimalString(149950), '1499.50');
});

test('mapShopifyProduct: ids as strings, prices in paise, status/inventory/weight normalised', () => {
    const p = mapShopifyProduct(shopifyNode());
    assert.equal(p.shopifyProductId, '10790037291313');
    assert.equal(p.status, 'active');
    assert.equal(p.minPrice, 79900);
    assert.deepEqual(p.images, [{ url: 'https://cdn/img1.jpg', alt: 'front' }]); // media without image skipped
    assert.deepEqual(p.collections, [{ shopifyCollectionId: '555', handle: 'metabolic', title: 'Metabolic' }]);

    const [a, b] = p.variants;
    assert.equal(a.shopifyVariantId, '44000000000001');
    assert.equal(a.inventoryItemId, '900001');
    assert.equal(a.price, 79900);
    assert.equal(a.compareAtPrice, 99900);
    assert.equal(a.inventoryPolicy, 'deny');
    assert.equal(a.weightGrams, 150);
    assert.equal(b.price, 149950);
    assert.equal(b.compareAtPrice, null);
    assert.equal(b.inventoryPolicy, 'continue');
    assert.equal(b.weightGrams, 300);
    assert.equal(b.imageUrl, 'https://cdn/v2.jpg');
});

test('mapShopifyProduct: unknown status is treated as not sellable; priceless variants dropped', () => {
    const node = shopifyNode({ status: 'UNLISTED' });
    node.variants.nodes[1].price = null;
    const p = mapShopifyProduct(node);
    assert.equal(p.status, 'draft');
    assert.equal(p.variants.length, 1);
});

test('availableQty: tracked stock, oversell allowed, untracked, inactive product', () => {
    const p = mapShopifyProduct(shopifyNode());
    assert.equal(availableQty(p, p.variants[0]), 12);
    assert.equal(availableQty(p, p.variants[1]), Infinity); // CONTINUE = can oversell
    assert.equal(availableQty(p, { ...p.variants[0], inventoryTracked: false, inventoryQty: 0 }), Infinity);
    assert.equal(availableQty({ ...p, status: 'archived' }, p.variants[0]), 0);
    assert.equal(availableQty(p, { ...p.variants[0], inventoryQty: -3 }), 0);
});

test('toFastrrProduct: long ids, decimal prices, no-limit stock not reported as 0', () => {
    const f = toFastrrProduct(mapShopifyProduct(shopifyNode()));
    assert.equal(f.id, 10790037291313);
    assert.equal(typeof f.variants[0].id, 'number');
    assert.equal(f.variants[0].price, '799.00');
    assert.equal(f.variants[0].compare_at_price, '999.00');
    assert.equal(f.variants[0].quantity, 12);
    assert.equal(f.variants[1].quantity, UNLIMITED_QTY_FOR_FASTRR);
    assert.equal(f.variants[1].compare_at_price, null);
    assert.deepEqual(f.variants[0].option_values, { Size: '60 caps' });
    assert.equal(f.tags, 'glucose, metabolic');
    assert.equal(f.status, 'active');
    assert.deepEqual(f.image, { src: 'https://cdn/img1.jpg' });
});

test('toFastrrProduct: archived product goes to Fastrr as draft (stops selling)', () => {
    const f = toFastrrProduct({ ...mapShopifyProduct(shopifyNode()), status: 'archived' });
    assert.equal(f.status, 'draft');
    assert.equal(f.variants[0].quantity, 0);
});

test('toAppProductDetail: compare-at shown only when higher than price', () => {
    const d = toAppProductDetail(mapShopifyProduct(shopifyNode()));
    assert.deepEqual(d.variants[0].compareAtPrice, { paise: 99900, rupees: 999 });
    assert.equal(d.variants[1].compareAtPrice, null);
    assert.equal(d.inStock, true);
    assert.deepEqual(d.minPrice, { paise: 79900, rupees: 799 });
});

test('cursor round-trips and rejects garbage', () => {
    const doc = { _id: '665f1c2b9a1e4b3c2d1e0f11', shopifyCreatedAt: new Date('2026-05-01T00:00:00Z') };
    const c = _internal.decodeCursor(_internal.encodeCursor(doc));
    assert.equal(String(c.id), doc._id);
    assert.equal(c.t.toISOString(), '2026-05-01T00:00:00.000Z');
    assert.equal(_internal.decodeCursor('not-a-cursor'), null);
    assert.equal(_internal.decodeCursor(Buffer.from('{"t":null,"id":"x"}').toString('base64url')), null);
});

test('search term is regex-escaped (no injection / ReDoS from user input)', () => {
    assert.equal(_internal.escapeRegex('a.*(b)+'), 'a\\.\\*\\(b\\)\\+');
});

test('fastrr paging: page starts at 1, limit clamped', () => {
    assert.deepEqual(_internal.fastrrPaging({}), { skip: 0, limit: 100 });
    assert.deepEqual(_internal.fastrrPaging({ page: '3', limit: '50' }), { skip: 100, limit: 50 });
    assert.deepEqual(_internal.fastrrPaging({ page: '0', limit: '9999' }), { skip: 0, limit: 250 });
});
