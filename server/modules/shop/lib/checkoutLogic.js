// Pure checkout helpers — no DB / network — unit-tested directly.

const crypto = require('crypto');
const { paiseToRupees } = require('./money');

// ── Idempotency ────────────────────────────────────────────────────────────

// The app sends one key per checkout attempt (e.g. a UUID) and re-sends the
// same key on a retry / double tap.
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{8,128}$/;
const isValidIdempotencyKey = (key) => typeof key === 'string' && IDEMPOTENCY_KEY_RE.test(key);

// Fingerprint of what is being bought, at what price. Order-independent.
const cartHash = (lines) => {
    const canonical = (lines || [])
        .map((l) => `${l.variantId}:${l.quantity}:${l.unitPrice}`)
        .sort()
        .join('|');
    return crypto.createHash('sha256').update(canonical).digest('hex');
};

// ── Ids ────────────────────────────────────────────────────────────────────

// TH-YYMMDD-XXXXXXXX: date (IST) for humans + 8 chars of Crockford base32
// (40 bits of randomness). No 0/O/1/I/L/U confusion when read out on a call.
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const newInternalOrderId = (now = new Date()) => {
    const ist = new Date(now.getTime() + 330 * 60 * 1000);
    const ymd = ist.toISOString().slice(2, 10).replace(/-/g, '');
    const bytes = crypto.randomBytes(8);
    let rand = '';
    for (let i = 0; i < 8; i++) rand += B32[bytes[i] % 32];
    return `TH-${ymd}-${rand}`;
};

const INTERNAL_ORDER_ID_RE = /^TH-\d{6}-[0-9A-Z]{8}$/;
const isValidInternalOrderId = (id) => typeof id === 'string' && INTERNAL_ORDER_ID_RE.test(id);

// Fastrr order ids are Mongo ObjectIds in their docs; allow a little slack.
const FASTRR_ORDER_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const isValidFastrrOrderId = (id) => typeof id === 'string' && FASTRR_ORDER_ID_RE.test(id);

// ── Fastrr access-token payload ────────────────────────────────────────────

/**
 * @param {object} p
 * @param {Array}  p.items          order items { variantId, quantity, priceSnapshot (paise), title, variantTitle, imageUrl }
 * @param {string} p.internalOrderId
 * @param {string} p.redirectUrl
 * @param {string} [p.placeholderImageUrl]
 * @param {Date}   [p.now]
 */
const buildCheckoutTokenPayload = ({ items, internalOrderId, redirectUrl, placeholderImageUrl = '', now = new Date() }) => ({
    cart_data: {
        items: items.map((i) => ({
            variant_id: String(i.variantId),
            quantity: i.quantity,
            // Our price wins over whatever Fastrr has cached from the catalog.
            // Fastrr: "If defined, all below fields are required."
            catalog_data: {
                price: paiseToRupees(i.priceSnapshot),
                name: i.variantTitle && i.variantTitle !== 'Default Title' ? `${i.title} - ${i.variantTitle}` : i.title,
                image_url: i.imageUrl || placeholderImageUrl,
            },
        })),
        custom_attributes: { internal_order_id: internalOrderId },
        mobile_app: true,
    },
    redirect_url: redirectUrl,
    timestamp: now.toISOString(),
});

// ── Signed checkout-page links ─────────────────────────────────────────────
// The WebView opens the page without our Bearer token, so the link itself
// carries proof that our API issued it for this order.

const pageSignature = (secret, orderId, exp) =>
    crypto.createHmac('sha256', secret).update(`shop-checkout-page:${orderId}:${exp}`).digest('base64url');

const signPageParams = (secret, orderId, ttlMs, now = Date.now()) => {
    const exp = Math.floor((now + ttlMs) / 1000);
    return { exp, sig: pageSignature(secret, orderId, exp) };
};

const verifyPageParams = (secret, orderId, exp, sig, now = Date.now()) => {
    const expNum = Number(exp);
    if (!Number.isInteger(expNum) || expNum * 1000 < now) return false;
    if (typeof sig !== 'string' || !sig) return false;
    const expected = Buffer.from(pageSignature(secret, orderId, expNum));
    const given = Buffer.from(sig);
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
};

const fillTemplate = (template, values) =>
    template.replace(/\{(\w+)\}/g, (m, k) => (k in values ? encodeURIComponent(values[k]) : m));

module.exports = {
    isValidIdempotencyKey,
    cartHash,
    newInternalOrderId,
    isValidInternalOrderId,
    isValidFastrrOrderId,
    buildCheckoutTokenPayload,
    signPageParams,
    verifyPageParams,
    fillTemplate,
};
