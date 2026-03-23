const HealthReport = require('../models/HealthReport');
const FoodLog = require('../models/FoodLog');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const HealthGoal = require('../models/HealthGoal');
const { analyzeHealthReport, compareReports, chatWithReport, generateMetricInfo, generateVitalsInsights } = require('../services/aiService');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const NutritionSummary = require('../models/NutritionSummary');
const DailyProgress = require('../models/DailyProgress');
const cache = require('../utils/cache');
const cloudinary = require('../services/cloudinary');

// Helper function to add timeout to all queries for Vercel compatibility
const withTimeout = (query, timeoutMs = 30000) => {
  return query.maxTimeMS(timeoutMs);
};

exports.uploadReport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a file' });
    }

    let aiAnalysis;
    let extractedText = '';
    let cloudinaryUrl = null;
    try {
      const dataBuffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);

      if (!dataBuffer) {
        throw new Error('No file data found to process');
      }

      // 1. Text extraction (fast)
      if (req.file.mimetype === 'application/pdf') {
        const pdfData = await pdfParse(dataBuffer);
        extractedText = pdfData.text;
      } else {
        extractedText = req.body.manualText || 'Image report - vision analysis requested';
      }

      if (!extractedText || extractedText.trim().length < 20) {
        return res.status(400).json({ message: 'Could not extract text from report. Please provide details manually.' });
      }

      // 2. AI analysis and Cloudinary upload
      console.log('🔄 Starting AI analysis and Cloudinary upload...');

      // On Vercel, run sequentially to avoid ECONNRESET due to bandwidth/memory limits
      if (process.env.VERCEL) {
        console.log('⚡ Vercel detected: Running tasks sequentially for stability');
        cloudinaryUrl = await cloudinary.uploadImage(dataBuffer, 'health_reports');

        if (req.file.mimetype === 'application/pdf') {
          aiAnalysis = await analyzeHealthReport(extractedText, req.user);
        } else {
          aiAnalysis = await analyzeHealthReport(null, req.user, {
            buffer: dataBuffer,
            mimetype: req.file.mimetype
          });
        }
      } else {
        // Local: Run in parallel for speed
        const uploadPromise = cloudinary.uploadImage(dataBuffer, 'health_reports');
        let aiPromise;
        if (req.file.mimetype === 'application/pdf') {
          aiPromise = analyzeHealthReport(extractedText, req.user);
        } else {
          aiPromise = analyzeHealthReport(null, req.user, {
            buffer: dataBuffer,
            mimetype: req.file.mimetype
          });
        }
        const [uploadedUrl, analysisResult] = await Promise.all([uploadPromise, aiPromise]);
        cloudinaryUrl = uploadedUrl;
        aiAnalysis = analysisResult;
      }

      console.log('✅ Tasks complete | Score:', aiAnalysis.healthScore);
    } catch (error) {
      console.error('Processing error:', error.message);
      return res.status(500).json({ message: `Analysis failed: ${error.message}` });
    }

    // 3. Create the report record
    const report = await HealthReport.create({
      user: req.user._id,
      reportType: req.body.reportType || 'general',
      originalFile: {
        filename: req.file.originalname,
        path: cloudinaryUrl,
        mimetype: req.file.mimetype,
        cloudinaryUrl: cloudinaryUrl
      },
      extractedText,
      status: 'completed',
      aiAnalysis
    });


    // Extract and save metadata from AI analysis
    if (aiAnalysis.reportDate) {
      try { report.reportDate = new Date(aiAnalysis.reportDate); }
      catch (e) { report.reportDate = new Date(); }
    } else { report.reportDate = new Date(); }

    if (aiAnalysis.patientName) report.patientName = aiAnalysis.patientName.trim();
    if (aiAnalysis.patientAge) report.patientAge = Number(aiAnalysis.patientAge);
    if (aiAnalysis.patientGender) report.patientGender = aiAnalysis.patientGender.trim();

    report.status = 'completed';
    await report.save();

    // Update user health score
    if (aiAnalysis.healthScore) {
      req.user.healthMetrics = {
        ...req.user.healthMetrics,
        healthScore: aiAnalysis.healthScore,
        lastCheckup: new Date()
      };
      await req.user.save();
    }

    // Invalidate cache for this user
    cache.delete(`reports:${req.user._id}`);
    cache.delete(`dashboard:${req.user._id}`);

    // 🆕 AUTO-UPDATE PERSONALIZED DIET PLAN FROM REPORT
    if (aiAnalysis.dietPlan) {
      try {
        const PersonalizedDietPlan = require('../models/PersonalizedDietPlan');

        // Map report diet plan to personalized diet plan structure
        const mapMealItems = (items) => {
          if (!Array.isArray(items)) return [];
          return items.map(item => ({
            name: typeof item === 'string' ? item : (item.meal || 'Healthy Meal'),
            description: item.tip || '',
            benefits: Array.isArray(item.nutrients) ? item.nutrients.join(', ') : '',
            calories: Number(item.calories) || 0,
            protein: Number(item.protein) || 0,
            carbs: Number(item.carbs) || 0,
            fats: Number(item.fats) || 0
          }));
        };

        const dailyCalTarget = aiAnalysis.dietPlan.dailyCalorieTarget || 2000;

        const newDietPlan = new PersonalizedDietPlan({
          userId: req.user._id,
          isActive: true,
          dailyCalorieTarget: dailyCalTarget,
          nutritionGoals: {
            dailyCalorieTarget: dailyCalTarget,
            macroTargets: {
              protein: req.user.nutritionGoal?.proteinGoal || 150,
              carbs: req.user.nutritionGoal?.carbsGoal || 200,
              fats: req.user.nutritionGoal?.fatGoal || 65
            }
          },
          mealPlan: {
            breakfast: mapMealItems(aiAnalysis.dietPlan.breakfast),
            midMorningSnack: mapMealItems(aiAnalysis.dietPlan.midMorningSnack || []),
            lunch: mapMealItems(aiAnalysis.dietPlan.lunch),
            eveningSnack: mapMealItems(aiAnalysis.dietPlan.eveningSnack || aiAnalysis.dietPlan.snacks || []),
            dinner: mapMealItems(aiAnalysis.dietPlan.dinner)
          },
          avoidSuggestions: aiAnalysis.dietPlan.foodsToLimit || [],
          lifestyleRecommendations: aiAnalysis.recommendations?.lifestyle || [],
          inputData: {
            hasReports: true,
            bmiGoal: req.user.nutritionGoal?.goal || 'maintain',
            reportId: report._id
          },
          generatedAt: new Date(),
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });

        await newDietPlan.save();
        console.log('✅ Personalized diet plan saved successfully:', newDietPlan._id);

        // ONLY DEACTIVATE OLD PLANS AFTER NEW ONE IS SAVED SUCCESSFULLY
        await PersonalizedDietPlan.updateMany(
          { userId: req.user._id, isActive: true, _id: { $ne: newDietPlan._id } },
          { isActive: false }
        );
        console.log('✅ Older diet plans deactivated');
      } catch (dpError) {
        console.error('⚠️ Failed to update personalized diet plan:', dpError.message);
      }
    }

    // 🆕 AUTO-COMPARE WITH PREVIOUS REPORT
    // Skip on Vercel to avoid timeout (this triggers another expensive AI call)
    let comparisonData = null;
    if (!process.env.VERCEL) {
      try {
        const previousReport = await HealthReport.findOne({
          user: req.user._id,
          reportType: report.reportType,
          _id: { $ne: report._id },
          status: 'completed',
          createdAt: { $lt: report.createdAt }
        }).sort({ createdAt: -1 });

        if (previousReport && previousReport.aiAnalysis) {
          console.log('🔄 Generating comparison with previous report...');
          comparisonData = await compareReports(report, previousReport);
          report.comparison = {
            previousReportId: previousReport._id,
            previousReportDate: previousReport.createdAt,
            data: comparisonData
          };
          await report.save();
          console.log('✅ Comparison saved');
        }
      } catch (compError) {
        console.error('⚠️ Comparison failed (non-critical):', compError.message);
      }
    } else {
      console.log('⚡ Skipping auto-comparison on Vercel to save time');
    }

    // Find recommended doctors from platform
    let recommendedDoctors = [];
    if (aiAnalysis.doctorConsultation?.recommended && aiAnalysis.doctorConsultation?.specializations?.length > 0) {
      const doctors = await Doctor.find({
        specialization: { $in: aiAnalysis.doctorConsultation.specializations.map(s => new RegExp(s, 'i')) },
        isAvailable: true
      })
        .sort({ rating: -1 })
        .limit(3);

      recommendedDoctors = doctors.map(doc => ({
        ...doc.toObject(),
        user: { name: doc.name, email: doc.email }
      }));
    }

    res.status(201).json({ report, recommendedDoctors });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getReports = async (req, res) => {
  try {
    const cacheKey = `reports:${req.user._id}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    const reports = await withTimeout(HealthReport.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50));

    cache.set(cacheKey, reports, 180); // Cache for 3 minutes
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getReportById = async (req, res) => {
  try {
    const report = await withTimeout(HealthReport.findOne({ _id: req.params.id, user: req.user._id }));
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Find recommended doctors
    let recommendedDoctors = [];
    if (report.aiAnalysis?.doctorConsultation?.recommended) {
      const specs = report.aiAnalysis.doctorConsultation.specializations || [];
      const doctors = await withTimeout(Doctor.find({
        specialization: { $in: specs.map(s => new RegExp(s, 'i')) },
        isAvailable: true
      })
        .sort({ rating: -1 })
        .limit(3));

      recommendedDoctors = doctors.map(doc => ({
        ...doc.toObject(),
        user: { name: doc.name, email: doc.email }
      }));
    }

    res.json({ report, recommendedDoctors });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.compareWithPrevious = async (req, res) => {
  try {
    const currentReport = await HealthReport.findOne({ _id: req.params.id, user: req.user._id });
    if (!currentReport) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Find previous report of same type
    const previousReport = await HealthReport.findOne({
      user: req.user._id,
      reportType: currentReport.reportType,
      _id: { $ne: currentReport._id },
      status: 'completed',
      createdAt: { $lt: currentReport.createdAt }
    }).sort({ createdAt: -1 });

    if (!previousReport) {
      return res.status(404).json({ message: 'No previous report of this type found for comparison' });
    }

    const comparison = await compareReports(currentReport, previousReport, req.user.profile);

    res.json({
      comparison,
      currentReport: {
        _id: currentReport._id,
        reportType: currentReport.reportType,
        createdAt: currentReport.createdAt,
        healthScore: currentReport.aiAnalysis?.healthScore
      },
      previousReport: {
        _id: previousReport._id,
        reportType: previousReport.reportType,
        createdAt: previousReport.createdAt,
        healthScore: previousReport.aiAnalysis?.healthScore
      }
    });
  } catch (error) {
    console.error('Comparison error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.chatAboutReport = async (req, res) => {
  try {
    const { message, chatHistory } = req.body;
    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const report = await HealthReport.findOne({ _id: req.params.id, user: req.user._id });
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    const response = await chatWithReport(report, message, chatHistory || []);
    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
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
      .sort({ createdAt: -1 })
      .limit(20);

    // Group by report type for comparison
    const grouped = {};
    reports.forEach(r => {
      if (!grouped[r.reportType]) grouped[r.reportType] = [];
      grouped[r.reportType].push({
        _id: r._id,
        date: r.createdAt,
        healthScore: r.aiAnalysis?.healthScore,
        metrics: r.aiAnalysis?.metrics,
        keyFindings: r.aiAnalysis?.keyFindings
      });
    });

    res.json({ history: grouped, totalReports: reports.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getDashboardData = async (req, res) => {
  try {
    const cacheKey = `dashboard:${req.user._id}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    const reports = await HealthReport.find({ user: req.user._id, status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(10);

    const healthScores = reports.map(r => ({
      date: r.createdAt,
      score: r.aiAnalysis?.healthScore || 0,
      type: r.reportType
    })).reverse();

    const latestReport = reports[0];

    // Get report type counts for comparison availability
    const reportTypeCounts = {};
    reports.forEach(r => {
      reportTypeCounts[r.reportType] = (reportTypeCounts[r.reportType] || 0) + 1;
    });

    // 🆕 Get latest comparison data if available
    let latestComparison = null;
    if (latestReport && latestReport.comparison && latestReport.comparison.data) {
      latestComparison = {
        ...latestReport.comparison.data,
        previousReportDate: latestReport.comparison.previousReportDate,
        currentReportDate: latestReport.createdAt
      };
    }

    // 🆕 Get today's nutrition summary (UTC Consistent)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const targetDate = new Date(todayStr);
    targetDate.setUTCHours(0, 0, 0, 0);

    const nutritionDataSummary = await NutritionSummary.findOne({
      userId: req.user._id,
      date: targetDate
    });

    const tomorrow = new Date(targetDate);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const todayLogs = await FoodLog.find({
      userId: req.user._id,
      timestamp: { $gte: targetDate, $lt: tomorrow }
    }).select('source mealType totalNutrition foodItems');

    // 🆕 Get 90-day history for trends (Real-time data)
    const ninetyDaysAgo = new Date(targetDate);
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 89);

    const historySummary = await NutritionSummary.find({
      userId: req.user._id,
      date: { $gte: ninetyDaysAgo, $lte: targetDate }
    }).sort({ date: 1 });

    const WearableData = require('../models/WearableData');
    const HealthMetric = require('../models/HealthMetric');
    const wearables = await withTimeout(WearableData.find({ user: req.user._id }));
    const weightMetrics = await withTimeout(HealthMetric.find({ userId: req.user._id, type: 'weight', recordedAt: { $gte: ninetyDaysAgo, $lte: targetDate } }).sort({ recordedAt: 1 }));
    
    // Fetch latest individual metrics for quick dashboard access
    const latestGlucoseLog = await HealthMetric.findOne({ userId: req.user._id, type: 'blood_sugar' }).sort({ recordedAt: -1 });
    const latestHbA1cLog = await HealthMetric.findOne({ userId: req.user._id, type: 'hba1c' }).sort({ recordedAt: -1 });

    // Map history to a consistent format for the last 90 days
    const history = [];
    for (let i = 0; i < 90; i++) {
      const d = new Date(ninetyDaysAgo);
      d.setUTCDate(d.getUTCDate() + i);
      const dStr = d.toISOString().split('T')[0];

      const nutrition = historySummary.find(h => h.date.toISOString().split('T')[0] === dStr);

      // Extract steps and sleep from all wearable data
      let steps = 0;
      let sleep = 0;
      for (const w of wearables) {
        const daily = w.dailyMetrics?.find(m => {
          if (!m.date) return false;
          try {
            return (m.date instanceof Date ? m.date : new Date(m.date)).toISOString().split('T')[0] === dStr;
          } catch (e) {
            return false;
          }
        });
        if (daily) steps += daily.steps || 0;

        const sleepDay = w.sleepData?.find(s => {
          if (!s.date) return false;
          try {
            return (s.date instanceof Date ? s.date : new Date(s.date)).toISOString().split('T')[0] === dStr;
          } catch (e) {
            return false;
          }
        });
        if (sleepDay) sleep += (sleepDay.totalSleepMinutes || 0) / 60;
      }

      // Extract current day's weight if logged, otherwise fallback to last known or default profile weight
      const currentDayWeightLogs = weightMetrics.filter(m => new Date(m.recordedAt).toISOString().split('T')[0] === dStr);
      let dayWeight = req.user.profile?.weight || 70;
      if (currentDayWeightLogs.length > 0) {
        dayWeight = currentDayWeightLogs[currentDayWeightLogs.length - 1].value;
      } else if (i > 0) {
        // Carry over previous day's weight if none recorded for logic consistency over gaps
        dayWeight = history[i - 1].weight || dayWeight;
      }

      history.push({
        date: dStr,
        calories: nutrition?.totalCalories || 0,
        steps,
        sleep,
        weight: dayWeight
      });
    }

    // Get today's values for quick access
    const todayHistory = history.find(h => h.date === todayStr);

    // Get goals
    const calorieGoal = req.user.nutritionGoal?.calorieGoal || 2100;
    const proteinGoal = req.user.nutritionGoal?.proteinGoal || 150;
    const carbsGoal = req.user.nutritionGoal?.carbsGoal || 200;
    const fatGoal = req.user.nutritionGoal?.fatGoal || 65;

    // Get step and sleep goals - set reasonable defaults as they are no longer in HealthGoal model
    const stepGoal = 10000;
    const sleepGoal = 8;

    // Helper to generate insights based on profile if no reports exist
    const generateProfileInsights = (user) => {
      if (!user || !user.profile) return null;

      const { weight, height, activityLevel } = user.profile;
      const bmi = (weight && height) ? (weight / ((height / 100) ** 2)).toFixed(1) : null;
      
      // Get today's dynamic metrics
      const cals = todayHistory?.calories || 0;
      const steps = todayHistory?.steps || 0;
      
      let lifestyleAdvice = "";
      let dietaryGoal = "Maintain balanced nutrition";
      let nutritionalTrend = "Balanced";

      if (cals > calorieGoal) nutritionalTrend = "Nutritional Surfeit (High Calorie Today)";
      else if (cals > 0 && cals < calorieGoal * 0.5) nutritionalTrend = "Incremental Intake (Light Day)";

      if (steps > 0 && steps < 3000) lifestyleAdvice = "Sedentary Pattern: A short 15-min walk would help today.";
      else if (steps >= 8000) lifestyleAdvice = "High Activity: Excellent momentum today!";
      else if (activityLevel === 'sedentary') lifestyleAdvice = "Profile Goal: Aim for light movement to boost your metabolism.";
      else lifestyleAdvice = "Metabolic Activity: Your movement is tracking with your goals.";

      if (bmi && bmi > 25) dietaryGoal = "Portion Control & Protein Prioritized";
      else if (bmi && bmi < 18.5) dietaryGoal = "Nutrient Dense & Calorie Rich";

      // Create a daily summary
      let summaryParts = [`Insight Hub:`];
      if (cals > 0) summaryParts.push(`Today's consumption of ${cals} kcal is ${nutritionalTrend}.`);
      if (steps > 0) summaryParts.push(`Recorded ${steps} steps so far.`);
      summaryParts.push(lifestyleAdvice);

      return {
        healthScore: cals > calorieGoal ? 68 : (steps > 5000 ? 82 : 75),
        summary: summaryParts.join(' '),
        metrics: bmi ? { "BMI": { value: bmi, status: bmi > 25 ? "Overweight" : "Normal", normalRange: "18.5-25" } } : {},
        deficiencies: [], 
        recommendations: {
          lifestyle: [lifestyleAdvice, steps < 2000 ? "Active Protocol needed." : "Consistent pacing observed."],
          nutritional: [dietaryGoal, cals > calorieGoal ? "Lower sugar intake." : "Hydration sync recommended."]
        }
      };
    };

    console.log(`Generated history with ${history.length} items`);
    const dashboardData = {
      user: { ...req.user.toObject(), password: undefined },
      healthScores,
      latestAnalysis: latestReport?.aiAnalysis || generateProfileInsights(req.user),
      latestReportId: latestReport?._id,
      latestComparison, // 🆕 Add comparison data
      totalReports: await HealthReport.countDocuments({ user: req.user._id }),
      recentReports: reports.slice(0, 5),
      reportTypeCounts,
      history, // 🆕 Add trend history
      stepsToday: todayHistory?.steps || 0,
      sleepToday: todayHistory?.sleep || 0,
      goals: {
        steps: stepGoal,
        sleep: sleepGoal,
        weight: req.user.nutritionGoal?.targetWeight || req.user.profile?.weight || 70,
        calories: calorieGoal,
        protein: proteinGoal,
        carbs: carbsGoal,
        fats: fatGoal
      },
      streakDays: req.user.streakDays || 0, // Add streak days
      vitals: {
        glucose: latestGlucoseLog ? { value: latestGlucoseLog.value, unit: latestGlucoseLog.unit, date: latestGlucoseLog.recordedAt, context: latestGlucoseLog.readingContext } : null,
        hba1c: latestHbA1cLog ? { value: latestHbA1cLog.value, unit: latestHbA1cLog.unit, date: latestHbA1cLog.recordedAt } : null
      },
      nutritionData: {
        totalCalories: nutritionDataSummary?.totalCalories || 0,
        calorieGoal,
        protein: nutritionDataSummary?.totalProtein || 0,
        proteinGoal,
        carbs: nutritionDataSummary?.totalCarbs || 0,
        carbsGoal,
        totalFats: nutritionDataSummary?.totalFats || 0,
        fatsGoal: fatGoal,
        totalFiber: nutritionDataSummary?.totalFiber || 0,
        totalSugar: nutritionDataSummary?.totalSugar || 0,
        totalSodium: nutritionDataSummary?.totalSodium || 0,
        totalVitaminA: nutritionDataSummary?.totalVitaminA || 0,
        totalVitaminC: nutritionDataSummary?.totalVitaminC || 0,
        totalVitaminD: nutritionDataSummary?.totalVitaminD || 0,
        totalVitaminB12: nutritionDataSummary?.totalVitaminB12 || 0,
        totalIron: nutritionDataSummary?.totalIron || 0,
        totalCalcium: nutritionDataSummary?.totalCalcium || 0,
        waterIntake: nutritionDataSummary?.waterIntake || 0,
        todayLogs: todayLogs || []
      }
    };

    // 🆕 Trigger startup notifications for user (Serverless friendly)
    try {
      const notificationService = require('../services/notificationService');
      // Fire and forget - don't wait for notifications to block dashboard delivery
      notificationService.triggerUserStartupNotifications(req.user).catch(err =>
        console.error('Non-critical notification error:', err)
      );
    } catch (nError) {
      console.error('Notification service loading error:', nError);
    }

    cache.set(cacheKey, dashboardData, 120); // Cache for 2 minutes
    res.json(dashboardData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Generate metric information on-the-fly
exports.getMetricInfo = async (req, res) => {
  try {
    console.log('getMetricInfo endpoint called');
    console.log('Request body:', req.body);
    console.log('User:', req.user?._id);

    const { metricName, metricValue, normalRange, unit } = req.body;

    if (!metricName) {
      return res.status(400).json({ message: 'Metric name is required' });
    }

    console.log('Calling generateMetricInfo with:', { metricName, metricValue, normalRange, unit });

    const metricInfo = await generateMetricInfo(metricName, metricValue, normalRange, unit);

    console.log('Generated metric info:', metricInfo);
    res.json({ metricInfo });
  } catch (error) {
    console.error('Get metric info error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Delete report endpoint
exports.deleteReport = async (req, res) => {
  try {
    const report = await HealthReport.findOne({ _id: req.params.id, user: req.user._id });

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Delete the file if it exists
    if (report.originalFile && report.originalFile.path && report.originalFile.path !== 'memory-storage') {
      try {
        if (fs.existsSync(report.originalFile.path)) {
          fs.unlinkSync(report.originalFile.path);
        }
      } catch (fileError) {
        console.error('Error deleting file:', fileError.message);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete the report from database
    await HealthReport.deleteOne({ _id: req.params.id });

    // Invalidate cache
    cache.delete(`reports:${req.user._id}`);
    cache.delete(`dashboard:${req.user._id}`);

    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({ message: error.message });
  }
};

// AI Chat endpoint for general health questions
exports.aiChat = async (req, res) => {
  try {
    const { query, conversationHistory } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: 'Query is required' });
    }

    // Check if Anthropic API key is configured
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const isAnthropicDirect = anthropicKey && anthropicKey.startsWith('sk-ant');

    if (!isAnthropicDirect) {
      console.error('No valid Anthropic API key configured');
      return res.status(500).json({
        success: false,
        message: 'AI service not configured correctly. Please contact administrator.',
        error: 'Missing or invalid Anthropic API key'
      });
    }

    // Ensure user exists
    if (!req.user) {
      console.error('User not found in request');
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'User not found.'
      });
    }

    console.log('AI Chat request from user:', req.user._id);

    // Get user's latest health data for context
    let latestReport = null;
    try {
      const HealthReport = require('../models/HealthReport');
      latestReport = await HealthReport.findOne({
        user: req.user._id,
        status: 'completed'
      }).sort({ createdAt: -1 });
    } catch (dbError) {
      console.error('Error fetching health report:', dbError.message);
      // Continue without health data
    }

    // Prepare system prompt with user context
    let systemPrompt = `You are a helpful medical AI assistant specializing in health and wellness. 
    
User Profile: ${req.user.name}`;

    if (req.user.profile) {
      systemPrompt += `, Age: ${req.user.profile.age || 'N/A'}, Gender: ${req.user.profile.gender || 'N/A'}`;
    }

    if (latestReport && latestReport.aiAnalysis) {
      const analysis = latestReport.aiAnalysis;
      systemPrompt += `\n\nUser's Latest Health Data (${new Date(latestReport.createdAt).toLocaleDateString()}):`;
      if (analysis.healthScore) {
        systemPrompt += `\n- Health Score: ${analysis.healthScore}/100`;
      }
      if (analysis.deficiencies && analysis.deficiencies.length > 0) {
        systemPrompt += `\n- Identified Deficiencies: ${analysis.deficiencies.map(d => d.name).join(', ')}`;
      }
      if (analysis.metrics) {
        systemPrompt += `\n- Key Metrics: ${JSON.stringify(analysis.metrics)}`;
      }
    }

    systemPrompt += `\n\nProvide helpful, accurate health information. Always remind users to consult healthcare professionals for medical decisions.`;

    // Build messages array for AI (without system for Anthropic)
    const userMessages = [];

    // Add conversation history if provided
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.slice(-10).forEach(msg => {
        if (msg.role && msg.content) {
          userMessages.push({ role: msg.role, content: msg.content });
        }
      });
    }

    // Add current query
    userMessages.push({ role: 'user', content: query });

    const axios = require('axios');
    let aiResponse;

    console.log('Calling Anthropic Direct API...');
    const CLAUDE_MODEL = 'claude-sonnet-4-6';
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: CLAUDE_MODEL,
        system: systemPrompt,
        messages: userMessages,
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
          'Connection': 'close'
        },
        timeout: 45000
      }
    );

    if (response.data && response.data.content && response.data.content[0]) {
      aiResponse = response.data.content[0].text;
      console.log('Anthropic Direct API success');
    } else {
      throw new Error('Invalid response structure from Anthropic API');
    }

    res.json({
      success: true,
      response: aiResponse,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('AI Chat error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    res.status(500).json({
      success: false,
      message: 'Failed to process AI chat request',
      error: error.response?.data?.error?.message || error.message
    });
  }
};


// Save challenge data
exports.saveChallengeData = async (req, res) => {
  try {
    const { challengeData } = req.body;

    if (!challengeData) {
      return res.status(400).json({ message: 'Challenge data is required' });
    }

    // Calculate streak
    let streak = 0;
    const days = Object.keys(challengeData).map(Number).sort((a, b) => b - a);

    for (const day of days) {
      const dayData = challengeData[day];
      const completedTasks = Object.values(dayData).filter(Boolean).length;

      // Day is considered complete if all tasks are done (4 habits)
      if (completedTasks >= 4) {
        streak++;
      } else {
        break;
      }
    }

    // Update user with challenge data and streak
    const user = await User.findById(req.user._id);
    user.challengeData = challengeData;
    user.streakDays = streak;

    // Set start date if this is the first time saving challenge data
    if (!user.challengeStartDate) {
      user.challengeStartDate = new Date();
    }

    // Mark as modified for Mixed type
    user.markModified('challengeData');

    await user.save();

    res.json({
      message: 'Challenge data saved successfully',
      streakDays: streak,
      challengeData: user.challengeData,
      challengeStartDate: user.challengeStartDate
    });
  } catch (error) {
    console.error('Save challenge error:', error);
    res.status(500).json({ message: 'Failed to save challenge data', error: error.message });
  }
};

// Get challenge data
exports.getChallengeData = async (req, res) => {
  try {
    let user = await withTimeout(User.findById(req.user._id).select('challengeData streakDays challengeStartDate'));

    if (!user.challengeStartDate) {
      user.challengeStartDate = new Date();
      await user.save();
    }

    res.json({
      challengeData: user.challengeData || {},
      streakDays: user.streakDays || 0,
      challengeStartDate: user.challengeStartDate
    });
  } catch (error) {
    console.error('Get challenge error:', error);
    res.status(500).json({ message: 'Failed to get challenge data', error: error.message });
  }
};

// Get report comparison data for dashboard graph
exports.getReportComparison = async (req, res) => {
  try {
    // Get all completed reports sorted by date
    const reports = await withTimeout(HealthReport.find({
      user: req.user._id,
      status: 'completed'
    }).sort({ createdAt: -1 }).limit(10));

    if (reports.length === 0) {
      return res.json({
        hasData: false,
        hasComparison: false,
        totalReports: 0,
        message: 'Upload your first health report to get started!'
      });
    }

    const latestReport = reports[0];

    // Build health score history for graphing (works for 1+ reports)
    const scoreHistory = reports.map(r => ({
      date: r.createdAt,
      dateLabel: new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: r.aiAnalysis?.healthScore || 0,
      type: r.reportType
    })).reverse();

    const latestScore = latestReport.aiAnalysis?.healthScore || 0;

    // If only 1 report, send data without comparison
    if (reports.length === 1) {
      return res.json({
        hasData: true,
        hasComparison: false,
        totalReports: 1,
        message: 'Upload one more report to see health progress comparison.',
        latestReport: {
          _id: latestReport._id,
          type: latestReport.reportType,
          date: latestReport.createdAt,
          healthScore: latestScore
        },
        scoreHistory,
        insights: [{
          type: 'info',
          icon: '📊',
          text: `Your initial health score is ${latestScore}%. Keep uploading reports to track your trend!`
        }]
      });
    }

    const previousReport = reports[1];

    // Build comparison metrics (for 2+ reports)
    const comparisonMetrics = [];
    const latestMetrics = latestReport.aiAnalysis?.metrics || {};
    const previousMetrics = previousReport.aiAnalysis?.metrics || {};

    // Collect all unique metric keys
    const allKeys = new Set([...Object.keys(latestMetrics), ...Object.keys(previousMetrics)]);

    allKeys.forEach(key => {
      const latest = latestMetrics[key];
      const previous = previousMetrics[key];
      if (latest || previous) {
        const latestVal = parseFloat(latest?.value) || 0;
        const prevVal = parseFloat(previous?.value) || 0;
        const change = latestVal - prevVal;
        const changePct = prevVal !== 0 ? Math.round((change / prevVal) * 100) : 0;

        comparisonMetrics.push({
          name: key.replace(/([A-Z])/g, ' $1').trim(),
          key,
          latestValue: latestVal,
          previousValue: prevVal,
          unit: latest?.unit || previous?.unit || '',
          change,
          changePercent: changePct,
          status: latest?.status || 'unknown',
          previousStatus: previous?.status || 'unknown',
          improved: latest?.status === 'normal' && previous?.status !== 'normal'
            ? true
            : latest?.status !== 'normal' && previous?.status === 'normal'
              ? false
              : change === 0 ? null : undefined
        });
      }
    });

    // Health score comparison
    const previousScore = previousReport.aiAnalysis?.healthScore || 0;
    const scoreChange = latestScore - previousScore;

    // Build insights
    const insights = [];
    const improvedMetrics = comparisonMetrics.filter(m => m.improved === true);
    const declinedMetrics = comparisonMetrics.filter(m => m.improved === false);

    if (scoreChange > 0) {
      insights.push({
        type: 'positive',
        icon: '📈',
        text: `Your health score improved by ${scoreChange} points from ${previousScore}% to ${latestScore}%.`
      });
    } else if (scoreChange < 0) {
      insights.push({
        type: 'warning',
        icon: '📉',
        text: `Your health score decreased by ${Math.abs(scoreChange)} points. Consider reviewing your lifestyle habits.`
      });
    } else {
      insights.push({
        type: 'info',
        icon: '📊',
        text: `Your health score remains stable at ${latestScore}%.`
      });
    }

    if (improvedMetrics.length > 0) {
      insights.push({
        type: 'positive',
        icon: '✅',
        text: `${improvedMetrics.length} biomarker(s) improved: ${improvedMetrics.slice(0, 3).map(m => m.name).join(', ')}.`
      });
    }

    if (declinedMetrics.length > 0) {
      insights.push({
        type: 'warning',
        icon: '⚠️',
        text: `${declinedMetrics.length} biomarker(s) need attention: ${declinedMetrics.slice(0, 3).map(m => m.name).join(', ')}.`
      });
    }

    // Deficiency comparison
    const latestDef = (latestReport.aiAnalysis?.deficiencies || []).map(d => d.name);
    const previousDef = (previousReport.aiAnalysis?.deficiencies || []).map(d => d.name);
    const resolvedDef = previousDef.filter(d => !latestDef.includes(d));
    const newDef = latestDef.filter(d => !previousDef.includes(d));

    if (resolvedDef.length > 0) {
      insights.push({
        type: 'positive',
        icon: '🎉',
        text: `Resolved deficiencies: ${resolvedDef.join(', ')}. Great progress!`
      });
    }

    if (newDef.length > 0) {
      insights.push({
        type: 'warning',
        icon: '🔍',
        text: `New concerns detected: ${newDef.join(', ')}. Consider dietary adjustments.`
      });
    }

    res.json({
      hasData: true,
      hasComparison: true,
      totalReports: reports.length,
      latestReport: {
        _id: latestReport._id,
        type: latestReport.reportType,
        date: latestReport.createdAt,
        healthScore: latestScore
      },
      previousReport: {
        _id: previousReport._id,
        type: previousReport.reportType,
        date: previousReport.createdAt,
        healthScore: previousScore
      },
      scoreChange,
      scoreHistory,
      comparisonMetrics: comparisonMetrics.slice(0, 12), // Limit for display
      insights,
      deficiencyComparison: {
        resolved: resolvedDef,
        new: newDef,
        ongoing: latestDef.filter(d => previousDef.includes(d))
      }
    });
  } catch (error) {
    console.error('Report comparison error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Sync daily progress endpoint
exports.syncDailyProgress = async (req, res) => {
  try {
    const { date, totalScore, nutritionScore, sleepScore, hydrationScore, stressScore, waterIntake } = req.body;

    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }

    const progress = await DailyProgress.findOneAndUpdate(
      { userId: req.user._id, date },
      {
        totalScore: totalScore || 0,
        nutritionScore: nutritionScore || 0,
        sleepScore: sleepScore || 0,
        hydrationScore: hydrationScore || 0,
        stressScore: stressScore || 0,
        waterIntake: waterIntake || 0,
        updatedAt: Date.now()
      },
      { new: true, upsert: true }
    );

    // Also update NutritionSummary if waterIntake is provided
    if (waterIntake !== undefined) {
      try {
        const NutritionSummary = require('../models/NutritionSummary');
        const targetDate = new Date(date);
        targetDate.setUTCHours(0, 0, 0, 0);

        await NutritionSummary.findOneAndUpdate(
          { userId: req.user._id, date: targetDate },
          { waterIntake: Number(waterIntake) },
          { upsert: true }
        );
      } catch (err) {
        console.error('Failed to sync water to nutrition summary:', err);
      }
    }

    res.json({ success: true, progress });
  } catch (error) {
    console.error('Daily progress sync error:', error);
    res.status(500).json({ message: 'Failed to sync daily progress' });
  }
};

// Get daily progress for a given date
exports.getDailyProgress = async (req, res) => {
  try {
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }

    const progress = await DailyProgress.findOne({ userId: req.user._id, date });

    res.json({ success: true, progress });
  } catch (error) {
    console.error('Get daily progress error:', error);
    res.status(500).json({ message: 'Failed to get daily progress' });
  }
};

// AI Vitals Insights
exports.getVitalsInsights = async (req, res) => {
  try {
    const { metricType } = req.params;
    const { refresh } = req.query;

    if (!['weight', 'steps', 'sleep'].includes(metricType)) {
      return res.status(400).json({ message: 'Invalid metric type. Must be weight, steps, or sleep.' });
    }

    // Check if we already have an insight and we're not refreshing
    if (refresh !== 'true' && req.user.vitalsInsights && req.user.vitalsInsights[metricType]) {
      return res.json({
        success: true,
        insights: req.user.vitalsInsights[metricType],
        isCached: true
      });
    }

    // Get last 7 days of history from dashboard data
    const targetDate = new Date();
    const sevenDaysAgo = new Date(targetDate);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

    const WearableData = require('../models/WearableData');
    const HealthMetric = require('../models/HealthMetric');

    const wearables = await WearableData.find({ user: req.user._id }).maxTimeMS(15000);
    const weightMetrics = await HealthMetric.find({
      userId: req.user._id,
      type: 'weight',
      recordedAt: { $gte: sevenDaysAgo, $lte: targetDate }
    }).sort({ recordedAt: 1 }).maxTimeMS(15000);

    const history = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setUTCDate(d.getUTCDate() + i);
      const dStr = d.toISOString().split('T')[0];

      let steps = 0, sleep = 0;
      for (const w of wearables) {
        const daily = w.dailyMetrics?.find(m => {
          if (!m.date) return false;
          try { return (m.date instanceof Date ? m.date : new Date(m.date)).toISOString().split('T')[0] === dStr; } catch { return false; }
        });
        if (daily) steps += daily.steps || 0;
        const sleepDay = w.sleepData?.find(s => {
          if (!s.date) return false;
          try { return (s.date instanceof Date ? s.date : new Date(s.date)).toISOString().split('T')[0] === dStr; } catch { return false; }
        });
        if (sleepDay) sleep += (sleepDay.totalSleepMinutes || 0) / 60;
      }

      const currentDayWeightLogs = weightMetrics.filter(m => new Date(m.recordedAt).toISOString().split('T')[0] === dStr);
      let dayWeight = req.user.profile?.weight || 70;
      if (currentDayWeightLogs.length > 0) dayWeight = currentDayWeightLogs[currentDayWeightLogs.length - 1].value;
      else if (i > 0 && history[i - 1]) dayWeight = history[i - 1].weight || dayWeight;

      history.push({ date: dStr, weight: dayWeight, steps, sleep });
    }

    const insights = await generateVitalsInsights(metricType, history, req.user);

    // Save the new insights to the user
    if (!req.user.vitalsInsights) req.user.vitalsInsights = {};
    req.user.vitalsInsights[metricType] = {
      ...insights,
      lastUpdated: new Date()
    };

    // Use findByIdAndUpdate to ensure it's saved correctly
    await User.findByIdAndUpdate(req.user._id, {
      $set: { [`vitalsInsights.${metricType}`]: req.user.vitalsInsights[metricType] }
    });

    res.json({ success: true, insights: req.user.vitalsInsights[metricType], history });
  } catch (error) {
    console.error('Error getting vitals insights:', error);
    res.status(500).json({ message: 'Failed to generate insights. Please try again.' });
  }
};
