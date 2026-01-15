const axios = require('axios');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const AI_MODEL = 'google/gemini-2.0-flash-exp:free'; // FREE Google Gemini model

const makeOpenRouterRequest = async (messages, maxTokens = 2500) => {
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
      }
    }
  );
  return response.data.choices[0].message.content;
};

const HEALTH_ANALYSIS_PROMPT = `You are an expert medical AI assistant specializing in nutritional health analysis. Analyze the following health report and provide comprehensive insights.

IMPORTANT: This is for informational wellness support only and should not replace professional medical advice or diagnosis.

Focus on identifying:
1. Vitamin deficiencies (Vitamin B12, Vitamin D, Vitamin C, Iron, Folate, etc.)
2. Basic preventive health indicators
3. Nutritional gaps

Extract all numerical values from the report and include them in metrics.

Provide your analysis in the following JSON format:
{
  "summary": "Brief overview of the health report focusing on nutritional status",
  "keyFindings": ["Finding 1", "Finding 2"],
  "riskFactors": ["Risk 1", "Risk 2"],
  "healthScore": 75,
  "metrics": {
    "vitaminD": {"value": 20, "unit": "ng/mL", "status": "low", "normalRange": "30-100"},
    "vitaminB12": {"value": 180, "unit": "pg/mL", "status": "borderline", "normalRange": "200-900"},
    "hemoglobin": {"value": 14.5, "unit": "g/dL", "status": "normal", "normalRange": "12-16"}
  },
  "deficiencies": [
    {"name": "Vitamin D", "severity": "moderate", "currentValue": "20 ng/mL", "normalRange": "30-100 ng/mL", "symptoms": ["Fatigue", "Bone pain"]},
    {"name": "Vitamin B12", "severity": "mild", "currentValue": "180 pg/mL", "normalRange": "200-900 pg/mL", "symptoms": ["Weakness"]}
  ],
  "supplements": [
    {"category": "Vitamin D3", "reason": "To address Vitamin D deficiency", "generalDosage": "1000-2000 IU daily", "note": "Take with fatty meal for better absorption"},
    {"category": "Vitamin B12", "reason": "To improve B12 levels", "generalDosage": "500-1000 mcg daily", "note": "Sublingual form may be better absorbed"}
  ],
  "dietPlan": {
    "overview": "Personalized diet plan to address identified deficiencies",
    "breakfast": [{"meal": "Fortified cereal with milk", "nutrients": ["Vitamin D", "B12", "Iron"], "tip": "Choose whole grain options"}],
    "lunch": [{"meal": "Grilled salmon with leafy greens", "nutrients": ["Vitamin D", "Omega-3", "Iron"], "tip": "Include citrus for iron absorption"}],
    "dinner": [{"meal": "Lean meat with vegetables", "nutrients": ["B12", "Iron", "Zinc"], "tip": "Pair with vitamin C rich foods"}],
    "snacks": [{"meal": "Nuts and seeds", "nutrients": ["Vitamin E", "Magnesium"], "tip": "A handful provides daily needs"}],
    "foodsToIncrease": ["Fatty fish", "Eggs", "Fortified dairy", "Leafy greens", "Citrus fruits"],
    "foodsToLimit": ["Processed foods", "Excessive caffeine", "Alcohol"],
    "hydration": "Drink 8-10 glasses of water daily",
    "tips": ["Eat meals at regular times", "Include protein with each meal", "Get 15 mins of sunlight daily for Vitamin D"]
  },
  "recommendations": {
    "lifestyle": ["Get 15-20 minutes of morning sunlight", "Regular exercise", "Adequate sleep"],
    "tests": ["Follow-up vitamin panel in 3 months"]
  },
  "doctorConsultation": {
    "recommended": true,
    "urgency": "low/medium/high/urgent",
    "specializations": ["General Physician", "Nutritionist"],
    "reason": "Why consultation is needed"
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
    if (!jsonMatch) throw new Error('Invalid AI response format');
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('AI Analysis Error:', error.response?.data || error.message);
    throw new Error('Failed to analyze health report');
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
