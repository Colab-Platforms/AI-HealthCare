const express = require('express');
const router = express.Router();
const {
    recordConsent,
    getConsentStatus,
    updatePrivacySettings,
    exportData,
    requestAccountDeletion,
    cancelAccountDeletion,
    requestPublicDeletion,
    confirmPublicDeletion,
} = require('../controllers/privacyController');
const { protect } = require('../middleware/auth');
const { apiLimiter, authLimiter, sensitiveActionLimiter } = require('../middleware/rateLimit');

router.post('/consent',           protect, apiLimiter, recordConsent);
router.get('/consent',            protect, apiLimiter, getConsentStatus);
router.put('/settings',           protect, apiLimiter, updatePrivacySettings);
router.get('/export',             protect, exportData);           // no rate limit — heavy but rare
router.post('/delete-account',    protect, apiLimiter, requestAccountDeletion);
router.post('/cancel-deletion',   protect, apiLimiter, cancelAccountDeletion);

// Public, unauthenticated — Google Play requires account deletion to work
// without the app installed / without logging in. sensitiveActionLimiter
// falls back to per-IP limiting when there's no logged-in user.
router.post('/public-delete/request', authLimiter, requestPublicDeletion);
router.post('/public-delete/confirm', sensitiveActionLimiter, confirmPublicDeletion);

module.exports = router;
