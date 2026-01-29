const express = require('express');
const router = express.Router();
const nutritionController = require('../controllers/nutritionController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Food Analysis
router.post('/analyze-food', nutritionController.analyzeFood);
router.post('/quick-check', nutritionController.quickFoodCheck);
router.post('/get-alternatives', nutritionController.getHealthyAlternatives);

// Food Logging
router.post('/log-meal', nutritionController.logMeal);
router.get('/logs', nutritionController.getFoodLogs);
router.get('/logs/today', nutritionController.getTodayLogs);
router.put('/logs/:id', nutritionController.updateFoodLog);
router.delete('/logs/:id', nutritionController.deleteFoodLog);

// Health Goals
router.post('/goals', nutritionController.setHealthGoal);
router.get('/goals', nutritionController.getHealthGoal);
router.post('/log-weight', nutritionController.logWeight);

// Nutrition Summary
router.get('/summary/daily', nutritionController.getDailySummary);
router.get('/summary/weekly', nutritionController.getWeeklySummary);
router.get('/activity/week', nutritionController.getActivityWeek);

// AI Recommendations
router.get('/recommendations', nutritionController.getRecommendations);

module.exports = router;
