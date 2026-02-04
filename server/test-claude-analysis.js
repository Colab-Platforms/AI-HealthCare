const axios = require('axios');

const sampleReport = `
BLOOD TEST REPORT
Patient Name: Mr. Kiran Bansale
Age: 34 years
Gender: Male
Report Date: 31/01/2026
Test Date: 30/01/2026

HEMATOLOGY:
Hemoglobin: 9.5 g/dL (Normal: 12-16 g/dL) - LOW
WBC: 7.2 cells/cumm (Normal: 4000-11000)
RBC: 4.8 million/cumm (Normal: 4.5-5.5)
Platelets: 2.5 lakhs/cumm (Normal: 1.5-4.5)

BIOCHEMISTRY:
Glucose (Fasting): 145 mg/dL (Normal: 70-100 mg/dL) - HIGH
Cholesterol: 220 mg/dL (Normal: <200 mg/dL) - HIGH
LDL: 150 mg/dL (Normal: <100 mg/dL) - HIGH
HDL: 35 mg/dL (Normal: >60 mg/dL) - LOW
Triglycerides: 180 mg/dL (Normal: <150 mg/dL) - HIGH

VITAMINS:
Vitamin D: 18 ng/mL (Normal: 30-100 ng/mL) - DEFICIENT
Vitamin B12: 250 pg/mL (Normal: 200-900 pg/mL) - LOW

THYROID:
TSH: 2.5 mIU/mL (Normal: 0.4-4 mIU/mL) - NORMAL
`;

async function testClaudeAnalysis() {
  try {
    console.log('Testing Claude analysis...\n');
    
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { 
            role: 'system', 
            content: `You are an expert medical AI assistant. Analyze health reports with EXTREME ACCURACY.

CRITICAL - YOU MUST:
1. Extract EXACT metric values from the report (do NOT make up values)
2. Extract patient name if present
3. Extract report date
4. Extract report type
5. Identify ALL deficiencies based on normal ranges
6. Create a DETAILED, SPECIFIC summary (NOT generic)

IMPORTANT: If all metrics are normal, say "All parameters are normal" but list which tests were done.
If there are deficiencies, list them specifically with values.

Return ONLY valid JSON:
{
  "patientName": "name or null",
  "reportDate": "DD/MM/YYYY or null",
  "reportType": "Blood Test, Lipid Profile, etc.",
  "summary": "DETAILED summary with specific findings",
  "healthScore": 50-100,
  "metrics": { "name": { "value": X, "unit": "unit", "status": "normal/low/high", "normalRange": "range" } },
  "keyFindings": ["finding1", "finding2"],
  "deficiencies": [],
  "recommendations": { "lifestyle": [], "diet": "", "supplements": [], "tests": [] }
}` 
          },
          { 
            role: 'user', 
            content: `ANALYZE THIS REPORT CAREFULLY. Extract ALL metrics, patient name, date, type, and create a DETAILED summary:\n\n${sampleReport}` 
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      },
      {
        headers: {
          'Authorization': `Bearer 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`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5000',
          'X-Title': 'HealthAI Test'
        },
        timeout: 60000
      }
    );

    const content = response.data.choices[0].message.content;
    console.log('Claude Response:\n', content);
    
    // Try to parse JSON
    let jsonStr = content.trim();
    if (jsonStr.includes('```json')) jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
    else if (jsonStr.includes('```')) jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
    
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      console.log('\n✅ Parsed JSON:');
      console.log('Summary:', analysis.summary);
      console.log('Health Score:', analysis.healthScore);
      console.log('Deficiencies:', analysis.deficiencies?.length || 0);
    } else {
      console.log('\n❌ Could not parse JSON');
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testClaudeAnalysis();
