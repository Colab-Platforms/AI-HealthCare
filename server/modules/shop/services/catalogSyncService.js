// Keeps our local catalog (shop_products / shop_collections) in step with the
// Take Limited Shopify store.
//
//   1. Full sync     — one-time import + daily safety net (QStash cron). Catches
//                      anything a missed webhook left stale.
//   2. Webhooks      — near-real-time updates. We never trust the webhook body:
//                      we re-fetch the product from the Admin API ("fetch-back").
//                      One mapper for every path, and the data is always current
//                      even if webhooks arrive out of order.
//   3. Stale guard   — an upsert only applies if Shopify's updatedAt is not older
//                      than what we already store, so a slow, older fetch can't
//                      overwrite a newer one.

const Product = require('../models/Product');
const Collection = require('../models/Collection');
const client = require('./shopifyCatalogClient');
const { mapShopifyProduct, mapShopifyCollection } = require('../lib/catalogMapper');
const { isConfigured } = require('../../../services/shopifyAdminService');

// Conditional upsert: matches only if our copy is not newer. If our copy IS
// newer, the filter misses, the upsert tries to insert, and the unique index on
// the Shopify id throws 11000 — which here means "stale, skip".
const upsertIfNotStale = async (Model, idField, doc) => {
    const filter = {
        [idField]: doc[idField],
        $or: [
            { shopifyUpdatedAt: { $lte: doc.shopifyUpdatedAt } },
            { shopifyUpdatedAt: null },
            { shopifyUpdatedAt: { $exists: false } },
        ],
    };
    try {
        await Model.updateOne(filter, { $set: { ...doc, lastSyncedAt: new Date() } }, { upsert: true });
        return 'written';
    } catch (err) {
        if (err.code === 11000) return 'stale';
        throw err;
    }
};

const upsertProductNode = (node) => upsertIfNotStale(Product, 'shopifyProductId', mapShopifyProduct(node));
const upsertCollectionNode = (node) => upsertIfNotStale(Collection, 'shopifyCollectionId', mapShopifyCollection(node));

const markProductDeleted = (productId) =>
    Product.updateOne({ shopifyProductId: String(productId) }, { $set: { status: 'deleted', lastSyncedAt: new Date() } });

const markCollectionDeleted = async (collectionId) => {
    const id = String(collectionId);
    await Collection.updateOne({ shopifyCollectionId: id }, { $set: { status: 'deleted', lastSyncedAt: new Date() } });
    await Product.updateMany({ 'collections.shopifyCollectionId': id }, { $pull: { collections: { shopifyCollectionId: id } } });
};

// ── Single-item refresh (webhooks) ─────────────────────────────────────────

const refreshProduct = async (productId) => {
    const node = await client.fetchProduct(productId);
    if (!node) {
        await markProductDeleted(productId);
        return 'deleted';
    }
    return upsertProductNode(node);
};

const refreshCollection = async (collectionId) => {
    const node = await client.fetchCollection(collectionId);
    if (!node) {
        await markCollectionDeleted(collectionId);
        return 'deleted';
    }
    await upsertCollectionNode(node);

    // Product webhooks don't fire when a product is added to / removed from a
    // collection, so re-derive membership from the collection itself.
    const productIds = await client.fetchCollectionProductIds(collectionId);
    if (productIds) {
        const id = String(collectionId);
        const entry = { shopifyCollectionId: id, handle: node.handle, title: node.title };
        await Product.updateMany(
            { 'collections.shopifyCollectionId': id, shopifyProductId: { $nin: productIds } },
            { $pull: { collections: { shopifyCollectionId: id } } }
        );
        // pull-then-push keeps one entry per collection and refreshes its title/handle
        await Product.updateMany({ shopifyProductId: { $in: productIds } }, { $pull: { collections: { shopifyCollectionId: id } } });
        await Product.updateMany({ shopifyProductId: { $in: productIds } }, { $push: { collections: entry } });
    }
    return 'written';
};

// ── Webhooks ───────────────────────────────────────────────────────────────

const CATALOG_TOPICS = new Set([
    'products/create',
    'products/update',
    'products/delete',
    'inventory_levels/update',
    'collections/create',
    'collections/update',
    'collections/delete',
]);

const isCatalogTopic = (topic) => CATALOG_TOPICS.has(topic);

/**
 * Handle one verified Shopify catalog webhook. Idempotent (a fetch-back is safe
 * to repeat), so no ProcessedWebhook record is needed. Throws on a transient
 * failure so the route answers 500 and Shopify retries.
 */
const handleWebhook = async ({ topic, body }) => {
    switch (topic) {
        case 'products/create':
        case 'products/update':
            return { topic, id: body?.id, result: await refreshProduct(body.id) };
        case 'products/delete':
            await markProductDeleted(body.id);
            return { topic, id: body?.id, result: 'deleted' };
        case 'inventory_levels/update': {
            // Payload has inventory_item_id + one location's level. Re-fetch the
            // product to get the correct total across all locations.
            const itemId = String(body?.inventory_item_id || '');
            const product = itemId
                ? await Product.findOne({ 'variants.inventoryItemId': itemId }).select('shopifyProductId').lean()
                : null;
            if (!product) return { topic, ignored: 'unknown inventory item' };
            return { topic, id: product.shopifyProductId, result: await refreshProduct(product.shopifyProductId) };
        }
        case 'collections/create':
        case 'collections/update':
            return { topic, id: body?.id, result: await refreshCollection(body.id) };
        case 'collections/delete':
            await markCollectionDeleted(body.id);
            return { topic, id: body?.id, result: 'deleted' };
        default:
            return { topic, ignored: 'not a catalog topic' };
    }
};

// ── Full sync ──────────────────────────────────────────────────────────────

/**
 * Pull every collection and product from Shopify. Anything we hold that Shopify
 * no longer returns is marked deleted — but only after a complete, error-free
 * pass, so a failed sync can never wipe the catalog.
 */
const fullSync = async ({ log = console.log } = {}) => {
    if (!isConfigured()) throw new Error('Shopify Admin API not configured (SHOPIFY_ADMIN_STORE_DOMAIN / SHOPIFY_ADMIN_TOKEN)');
    const startedAt = Date.now();
    const stats = { collections: 0, products: 0, stale: 0, productsDeleted: 0, collectionsDeleted: 0 };

    const seenCollections = [];
    let after = null;
    do {
        const page = await client.fetchCollectionsPage(after);
        for (const node of page.nodes) {
            await upsertCollectionNode(node);
            seenCollections.push(String(node.legacyResourceId));
            stats.collections += 1;
        }
        after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (after);

    const seenProducts = [];
    after = null;
    do {
        const page = await client.fetchProductsPage(after);
        for (const node of page.nodes) {
            const r = await upsertProductNode(node);
            if (r === 'stale') stats.stale += 1;
            seenProducts.push(String(node.legacyResourceId));
            stats.products += 1;
        }
        after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
        log(`[ShopCatalog] synced ${stats.products} products…`);
    } while (after);

    const now = new Date();
    stats.productsDeleted = (await Product.updateMany(
        { shopifyProductId: { $nin: seenProducts }, status: { $ne: 'deleted' } },
        { $set: { status: 'deleted', lastSyncedAt: now } }
    )).modifiedCount;
    stats.collectionsDeleted = (await Collection.updateMany(
        { shopifyCollectionId: { $nin: seenCollections }, status: { $ne: 'deleted' } },
        { $set: { status: 'deleted', lastSyncedAt: now } }
    )).modifiedCount;

    stats.ms = Date.now() - startedAt;
    log(`[ShopCatalog] full sync done: ${JSON.stringify(stats)}`);
    return stats;
};

module.exports = { fullSync, handleWebhook, isCatalogTopic, refreshProduct, refreshCollection };
