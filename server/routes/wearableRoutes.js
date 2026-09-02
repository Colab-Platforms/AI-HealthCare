const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { apiLimiter, heavyReadLimiter } = require('../middleware/rateLimit');
const {
  connectDevice,
  disconnectDevice,
  getConnectedDevices,
  syncDailyMetrics,
  addHeartRate,
  addSleepData,
  getWearableDashboard,
  getHeartRateTrend,
  generateDemoData,
  getConnectUrl,
  handleWebhook
} = require('../controllers/wearableController');

// No auth — Open Wearables/Svix calls this directly, verified by signature instead of JWT
router.post('/webhook', handleWebhook);

router.use(protect); // All routes below require authentication

router.get('/connect-url/:provider', getConnectUrl);
router.post('/connect', connectDevice);
router.post('/disconnect/:deviceType', disconnectDevice);
router.get('/devices', apiLimiter, getConnectedDevices);
router.post('/sync', syncDailyMetrics);
router.post('/heart-rate', addHeartRate);
router.post('/sleep', addSleepData);
router.get('/dashboard', heavyReadLimiter, getWearableDashboard);
router.get('/heart-rate/trend', heavyReadLimiter, getHeartRateTrend);
router.post('/demo-data', generateDemoData);

module.exports = router;
