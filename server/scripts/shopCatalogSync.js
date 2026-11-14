/**
 * Shop catalog: import / re-sync every product + collection from the Take Limited
 * Shopify store into our DB. Safe to re-run any time (upserts; never deletes on a
 * failed run).
 *
 *     node scripts/shopCatalogSync.js --preview   # Shopify only: print the first page as we'd store it, no DB
 *     node scripts/shopCatalogSync.js             # full sync into the DB
 *
 * First run also creates the shop collections' indexes and migrates the Order
 * indexes (idempotency key becomes unique per user, not globally).
 *
 * Needs SHOPIFY_ADMIN_STORE_DOMAIN + SHOPIFY_ADMIN_TOKEN (read_products, read_inventory).
 * Target DB: USE_STAGING_DB=true -> MONGODB_URI_STAGING, otherwise MONGODB_URI.
 * The connected DB and STAGING/PRODUCTION label are printed first — check them.
 */
const path = require('path');
const dotenv = require('dotenv');
const dns = require('dns');
const mongoose = require('mongoose');

dotenv.config();
dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.RENDER && !process.env.VERCEL && !process.env.RAILWAY_ENVIRONMENT_ID && process.env.FORCE_PUBLIC_DNS !== 'false') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

(async () => {
  const preview = process.argv.includes('--preview');
  const { getConfig, isConfigured } = require('../services/shopifyAdminService');
  if (!isConfigured()) {
    console.error('SHOPIFY_ADMIN_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN must be set');
    process.exit(1);
  }
  console.log(`Store: ${getConfig().domain}  API ${getConfig().version}`);

  if (preview) {
    const client = require('../modules/shop/services/shopifyCatalogClient');
    const { mapShopifyProduct } = require('../modules/shop/lib/catalogMapper');
    const page = await client.fetchProductsPage();
    console.log(`First page: ${page.nodes.length} products (more: ${page.pageInfo.hasNextPage})\n`);
    for (const node of page.nodes.slice(0, 3)) console.log(JSON.stringify(mapShopifyProduct(node), null, 2), '\n');
    const collections = await client.fetchCollectionsPage();
    console.log(`Collections on first page: ${collections.nodes.map((c) => c.title).join(', ') || '(none)'}`);
    return;
  }

  const useStaging = process.env.USE_STAGING_DB === 'true';
  const mongoUri = useStaging ? process.env.MONGODB_URI_STAGING : process.env.MONGODB_URI;
  mongoose.set('autoIndex', false);
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 30000, family: 4 });
  console.log(`Connected to ${mongoose.connection.host}/${mongoose.connection.name} [${useStaging ? 'STAGING' : 'PRODUCTION'}]\n`);

  // The stale-write guard relies on the unique Shopify-id indexes — create them first.
  const Product = require('../modules/shop/models/Product');
  const Collection = require('../modules/shop/models/Collection');
  const Cart = require('../modules/shop/models/Cart');
  const Order = require('../models/Order');
  await Promise.all([Product.createIndexes(), Collection.createIndexes(), Cart.createIndexes()]);
  // syncIndexes also drops the old global-unique idempotencyKey index.
  const dropped = await Order.syncIndexes();
  if (dropped.length) console.log(`Order: dropped old indexes ${dropped.join(', ')}`);
  console.log('Indexes ready.\n');

  const { fullSync } = require('../modules/shop/services/catalogSyncService');
  const stats = await fullSync();
  console.log('\nResult:', stats);
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error('Failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
