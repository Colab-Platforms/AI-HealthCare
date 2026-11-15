// Shop configuration. Read lazily (functions, not constants) so tests and the
// two hosts (Vercel + Render) always see the current env.

// The shop sells from the retail "Take Limited" store, the same store the card
// offer reads — SHOPIFY_ADMIN_STORE_DOMAIN / SHOPIFY_ADMIN_TOKEN, via
// services/shopifyAdminService. NOT SHOPIFY_STORE_DOMAIN (old Fastrr test store).

const intEnv = (name, fallback) => {
    const n = parseInt(process.env[name], 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

const boolEnv = (name, fallback) => {
    const v = String(process.env[name] ?? '').trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(v)) return true;
    if (['false', '0', 'no', 'off'].includes(v)) return false;
    return fallback;
};

const trimSlash = (s) => String(s || '').trim().replace(/\/+$/, '');

const FASTRR_STAGING_API = 'https://fastrr-api-dev.pickrr.com';
const FASTRR_UI = {
    staging: 'https://customcheckoutfastrr.netlify.app',
    production: 'https://checkout-ui.shiprocket.com',
};

const fastrrBaseUrl = () => trimSlash(process.env.FASTRR_BASE_URL) || FASTRR_STAGING_API;

module.exports = {
    // Cart guard rails — stop abuse / accidental huge quantities.
    maxQtyPerItem: () => intEnv('SHOP_MAX_QTY_PER_ITEM', 10),
    maxCartLines: () => intEnv('SHOP_MAX_CART_LINES', 30),

    // Catalog listing page size for the app.
    defaultPageSize: 20,
    maxPageSize: 50,

    // Fastrr's catalog API contract: page/limit, limit up to 100 in their examples.
    fastrrMaxLimit: 250,

    // "Subscribe" variants are cheaper but our checkout has no recurring billing,
    // so selling one would be a one-off sale at the subscription price. Hidden by
    // default (fails safe: no money lost). See docs/shop-headless-plan.md §8.
    hideSubscribeVariants: () => boolEnv('SHOP_HIDE_SUBSCRIBE_VARIANTS', true),

    // ── Fastrr (Shiprocket Checkout) ────────────────────────────────────────
    fastrr: {
        baseUrl: fastrrBaseUrl,
        apiKey: () => process.env.FASTRR_API_KEY || '',
        apiSecret: () => process.env.FASTRR_API_SECRET || '',
        isConfigured: () => Boolean(process.env.FASTRR_API_KEY && process.env.FASTRR_API_SECRET),
        timeoutMs: () => intEnv('FASTRR_TIMEOUT_MS', 10000),
        // JS checkout bundle: staging bundle for the staging API, prod otherwise.
        uiBaseUrl: () => trimSlash(process.env.FASTRR_CHECKOUT_UI_URL)
            || (fastrrBaseUrl().includes('pickrr.com') ? FASTRR_UI.staging : FASTRR_UI.production),
        // Push product/collection changes to Fastrr after a Shopify webhook
        // (Fastrr also pulls our catalog APIs; push just makes it near-real-time).
        catalogPushEnabled: () => boolEnv('FASTRR_CATALOG_PUSH', true),
    },

    // ── Checkout ───────────────────────────────────────────────────────────
    // Public origin of this backend as the WebView / Fastrr see it
    // (e.g. https://www.take.health). Falls back to the request's host.
    publicBaseUrl: () => trimSlash(process.env.SHOP_PUBLIC_BASE_URL),
    // Where the WebView sends the user once checkout is over. {orderId} and
    // {status} are filled in.
    appDeepLink: () => process.env.SHOP_APP_DEEP_LINK || 'takehealth://shop/order/{orderId}?status={status}',
    // Fastrr's JS needs a fallback URL for when its checkout is down. Default is
    // our own return page (keeps the user out of the Shopify website).
    fallbackUrl: () => process.env.FASTRR_FALLBACK_URL || '',
    placeholderImageUrl: () => process.env.SHOP_PLACEHOLDER_IMAGE_URL || '',
    // Signed checkout-page links are valid this long.
    checkoutPageTtlMs: () => intEnv('SHOP_CHECKOUT_PAGE_TTL_MIN', 120) * 60 * 1000,
    // Re-use a Fastrr token only if it is valid for at least this much longer.
    tokenMinRemainingMs: 2 * 60 * 1000,
    // While one request is fetching a Fastrr token for an order, others wait.
    tokenLeaseMs: 20 * 1000,
    // Min gap between on-demand Fastrr status checks of one order (app polling).
    onDemandSyncGapMs: 10 * 1000,

    // ── Shopify order sync (M3) ────────────────────────────────────────────
    // OFF until confirmed that Fastrr does not also create Shopify orders
    // (otherwise every order would exist twice). See docs/shop-headless-plan.md.
    shopifyOrderSync: () => boolEnv('SHOP_SHOPIFY_ORDER_SYNC', false),
    // Mark created orders as Shopify test orders (live-store testing only).
    shopifyTestOrders: () => boolEnv('SHOP_SHOPIFY_TEST_ORDERS', false),
    // Shopify's own order-confirmation / shipping emails. Off: the app notifies.
    shopifySendReceipt: () => boolEnv('SHOP_SHOPIFY_SEND_RECEIPT', false),
    shopifySyncMaxAttempts: () => intEnv('SHOP_SHOPIFY_SYNC_MAX_ATTEMPTS', 5),
    shopifySyncLeaseMs: 60 * 1000,
    // A failed attempt is retried by the cron no sooner than this — Shopify's
    // order search can lag a few seconds behind a create, and the retry looks
    // the order up by tag first to avoid creating it twice.
    shopifyRetryAfterMs: 2 * 60 * 1000,
    // App orders also count for the Shopify card offer (management decision).
    appOrdersGetCardOffer: () => boolEnv('SHOP_APP_ORDERS_CARD_OFFER', true),
    orderPushNotifications: () => boolEnv('SHOP_ORDER_PUSH', true),

    // ── Stock reservation (M3) ─────────────────────────────────────────────
    // Held while the user is paying; then tied to the Fastrr token's expiry.
    reservationHoldMs: () => intEnv('SHOP_RESERVATION_MINUTES', 15) * 60 * 1000,
    reservationAfterTokenMs: 5 * 60 * 1000,
    // Paid but not yet in Shopify: keep holding (Shopify stock not reduced yet).
    reservationUntilSyncedMs: 24 * 60 * 60 * 1000,
    // After the Shopify order exists: brief hold until its inventory webhook lands.
    reservationAfterSyncedMs: 2 * 60 * 1000,

    // ── Reconciliation (QStash cron) ───────────────────────────────────────
    reconcile: {
        pendingOlderThanMs: 15 * 60 * 1000,   // give the webhook time first
        lookbackMs: 48 * 60 * 60 * 1000,      // don't chase very old checkouts
        expireAfterTokenExpiryMs: 10 * 60 * 1000,
        expireTokenlessAfterMs: 30 * 60 * 1000,
        recheckExpiredForMs: 6 * 60 * 60 * 1000, // a late payment can still land on an expired order
        batchSize: 100,
        timeBudgetMs: 45 * 1000,              // stay under the serverless timeout
        concurrency: 4,
        maxFastrrIdsPerOrder: 5,
    },
};
