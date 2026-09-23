const express = require('express');
const router = express.Router();

let submitApplication, listApplications, exportApplications;
try {
    const controller = require('../controllers/creatorController');
    submitApplication = controller.submitApplication;
    listApplications = controller.listApplications;
    exportApplications = controller.exportApplications;
    console.log('[CreatorRoutes] ✅ Controllers loaded successfully');
} catch (err) {
    console.error('[CreatorRoutes] ❌ Failed to load controllers:', err.message);
    throw err;
}

let authLimiter, protect, admin;
try {
    const rateLimitMiddleware = require('../middleware/rateLimit');
    authLimiter = rateLimitMiddleware.authLimiter;

    const authMiddleware = require('../middleware/auth');
    protect = authMiddleware.protect;
    admin = authMiddleware.admin;
    console.log('[CreatorRoutes] ✅ Middleware loaded successfully');
} catch (err) {
    console.error('[CreatorRoutes] ❌ Failed to load middleware:', err.message);
    throw err;
}

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({ status: 'Creator routes are healthy', endpoint: 'POST /api/creator' });
});

// Public route - submit a Creator Program application
router.post('/', authLimiter, (req, res, next) => {
    console.log('[CreatorRoutes] POST / received:', { name: req.body.name, email: req.body.email });
    submitApplication(req, res).catch(next);
});

// Admin route - export applications as a formatted Excel workbook
router.get('/export', protect, admin, (req, res, next) => {
    console.log('[CreatorRoutes] GET /export received');
    exportApplications(req, res).catch(next);
});

// Admin route - list applications
router.get('/', protect, admin, (req, res, next) => {
    console.log('[CreatorRoutes] GET / received');
    listApplications(req, res).catch(next);
});

console.log('[CreatorRoutes] ✅ Routes initialized');

module.exports = router;
