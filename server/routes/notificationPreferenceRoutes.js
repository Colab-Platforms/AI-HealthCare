const express = require('express');
const router = express.Router();
const { getPreferences, updatePreferences } = require('../controllers/notificationPreferenceController');
const { protect } = require('../middleware/auth');

// Apply authentication to all routes
router.use(protect);

router.get('/', getPreferences);
router.put('/', updatePreferences);

module.exports = router;
