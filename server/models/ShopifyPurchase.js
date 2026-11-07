const mongoose = require('mongoose');

// One Shopify store order, kept only so a buyer can be recognised in the app and
// given the extended trial ("buy a product, get 30 days"). Filled by the Shopify
// order webhooks, by the Redeem screen's Admin API fallback, and by the backfill
// script — all through services/shopifyOfferService.upsertPurchase.
//
// No raw email / phone is stored: only HMAC hashes (see utils/shopifyOrder.js),
// which are enough to answer "does this order belong to this user?" and nothing else.
const shopifyPurchaseSchema = new mongoose.Schema({
    shopifyOrderId: { type: String, required: true, unique: true },
    orderName: { type: String, required: true },   // "TAKE11005" (canonical, no '#')
    orderNumber: { type: Number },                  // 11005 — for digits-only input

    emailHashes: [{ type: String }],
    phoneHashes: [{ type: String }],
    skus: [{ type: String }],
    // productId = Shopify product ID (how offer products are recognised);
    // sku = SKU, or "TITLE:<name>" when the line has no SKU.
    lineItems: [{ _id: false, productId: String, sku: String, quantity: Number }],
    // Refunded units, line by line (from refunds/create). Lets a partial refund of
    // some other product keep the offer, while returning the offer product ends it.
    refundLines: [{ _id: false, refundId: String, productId: String, sku: String, quantity: Number }],
    processedRefundIds: [{ type: String }],

    financialStatus: String,        // paid | pending | partially_refunded | refunded ...
    cancelledAt: Date,
    isTest: { type: Boolean, default: false },
    orderCreatedAt: Date,
    // Shopify's updated_at. Writes only apply if they're at least this new, so a
    // late-arriving older webhook can't undo a newer state (e.g. un-cancel an order).
    orderUpdatedAt: Date,

    eligible: { type: Boolean, default: false },
    ineligibleReason: String,       // test_order | cancelled | refunded | not_paid | product_not_in_offer

    redeemedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    redeemedAt: Date,
    redeemedVia: { type: String, enum: ['signup', 'redeem', 'webhook'] },
    // 'applied' = trial already extended to grantedUntil.
    // 'pending' = user was on a live paid plan; the days are given by the
    //             subscription lifecycle cron once that plan ends.
    // 'revoked' = the offer product was returned/refunded or the order cancelled
    //             after redemption; the user is back to what they had before.
    //             redeemedBy stays set, so the same person can't claim again.
    grantStatus: { type: String, enum: ['applied', 'pending', 'revoked'] },
    pendingDays: Number,
    grantedUntil: Date,
    // The user's subscription just before the offer was applied — what a revoke restores.
    previousSubscription: {
        plan: String,
        status: String,
        startDate: Date,
        currentPeriodEnd: Date,
    },
    revokedAt: Date,
    revokeReason: String,

    firstSource: { type: String, enum: ['webhook', 'lookup', 'backfill'] },
}, { timestamps: true });

// Redeem screen: "TAKE11005" or "11005".
shopifyPurchaseSchema.index({ orderName: 1 }, { unique: true });
shopifyPurchaseSchema.index({ orderNumber: 1 });

// Auto-match at signup (by email), and the "one offer per person" check, which
// looks for any already-redeemed order sharing this email or phone. Not partial:
// that check must also see redeemed orders that were later refunded.
shopifyPurchaseSchema.index({ emailHashes: 1 });
shopifyPurchaseSchema.index({ phoneHashes: 1 });

// Lifecycle cron: offers waiting for a paid plan to end.
shopifyPurchaseSchema.index({ grantStatus: 1 }, { partialFilterExpression: { grantStatus: 'pending' } });

// One offer per user, ever. Partial so the many unredeemed (null) rows don't collide.
shopifyPurchaseSchema.index(
    { redeemedBy: 1 },
    { unique: true, partialFilterExpression: { redeemedBy: { $type: 'objectId' } } }
);

module.exports = mongoose.model('ShopifyPurchase', shopifyPurchaseSchema);
