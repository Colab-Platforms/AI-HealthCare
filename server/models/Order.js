const mongoose = require('mongoose');

// Order — source of truth for take.health commerce orders.
// Schema follows docs/shopify-mern-integration-plan.md (Section 5 v2) and
// docs/fastrr-shiprocket-checkout-integration-plan.md (Section 6).
const orderSchema = new mongoose.Schema({
    internalOrderId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    idempotencyKey: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },

    items: [{
        variantId: { type: String, required: true },
        title: String,
        sku: String,
        quantity: { type: Number, required: true, min: 1 },
        priceSnapshot: { type: Number, required: true }, // integer paise
        hsnCode: String,
        gstRate: Number,
    }],

    amount: { type: Number, required: true }, // integer paise — total payable
    gstBreakup: {
        cgst: { type: Number, default: 0 },
        sgst: { type: Number, default: 0 },
        igst: { type: Number, default: 0 },
    },
    shippingAddress: {
        firstName: String,
        lastName: String,
        phone: String,
        line1: String,
        line2: String,
        city: String,
        state: String,
        pincode: String,
        country: { type: String, default: 'India' },
    },

    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refund_pending', 'refunded'],
        default: 'pending',
        index: true,
    },
    razorpayOrderId: String,
    razorpayPaymentId: String,

    // Fastrr-specific linking fields (checkoutSource lets us support
    // other checkout paths later without a schema change).
    checkoutSource: {
        type: String,
        enum: ['fastrr'],
        default: 'fastrr',
    },
    fastrrOrderId: { type: String, index: true },
    fastrrCartId: String,
    fastrrToken: String,
    fastrrTokenExpiresAt: Date,

    webhookEventsProcessed: [String], // event ids already applied — replay guard

    shopifySyncStatus: {
        type: String,
        enum: ['pending', 'synced', 'failed'],
        default: 'pending',
    },
    shopifyOrderId: String,

    fulfillmentStatus: {
        type: String,
        enum: ['unfulfilled', 'partial', 'fulfilled', 'cancelled'],
        default: 'unfulfilled',
    },

    invoiceNumber: String,

    statusHistory: [{
        status: String,
        changedAt: { type: Date, default: Date.now },
        source: String, // 'webhook' | 'reconciliation' | 'manual' | 'system'
        eventId: String,
    }],

    lastEventTimestamp: Date, // guards against out-of-order webhook application
}, { timestamps: true });

// Helper — append a status change and keep lastEventTimestamp in sync.
// Callers should still separately validate ordering before calling this
// (see fastrr-integration-reference-and-test-plan.md Edge Case #2/#3).
orderSchema.methods.recordStatusChange = function (status, source, eventId) {
    this.statusHistory.push({ status, source, eventId, changedAt: new Date() });
    this.lastEventTimestamp = new Date();
};

module.exports = mongoose.model('Order', orderSchema);
