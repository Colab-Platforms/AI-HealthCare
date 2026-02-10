const axios = require('axios');
require('dotenv').config();

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function testAIAnalysis() {
  console.log('🧪 Testing AI Analysis with OpenRouter...\n');
  
  const sampleReport = `
BLOOD TEST REPORT
Patient: John Doe
Age: 35
Date: 2024-02-05

COMPLETE BLOOD COUNT (CBC):
Hemoglobin: 12.5 g/dL (Normal: 13.5-17.5 g/dL for males)
Total WBC Count: 7.2 x10^3/µL (Normal: 4.5-11.0)
RBC Count: 4.8 x10^6/µL (Normal: 4.5-5.5)
Hematocrit: 38% (Normal: 40-50%)
Platelets: 250 x10^9/L (Normal: 150-400)

METABOLIC PANEL:
Glucose: 125 mg/dL (Normal: 70-100 mg/dL)
Creatinine: 1.1 mg/dL (Normal: 0.6-1.2)
BUN: 18 mg/dL (Normal: 7-20)
Calcium: 9.2 mg/dL (Normal: 8.5-10.2)

LIPID PROFILE:
Total Cholesterol: 220 mg/dL (Normal: <200)
LDL: 145 mg/dL (Normal: <100)
HDL: 35 mg/dL (Normal: >40)
Triglycerides: 180 mg/dL (Normal: <150)

LIVER FUNCTION:
ALT: 45 U/L (Normal: 7-56)
AST: 38 U/L (Normal: 10-40)
Bilirubin: 0.8 mg/dL (Normal: 0.1-1.2)

VITAMINS:
Vitamin D: 28 ng/mL (Normal: 30-100)
Vitamin B12: 450 pg/mL (Normal: 200-900)
`;

  try {
    console.log('📤 Sending request to GPT-4 Turbo...\n');
    
    const response = await axios.post(OPENROUTER_API_URL, {
      model: 'openai/gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: `You are an expert medical analyst. Analyze health reports with extreme detail.
Return ONLY valid JSON with no markdown or code blocks.
Include: summary (with patient info), healthScore, metrics, keyFindings, deficiencies, dietPlan, recommendations.
For dietPlan, provide 3-4 Indian food options per meal.`
        },
        {
          role: 'user',
          content: `Analyze this health report for John Doe (Age: 35):

${sampleReport}

Return complete analysis as JSON only.`
        }
      ],
      temperature: 0.3,
      max_tokens: 16000,
      top_p: 0.95
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
    console.log('Summary:', analysis.summary?.substring(0, 150) + '...\n');
    console.log('Health Score:', analysis.healthScore);
    console.log('Metrics Found:', Object.keys(analysis.metrics || {}).length);
    console.log('Deficiencies Found:', (analysis.deficiencies || []).length);
    console.log('Key Findings:', (analysis.keyFindings || []).length);
    console.log('\n✨ Full Analysis:');
    console.log(JSON.stringify(analysis, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('API Error:', error.response.data);
    }
  }
}

testAIAnalysis();
