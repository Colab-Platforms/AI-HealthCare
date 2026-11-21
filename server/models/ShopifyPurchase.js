const mongoose = require('mongoose');

// One Shopify store order, kept only so a buyer can be recognised in the app and
// given free Take+ ("30 days per item bought"). Filled by the Shopify
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
    // Offer units this order counts for (items bought minus refunded) and the
    // days currently credited to the user from it (units x SHOPIFY_OFFER_DAYS).
    // A refund lowers both and takes exactly the difference back.
    units: Number,
    grantedDays: Number,
    grantedUntil: Date, // the user's offer end right after this order's days were added
    // The user's subscription just before the offer streak started (set only on
    // the order that started it, not on orders that added days) — what a revoke
    // restores once no offer days are left.
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

// Auto-match at signup (by email).
shopifyPurchaseSchema.index({ emailHashes: 1 });
shopifyPurchaseSchema.index({ phoneHashes: 1 });

// Lifecycle cron: offers waiting for a paid plan to end.
shopifyPurchaseSchema.index({ grantStatus: 1 }, { partialFilterExpression: { grantStatus: 'pending' } });

// A user's claimed orders (status screen, refund maths). NOT unique: every order
// can be claimed once (the conditional claim on redeemedBy: null), and one user
// may claim many orders. Prod had a unique index here — run
// scripts/migrateShopifyRedeemIndex.js once to replace it.
shopifyPurchaseSchema.index(
    { redeemedBy: 1 },
    { name: 'redeemedBy_multi', partialFilterExpression: { redeemedBy: { $type: 'objectId' } } }
);

module.exports = mongoose.model('ShopifyPurchase', shopifyPurchaseSchema);
