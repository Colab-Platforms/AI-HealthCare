const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { apiLimiter, heavyReadLimiter, wearableSyncLimiter } = require('../middleware/rateLimit');
const {
  connectDevice,
  syncOsHealthData,
  disconnectDevice,
  getConnectedDevices,
  syncDailyMetrics,
  addHeartRate,
  addSleepData,
  getWearableDashboard,
  getHeartRateTrend,
  generateDemoData,
  getConnectUrl,
  getMiddlewareUserId,
  handleWebhook,
  getSleepAnalyticsData,
  getActivityAnalyticsData,
  getSleepInsightData,
  getActivityInsightData
} = require('../controllers/wearableController');

// No auth — Open Wearables/Svix calls this directly, verified by signature instead of JWT
router.post('/webhook', handleWebhook);

router.use(protect); // All routes below require authentication

router.get('/connect-url/:provider', getConnectUrl);
router.get('/middleware-user-id/:provider', getMiddlewareUserId);
router.post('/connect', connectDevice);
router.post('/os-sync', wearableSyncLimiter, syncOsHealthData);
router.post('/disconnect/:deviceType', disconnectDevice);
router.get('/devices', apiLimiter, getConnectedDevices);
router.post('/sync', syncDailyMetrics);
router.post('/heart-rate', addHeartRate);
router.post('/sleep', addSleepData);
router.get('/dashboard', heavyReadLimiter, getWearableDashboard);
router.get('/sleep/analytics', heavyReadLimiter, getSleepAnalyticsData);
router.get('/sleep/insight', apiLimiter, getSleepInsightData);
router.get('/activity/analytics', heavyReadLimiter, getActivityAnalyticsData);
router.get('/activity/insight', apiLimiter, getActivityInsightData);
router.get('/heart-rate/trend', heavyReadLimiter, getHeartRateTrend);
router.post('/demo-data', generateDemoData);

module.exports = router;
