/**
 * Register the Shopify order webhooks the card offer needs, pointing at our server.
 *
 *     node scripts/registerShopifyWebhooks.js --url=https://<host> --dry-run   # show what would change
 *     node scripts/registerShopifyWebhooks.js --url=https://<host>             # create missing ones
 *
 * Needs SHOPIFY_ADMIN_STORE_DOMAIN, SHOPIFY_ADMIN_TOKEN (read_orders) and optionally
 * SHOPIFY_API_VERSION in .env. Talks only to Shopify, never to our database.
 * Idempotent: a topic already registered for this exact URL is left alone.
 * Webhooks registered by an app are signed with that app's client secret, which
 * must be SHOPIFY_CLIENT_SECRET on every backend that receives them.
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TOPICS = [
  // card offer
  'orders/create', 'orders/paid', 'orders/cancelled', 'refunds/create',
  // shop catalog sync (modules/shop) — needs read_products + read_inventory
  'products/create', 'products/update', 'products/delete', 'inventory_levels/update',
  'collections/create', 'collections/update', 'collections/delete',
];

(async () => {
  const domain = process.env.SHOPIFY_ADMIN_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  const version = process.env.SHOPIFY_API_VERSION || '2026-10';
  const urlArg = process.argv.find((a) => a.startsWith('--url='));
  const dryRun = process.argv.includes('--dry-run');

  if (!domain || !token) {
    console.error('SHOPIFY_ADMIN_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN must be set');
    process.exit(1);
  }
  if (!urlArg) {
    console.error('Pass --url=https://<your-backend-host>');
    process.exit(1);
  }
  const base = urlArg.slice('--url='.length).replace(/\/+$/, '');
  if (!/^https:\/\//.test(base)) {
    console.error('--url must start with https:// (Shopify only delivers to HTTPS)');
    process.exit(1);
  }
  const address = `${base}/api/shopify/webhooks`;

  const api = async (method, endpoint, body) => {
    const res = await fetch(`https://${domain}/admin/api/${version}/${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${method} ${endpoint} -> HTTP ${res.status} ${JSON.stringify(json.errors || json)}`);
    return json;
  };

  console.log(`Store: ${domain}  API ${version}`);
  console.log(`Target: ${address}`);
  console.log(dryRun ? 'MODE: DRY RUN (nothing is created)\n' : 'MODE: APPLY\n');

  const { webhooks = [] } = await api('GET', 'webhooks.json?limit=250');
  console.log('Already registered on this store:');
  for (const w of webhooks) console.log(`  - ${w.topic.padEnd(18)} ${w.address}`);
  if (!webhooks.length) console.log('  (none)');
  console.log('');

  for (const topic of TOPICS) {
    const exists = webhooks.some((w) => w.topic === topic && w.address === address);
    if (exists) {
      console.log(`  ✅ ${topic.padEnd(18)} already registered`);
      continue;
    }
    if (dryRun) {
      console.log(`  ➕ ${topic.padEnd(18)} would register`);
      continue;
    }
    await api('POST', 'webhooks.json', { webhook: { topic, address, format: 'json' } });
    console.log(`  ✅ ${topic.padEnd(18)} registered`);
  }
  console.log('\nDone.');
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
