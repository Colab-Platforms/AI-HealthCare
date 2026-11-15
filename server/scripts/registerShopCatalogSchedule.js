const path = require('path');
const { Client } = require('@upstash/qstash');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// One-time setup: creates (or replaces) the shop's QStash schedules.
//   shop-catalog-daily-sync     03:30 IST daily — catalog full sync, the safety
//                               net for any Shopify webhook that was missed
//   shop-order-reconciliation   every 10 min — asks Fastrr about checkouts whose
//                               webhook never came; expires abandoned ones
// Run manually whenever the backend URL changes (Vercel URL, not Render — one
// host only, or every job runs twice):
//   node scripts/registerShopCatalogSchedule.js https://<backend-host>
// Re-running with the same scheduleId updates the existing schedule.
const SCHEDULES = [
  {
    scheduleId: 'shop-catalog-daily-sync',
    path: '/api/shop/internal/catalog-sync',
    cron: 'CRON_TZ=Asia/Kolkata 30 3 * * *',
    label: 'at 03:30 IST daily',
  },
  {
    scheduleId: 'shop-order-reconciliation',
    path: '/api/shop/internal/reconcile-orders',
    cron: '*/10 * * * *',
    label: 'every 10 minutes',
  },
];

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
  for (const s of SCHEDULES) {
    const destination = `${baseUrl}${s.path}`;
    const { scheduleId } = await client.schedules.create({
      scheduleId: s.scheduleId,
      destination,
      cron: s.cron,
      retries: 3,
    });
    console.log(`Schedule ${scheduleId} -> ${destination} ${s.label}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
