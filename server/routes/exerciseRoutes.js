const express = require('express');
const router = express.Router();
const exerciseController = require('../controllers/exerciseController');
const { protect } = require('../middleware/auth');
const { apiLimiter, heavyReadLimiter } = require('../middleware/rateLimit');

// All routes require authentication
router.use(protect);

// Summary/analytics - SPECIFIC ROUTES BEFORE PARAMETERIZED ROUTES
router.get('/summary/daily', apiLimiter, exerciseController.getDailySummary);
router.get('/summary/weekly', apiLimiter, exerciseController.getWeeklySummary);
router.get('/trends', heavyReadLimiter, exerciseController.getTrends);
router.get('/personal-records', heavyReadLimiter, exerciseController.getPersonalRecords);

// Exercise Logging
router.post('/log', exerciseController.logExercise);
router.get('/logs', heavyReadLimiter, exerciseController.getExerciseLogs);
router.get('/logs/today', apiLimiter, exerciseController.getTodayLogs);
router.put('/logs/:id', exerciseController.updateExerciseLog);
router.delete('/logs/:id', exerciseController.deleteExerciseLog);

module.exports = router;
