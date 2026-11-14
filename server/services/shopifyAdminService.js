// Read-only Shopify Admin GraphQL client for the card offer. Scopes:
//   read_orders     — orders (required)
//   read_products   — the product ID on each order line, which is how offer
//                     products are recognised (SHOPIFY_OFFER_PRODUCT_IDS)
//   read_all_orders — only for backfilling orders older than 60 days
// Used for: the Redeem screen's fallback lookup, re-reading an order after a
// refund webhook, and the backfill script.

const API_TIMEOUT_MS = 10000;
const MAX_ATTEMPTS = 3;

const orderFields = (withProduct) => `
  legacyResourceId
  name
  email
  phone
  test
  createdAt
  updatedAt
  cancelledAt
  displayFinancialStatus
  billingAddress { phone }
  shippingAddress { phone }
  lineItems(first: 50) { nodes { sku title quantity ${withProduct ? 'product { legacyResourceId }' : ''} } }
`;

// Deliberately NOT SHOPIFY_STORE_DOMAIN: that one points at the old Fastrr test
// store. The card offer and the shop (modules/shop) both use the retail store
// ("Take Limited"). No fallback, so a missing
// value fails closed instead of silently reading the wrong store.
const getConfig = () => ({
    domain: process.env.SHOPIFY_ADMIN_STORE_DOMAIN,
    token: process.env.SHOPIFY_ADMIN_TOKEN,
    version: process.env.SHOPIFY_API_VERSION || '2026-10',
});

const isConfigured = () => {
    const { domain, token } = getConfig();
    return Boolean(domain && token);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class ShopifyApiError extends Error {
    constructor(message, errors) {
        super(message);
        this.errors = errors || [];
    }
}

// GraphQL call with a timeout and backoff on Shopify's rate limit (HTTP 429 or a
// THROTTLED error) — the store's API budget is shared with every other app on it.
const graphql = async (query, variables = {}) => {
    const { domain, token, version } = getConfig();
    if (!domain || !token) throw new Error('Shopify Admin API is not configured (SHOPIFY_ADMIN_STORE_DOMAIN / SHOPIFY_ADMIN_TOKEN)');

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
        let res;
        try {
            res = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
                body: JSON.stringify({ query, variables }),
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timer);
        }

        if (res.status === 429 && attempt < MAX_ATTEMPTS) {
            await sleep(1000 * attempt);
            continue;
        }
        const json = await res.json().catch(() => ({}));
        const throttled = json.errors?.some((e) => e.extensions?.code === 'THROTTLED');
        if (throttled && attempt < MAX_ATTEMPTS) {
            await sleep(1000 * attempt);
            continue;
        }
        if (!res.ok || json.errors) {
            const msg = json.errors?.map((e) => e.message).join('; ') || `HTTP ${res.status}`;
            throw new ShopifyApiError(`Shopify Admin API error: ${msg}`, json.errors);
        }
        return json.data;
    }
    throw new Error('Shopify Admin API: rate limited');
};

// Product IDs need read_products. If the token loses that scope, keep working
// without them (offer products then fall back to SKU / title matching) instead of
// every lookup failing — and say so loudly, once per process.
let productAccess = true;
const ordersQuery = async (build, variables) => {
    try {
        return await graphql(build(orderFields(productAccess)), variables);
    } catch (err) {
        const denied = productAccess && err instanceof ShopifyApiError
            && err.errors.some((e) => e.extensions?.code === 'ACCESS_DENIED' && /read_products/.test(e.message || ''));
        if (!denied) throw err;
        productAccess = false;
        console.warn('[ShopifyAdmin] token lacks read_products — product IDs unavailable, matching offer products by SKU/title only');
        return graphql(build(orderFields(false)), variables);
    }
};

// Order search is fuzzy, so the result is checked against the exact name.
const findOrderByName = async (orderName, normalizeOrderName) => {
    const data = await ordersQuery(
        (f) => `query ($q: String!) { orders(first: 5, query: $q) { nodes { ${f} } } }`,
        { q: `name:${orderName}` }
    );
    return (data.orders?.nodes || []).find((n) => normalizeOrderName(n.name) === orderName) || null;
};

const fetchOrderById = async (orderId) => {
    const data = await ordersQuery(
        (f) => `query ($id: ID!) { order(id: $id) { ${f} } }`,
        { id: `gid://shopify/Order/${orderId}` }
    );
    return data.order || null;
};

// One page of orders created on/after `sinceDate` (YYYY-MM-DD), oldest first.
const listOrdersSince = async (sinceDate, after = null) => {
    const data = await ordersQuery(
        (f) => `query ($q: String!, $after: String) {
           orders(first: 100, after: $after, query: $q, sortKey: CREATED_AT) {
             pageInfo { hasNextPage endCursor }
             nodes { ${f} }
           }
         }`,
        { q: `created_at:>=${sinceDate}`, after }
    );
    return { nodes: data.orders.nodes, pageInfo: data.orders.pageInfo };
};

// `graphql` is also used by the shop catalog sync (modules/shop), so both
// features share one client with the same timeout / rate-limit backoff.
module.exports = { isConfigured, findOrderByName, fetchOrderById, listOrdersSince, getConfig, graphql, ShopifyApiError };
