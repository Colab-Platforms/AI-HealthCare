const path = require('path');
const { Client } = require('@upstash/qstash');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// One-time setup: creates (or replaces) the QStash schedule that runs the shop
// catalog full sync every night at 03:30 IST — the safety net for any Shopify
// webhook that was missed. Run manually whenever the backend URL changes:
//   node scripts/registerShopCatalogSchedule.js https://<backend-host>
// Re-running with the same scheduleId updates the existing schedule.
async function main() {
  const baseUrl = (process.argv[2] || '').replace(/\/$/, '');
  if (!/^https:\/\//.test(baseUrl)) {
    console.error('Usage: node scripts/registerShopCatalogSchedule.js https://<backend-host>');
    process.exit(1);
  }
  if (!process.env.QSTASH_TOKEN) {
    console.error('QSTASH_TOKEN is not set in .env');
    process.exit(1);
  }

  const client = new Client({ token: process.env.QSTASH_TOKEN });
  const destination = `${baseUrl}/api/shop/internal/catalog-sync`;
  const { scheduleId } = await client.schedules.create({
    scheduleId: 'shop-catalog-daily-sync',
    destination,
    cron: 'CRON_TZ=Asia/Kolkata 30 3 * * *',
    retries: 3,
  });

  console.log(`Schedule ${scheduleId} -> ${destination} at 03:30 IST daily`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
