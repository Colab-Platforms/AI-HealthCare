const express = require('express');
const router = express.Router();

// Import controllers
let joinWaitlist, getWaitlistStats, retryFailedEmails;
try {
    const controller = require('../controllers/waitlistController');
    joinWaitlist = controller.joinWaitlist;
    getWaitlistStats = controller.getWaitlistStats;
    retryFailedEmails = controller.retryFailedEmails;
    console.log('[WaitlistRoutes] ✅ Controllers loaded successfully');
} catch (err) {
    console.error('[WaitlistRoutes] ❌ Failed to load controllers:', err.message);
    throw err;
}

// Import middleware
let authLimiter, protect, admin;
try {
    const rateLimitMiddleware = require('../middleware/rateLimit');
    authLimiter = rateLimitMiddleware.authLimiter;
    
    const authMiddleware = require('../middleware/auth');
    protect = authMiddleware.protect;
    admin = authMiddleware.admin;
    console.log('[WaitlistRoutes] ✅ Middleware loaded successfully');
} catch (err) {
    console.error('[WaitlistRoutes] ❌ Failed to load middleware:', err.message);
    throw err;
}

// Health check endpoint
router.get('/', (req, res) => {
    res.json({ status: 'Waitlist routes are healthy', endpoint: 'POST /api/waitlist' });
});

// Public route - Join waitlist
router.post('/', authLimiter, (req, res, next) => {
    console.log('[WaitlistRoutes] POST / received:', { name: req.body.name, email: req.body.email });
    joinWaitlist(req, res).catch(next);
});

// Admin routes
router.get('/stats', protect, admin, (req, res, next) => {
    console.log('[WaitlistRoutes] GET /stats received');
    getWaitlistStats(req, res).catch(next);
});

router.post('/retry-failed-emails', protect, admin, (req, res, next) => {
    console.log('[WaitlistRoutes] POST /retry-failed-emails received');
    retryFailedEmails(req, res).catch(next);
});

console.log('[WaitlistRoutes] ✅ Routes initialized');

module.exports = router;
