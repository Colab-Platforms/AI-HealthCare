const express = require('express');
const router = express.Router();
const {
    getPreferences,
    updatePreferences,
    updateMealTime,
    updateSleepSchedule,
    toggleNotificationType,
    getAllPreferences
} = require('../controllers/notificationPreferenceController');
const { protect, admin } = require('../middleware/auth');

// Apply authentication to all routes
router.use(protect);

// User routes
router.get('/', getPreferences);
router.put('/', updatePreferences);
router.put('/meal-time', updateMealTime);
router.put('/sleep-schedule', updateSleepSchedule);
router.put('/toggle', toggleNotificationType);

// Admin routes
router.get('/admin/all', admin, getAllPreferences);

module.exports = router;
