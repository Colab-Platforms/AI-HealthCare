const { Client } = require('@upstash/qstash');
const dotenv = require('dotenv');

dotenv.config();

// One-time setup: creates (or replaces) the QStash schedule that runs the
// end-of-day insight job at 23:59 IST. Run manually whenever the backend URL
// changes:
//   node scripts/registerFinalInsightSchedule.js https://<backend-host>
// Re-running with the same scheduleId updates the existing schedule instead
// of adding a second one.
async function main() {
  const baseUrl = (process.argv[2] || '').replace(/\/$/, '');
  if (!/^https:\/\//.test(baseUrl)) {
    console.error('Usage: node scripts/registerFinalInsightSchedule.js https://<backend-host>');
    process.exit(1);
  }
  if (!process.env.QSTASH_TOKEN) {
    console.error('QSTASH_TOKEN is not set in .env');
    process.exit(1);
  }

  const client = new Client({ token: process.env.QSTASH_TOKEN });
  const destination = `${baseUrl}/api/insights/internal/final-dispatch`;
  const { scheduleId } = await client.schedules.create({
    scheduleId: 'final-daily-insights',
    destination,
    cron: 'CRON_TZ=Asia/Kolkata 59 23 * * *',
    retries: 3,
  });

  console.log(`Schedule ${scheduleId} -> ${destination} at 23:59 IST daily`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
