const axios = require('axios');

/**
 * Enqueue a background task using Upstash QStash
 * This allows Vercel serverless functions to trigger long-running tasks (>10-60s)
 * without timing out the main request.
 */
exports.enqueueTask = async (taskType, payload) => {
  try {
    const qstashToken = process.env.QSTASH_TOKEN;
    const qstashUrl = process.env.QSTASH_URL || "https://qstash.upstash.io";
    
    // Production: Use the current Vercel deployment URL
    // Local: This will only work if you use something like 'ngrok'
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
    console.log(`🔄 Enqueuing QStash task for ${taskType} | Call: ${destinationUrl}`);

    const response = await axios.post(
      `https://qstash.upstash.io/v1/publish/${destinationUrl}`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${qstashToken}`,
          'Content-Type': 'application/json',
          'Upstash-Retries': '1' 
        }
      }
    );

    console.log(`✅ [QStash] ${taskType} enqueued | ID: ${response.data.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ [QStash] Enqueue Error [${taskType}]:`, error.response?.data || error.message);
    return false;
  }
};
