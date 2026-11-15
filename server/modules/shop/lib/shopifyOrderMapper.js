// Pure mapping between our Order and Shopify's Admin GraphQL order (M3).
// No DB / network — unit-tested directly.
//
//   toOrderCreateVariables(order)  our confirmed Order -> orderCreate { order, options }
//   readShopifyOrder(node)         fetched Shopify order -> what it means for our Order
//
// Shopify (verified against the store's schema, API 2026-10):
//   prepaid -> transactions: [{ kind: SALE, status: SUCCESS }]  (no financialStatus)
//   COD     -> financialStatus: PENDING                          (no transactions)
//   options.inventoryBehaviour: DECREMENT_IGNORING_POLICY — always reduce stock,
//   never reject an order the customer has already paid for.

const { stateCode } = require('./indiaStates');

const SHOP_TAG = 'take-app';
const CURRENCY = 'INR';

const money = (paise) => ({ shopMoney: { amount: (paise / 100).toFixed(2), currencyCode: CURRENCY } });

// Shopify validates phone numbers; an invalid one fails the whole order. Indian
// mobiles to E.164, anything else left out (it is still in the order note).
const e164 = (phone) => {
    const d = String(phone || '').replace(/\D/g, '');
    if (/^[6-9]\d{9}$/.test(d)) return `+91${d}`;
    if (/^91[6-9]\d{9}$/.test(d)) return `+${d}`;
    if (/^0[6-9]\d{9}$/.test(d)) return `+91${d.slice(1)}`;
    return null;
};

const toMailingAddress = (a) => {
    if (!a) return undefined;
    const out = {
        firstName: a.firstName || undefined,
        lastName: a.lastName || undefined,
        address1: a.line1 || undefined,
        address2: [a.line2, a.landmark].filter(Boolean).join(', ') || undefined,
        city: a.city || undefined,
        zip: a.pincode || undefined,
        countryCode: 'IN',
        provinceCode: stateCode(a.state) || undefined,
        phone: e164(a.phone) || undefined,
    };
    for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
    return out;
};

const tagFor = (order) => order.internalOrderId;

/**
 * @param {object} order   our Order (lean), confirmed (paid / cod_pending)
 * @param {object} opts    { test, sendReceipt }
 */
const toOrderCreateVariables = (order, { test = false, sendReceipt = false } = {}) => {
    const pricing = order.pricing || {};
    const isCod = order.paymentMethod === 'cod';
    const phone = e164(order.customer?.phone || order.shippingAddress?.phone);
    const email = order.customer?.email || order.shippingAddress?.email || undefined;

    const shippingLines = [];
    if (pricing.shipping > 0) shippingLines.push({ title: 'Shipping', code: 'SHIPPING', priceSet: money(pricing.shipping) });
    if (isCod && pricing.codCharges > 0) shippingLines.push({ title: 'COD charges', code: 'COD', priceSet: money(pricing.codCharges) });

    const input = {
        lineItems: order.items.map((i) => ({
            variantId: `gid://shopify/ProductVariant/${i.variantId}`,
            quantity: i.quantity,
            priceSet: money(i.priceSnapshot),
        })),
        email,
        phone: phone || undefined,
        shippingAddress: toMailingAddress(order.shippingAddress),
        billingAddress: toMailingAddress(order.billingAddress || order.shippingAddress),
        tags: [SHOP_TAG, tagFor(order), isCod ? 'COD' : 'Prepaid'],
        note: [
            `Take Health app order ${order.internalOrderId}`,
            order.paidFastrrOrderId ? `Fastrr ${order.paidFastrrOrderId}` : null,
            !phone && order.customer?.phone ? `Phone: ${order.customer.phone}` : null,
        ].filter(Boolean).join(' · '),
        customAttributes: [
            { key: 'internal_order_id', value: order.internalOrderId },
            ...(order.paidFastrrOrderId ? [{ key: 'fastrr_order_id', value: String(order.paidFastrrOrderId) }] : []),
            ...(order.rtoPrediction ? [{ key: 'rto_prediction', value: String(order.rtoPrediction) }] : []),
        ],
        sourceIdentifier: order.internalOrderId,
        taxesIncluded: true, // Indian retail prices are GST-inclusive
        test: Boolean(test),
    };
    if (shippingLines.length) input.shippingLines = shippingLines;
    if (pricing.discount > 0) {
        input.discountCode = {
            itemFixedDiscountCode: {
                code: (pricing.couponCodes || []).join('+') || 'TAKE-APP',
                amountSet: money(pricing.discount),
            },
        };
    }
    if (isCod) {
        input.financialStatus = 'PENDING';
    } else {
        input.transactions = [{
            kind: 'SALE',
            status: 'SUCCESS',
            gateway: order.payment?.gateway || 'Fastrr',
            authorizationCode: order.payment?.pgTransactionId || undefined,
            amountSet: money(order.payment?.amountReceived ?? pricing.total ?? order.amount),
            test: Boolean(test),
        }];
    }
    for (const k of Object.keys(input)) if (input[k] === undefined) delete input[k];

    return {
        order: input,
        options: {
            inventoryBehaviour: 'DECREMENT_IGNORING_POLICY',
            sendReceipt: Boolean(sendReceipt),
            sendFulfillmentReceipt: Boolean(sendReceipt),
        },
    };
};

// ── Shopify order -> our status ────────────────────────────────────────────

const legacyId = (gidOrId) => String(gidOrId || '').split('/').pop() || null;

/**
 * @param {object} node  { legacyResourceId, name, tags, cancelledAt, displayFinancialStatus,
 *                         displayFulfillmentStatus, fulfillments: [{ displayStatus, deliveredAt, trackingInfo[] }] }
 * @returns {{ fulfillment: string|null, cancelled: boolean, financialPaid: boolean,
 *            tracking: object|null, deliveredAt: Date|null }}
 */
const readShopifyOrder = (node) => {
    const fulfillments = (node?.fulfillments || []).filter((f) => f && f.displayStatus !== 'CANCELED');
    const allDelivered = fulfillments.length > 0 && fulfillments.every((f) => f.displayStatus === 'DELIVERED' || f.deliveredAt);

    let fulfillment = null;
    if (node?.displayFulfillmentStatus === 'FULFILLED') fulfillment = allDelivered ? 'delivered' : 'fulfilled';
    else if (node?.displayFulfillmentStatus === 'PARTIALLY_FULFILLED') fulfillment = 'partial';

    const latest = [...fulfillments].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
    const t = latest?.trackingInfo?.[0];
    const tracking = t && (t.number || t.url) ? { number: t.number || null, url: t.url || null, courier: t.company || null } : null;
    const deliveredAt = allDelivered
        ? new Date(Math.max(...fulfillments.map((f) => new Date(f.deliveredAt || 0).getTime()))) : null;

    return {
        fulfillment,
        cancelled: Boolean(node?.cancelledAt),
        financialPaid: node?.displayFinancialStatus === 'PAID',
        tracking,
        deliveredAt: deliveredAt && deliveredAt.getTime() > 0 ? deliveredAt : null,
    };
};

module.exports = { toOrderCreateVariables, readShopifyOrder, e164, tagFor, legacyId, SHOP_TAG };
