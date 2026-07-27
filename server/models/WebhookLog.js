const mongoose = require('mongoose');

// Tracks processed Razorpay webhook event ids so retried/duplicate deliveries are skipped.
const webhookLogSchema = new mongoose.Schema({
    provider: { type: String, default: 'razorpay' },
    eventId: { type: String, required: true },
    eventType: String,
}, { timestamps: true });

webhookLogSchema.index({ provider: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model('WebhookLog', webhookLogSchema);
