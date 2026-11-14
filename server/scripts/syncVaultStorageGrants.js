/**
 * Create the Medical Vault storage grants that should already exist, from
 * successful paid payments, and rebuild every user's stored limit from them.
 *
 * Use it once after deploying the grants feature (backfill for existing paid
 * users); the same logic also runs nightly as a safety net.
 *
 *     node scripts/syncVaultStorageGrants.js --dry-run   # shows what WOULD happen, writes nothing
 *     node scripts/syncVaultStorageGrants.js             # apply
 *     node scripts/syncVaultStorageGrants.js --user=<userId>
 *     node scripts/syncVaultStorageGrants.js --no-manual # skip paid users that have no Payment rows
 *
 * BEFORE RUNNING: check the numbers in config/vault.js (FREE_BASE_BYTES and
 * GRANT_BYTES_PER_PAYMENT, or the VAULT_FREE_BYTES / VAULT_GRANT_BYTES env
 * vars). They are printed below so you can confirm them.
 *
 * Safe to re-run: every grant has a unique key, so nothing is granted twice.
 * Target DB: USE_STAGING_DB=true -> MONGODB_URI_STAGING, else MONGODB_URI.
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

const mb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(0)} MB`;

(async () => {
  const useStaging = process.env.USE_STAGING_DB === 'true';
  const mongoUri = useStaging ? process.env.MONGODB_URI_STAGING : process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error(`${useStaging ? 'MONGODB_URI_STAGING' : 'MONGODB_URI'} is not set`);
    process.exit(1);
  }

  const dryRun = process.argv.includes('--dry-run');
  const includeManualPaidUsers = !process.argv.includes('--no-manual');
  const userArg = process.argv.find((a) => a.startsWith('--user='));
  const userId = userArg ? userArg.slice('--user='.length) : undefined;

  const { FREE_BASE_BYTES, GRANT_BYTES_PER_PAYMENT, GRANTING_PLAN_KEYS } = require('../config/vault');
  console.log(`Free base limit : ${mb(FREE_BASE_BYTES)}`);
  console.log(`Grant / payment : ${mb(GRANT_BYTES_PER_PAYMENT)}`);
  console.log(`Eligible plans  : ${GRANTING_PLAN_KEYS.join(', ')}`);

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 30000, family: 4 });
  console.log(`Connected to ${mongoose.connection.host}/${mongoose.connection.name} [${useStaging ? 'STAGING' : 'PRODUCTION'}]`);
  console.log(dryRun ? 'MODE: DRY RUN (nothing is written)\n' : 'MODE: APPLY\n');

  const { syncGrantsFromPayments } = require('../services/vaultStorageGrants');
  const stats = await syncGrantsFromPayments({ userId, dryRun, includeManualPaidUsers });
  console.log(JSON.stringify(stats, null, 2));

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
