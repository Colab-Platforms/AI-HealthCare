const express = require('express');
const router = express.Router();
const nutritionController = require('../controllers/nutritionController');
const { protect } = require('../middleware/auth');
const { aiLimiter, apiLimiter, heavyReadLimiter } = require('../middleware/rateLimit');

// All routes require authentication
router.use(protect);

// Food Analysis
const upload = require('../middleware/upload');
router.post('/analyze-food', aiLimiter, nutritionController.analyzeFood);
// 'image' kept for backward-compat single-photo clients; 'images' is the new multi-photo field (up to 5)
router.post('/quick-check', aiLimiter, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'images', maxCount: 5 }]), nutritionController.quickFoodCheck);
router.post('/quick-check/save', nutritionController.saveQuickCheck);
router.post('/get-alternatives', aiLimiter, nutritionController.getHealthyAlternatives);

// Health Goals - SPECIFIC ROUTES BEFORE PARAMETERIZED ROUTES
router.post('/goals', nutritionController.setHealthGoal);
router.put('/goals', nutritionController.updateHealthGoal);
router.get('/goals', apiLimiter, nutritionController.getHealthGoal);
router.patch('/goals/calorie-override', nutritionController.setCalorieOverride);
router.post('/log-weight', nutritionController.logWeight);
router.post('/log-water', nutritionController.logWater);

// Nutrition Summary - SPECIFIC ROUTES BEFORE PARAMETERIZED ROUTES
router.get('/summary/daily', apiLimiter, nutritionController.getDailySummary);
router.get('/summary/weekly', apiLimiter, nutritionController.getWeeklySummary);
router.get('/activity/week', apiLimiter, nutritionController.getActivityWeek);
router.get('/recommendations', apiLimiter, nutritionController.getRecommendations);
router.get('/food-image', apiLimiter, nutritionController.getFoodImage);

// Food Logging
router.post('/log-meal', nutritionController.logMeal);
router.get('/logs', heavyReadLimiter, nutritionController.getFoodLogs);
router.get('/logs/today', apiLimiter, nutritionController.getTodayLogs);
router.put('/logs/:id', nutritionController.updateFoodLog);
router.delete('/logs/:id', nutritionController.deleteFoodLog);

// Quick Food Check - SPECIFIC ROUTES BEFORE PARAMETERIZED ROUTES
router.get('/quick-checks/history/date', nutritionController.getFoodCheckHistory);
router.get('/quick-checks/summary/weekly', nutritionController.getWeeklyFoodCheckSummary);
router.get('/quick-checks/:id', nutritionController.getQuickFoodCheck);
router.delete('/quick-checks/:id', nutritionController.deleteQuickFoodCheck);
router.get('/quick-checks', nutritionController.getQuickFoodChecks);

module.exports = router;
