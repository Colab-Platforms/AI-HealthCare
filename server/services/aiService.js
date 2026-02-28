const axios = require('axios');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// GPT-4 MODELS ONLY - NO CLAUDE!
const AI_MODELS = [
  'openai/gpt-4-turbo',
  'openai/gpt-4-turbo-preview',
  'openai/gpt-4',
  'openai/gpt-3.5-turbo-16k'
];

let CURRENT_MODEL_INDEX = 0;

const makeOpenRouterRequest = async (messages, maxTokens = 3000, retryCount = 0) => {
  const currentModel = AI_MODELS[CURRENT_MODEL_INDEX] || AI_MODELS[0];

  try {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not set');
    }

    console.log('🔄 Making OpenRouter request with model:', currentModel);
    console.log('API Key present:', !!process.env.OPENROUTER_API_KEY);

    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: currentModel,
        messages,
        temperature: 0,
        max_tokens: maxTokens,
        seed: 42,
        top_p: 1
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:5173',
          'X-Title': 'HealthAI Platform'
        },
        timeout: 120000
      }
    );

    console.log('✅ API call successful with', currentModel);
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('❌ API Error:', error.message);

    if ((error.response?.status === 404 || error.response?.status === 403) &&
      CURRENT_MODEL_INDEX < AI_MODELS.length - 1) {
      console.log('⚠️ Trying next model...');
      CURRENT_MODEL_INDEX++;
      return makeOpenRouterRequest(messages, maxTokens, retryCount + 1);
    }

    throw error;
  }
};

const HEALTH_ANALYSIS_PROMPT = `You are a professional medical report analyzer. Analyze the provided health report text and return a comprehensive JSON object.
    
    JSON STRUCTURE:
    {
      "patientName": "Full name found in report",
      "reportDate": "Date of report (YYYY-MM-DD)",
      "healthScore": 0-100 score (higher is healthier),
      "summary": "2-3 sentence overview of health status",
      "keyFindings": ["3-5 most important findings"],
      "riskFactors": ["Identified health risks"],
      "metrics": {
         "Hemoglobin": { "value": 14.2, "unit": "g/dL", "status": "normal", "normalRange": "12.0 - 16.0" },
         "Glucose (Fasting)": { "value": 110, "unit": "mg/dL", "status": "borderline", "normalRange": "70 - 99" }
      },
      "deficiencies": [
        { "name": "Vitamin D", "severity": "moderate", "currentValue": "15 ng/mL", "normalRange": "30-100", "symptoms": ["Fatigue", "Bone pain"] }
      ],
      "supplements": [
        { "category": "Vitamins", "reason": "Vitamin D deficiency", "naturalSources": "Sunlight, Fatty fish", "note": "Consult doctor for dosage" }
      ],
      "dietPlan": {
        "overview": "Dietary strategy based on results",
        "breakfast": [{ "meal": "Oatmeal", "nutrients": ["Fiber", "Complex carbs"], "tip": "Add nuts" }],
        "lunch": [{ "meal": "Grilled chicken/Tofu salad", "nutrients": ["Protein", "Vitamins"], "tip": "Avoid heavy dressing" }],
        "dinner": [{ "meal": "Lentil soup/Grilled Fish", "nutrients": ["Protein", "low fat"], "tip": "Eat early" }],
        "snacks": [{ "meal": "Walnuts", "nutrients": ["Healthy fats"], "tip": "Small handful" }],
        "foodsToIncrease": ["Leafy greens", "Protein"],
        "foodsToLimit": ["Refined sugar", "Excess salt"],
        "tips": ["Stay hydrated", "Monitor blood sugar"]
      },
      "recommendations": {
        "immediate": ["Quick actions"],
        "shortTerm": ["Next 1-3 months"],
        "longTerm": ["Lifestyle changes"],
        "lifestyle": ["Habits to adopt"],
        "tests": ["Follow-up tests needed"]
      },
      "doctorConsultation": {
        "recommended": true/false,
        "urgency": "low/medium/high/urgent",
        "specializations": ["Endocrinologist", "General Physician"],
        "reason": "Why a doctor is needed"
      }
    }
    
    IMPORTANT: Return ONLY the JSON object. Do not include markdown formatting or extra text.`;

exports.analyzeHealthReport = async (reportText) => {
  try {
    console.log('🔄 Analyzing report...');
    console.log('🤖 Models:', AI_MODELS);

    const content = await makeOpenRouterRequest([
      { role: 'system', content: HEALTH_ANALYSIS_PROMPT },
      { role: 'user', content: reportText }
    ]);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const analysis = JSON.parse(jsonMatch[0]);
    console.log('✅ Analysis complete');
    return analysis;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return {
      patientName: 'Patient',
      healthScore: 70,
      summary: 'Analysis failed',
      keyFindings: ['Error: ' + error.message],
      metrics: {},
      deficiencies: [],
      supplements: [],
      dietPlan: { overview: 'Pending' },
      recommendations: { lifestyle: [] }
    };
  }
};

exports.compareReports = async (currentReport, previousReport) => {
  try {
    const prompt = `You are a medical data analyst. Compare the following two reports for the same patient and identify trends, improvements, and areas of concern.
    
    Current Report (${currentReport.createdAt}):
    ${JSON.stringify(currentReport.aiAnalysis?.metrics || {})}
    
    Previous Report (${previousReport.createdAt}):
    ${JSON.stringify(previousReport.aiAnalysis?.metrics || {})}
    
    Return JSON:
    {
      "overallTrend": "improving / stable / declining",
      "summary": "Brief summary of changes",
      "improvements": ["Items that got better"],
      "deteriorations": ["Items that got worse"],
      "stableMetrics": ["Items that stayed the same"],
      "recommendations": ["Adjusted advice based on trends"]
    }`;

    const content = await makeOpenRouterRequest([
      { role: 'system', content: 'You are a medical trend analyst. Return JSON only.' },
      { role: 'user', content: prompt }
    ]);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Comparison error:', error);
    return { overallTrend: 'unknown', summary: 'Failed to generate comparison.' };
  }
};

exports.chatWithReport = async (report, message, chatHistory) => {
  try {
    const systemPrompt = `You are a medical AI assistant. You have access to the user's health report:
    Report Summary: ${report.aiAnalysis?.summary}
    Health Score: ${report.aiAnalysis?.healthScore}
    Key Findings: ${report.aiAnalysis?.keyFindings?.join(', ')}
    
    Answer the user's questions based on this data. Be helpful but remind them to consult a doctor for serious concerns.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.slice(-5),
      { role: 'user', content: message }
    ];

    return await makeOpenRouterRequest(messages, 1000);
  } catch (error) {
    return "I'm sorry, I'm having trouble analyzing your report right now.";
  }
};

exports.generateMetricInfo = async (metricName, metricValue, normalRange, unit) => {
  try {
    const prompt = `Explain the medical metric "${metricName}" in simple terms.
    Current Value: ${metricValue} ${unit}
    Normal Range: ${normalRange}
    
    Return JSON:
    {
      "whatIsIt": "Simple explanation",
      "significance": "Why it matters",
      "interpretation": "What the user's current value means",
      "actions": ["Steps to take"],
      "dietaryTips": ["Foods that help"]
    }`;

    const content = await makeOpenRouterRequest([
      { role: 'system', content: 'You are a medical educator. Return JSON only.' },
      { role: 'user', content: prompt }
    ], 1000);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    return { whatIsIt: 'Information unavailable.' };
  }
};
