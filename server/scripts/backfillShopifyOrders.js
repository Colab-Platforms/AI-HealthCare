/**
 * Load Shopify orders placed before the webhooks existed into ShopifyPurchase,
 * so buyers who already got a card can still be matched at signup / redeem.
 *
 *     node scripts/backfillShopifyOrders.js --since=2026-10-01 --dry-run
 *     node scripts/backfillShopifyOrders.js --since=2026-10-01
 *
 * Shopify only returns the last 60 days of orders unless the token also has the
 * `read_all_orders` scope. Idempotent: re-running updates the same rows. It never
 * grants anything by itself — buyers get the offer when they sign up or redeem.
 *
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
  const sinceArg = process.argv.find((a) => a.startsWith('--since='));
  const since = sinceArg ? sinceArg.slice('--since='.length) : null;
  if (!since || !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
    console.error('Pass --since=YYYY-MM-DD (the date the first card went out)');
    process.exit(1);
  }
  const dryRun = process.argv.includes('--dry-run');
  if (!dryRun && !process.env.OFFER_MATCH_SECRET) {
    console.error('OFFER_MATCH_SECRET is not set — orders could not be matched to users later');
    process.exit(1);
  }

  const useStaging = process.env.USE_STAGING_DB === 'true';
  const mongoUri = useStaging ? process.env.MONGODB_URI_STAGING : process.env.MONGODB_URI;
  mongoose.set('autoIndex', false);
  mongoose.set('autoCreate', false);
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 30000, family: 4 });
  console.log(`Connected to ${mongoose.connection.host}/${mongoose.connection.name} [${useStaging ? 'STAGING' : 'PRODUCTION'}]`);
  console.log(dryRun ? 'MODE: DRY RUN (nothing is written)\n' : 'MODE: APPLY\n');

  const shopifyAdmin = require('../services/shopifyAdminService');
  const { upsertPurchase } = require('../services/shopifyOfferService');
  const { normalizeGraphqlOrder, evaluateEligibility } = require('../utils/shopifyOrder');

  let after = null;
  let total = 0;
  let eligible = 0;
  const reasons = {};
  do {
    const { nodes, pageInfo } = await shopifyAdmin.listOrdersSince(since, after);
    for (const node of nodes) {
      const order = normalizeGraphqlOrder(node);
      const verdict = evaluateEligibility(order);
      total += 1;
      if (verdict.eligible) eligible += 1;
      else reasons[verdict.reason] = (reasons[verdict.reason] || 0) + 1;
      if (!dryRun) await upsertPurchase(order, 'backfill');
    }
    console.log(`  ...${total} orders read`);
    after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (after);

  console.log(`\nOrders since ${since}: ${total}`);
  console.log(`Eligible for the offer: ${eligible}`);
  console.log('Not eligible:', JSON.stringify(reasons));
  await mongoose.disconnect();
  console.log('\nDone.');
})().catch(async (err) => {
  console.error('Backfill failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
