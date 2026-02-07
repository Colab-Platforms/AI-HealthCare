const axios = require('axios');
require('dotenv').config({ path: './server/.env' });

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const AI_MODEL = 'openai/gpt-4';

// Sample report text
const sampleReport = `
Patient Name: NITIN NIGAM
Age / Sex: 48 years / Male
Ref. Doctor: SELF
Sample ID: 1041168
Registration On: Nov 04, 2025, 03:28 p.m.
Reported On: Nov 04, 2025, 05:48 p.m.

BIOCHEMISTRY
Test Description                Value(s)        Reference Range
GLUCOSE - FASTING
Glucose Fasting(Plasma)        82.4 mg/dl      Normal: 70 - 99
                                               Pre-Diabetic : 100 - 125
                                               Diabetic : >126

LIPID PROFILE
Total Cholesterol              185 mg/dl       Desirable: <200
Triglycerides                  150 mg/dl       Normal: <150
HDL Cholesterol                45 mg/dl        Normal: >40
LDL Cholesterol                110 mg/dl       Optimal: <100

HAEMATOLOGY
Hemoglobin                     13.5 g/dL       Normal: 13-17
WBC Count                      7.5 10^3/µL     Normal: 4-11
RBC Count                      4.8 10^6/µL     Normal: 4.5-5.5

Interpretation:
Fasting Blood Sugar is within normal range.
Lipid profile shows borderline high LDL cholesterol.
Complete blood count is within normal limits.
`;

async function testImprovedPrompt() {
  try {
    console.log('🧪 Testing Improved AI Prompt...\n');
    
    const prompt = `You are a medical report analyzer. Extract information from this health report and return ONLY valid JSON.

HEALTH REPORT TEXT:
${sampleReport}

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

    console.log('📤 Sending request to OpenRouter...');
    
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
          'HTTP-Referer': 'https://ai-diagnostic-steel.vercel.app',
          'X-Title': 'HealthAI Platform'
        },
        timeout: 120000
      }
    );

    const content = response.data.choices[0].message.content;
    
    console.log('\n📦 ========== RAW AI RESPONSE ==========');
    console.log(content);
    console.log('==========================================\n');
    
    // Extract JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ No JSON found in response');
      return;
    }
    
    const analysis = JSON.parse(jsonMatch[0]);
    
    console.log('✅ ========== PARSED ANALYSIS ==========');
    console.log('Patient Name:', analysis.patientName);
    console.log('Patient Age:', analysis.patientAge);
    console.log('Patient Gender:', analysis.patientGender);
    console.log('Health Score:', analysis.healthScore);
    console.log('\nSummary:');
    console.log(analysis.summary);
    console.log('\nKey Findings:', analysis.keyFindings?.length || 0);
    analysis.keyFindings?.forEach((finding, i) => {
      console.log(`  ${i + 1}. ${finding}`);
    });
    console.log('\nMetrics:', Object.keys(analysis.metrics || {}).length);
    Object.entries(analysis.metrics || {}).forEach(([key, metric]) => {
      console.log(`  - ${key}: ${metric.value} ${metric.unit} (${metric.status})`);
    });
    console.log('\nDiet Plan:');
    console.log('  Breakfast:', analysis.dietPlan?.breakfast?.length || 0, 'meals');
    if (analysis.dietPlan?.breakfast?.length > 0) {
      analysis.dietPlan.breakfast.forEach((meal, i) => {
        console.log(`    ${i + 1}. ${meal.meal}`);
      });
    }
    console.log('  Lunch:', analysis.dietPlan?.lunch?.length || 0, 'meals');
    console.log('  Dinner:', analysis.dietPlan?.dinner?.length || 0, 'meals');
    console.log('  Snacks:', analysis.dietPlan?.snacks?.length || 0, 'meals');
    console.log('\nDeficiencies:', analysis.deficiencies?.length || 0);
    console.log('Supplements:', analysis.supplements?.length || 0);
    console.log('==========================================\n');
    
    console.log('✅ Test completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('1. Restart the server: cd server && npm start');
    console.log('2. Upload a new report');
    console.log('3. Verify the analysis displays correctly');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testImprovedPrompt();
