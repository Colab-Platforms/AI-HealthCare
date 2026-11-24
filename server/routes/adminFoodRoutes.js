const express = require('express');
const c = require('../controllers/adminFoodController');

// Mounted inside routes/adminRoutes.js at /api/admin/foods, after its
// router.use(protect, authorize('admin', 'superadmin')) — so every route here is admin-only.
const router = express.Router();

// Express 4 does not catch rejected promises from async handlers.
const safe = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    console.error(`[admin/foods] ${req.method} ${req.originalUrl} failed:`, error);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Food admin request failed' });
  }
};

router.get('/', safe(c.listFoods));
router.get('/fallback-log', safe(c.listFallbackLog)); // before /:foodId
router.get('/:foodId', safe(c.getFood));
router.patch('/:foodId', safe(c.updateFood));
router.post('/:foodId/approve', safe(c.approveFood));
router.post('/:foodId/reject', safe(c.rejectFood));
router.post('/:foodId/merge', safe(c.mergeFood));

module.exports = router;
