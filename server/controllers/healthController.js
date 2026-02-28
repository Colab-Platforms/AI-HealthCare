const HealthReport = require('../models/HealthReport');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const { analyzeHealthReport, compareReports, chatWithReport, generateMetricInfo } = require('../services/aiService');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const NutritionSummary = require('../models/NutritionSummary');
const cache = require('../utils/cache');
const cloudinary = require('../services/cloudinary');

exports.uploadReport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a file' });
    }

    let extractedText = '';
    let cloudinaryUrl = null;
    try {
      const dataBuffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);

      if (!dataBuffer) {
        throw new Error('No file data found to process');
      }

      if (req.file.mimetype === 'application/pdf') {
        // Upload to Cloudinary for persistence (non-blocking for extraction)
        console.log('☁️ Uploading report to Cloudinary...');
        cloudinaryUrl = await cloudinary.uploadImage(dataBuffer, 'health_reports');

        const pdfData = await pdfParse(dataBuffer);
        extractedText = pdfData.text;
      } else {
        // For images, upload to Cloudinary and use manual text
        console.log('☁️ Uploading image report to Cloudinary...');
        cloudinaryUrl = await cloudinary.uploadImage(dataBuffer, 'health_reports');
        extractedText = req.body.manualText || 'Image report - manual text provided';
      }
    } catch (parseError) {
      console.error('File parsing error:', parseError.message);
      return res.status(400).json({ message: `Failed to parse file: ${parseError.message}` });
    }

    if (!extractedText || extractedText.trim().length < 20) {
      return res.status(400).json({ message: 'Could not extract text from report. Please provide report details manually.' });
    }

    const report = await HealthReport.create({
      user: req.user._id,
      reportType: req.body.reportType || 'general',
      originalFile: {
        filename: req.file.originalname || req.file.filename,
        path: cloudinaryUrl || req.file.path || 'memory-storage',
        mimetype: req.file.mimetype,
        cloudinaryUrl: cloudinaryUrl
      },
      extractedText,
      status: 'processing'
    });

    // Analyze with AI
    const userProfile = req.user.profile || {};
    let aiAnalysis;
    try {
      console.log('\n🔄 ========== ANALYZING REPORT ==========');
      console.log('📝 PDF Text Length:', extractedText.length, 'characters');
      console.log('📝 First 1000 characters of PDF text:');
      console.log('---PDF-START---');
      console.log(extractedText.substring(0, 1000));
      console.log('---PDF-END---');

      console.log('\n🔄 Analyzing report...');
      aiAnalysis = await analyzeHealthReport(extractedText, req.user);

      console.log('\n📦 ========== FULL AI ANALYSIS OBJECT ==========');
      console.log('Type:', typeof aiAnalysis);
      console.log('Keys:', Object.keys(aiAnalysis));
      console.log('\n📊 COMPLETE AI ANALYSIS:');
      console.log(JSON.stringify(aiAnalysis, null, 2).substring(0, 3000));
      console.log('========================================\n');

      console.log('\n✅ ========== AI ANALYSIS RECEIVED ==========');
      console.log('📊 Patient Name:', aiAnalysis.patientName || 'NOT FOUND');
      console.log('📊 Health Score:', aiAnalysis.healthScore);
      console.log('📊 Summary:', aiAnalysis.summary?.substring(0, 200) || 'NO SUMMARY');
      console.log('📊 Key Findings:', aiAnalysis.keyFindings?.length || 0, 'items');
      console.log('📊 Metrics:', Object.keys(aiAnalysis.metrics || {}).length, 'metrics found');

      if (aiAnalysis.metrics && Object.keys(aiAnalysis.metrics).length > 0) {
        console.log('\n📊 SAMPLE METRICS (first 3):');
        Object.entries(aiAnalysis.metrics).slice(0, 3).forEach(([key, metric]) => {
          console.log(`   - ${key}: ${metric.value} ${metric.unit} (${metric.status})`);
        });
      } else {
        console.log('⚠️  NO METRICS EXTRACTED!');
      }

      console.log('\n📊 Diet Plan:');
      console.log('   Breakfast:', aiAnalysis.dietPlan?.breakfast?.length || 0, 'meals');
      console.log('   Lunch:', aiAnalysis.dietPlan?.lunch?.length || 0, 'meals');
      console.log('   Dinner:', aiAnalysis.dietPlan?.dinner?.length || 0, 'meals');
      console.log('   Snacks:', aiAnalysis.dietPlan?.snacks?.length || 0, 'meals');
      console.log('========================================\n');
    } catch (aiError) {
      console.error('AI Analysis failed:', aiError.message);
      // Save report with error status
      report.status = 'failed';
      report.error = aiError.message;
      await report.save();
      return res.status(500).json({ message: `AI Analysis failed: ${aiError.message}` });
    }

    // ✅ CRITICAL FIX: Validate and fix healthScore
    if (aiAnalysis.healthScore) {
      // If it's a string, convert to number
      if (typeof aiAnalysis.healthScore === 'string') {
        const scoreMap = {
          'excellent': 95, 'very good': 90, 'good': 85,
          'fair': 75, 'poor': 60, 'very poor': 50
        };
        const lowerScore = aiAnalysis.healthScore.toLowerCase();
        aiAnalysis.healthScore = scoreMap[lowerScore] || 75;
        console.log('⚠️ Converted string healthScore to number:', aiAnalysis.healthScore);
      }
      // Ensure it's a valid number between 0-100
      aiAnalysis.healthScore = Math.max(0, Math.min(100, Number(aiAnalysis.healthScore) || 75));
    } else {
      aiAnalysis.healthScore = 75;
      console.log('⚠️ No healthScore, using default: 75');
    }
    console.log('✅ Final healthScore:', aiAnalysis.healthScore, '(type:', typeof aiAnalysis.healthScore, ')');

    // ✅ CRITICAL FIX: Validate deficiencies array
    if (!Array.isArray(aiAnalysis.deficiencies)) {
      console.warn('⚠️ deficiencies is not an array, fixing...');
      if (typeof aiAnalysis.deficiencies === 'string') {
        // Convert string to array with single object
        aiAnalysis.deficiencies = [{
          name: aiAnalysis.deficiencies,
          severity: 'moderate',
          currentValue: 'N/A',
          normalRange: 'N/A',
          symptoms: []
        }];
      } else if (aiAnalysis.deficiencies && typeof aiAnalysis.deficiencies === 'object') {
        // If it's an object, wrap it in array
        aiAnalysis.deficiencies = [aiAnalysis.deficiencies];
      } else {
        aiAnalysis.deficiencies = [];
      }
    }

    // ✅ CRITICAL FIX: Validate supplements array
    console.log('🔍 Checking supplements:', typeof aiAnalysis.supplements, '=', aiAnalysis.supplements);
    if (!Array.isArray(aiAnalysis.supplements)) {
      console.warn('⚠️ supplements is not an array, fixing...');
      if (typeof aiAnalysis.supplements === 'string') {
        // Convert string to array with single object
        console.log('Converting string supplements to array');
        aiAnalysis.supplements = [{
          category: 'General Health',
          reason: aiAnalysis.supplements,
          naturalSources: 'Consult healthcare professional',
          note: 'Please consult with your doctor'
        }];
      } else if (aiAnalysis.supplements && typeof aiAnalysis.supplements === 'object') {
        // If it's an object, wrap it in array
        console.log('Wrapping object supplements in array');
        aiAnalysis.supplements = [aiAnalysis.supplements];
      } else {
        console.log('Setting supplements to empty array');
        aiAnalysis.supplements = [];
      }
    }
    console.log('✅ Supplements after validation:', Array.isArray(aiAnalysis.supplements), 'length:', aiAnalysis.supplements?.length);

    // ✅ Validate keyFindings array
    if (!Array.isArray(aiAnalysis.keyFindings)) {
      console.warn('⚠️ keyFindings is not an array, fixing...');
      if (typeof aiAnalysis.keyFindings === 'string') {
        aiAnalysis.keyFindings = [aiAnalysis.keyFindings];
      } else {
        aiAnalysis.keyFindings = [];
      }
    }

    // ✅ Validate riskFactors array
    if (aiAnalysis.riskFactors && !Array.isArray(aiAnalysis.riskFactors)) {
      console.warn('⚠️ riskFactors is not an array, fixing...');
      if (typeof aiAnalysis.riskFactors === 'string') {
        aiAnalysis.riskFactors = [aiAnalysis.riskFactors];
      } else {
        aiAnalysis.riskFactors = [];
      }
    }

    // ✅ Validate dietPlan arrays
    if (aiAnalysis.dietPlan) {
      ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(meal => {
        if (aiAnalysis.dietPlan[meal] && !Array.isArray(aiAnalysis.dietPlan[meal])) {
          console.warn(`⚠️ dietPlan.${meal} is not an array, fixing...`);
          aiAnalysis.dietPlan[meal] = [];
        }
      });
      ['foodsToIncrease', 'foodsToLimit', 'tips'].forEach(field => {
        if (aiAnalysis.dietPlan[field] && !Array.isArray(aiAnalysis.dietPlan[field])) {
          console.warn(`⚠️ dietPlan.${field} is not an array, fixing...`);
          if (typeof aiAnalysis.dietPlan[field] === 'string') {
            aiAnalysis.dietPlan[field] = [aiAnalysis.dietPlan[field]];
          } else {
            aiAnalysis.dietPlan[field] = [];
          }
        }
      });
    }

    // ✅ Validate recommendations arrays
    if (aiAnalysis.recommendations) {
      ['immediate', 'shortTerm', 'longTerm', 'lifestyle', 'tests'].forEach(field => {
        if (aiAnalysis.recommendations[field] && !Array.isArray(aiAnalysis.recommendations[field])) {
          console.warn(`⚠️ recommendations.${field} is not an array, fixing...`);
          if (typeof aiAnalysis.recommendations[field] === 'string') {
            aiAnalysis.recommendations[field] = [aiAnalysis.recommendations[field]];
          } else {
            aiAnalysis.recommendations[field] = [];
          }
        }
      });
    }

    // ✅ Validate doctorConsultation.specializations array
    if (aiAnalysis.doctorConsultation && aiAnalysis.doctorConsultation.specializations &&
      !Array.isArray(aiAnalysis.doctorConsultation.specializations)) {
      console.warn('⚠️ doctorConsultation.specializations is not an array, fixing...');
      if (typeof aiAnalysis.doctorConsultation.specializations === 'string') {
        aiAnalysis.doctorConsultation.specializations = [aiAnalysis.doctorConsultation.specializations];
      } else {
        aiAnalysis.doctorConsultation.specializations = [];
      }
    }

    console.log('✅ Validated all arrays - deficiencies:', aiAnalysis.deficiencies?.length, 'supplements:', aiAnalysis.supplements?.length);

    // ✅ CRITICAL: Check if arrays contain strings instead of objects
    if (Array.isArray(aiAnalysis.deficiencies) && aiAnalysis.deficiencies.length > 0) {
      if (typeof aiAnalysis.deficiencies[0] === 'string') {
        console.warn('⚠️ deficiencies array contains strings, converting to objects...');
        aiAnalysis.deficiencies = aiAnalysis.deficiencies.map(def => ({
          name: typeof def === 'string' ? def : (def.name || def.deficiency || 'Unknown Deficiency'),
          severity: (typeof def === 'object' && def.severity) ? def.severity : 'moderate',
          currentValue: (typeof def === 'object' && def.currentValue) ? def.currentValue : 'N/A',
          normalRange: (typeof def === 'object' && def.normalRange) ? def.normalRange : 'N/A',
          symptoms: (typeof def === 'object' && def.symptoms) ? def.symptoms : []
        }));
        console.log('✅ Converted deficiencies to objects:', aiAnalysis.deficiencies.length);
      }
    }

    if (Array.isArray(aiAnalysis.supplements) && aiAnalysis.supplements.length > 0) {
      if (typeof aiAnalysis.supplements[0] === 'string') {
        console.warn('⚠️ supplements array contains strings, converting to objects...');
        aiAnalysis.supplements = aiAnalysis.supplements.map(supp => ({
          category: 'General Health',
          reason: supp,
          naturalSources: 'Consult healthcare professional',
          note: 'Consult doctor for dosage'
        }));
        console.log('✅ Converted supplements to objects:', aiAnalysis.supplements.length);
      }
    }

    console.log('✅ FINAL CHECK - deficiencies:', aiAnalysis.deficiencies?.length, 'supplements:', aiAnalysis.supplements?.length);

    report.aiAnalysis = aiAnalysis;

    // Extract and save report date from AI analysis
    if (aiAnalysis.reportDate) {
      try {
        report.reportDate = new Date(aiAnalysis.reportDate);
      } catch (dateError) {
        console.log('Could not parse report date:', aiAnalysis.reportDate);
        report.reportDate = new Date(); // Fallback to current date
      }
    } else {
      report.reportDate = new Date(); // Fallback to current date
    }

    // Extract and save patient information from AI analysis
    if (aiAnalysis.patientName) {
      report.patientName = aiAnalysis.patientName.trim();
    }
    if (aiAnalysis.patientAge) {
      report.patientAge = Number(aiAnalysis.patientAge);
    }
    if (aiAnalysis.patientGender) {
      report.patientGender = aiAnalysis.patientGender.trim();
    }

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

    // 🆕 AUTO-COMPARE WITH PREVIOUS REPORT
    let comparisonData = null;
    try {
      // Find previous report of same type
      const previousReport = await HealthReport.findOne({
        user: req.user._id,
        reportType: report.reportType,
        _id: { $ne: report._id },
        status: 'completed',
        createdAt: { $lt: report.createdAt }
      }).sort({ createdAt: -1 });

      if (previousReport && previousReport.aiAnalysis) {
        console.log('🔄 Found previous report, generating comparison...');

        // Generate comparison between reports
        comparisonData = await compareReports(report, previousReport);

        // Save comparison to report
        report.comparison = {
          previousReportId: previousReport._id,
          previousReportDate: previousReport.createdAt,
          data: comparisonData
        };
        await report.save();

        console.log('✅ Comparison generated and saved');
      } else {
        console.log('ℹ️ No previous report found for comparison');
      }
    } catch (compError) {
      console.error('⚠️ Comparison failed (non-critical):', compError.message);
      // Don't fail the upload if comparison fails
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

    const reports = await HealthReport.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    cache.set(cacheKey, reports, 180); // Cache for 3 minutes
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getReportById = async (req, res) => {
  try {
    const report = await HealthReport.findOne({ _id: req.params.id, user: req.user._id });
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Find recommended doctors
    let recommendedDoctors = [];
    if (report.aiAnalysis?.doctorConsultation?.recommended) {
      const specs = report.aiAnalysis.doctorConsultation.specializations || [];
      const doctors = await Doctor.find({
        specialization: { $in: specs.map(s => new RegExp(s, 'i')) },
        isAvailable: true
      })
        .sort({ rating: -1 })
        .limit(3);

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

    // 🆕 Get today's nutrition summary
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nutritionData = await NutritionSummary.findOne({
      userId: req.user._id,
      date: today
    });

    const dashboardData = {
      user: { ...req.user.toObject(), password: undefined },
      healthScores,
      latestAnalysis: latestReport?.aiAnalysis || null,
      latestReportId: latestReport?._id,
      latestComparison, // 🆕 Add comparison data
      totalReports: await HealthReport.countDocuments({ user: req.user._id }),
      recentReports: reports.slice(0, 5),
      reportTypeCounts,
      streakDays: req.user.streakDays || 0, // Add streak days
      nutritionData: nutritionData ? {
        totalCalories: nutritionData.totalCalories,
        calorieGoal: nutritionData.calorieGoal,
        protein: nutritionData.totalProtein,
        carbs: nutritionData.totalCarbs,
        fats: nutritionData.totalFats,
        waterIntake: nutritionData.waterIntake
      } : null
    };

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

    // Check if any API key is configured
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const isAnthropicDirect = anthropicKey && anthropicKey.startsWith('sk-ant');

    if (!anthropicKey && !openrouterKey) {
      console.error('No AI API key configured');
      return res.status(500).json({
        success: false,
        message: 'AI service not configured. Please contact administrator.',
        error: 'Missing API key'
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

    if (isAnthropicDirect) {
      console.log('Calling Anthropic Direct API...');
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-5-sonnet-20241022',
          system: systemPrompt,
          messages: userMessages,
          temperature: 0.7,
          max_tokens: 2000
        },
        {
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      aiResponse = response.data.content[0].text;
      console.log('Anthropic Direct API success');
    } else {
      console.log('Calling OpenRouter API...');
      const messages = [
        { role: 'system', content: systemPrompt },
        ...userMessages
      ];
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'google/gemini-2.0-flash-exp:free',
          messages,
          temperature: 0.7,
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${openrouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.CLIENT_URL || 'https://ai-diagnostic-steel.vercel.app',
            'X-Title': 'HealthAI Platform'
          },
          timeout: 30000
        }
      );
      aiResponse = response.data.choices[0].message.content;
      console.log('OpenRouter API success');
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

    // Mark as modified for Mixed type
    user.markModified('challengeData');

    await user.save();

    res.json({
      message: 'Challenge data saved successfully',
      streakDays: streak,
      challengeData: user.challengeData
    });
  } catch (error) {
    console.error('Save challenge error:', error);
    res.status(500).json({ message: 'Failed to save challenge data', error: error.message });
  }
};

// Get challenge data
exports.getChallengeData = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('challengeData streakDays');

    res.json({
      challengeData: user.challengeData || {},
      streakDays: user.streakDays || 0
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
    const reports = await HealthReport.find({
      user: req.user._id,
      status: 'completed'
    }).sort({ createdAt: -1 }).limit(10);

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
