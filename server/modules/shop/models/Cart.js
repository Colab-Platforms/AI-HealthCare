const mongoose = require('mongoose');

// One server-side cart per user. Lives on the server (not only in the app) so it
// survives reinstall / device change and can drive abandoned-cart reminders.
// Every write is a single atomic update — two devices editing at once can't
// overwrite each other.
const cartItemSchema = new mongoose.Schema({
    variantId: { type: String, required: true },   // Shopify variant id
    productId: { type: String, required: true },   // Shopify product id
    quantity: { type: Number, required: true, min: 1 },
    addedPrice: { type: Number, required: true },  // paise — price the user last saw; used to flag price changes
    addedAt: { type: Date, default: Date.now },
}, { _id: false });

const cartSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [cartItemSchema],
}, { timestamps: true });

cartSchema.index({ updatedAt: 1 }); // abandoned-cart reminder scan

module.exports = mongoose.models.ShopCart || mongoose.model('ShopCart', cartSchema, 'shop_carts');
