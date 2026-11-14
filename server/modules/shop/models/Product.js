const mongoose = require('mongoose');

// Local copy of a Shopify product (Take Limited store). Shopify is the master;
// this copy exists so the app and Fastrr's catalog pull are fast and don't
// depend on Shopify being up. Kept fresh by Shopify webhooks + a daily full sync.
// All money in integer paise.

const variantSchema = new mongoose.Schema({
    shopifyVariantId: { type: String, required: true }, // legacy numeric id as string (Fastrr wants it as a long)
    inventoryItemId: String,                             // links inventory_levels/update webhooks to this variant
    title: String,
    sku: String,
    price: { type: Number, required: true },             // paise
    compareAtPrice: { type: Number, default: null },     // paise, the "MRP" strike-through price
    inventoryQty: { type: Number, default: 0 },          // total across locations
    inventoryTracked: { type: Boolean, default: true },
    inventoryPolicy: { type: String, enum: ['deny', 'continue'], default: 'deny' }, // continue = oversell allowed
    options: [{ _id: false, name: String, value: String }],
    imageUrl: String,
    weightGrams: Number,
    taxable: { type: Boolean, default: true },
    shopifyCreatedAt: Date,
    shopifyUpdatedAt: Date,
}, { _id: false });

const productSchema = new mongoose.Schema({
    shopifyProductId: { type: String, required: true, unique: true },
    handle: { type: String, required: true, index: true },
    title: { type: String, required: true },
    descriptionHtml: String,
    vendor: String,
    productType: String,
    tags: [String],
    status: { type: String, enum: ['active', 'draft', 'archived', 'deleted'], default: 'active', index: true },
    images: [{ _id: false, url: String, alt: String }],
    collections: [{ _id: false, shopifyCollectionId: String, handle: String, title: String }],
    variants: [variantSchema],
    minPrice: Number, // paise — cheapest variant, for sorting / "from ₹X"
    shopifyCreatedAt: Date,
    shopifyUpdatedAt: Date, // guards against an older fetch overwriting a newer one
    lastSyncedAt: Date,
}, { timestamps: true });

productSchema.index({ 'variants.shopifyVariantId': 1 });
productSchema.index({ 'variants.inventoryItemId': 1 });
productSchema.index({ 'collections.shopifyCollectionId': 1, status: 1 });
productSchema.index({ status: 1, shopifyCreatedAt: -1, _id: -1 }); // app listing cursor

module.exports = mongoose.models.ShopProduct || mongoose.model('ShopProduct', productSchema, 'shop_products');
