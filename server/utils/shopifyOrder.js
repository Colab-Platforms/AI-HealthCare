// Pure helpers for the Shopify "buy a product, get a 30-day trial" offer.
// No DB, no network — everything here is unit-tested in tests/shopifyOrder.test.js.

const crypto = require('crypto');

// ---------------------------------------------------------------------------
// config (read lazily so tests and scripts can set env before first use)
// ---------------------------------------------------------------------------

const csv = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

const getOfferConfig = () => ({
    days: Number(process.env.SHOPIFY_OFFER_DAYS) || 30,
    // Which products carry the offer. Product ID is the primary match: it is the
    // same for every variant (1 pack, subscription, ...) and survives renames.
    // SKUs / "TITLE:<name>" are a backup for lines without a product ID (orders
    // read without read_products, or custom line items). Both empty = every product.
    productIds: new Set(csv(process.env.SHOPIFY_OFFER_PRODUCT_IDS)),
    qualifyingSkus: new Set(csv(process.env.SHOPIFY_OFFER_SKUS).map((s) => s.replace(/\s+/g, ' ').toUpperCase())),
    // COD orders sit at 'pending' until marked paid; add 'pending' here if COD
    // buyers should get the offer before the store marks the order paid.
    eligibleStatuses: new Set(csv(process.env.SHOPIFY_OFFER_STATUSES || 'paid,partially_refunded').map((s) => s.toLowerCase())),
    allowTestOrders: process.env.SHOPIFY_ALLOW_TEST_ORDERS === 'true',
    orderPrefix: String(process.env.SHOPIFY_ORDER_PREFIX || 'TAKE').toUpperCase(),
    matchSecret: process.env.OFFER_MATCH_SECRET || '',
});

// ---------------------------------------------------------------------------
// order numbers
// ---------------------------------------------------------------------------

// Shopify order names look like "#TAKE11005". Users type all sorts of variants:
// "TAKE11005", "#take11005", "take-11005", " 11005 ". Canonical form: uppercase,
// no '#', no spaces/hyphens -> "TAKE11005".
const normalizeOrderName = (name) => {
    if (typeof name !== 'string') return null;
    const n = name.toUpperCase().replace(/[#\s-]/g, '');
    return /^[A-Z]*\d+[A-Z]*$/.test(n) && n.length <= 30 ? n : null;
};

const trailingNumber = (name) => {
    const m = /(\d+)\D*$/.exec(name || '');
    return m ? Number(m[1]) : null;
};

/**
 * What the user typed on the Redeem screen ->
 *   { orderName: "TAKE11005", orderNumber: 11005 }  or null if it can't be an order number.
 * Digits-only input is expanded with the store's prefix.
 */
const parseOrderNumberInput = (input, prefix = getOfferConfig().orderPrefix) => {
    if (typeof input !== 'string' && typeof input !== 'number') return null;
    const raw = String(input).trim();
    if (!raw || raw.length > 40) return null;
    const name = normalizeOrderName(raw);
    if (!name) return null;
    const isDigitsOnly = /^\d+$/.test(name);
    const orderName = isDigitsOnly ? `${prefix}${name}` : name;
    return { orderName, orderNumber: trailingNumber(orderName) };
};

// ---------------------------------------------------------------------------
// identity: email / phone, stored only as keyed hashes
// ---------------------------------------------------------------------------

const normalizeEmail = (email) => {
    if (typeof email !== 'string') return null;
    const e = email.trim().toLowerCase();
    return e.includes('@') && e.length <= 254 ? e : null;
};

// Indian numbers arrive as "+91 98765 43210", "09876543210", "9876543210".
// Compare on the last 10 digits.
const normalizePhone = (phone) => {
    if (typeof phone !== 'string' && typeof phone !== 'number') return null;
    const digits = String(phone).replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : null;
};

// HMAC, not plain sha256: a plain hash of an email can be reversed by hashing a
// list of known emails. Keyed with OFFER_MATCH_SECRET, the stored values are
// useless without the server secret. The secret must never change after go-live,
// or existing purchases stop matching.
const hashIdentifier = (kind, value, secret = getOfferConfig().matchSecret) => {
    if (!value) return null;
    if (!secret) throw new Error('OFFER_MATCH_SECRET is not set');
    return crypto.createHmac('sha256', secret).update(`${kind}:${value}`).digest('hex');
};

const uniq = (arr) => [...new Set(arr.filter(Boolean))];

const identityHashes = ({ emails = [], phones = [] }, secret) => ({
    emailHashes: uniq(emails.map(normalizeEmail)).map((e) => hashIdentifier('email', e, secret)),
    phoneHashes: uniq(phones.map(normalizePhone)).map((p) => hashIdentifier('phone', p, secret)),
});

// ---------------------------------------------------------------------------
// order normalization (webhook REST payload and Admin GraphQL node -> one shape)
// ---------------------------------------------------------------------------

const toDate = (v) => (v ? new Date(v) : null);

// Identity of a product line. The SKU when the store set one; otherwise
// "TITLE:<product title>" — the live store's Berberine has no SKU, and without a
// fallback its lines would vanish and a return could never revoke the offer.
// The same key is built from webhooks, Admin API orders and refunds, so they match.
// SHOPIFY_OFFER_SKUS entries use the same form ("TITLE:LIPOSOMAL BERBERINE HCL").
const lineKey = (li) => {
    if (li?.sku && String(li.sku).trim()) return String(li.sku).trim().toUpperCase();
    const title = li?.title || li?.name;
    return title ? `TITLE:${String(title).trim().replace(/\s+/g, ' ').toUpperCase()}` : null;
};

// Shopify product ID of a line: `product_id` in webhook / refund payloads,
// `product.legacyResourceId` from the Admin GraphQL API (needs read_products).
const productIdOf = (li) => {
    const id = li?.product_id ?? li?.product?.legacyResourceId;
    return id != null && String(id).trim() ? String(id).trim() : null;
};

// One line -> { productId?, sku, quantity } (sku = lineKey). productId is left out
// when unknown so the stored shape stays minimal.
const toLine = (li, quantity) => {
    const productId = productIdOf(li);
    return { ...(productId ? { productId } : {}), sku: lineKey(li), quantity: Number(quantity) || 0 };
};

// Quantities are needed to tell "returned the offer product" from "returned
// something else in the same order".
const toLineItems = (items) => (items || [])
    .map((li) => toLine(li, li.quantity))
    .filter((li) => (li.sku || li.productId) && li.quantity > 0);

const normalizeWebhookOrder = (o) => {
    const orderName = normalizeOrderName(o.name);
    const lineItems = toLineItems(o.line_items);
    return {
        shopifyOrderId: String(o.id),
        orderName,
        orderNumber: Number(o.order_number) || trailingNumber(orderName),
        emails: [o.email, o.contact_email, o.customer?.email],
        phones: [o.phone, o.customer?.phone, o.billing_address?.phone, o.shipping_address?.phone, o.customer?.default_address?.phone],
        lineItems,
        skus: uniq(lineItems.map((li) => li.sku)),
        financialStatus: String(o.financial_status || '').toLowerCase(),
        cancelledAt: toDate(o.cancelled_at),
        isTest: Boolean(o.test),
        orderCreatedAt: toDate(o.created_at),
        orderUpdatedAt: toDate(o.updated_at || o.created_at),
    };
};

const normalizeGraphqlOrder = (n) => {
    const orderName = normalizeOrderName(n.name);
    const lineItems = toLineItems(n.lineItems?.nodes);
    return {
        shopifyOrderId: String(n.legacyResourceId),
        orderName,
        orderNumber: trailingNumber(orderName),
        emails: [n.email],
        phones: [n.phone, n.billingAddress?.phone, n.shippingAddress?.phone],
        lineItems,
        skus: uniq(lineItems.map((li) => li.sku)),
        financialStatus: String(n.displayFinancialStatus || '').toLowerCase(),
        cancelledAt: toDate(n.cancelledAt),
        isTest: Boolean(n.test),
        orderCreatedAt: toDate(n.createdAt),
        orderUpdatedAt: toDate(n.updatedAt || n.createdAt),
    };
};

// Is this order line an offer product? Product ID first, SKU / title as backup.
const isOfferLine = (line, cfg = getOfferConfig()) => {
    const productIds = cfg.productIds || new Set();
    if (productIds.size === 0 && cfg.qualifyingSkus.size === 0) return true; // no filter configured
    return Boolean((line.productId && productIds.has(String(line.productId))) || (line.sku && cfg.qualifyingSkus.has(line.sku)));
};

// Older stored rows may only have `skus`; treat each as a line.
const linesOf = (order) => (order.lineItems?.length ? order.lineItems : (order.skus || []).map((sku) => ({ sku, quantity: 1 })));

/**
 * Why an order does or doesn't qualify. `reason` is null when eligible.
 */
const evaluateEligibility = (order, cfg = getOfferConfig()) => {
    const qualifies = linesOf(order).some((line) => isOfferLine(line, cfg));
    let reason = null;
    if (order.isTest && !cfg.allowTestOrders) reason = 'test_order';
    else if (order.cancelledAt) reason = 'cancelled';
    else if (!cfg.eligibleStatuses.has(order.financialStatus)) reason = order.financialStatus === 'refunded' ? 'refunded' : 'not_paid';
    else if (!qualifies) reason = 'product_not_in_offer';
    return { eligible: reason === null, reason };
};

// One Shopify refund (refunds/create payload) -> { refundId, orderId, items: [{ productId?, sku, quantity }] }.
const normalizeRefund = (r) => ({
    refundId: r?.id != null ? String(r.id) : null,
    orderId: r?.order_id != null ? String(r.order_id) : null,
    items: (r?.refund_line_items || [])
        .map((rli) => toLine(rli.line_item, rli.quantity))
        .filter((i) => (i.sku || i.productId) && i.quantity > 0),
});

// A refunded line belongs to a bought line if they share the product ID, or the
// SKU/title key when an ID is missing on either side.
const sameProduct = (a, b) => Boolean((a.productId && b.productId && String(a.productId) === String(b.productId))
    || (a.sku && b.sku && a.sku === b.sku));

/**
 * Has every unit of the offer product(s) in this order been refunded?
 * Returning something else from the same order doesn't count. With no product
 * filter configured, every product counts as an offer product.
 */
const offerProductFullyRefunded = (lineItems = [], refundLines = [], cfg = getOfferConfig()) => {
    const offerLines = lineItems.filter((li) => isOfferLine(li, cfg));
    const bought = offerLines.reduce((sum, li) => sum + (li.quantity || 0), 0);
    if (!bought) return false;
    const refunded = refundLines
        .filter((r) => offerLines.some((li) => sameProduct(li, r)))
        .reduce((sum, r) => sum + (r.quantity || 0), 0);
    return refunded >= bought;
};

/**
 * Final verdict for a stored order: its own status (evaluateEligibility) plus
 * refunds recorded line by line. Used whenever the order or its refunds change.
 */
const finalEligibility = (doc, cfg = getOfferConfig()) => {
    const base = evaluateEligibility({ lineItems: doc.lineItems, skus: doc.skus || [], financialStatus: doc.financialStatus, cancelledAt: doc.cancelledAt, isTest: doc.isTest }, cfg);
    if (!base.eligible) return base;
    if (offerProductFullyRefunded(doc.lineItems, doc.refundLines, cfg)) return { eligible: false, reason: 'refunded' };
    return base;
};

// ---------------------------------------------------------------------------
// webhook signature
// ---------------------------------------------------------------------------

// Shopify signs the exact raw body with the app's client secret:
// X-Shopify-Hmac-Sha256 = base64(HMAC_SHA256(secret, rawBody)).
const verifyShopifyHmac = (rawBody, headerHmac, secret) => {
    if (!secret || typeof headerHmac !== 'string' || typeof rawBody !== 'string') return false;
    const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
    const a = Buffer.from(expected);
    const b = Buffer.from(headerHmac);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
};

module.exports = {
    getOfferConfig,
    normalizeOrderName,
    parseOrderNumberInput,
    normalizeEmail,
    normalizePhone,
    hashIdentifier,
    identityHashes,
    normalizeWebhookOrder,
    normalizeGraphqlOrder,
    evaluateEligibility,
    isOfferLine,
    normalizeRefund,
    offerProductFullyRefunded,
    finalEligibility,
    verifyShopifyHmac,
};
