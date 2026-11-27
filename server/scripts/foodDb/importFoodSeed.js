/**
 * Import data/foodDb/foods.seed.json into the `foods` collection (docs/FOOD_DB_FLOW.md section 15).
 *
 *   node scripts/foodDb/importFoodSeed.js            # dry run: validates and prints what it WOULD do
 *   node scripts/foodDb/importFoodSeed.js --apply    # writes
 *   node scripts/foodDb/importFoodSeed.js --apply --force   # also overwrite admin-reviewed foods
 *   node scripts/foodDb/importFoodSeed.js --file path/to/foods.seed.json
 *
 * Safe to re-run after rebuilding the seed:
 *  - Upserts by foodId. New foods are inserted, existing seed foods are updated.
 *  - Foods an admin has reviewed (status verified/rejected or reviewedAt set) are SKIPPED unless --force,
 *    so manual fixes are not lost.
 *  - `stats` (hitCount, lastMatchedAt) is never overwritten.
 *  - Never deletes anything. Seed foods in the DB that are no longer in the seed file are only listed.
 *  - Aborts if a seed foodId belongs to an AI-created or manually added food.
 *
 * Database: USE_STAGING_DB=true in .env -> staging, otherwise production. Printed first.
 */
const path = require('path');
const fs = require('fs');
const dns = require('dns');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Same as scripts/syncIndexes.js: some local resolvers refuse Atlas SRV lookups.
if (!process.env.RENDER && !process.env.VERCEL && !process.env.RAILWAY_ENVIRONMENT_ID && process.env.FORCE_PUBLIC_DNS !== 'false') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}
mongoose.set('autoIndex', false); // indexes are created explicitly below, only with --apply

const Food = require('../../models/Food');

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');
const fileArg = process.argv.indexOf('--file');
const SEED_FILE = fileArg > -1
  ? path.resolve(process.argv[fileArg + 1])
  : path.join(__dirname, '..', '..', 'data', 'foodDb', 'foods.seed.json');
const BATCH = 500;
const SEED_SOURCES = new Set(['anuvaad', 'ind_schema', 'merged']);

function isProtected(existing) {
  const dq = existing.dataQuality || {};
  return ['verified', 'rejected'].includes(dq.status) || Boolean(dq.reviewedAt);
}

async function main() {
  if (!fs.existsSync(SEED_FILE)) {
    throw new Error(`Seed file not found: ${SEED_FILE}\nRun first: node scripts/foodDb/buildFoodSeed.js`);
  }
  const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  console.log(`Seed file: ${path.relative(process.cwd(), SEED_FILE)} (${seed.length} foods)`);

  // 1. Validate every document against the schema before touching the DB.
  const invalid = [];
  const seenIds = new Set();
  for (const doc of seed) {
    if (seenIds.has(doc.foodId)) invalid.push(`${doc.foodId}: duplicate foodId in seed`);
    seenIds.add(doc.foodId);
    const err = new Food(doc).validateSync();
    if (err) invalid.push(`${doc.foodId} ${doc.name}: ${Object.values(err.errors).map((e) => e.message).join('; ')}`);
  }
  if (invalid.length) {
    console.error(`\n${invalid.length} invalid document(s), nothing written:`);
    invalid.slice(0, 30).forEach((m) => console.error(`  ${m}`));
    process.exit(1);
  }
  console.log('Schema validation: all documents valid');

  // 2. Connect (same switch as config/db.js and the other scripts).
  const useStaging = process.env.USE_STAGING_DB === 'true';
  const uri = useStaging ? process.env.MONGODB_URI_STAGING : process.env.MONGODB_URI;
  if (!uri) throw new Error('No Mongo URI resolved — check MONGODB_URI / MONGODB_URI_STAGING / USE_STAGING_DB in .env');
  await mongoose.connect(uri);
  const { host, name } = mongoose.connection;
  console.log(`\n>>> Connected to ${useStaging ? 'STAGING' : 'PRODUCTION'} database (${host}/${name})\n`);

  // 3. Plan.
  const existing = await Food.find({}, { foodId: 1, name: 1, source: 1, dataQuality: 1 }).lean();
  const byId = new Map(existing.map((d) => [d.foodId, d]));
  const plan = { insert: [], update: [], protectedSkip: [], conflicts: [] };
  for (const doc of seed) {
    const cur = byId.get(doc.foodId);
    if (!cur) plan.insert.push(doc);
    else if (!SEED_SOURCES.has(cur.source?.primary)) plan.conflicts.push(`${doc.foodId}: seed "${doc.name}" vs existing ${cur.source?.primary} food "${cur.name}"`);
    else if (isProtected(cur) && !FORCE) plan.protectedSkip.push(`${doc.foodId} ${cur.name} (${cur.dataQuality?.status})`);
    else plan.update.push(doc);
  }
  const orphans = existing.filter((d) => SEED_SOURCES.has(d.source?.primary) && !seenIds.has(d.foodId));

  console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'}${FORCE ? ' (--force)' : ''}`);
  console.log(`  insert:                ${plan.insert.length}`);
  console.log(`  update:                ${plan.update.length}`);
  console.log(`  skip (admin-reviewed): ${plan.protectedSkip.length}${plan.protectedSkip.length ? '  → use --force to overwrite' : ''}`);
  console.log(`  in DB, not in seed:    ${orphans.length}  (left untouched)`);
  plan.protectedSkip.slice(0, 10).forEach((m) => console.log(`     skip  ${m}`));
  orphans.slice(0, 10).forEach((d) => console.log(`     orphan ${d.foodId} ${d.name}`));

  if (plan.conflicts.length) {
    console.error(`\n${plan.conflicts.length} foodId conflict(s) with non-seed foods — aborting, nothing written:`);
    plan.conflicts.slice(0, 20).forEach((m) => console.error(`  ${m}`));
    process.exit(1);
  }
  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to write.');
    return;
  }

  // 4. Write. stats is only set on insert so hit counts survive re-imports.
  const ops = [...plan.insert, ...plan.update].map((doc) => {
    const { stats, ...fields } = doc;
    return {
      updateOne: {
        filter: { foodId: doc.foodId },
        update: { $set: fields, $setOnInsert: { stats: stats || { hitCount: 0, lastMatchedAt: null } } },
        upsert: true,
      },
    };
  });
  let upserted = 0;
  let modified = 0;
  for (let i = 0; i < ops.length; i += BATCH) {
    const res = await Food.bulkWrite(ops.slice(i, i + BATCH), { ordered: false });
    upserted += res.upsertedCount;
    modified += res.modifiedCount;
    process.stdout.write(`\r  written ${Math.min(i + BATCH, ops.length)}/${ops.length}`);
  }
  console.log(`\n  inserted ${upserted}, modified ${modified}`);

  // 5. Indexes for this collection only (unique foodId, text search, review queue…).
  console.log('Syncing indexes for `foods`…');
  const dropped = await Food.syncIndexes();
  if (dropped.length) console.log(`  dropped stale indexes: ${dropped.join(', ')}`);
  const idx = await Food.collection.indexes();
  console.log(`  indexes: ${idx.map((i) => i.name).join(', ')}`);

  const total = await Food.countDocuments();
  const active = await Food.countDocuments({ isActive: true });
  console.log(`\nDone. foods collection: ${total} documents (${active} active).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
