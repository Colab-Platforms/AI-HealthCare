const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

// One-time setup: registers our backend's webhook URL with Open Wearables and
// prints the signing secret. Run manually (`node scripts/registerOpenWearablesWebhook.js`)
// whenever the callback URL changes (e.g. new ngrok URL in dev, new domain in prod) —
// this is NOT called automatically by the app at runtime.
async function main() {
  const baseURL = `${process.env.OPEN_WEARABLES_API_URL}/api/v1`;
  const callbackUrl = process.env.OPEN_WEARABLES_WEBHOOK_CALLBACK_URL;

  if (!callbackUrl) {
    console.error('Set OPEN_WEARABLES_WEBHOOK_CALLBACK_URL in .env first (e.g. https://<ngrok-id>.ngrok.io/api/wearables/webhook)');
    process.exit(1);
  }

  // Endpoint management uses a developer Bearer token (from login), not the
  // X-Open-Wearables-API-Key used for the data API
  const { data: auth } = await axios.post(`${baseURL}/auth/login`, {
    email: process.env.OPEN_WEARABLES_ADMIN_EMAIL,
    password: process.env.OPEN_WEARABLES_ADMIN_PASSWORD
  });
  const authHeader = { Authorization: `Bearer ${auth.access_token}` };

  const { data: endpoint } = await axios.post(
    `${baseURL}/webhooks/endpoints`,
    {
      url: callbackUrl,
      description: 'AI-HealthCare backend wearable sync'
      // filter_types omitted on purpose — start by receiving everything,
      // narrow it down once the handler is confirmed working
    },
    { headers: authHeader }
  );
  console.log('Registered endpoint:', endpoint);

  const { data: secret } = await axios.get(
    `${baseURL}/webhooks/endpoints/${endpoint.id}/secret`,
    { headers: authHeader }
  );

  console.log('\nAdd this to server/.env:');
  console.log(`OPEN_WEARABLES_WEBHOOK_SECRET=${secret.key}`);
}

main().catch(err => {
  console.error(err.response?.data || err.message);
  process.exit(1);
});
