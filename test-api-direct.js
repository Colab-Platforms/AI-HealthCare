const axios = require('axios');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const testReport = `
Patient: NITIN NIGAM, Age: 48 years, Male
Sample Date: Dec 18, 2025

HAEMATOLOGY - COMPLETE BLOOD COUNT:
- Hemoglobin: 11.6 g/dL (Normal: 13.0-17.0)
- RBC Count: 3.78 10^6/µL (Normal: 4.5-5.5)
- Platelets: 113 10^3/µL (Normal: 150-410)

BIOCHEMISTRY - LIVER FUNCTION TEST:
- Bilirubin Total: 1.47 mg/dL (Normal: 0.3-1.2)
- SGOT (AST): 46.5 U/L (Normal: 13-30)
- SGPT (ALT): 26.7 U/L (Normal: 10-35)
- GGT: 65 U/L (Normal: 10-47)
- Albumin: 3.83 g/dL (Normal: 4.0-5.0)
`;

async function testAPI() {
  console.log('\n========== DIRECT API TEST ==========\n');
  console.log('[TEST] Report length:', testReport.length);
  console.log('[TEST] API Key:', process.env.OPENROUTER_API_KEY ? 'EXISTS' : 'MISSING');
  
  try {
    console.log('[TEST] Calling GPT-4o with max_tokens: 15000...\n');
    
    const response = await axios.post(OPENROUTER_API_URL, {
      model: 'openai/gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: `You are an expert medical report analyzer. Extract EVERY metric from the report.

Return ONLY valid JSON:
{
  "metrics": {
    "Hemoglobin": {"value": 11.6, "unit": "g/dL", "normalRange": "13.0-17.0", "status": "low"},
    "RBC Count": {"value": 3.78, "unit": "10^6/µL", "normalRange": "4.5-5.5", "status": "low"},
    "Platelets": {"value": 113, "unit": "10^3/µL", "normalRange": "150-410", "status": "low"},
    "AST": {"value": 46.5, "unit": "U/L", "normalRange": "13-30", "status": "high"},
    "ALT": {"value": 26.7, "unit": "U/L", "normalRange": "10-35", "status": "normal"},
    "GGT": {"value": 65, "unit": "U/L", "normalRange": "10-47", "status": "high"},
    "Bilirubin": {"value": 1.47, "unit": "mg/dL", "normalRange": "0.3-1.2", "status": "high"},
    "Albumin": {"value": 3.83, "unit": "g/dL", "normalRange": "4.0-5.0", "status": "low"}
  },
  "summary": "Blood work shows abnormal values",
  "healthScore": 65
}` 
        },
        { 
          role: 'user', 
          content: `Extract ALL metrics from this report:\n\n${testReport}` 
        }
      ],
      temperature: 0.1,
      max_tokens: 15000,
      top_p: 0.9
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5000',
        'X-Title': 'HealthAI'
      },
      timeout: 120000
    });
    
    const content = response.data.choices[0].message.content;
    console.log('[TEST] ✅ API call successful');
    console.log('[TEST] Response length:', content.length);
    console.log('[TEST] Response preview:\n', content.substring(0, 500));
    
    // Try to parse JSON
    try {
      const json = JSON.parse(content);
      console.log('\n[TEST] ✅ JSON parsed successfully');
      console.log('[TEST] Metrics count:', Object.keys(json.metrics || {}).length);
      console.log('[TEST] Health score:', json.healthScore);
      console.log('[TEST] Summary:', json.summary);
    } catch (e) {
      console.log('\n[TEST] ❌ JSON parse failed:', e.message);
    }
    
  } catch (error) {
    console.error('[TEST] ❌ API call failed');
    console.error('[TEST] Error:', error.message);
    if (error.response) {
      console.error('[TEST] Status:', error.response.status);
      console.error('[TEST] Data:', error.response.data);
    }
  }
}

testAPI();
