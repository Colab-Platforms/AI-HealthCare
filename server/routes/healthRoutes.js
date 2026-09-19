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
  getDrinkCatalog,
  logAlcoholSession,
  editAlcoholSession,
  getAlcoholAnalytics,
  getHealthTrends,
  getReportFileUrl
} = require('../controllers/healthController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { aiLimiter, heavyReadLimiter, apiLimiter } = require('../middleware/rateLimit');
const { verifyQStash } = require('../middleware/qstashAuth');
const { requireFeature } = require('../middleware/subscriptionAccess');
const { requireHealthConsent } = require('../middleware/consentAccess');

// Background-job webhook — called by QStash, not by users, so it has no `protect`.
// It MUST keep verifyQStash: the handler trusts userId/reportId from the body
// and spends AI credits.
router.post('/process-report-bg', verifyQStash, processReportBG);
// Gated BEFORE multer/Cloudinary so a plan without this feature never spends storage/AI on it.
router.post('/upload', protect, requireHealthConsent, aiLimiter, requireFeature('aiMedicalReportAnalysis'), upload.single('report'), uploadReport);
router.get('/reports', protect, heavyReadLimiter, getReports);
router.get('/history', protect, apiLimiter, getHealthHistory);
router.get('/dashboard', protect, heavyReadLimiter, getDashboardData);
router.get('/score', protect, heavyReadLimiter, require('../controllers/healthScoreController').getHealthScore);
router.get('/report-comparison', protect, apiLimiter, getReportComparison);
router.get('/reports/:id/status', protect, apiLimiter, getReportStatus);
router.get('/reports/:id/file-url', protect, apiLimiter, getReportFileUrl);
router.get('/reports/:id', protect, apiLimiter, getReportById);
router.post('/reports/:id/reanalyze', protect, requireHealthConsent, aiLimiter, reanalyzeReport);
router.delete('/reports/:id', protect, deleteReport);
router.get('/reports/:id/compare', protect, compareWithPrevious);
router.post('/reports/:id/chat', protect, requireHealthConsent, aiLimiter, chatAboutReport);
router.post('/ai-chat', protect, requireHealthConsent, aiLimiter, aiChat);
router.post('/metric-info', protect, requireHealthConsent, aiLimiter, getMetricInfo);
router.post('/challenge', protect, saveChallengeData);
router.get('/challenge', protect, getChallengeData);

// Smoke Logging Sync Routes
router.post('/smoke-log', protect, saveSmokeLog);
router.put('/smoke-log', protect, saveSmokeLog);
router.get('/smoke-log', protect, getSmokeLog);

// Alcohol Logging Sync Routes
router.post('/alcohol-log', protect, saveAlcoholLog);
router.put('/alcohol-log', protect, saveAlcoholLog);
router.get('/alcohol-log', protect, getAlcoholLog);
router.get('/alcohol/catalog', protect, getDrinkCatalog);
router.post('/alcohol-log/session', protect, logAlcoholSession);
router.patch('/alcohol-log/session/:date/:sessionId', protect, editAlcoholSession);
router.get('/alcohol/analytics', protect, getAlcoholAnalytics);


// Daily Progress Synchronization Routes
router.post('/daily-progress', protect, syncDailyProgress);
router.get('/daily-progress/:date', protect, getDailyProgress);

// Health DNA Profile
router.get('/health-dna', protect, requireHealthConsent, aiLimiter, getHealthDNA);

// AI Vitals Insights
router.get('/vitals-insights/:metricType', protect, requireHealthConsent, aiLimiter, getVitalsInsights);

// Health Trends
router.get('/trends', protect, apiLimiter, getHealthTrends);

module.exports = router;
