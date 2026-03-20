const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Food preferences routes
router.get('/food-preferences', userController.getFoodPreferences);
router.post('/food-preferences', userController.saveFoodPreferences);
router.post('/analyze-food-choices', userController.analyzeFoodChoices);

module.exports = router;
