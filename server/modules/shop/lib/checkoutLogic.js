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

// ── Fastrr Shopify WebView checkout URL ────────────────────────────────────
// Exact server-side copy of Fastrr's mobileApp.js `getOneClickCheckoutUrl`
// (fastrr-boost-ui.pickrr.com/assets/js/channels/mobileApp.js, read 2026-11-16):
//   items -> [{ productId: id, quantity, title, variantId: variant_id, variantTitle: "",
//               price, image, customAttributes? }]
//   cart  =  btoa(encodeURIComponent(JSON.stringify(items)))
//   url   =  base + &platform=SHOPIFY &sellerDomain= &domain=<webUrl> &cart= &isBaseEncode=true
//            &isMobileApp=true [&couponCode=] [&cartAttributes=<b64>] [&encodingRequired=true]
// cartAttributes need encodingRequired=true — without it the script appends the
// raw object ("[object Object]"). Their example passes the variant id as `id`
// (-> productId); we do the same. Prices in paise, as in their example.

const b64uri = (value) => Buffer.from(encodeURIComponent(JSON.stringify(value)), 'utf8').toString('base64');

/**
 * @param {object} p
 * @param {Array}  p.items            order items { variantId, quantity, priceSnapshot, title, variantTitle, imageUrl }
 * @param {string} p.internalOrderId  TH-... (goes to the Shopify order: cart + line-item attributes)
 * @param {string} p.baseUrl          e.g. https://fastrr-boost-ui.pickrr.com/headless/?
 * @param {string} p.sellerDomain     e.g. 2jfdfm-vp.myshopify.com
 * @param {string} [p.webUrl]
 * @param {string} [p.couponCode]
 * @param {string} [p.placeholderImageUrl]
 */
const buildFastrrWebviewUrl = ({ items, internalOrderId, baseUrl, sellerDomain, webUrl, couponCode, placeholderImageUrl = '' }) => {
    const cart = items.map((i) => ({
        productId: Number(i.variantId),
        quantity: i.quantity,
        title: i.variantTitle && i.variantTitle !== 'Default Title' ? `${i.title} - ${i.variantTitle}` : i.title,
        variantId: Number(i.variantId),
        variantTitle: '',
        price: i.priceSnapshot,
        image: i.imageUrl || placeholderImageUrl,
        customAttributes: { internal_order_id: internalOrderId }, // backup link path (line-item properties)
    }));
    let url = baseUrl;
    url += '&platform=SHOPIFY';
    url += `&sellerDomain=${sellerDomain}`;
    url += `&domain=${webUrl}`;
    url += `&cart=${b64uri(cart)}`;
    url += '&isBaseEncode=true';
    url += '&isMobileApp=true';
    if (couponCode) url += `&couponCode=${couponCode}`;
    url += `&cartAttributes=${b64uri({ internal_order_id: internalOrderId })}`;
    url += '&encodingRequired=true';
    return url;
};

/** Inverse of the encoding above (tests / debugging). */
const decodeB64uri = (s) => JSON.parse(decodeURIComponent(Buffer.from(String(s), 'base64').toString('utf8')));

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
    buildFastrrWebviewUrl,
    decodeB64uri,
    signPageParams,
    verifyPageParams,
    fillTemplate,
};
