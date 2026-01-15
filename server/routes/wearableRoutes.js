const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  connectDevice,
  disconnectDevice,
  getConnectedDevices,
  syncDailyMetrics,
  addHeartRate,
  addSleepData,
  getWearableDashboard,
  generateDemoData
} = require('../controllers/wearableController');

router.use(protect); // All routes require authentication

router.post('/connect', connectDevice);
router.post('/disconnect/:deviceType', disconnectDevice);
router.get('/devices', getConnectedDevices);
router.post('/sync', syncDailyMetrics);
router.post('/heart-rate', addHeartRate);
router.post('/sleep', addSleepData);
router.get('/dashboard', getWearableDashboard);
router.post('/demo-data', generateDemoData);

module.exports = router;
