const express = require('express');
const router = express.Router();
const insightController = require('../controllers/insightController');
const { protect, admin } = require('../middleware/auth');
const { verifyQStash } = require('../middleware/qstashAuth');

router.get('/today', protect, insightController.getTodaysInsights);
router.get('/final', protect, insightController.getFinalInsights);
router.get('/', protect, insightController.getInsights);
router.patch('/:id/seen', protect, insightController.markInsightSeen);

// Manual run — testing and backfills only. Admin-only: every call spends LLM credits.
router.post('/generate', protect, admin, insightController.triggerGeneration);

// Called by QStash (no user session), verified by signature instead. The
// 23:59 IST QStash schedule hits final-dispatch, which queues final-worker
// once per user with data that day.
router.post('/internal/final-dispatch', verifyQStash, insightController.dispatchFinalInsights);
router.post('/internal/final-worker', verifyQStash, insightController.finalInsightWorker);

module.exports = router;
