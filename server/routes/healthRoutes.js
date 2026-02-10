const express = require('express');
const router = express.Router();
const { 
  uploadReport, 
  getReports, 
  getReportById, 
  getDashboardData,
  compareWithPrevious,
  chatAboutReport,
  getHealthHistory,
  aiChat,
  getMetricInfo,
  deleteReport
} = require('../controllers/healthController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/upload', protect, upload.single('report'), uploadReport);
router.get('/reports', protect, getReports);
router.get('/history', protect, getHealthHistory);
router.get('/dashboard', protect, getDashboardData);
router.get('/reports/:id', protect, getReportById);
router.delete('/reports/:id', protect, deleteReport);
router.get('/reports/:id/compare', protect, compareWithPrevious);
router.post('/reports/:id/chat', protect, chatAboutReport);
router.post('/ai-chat', protect, aiChat);
router.post('/metric-info', protect, getMetricInfo);

module.exports = router;
