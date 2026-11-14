const mongoose = require('mongoose');

// Local copy of a Shopify collection. Product membership lives on
// Product.collections; this holds the collection's own details for listing.
const collectionSchema = new mongoose.Schema({
    shopifyCollectionId: { type: String, required: true, unique: true },
    handle: { type: String, required: true, index: true },
    title: { type: String, required: true },
    descriptionHtml: String,
    imageUrl: String,
    status: { type: String, enum: ['active', 'deleted'], default: 'active', index: true },
    shopifyUpdatedAt: Date,
    lastSyncedAt: Date,
}, { timestamps: true });

module.exports = mongoose.models.ShopCollection || mongoose.model('ShopCollection', collectionSchema, 'shop_collections');
