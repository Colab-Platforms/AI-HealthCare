// Server-side cart. Every write is ONE atomic Mongo update with its guard in the
// filter (quantity cap, line limit, item exists / not exists), so two devices
// editing the same cart at once can never push it past a limit or lose a write.
// Stock is checked here for a good UX, but it's advisory — checkout re-checks
// live before any money moves.

const Cart = require('../models/Cart');
const Product = require('../models/Product');
const config = require('../config');
const { ShopError } = require('../lib/shopError');
const { availableQty } = require('../lib/catalogMapper');
const { evaluateCart, indexVariants } = require('../lib/cartEvaluator');

const findVariant = async (variantId) => {
    const product = await Product.findOne({ 'variants.shopifyVariantId': variantId }).lean();
    const variant = product?.variants.find((v) => v.shopifyVariantId === variantId);
    if (!product || !variant || product.status !== 'active') {
        throw new ShopError(404, 'PRODUCT_UNAVAILABLE', 'This product is not available');
    }
    return { product, variant };
};

const assertQuantity = (qty, { allowZero = false } = {}) => {
    const max = config.maxQtyPerItem();
    if (!Number.isInteger(qty) || qty < (allowZero ? 0 : 1) || qty > max) {
        throw new ShopError(400, 'INVALID_QUANTITY', `Quantity must be between ${allowZero ? 0 : 1} and ${max}`, { maxQty: max });
    }
};

const assertStock = (product, variant, wantedQty) => {
    const stock = availableQty(product, variant);
    if (stock <= 0) throw new ShopError(409, 'OUT_OF_STOCK', 'This product is out of stock');
    if (wantedQty > stock) {
        throw new ShopError(409, 'INSUFFICIENT_STOCK', `Only ${stock} left in stock`, { availableQty: stock });
    }
};

// ── Read ───────────────────────────────────────────────────────────────────

const getCart = async (userId) => {
    const cart = await Cart.findOne({ user: userId }).lean();
    const items = cart?.items || [];
    if (!items.length) return evaluateCart([], new Map());

    const products = await Product.find({ 'variants.shopifyVariantId': { $in: items.map((i) => i.variantId) } }).lean();
    const result = evaluateCart(items, indexVariants(products));

    // A price change is reported once: after this read, the user has seen the
    // new price, so it becomes the line's reference price.
    const changed = result.lines.filter((l) => l.priceChanged);
    if (changed.length) {
        await Cart.bulkWrite(changed.map((l) => ({
            updateOne: {
                filter: { user: userId, 'items.variantId': l.variantId },
                update: { $set: { 'items.$.addedPrice': l.unitPrice.paise } },
            },
        })));
    }
    return result;
};

// ── Writes ─────────────────────────────────────────────────────────────────

const addItem = async (userId, { variantId, quantity = 1 }) => {
    const qty = Number(quantity);
    assertQuantity(qty);
    const id = String(variantId || '');
    if (!id) throw new ShopError(400, 'VARIANT_REQUIRED', 'variantId is required');

    const { product, variant } = await findVariant(id);
    const max = config.maxQtyPerItem();
    const maxLines = config.maxCartLines();

    const cart = await Cart.findOne({ user: userId }).select('items').lean();
    const existing = cart?.items.find((i) => i.variantId === id);
    const newQty = (existing?.quantity || 0) + qty;
    if (newQty > max) throw new ShopError(409, 'MAX_QTY_REACHED', `You can add up to ${max} of this item`, { maxQty: max });
    assertStock(product, variant, newQty);

    // 1) Already in the cart: increment, guarded so a concurrent add can't pass the cap.
    const inc = await Cart.updateOne(
        { user: userId, items: { $elemMatch: { variantId: id, quantity: { $lte: max - qty } } } },
        { $inc: { 'items.$.quantity': qty }, $set: { 'items.$.addedPrice': variant.price } }
    );
    if (inc.matchedCount) return getCart(userId);

    // 2) Not in the cart: push a new line, guarded on "not already there" and the line limit.
    //    Upsert creates the cart on the first add. A duplicate-key error means the
    //    filter missed an existing cart — either it was created by a concurrent
    //    first add (retry once: the filter will match now) or the item is already
    //    there / the cart is full (worked out below).
    const line = { variantId: id, productId: product.shopifyProductId, quantity: qty, addedPrice: variant.price };
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const push = await Cart.updateOne(
                { user: userId, 'items.variantId': { $ne: id }, [`items.${maxLines - 1}`]: { $exists: false } },
                { $push: { items: line } },
                { upsert: true }
            );
            if (push.matchedCount || push.upsertedCount) return getCart(userId);
        } catch (err) {
            if (err.code !== 11000) throw err;
        }
    }

    const now = await Cart.findOne({ user: userId }).select('items').lean();
    if ((now?.items.length || 0) >= maxLines && !now.items.some((i) => i.variantId === id)) {
        throw new ShopError(409, 'CART_FULL', `Your cart can hold up to ${maxLines} different items`, { maxLines });
    }
    throw new ShopError(409, 'MAX_QTY_REACHED', `You can add up to ${max} of this item`, { maxQty: max });
};

const setQuantity = async (userId, variantId, quantity) => {
    const qty = Number(quantity);
    assertQuantity(qty, { allowZero: true });
    const id = String(variantId);
    if (qty === 0) return removeItem(userId, id);

    const { product, variant } = await findVariant(id);
    assertStock(product, variant, qty);

    const res = await Cart.updateOne(
        { user: userId, 'items.variantId': id },
        { $set: { 'items.$.quantity': qty, 'items.$.addedPrice': variant.price } }
    );
    if (!res.matchedCount) throw new ShopError(404, 'ITEM_NOT_IN_CART', 'This item is not in your cart');
    return getCart(userId);
};

// Removing works even if the product was deleted from the catalog.
const removeItem = async (userId, variantId) => {
    await Cart.updateOne({ user: userId }, { $pull: { items: { variantId: String(variantId) } } });
    return getCart(userId);
};

const clearCart = async (userId) => {
    await Cart.updateOne({ user: userId }, { $set: { items: [] } });
    return getCart(userId);
};

module.exports = { getCart, addItem, setQuantity, removeItem, clearCart };
