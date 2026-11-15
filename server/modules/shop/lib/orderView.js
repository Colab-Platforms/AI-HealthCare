// Pure: Order document -> app response. One `status` the app can show as-is,
// derived from the three internal status fields, plus the raw fields for detail.

const { paiseToRupees } = require('./money');

const money = (paise) => (paise === null || paise === undefined ? null : { paise, rupees: paiseToRupees(paise) });

// Payment states in which the customer has actually placed the order.
const PLACED_PAYMENT_STATES = ['paid', 'cod_pending', 'refund_pending', 'partially_refunded', 'refunded', 'cancelled'];

/**
 * awaiting_payment | payment_failed | expired | confirmed | shipped | delivered
 * | returned | cancelled | refund_initiated | partially_refunded | refunded
 */
const displayStatus = (o) => {
    switch (o.paymentStatus) {
        case 'pending': return 'awaiting_payment';
        case 'failed': return 'payment_failed';
        case 'expired': return 'expired';
        case 'cancelled': return 'cancelled';
        case 'refund_pending': return 'refund_initiated';
        case 'partially_refunded': return 'partially_refunded';
        case 'refunded': return 'refunded';
        default: break; // paid / cod_pending -> look at fulfilment
    }
    switch (o.fulfillmentStatus) {
        case 'partial':
        case 'fulfilled': return 'shipped';
        case 'delivered': return 'delivered';
        case 'rto': return 'returned';
        case 'cancelled': return 'cancelled';
        default: return 'confirmed';
    }
};

const toAppItem = (i) => ({
    variantId: i.variantId,
    productId: i.productId || null,
    title: i.title || null,
    variantTitle: i.variantTitle || null,
    imageUrl: i.imageUrl || null,
    quantity: i.quantity,
    unitPrice: money(i.priceSnapshot),
    lineTotal: money(i.priceSnapshot * i.quantity),
});

const itemCount = (o) => (o.items || []).reduce((n, i) => n + i.quantity, 0);

// What the customer pays: Fastrr's final total once confirmed, our subtotal before.
const payable = (o) => o.pricing?.total ?? o.amount;

const toAppOrderSummary = (o) => ({
    orderId: o.internalOrderId,
    status: displayStatus(o),
    paymentMethod: o.paymentMethod || null,
    total: money(payable(o)),
    itemCount: itemCount(o),
    firstItem: o.items?.[0] ? { title: o.items[0].title || null, imageUrl: o.items[0].imageUrl || null } : null,
    createdAt: o.createdAt,
    placedAt: o.placedAt || null,
});

const appAddress = (a) => (a ? {
    name: [a.firstName, a.lastName].filter(Boolean).join(' ') || null,
    phone: a.phone || null,
    line1: a.line1 || null,
    line2: a.line2 || null,
    landmark: a.landmark || null,
    city: a.city || null,
    state: a.state || null,
    pincode: a.pincode || null,
    country: a.country || null,
} : null);

const toAppOrder = (o) => ({
    ...toAppOrderSummary(o),
    paymentStatus: o.paymentStatus,
    fulfillmentStatus: o.fulfillmentStatus,
    items: (o.items || []).map(toAppItem),
    pricing: {
        subtotal: money(o.pricing?.subtotal ?? o.amount),
        discount: money(o.pricing?.discount ?? 0),
        shipping: money(o.pricing?.shipping ?? 0),
        codCharges: money(o.pricing?.codCharges ?? 0),
        total: money(payable(o)),
        couponCodes: o.pricing?.couponCodes || [],
    },
    shippingAddress: appAddress(o.shippingAddress),
    tracking: o.tracking?.number ? { number: o.tracking.number, url: o.tracking.url || null, courier: o.tracking.courier || null } : null,
    expectedDelivery: o.edd || null,
    deliveredAt: o.deliveredAt || null,
});

module.exports = { displayStatus, toAppOrder, toAppOrderSummary, PLACED_PAYMENT_STATES, money };
