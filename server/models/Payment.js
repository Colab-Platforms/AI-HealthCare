const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    plan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan',
        required: true,
    },
    razorpaySubscriptionId: { type: String }, // set only when the Subscriptions API is active on the account
    razorpayOrderId: { type: String }, // one-time-payment path (used while Subscriptions isn't activated)
    razorpayPaymentId: { type: String },
    razorpayEventId: { type: String }, // for webhook idempotency
    invoiceNumber: { type: String }, // set when status becomes 'paid'
    amount: { type: Number, required: true }, // in INR
    status: {
        type: String,
        enum: ['created', 'authenticated', 'paid', 'failed', 'refunded'],
        default: 'created',
    },
    failureReason: String,
}, { timestamps: true });

// Prevent double-processing the same webhook event
paymentSchema.index({ razorpayEventId: 1 }, { unique: true, sparse: true });
paymentSchema.index({ invoiceNumber: 1 }, { unique: true, sparse: true });
paymentSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
