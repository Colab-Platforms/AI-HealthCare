const axios = require('axios');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Using Claude model which is more stable and widely available
const AI_MODEL = 'anthropic/claude-3-haiku';

const makeOpenRouterRequest = async (messages, maxTokens = 2500) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not set in environment variables');
    }

    console.log('Making OpenRouter request with model:', AI_MODEL);
    console.log('API Key present:', !!process.env.OPENROUTER_API_KEY);
    
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: AI_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: maxTokens
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.CLIENT_URL || process.env.APP_URL || 'https://ai-diagnostic-steel.vercel.app',
          'X-Title': 'HealthAI Platform'
        },
        timeout: 60000 // 60 second timeout
      }
    );
    
    if (!response.data.choices || !response.data.choices[0]) {
      throw new Error('Invalid response structure from OpenRouter');
    }
    
    console.log('✅ OpenRouter API call successful');
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('❌ OpenRouter API Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      code: error.code,
      model: AI_MODEL
    });
    throw error;
  }
};

const HEALTH_ANALYSIS_PROMPT = `You are a medical AI assistant. Analyze this health report and return ONLY valid JSON.

CRITICAL: Return ONLY JSON, no other text.

Return this exact structure:
{
  "patientName": "Patient Name from report",
  "reportDate": "YYYY-MM-DD",
  "summary": "Brief health overview",
  "keyFindings": ["Finding 1", "Finding 2"],
  "riskFactors": ["Risk 1"],
  "healthScore": 75,
  "metrics": {
    "vitaminD": {"value": 20, "unit": "ng/mL", "status": "low", "normalRange": "30-100"},
    "vitaminB12": {"value": 300, "unit": "pg/mL", "status": "normal", "normalRange": "200-900"},
    "hemoglobin": {"value": 14, "unit": "g/dL", "status": "normal", "normalRange": "12-16"}
  },
  "deficiencies": [
    {"name": "Vitamin D", "severity": "moderate", "currentValue": "20 ng/mL", "normalRange": "30-100 ng/mL", "symptoms": ["Fatigue"]}
  ],
  "supplements": [
    {"category": "Vitamin D", "reason": "Low levels", "naturalSources": "Sunlight, mushrooms, fish", "note": "Get 15-20 mins sunlight daily"}
  ],
  "dietPlan": {
    "overview": "Personalized diet plan",
    "breakfast": [{"meal": "Eggs with toast", "nutrients": ["Protein", "B12"], "tip": "Include daily"}],
    "lunch": [{"meal": "Dal with rice", "nutrients": ["Iron", "Protein"], "tip": "Add lemon"}],
    "dinner": [{"meal": "Vegetables with paneer", "nutrients": ["Calcium"], "tip": "Light dinner"}],
    "snacks": [{"meal": "Almonds", "nutrients": ["Calcium"], "tip": "Soak overnight"}],
    "foodsToIncrease": ["Leafy greens", "Dairy"],
    "foodsToLimit": ["Processed foods"],
    "hydration": "Drink 8-10 glasses water daily",
    "tips": ["Eat at regular times"]
  },
  "recommendations": {
    "lifestyle": ["Get morning sunlight", "Regular exercise", "Adequate sleep"],
    "tests": ["Follow-up vitamin panel in 3 months"]
  },
  "overallTrend": "Health status overview"
}`;

exports.analyzeHealthReport = async (reportText, userProfile = {}) => {
  try {
    console.log('🔄 Starting health report analysis...');
    console.log('📝 Report text length:', reportText.length);
    
    const userContext = userProfile.age ? 
      `Patient Info: Age ${userProfile.age}, Gender: ${userProfile.gender || 'Not specified'}` : '';

    console.log('📝 Calling AI with report text length:', reportText.length);
    
    const content = await makeOpenRouterRequest([
      { role: 'system', content: HEALTH_ANALYSIS_PROMPT },
      { role: 'user', content: `${userContext}\n\nHealth Report:\n${reportText}` }
    ]);

    console.log('📦 Received response from AI');
    console.log('Response length:', content.length);
    console.log('Response preview:', content.substring(0, 300));
    
    // Try to extract JSON - be more flexible
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error('❌ No JSON found in response');
      console.error('Full response:', content);
      throw new Error('Invalid AI response format - no JSON found');
    }
    
    let jsonStr = jsonMatch[0];
    console.log('Extracted JSON length:', jsonStr.length);
    
    // Try to fix common JSON issues
    try {
      const analysis = JSON.parse(jsonStr);
      console.log('✅ Successfully parsed AI analysis');
      console.log('📊 Analysis summary:', {
        healthScore: analysis.healthScore,
        metricsCount: Object.keys(analysis.metrics || {}).length,
        deficienciesCount: analysis.deficiencies?.length || 0,
        supplementsCount: analysis.supplements?.length || 0
      });
      
      return analysis;
    } catch (parseError) {
      console.error('❌ JSON Parse Error:', parseError.message);
      console.error('Attempted to parse:', jsonStr.substring(0, 500));
      throw parseError;
    }
  } catch (error) {
    console.error('❌ AI Analysis Error:', {
      message: error.message,
      apiError: error.response?.data,
      status: error.response?.status,
      code: error.code
    });
    
    // Fallback: Return a basic analysis structure if API fails
    console.log('⚠️ Using fallback analysis due to API error');
    return {
      patientName: 'Patient',
      reportDate: new Date().toISOString().split('T')[0],
      summary: 'Health report received. AI analysis is currently unavailable. Please try uploading again or contact support.',
      keyFindings: ['Report uploaded successfully', 'AI analysis pending - please refresh the page'],
      riskFactors: [],
      healthScore: 70,
      metrics: {
        vitaminD: { value: null, unit: 'ng/mL', status: 'unknown', normalRange: '30-100' },
        vitaminB12: { value: null, unit: 'pg/mL', status: 'unknown', normalRange: '200-900' },
        hemoglobin: { value: null, unit: 'g/dL', status: 'unknown', normalRange: '12-16' }
      },
      deficiencies: [],
      supplements: [
        {
          category: 'General Health',
          reason: 'Awaiting detailed analysis',
          naturalSources: 'Please refresh the page to get AI-generated recommendations',
          note: 'Analysis will be available shortly'
        }
      ],
      dietPlan: {
        overview: 'Personalized diet plan will be available after detailed analysis',
        breakfast: [],
        lunch: [],
        dinner: [],
        snacks: [],
        foodsToIncrease: ['Consult with healthcare professional for personalized advice'],
        foodsToLimit: [],
        hydration: 'Drink 8-10 glasses of water daily',
        tips: ['Consult with a healthcare professional for personalized advice', 'Refresh the page to get AI-generated recommendations']
      },
      recommendations: {
        lifestyle: ['Maintain a healthy lifestyle', 'Regular exercise', 'Adequate sleep', 'Refresh page for AI recommendations'],
        tests: ['Follow-up tests recommended']
      },
      overallTrend: 'Report analysis pending - please refresh'
    };
  }
};

exports.compareReports = async (currentReport, previousReport, userProfile = {}) => {
  try {
    const prompt = `Compare these two health reports from the same patient and provide insights on health changes.

Previous Report (${new Date(previousReport.createdAt).toLocaleDateString()}):
Type: ${previousReport.reportType}
Metrics: ${JSON.stringify(previousReport.aiAnalysis?.metrics || {})}
Health Score: ${previousReport.aiAnalysis?.healthScore}
Key Findings: ${previousReport.aiAnalysis?.keyFindings?.join(', ')}

Current Report (${new Date(currentReport.createdAt).toLocaleDateString()}):
Type: ${currentReport.reportType}
Metrics: ${JSON.stringify(currentReport.aiAnalysis?.metrics || {})}
Health Score: ${currentReport.aiAnalysis?.healthScore}
Key Findings: ${currentReport.aiAnalysis?.keyFindings?.join(', ')}

Provide comparison in JSON format:
{
  "overallTrend": "improved/declined/stable",
  "healthScoreChange": 5,
  "summary": "Overall health comparison summary",
  "improvements": ["Improvement 1", "Improvement 2"],
  "concerns": ["Concern 1", "Concern 2"],
  "metricChanges": [
    {"metric": "Hemoglobin", "previous": "12.5 g/dL", "current": "14.0 g/dL", "change": "improved", "note": "Now in normal range"}
  ],
  "recommendations": ["Action item 1", "Action item 2"]
}`;

    const content = await makeOpenRouterRequest([
      { role: 'system', content: 'You are a medical AI assistant specializing in health trend analysis.' },
      { role: 'user', content: prompt }
    ]);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid comparison response');
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Comparison Error:', error.response?.data || error.message);
    throw new Error('Failed to compare reports');
  }
};

exports.chatWithReport = async (reportContext, userMessage, chatHistory = []) => {
  try {
    const systemPrompt = `You are a helpful medical AI assistant. The user has uploaded a health report and you're helping them understand it.

Report Context:
- Type: ${reportContext.reportType}
- Date: ${new Date(reportContext.createdAt).toLocaleDateString()}
- Health Score: ${reportContext.aiAnalysis?.healthScore}/100
- Summary: ${reportContext.aiAnalysis?.summary}
- Key Findings: ${reportContext.aiAnalysis?.keyFindings?.join(', ')}
- Metrics: ${JSON.stringify(reportContext.aiAnalysis?.metrics || {})}

Answer the user's questions about their report clearly and helpfully. If they ask about something not in the report, let them know. Always remind them to consult a doctor for medical decisions.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: userMessage }
    ];

    const response = await makeOpenRouterRequest(messages, 1000);
    return response;
  } catch (error) {
    console.error('Chat Error:', error.response?.data || error.message);
    throw new Error('Failed to process your question');
  }
};

// In-memory cache for metric info (server-side)
const metricInfoServerCache = {};
const CACHE_DURATION = 3600000; // 1 hour

// Generate metric information on-the-fly using AI
exports.generateMetricInfo = async (metricName, metricValue, normalRange, unit) => {
  try {
    console.log('generateMetricInfo called with:', { metricName, metricValue, normalRange, unit });
    
    // Check server-side cache first
    const cacheKey = `${metricName.toLowerCase()}-${normalRange}`;
    if (metricInfoServerCache[cacheKey] && Date.now() - metricInfoServerCache[cacheKey].timestamp < CACHE_DURATION) {
      console.log('✅ Using server-side cached metric info for:', metricName);
      return metricInfoServerCache[cacheKey].data;
    }
    
    const prompt = `Generate concise health information for this metric in JSON format. Keep responses SHORT and DIRECT.

Metric: ${metricName}
Current Value: ${metricValue} ${unit}
Normal Range: ${normalRange}

Return ONLY valid JSON (no markdown, no extra text):
{
  "en": {
    "name": "Metric name",
    "whatIsIt": "1-2 sentence explanation",
    "whenHighTitle": "When high",
    "whenHighEffects": ["Effect 1", "Effect 2"],
    "whenLowTitle": "When low",
    "whenLowEffects": ["Effect 1", "Effect 2"],
    "solutions": ["Solution 1", "Solution 2"]
  },
  "hi": {
    "name": "मेट्रिक का नाम",
    "whatIsIt": "1-2 वाक्य व्याख्या",
    "whenHighTitle": "जब अधिक हो",
    "whenHighEffects": ["प्रभाव 1", "प्रभाव 2"],
    "whenLowTitle": "जब कम हो",
    "whenLowEffects": ["प्रभाव 1", "प्रभाव 2"],
    "solutions": ["समाधान 1", "समाधान 2"]
  }
}`;

    console.log('🔄 Calling OpenRouter API for metric info...');
    const content = await makeOpenRouterRequest([
      { role: 'system', content: 'You are a medical AI assistant. Generate health information in JSON format only. Keep responses SHORT.' },
      { role: 'user', content: prompt }
    ], 800); // Reduced token limit for faster response

    console.log('OpenRouter response received, parsing JSON...');
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', content.substring(0, 500));
      throw new Error('Invalid response format');
    }
    
    const metricInfo = JSON.parse(jsonMatch[0]);
    console.log('✨ Successfully parsed metric info');
    
    // Cache the result
    metricInfoServerCache[cacheKey] = {
      data: metricInfo,
      timestamp: Date.now()
    };
    
    return metricInfo;
  } catch (error) {
    console.error('Metric Info Generation Error:', error.message);
    console.error('Full error:', error);
    // Return fallback generic info
    return {
      en: {
        name: metricName,
        whatIsIt: `${metricName} is a health metric. Your current value is ${metricValue} ${unit}, with normal range being ${normalRange}.`,
        whenHighTitle: 'When High',
        whenHighEffects: ['Please consult with a healthcare professional'],
        whenLowTitle: 'When Low',
        whenLowEffects: ['Please consult with a healthcare professional'],
        solutions: ['Consult with your doctor for personalized advice']
      },
      hi: {
        name: metricName,
        whatIsIt: `${metricName} एक स्वास्थ्य मेट्रिक है। आपका वर्तमान मान ${metricValue} ${unit} है।`,
        whenHighTitle: 'जब अधिक हो',
        whenHighEffects: ['कृपया स्वास्थ्य सेवा प्रदाता से परामर्श लें'],
        whenLowTitle: 'जब कम हो',
        whenLowEffects: ['कृपया स्वास्थ्य सेवा प्रदाता से परामर्श लें'],
        solutions: ['व्यक्तिगत सलाह के लिए अपने डॉक्टर से परामर्श लें']
      }
    };
  }
};
