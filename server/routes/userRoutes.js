const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');

// Public — clicked from an email inbox, the user isn't logged in
router.get('/:id/unsubscribe-marketing', userController.unsubscribeMarketing);

// All routes below require authentication
router.use(protect);

// Food preferences routes
router.get('/food-preferences', userController.getFoodPreferences);
router.post('/food-preferences', userController.saveFoodPreferences);
router.post('/analyze-food-choices', userController.analyzeFoodChoices);

// FCM push token — Android/iOS app calls this on launch
router.post('/fcm-token', userController.saveFcmToken);

module.exports = router;
