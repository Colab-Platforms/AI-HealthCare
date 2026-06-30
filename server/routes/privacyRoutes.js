const express = require('express');
const router = express.Router();
const {
    recordConsent,
    getConsentStatus,
    updatePrivacySettings,
    exportData,
    requestAccountDeletion,
    cancelAccountDeletion,
} = require('../controllers/privacyController');
const { protect } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');

router.post('/consent',           protect, apiLimiter, recordConsent);
router.get('/consent',            protect, apiLimiter, getConsentStatus);
router.put('/settings',           protect, apiLimiter, updatePrivacySettings);
router.get('/export',             protect, exportData);           // no rate limit — heavy but rare
router.post('/delete-account',    protect, apiLimiter, requestAccountDeletion);
router.post('/cancel-deletion',   protect, apiLimiter, cancelAccountDeletion);

module.exports = router;
