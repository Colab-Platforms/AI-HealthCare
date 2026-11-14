// Pure mapping functions — no DB, no network — so they're unit-tested directly.
//   Shopify Admin GraphQL node -> our Product / Collection document
//   our Product document       -> app response / Fastrr catalog-API response

const { toPaise, paiseToDecimalString, paiseToRupees } = require('./money');

const STATUS_MAP = { ACTIVE: 'active', DRAFT: 'draft', ARCHIVED: 'archived' };

const GRAMS_PER_UNIT = { GRAMS: 1, KILOGRAMS: 1000, OUNCES: 28.3495, POUNDS: 453.592 };

const toDate = (v) => (v ? new Date(v) : null);

const firstImageUrl = (mediaConn) =>
    (mediaConn?.nodes || []).map((m) => m?.image?.url).find(Boolean) || null;

const weightToGrams = (weight) => {
    if (!weight || weight.value === null || weight.value === undefined) return null;
    const factor = GRAMS_PER_UNIT[weight.unit];
    return factor ? Math.round(Number(weight.value) * factor) : null;
};

const mapShopifyVariant = (v) => ({
    shopifyVariantId: String(v.legacyResourceId),
    inventoryItemId: v.inventoryItem?.legacyResourceId ? String(v.inventoryItem.legacyResourceId) : null,
    title: v.title,
    sku: v.sku || '',
    price: toPaise(v.price),
    compareAtPrice: toPaise(v.compareAtPrice),
    inventoryQty: Number.isFinite(v.inventoryQuantity) ? v.inventoryQuantity : 0,
    inventoryTracked: v.inventoryItem?.tracked !== false,
    inventoryPolicy: v.inventoryPolicy === 'CONTINUE' ? 'continue' : 'deny',
    options: (v.selectedOptions || []).map((o) => ({ name: o.name, value: o.value })),
    imageUrl: firstImageUrl(v.media),
    weightGrams: weightToGrams(v.inventoryItem?.measurement?.weight),
    taxable: v.taxable !== false,
    shopifyCreatedAt: toDate(v.createdAt),
    shopifyUpdatedAt: toDate(v.updatedAt),
});

const mapShopifyProduct = (node) => {
    const variants = (node.variants?.nodes || [])
        .map(mapShopifyVariant)
        .filter((v) => v.price !== null); // a variant without a price can't be sold
    const prices = variants.map((v) => v.price);
    return {
        shopifyProductId: String(node.legacyResourceId),
        handle: node.handle,
        title: node.title,
        descriptionHtml: node.descriptionHtml || '',
        vendor: node.vendor || '',
        productType: node.productType || '',
        tags: node.tags || [],
        status: STATUS_MAP[node.status] || 'draft', // unknown status -> not sellable
        images: (node.media?.nodes || [])
            .filter((m) => m?.image?.url)
            .map((m) => ({ url: m.image.url, alt: m.image.altText || '' })),
        collections: (node.collections?.nodes || []).map((c) => ({
            shopifyCollectionId: String(c.legacyResourceId),
            handle: c.handle,
            title: c.title,
        })),
        variants,
        minPrice: prices.length ? Math.min(...prices) : null,
        shopifyCreatedAt: toDate(node.createdAt),
        shopifyUpdatedAt: toDate(node.updatedAt),
    };
};

const mapShopifyCollection = (node) => ({
    shopifyCollectionId: String(node.legacyResourceId),
    handle: node.handle,
    title: node.title,
    descriptionHtml: node.descriptionHtml || '',
    imageUrl: node.image?.url || null,
    shopifyUpdatedAt: toDate(node.updatedAt),
});

// ── Sellability ─────────────────────────────────────────────────────────────

// How many of this variant can be bought right now. Infinity = no stock limit
// (inventory not tracked, or the store allows overselling).
const availableQty = (product, variant) => {
    if (!product || !variant || product.status !== 'active') return 0;
    if (!variant.inventoryTracked || variant.inventoryPolicy === 'continue') return Infinity;
    return Math.max(0, variant.inventoryQty || 0);
};

const isPurchasable = (product, variant) => availableQty(product, variant) > 0;

// ── App responses ───────────────────────────────────────────────────────────

const money = (paise) => ({ paise, rupees: paiseToRupees(paise) });

const toAppVariant = (product, v) => ({
    id: v.shopifyVariantId,
    title: v.title,
    sku: v.sku,
    price: money(v.price),
    compareAtPrice: v.compareAtPrice && v.compareAtPrice > v.price ? money(v.compareAtPrice) : null,
    inStock: isPurchasable(product, v),
    options: v.options,
    imageUrl: v.imageUrl || product.images?.[0]?.url || null,
});

const toAppProductSummary = (p) => ({
    id: p.shopifyProductId,
    handle: p.handle,
    title: p.title,
    imageUrl: p.images?.[0]?.url || null,
    minPrice: money(p.minPrice),
    inStock: (p.variants || []).some((v) => isPurchasable(p, v)),
});

const toAppProductDetail = (p) => ({
    ...toAppProductSummary(p),
    descriptionHtml: p.descriptionHtml,
    vendor: p.vendor,
    productType: p.productType,
    tags: p.tags,
    images: p.images,
    collections: (p.collections || []).map((c) => ({ id: c.shopifyCollectionId, handle: c.handle, title: c.title })),
    variants: (p.variants || []).map((v) => toAppVariant(p, v)),
});

const toAppCollection = (c) => ({
    id: c.shopifyCollectionId,
    handle: c.handle,
    title: c.title,
    descriptionHtml: c.descriptionHtml,
    imageUrl: c.imageUrl,
});

// ── Fastrr catalog-API responses (shape from Fastrr's "SRC Custom Integration" docs) ──
// Ids must be unique longs. Shopify legacy ids are ~4e13, well inside
// Number.MAX_SAFE_INTEGER (~9e15), so Number() is lossless.

const iso = (d) => (d ? new Date(d).toISOString() : null);

// Fastrr wants a per-variant quantity; it has no "untracked" flag, so a
// no-limit variant is reported with a large number instead of 0 (which would
// make Fastrr treat it as out of stock).
const UNLIMITED_QTY_FOR_FASTRR = 9999;

const toFastrrProduct = (p) => ({
    id: Number(p.shopifyProductId),
    title: p.title,
    body_html: p.descriptionHtml || '',
    vendor: p.vendor || '',
    product_type: p.productType || '',
    created_at: iso(p.shopifyCreatedAt),
    handle: p.handle,
    updated_at: iso(p.shopifyUpdatedAt),
    tags: (p.tags || []).join(', '),
    status: p.status === 'active' ? 'active' : 'draft',
    variants: (p.variants || []).map((v) => {
        const qty = availableQty(p, v);
        return {
            id: Number(v.shopifyVariantId),
            title: v.title,
            price: paiseToDecimalString(v.price),
            compare_at_price: paiseToDecimalString(v.compareAtPrice),
            sku: v.sku || '',
            created_at: iso(v.shopifyCreatedAt),
            updated_at: iso(v.shopifyUpdatedAt),
            quantity: qty === Infinity ? UNLIMITED_QTY_FOR_FASTRR : qty,
            taxable: v.taxable !== false,
            grams: v.weightGrams || 0,
            image: v.imageUrl ? { src: v.imageUrl } : null,
            weight: v.weightGrams ? v.weightGrams / 1000 : 0,
            weight_unit: 'kg',
            option_values: Object.fromEntries((v.options || []).map((o) => [o.name, o.value])),
        };
    }),
    image: p.images?.[0]?.url ? { src: p.images[0].url } : null,
});

const toFastrrCollection = (c) => ({
    id: Number(c.shopifyCollectionId),
    updated_at: iso(c.shopifyUpdatedAt),
    body_html: c.descriptionHtml || '',
    handle: c.handle,
    image: c.imageUrl ? { src: c.imageUrl } : null,
    title: c.title,
    created_at: iso(c.createdAt),
});

module.exports = {
    mapShopifyProduct,
    mapShopifyCollection,
    availableQty,
    isPurchasable,
    toAppProductSummary,
    toAppProductDetail,
    toAppCollection,
    toFastrrProduct,
    toFastrrCollection,
    UNLIMITED_QTY_FOR_FASTRR,
};
