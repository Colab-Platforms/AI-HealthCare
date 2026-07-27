const mongoose = require('mongoose');

// Guards against duplicate webhook processing — Fastrr's own docs warn
// "webhooks may be sent more than once." See
// docs/fastrr-integration-reference-and-test-plan.md, Edge Case #2.
const processedWebhookSchema = new mongoose.Schema({
    source: {
        type: String,
        enum: ['fastrr', 'shopify', 'razorpay'],
        required: true,
    },
    eventId: {
        type: String,
        required: true,
    },
    payloadHash: String, // sha256 of the raw body — detects a same-id-different-payload replay
    receivedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// One event id can only be processed once per source.
processedWebhookSchema.index({ source: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model('ProcessedWebhook', processedWebhookSchema);
