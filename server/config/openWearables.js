const axios = require("axios");

// The middleware runs as a separate service — localhost in dev, its own deployed
// host in production — so its address always comes from env.
const isConfigured = Boolean(
  process.env.OPEN_WEARABLES_API_URL && process.env.OPEN_WEARABLES_API_KEY
);

if (!isConfigured) {
  // Say it at boot rather than letting it surface as an opaque 500 on a user's
  // first "Connect device" tap
  console.warn(
    "[OpenWearables] OPEN_WEARABLES_API_URL / OPEN_WEARABLES_API_KEY missing — wearable device connections are disabled"
  );
}

const openWearablesClient = axios.create({
  baseURL: `${process.env.OPEN_WEARABLES_API_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json",
    "X-Open-Wearables-API-Key": process.env.OPEN_WEARABLES_API_KEY,
  },
  timeout: 10000,
});

openWearablesClient.isConfigured = isConfigured;

module.exports = openWearablesClient;
