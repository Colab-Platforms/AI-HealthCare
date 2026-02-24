const axios = require('axios');

console.log('✅ aiService-fixed.js loaded - IMPROVED VERSION WITH EXPLICIT PROMPT');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const AI_MODEL = 'claude-3-5-sonnet-20240620';

const makeAIRequest = async (reportText, userProfile = {}) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not set');
    }

    const fitnessGoal = userProfile?.fitnessProfile?.primaryGoal || userProfile?.nutritionGoal?.goal || 'general health';
    const age = userProfile?.age || 'unknown';
    const gender = userProfile?.gender || 'unknown';

    console.log(`\n🔄 Making AI request with Claude 3.5 Sonnet for ${fitnessGoal}...`);

    const prompt = `You are a medical report analyzer. Extract information from this health report and return ONLY valid JSON.

USER PROFILE:
- Age: ${age}
- Gender: ${gender}
- Fitness Goal: ${fitnessGoal}

HEALTH REPORT TEXT:
${reportText}

CRITICAL INSTRUCTIONS:
1. Extract ACTUAL numeric values from the report (e.g., if report shows "82.4 mg/dl", use 82.4 as the value)
2. Create a 2-3 sentence summary describing the overall health status
3. List 3-5 key findings with actual values mentioned
4. For diet plan, use ONLY INDIAN FOODS (Dal, Roti, Rice, Idli, Poha, Upma, Khichdi, Paratha, Sabzi, Curd, Paneer, etc.)
5. PERSONALIZED DIET: Create the diet plan based on the USER'S FITNESS GOAL (${fitnessGoal}) and the report findings.
6. Return ONLY the JSON object, no markdown formatting, no extra text

REQUIRED JSON STRUCTURE (copy this exactly and fill with real data):
{
  "patientName": "Extract from report",
  "patientAge": Extract_number_or_null,
  "patientGender": "Male or Female or null",
  "healthScore": Calculate_0_to_100_based_on_results,
  "summary": "Write 2-3 sentences summarizing the patient's overall health status based on the test results. Mention specific values and whether they are normal or abnormal.",
  "keyFindings": [
    "Glucose Fasting is 82.4 mg/dl which is within normal range (70-99)",
    "Add 2-4 more findings with actual values from the report"
  ],
  "metrics": {
    "glucoseFasting": {
      "value": 82.4,
      "unit": "mg/dl",
      "status": "normal",
      "normalRange": "70-99"
    }
  },
  "deficiencies": [
    "List any vitamin or mineral deficiencies found"
  ],
  "supplements": [
    "Recommend supplements based on deficiencies"
  ],
  "dietPlan": {
    "overview": "Summary of dietary approach based on report and goal",
    "breakfast": [
      {"meal": "Meal name", "nutrients": ["Nutrient1", "Nutrient2"], "tip": "Cooking or eating tip"}
    ],
    "lunch": [
      {"meal": "Meal name", "nutrients": ["Nutrient1", "Nutrient2"], "tip": "Cooking or eating tip"}
    ],
    "dinner": [
      {"meal": "Meal name", "nutrients": ["Nutrient1", "Nutrient2"], "tip": "Cooking or eating tip"}
    ],
    "snacks": [
      {"meal": "Meal name", "nutrients": ["Nutrient1", "Nutrient2"], "tip": "Cooking or eating tip"}
    ],
    "foodsToIncrease": ["Food1", "Food2"],
    "foodsToLimit": ["Food1", "Food2"],
    "hydration": "Specific hydration advice",
    "tips": ["Tip1", "Tip2"]
  },
  "recommendations": {
    "immediate": ["Action 1", "Action 2"],
    "shortTerm": ["Action 1", "Action 2"],
    "longTerm": ["Action 1", "Action 2"],
    "lifestyle": ["Advice 1", "Advice 2"],
    "tests": ["Test 1", "Test 2"]
  }
}

EXAMPLE OF CORRECT OUTPUT:
If report shows "Hemoglobin: 11.6 g/dL (Normal: 13-17)", you should create:
"metrics": {
  "hemoglobin": {
    "value": 11.6,
    "unit": "g/dL",
    "status": "low",
    "normalRange": "13-17"
  }
}

NOW ANALYZE THE REPORT AND RETURN ONLY THE JSON OBJECT:`;

    const response = await axios.post(
      ANTHROPIC_API_URL,
      {
        model: AI_MODEL,
        max_tokens: 4000,
        messages: [
          { role: 'user', content: prompt }
        ],
        system: 'You are a medical report analyzer. Always return valid JSON only, no markdown, no extra text.'
      },
      {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );

    const content = response.data.content[0].text;

    console.log('\n📦 ========== FULL AI RESPONSE ==========');
    console.log(content.substring(0, 2000));
    console.log('==========================================\n');

    // Extract JSON - handle markdown code blocks
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ No JSON in response');
      throw new Error('Invalid AI response - no JSON found');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    console.log('✅ Parsed successfully');
    console.log('Patient:', analysis.patientName);
    console.log('Health Score:', analysis.healthScore);
    console.log('Summary length:', analysis.summary?.length || 0);
    console.log('Key Findings:', analysis.keyFindings?.length || 0);
    console.log('Metrics:', Object.keys(analysis.metrics || {}).length);
    console.log('Diet Plan Breakfast:', analysis.dietPlan?.breakfast?.length || 0);

    // Ensure healthScore is a number
    if (typeof analysis.healthScore === 'string') {
      analysis.healthScore = 75;
    }
    analysis.healthScore = Math.max(0, Math.min(100, Number(analysis.healthScore) || 75));

    // Ensure arrays
    if (!Array.isArray(analysis.keyFindings)) analysis.keyFindings = [];
    if (!Array.isArray(analysis.deficiencies)) analysis.deficiencies = [];
    if (!Array.isArray(analysis.supplements)) analysis.supplements = [];

    // Convert string arrays to object arrays
    if (analysis.deficiencies.length > 0 && typeof analysis.deficiencies[0] === 'string') {
      analysis.deficiencies = analysis.deficiencies.map(d => ({
        name: d,
        severity: 'moderate',
        currentValue: 'See report',
        normalRange: 'See report',
        symptoms: []
      }));
    }

    if (analysis.supplements.length > 0 && typeof analysis.supplements[0] === 'string') {
      analysis.supplements = analysis.supplements.map(s => ({
        category: s,
        reason: 'Based on report findings',
        naturalSources: 'Consult healthcare professional',
        note: 'Consult doctor for dosage'
      }));
    }

    return analysis;

  } catch (error) {
    console.error('❌ AI Error:', error.message);
    throw error;
  }
};

exports.analyzeHealthReport = makeAIRequest;

// Dummy exports for compatibility
exports.compareReports = async () => ({ overallTrend: 'stable' });
exports.chatWithReport = async () => 'Please consult your doctor';
exports.generateMetricInfo = async () => ({ en: { name: 'Metric' } });
