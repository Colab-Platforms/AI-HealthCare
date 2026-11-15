const mongoose = require('mongoose');

// Order — source of truth for take.health shop orders (Flutter app -> Fastrr
// checkout -> Shopify fulfilment). Lives here (not in modules/shop) because
// privacyController's 8-year transaction-retention job also uses it.
//
// Three independent status fields, each moved only through
// modules/shop/lib/orderStateMachine.transition() — never set them directly.
// All money in integer paise.

const addressSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    phone: String,
    email: String,
    line1: String,
    line2: String,
    landmark: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' },
}, { _id: false });

const orderSchema = new mongoose.Schema({
    internalOrderId: { type: String, required: true, unique: true }, // TH-..., also tagged on the Shopify order
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // indexed via the compound indexes below

    // Same key + same user = same checkout attempt (double tap / retry).
    // cartHash detects the key being reused for a different cart.
    idempotencyKey: { type: String, required: true },
    cartHash: String,

    items: [{
        _id: false,
        variantId: { type: String, required: true },
        productId: String,
        title: String,
        variantTitle: String,
        imageUrl: String,
        sku: String,
        quantity: { type: Number, required: true, min: 1 },
        priceSnapshot: { type: Number, required: true }, // paise, our price at checkout start
        hsnCode: String,
        gstRate: Number,
    }],

    // Our server-computed subtotal at checkout start (paise). Fastrr's coupons,
    // prepaid discount, shipping and COD charges are added on top by Fastrr and
    // recorded in `pricing` when the order is confirmed.
    amount: { type: Number, required: true },
    pricing: {
        subtotal: Number,
        discount: Number,
        shipping: Number,
        codCharges: Number,
        prepaidDiscount: Number,
        total: Number, // what the customer pays (paid now, or on delivery for COD)
        couponCodes: [String],
    },
    gstBreakup: {
        cgst: { type: Number, default: 0 },
        sgst: { type: Number, default: 0 },
        igst: { type: Number, default: 0 },
    },

    customer: { phone: String, email: String },
    shippingAddress: addressSchema,
    billingAddress: addressSchema,

    paymentMethod: { type: String, enum: ['prepaid', 'cod', null], default: null },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'cod_pending', 'failed', 'expired', 'cancelled', 'refund_pending', 'partially_refunded', 'refunded'],
        default: 'pending',
    },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    // Successful payment as reported by Fastrr Order Details (prepaid only).
    payment: {
        gateway: String,
        method: String,          // UPI / CARD / ...
        txnId: String,
        pgTransactionId: String,
        amountReceived: Number,  // paise
    },
    placedAt: Date,              // when payment (or COD) was confirmed
    rtoPrediction: String, // Fastrr: low / medium / high
    edd: String,           // Fastrr expected delivery date (YYYY-MM-DD)

    // Set when a confirmed order fails a sanity check (amount / items differ
    // from what we sent, or a second payment for an already-paid order). Such
    // orders are NOT sent to Shopify automatically — a human looks first.
    review: {
        needed: { type: Boolean, default: false },
        reasons: [String],
        flaggedAt: Date,
        resolvedAt: Date,   // admin checked and accepted it
        resolvedBy: String,
        note: String,
    },

    checkoutSource: { type: String, enum: ['fastrr'], default: 'fastrr' },
    fastrrOrderId: { type: String, index: true },        // Fastrr `order_id` (= platform_order_id) — the id webhooks reference
    fastrrNumericOrderId: String,                        // Fastrr `fastrr_order_id` (their internal number)
    // Every Fastrr order id issued for this order (a new token = a new Fastrr
    // order). Webhooks / late payments for an older token are matched through it.
    fastrrOrderIds: { type: [String], index: true },
    paidFastrrOrderId: String,                           // the Fastrr order that actually confirmed
    fastrrCartId: String,
    fastrrToken: String,
    fastrrTokenExpiresAt: Date,
    tokenLeaseUntil: Date,   // one request at a time fetches a Fastrr token for this order
    fastrrCheckedAt: Date,   // last on-demand Fastrr status check (throttles app polling)

    shopifySyncStatus: {
        type: String,
        enum: ['not_started', 'pending', 'synced', 'failed', 'needs_attention'],
        default: 'not_started',
    },
    shopifySyncAttempts: { type: Number, default: 0 },
    shopifySyncLeaseUntil: Date, // one worker at a time creates the Shopify order
    // Pushes already sent for this order (shipped / delivered / cancelled) — each once.
    notified: [String],
    shopifySyncError: String,
    shopifyOrderId: String,
    shopifyOrderName: String,

    fulfillmentStatus: {
        type: String,
        enum: ['unfulfilled', 'partial', 'fulfilled', 'delivered', 'cancelled', 'rto'],
        default: 'unfulfilled',
    },
    tracking: { number: String, url: String, courier: String },
    deliveredAt: Date,

    // Every refund (M4). Moved only by modules/shop/services/refundService.
    //   requested -> initiating -> initiated -> processing -> completed
    //                            \-> failed (Fastrr said no; admin may retry)
    //                            \-> unknown (timeout: may have gone through; matched from Fastrr's report, never auto-retried)
    refunds: [{
        _id: false,
        refundId: { type: String, required: true },        // R-XXXXXXXXXX
        kind: { type: String, enum: ['order', 'duplicate_payment'], default: 'order' },
        source: { type: String, enum: ['user_cancel', 'admin_cancel', 'store_cancel', 'admin', 'duplicate_payment'] },
        amount: { type: Number, required: true },           // paise
        reason: String,
        method: { type: String, enum: ['fastrr', 'manual_upi', 'bank_transfer', 'store_credit', 'other'], default: 'fastrr' },
        status: { type: String, enum: ['requested', 'initiating', 'initiated', 'processing', 'completed', 'failed', 'unknown'], default: 'requested' },
        fastrrOrderId: String,     // which Fastrr payment is refunded (order_id / platform_order_id)
        fastrrRefundId: String,    // Fastrr refund ref_id
        fastrrTransactionId: String,
        reference: String,         // manual refunds: UPI / bank reference
        error: String,
        requestedBy: String,       // user id / admin id / "system"
        approvedBy: String,
        shopifyRecorded: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
        updatedAt: Date,
        initiatedAt: Date,
        completedAt: Date,
    }],
    refundVersion: { type: Number, default: 0 }, // optimistic lock: refunds can never exceed what was paid

    cancelledAt: Date,
    cancelledBy: { type: String, enum: ['user', 'admin', 'store', null], default: null },
    cancelReason: String,

    invoiceNumber: String,

    statusHistory: [{
        _id: false,
        field: String,  // paymentStatus | shopifySyncStatus | fulfillmentStatus
        status: String,
        changedAt: { type: Date, default: Date.now },
        source: String, // webhook | reconciliation | manual | system
        eventId: String,
    }],
}, { timestamps: true });

// Idempotency is per user: the same key from two users is two different checkouts.
orderSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true });
orderSchema.index({ user: 1, createdAt: -1 });                       // "My Orders"
orderSchema.index({ paymentStatus: 1, createdAt: 1 });               // stuck-pending reconciliation
orderSchema.index({ shopifySyncStatus: 1, updatedAt: 1 });           // Shopify sync retry
orderSchema.index({ 'refunds.status': 1 }, { sparse: true });        // open refunds (status sync cron)

module.exports = mongoose.model('Order', orderSchema);
