const express = require('express');
const router = express.Router();
const { getActivityLogs, getActivityStats, exportActivityLogs, getLiveActiveUsers, getFeatureStats, getDauMau } = require('../controllers/activityController');
const { protect, authorize } = require('../middleware/auth');

// All activity routes are admin-only
router.use(protect, authorize('admin', 'superadmin'));

router.get('/', getActivityLogs);
router.get('/stats', getActivityStats);
router.get('/live-users', getLiveActiveUsers);
router.get('/export', exportActivityLogs);
router.get('/feature-stats', getFeatureStats);
router.get('/dau-mau', getDauMau);

module.exports = router;
