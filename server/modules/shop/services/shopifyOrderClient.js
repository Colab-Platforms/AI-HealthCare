// Shopify Admin GraphQL calls for shop orders (M3). Reuses
// services/shopifyAdminService.graphql (timeout + 429/THROTTLED backoff).
// Needs write_orders (create) and read_orders (search / fetch).

const { graphql, ShopifyApiError } = require('../../../services/shopifyAdminService');

const ORDER_FIELDS = `
  id
  legacyResourceId
  name
  tags
  test
  cancelledAt
  displayFinancialStatus
  displayFulfillmentStatus
  fulfillments(first: 20) {
    createdAt
    displayStatus
    deliveredAt
    trackingInfo(first: 1) { company number url }
  }
`;

const toGid = (id) => (String(id).startsWith('gid://') ? String(id) : `gid://shopify/Order/${id}`);

/**
 * Our order already in Shopify? (Idempotency: every app order carries its
 * TH-... id as a tag.) Search is fuzzy, so the tag is checked exactly.
 */
const findOrderByTag = async (tag) => {
    const data = await graphql(
        `query ($q: String!) { orders(first: 5, query: $q) { nodes { ${ORDER_FIELDS} } } }`,
        { q: `tag:'${tag}'` }
    );
    return (data.orders?.nodes || []).find((n) => (n.tags || []).includes(tag)) || null;
};

const fetchOrder = async (shopifyOrderId) => {
    const data = await graphql(`query ($id: ID!) { order(id: $id) { ${ORDER_FIELDS} } }`, { id: toGid(shopifyOrderId) });
    return data.order || null;
};

/**
 * @returns {Promise<{ order: object|null, userErrors: Array<{ field, message, code }> }>}
 */
const createOrder = async ({ order, options }) => {
    const data = await graphql(
        `mutation ($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
           orderCreate(order: $order, options: $options) {
             order { ${ORDER_FIELDS} }
             userErrors { field message code }
           }
         }`,
        { order, options }
    );
    return { order: data.orderCreate?.order || null, userErrors: data.orderCreate?.userErrors || [] };
};

/**
 * Worth retrying? Network errors, timeouts, 5xx and throttling yes. Bad token /
 * missing scope / bad request no — those need a human.
 */
const isTransient = (err) => {
    if (!(err instanceof ShopifyApiError)) return true; // network / timeout / rate-limit exhaustion
    if (err.status && err.status >= 500) return true;
    if (err.status && err.status !== 200) return err.status === 429; // 4xx: bad token / scope / request
    // HTTP 200 with GraphQL errors: invalid variables, missing scope, ... —
    // permanent, except Shopify's own throttling / internal errors.
    const codes = (err.errors || []).map((e) => e.extensions?.code);
    return codes.some((c) => c === 'THROTTLED' || c === 'INTERNAL_SERVER_ERROR');
};

module.exports = { findOrderByTag, fetchOrder, createOrder, isTransient, toGid };
