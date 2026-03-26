const axios = require('axios');

/**
 * Enqueue a background task using Upstash QStash
 * This allows Vercel serverless functions to trigger long-running tasks (>10-60s)
 * without timing out the main request.
 */
exports.enqueueTask = async (topic, payload, options = {}) => {
  try {
    const qstashUrl = process.env.QSTASH_URL || "https://qstash-eu-central-1.upstash.io";
    const qstashToken = process.env.QSTASH_TOKEN;
    const appUrl = process.env.APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5001';

    if (!qstashToken) {
      console.warn('⚠️ QSTASH_TOKEN not found, background tasks may fail on Vercel');
      return false;
    }

    // Distinguish between local dev and production for callback URL
    const destinationUrl = `${appUrl}/api/health/process-report-bg`;

    console.log(`🔄 Enqueuing QStash task for ${topic} | Destination: ${destinationUrl}`);

    const response = await axios.post(
      `${qstashUrl}/v1/publish/${destinationUrl}`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${qstashToken}`,
          'Content-Type': 'application/json',
          'Upstash-Retries': '1' // Reduce retries to avoid wasting AI credits on timeouts
        }
      }
    );

    console.log(`✅ Task enqueued | MessageID: ${response.data.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ QStash Enqueue Error:', error.response?.data || error.message);
    return false;
  }
};
