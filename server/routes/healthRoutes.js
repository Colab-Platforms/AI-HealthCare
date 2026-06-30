const express = require('express');
const router = express.Router();
const {
  uploadReport,
  getReports,
  getReportById,
  getReportStatus,
  reanalyzeReport,
  getDashboardData,
  compareWithPrevious,
  chatAboutReport,
  getHealthHistory,
  aiChat,
  getMetricInfo,
  deleteReport,
  saveChallengeData,
  getChallengeData,
  getReportComparison,
  syncDailyProgress,
  getDailyProgress,
  getVitalsInsights,
  processReportBG,
  getHealthDNA,
  saveSmokeLog,
  getSmokeLog,
  saveAlcoholLog,
  getAlcoholLog,
  getHealthTrends,
  getReportFileUrl
} = require('../controllers/healthController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { aiLimiter, heavyReadLimiter, apiLimiter } = require('../middleware/rateLimit');

router.post('/process-report-bg', processReportBG);
router.post('/upload', protect, aiLimiter, upload.single('report'), uploadReport);
router.get('/reports', protect, heavyReadLimiter, getReports);
router.get('/history', protect, apiLimiter, getHealthHistory);
router.get('/dashboard', protect, heavyReadLimiter, getDashboardData);
router.get('/report-comparison', protect, apiLimiter, getReportComparison);
router.get('/reports/:id/status', protect, apiLimiter, getReportStatus);
router.get('/reports/:id/file-url', protect, apiLimiter, getReportFileUrl);
router.get('/reports/:id', protect, apiLimiter, getReportById);
router.post('/reports/:id/reanalyze', protect, aiLimiter, reanalyzeReport);
router.delete('/reports/:id', protect, deleteReport);
router.get('/reports/:id/compare', protect, compareWithPrevious);
router.post('/reports/:id/chat', protect, aiLimiter, chatAboutReport);
router.post('/ai-chat', protect, aiLimiter, aiChat);
router.post('/metric-info', protect, aiLimiter, getMetricInfo);
router.post('/challenge', protect, saveChallengeData);
router.get('/challenge', protect, getChallengeData);

// Smoke Logging Sync Routes
router.post('/smoke-log', protect, saveSmokeLog);
router.get('/smoke-log', protect, getSmokeLog);

// Alcohol Logging Sync Routes
router.post('/alcohol-log', protect, saveAlcoholLog);
router.get('/alcohol-log', protect, getAlcoholLog);


// Daily Progress Synchronization Routes
router.post('/daily-progress', protect, syncDailyProgress);
router.get('/daily-progress/:date', protect, getDailyProgress);

// Health DNA Profile
router.get('/health-dna', protect, aiLimiter, getHealthDNA);

// AI Vitals Insights
router.get('/vitals-insights/:metricType', protect, aiLimiter, getVitalsInsights);

// Health Trends
router.get('/trends', protect, apiLimiter, getHealthTrends);

module.exports = router;
