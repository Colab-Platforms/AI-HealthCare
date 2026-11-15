const mongoose = require('mongoose');

// What shoppers do, for the admin "customer journey" and the funnel.
// Written after the response is sent (never slows the app). Personal data:
// kept for SHOP_EVENTS_RETENTION_DAYS (default 180) by a TTL index.
const TYPES = [
    'search', 'product_view',
    'cart_add', 'cart_update', 'cart_remove', 'cart_clear',
    'checkout_start', 'checkout_error', 'payment_page_open',
    'payment_success', 'payment_failed',
    'order_cancelled', 'order_shipped', 'order_delivered',
    'refund_requested', 'refund_completed',
];

const retentionDays = Math.max(1, parseInt(process.env.SHOP_EVENTS_RETENTION_DAYS, 10) || 180);

const shopEventSchema = new mongoose.Schema({
    type: { type: String, enum: TYPES, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = not logged in
    orderId: { type: String, default: null },    // TH-...
    productId: { type: String, default: null },
    variantId: { type: String, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }, // q, quantity, amount, code, ... (small)
    createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

shopEventSchema.index({ user: 1, createdAt: -1 });   // customer journey
shopEventSchema.index({ type: 1, createdAt: -1 });   // funnel / overview
shopEventSchema.index({ orderId: 1 }, { sparse: true });
shopEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: retentionDays * 24 * 60 * 60 });

module.exports = mongoose.models.ShopEvent || mongoose.model('ShopEvent', shopEventSchema, 'shop_events');
module.exports.TYPES = TYPES;
