const express = require('express');
const router = express.Router();
const insightController = require('../controllers/insightController');
const { protect, admin } = require('../middleware/auth');

router.get('/today', protect, insightController.getTodaysInsights);
router.get('/', protect, insightController.getInsights);
router.patch('/:id/seen', protect, insightController.markInsightSeen);

// Manual run — testing and backfills only; the real schedule is the 23:59 IST cron.
router.post('/generate', protect, admin, insightController.triggerGeneration);

module.exports = router;
