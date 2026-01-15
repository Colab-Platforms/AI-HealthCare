const HealthReport = require('../models/HealthReport');
const Doctor = require('../models/Doctor');
const { analyzeHealthReport, compareReports, chatWithReport } = require('../services/aiService');
const pdfParse = require('pdf-parse');
const fs = require('fs');

exports.uploadReport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a file' });
    }

    let extractedText = '';
    if (req.file.mimetype === 'application/pdf') {
      const dataBuffer = fs.readFileSync(req.file.path);
      const pdfData = await pdfParse(dataBuffer);
      extractedText = pdfData.text;
    } else {
      // For images, use manual text or OCR service
      extractedText = req.body.manualText || 'Image report - manual text provided';
    }

    if (!extractedText || extractedText.trim().length < 20) {
      return res.status(400).json({ message: 'Could not extract text from report. Please provide report details manually.' });
    }

    const report = await HealthReport.create({
      user: req.user._id,
      reportType: req.body.reportType || 'general',
      originalFile: {
        filename: req.file.filename,
        path: req.file.path,
        mimetype: req.file.mimetype
      },
      extractedText,
      status: 'processing'
    });

    // Analyze with AI
    const userProfile = req.user.profile || {};
    const aiAnalysis = await analyzeHealthReport(extractedText, userProfile);
    
    report.aiAnalysis = aiAnalysis;
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
    const reports = await HealthReport.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
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

    res.json({
      user: { ...req.user.toObject(), password: undefined },
      healthScores,
      latestAnalysis: latestReport?.aiAnalysis || null,
      latestReportId: latestReport?._id,
      totalReports: await HealthReport.countDocuments({ user: req.user._id }),
      recentReports: reports.slice(0, 5),
      reportTypeCounts
    });
  } catch (error) {
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

    // Check if API key is configured
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY not configured');
      return res.status(500).json({ 
        success: false,
        message: 'AI service not configured. Please contact administrator.',
        error: 'Missing API key'
      });
    }

    // Get user's latest health data for context
    const latestReport = await HealthReport.findOne({ 
      user: req.user._id, 
      status: 'completed' 
    }).sort({ createdAt: -1 });

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

    // Build messages array for AI
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history if provided
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.slice(-10).forEach(msg => {
        if (msg.role && msg.content) {
          messages.push({ role: msg.role, content: msg.content });
        }
      });
    }

    // Add current query
    messages.push({ role: 'user', content: query });

    console.log('Calling OpenRouter API with free model...');

    // Call OpenRouter API with FREE model
    const axios = require('axios');
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'google/gemini-2.0-flash-exp:free', // FREE Google Gemini model
        messages,
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.CLIENT_URL || 'https://ai-diagnostic-steel.vercel.app',
          'X-Title': 'HealthAI Platform'
        },
        timeout: 30000 // 30 second timeout
      }
    );

    const aiResponse = response.data.choices[0].message.content;
    console.log('OpenRouter API success');

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
