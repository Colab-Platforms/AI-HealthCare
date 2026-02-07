const axios = require('axios');

console.log('✅ aiService-fixed.js loaded - IMPROVED VERSION WITH EXPLICIT PROMPT');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const AI_MODEL = 'openai/gpt-4'; // Using standard GPT-4 for reliability

const makeAIRequest = async (reportText) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY not set');
    }

    console.log('\n🔄 Making AI request with GPT-4...');
    
    const prompt = `You are a medical report analyzer. Extract information from this health report and return ONLY valid JSON.

HEALTH REPORT TEXT:
${reportText}

CRITICAL INSTRUCTIONS:
1. Extract ACTUAL numeric values from the report (e.g., if report shows "82.4 mg/dl", use 82.4 as the value)
2. Create a 2-3 sentence summary describing the overall health status
3. List 3-5 key findings with actual values mentioned
4. For diet plan, use ONLY INDIAN FOODS (Dal, Roti, Rice, Idli, Dosa, Poha, Upma, Khichdi, Paratha, Sabzi, Curd, Paneer, etc.)
5. Return ONLY the JSON object, no markdown formatting, no extra text

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
    "overview": "Brief overview of dietary recommendations based on the report findings",
    "breakfast": [
      {"meal": "Poha with vegetables", "nutrients": ["Carbs", "Fiber"], "tip": "Add peanuts for protein"},
      {"meal": "Idli with sambar", "nutrients": ["Protein", "Fiber"], "tip": "Use less oil in sambar"},
      {"meal": "Upma with vegetables", "nutrients": ["Carbs", "Vitamins"], "tip": "Add curry leaves"},
      {"meal": "Paratha with curd", "nutrients": ["Carbs", "Protein"], "tip": "Use whole wheat flour"}
    ],
    "lunch": [
      {"meal": "Dal-rice with sabzi", "nutrients": ["Protein", "Fiber"], "tip": "Use minimal oil"},
      {"meal": "Roti with paneer curry", "nutrients": ["Protein", "Calcium"], "tip": "Use low-fat paneer"},
      {"meal": "Khichdi with curd", "nutrients": ["Protein", "Probiotics"], "tip": "Add vegetables"},
      {"meal": "Rice with rajma curry", "nutrients": ["Protein", "Iron"], "tip": "Soak rajma overnight"}
    ],
    "dinner": [
      {"meal": "Roti with dal", "nutrients": ["Protein", "Fiber"], "tip": "Use whole wheat roti"},
      {"meal": "Khichdi with vegetables", "nutrients": ["Protein", "Vitamins"], "tip": "Light and easy to digest"},
      {"meal": "Dosa with sambar", "nutrients": ["Protein", "Fiber"], "tip": "Use fermented batter"},
      {"meal": "Roti with sabzi", "nutrients": ["Fiber", "Vitamins"], "tip": "Include green vegetables"}
    ],
    "snacks": [
      {"meal": "Roasted chana", "nutrients": ["Protein", "Fiber"], "tip": "Unsalted"},
      {"meal": "Fruits with nuts", "nutrients": ["Vitamins", "Healthy fats"], "tip": "Seasonal fruits"},
      {"meal": "Sprouts salad", "nutrients": ["Protein", "Fiber"], "tip": "Add lemon juice"},
      {"meal": "Curd with fruits", "nutrients": ["Protein", "Probiotics"], "tip": "Use low-fat curd"}
    ],
    "foodsToIncrease": ["Green vegetables", "Whole grains", "Lentils", "Seasonal fruits"],
    "foodsToLimit": ["Fried foods", "Refined sugar", "Excess salt", "Processed foods"],
    "hydration": "Drink 8-10 glasses of water daily",
    "tips": [
      "Eat meals at regular times",
      "Include variety of vegetables",
      "Use minimal oil in cooking",
      "Avoid eating late at night"
    ]
  },
  "recommendations": {
    "lifestyle": ["Exercise 30 minutes daily", "Get 7-8 hours sleep", "Manage stress through yoga"],
    "tests": ["Follow-up blood test in 3 months"]
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
      OPENROUTER_API_URL,
      {
        model: AI_MODEL,
        messages: [
          { role: 'system', content: 'You are a medical report analyzer. Always return valid JSON only, no markdown, no extra text.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 4000,
        seed: 42,
        top_p: 1
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.CLIENT_URL || 'https://ai-diagnostic-steel.vercel.app',
          'X-Title': 'HealthAI Platform'
        },
        timeout: 120000
      }
    );

    const content = response.data.choices[0].message.content;
    
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
