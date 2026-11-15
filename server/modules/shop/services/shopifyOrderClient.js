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
 * Cancel the Shopify order (M4). Restocks the items; no customer email (the
 * app notifies); no refund here — the money goes back through Fastrr and is
 * recorded separately with recordRefund(). Shopify runs the cancel as a job.
 * @returns {Promise<{ userErrors: Array }>}
 */
const cancelOrder = async (shopifyOrderId, { reason = 'CUSTOMER', staffNote = '' } = {}) => {
    const data = await graphql(
        `mutation ($id: ID!, $reason: OrderCancelReason!, $note: String) {
           orderCancel(orderId: $id, restock: true, reason: $reason, notifyCustomer: false, staffNote: $note) {
             job { id done }
             orderCancelUserErrors { field message code }
           }
         }`,
        { id: toGid(shopifyOrderId), reason, note: staffNote }
    );
    return { userErrors: data.orderCancel?.orderCancelUserErrors || [] };
};

/** The order's successful SALE transaction (parent for a refund record). */
const fetchSaleTransaction = async (shopifyOrderId) => {
    const data = await graphql(
        `query ($id: ID!) { order(id: $id) { transactions(first: 20) { id kind status gateway amountSet { shopMoney { amount } } } } }`,
        { id: toGid(shopifyOrderId) }
    );
    return (data.order?.transactions || []).find((t) => t.kind === 'SALE' && t.status === 'SUCCESS') || null;
};

/**
 * Record a refund that already happened through Fastrr (bookkeeping: Shopify
 * shows the order as refunded; no money moves — the sale's gateway is external).
 * @returns {Promise<{ refundId: string|null, userErrors: Array, skipped?: string }>}
 */
const recordRefund = async ({ shopifyOrderId, amountPaise, note }) => {
    const sale = await fetchSaleTransaction(shopifyOrderId);
    if (!sale) return { refundId: null, userErrors: [], skipped: 'no sale transaction' };
    const data = await graphql(
        `mutation ($input: RefundInput!) { refundCreate(input: $input) { refund { id } userErrors { field message } } }`,
        {
            input: {
                orderId: toGid(shopifyOrderId),
                note,
                notify: false,
                transactions: [{
                    orderId: toGid(shopifyOrderId),
                    parentId: sale.id,
                    amount: (amountPaise / 100).toFixed(2),
                    gateway: sale.gateway,
                    kind: 'REFUND',
                }],
            },
        }
    );
    return { refundId: data.refundCreate?.refund?.id || null, userErrors: data.refundCreate?.userErrors || [] };
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

module.exports = { findOrderByTag, fetchOrder, createOrder, cancelOrder, fetchSaleTransaction, recordRefund, isTransient, toGid };
