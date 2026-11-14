// Pure: compares each cart line with the current catalog and flags anything the
// user must know about before checkout. No DB / network — unit-tested directly.
//
// Line issues (block checkout until the user fixes the cart):
//   UNAVAILABLE         product/variant deleted, drafted or archived
//   OUT_OF_STOCK        nothing left
//   INSUFFICIENT_STOCK  fewer left than the quantity in the cart
// Price change is NOT an issue — just a flag the app shows once.

const { availableQty } = require('./catalogMapper');
const { paiseToRupees } = require('./money');

const money = (paise) => ({ paise, rupees: paiseToRupees(paise) });

/**
 * @param {Array} items           cart items { variantId, productId, quantity, addedPrice }
 * @param {Map}   variantIndex    variantId -> { product, variant }
 */
const evaluateCart = (items, variantIndex) => {
    let subtotal = 0;
    let itemCount = 0;
    let hasIssues = false;

    const lines = (items || []).map((item) => {
        const hit = variantIndex.get(item.variantId);
        const product = hit?.product;
        const variant = hit?.variant;

        let issue = null;
        let stock = 0;
        if (!product || !variant || product.status !== 'active') {
            issue = 'UNAVAILABLE';
        } else {
            stock = availableQty(product, variant);
            if (stock <= 0) issue = 'OUT_OF_STOCK';
            else if (item.quantity > stock) issue = 'INSUFFICIENT_STOCK';
        }

        const unitPrice = variant ? variant.price : item.addedPrice;
        const priceChanged = Boolean(variant) && unitPrice !== item.addedPrice;
        const lineTotal = unitPrice * item.quantity;

        if (issue) hasIssues = true;
        else {
            subtotal += lineTotal;
            itemCount += item.quantity;
        }

        return {
            variantId: item.variantId,
            productId: item.productId,
            handle: product?.handle || null,
            title: product?.title || null,
            variantTitle: variant?.title || null,
            imageUrl: variant?.imageUrl || product?.images?.[0]?.url || null,
            quantity: item.quantity,
            unitPrice: money(unitPrice),
            lineTotal: money(lineTotal),
            priceChanged,
            previousPrice: priceChanged ? money(item.addedPrice) : null,
            availableQty: issue === 'UNAVAILABLE' ? 0 : (stock === Infinity ? null : stock), // null = no limit
            issue,
        };
    });

    return {
        lines,
        summary: {
            itemCount,
            subtotal: money(subtotal), // before shipping / discounts — Fastrr adds those at checkout
            hasIssues,
            checkoutAllowed: lines.length > 0 && !hasIssues,
        },
    };
};

// Builds the variantId -> { product, variant } index from Product docs.
const indexVariants = (products) => {
    const index = new Map();
    for (const product of products || []) {
        for (const variant of product.variants || []) {
            index.set(variant.shopifyVariantId, { product, variant });
        }
    }
    return index;
};

module.exports = { evaluateCart, indexVariants };
