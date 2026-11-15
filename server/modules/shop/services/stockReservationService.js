// Stock reservation (M3): while Amish is on the payment page, the units he is
// buying are held, so Riya can't pay for the same last unit.
//
//   available to a new checkout = Shopify stock (our copy) - active holds of others
//
// Atomicity without counters or transactions — "insert, then count":
//   1. upsert this order's hold
//   2. sum all active holds for the variant
//   3. over stock -> remove this order's holds and refuse
// Two racers for the last unit can BOTH back off (each sees the other's hold),
// but they can never both get it. A backed-off user just retries.
//
// Lifetime of a hold:
//   checkout start      now + SHOP_RESERVATION_MINUTES (15)
//   token issued        Fastrr token expiry + 5 min (can't pay after that)
//   payment confirmed   now + 24 h  (Shopify stock not reduced yet)
//   Shopify order made  now + 2 min (until Shopify's inventory webhook updates our copy)
//   order cancelled     released

const StockReservation = require('../models/StockReservation');
const Product = require('../models/Product');
const { ShopError } = require('../lib/shopError');
const { availableQty } = require('../lib/catalogMapper');
const { indexVariants } = require('../lib/cartEvaluator');

const activeHeld = async (variantId, now) => {
    const holds = await StockReservation.find({ variantId, expiresAt: { $gt: now } }).select('quantity').lean();
    return holds.reduce((n, h) => n + h.quantity, 0);
};

const release = (orderId) => StockReservation.deleteMany({ order: orderId });

/**
 * Hold stock for every line of the order until `until`. Throws 409
 * STOCK_UNAVAILABLE (and holds nothing) if any line can't be held.
 */
const reserve = async (order, until) => {
    const ids = order.items.map((i) => i.variantId);
    const products = await Product.find({ 'variants.shopifyVariantId': { $in: ids } }).lean();
    const index = indexVariants(products);
    const now = new Date();

    for (const item of order.items) {
        const hit = index.get(item.variantId);
        const stock = hit ? availableQty(hit.product, hit.variant) : 0;
        if (stock === Infinity) continue; // untracked / oversell allowed: nothing to hold

        await StockReservation.updateOne(
            { order: order._id, variantId: item.variantId },
            { $set: { quantity: item.quantity, expiresAt: until } },
            { upsert: true }
        );
        const held = await activeHeld(item.variantId, now);
        if (held > stock) {
            await release(order._id);
            const left = Math.max(0, stock - (held - item.quantity));
            throw new ShopError(409, 'STOCK_UNAVAILABLE',
                left > 0 ? `Only ${left} available right now` : 'This item is being bought by someone else right now. Please try again in a few minutes.',
                { variantId: item.variantId, availableQty: left });
        }
    }
};

/** Move every hold of the order to a new expiry (no stock check). */
const extend = (orderId, until) => StockReservation.updateMany({ order: orderId }, { $set: { expiresAt: until } });

module.exports = { reserve, extend, release, _internal: { activeHeld } };
