const express = require('express');
const router = express.Router();
const { getActivityLogs, getActivityStats } = require('../controllers/activityController');
const { protect, authorize } = require('../middleware/auth');

// All activity routes are admin-only
router.use(protect, authorize('admin', 'superadmin'));

router.get('/', getActivityLogs);
router.get('/stats', getActivityStats);

module.exports = router;
