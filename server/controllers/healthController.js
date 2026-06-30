const axios = require('axios');
const HealthReport = require('../models/HealthReport');
const FoodLog = require('../models/FoodLog');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const HealthGoal = require('../models/HealthGoal');
const { analyzeHealthReport, chatAboutReport, chatWithReport, generateMetricInfo, generateVitalsInsights } = require('../services/aiService');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const NutritionSummary = require('../models/NutritionSummary');
const DailyProgress = require('../models/DailyProgress');
const cache = require('../utils/cache');
const cloudinary = require('../services/cloudinary');
const emailService = require('../services/emailService');
const queueService = require('../services/queueService');
const { sendToUser } = require('../services/fcmService');
const HealthMetric = require('../models/HealthMetric');
const PersonalizedDietPlan = require('../models/PersonalizedDietPlan');
const { logActivity } = require('../utils/activityLogger');
const { inferCategory } = require('../utils/reportCategory');
const {
  sanitizeAlcoholLog,
  toPlainAlcoholLog,
  getAlcoholSummary
} = require('../utils/alcoholLog');

const withTimeout = (query, timeoutMs = 45000) => {
  return query.maxTimeMS(timeoutMs);
};

// Dedupe concurrent dashboard cache-misses for the same user (avoids N parallel
// DB-query bursts when a user has multiple tabs/requests hitting an expired cache)
const dashboardInFlight = new Map();

/**
 * 🚀 BACKGROUND ANALYSIS PROCESSOR
 */
async function processReportInternal(userId, reportId, fileMimetype, extractedText, dataBuffer = null) {
  console.log(`🔄 [BG] Starting internal logic for report ${reportId}...`);
  try {
    const userDoc = await User.findById(userId);
    if (!userDoc) throw new Error('User not found');

    let aiAnalysis;
    
    // Ensure we have a buffer for vision/document analysis if it's not provided
    if (!dataBuffer) {
      const updatedReport = await HealthReport.findById(reportId);
      if (updatedReport && updatedReport.originalFile?.cloudinaryUrl) {
        console.log(`📥 [BG] Fetching file from Cloudinary for analysis: ${updatedReport.originalFile.cloudinaryUrl}`);
        const axios = require('axios');
        // Use signed URL — files are now type:'authenticated' and need a valid signature to fetch
        const fetchUrl = cloudinary.generateSignedUrl(updatedReport.originalFile.cloudinaryUrl) || updatedReport.originalFile.cloudinaryUrl;
        const response = await axios.get(fetchUrl, { responseType: 'arraybuffer' });
        dataBuffer = Buffer.from(response.data);
      }
    }

    aiAnalysis = await analyzeHealthReport(extractedText, userDoc, {
      buffer: dataBuffer,
      mimetype: fileMimetype
    }, 'general', {
      userId:   userId,
      reportId: reportId,
      feature:  'analyze_report',
    });

    const updatedReport = await HealthReport.findById(reportId);
    if (!updatedReport) return;

    updatedReport.aiAnalysis = aiAnalysis;
    updatedReport.status = 'completed';

    // AI-detected category takes priority over user-selected reportType
    const validCategories = ['lab_report', 'prescription', 'scan', 'doctor_notes', 'vaccination', 'insurance', 'other'];
    if (aiAnalysis.documentCategory && validCategories.includes(aiAnalysis.documentCategory)) {
      updatedReport.category = aiAnalysis.documentCategory;
    } else {
      updatedReport.category = inferCategory(updatedReport.reportType, updatedReport.isPrescription, aiAnalysis);
    }

    // Update reportType with AI-detected human-readable type if available
    if (aiAnalysis.documentType && aiAnalysis.documentType.trim()) {
      updatedReport.reportType = aiAnalysis.documentType.trim();
    }

    // Metadata extraction
    if (aiAnalysis.reportDate) {
      try { updatedReport.reportDate = new Date(aiAnalysis.reportDate); }
      catch (e) { updatedReport.reportDate = new Date(); }
    } else { updatedReport.reportDate = new Date(); }

    if (aiAnalysis.patientName) updatedReport.patientName = aiAnalysis.patientName.trim();
    if (aiAnalysis.patientAge) updatedReport.patientAge = Number(aiAnalysis.patientAge);
    if (aiAnalysis.patientGender) updatedReport.patientGender = aiAnalysis.patientGender.trim();

    updatedReport.markModified('aiAnalysis');
    await updatedReport.save();
    console.log(`[BG] Report saved. Metrics count: ${Object.keys(aiAnalysis.metrics || {}).length}`);

    // Invalidate caches
    await cache.delete(`reports:${userId}`);
    await cache.delete(`dashboard:${userId}`);
    await cache.delete(`trends:${userId}:all`);

    // Update User Score
    if (aiAnalysis.healthScore) {
      await User.findByIdAndUpdate(userId, {
        'healthMetrics.healthScore': aiAnalysis.healthScore,
        'healthMetrics.lastCheckup': new Date()
      });
    }

    // Auto-Comparison
    try {
      const prev = await HealthReport.findOne({
        user: userId,
        reportType: updatedReport.reportType,
        _id: { $ne: reportId },
        status: 'completed',
        createdAt: { $lt: updatedReport.createdAt }
      }).sort({ createdAt: -1 });

      if (prev && prev.aiAnalysis) {
        const currentScore  = updatedReport.aiAnalysis?.healthScore || 0;
        const previousScore = prev.aiAnalysis?.healthScore || 0;
        const diff = currentScore - previousScore;
        const overallTrend = diff > 3 ? 'improving' : diff < -3 ? 'declining' : 'stable';

        updatedReport.comparison = {
          previousReportId:   prev._id,
          previousReportDate: prev.createdAt,
          data: {
            overallTrend,
            scoreDiff:     diff,
            currentScore,
            previousScore,
          }
        };
        await updatedReport.save();
      }
    } catch (e) { console.warn('Comparison failed:', e.message); }

    // Email Notification
    try { await emailService.sendReportAnalysisComplete(userDoc.email, userDoc.name, reportId); }
    catch (e) { console.warn('Email failed:', e.message); }

    // FCM Push Notification
    sendToUser(userId, {
      title: 'Report Analysis Complete',
      body: 'Your health report has been analyzed. Tap to view your results.',
      data: { type: 'report_ready', actionUrl: `/reports/${reportId}` }
    }).catch(e => console.warn('FCM report notification failed:', e.message));

    console.log(`[BG] Analysis complete for ${reportId}`);

    // 🚀 Auto-trigger diet plan generation after successful report analysis
    try {
      const PersonalizedDietPlan = require('../models/PersonalizedDietPlan');
      const existingPlan = await PersonalizedDietPlan.findOne({ userId, isActive: true, status: 'completed' });
      if (!existingPlan) {
        console.log('[BG] No active diet plan found. Auto-generating based on new report...');
        const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ID);
        if (isVercel) {
          // On Vercel: dispatch diet as separate QStash job (setImmediate is unreliable on serverless)
          console.log('[BG] Dispatching auto-diet via QStash...');
          const appUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
          await queueService.enqueueTask('process-diet', {
            userId,
            dietPlanId: null, // Will be created by generateDietAfterReport
            isAutoTrigger: true
          }, appUrl);
        } else {
          // On local: use setTimeout with cooldown (server stays alive)
          // ⏳ 15s cooldown to prevent 529 (overloaded) errors from back-to-back Claude API calls
          const { generateDietAfterReport } = require('./dietRecommendationController');
          if (generateDietAfterReport) {
            console.log('[BG] Scheduling auto-diet generation in 15s (API cooldown)...');
            setTimeout(() => generateDietAfterReport(userId).catch(e => console.warn('[BG] Auto-diet failed:', e.message)), 15000);
          }
        }
      }
    } catch (dietErr) {
      console.warn('[BG] Auto-diet trigger skipped:', dietErr.message);
    }
  } catch (error) {
    console.error(`❌ [BG] Analysis failed for ${reportId}:`, error.message);
    const msg = String(error?.message || 'Analysis failed');
    console.warn(`🗑️ [BG] Deleting failed report ${reportId}: ${msg}`);
    await HealthReport.findByIdAndDelete(reportId);
    await cache.delete(`reports:${userId}`);
    await cache.delete(`dashboard:${userId}`);
  }
}

/**
 * 📡 QStash Webhook Endpoint
 */
exports.processReportBG = async (req, res) => {
  try {
    const { userId, reportId, fileMimetype, extractedText } = req.body;
    console.log(`🔔 QStash callback received for report ${reportId}`);
    await processReportInternal(userId, reportId, fileMimetype, extractedText);
    res.status(202).json({ success: true });

  } catch (err) {
    console.error('QStash Callback Error:', err.message);
    if (!res.headersSent) res.status(500).end();
  }
};

exports.reanalyzeReport = async (req, res) => {
  try {
    const report = await HealthReport.findOne({ _id: req.params.id, user: req.user._id });
    if (!report) return res.status(404).json({ message: 'Report not found' });

    report.status = 'processing';
    await report.save();

    // Trigger analysis in background
    setImmediate(() => processReportInternal(
      req.user._id, 
      report._id, 
      report.originalFile?.mimetype || 'application/pdf', 
      report.extractedText
    ));

    res.json({ message: 'Re-analysis started', status: 'processing' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.uploadReport = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const dataBuffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
    let extractedText = '';
    
    if (req.file.mimetype === 'application/pdf') {
      try {
        const pdfData = await pdfParse(dataBuffer);
        extractedText = pdfData.text;
      } catch (e) {
        console.warn('PDF Text extraction failed, relying on AI Vision/OCR:', e.message);
        extractedText = '';
      }
    } else if (req.file.mimetype === 'text/plain') {
      extractedText = dataBuffer.toString('utf8');
    } else {
      extractedText = req.body.manualText || '';
    }

    // Validation runs inside analyzeHealthReport — no separate call needed here
    let cloudinaryUrl = null;
    try { cloudinaryUrl = await cloudinary.uploadImage(dataBuffer, 'health_reports'); }
    catch (e) { console.error('Cloudinary fail:', e.message); }

    const isPastReport = req.body.isPastReport === 'true' || req.body.isPastReport === true;
    const isPrescription = req.body.isPrescription === 'true' || req.body.isPrescription === true;

    const reportType = req.body.reportType || 'general';
    const reportData = {
      user: req.user._id,
      reportType,
      category: inferCategory(reportType, isPrescription),
      originalFile: { filename: req.file.originalname, path: cloudinaryUrl, mimetype: req.file.mimetype, cloudinaryUrl },
      extractedText,
      status: 'processing',
      isPastReport,
      isPrescription,
      reportDate: req.body.reportDate ? new Date(req.body.reportDate) : new Date(),
      aiAnalysis: { summary: 'Analysis in progress...', healthScore: 0 }
    };

    // Add prescription details if it's a prescription
    if (isPrescription) {
      reportData.prescriptionDetails = {
        doctorName: req.body.doctorName || '',
        clinicName: req.body.clinicName || '',
        prescriptionDate: req.body.reportDate ? new Date(req.body.reportDate) : new Date(),
        notes: req.body.notes || ''
      };
    }

    // Add notes if provided
    if (req.body.notes) {
      reportData.pastLabDetails = {
        notes: req.body.notes
      };
    }

    const report = await HealthReport.create(reportData);

    await cache.delete(`reports:${req.user._id}`);
    
    // Log activity
    await logActivity(req.user._id, 'UPLOAD_REPORT', 'diagnostics', { 
      reportType: req.body.reportType || 'general',
      fileName: req.file.originalname,
      reportId: report._id,
      isPastReport,
      isPrescription
    }, req);

    // Award Gamification Points for uploading a health report
    const gamificationService = require('../services/gamificationService');
    const gamificationResult = await gamificationService.awardPoints(req.user._id, 'health_checkup', 'Uploaded health report', report._id.toString()).catch(err => {
      console.error('Gamification Error:', err);
      return null;
    });

    // Respond to client
    res.status(201).json({ report, backgroundProcessing: true, gamification: gamificationResult });

    // Trigger analysis
    const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ID);
    const protocol = req.protocol || 'https';
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;

    if (isVercel) {
      await queueService.enqueueTask('process-report', {
        userId: req.user._id,
        reportId: report._id,
        fileMimetype: req.file.mimetype,
        extractedText,
        isPastReport,
        isPrescription
      }, baseUrl);
    } else {
      setImmediate(() => processReportInternal(req.user._id, report._id, req.file.mimetype, extractedText, dataBuffer, isPastReport, isPrescription));
    }

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getReports = async (req, res) => {
  try {
    const cacheKey = `reports:${req.user._id}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);

    const reports = await withTimeout(
      HealthReport.find({ user: req.user._id, status: { $ne: 'failed' } })
        .sort({ reportDate: -1, createdAt: -1 })
        .limit(100)
    );
    
    // Add isAnalyzedReport flag for frontend (HealthReport documents are always analyzed)
    const reportsWithFlag = reports.map(r => ({
      ...r.toObject(),
      isAnalyzedReport: true
    }));
    
    // Organize reports by type
    const organized = {
      currentReports: reportsWithFlag.filter(r => !r.isPastReport && !r.isPrescription),
      pastReports: reportsWithFlag.filter(r => r.isPastReport),
      prescriptions: reportsWithFlag.filter(r => r.isPrescription),
      all: reportsWithFlag
    };

    await cache.set(cacheKey, organized, 180);
    res.json(organized);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getReportById = async (req, res) => {
  try {
    const report = await withTimeout(HealthReport.findOne({ _id: req.params.id, user: req.user._id }));
    if (!report) return res.status(404).json({ message: 'Report not found' });

    let recommendedDoctors = [];
    if (report.aiAnalysis?.doctorConsultation?.recommended) {
      const specs = report.aiAnalysis.doctorConsultation.specializations || [];
      const doctors = await withTimeout(Doctor.find({
        specialization: { $in: specs.map(s => new RegExp(s, 'i')) },
        isAvailable: true
      }).sort({ rating: -1 }).limit(3));

      recommendedDoctors = doctors.map(doc => ({ ...doc.toObject(), user: { name: doc.name, email: doc.email } }));
    }

    // Add isAnalyzedReport flag + signed file URL for frontend
    const reportObj = report.toObject();
    const rawUrl = reportObj.originalFile?.cloudinaryUrl || reportObj.originalFile?.path;
    const reportWithFlag = {
      ...reportObj,
      isAnalyzedReport: true,
      signedFileUrl: rawUrl ? cloudinary.generateSignedUrl(rawUrl) : null,
    };

    res.json({ report: reportWithFlag, recommendedDoctors });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getReportStatus = async (req, res) => {
  try {
    const report = await HealthReport.findOne({ _id: req.params.id, user: req.user._id })
      .select('status aiAnalysis.summary aiAnalysis.healthScore reportType createdAt');
    if (!report) return res.status(404).json({ message: 'Report not found' });

    // 🔧 AUTO-RECOVER: If report stuck in 'processing' for >10 minutes, mark as failed
    if (report.status === 'processing') {
      const ageMs = Date.now() - new Date(report.createdAt).getTime();
      const TEN_MINUTES = 10 * 60 * 1000;
      if (ageMs > TEN_MINUTES) {
        console.warn(`⚠️ [Recovery] Report ${report._id} stuck in processing for ${Math.round(ageMs / 60000)}min. Marking as failed.`);
        await HealthReport.findByIdAndUpdate(report._id, {
          status: 'failed',
          'aiAnalysis.summary': 'Analysis timed out. Please delete this report and re-upload to try again.'
        });
        return res.json({
          id: report._id,
          status: 'failed',
          reportType: report.reportType,
          healthScore: 0,
          summary: 'Analysis timed out. Please delete this report and re-upload to try again.',
          createdAt: report.createdAt
        });
      }
    }

    res.json({
      id: report._id,
      status: report.status,
      reportType: report.reportType,
      healthScore: report.aiAnalysis?.healthScore || 0,
      summary: report.aiAnalysis?.summary || '',
      createdAt: report.createdAt
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.compareWithPrevious = async (req, res) => {
  try {
    const currentReport = await HealthReport.findOne({ _id: req.params.id, user: req.user._id });
    if (!currentReport) return res.status(404).json({ message: 'Report not found' });
    const previousReport = await HealthReport.findOne({
      user: req.user._id,
      reportType: currentReport.reportType,
      _id: { $ne: currentReport._id },
      status: 'completed',
      createdAt: { $lt: currentReport.createdAt }
    }).sort({ createdAt: -1 });
    if (!previousReport) return res.status(404).json({ message: 'No previous report found for comparison' });
    const comparison = await compareReports(currentReport, previousReport, req.user.profile);
    res.json({
      comparison,
      currentReport: { _id: currentReport._id, reportType: currentReport.reportType, createdAt: currentReport.createdAt, healthScore: currentReport.aiAnalysis?.healthScore },
      previousReport: { _id: previousReport._id, reportType: previousReport.reportType, createdAt: previousReport.createdAt, healthScore: previousReport.aiAnalysis?.healthScore }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.chatAboutReport = async (req, res) => {
  try {
    const { message, chatHistory } = req.body;
    if (!message) return res.status(400).json({ message: 'Message is required' });
    const report = await HealthReport.findOne({ _id: req.params.id, user: req.user._id });
    if (!report) return res.status(404).json({ message: 'Report not found' });
    const result = await chatWithReport(report, message, chatHistory || [], {
      userId:   req.user._id,
      reportId: report._id,
    });
    // result = { cleanText, sources } — sources are cited metrics/report refs
    res.json({ response: result.cleanText, sources: result.sources });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getHealthHistory = async (req, res) => {
  try {
    const { reportType } = req.query;
    const filter = { user: req.user._id, status: 'completed' };
    if (reportType) filter.reportType = reportType;
    const reports = await HealthReport.find(filter)
      .select('reportType createdAt aiAnalysis.healthScore aiAnalysis.metrics aiAnalysis.keyFindings')
      .sort({ createdAt: -1 }).limit(20);
    const grouped = {};
    reports.forEach(r => {
      if (!grouped[r.reportType]) grouped[r.reportType] = [];
      grouped[r.reportType].push({ _id: r._id, date: r.createdAt, healthScore: r.aiAnalysis?.healthScore, metrics: r.aiAnalysis?.metrics, keyFindings: r.aiAnalysis?.keyFindings });
    });
    res.json({ history: grouped, totalReports: reports.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getHealthTrends = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { reportType, metric } = req.query;

    const cacheKey = `trends:${userId}:${reportType || 'all'}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      // If metric requested, filter from cached full payload
      if (metric && cached.metricTrends) {
        const normalised = metric.toLowerCase().trim();
        const key = Object.keys(cached.metricTrends).find(k => k.toLowerCase() === normalised);
        return res.json({ metricTrend: key ? cached.metricTrends[key] : [], availableMetrics: cached.availableMetrics, healthScoreTrend: cached.healthScoreTrend });
      }
      return res.json(cached);
    }

    const filter = { user: req.user._id, status: 'completed', 'aiAnalysis.healthScore': { $gt: 0 } };
    if (reportType) filter.reportType = reportType;

    const reports = await HealthReport.find(filter)
      .select('reportType createdAt aiAnalysis.healthScore aiAnalysis.metrics')
      .sort({ createdAt: 1 })
      .limit(50)
      .lean();

    if (!reports.length) {
      return res.json({ healthScoreTrend: [], metricTrends: {}, availableMetrics: [] });
    }

    // Health score over time
    const healthScoreTrend = reports.map(r => ({
      date: r.createdAt,
      score: r.aiAnalysis?.healthScore || 0,
      reportId: r._id,
      reportType: r.reportType
    }));

    // Collect all metric keys across all reports (case-insensitive dedup)
    const metricKeyMap = {}; // normalised -> canonical display name
    reports.forEach(r => {
      const metrics = r.aiAnalysis?.metrics || {};
      Object.keys(metrics).forEach(k => {
        const norm = k.toLowerCase().trim();
        if (!metricKeyMap[norm]) metricKeyMap[norm] = k;
      });
    });
    const availableMetrics = Object.values(metricKeyMap).sort();

    // Build per-metric time series
    const metricTrends = {};
    Object.entries(metricKeyMap).forEach(([norm, canonical]) => {
      const series = [];
      reports.forEach(r => {
        const metrics = r.aiAnalysis?.metrics || {};
        const matchKey = Object.keys(metrics).find(k => k.toLowerCase().trim() === norm);
        if (matchKey) {
          const m = metrics[matchKey];
          series.push({
            date: r.createdAt,
            value: parseFloat(m.value) || m.value,
            unit: m.unit || '',
            status: m.status || 'normal',
            normalRange: m.normalRange || '',
            reportId: r._id,
            healthScore: r.aiAnalysis?.healthScore || 0
          });
        }
      });
      if (series.length > 0) metricTrends[canonical] = series;
    });

    const payload = { healthScoreTrend, metricTrends, availableMetrics };
    await cache.set(cacheKey, payload, 5 * 60); // 5 min TTL

    if (metric) {
      const normalised = metric.toLowerCase().trim();
      const key = Object.keys(metricTrends).find(k => k.toLowerCase() === normalised);
      return res.json({ metricTrend: key ? metricTrends[key] : [], availableMetrics, healthScoreTrend });
    }
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getDashboardData = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const cacheKey = `dashboard:${userId}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);

    // If another request for this user is already rebuilding the cache, wait
    // for it instead of firing another identical burst of DB queries
    if (dashboardInFlight.has(userId)) {
      return res.json(await dashboardInFlight.get(userId));
    }
    const buildPromise = buildDashboardData(req.user, userId, cacheKey);
    dashboardInFlight.set(userId, buildPromise);
    try {
      const dashboardData = await buildPromise;
      return res.json(dashboardData);
    } finally {
      dashboardInFlight.delete(userId);
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

async function buildDashboardData(reqUser, userId, cacheKey) {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const targetDate = new Date(todayStr);
    targetDate.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(targetDate);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const ninetyDaysAgo = new Date(targetDate);
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 89);

    const WearableData = require('../models/WearableData');

    // Run ALL 10 independent DB queries in parallel (was sequential — ~1000ms saved on Atlas)
    const [
      reports, todayLogsArr, nutritionDoc, historySummary,
      userWithLogs, wearables, weightMetrics,
      latestGlucose, latestHbA1c, totalReports,
    ] = await Promise.all([
      HealthReport.find({ user: reqUser._id, status: { $in: ['completed', 'processing'] } }).sort({ createdAt: -1 }).limit(10).lean(),
      FoodLog.find({ userId: reqUser._id, timestamp: { $gte: targetDate, $lt: tomorrow } }).lean(),
      NutritionSummary.findOne({ userId: reqUser._id, date: targetDate }).lean(),
      NutritionSummary.find({ userId: reqUser._id, date: { $gte: ninetyDaysAgo, $lte: targetDate } }).sort({ date: 1 }).lean(),
      User.findById(reqUser._id).select('alcoholLog smokeLog profile.lifestyle').lean(),
      withTimeout(WearableData.find({ user: reqUser._id }).lean()),
      withTimeout(HealthMetric.find({ userId: reqUser._id, type: 'weight', recordedAt: { $gte: ninetyDaysAgo, $lte: targetDate } }).sort({ recordedAt: 1 }).lean()),
      HealthMetric.findOne({ userId: reqUser._id, type: 'blood_sugar' }).sort({ recordedAt: -1 }).lean(),
      HealthMetric.findOne({ userId: reqUser._id, type: 'hba1c' }).sort({ recordedAt: -1 }).lean(),
      HealthReport.countDocuments({ user: reqUser._id }),
    ]);

    // Process reports
    const processingReport = reports.find(r => r.status === 'processing');
    const completedReports = reports.filter(r => r.status === 'completed');
    const healthScores = completedReports.map(r => ({ date: r.createdAt, score: r.aiAnalysis?.healthScore || 0, type: r.reportType })).reverse();
    const latestReport = completedReports[0];
    const reportTypeCounts = {};
    reports.forEach(r => { reportTypeCounts[r.reportType] = (reportTypeCounts[r.reportType] || 0) + 1; });
    const latestComparison = latestReport?.comparison?.data
      ? { ...latestReport.comparison.data, previousReportDate: latestReport.comparison.previousReportDate, currentReportDate: latestReport.createdAt }
      : null;

    // Nutrition totals
    const realTimeTotals = todayLogsArr.reduce((acc, log) => {
      const nut = log.totalNutrition || {};
      acc.calories += Number(nut.calories) || 0;
      acc.protein += Number(nut.protein) || 0;
      acc.carbs += Number(nut.carbs) || 0;
      acc.fats += Number(nut.fats) || 0;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fats: 0 });

    const finalNutrition = {
      totalCalories: realTimeTotals.calories,
      totalProtein: realTimeTotals.protein,
      totalCarbs: realTimeTotals.carbs,
      totalFats: realTimeTotals.fats,
      ...(nutritionDoc || { waterIntake: 0 }),
    };

    const alcoholPlain = toPlainAlcoholLog(userWithLogs?.alcoholLog);
    const alcoholSummary = getAlcoholSummary(alcoholPlain);

    // Pre-build O(N) lookup Maps — eliminates O(90 × wearables × entries) nested search
    const nutritionByDate = {};
    historySummary.forEach(h => { nutritionByDate[h.date.toISOString().split('T')[0]] = h; });

    const weightByDate = {};
    weightMetrics.forEach(m => { weightByDate[new Date(m.recordedAt).toISOString().split('T')[0]] = m.value; });

    const stepsByDate = {};
    const sleepByDate = {};
    for (const w of wearables) {
      w.dailyMetrics?.forEach(m => {
        if (m.date) {
          const d = new Date(m.date).toISOString().split('T')[0];
          stepsByDate[d] = (stepsByDate[d] || 0) + (m.steps || 0);
        }
      });
      w.sleepData?.forEach(s => {
        if (s.date) {
          const d = new Date(s.date).toISOString().split('T')[0];
          sleepByDate[d] = (sleepByDate[d] || 0) + (s.totalSleepMinutes || 0) / 60;
        }
      });
    }

    // Build 90-day history — O(90) flat loop instead of O(90 × N × M)
    const history = [];
    let lastKnownWeight = reqUser.profile?.weight || 70;
    for (let i = 0; i < 90; i++) {
      const d = new Date(ninetyDaysAgo);
      d.setUTCDate(d.getUTCDate() + i);
      const dStr = d.toISOString().split('T')[0];
      if (weightByDate[dStr]) lastKnownWeight = weightByDate[dStr];
      const nutrition = nutritionByDate[dStr];
      const alcoholDay = alcoholPlain[dStr];
      history.push({
        date: dStr,
        calories: dStr === todayStr ? realTimeTotals.calories : (nutrition?.totalCalories || 0),
        steps: stepsByDate[dStr] || 0,
        sleep: sleepByDate[dStr] || 0,
        weight: lastKnownWeight,
        water: dStr === todayStr ? (finalNutrition.waterIntake || 0) : (nutrition?.waterIntake || 0),
        alcohol: alcoholDay?.count || 0,
        alcoholUnits: alcoholDay?.units || 0,
      });
    }

    const calorieGoal = reqUser.nutritionGoal?.calorieGoal || 2100;
    // Trim the user object sent to the frontend — strip password/version/internal fields
    const { password, __v, ...trimmedUser } = reqUser.toObject();
    const dashboardData = {
      user: trimmedUser,
      healthScores, latestAnalysis: latestReport?.aiAnalysis, latestReportId: latestReport?._id, processingReport, latestComparison,
      totalReports, recentReports: reports.slice(0, 5), reportTypeCounts, history,
      stepsToday: history[history.length - 1]?.steps || 0,
      sleepToday: history[history.length - 1]?.sleep || 0,
      goals: { steps: 10000, sleep: 8, water: 8, weight: reqUser.nutritionGoal?.targetWeight || 70, calories: calorieGoal, protein: reqUser.nutritionGoal?.proteinGoal || 150, carbs: reqUser.nutritionGoal?.carbsGoal || 200, fats: reqUser.nutritionGoal?.fatGoal || 65 },
      alcoholToday: alcoholSummary.today, alcoholTodayUnits: alcoholSummary.todayUnits,
      alcohol7DayAvg: alcoholSummary.avg7, alcoholSummary,
      streakDays: reqUser.streakDays || 0,
      vitals: {
        glucose: latestGlucose ? { value: latestGlucose.value, recordedAt: latestGlucose.recordedAt } : null,
        hba1c: latestHbA1c ? { value: latestHbA1c.value, recordedAt: latestHbA1c.recordedAt } : null,
      },
      nutritionData: { totalCalories: finalNutrition.totalCalories || 0, calorieGoal, protein: finalNutrition.totalProtein || 0, carbs: finalNutrition.totalCarbs || 0, totalFats: finalNutrition.totalFats || 0, todayLogs: todayLogsArr || [] },
    };

    await cache.set(cacheKey, dashboardData, 300);
    return dashboardData;
}

exports.getMetricInfo = async (req, res) => {
  try {
    const { metricName, metricValue, normalRange, unit } = req.body;
    if (!metricName) return res.status(400).json({ message: 'Metric name is required' });

    // Cache key by metric + status (value doesn't matter for the explanation)
    const cacheKey = `metricInfo:${metricName.toLowerCase().replace(/\s+/g, '_')}:${unit || 'na'}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json({ metricInfo: cached });

    const metricInfo = await generateMetricInfo(metricName, metricValue, normalRange, unit, {
      userId: req.user._id,
    });

    // Cache for 7 days (604800s) — metric explanations don't change
    if (metricInfo) cache.set(cacheKey, metricInfo, 604800);

    res.json({ metricInfo });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteReport = async (req, res) => {
  try {
    const report = await HealthReport.findOne({ _id: req.params.id, user: req.user._id });
    if (!report) return res.status(404).json({ message: 'Report not found' });
    if (report.originalFile?.path && fs.existsSync(report.originalFile.path)) fs.unlinkSync(report.originalFile.path);
    await HealthReport.deleteOne({ _id: req.params.id });
    const uid = req.user._id.toString();
    cache.delete(`reports:${uid}`);
    cache.delete(`dashboard:${uid}`);
    cache.delete(`trends:${uid}:all`);
    cache.delete(`trends:${uid}:Blood Test`);
    cache.delete(`trends:${uid}:undefined`);
    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.aiChat = async (req, res) => {
  try {
    const { query, conversationHistory, message, chatHistory } = req.body;
    const finalQuery = query || message;
    if (!finalQuery) return res.status(400).json({ success: false, message: 'Query or message is required' });

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey || !String(anthropicKey).startsWith('sk-ant')) {
      return res.status(503).json({
        success: false,
        message: 'AI coach is not configured on the server',
        code: 'AI_NOT_CONFIGURED'
      });
    }

    const finalHistory = conversationHistory || chatHistory || [];
    const latestReport = await HealthReport.findOne({ user: req.user._id, status: 'completed' }).sort({ createdAt: -1 });
    const systemPrompt = `Helpful health awareness assistant for ${req.user.name}. Context from latest report: ${latestReport?.aiAnalysis?.summary || 'None'}. Reply in plain text only — no markdown, no asterisks, no hashtags.`;

    const { makeAnthropicRequest, CLAUDE_HAIKU_MODEL } = require('../services/aiService');
    const messages = [
      { role: 'system', content: systemPrompt },
      ...finalHistory.slice(-5).map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '')
      })),
      { role: 'user', content: finalQuery }
    ];

    const text = await makeAnthropicRequest(messages, 600, CLAUDE_HAIKU_MODEL, {
      feature: 'ai_chat',
      userId:  req.user._id,
    });
    if (!text || !String(text).trim()) {
      return res.status(502).json({ success: false, message: 'Empty response from AI' });
    }
    res.json({ success: true, response: text.trim() });
  } catch (error) {
    console.error('aiChat error:', error.message);
    res.status(500).json({ success: false, message: error.message || 'AI request failed' });
  }
};


exports.saveChallengeData = async (req, res) => {
  try {
    const { challengeData } = req.body;
    const user = await User.findById(req.user._id);
    user.challengeData = challengeData;
    user.markModified('challengeData');
    // Set start date on first save if not already set
    if (!user.challengeStartDate) {
      user.challengeStartDate = new Date();
    }
    await user.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getChallengeData = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('challengeData streakDays challengeStartDate');
    res.json({
      challengeData: user.challengeData || {},
      streakDays: user.streakDays || 0,
      challengeStartDate: user.challengeStartDate || null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getReportComparison = async (req, res) => {
  try {
    const reports = await HealthReport.find({ user: req.user._id, status: 'completed' }).sort({ createdAt: -1 }).limit(10);
    if (reports.length === 0) return res.json({ hasData: false });
    res.json({ hasData: true, reports });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.syncDailyProgress = async (req, res) => {
  try {
    const { date, totalScore, completedTasks } = req.body;
    const update = { updatedAt: new Date() };
    if (totalScore !== undefined) update.totalScore = totalScore;
    if (completedTasks !== undefined) update.completedTasks = completedTasks;
    await DailyProgress.findOneAndUpdate(
      { userId: req.user._id, date },
      update,
      { upsert: true, new: true }
    );
    await cache.delete(`dashboard:${req.user._id}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getDailyProgress = async (req, res) => {
  try {
    const progress = await DailyProgress.findOne({ userId: req.user._id, date: req.params.date });
    res.json({ success: true, progress });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getHealthDNA = async (req, res) => {
  try {
    const cacheKey = `health_dna:${req.user._id}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);

    // 1. Gather all data
    const [reports, vitals, nutrition] = await Promise.all([
      HealthReport.find({ user: req.user._id, status: 'completed' }).sort({ createdAt: -1 }),
      HealthMetric.find({ userId: req.user._id }).sort({ recordedAt: -1 }).limit(10),
      NutritionSummary.find({ userId: req.user._id }).sort({ date: -1 }).limit(7)
    ]);

    // 2. Aggregate Lab Metrics (Take the latest result for each unique key)
    const aggregatedMetrics = {};
    reports.forEach(report => {
      if (report.aiAnalysis?.metrics) {
        Object.entries(report.aiAnalysis.metrics).forEach(([key, val]) => {
          if (!aggregatedMetrics[key]) {
            aggregatedMetrics[key] = val;
          }
        });
      }
    });

    // 3. Prepare Trends for AI
    const alcoholSummary = getAlcoholSummary(req.user.alcoholLog || {});

    const trends = {
      vitals: vitals.map(v => ({ type: v.type, value: v.value, unit: v.unit, date: v.recordedAt })),
      nutritionAverages: nutrition.reduce((acc, n) => {
        acc.calories += n.totalCalories || 0;
        acc.protein += n.totalProtein || 0;
        acc.water += n.waterIntake || 0;
        return acc;
      }, { calories: 0, protein: 0, water: 0 }),
      alcohol: alcoholSummary
    };
    if (nutrition.length > 0) {
      trends.nutritionAverages.calories /= nutrition.length;
      trends.nutritionAverages.protein /= nutrition.length;
      trends.nutritionAverages.water /= nutrition.length;
    }

    // 4. Generate DNA with AI
    const dna = await require('../services/aiService').generateHealthDNA(
      req.user.toObject(),
      aggregatedMetrics,
      trends
    );

    if (!dna) throw new Error('Failed to generate health identity');

    await cache.set(cacheKey, dna, 86400); // 24 hour cache
    res.json(dna);

  } catch (error) {
    console.error('getHealthDNA error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getVitalsInsights = async (req, res) => {
  try {
    res.json({ success: true, insights: "Health trends looking good!" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const toPlainSmokeLog = (raw) => {
  if (!raw) return {};
  if (raw instanceof Map) return Object.fromEntries(raw);
  if (typeof raw.toObject === 'function') return raw.toObject();
  return typeof raw === 'object' ? { ...raw } : {};
};

const sanitizeSmokeLog = (raw) => {
  const input = toPlainSmokeLog(raw);
  const out = {};

  for (const [key, val] of Object.entries(input)) {
    if (!DATE_KEY_RE.test(key) || !val || typeof val !== 'object') continue;

    const sessions = Array.isArray(val.sessions)
      ? val.sessions.slice(0, 200).map((s) => ({
          time: String(s?.time || new Date().toISOString()),
          count: Math.max(1, Number(s?.count) || 1),
          trigger: s?.trigger ? String(s.trigger) : null,
          id: s?.id ? String(s.id) : String(s?.time || Date.now())
        }))
      : [];

    const countFromSessions = sessions.reduce((sum, s) => sum + (s.count || 1), 0);
    const count = Math.max(0, Number(val.count) || countFromSessions);

    out[key] = {
      count,
      resistedCount: Math.max(0, Number(val.resistedCount) || 0),
      sessions
    };
  }

  return out;
};

exports.saveSmokeLog = async (req, res) => {
  try {
    const smokeLog = sanitizeSmokeLog(req.body?.smokeLog);
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { smokeLog } },
      { new: true, runValidators: false }
    ).select('smokeLog');

    if (!user) return res.status(404).json({ message: 'User not found' });
    await cache.delete(`dashboard:${req.user._id}`);
    res.json({ success: true, smokeLog: toPlainSmokeLog(user.smokeLog) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSmokeLog = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('smokeLog');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ success: true, smokeLog: sanitizeSmokeLog(user.smokeLog) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.saveAlcoholLog = async (req, res) => {
  try {
    const alcoholLog = sanitizeAlcoholLog(req.body?.alcoholLog);
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { alcoholLog } },
      { new: true, runValidators: false }
    ).select('alcoholLog');

    if (!user) return res.status(404).json({ message: 'User not found' });
    await cache.delete(`dashboard:${req.user._id}`);
    res.json({ success: true, alcoholLog: toPlainAlcoholLog(user.alcoholLog) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAlcoholLog = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('alcoholLog');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ success: true, alcoholLog: sanitizeAlcoholLog(user.alcoholLog) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Returns a fresh signed URL for a report's original file (1hr validity, cached 55min)
exports.getReportFileUrl = async (req, res) => {
  try {
    const report = await HealthReport.findOne({ _id: req.params.id, user: req.user._id })
      .select('originalFile');
    if (!report) return res.status(404).json({ message: 'Report not found' });

    const rawUrl = report.originalFile?.cloudinaryUrl || report.originalFile?.path;
    if (!rawUrl) return res.status(404).json({ message: 'No file stored for this report' });

    const signedUrl = cloudinary.generateSignedUrl(rawUrl);
    if (!signedUrl) return res.status(500).json({ message: 'Could not generate signed URL' });

    res.json({ url: signedUrl, expiresIn: '1 hour' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

