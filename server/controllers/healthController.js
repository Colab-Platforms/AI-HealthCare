const HealthReport = require('../models/HealthReport');
const FoodLog = require('../models/FoodLog');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const HealthGoal = require('../models/HealthGoal');
const { analyzeHealthReport, compareReports, chatAboutReport, generateMetricInfo, generateVitalsInsights } = require('../services/aiService');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const NutritionSummary = require('../models/NutritionSummary');
const DailyProgress = require('../models/DailyProgress');
const cache = require('../utils/cache');
const cloudinary = require('../services/cloudinary');
const emailService = require('../services/emailService');
const queueService = require('../services/queueService');
const HealthMetric = require('../models/HealthMetric');
const PersonalizedDietPlan = require('../models/PersonalizedDietPlan');

const withTimeout = (query, timeoutMs = 45000) => {
  return query.maxTimeMS(timeoutMs);
};

/**
 * 🚀 BACKGROUND ANALYSIS PROCESSOR
 */
async function processReportInternal(userId, reportId, fileMimetype, extractedText, dataBuffer = null) {
  console.log(`🔄 [BG] Starting internal logic for report ${reportId}...`);
  try {
    const userDoc = await User.findById(userId);
    if (!userDoc) throw new Error('User not found');

    let aiAnalysis;
    if (fileMimetype === 'application/pdf') {
      aiAnalysis = await analyzeHealthReport(extractedText, userDoc);
    } else {
      aiAnalysis = await analyzeHealthReport(null, userDoc, {
        buffer: dataBuffer,
        mimetype: fileMimetype
      });
    }

    const updatedReport = await HealthReport.findById(reportId);
    if (!updatedReport) return;

    updatedReport.aiAnalysis = aiAnalysis;
    updatedReport.status = 'completed';

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
    console.log(`✅ [BG] Report saved. Metrics count: ${Object.keys(aiAnalysis.metrics || {}).length}`);

    // Invalidate caches
    await cache.delete(`reports:${userId}`);
    await cache.delete(`dashboard:${userId}`);

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
        const comparisonData = await compareReports(updatedReport, prev);
        updatedReport.comparison = {
          previousReportId: prev._id,
          previousReportDate: prev.createdAt,
          data: comparisonData
        };
        await updatedReport.save();
      }
    } catch (e) { console.warn('Comparison failed:', e.message); }

    // Email Notification
    try { await emailService.sendReportAnalysisComplete(userDoc.email, userDoc.name, reportId); }
    catch (e) { console.warn('Email failed:', e.message); }

    console.log(`✅ [BG] Analysis complete for ${reportId}`);

    // 🚀 Auto-trigger diet plan generation after successful report analysis
    try {
      const PersonalizedDietPlan = require('../models/PersonalizedDietPlan');
      const existingPlan = await PersonalizedDietPlan.findOne({ userId, isActive: true });
      if (!existingPlan) {
        console.log('[BG] No active diet plan found. Auto-generating based on new report...');
        // Trigger diet generation in background (non-blocking)
        const { generateDietAfterReport } = require('./dietRecommendationController');
        if (generateDietAfterReport) {
          setImmediate(() => generateDietAfterReport(userId).catch(e => console.warn('[BG] Auto-diet failed:', e.message)));
        }
      }
    } catch (dietErr) {
      console.warn('[BG] Auto-diet trigger skipped:', dietErr.message);
    }
  } catch (error) {
    console.error(`❌ [BG] Analysis failed for ${reportId}:`, error.message);
    await HealthReport.findByIdAndUpdate(reportId, {
      status: 'failed',
      'aiAnalysis.summary': `Error: ${error.message}`
    });
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

exports.uploadReport = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const dataBuffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
    let extractedText = '';
    
    if (req.file.mimetype === 'application/pdf') {
      const pdfData = await pdfParse(dataBuffer);
      extractedText = pdfData.text;
    } else {
      extractedText = req.body.manualText || 'Vision analysis requested';
    }

    let cloudinaryUrl = null;
    try { cloudinaryUrl = await cloudinary.uploadImage(dataBuffer, 'health_reports'); }
    catch (e) { console.error('Cloudinary fail:', e.message); }

    const report = await HealthReport.create({
      user: req.user._id,
      reportType: req.body.reportType || 'general',
      originalFile: { filename: req.file.originalname, path: cloudinaryUrl, mimetype: req.file.mimetype, cloudinaryUrl },
      extractedText,
      status: 'processing',
      aiAnalysis: { summary: 'Analysis in progress...', healthScore: 0 }
    });

    await cache.delete(`reports:${req.user._id}`);
    
    // Respond to client
    res.status(201).json({ report, backgroundProcessing: true });

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
        extractedText
      }, baseUrl);
    } else {
      setImmediate(() => processReportInternal(req.user._id, report._id, req.file.mimetype, extractedText));
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

    const reports = await withTimeout(HealthReport.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50));
    await cache.set(cacheKey, reports, 180);
    res.json(reports);
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

    res.json({ report, recommendedDoctors });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getReportStatus = async (req, res) => {
  try {
    const report = await HealthReport.findOne({ _id: req.params.id, user: req.user._id })
      .select('status aiAnalysis.summary aiAnalysis.healthScore reportType createdAt');
    if (!report) return res.status(404).json({ message: 'Report not found' });
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
    const response = await chatAboutReport(report, message, chatHistory || []);
    res.json({ response });
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

exports.getDashboardData = async (req, res) => {
  try {
    const cacheKey = `dashboard:${req.user._id}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);

    const reports = await HealthReport.find({ user: req.user._id, status: { $in: ['completed', 'processing'] } }).sort({ createdAt: -1 }).limit(10);
    const processingReport = reports.find(r => r.status === 'processing');
    const completedReports = reports.filter(r => r.status === 'completed');
    const healthScores = completedReports.map(r => ({ date: r.createdAt, score: r.aiAnalysis?.healthScore || 0, type: r.reportType })).reverse();
    const latestReport = completedReports[0];

    const reportTypeCounts = {};
    reports.forEach(r => { reportTypeCounts[r.reportType] = (reportTypeCounts[r.reportType] || 0) + 1; });

    let latestComparison = null;
    if (latestReport && latestReport.comparison && latestReport.comparison.data) {
      latestComparison = { ...latestReport.comparison.data, previousReportDate: latestReport.comparison.previousReportDate, currentReportDate: latestReport.createdAt };
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const targetDate = new Date(todayStr);
    targetDate.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(targetDate);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const todayLogsArr = await FoodLog.find({ userId: req.user._id, timestamp: { $gte: targetDate, $lt: tomorrow } });
    const realTimeTotals = todayLogsArr.reduce((acc, log) => {
      const nut = log.totalNutrition || { calories: 0, protein: 0, carbs: 0, fats: 0 };
      acc.calories += Number(nut.calories) || 0;
      acc.protein += Number(nut.protein) || 0;
      acc.carbs += Number(nut.carbs) || 0;
      acc.fats += Number(nut.fats) || 0;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fats: 0 });

    const nutritionDoc = await NutritionSummary.findOne({ userId: req.user._id, date: targetDate });
    const nutritionDataSummary = nutritionDoc ? nutritionDoc.toObject() : { waterIntake: 0 };
    const finalNutrition = { 
      totalCalories: realTimeTotals.calories, 
      totalProtein: realTimeTotals.protein, 
      totalCarbs: realTimeTotals.carbs, 
      totalFats: realTimeTotals.fats, 
      ...nutritionDataSummary 
    };

    const ninetyDaysAgo = new Date(targetDate);
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 89);
    const historySummary = await NutritionSummary.find({ userId: req.user._id, date: { $gte: ninetyDaysAgo, $lte: targetDate } }).sort({ date: 1 });

    const WearableData = require('../models/WearableData');
    const HealthMetric = require('../models/HealthMetric');
    const wearables = await withTimeout(WearableData.find({ user: req.user._id }));
    const weightMetrics = await withTimeout(HealthMetric.find({ userId: req.user._id, type: 'weight', recordedAt: { $gte: ninetyDaysAgo, $lte: targetDate } }).sort({ recordedAt: 1 }));
    
    const history = [];
    for (let i = 0; i < 90; i++) {
        const d = new Date(ninetyDaysAgo); d.setUTCDate(d.getUTCDate() + i); const dStr = d.toISOString().split('T')[0];
        const nutrition = historySummary.find(h => h.date.toISOString().split('T')[0] === dStr);
        let steps = 0, sleep = 0;
        for (const w of wearables) {
            const daily = w.dailyMetrics?.find(m => m.date && new Date(m.date).toISOString().split('T')[0] === dStr);
            if (daily) steps += daily.steps || 0;
            const sleepDay = w.sleepData?.find(s => s.date && new Date(s.date).toISOString().split('T')[0] === dStr);
            if (sleepDay) sleep += (sleepDay.totalSleepMinutes || 0) / 60;
        }
        const currentDayWeightLogs = weightMetrics.filter(m => new Date(m.recordedAt).toISOString().split('T')[0] === dStr);
        let dayWeight = history[i-1]?.weight || req.user.profile?.weight || 70;
        if (currentDayWeightLogs.length > 0) dayWeight = currentDayWeightLogs[currentDayWeightLogs.length - 1].value;
        history.push({ date: dStr, calories: dStr === todayStr ? realTimeTotals.calories : (nutrition?.totalCalories || 0), steps, sleep, weight: dayWeight, water: dStr === todayStr ? (finalNutrition.waterIntake || 0) : (nutrition?.waterIntake || 0) });
    }

    const calorieGoal = req.user.nutritionGoal?.calorieGoal || 2100;
    const dashboardData = {
      user: { ...req.user.toObject(), password: undefined },
      healthScores, latestAnalysis: latestReport?.aiAnalysis, latestReportId: latestReport?._id, processingReport, latestComparison,
      totalReports: await HealthReport.countDocuments({ user: req.user._id }), recentReports: reports.slice(0, 5), reportTypeCounts, history,
      stepsToday: history[history.length-1]?.steps || 0, sleepToday: history[history.length-1]?.sleep || 0,
      goals: { steps: 10000, sleep: 8, weight: req.user.nutritionGoal?.targetWeight || 70, calories: calorieGoal, protein: req.user.nutritionGoal?.proteinGoal || 150, carbs: req.user.nutritionGoal?.carbsGoal || 200, fats: req.user.nutritionGoal?.fatGoal || 65 },
      streakDays: req.user.streakDays || 0,
      vitals: { glucose: null, hba1c: null },
      nutritionData: { totalCalories: finalNutrition.totalCalories || 0, calorieGoal, protein: finalNutrition.totalProtein || 0, carbs: finalNutrition.totalCarbs || 0, totalFats: finalNutrition.totalFats || 0, todayLogs: todayLogsArr || [] }
    };

    try {
      const notificationService = require('../services/notificationService');
      notificationService.triggerUserStartupNotifications(req.user).catch(e => {});
    } catch (e) {}

    await cache.set(cacheKey, dashboardData, 120);
    res.json(dashboardData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMetricInfo = async (req, res) => {
  try {
    const { metricName, metricValue, normalRange, unit } = req.body;
    if (!metricName) return res.status(400).json({ message: 'Metric name is required' });
    const metricInfo = await generateMetricInfo(metricName, metricValue, normalRange, unit);
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
    cache.delete(`reports:${req.user._id}`);
    cache.delete(`dashboard:${req.user._id}`);
    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.aiChat = async (req, res) => {
  try {
    const { query, conversationHistory } = req.body;
    if (!query) return res.status(400).json({ message: 'Query is required' });
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const latestReport = await HealthReport.findOne({ user: req.user._id, status: 'completed' }).sort({ createdAt: -1 });
    let systemPrompt = `Helpful medical AI. User: ${req.user.name}. Context: ${latestReport?.aiAnalysis?.summary || 'None'}`;
    const userMessages = (conversationHistory || []).slice(-5).map(m => ({ role: m.role, content: m.content }));
    userMessages.push({ role: 'user', content: query });
    const axios = require('axios');
    const response = await axios.post('https://api.anthropic.com/v1/messages', { model: 'claude-3-5-sonnet-latest', system: systemPrompt, messages: userMessages, max_tokens: 1500 }, { headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, timeout: 45000 });
    res.json({ success: true, response: response.data.content[0].text });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.saveChallengeData = async (req, res) => {
  try {
    const { challengeData } = req.body;
    const user = await User.findById(req.user._id);
    user.challengeData = challengeData;
    user.markModified('challengeData');
    await user.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getChallengeData = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('challengeData streakDays challengeStartDate');
    res.json({ challengeData: user.challengeData || {}, streakDays: user.streakDays || 0 });
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
    const { date, totalScore } = req.body;
    await DailyProgress.findOneAndUpdate({ userId: req.user._id, date }, { totalScore }, { upsert: true });
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
    const trends = {
      vitals: vitals.map(v => ({ type: v.type, value: v.value, unit: v.unit, date: v.recordedAt })),
      nutritionAverages: nutrition.reduce((acc, n) => {
        acc.calories += n.totalCalories || 0;
        acc.protein += n.totalProtein || 0;
        acc.water += n.waterIntake || 0;
        return acc;
      }, { calories: 0, protein: 0, water: 0 })
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
