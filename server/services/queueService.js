const axios = require('axios');

/**
 * Enqueue a background task using Upstash QStash (Version 2)
 * This allows Vercel serverless functions to trigger long-running tasks (>10-60s)
 * without timing out the main request.
 */
exports.enqueueTask = async (taskType, payload) => {
  try {
    const qstashToken = process.env.QSTASH_TOKEN;
    
    // 🔥 QStash V2 Publish Endpoint
    const QSTASH_PUBLISH_URL = "https://qstash.upstash.io/v2/publish/";
    
    // Production: Use the current Vercel deployment URL
    const appUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : (process.env.APP_URL || 'http://localhost:5001');

    if (!qstashToken) {
      console.warn('⚠️ QSTASH_TOKEN not found, background tasks will fail on Vercel');
      return false;
    }

    // Determine the correct callback endpoint based on task type
    let endpoint = "";
    if (taskType === 'process-report') {
      endpoint = "/api/health/process-report-bg";
    } else if (taskType === 'process-diet') {
      endpoint = "/api/diet-recommendation/process-diet-bg";
    } else {
      throw new Error(`Unknown task type: ${taskType}`);
    }

    const destinationUrl = `${appUrl}${endpoint}`;
    console.log(`🔄 [QStash V2] Enqueuing ${taskType} | Call: ${destinationUrl}`);

    // QStash V2 uses: /v2/publish/{url}
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

    console.log(`✅ [QStash V2] ${taskType} enqueued | ID: ${response.data.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ [QStash V2] Enqueue Error [${taskType}]:`, error.response?.data || error.message);
    return false;
  }
};
