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
    rtoPrediction: String, // Fastrr: low / medium / high

    checkoutSource: { type: String, enum: ['fastrr'], default: 'fastrr' },
    fastrrOrderId: { type: String, index: true },        // Fastrr `order_id` (= platform_order_id) — the id webhooks reference
    fastrrNumericOrderId: String,                        // Fastrr `fastrr_order_id` (their internal number)
    fastrrCartId: String,
    fastrrToken: String,
    fastrrTokenExpiresAt: Date,

    shopifySyncStatus: {
        type: String,
        enum: ['not_started', 'pending', 'synced', 'failed', 'needs_attention'],
        default: 'not_started',
    },
    shopifySyncAttempts: { type: Number, default: 0 },
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

    refunds: [{
        _id: false,
        amount: Number, // paise
        reason: String,
        fastrrRefundId: String,
        status: String,
        createdAt: { type: Date, default: Date.now },
    }],

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

module.exports = mongoose.model('Order', orderSchema);
