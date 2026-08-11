const axios = require("axios");

const openWearablesClient = axios.create({
  baseURL: `${process.env.OPEN_WEARABLES_API_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json",
    "X-Open-Wearables-API-Key": process.env.OPEN_WEARABLES_API_KEY,
  },
  timeout: 10000,
});

module.exports = openWearablesClient;