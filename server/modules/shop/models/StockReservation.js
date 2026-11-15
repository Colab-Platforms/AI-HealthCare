const mongoose = require('mongoose');

// Stock held for an order while its customer pays (and until Shopify's own
// stock reflects the sale). One doc per order line. A hold counts only while
// expiresAt is in the future; the TTL index just cleans up afterwards.
const stockReservationSchema = new mongoose.Schema({
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    variantId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });

stockReservationSchema.index({ order: 1, variantId: 1 }, { unique: true });
stockReservationSchema.index({ variantId: 1, expiresAt: 1 });
stockReservationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.ShopStockReservation
    || mongoose.model('ShopStockReservation', stockReservationSchema, 'shop_stock_reservations');
