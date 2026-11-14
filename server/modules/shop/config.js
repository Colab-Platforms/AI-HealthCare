// Shop configuration. Read lazily (functions, not constants) so tests and the
// two hosts (Vercel + Render) always see the current env.

// The shop sells from the retail "Take Limited" store, the same store the card
// offer reads — SHOPIFY_ADMIN_STORE_DOMAIN / SHOPIFY_ADMIN_TOKEN, via
// services/shopifyAdminService. NOT SHOPIFY_STORE_DOMAIN (old Fastrr test store).

const intEnv = (name, fallback) => {
    const n = parseInt(process.env[name], 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

module.exports = {
    // Cart guard rails — stop abuse / accidental huge quantities.
    maxQtyPerItem: () => intEnv('SHOP_MAX_QTY_PER_ITEM', 10),
    maxCartLines: () => intEnv('SHOP_MAX_CART_LINES', 30),

    // Catalog listing page size for the app.
    defaultPageSize: 20,
    maxPageSize: 50,

    // Fastrr's catalog API contract: page/limit, limit up to 100 in their examples.
    fastrrMaxLimit: 250,
};
