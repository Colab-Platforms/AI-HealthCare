// Pure: turns a Fastrr "Order Details" result into what it means for our Order.
// No DB / network — unit-tested directly.
//
// Fastrr values (from their docs):
//   status          CREATED / INITIATED / FAILED / SUCCESS
//   payment_type    CASH_ON_DELIVERY / PREPAID
//   payment_status  Pending / Success / Failed
// Amounts are rupee floats (1586.6800000000003) — converted to paise here.

const { toPaise } = require('./money');

const upper = (v) => String(v ?? '').trim().toUpperCase();

/**
 * What payment state the Fastrr order is in.
 * @returns {{ outcome: 'paid'|'cod_pending'|'failed'|'pending', method: 'prepaid'|'cod'|null }}
 */
const interpretStatus = (details) => {
    const status = upper(details?.status);
    const type = upper(details?.payment_type);
    const payStatus = upper(details?.payment_status);
    const method = type === 'CASH_ON_DELIVERY' ? 'cod' : type === 'PREPAID' ? 'prepaid' : null;

    if (status === 'FAILED') return { outcome: 'failed', method };
    if (status !== 'SUCCESS') return { outcome: 'pending', method }; // CREATED / INITIATED / unknown

    if (method === 'cod') return { outcome: 'cod_pending', method };
    if (method === 'prepaid') {
        if (payStatus === 'SUCCESS') return { outcome: 'paid', method };
        if (payStatus === 'FAILED') return { outcome: 'failed', method };
        return { outcome: 'pending', method }; // order placed, payment still settling
    }
    // SUCCESS with an unknown payment type: don't guess.
    return { outcome: 'pending', method: null };
};

const str = (v) => (v === null || v === undefined || v === '' ? undefined : String(v));

const mapAddress = (a) => {
    if (!a || typeof a !== 'object') return undefined;
    return {
        firstName: str(a.first_name),
        lastName: str(a.last_name),
        phone: str(a.phone),
        email: str(a.email),
        line1: str(a.line1),
        line2: str(a.line2),
        landmark: str(a.landmark),
        city: str(a.city),
        state: str(a.state),
        pincode: str(a.pincode),
        country: str(a.country) || 'India',
    };
};

const paiseOrNull = (v) => toPaise(v);

const mapPricing = (d) => ({
    subtotal: paiseOrNull(d.subtotal_price),
    discount: paiseOrNull(d.total_discount) ?? 0,
    prepaidDiscount: paiseOrNull(d.prepaid_discount) ?? 0,
    shipping: paiseOrNull(d.shipping_charges) ?? 0,
    codCharges: paiseOrNull(d.cod_charges) ?? 0,
    total: paiseOrNull(d.total_amount_payable),
    couponCodes: Array.isArray(d.coupon_codes) ? d.coupon_codes.map(String) : [],
});

const successfulPayment = (d) =>
    (Array.isArray(d.payments) ? d.payments : []).find((p) => upper(p?.payment_status) === 'SUCCESS') || null;

const mapPayment = (d) => {
    const p = successfulPayment(d);
    if (!p) return undefined;
    return {
        gateway: str(p.gateway),
        method: str(p.payment_method),
        txnId: str(p.txn_id),
        pgTransactionId: str(p.pg_transaction_id),
        amountReceived: paiseOrNull(p.amount_received ?? p.amount),
    };
};

/**
 * Sanity checks: is this Fastrr order really the cart we created it for?
 * Returns a list of reason codes ([] = all good).
 */
const verifyAgainstOrder = (order, details, outcome) => {
    const reasons = [];

    const subtotal = toPaise(details.subtotal_price);
    if (subtotal === null) reasons.push('SUBTOTAL_MISSING');
    else if (subtotal !== order.amount) reasons.push(`SUBTOTAL_MISMATCH:${subtotal}!=${order.amount}`);

    const theirs = new Map();
    for (const it of details.cart_data?.items || []) {
        const id = String(it.variant_id);
        theirs.set(id, (theirs.get(id) || 0) + Number(it.quantity || 0));
    }
    const ours = new Map((order.items || []).map((i) => [String(i.variantId), i.quantity]));
    const sameItems = theirs.size === ours.size && [...ours].every(([id, q]) => theirs.get(id) === q);
    if (!sameItems) reasons.push('ITEMS_MISMATCH');

    if (outcome === 'paid') {
        const total = toPaise(details.total_amount_payable);
        const received = toPaise(successfulPayment(details)?.amount_received ?? successfulPayment(details)?.amount);
        if (received === null) reasons.push('PAYMENT_AMOUNT_MISSING');
        else if (total === null || Math.abs(received - total) > 1) reasons.push(`PAYMENT_AMOUNT_MISMATCH:${received}!=${total}`);
    }
    return reasons;
};

/**
 * Fields to $set on our Order when the Fastrr order is confirmed (paid / COD).
 */
const confirmedOrderFields = (details, method, now = new Date()) => {
    const set = {
        paymentMethod: method,
        paidFastrrOrderId: String(details.order_id),
        placedAt: now,
        customer: { phone: str(details.phone), email: str(details.email) },
        shippingAddress: mapAddress(details.shipping_address),
        billingAddress: mapAddress(details.billing_address),
        pricing: mapPricing(details),
        rtoPrediction: str(details.rto_prediction),
        edd: str(details.edd),
        fastrrNumericOrderId: str(details.fastrr_order_id),
        fastrrCartId: str(details.cart_id),
    };
    const payment = mapPayment(details);
    if (payment) {
        set.payment = payment;
        // Fastrr's pg_transaction_id for Razorpay can be the Razorpay ORDER id
        // ("order_…", as in their docs) or a payment id ("pay_…"). Store it in
        // the matching field so support never looks it up in the wrong place.
        if (upper(payment.gateway) === 'RAZORPAY' && payment.pgTransactionId) {
            if (payment.pgTransactionId.startsWith('order_')) set.razorpayOrderId = payment.pgTransactionId;
            else set.razorpayPaymentId = payment.pgTransactionId;
        }
    }
    // Drop undefined so a sparse Fastrr payload never blanks a stored value.
    for (const k of Object.keys(set)) if (set[k] === undefined) delete set[k];
    return set;
};

module.exports = { interpretStatus, verifyAgainstOrder, confirmedOrderFields, mapAddress, mapPricing, mapPayment };
