const axios = require('axios');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Using Claude model which is more stable and widely available
// const AI_MODEL = 'google/gemini-2.0-flash-exp:free';
const AI_MODEL = 'anthropic/claude-3-haiku';

const makeOpenRouterRequest = async (messages, maxTokens = 2500) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not set in environment variables');
    }

    console.log('Making OpenRouter request with model:', AI_MODEL);
    
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
    
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('OpenRouter API Error:', {
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

const HEALTH_ANALYSIS_PROMPT = `You are an expert medical AI assistant specializing in nutritional health analysis with focus on natural Indian remedies. Analyze the following health report and provide comprehensive insights.

IMPORTANT: This is for informational wellness support only and should not replace professional medical advice or diagnosis.

Focus on identifying:
1. Vitamin deficiencies (Vitamin B12, Vitamin D, Vitamin C, Iron, Folate, etc.)
2. Basic preventive health indicators
3. Nutritional gaps
4. **IMPORTANT: Extract the "Reported On" or "Report Date" from the document**
5. **IMPORTANT: Extract the patient name from the report**

Extract all numerical values from the report and include them in metrics.

**IMPORTANT: For EACH metric found in the report, generate detailed educational information in BOTH English and Hindi.**

Provide your analysis in the following JSON format:
{
  "patientName": "John Doe",
  "reportDate": "2026-01-15",
  "summary": "Brief overview of the health report focusing on nutritional status",
  "keyFindings": ["Finding 1", "Finding 2"],
  "riskFactors": ["Risk 1", "Risk 2"],
  "healthScore": 75,
  "metrics": {
    "vitaminD": {
      "value": 20,
      "unit": "ng/mL",
      "status": "low",
      "normalRange": "30-100",
      "metricInfo": {
        "en": {
          "name": "Vitamin D",
          "whatIsIt": "Vitamin D is a fat-soluble vitamin that helps your body absorb calcium and maintain strong bones...",
          "whenHighTitle": "When Vitamin D is High (>100 ng/mL)",
          "whenHighEffects": ["Effect 1", "Effect 2"],
          "whenLowTitle": "When Vitamin D is Low (<30 ng/mL)",
          "whenLowEffects": ["Effect 1", "Effect 2"],
          "solutions": ["Solution 1", "Solution 2"]
        },
        "hi": {
          "name": "विटामिन डी",
          "whatIsIt": "विटामिन डी एक वसा में घुलनशील विटामिन है...",
          "whenHighTitle": "जब विटामिन डी अधिक हो (>100 ng/mL)",
          "whenHighEffects": ["प्रभाव 1", "प्रभाव 2"],
          "whenLowTitle": "जब विटामिन डी कम हो (<30 ng/mL)",
          "whenLowEffects": ["प्रभाव 1", "प्रभाव 2"],
          "solutions": ["समाधान 1", "समाधान 2"]
        }
      }
    }
  },
  "deficiencies": [
    {
      "name": "Vitamin D",
      "severity": "moderate",
      "currentValue": "20 ng/mL",
      "normalRange": "30-100 ng/mL",
      "symptoms": ["Fatigue", "Bone pain"],
      "metricInfo": {
        "en": {...},
        "hi": {...}
      }
    }
  ]
}
  "supplements": [
    {"category": "Vitamin D", "reason": "To address Vitamin D deficiency", "naturalSources": "🌞 Get 15-20 mins morning sunlight daily. Eat: Mushrooms, fortified milk, paneer, eggs, fish (salmon, mackerel)", "note": "Sunlight is the best natural source"},
    {"category": "Vitamin B12", "reason": "To improve B12 levels", "naturalSources": "🥚 Eggs, milk, yogurt, paneer, fortified cereals. Non-veg: Chicken, fish, mutton", "note": "Include dairy products daily"},
    {"category": "Iron", "reason": "To boost iron levels", "naturalSources": "🥬 Spinach (palak), beetroot, pomegranate, dates, jaggery, raisins. Non-veg: Chicken liver, mutton", "note": "Pair with vitamin C foods like lemon for better absorption"},
    {"category": "Vitamin C", "reason": "For immunity and iron absorption", "naturalSources": "🍊 Amla (Indian gooseberry), oranges, guava, lemon, tomatoes, bell peppers", "note": "Amla is one of the richest sources"},
    {"category": "Calcium", "reason": "For bone health", "naturalSources": "🥛 Milk, yogurt, paneer, sesame seeds (til), ragi, almonds, green leafy vegetables", "note": "Include dairy in daily diet"},
    {"category": "Omega-3", "reason": "For heart and brain health", "naturalSources": "🐟 Walnuts, flaxseeds (alsi), chia seeds, fish (salmon, sardines)", "note": "Soak flaxseeds before consuming"}
  ],
  "dietPlan": {
    "overview": "Personalized Indian diet plan to address identified deficiencies using natural foods",
    "breakfast": [{"meal": "Poha with vegetables and peanuts", "nutrients": ["Iron", "Vitamin C"], "tip": "Add lemon juice for iron absorption"}, {"meal": "Idli with sambhar", "nutrients": ["Protein", "Iron"], "tip": "Fermented foods aid digestion"}],
    "lunch": [{"meal": "Dal, roti, sabzi, curd", "nutrients": ["Protein", "Calcium", "B12"], "tip": "Include seasonal vegetables"}, {"meal": "Fish curry with rice", "nutrients": ["Vitamin D", "Omega-3", "B12"], "tip": "For non-vegetarians"}],
    "dinner": [{"meal": "Khichdi with vegetables", "nutrients": ["Protein", "Fiber"], "tip": "Easy to digest"}, {"meal": "Roti, dal, paneer sabzi", "nutrients": ["Protein", "Calcium"], "tip": "Light dinner for better sleep"}],
    "snacks": [{"meal": "Handful of almonds and dates", "nutrients": ["Iron", "Calcium"], "tip": "Soak almonds overnight"}, {"meal": "Fruit chaat with chaat masala", "nutrients": ["Vitamin C", "Fiber"], "tip": "Use seasonal fruits"}],
    "foodsToIncrease": ["Leafy greens (palak, methi)", "Seasonal fruits", "Whole grains (ragi, jowar)", "Dairy products", "Nuts and seeds", "Lentils and beans"],
    "foodsToLimit": ["Processed foods", "Excessive tea/coffee", "Refined sugar", "Deep fried foods"],
    "hydration": "Drink 8-10 glasses of water daily. Include coconut water, buttermilk (chaas)",
    "tips": ["Eat meals at regular times", "Include protein with each meal", "Get 15-20 mins of morning sunlight for Vitamin D", "Use iron kadhai for cooking", "Soak nuts and seeds before eating"]
  },
  "recommendations": {
    "lifestyle": ["Get 15-20 minutes of morning sunlight", "Regular yoga or walking", "Adequate sleep (7-8 hours)", "Stress management through meditation"],
    "tests": ["Follow-up vitamin panel in 3 months"]
  },
  "overallTrend": "Summary of health trend based on deficiencies"
}`;

exports.analyzeHealthReport = async (reportText, userProfile = {}) => {
  try {
    const userContext = userProfile.age ? 
      `Patient Info: Age ${userProfile.age}, Gender: ${userProfile.gender || 'Not specified'}, ` +
      `Blood Group: ${userProfile.bloodGroup || 'Unknown'}, ` +
      `Known Allergies: ${userProfile.allergies?.join(', ') || 'None'}, ` +
      `Chronic Conditions: ${userProfile.chronicConditions?.join(', ') || 'None'}` : '';

    const content = await makeOpenRouterRequest([
      { role: 'system', content: HEALTH_ANALYSIS_PROMPT },
      { role: 'user', content: `${userContext}\n\nHealth Report:\n${reportText}` }
    ]);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', content.substring(0, 500));
      throw new Error('Invalid AI response format - no JSON found');
    }
    
    const analysis = JSON.parse(jsonMatch[0]);
    return analysis;
  } catch (error) {
    console.error('AI Analysis Error:', {
      message: error.message,
      apiError: error.response?.data,
      status: error.response?.status
    });
    
    // Fallback: Return a basic analysis structure if API fails
    console.log('Using fallback analysis due to API error');
    return {
      summary: 'Health report received. Please consult with a healthcare professional for detailed analysis.',
      keyFindings: ['Report uploaded successfully', 'Awaiting detailed analysis'],
      riskFactors: [],
      healthScore: 70,
      metrics: {
        vitaminD: { value: null, unit: 'ng/mL', status: 'unknown', normalRange: '30-100' },
        vitaminB12: { value: null, unit: 'pg/mL', status: 'unknown', normalRange: '200-900' },
        hemoglobin: { value: null, unit: 'g/dL', status: 'unknown', normalRange: '12-16' }
      },
      deficiencies: [],
      supplements: [],
      dietPlan: {
        overview: 'Personalized diet plan will be available after detailed analysis',
        breakfast: [],
        lunch: [],
        dinner: [],
        snacks: [],
        foodsToIncrease: [],
        foodsToLimit: [],
        hydration: 'Drink 8-10 glasses of water daily',
        tips: ['Consult with a healthcare professional for personalized advice']
      },
      recommendations: {
        lifestyle: ['Maintain a healthy lifestyle', 'Regular exercise', 'Adequate sleep'],
        tests: ['Follow-up tests recommended']
      },
      overallTrend: 'Report analysis pending'
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
