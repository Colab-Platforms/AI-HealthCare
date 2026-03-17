const express = require('express');
const router = express.Router();
const foodSafetyController = require('../controllers/foodSafetyController');
const { protect } = require('../middleware/auth');

// Public search for food safety
router.get('/search', foodSafetyController.searchFoodSafety);
router.get('/all', foodSafetyController.getFoodSafetyAll);
router.get('/:name', foodSafetyController.getFoodSafetyByName);

// Protected manual sync trigger
router.post('/sync', protect, foodSafetyController.triggerSync);

module.exports = router;
