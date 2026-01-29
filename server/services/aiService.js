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

const HEALTH_ANALYSIS_PROMPT = `You are an expert medical AI assistant specializing in nutritional health analysis with focus on natural Indian remedies. Analyze the following health report and provide comprehensive insights.

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
