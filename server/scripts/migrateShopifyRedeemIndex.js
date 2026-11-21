/**
 * One-time: let one user claim many Shopify orders.
 *
 * The old `redeemedBy_1` index on shopifypurchases was UNIQUE (one offer per
 * user ever). The offer now gives 30 days per item on every order, so that
 * index has to go; the model's non-unique `redeemedBy_multi` replaces it.
 *
 *     node scripts/migrateShopifyRedeemIndex.js --dry-run
 *     node scripts/migrateShopifyRedeemIndex.js
 *
 * Also fills `units` / `grantedDays` on orders claimed before this change
 * (each was worth exactly SHOPIFY_OFFER_DAYS then), so refunds on them take
 * back the right number of days.
 *
 * Target DB: USE_STAGING_DB=true -> MONGODB_URI_STAGING, otherwise MONGODB_URI.
 * Idempotent: safe to run again.
 */
const path = require('path');
const dotenv = require('dotenv');
const dns = require('dns');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
if (!process.env.RENDER && !process.env.VERCEL && process.env.FORCE_PUBLIC_DNS !== 'false') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  const useStaging = process.env.USE_STAGING_DB === 'true';
  await mongoose.connect(useStaging ? process.env.MONGODB_URI_STAGING : process.env.MONGODB_URI, { family: 4, serverSelectionTimeoutMS: 30000 });
  console.log(`Connected to ${mongoose.connection.name} [${useStaging ? 'STAGING' : 'PRODUCTION'}] ${dryRun ? '(DRY RUN)' : ''}`);

  const col = mongoose.connection.db.collection('shopifypurchases');
  const indexes = await col.indexes();
  const old = indexes.find((i) => i.name === 'redeemedBy_1');
  if (old) {
    console.log(`old index redeemedBy_1 found (unique=${Boolean(old.unique)}) -> ${dryRun ? 'would drop' : 'dropping'}`);
    if (!dryRun) await col.dropIndex('redeemedBy_1');
  } else {
    console.log('old index redeemedBy_1 not present');
  }
  if (!indexes.some((i) => i.name === 'redeemedBy_multi')) {
    console.log(`${dryRun ? 'would create' : 'creating'} redeemedBy_multi (not unique)`);
    if (!dryRun) {
      await col.createIndex({ redeemedBy: 1 }, { name: 'redeemedBy_multi', partialFilterExpression: { redeemedBy: { $type: 'objectId' } } });
    }
  }

  const days = Number(process.env.SHOPIFY_OFFER_DAYS) || 30;
  const legacy = { redeemedBy: { $ne: null }, grantedDays: null };
  const n = await col.countDocuments(legacy);
  console.log(`claimed orders without units/grantedDays: ${n} -> ${dryRun ? 'would set' : 'setting'} units=1`);
  if (!dryRun && n) {
    await col.updateMany({ ...legacy, grantStatus: 'applied' }, { $set: { units: 1, grantedDays: days } });
    await col.updateMany({ ...legacy, grantStatus: 'pending' }, { $set: { units: 1, grantedDays: 0 } });
    await col.updateMany({ ...legacy, grantStatus: 'revoked' }, { $set: { units: 0, grantedDays: 0 } });
  }

  await mongoose.disconnect();
  console.log('Done.');
})().catch(async (err) => {
  console.error('Migration failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
