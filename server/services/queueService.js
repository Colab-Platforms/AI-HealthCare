const axios = require('axios');

/**
 * Enqueue a background task using Upstash QStash (Version 2)
 */
exports.enqueueTask = async (taskType, payload, customBaseUrl = null) => {
  try {
    const qstashToken = process.env.QSTASH_TOKEN;
    const QSTASH_PUBLISH_URL = "https://qstash.upstash.io/v2/publish/";
    
    // 🔥 Improved URL detection: Prefer Host header from controller if available
    let appUrl = customBaseUrl;
    
    if (!appUrl) {
      if (process.env.VERCEL_URL) {
        appUrl = `https://${process.env.VERCEL_URL}`;
      } else {
        appUrl = process.env.APP_URL || 'http://localhost:5001';
      }
    }

    // Ensure no trailing slash
    appUrl = appUrl.replace(/\/$/, "");

    if (!qstashToken) {
      console.warn('⚠️ QSTASH_TOKEN not found');
      return false;
    }

    let endpoint = "";
    if (taskType === 'process-report') {
      endpoint = "/api/health/process-report-bg";
    } else if (taskType === 'process-diet') {
      endpoint = "/api/diet-recommendation/process-diet-bg";
    }

    const destinationUrl = `${appUrl}${endpoint}`;
    console.log(`🚀 [QStash V2] Dispatching to: ${destinationUrl}`);

    const response = await axios.post(
      `${QSTASH_PUBLISH_URL}${destinationUrl}`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${qstashToken}`,
          'Content-Type': 'application/json',
          'Upstash-Retries': '2' 
        }
      }
    );

    console.log(`✅ [QStash V2] Success | ID: ${response.data.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ [QStash V2] Failure:`, error.response?.data || error.message);
    return false;
  }
};
