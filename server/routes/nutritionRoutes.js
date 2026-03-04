const express = require('express');
const router = express.Router();
const nutritionController = require('../controllers/nutritionController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Food Analysis
const upload = require('../middleware/upload');
router.post('/analyze-food', nutritionController.analyzeFood);
router.post('/quick-check', upload.single('image'), nutritionController.quickFoodCheck);
router.post('/get-alternatives', nutritionController.getHealthyAlternatives);

// Health Goals - SPECIFIC ROUTES BEFORE PARAMETERIZED ROUTES
router.post('/goals', nutritionController.setHealthGoal);
router.put('/goals', nutritionController.updateHealthGoal);
router.get('/goals', nutritionController.getHealthGoal);
router.post('/log-weight', nutritionController.logWeight);

// Nutrition Summary - SPECIFIC ROUTES BEFORE PARAMETERIZED ROUTES
router.get('/summary/daily', nutritionController.getDailySummary);
router.get('/summary/weekly', nutritionController.getWeeklySummary);
router.get('/activity/week', nutritionController.getActivityWeek);
router.get('/recommendations', nutritionController.getRecommendations);
router.get('/food-image', nutritionController.getFoodImage);

// Food Logging
router.post('/log-meal', nutritionController.logMeal);
router.get('/logs', nutritionController.getFoodLogs);
router.get('/logs/today', nutritionController.getTodayLogs);
router.put('/logs/:id', nutritionController.updateFoodLog);
router.delete('/logs/:id', nutritionController.deleteFoodLog);

// Quick Food Check - SPECIFIC ROUTES BEFORE PARAMETERIZED ROUTES
router.get('/quick-checks/history/date', nutritionController.getFoodCheckHistory);
router.get('/quick-checks/summary/weekly', nutritionController.getWeeklyFoodCheckSummary);
router.get('/quick-checks/:id', nutritionController.getQuickFoodCheck);
router.delete('/quick-checks/:id', nutritionController.deleteQuickFoodCheck);
router.get('/quick-checks', nutritionController.getQuickFoodChecks);

module.exports = router;
