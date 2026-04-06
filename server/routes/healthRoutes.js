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
  getHealthDNA
} = require('../controllers/healthController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/process-report-bg', processReportBG);
router.post('/upload', protect, upload.single('report'), uploadReport);
router.get('/reports', protect, getReports);
router.get('/history', protect, getHealthHistory);
router.get('/dashboard', protect, getDashboardData);
router.get('/report-comparison', protect, getReportComparison);
router.get('/reports/:id/status', protect, getReportStatus);
router.get('/reports/:id', protect, getReportById);
router.post('/reports/:id/reanalyze', protect, reanalyzeReport);
router.delete('/reports/:id', protect, deleteReport);
router.get('/reports/:id/compare', protect, compareWithPrevious);
router.post('/reports/:id/chat', protect, chatAboutReport);
router.post('/ai-chat', protect, aiChat);
router.post('/metric-info', protect, getMetricInfo);
router.post('/challenge', protect, saveChallengeData);
router.get('/challenge', protect, getChallengeData);

// Daily Progress Synchronization Routes
router.post('/daily-progress', protect, syncDailyProgress);
router.get('/daily-progress/:date', protect, getDailyProgress);

// Health DNA Profile
router.get('/health-dna', protect, getHealthDNA);

// AI Vitals Insights
router.get('/vitals-insights/:metricType', protect, getVitalsInsights);

module.exports = router;
