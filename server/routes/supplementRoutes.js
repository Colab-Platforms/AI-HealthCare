const express = require('express');
const router = express.Router();
const supplementController = require('../controllers/supplementController');
const supplementReminderService = require('../services/supplementReminderService');
const { protect, authorize } = require('../middleware/auth');
const { verifyQStash } = require('../middleware/qstashAuth');
const { apiLimiter, supplementWriteLimiter } = require('../middleware/rateLimit');

/**
 * POST /api/supplements/cron-tick
 * Called by an Upstash QStash Schedule (every ~5 min). Sends dose reminders, marks
 * missed doses and tops up the dose window. Deliberately NOT behind `protect` —
 * QStash has no user session — and verified by signature instead. Kept separate
 * from /api/notifications/cron-tick so the heavy per-user meal scan there can
 * never delay a dose reminder, and vice versa.
 */
router.post('/cron-tick', verifyQStash, async (req, res) => {
    try {
        const result = await supplementReminderService.runTick();
        if (result.ok === false) return res.status(500).json({ success: false, error: result.error });
        res.json({ success: true, ...(result.skipped && { skipped: true }), ...(result.stats && { stats: result.stats }) });
    } catch (error) {
        console.error('Supplement cron-tick error:', error.message);
        // Non-200 so QStash retries; the tick is safe to repeat.
        res.status(500).json({ success: false, error: error.message });
    }
});

// Everything below requires a logged-in user.
router.use(protect);

// SPECIFIC ROUTES BEFORE PARAMETERIZED ROUTES
router.get('/catalog', apiLimiter, supplementController.getCatalog);
router.get('/today', apiLimiter, supplementController.getToday);
router.get('/doses', apiLimiter, supplementController.listDoses);
// apiLimiter only counts GETs; every mutating route uses supplementWriteLimiter.
router.post('/doses/:doseId/take', supplementWriteLimiter, supplementController.takeDose);
router.post('/doses/:doseId/miss', supplementWriteLimiter, supplementController.missDose);
router.delete('/doses/:doseId/log', supplementWriteLimiter, supplementController.clearDose);
router.get('/admin/custom-stats', authorize('admin', 'superadmin'), supplementController.getCustomStats);

router.get('/', apiLimiter, supplementController.listSupplements);
router.post('/', supplementWriteLimiter, supplementController.createSupplement);
router.get('/:id', apiLimiter, supplementController.getSupplement);
router.put('/:id', supplementWriteLimiter, supplementController.updateSupplement);
router.delete('/:id', supplementWriteLimiter, supplementController.archiveSupplement);

module.exports = router;
