const axios = require('axios');
require('dotenv').config();

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const AI_MODEL = 'anthropic/claude-3-haiku';

async function testNewAIStructure() {
  console.log('🧪 Testing New AI Analysis Structure...\n');
  
  const sampleReport = `
COMPREHENSIVE HEALTH CHECKUP REPORT
Patient Name: Nitin Nigam
Age: 48 years
Gender: Male
Report Type: Comprehensive Health Checkup
Date of Report: 04 Nov 2025
Referred By: Self

BLOOD TEST RESULTS:

BLOOD SUGAR:
Fasting Glucose: 82.4 mg/dL (Normal: 70-100)

LIPID PROFILE:
Total Cholesterol: 127.1 mg/dL (Normal: <200)
Triglycerides: 76.8 mg/dL (Normal: <150)
HDL: 21.9 mg/dL (Normal: >40)
LDL: 89.84 mg/dL (Normal: <100)
VLDL: 15.36 mg/dL (Normal: <30)

THYROID PROFILE:
T3: 1.44 ng/mL (Normal: 1.4-4.2)
T4: 9.16 µg/dL (Normal: 5.1-14.1)
TSH: 4.18 mIU/L (Normal: 0.4-4.0)

KIDNEY FUNCTION:
Urea: 25.7 mg/dL (Normal: 15-45)
Creatinine: 0.71 mg/dL (Normal: 0.6-1.2)
Uric Acid: 4.02 mg/dL (Normal: 3.5-7.2)
eGFR: 128.59 mL/min (Normal: >60)

COMPLETE BLOOD COUNT:
Hemoglobin: 12.7 g/dL (Normal: 13.5-17.5)
RBC Count: 3.96 x10^6/µL (Normal: 4.5-5.5)
Hematocrit: 37.5% (Normal: 40-50)
MCV: 94.7 fL (Normal: 83-101)
Platelets: 107,000 x10^3/µL (Normal: 150-400)
MPV: 11.6 fL (Normal: 7.4-10.4)

DIFFERENTIAL COUNT:
Neutrophils: 65% (Normal: 50-70)
Lymphocytes: 28% (Normal: 20-40)
Eosinophils: 3% (Normal: 1-4)

URINE ANALYSIS:
Sugar: Absent
Protein: Absent
Ketones: Absent
Pus Cells: 2-3/hpf (Normal: 0-5)
RBCs: Absent
Bacteria: Absent

LIVER FUNCTION TEST:
Total Bilirubin: 3.72 mg/dL (Normal: 0.1-1.2)
Direct Bilirubin: 1.56 mg/dL (Normal: 0.0-0.3)
Indirect Bilirubin: 2.16 mg/dL (Normal: 0.1-0.9)
SGOT (AST): 62.8 U/L (Normal: 10-40)
SGPT (ALT): 34.1 U/L (Normal: 7-56)
ALP: 141.1 U/L (Normal: 30-120)
GGT: 294.2 U/L (Normal: 0-65)
Albumin: 4.2 g/dL (Normal: 3.5-5.0)
Total Protein: 7.1 g/dL (Normal: 6.0-8.3)
`;

  try {
    console.log('📤 Sending request to Claude Haiku...\n');
    
    const HEALTH_ANALYSIS_PROMPT = `You are an expert medical pathologist. Analyze health reports with EXTREME DETAIL like a professional lab report.

CRITICAL: Return ONLY valid JSON, no markdown, no code blocks, no explanations.

IMPORTANT INSTRUCTIONS:
1. Calculate healthScore DYNAMICALLY (NOT always 75):
   - Count abnormal metrics (status = abnormal or borderline)
   - Count severe deficiencies
   - Count moderate deficiencies
   - Formula: 100 - (abnormal_metrics * 5) - (severe_deficiencies * 10) - (moderate_deficiencies * 5)
   - Result should range from 40-100 based on actual findings
   - Example: If 3 abnormal metrics + 1 severe deficiency = 100 - 15 - 10 = 75

2. For Diet Plan - MUST return as ARRAY of meal objects, NOT formatted strings:
   - breakfast: Array of meal objects with {meal, nutrients, tip}
   - lunch: Array of meal objects with {meal, nutrients, tip}
   - dinner: Array of meal objects with {meal, nutrients, tip}
   - snacks: Array of meal objects with {meal, nutrients, tip}
   - Each meal should be specific Indian food with portions
   - Include 4-5 options per meal type
   - Customize based on actual deficiencies found

Return this EXACT JSON structure:
{
  "summary": "Patient Name: NITIN NIGAM, Age: 48 years, Gender: Male, Report Type: Comprehensive Health Checkup, Date of Report: 04 Nov 2025, Referred By: Self. Overall Snapshot: [2-3 line summary]",
  "patientName": "NITIN NIGAM",
  "patientAge": "48",
  "patientGender": "Male",
  "reportType": "Comprehensive Health Checkup",
  "reportDate": "04 Nov 2025",
  "referredBy": "Self",
  "keyFindings": ["[Major issue 1]", "[Major issue 2]", "[Concern 1]", "[Good finding 1]"],
  "metrics": {
    "fastingGlucose": {"value": 82.4, "unit": "mg/dL", "normalRange": "70-100", "status": "normal"},
    "totalCholesterol": {"value": 127.1, "unit": "mg/dL", "normalRange": "<200", "status": "normal"},
    "hdl": {"value": 21.9, "unit": "mg/dL", "normalRange": ">40", "status": "abnormal"},
    "hemoglobin": {"value": 12.7, "unit": "g/dL", "normalRange": "13.5-17.5", "status": "abnormal"},
    "platelets": {"value": 107000, "unit": "10^3/µL", "normalRange": "150-400", "status": "abnormal"},
    "totalBilirubin": {"value": 3.72, "unit": "mg/dL", "normalRange": "0.1-1.2", "status": "abnormal"},
    "ast": {"value": 62.8, "unit": "U/L", "normalRange": "10-40", "status": "abnormal"},
    "ggt": {"value": 294.2, "unit": "U/L", "normalRange": "0-65", "status": "abnormal"},
    "tsh": {"value": 4.18, "unit": "mIU/L", "normalRange": "0.4-4.0", "status": "borderline"}
  },
  "deficiencies": [
    {"name": "Low HDL Cholesterol", "currentValue": "21.9 mg/dL", "normalRange": ">40", "severity": "severe", "symptoms": ["Increased cardiovascular risk", "Poor cholesterol profile"]},
    {"name": "Mild Anemia", "currentValue": "12.7 g/dL", "normalRange": "13.5-17.5", "severity": "moderate", "symptoms": ["Fatigue", "Weakness", "Shortness of breath"]},
    {"name": "Low Platelets", "currentValue": "107000", "normalRange": "150-400", "severity": "moderate", "symptoms": ["Easy bruising", "Bleeding tendency"]},
    {"name": "Liver Dysfunction", "currentValue": "Bilirubin 3.72, AST 62.8, GGT 294.2", "normalRange": "Normal", "severity": "severe", "symptoms": ["Jaundice risk", "Liver stress", "Detoxification issues"]}
  ],
  "supplements": [
    {"category": "Iron & B12", "reason": "For anemia recovery", "naturalSources": "Red meat, spinach, lentils, fortified cereals", "note": "Take with vitamin C for better absorption"},
    {"category": "Omega-3 Fatty Acids", "reason": "To increase HDL cholesterol", "naturalSources": "Fish, walnuts, flaxseeds, chia seeds", "note": "Helps improve lipid profile"},
    {"category": "Milk Thistle", "reason": "For liver support", "naturalSources": "Milk thistle seeds, herbal tea", "note": "Supports liver detoxification"}
  ],
  "dietPlan": {
    "overview": "Personalized diet plan for liver health, anemia recovery, and HDL improvement. Focus on iron-rich foods, omega-3 sources, and liver-supporting nutrients.",
    "breakfast": [
      {"meal": "Vegetable omelette (2 eggs) with 1 multigrain roti and spinach", "nutrients": ["Iron", "Protein", "B12"], "tip": "Add turmeric for liver support"},
      {"meal": "Paneer bhurji (100g paneer) with 1 multigrain roti and tomato", "nutrients": ["Protein", "Calcium", "Iron"], "tip": "Use low-fat paneer"},
      {"meal": "Oats upma (1 cup cooked oats) with vegetables and 1 tsp ghee", "nutrients": ["Fiber", "Iron", "Antioxidants"], "tip": "Add spinach for extra iron"},
      {"meal": "Dosa (2 pieces) with sambar and coconut chutney", "nutrients": ["Protein", "Iron", "Probiotics"], "tip": "Use fermented batter for better digestion"}
    ],
    "lunch": [
      {"meal": "2 multigrain rotis with dal (1 cup) and cooked spinach (1 cup)", "nutrients": ["Iron", "Protein", "Fiber"], "tip": "Add lemon juice to enhance iron absorption"},
      {"meal": "Brown rice (1 cup cooked) with grilled fish (150g) and steamed vegetables", "nutrients": ["Omega-3", "Protein", "B vitamins"], "tip": "Grill instead of frying"},
      {"meal": "Rajma (1 cup) with 2 rotis and raw salad with olive oil", "nutrients": ["Iron", "Fiber", "Antioxidants"], "tip": "Soak rajma overnight for better digestion"},
      {"meal": "Paneer with spinach curry (100g paneer, 2 cups spinach) with 2 rotis", "nutrients": ["Iron", "Calcium", "Protein"], "tip": "Use minimal oil"}
    ],
    "dinner": [
      {"meal": "Vegetable soup (mixed vegetables, 2 cups) with grilled paneer (100g)", "nutrients": ["Vitamins", "Minerals", "Protein"], "tip": "Light and easy to digest"},
      {"meal": "Lentil soup (1 cup) with 1 roti and sautéed vegetables", "nutrients": ["Iron", "Protein", "Fiber"], "tip": "Add ginger for digestion"},
      {"meal": "Grilled fish (150g) with steamed broccoli and sweet potato", "nutrients": ["Omega-3", "Protein", "Antioxidants"], "tip": "Eat 2-3 hours before sleep"},
      {"meal": "Paneer tikka (100g) with cucumber salad and 1 roti", "nutrients": ["Protein", "Calcium", "Vitamins"], "tip": "Bake instead of fry"}
    ],
    "snacks": [
      {"meal": "Roasted chana (1/4 cup) with almonds (5 pieces)", "nutrients": ["Iron", "Protein", "Healthy fats"], "tip": "Soak almonds overnight"},
      {"meal": "Makhana (1/4 cup) roasted with minimal salt", "nutrients": ["Calcium", "Magnesium", "Antioxidants"], "tip": "Light and easy to digest"}
    ],
    "foodsToIncrease": [
      "Spinach and leafy greens (iron source)",
      "Fish and seafood (omega-3 for HDL)",
      "Lentils and beans (iron and fiber)",
      "Nuts and seeds (healthy fats)",
      "Turmeric and ginger (liver support)"
    ],
    "foodsToLimit": [
      "Alcohol (very important for liver)",
      "Fried foods (liver stress)",
      "Red meat (until anemia improves)",
      "Packaged snacks (high sodium)",
      "Sugar and sweets (affects liver)"
    ],
    "hydration": "Drink 8-10 glasses of water daily. Add lemon to enhance iron absorption.",
    "tips": [
      "Eat at regular times to support liver function",
      "Avoid late-night meals",
      "Combine iron-rich foods with vitamin C for better absorption",
      "Limit salt intake to support liver health"
    ]
  },
  "recommendations": {
    "lifestyle": [
      "Brisk walking: 40-45 minutes daily for cardiovascular health",
      "Light strength training: 3 times per week (avoid heavy lifting)",
      "Sleep: 7-8 hours daily for liver recovery",
      "Stress reduction: 10 minutes daily meditation or breathing exercises"
    ],
    "tests": [
      "Repeat LFT (Liver Function Test) in 4-6 weeks",
      "Repeat CBC (Complete Blood Count) in 4-6 weeks",
      "Ultrasound abdomen for liver evaluation",
      "Vitamin B12 and Iron studies",
      "Lipid profile repeat in 8-12 weeks"
    ]
  },
  "healthScore": 65,
  "overallTrend": "Fair"
}`;

    const response = await axios.post(OPENROUTER_API_URL, {
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: HEALTH_ANALYSIS_PROMPT
        },
        {
          role: 'user',
          content: `Analyze this health report:\n\n${sampleReport}`
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5000',
        'X-Title': 'HealthAI'
      },
      timeout: 120000
    });

    console.log('✅ Response received!\n');
    
    let content = response.data.choices[0].message.content;
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const analysis = JSON.parse(content);
    
    console.log('📊 ANALYSIS RESULTS:\n');
    console.log('✅ Patient Name:', analysis.patientName);
    console.log('✅ Age:', analysis.patientAge);
    console.log('✅ Gender:', analysis.patientGender);
    console.log('✅ Report Date:', analysis.reportDate);
    console.log('✅ Health Score:', analysis.healthScore, '(Should be dynamic, not always 75)');
    console.log('✅ Overall Trend:', analysis.overallTrend);
    console.log('\n📋 Key Findings:', analysis.keyFindings?.length || 0, 'items');
    console.log('📊 Metrics Found:', Object.keys(analysis.metrics || {}).length);
    console.log('⚠️ Deficiencies Found:', (analysis.deficiencies || []).length);
    console.log('💊 Supplements Found:', (analysis.supplements || []).length);
    
    console.log('\n🍽️ DIET PLAN STRUCTURE:');
    console.log('✅ Breakfast options:', analysis.dietPlan?.breakfast?.length || 0);
    console.log('✅ Lunch options:', analysis.dietPlan?.lunch?.length || 0);
    console.log('✅ Dinner options:', analysis.dietPlan?.dinner?.length || 0);
    console.log('✅ Snack options:', analysis.dietPlan?.snacks?.length || 0);
    
    if (analysis.dietPlan?.breakfast?.length > 0) {
      console.log('\n🌅 Sample Breakfast Option:');
      console.log('   Meal:', analysis.dietPlan.breakfast[0].meal);
      console.log('   Nutrients:', analysis.dietPlan.breakfast[0].nutrients);
      console.log('   Tip:', analysis.dietPlan.breakfast[0].tip);
    }
    
    console.log('\n✨ Full Analysis:');
    console.log(JSON.stringify(analysis, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('API Error:', error.response.data);
    }
  }
}

testNewAIStructure();
