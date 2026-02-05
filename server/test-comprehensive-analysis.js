const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const axios = require('axios');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const testReport = `
Patient: NITIN NIGAM, Age: 48 years, Male
Sample Date: Dec 18, 2025

HAEMATOLOGY - COMPLETE BLOOD COUNT:
- Hemoglobin: 11.6 g/dL (Normal: 13.0-17.0)
- RBC Count: 3.78 10^6/µL (Normal: 4.5-5.5)
- Platelets: 113 10^3/µL (Normal: 150-410)
- Total WBC Count: 5.06 10^3/µL (Normal: 4.0-10.0)

BIOCHEMISTRY - LIVER FUNCTION TEST:
- Bilirubin Total: 1.47 mg/dL (Normal: 0.3-1.2)
- SGOT (AST): 46.5 U/L (Normal: 13-30)
- SGPT (ALT): 26.7 U/L (Normal: 10-35)
- GGT: 65 U/L (Normal: 10-47)
- Albumin: 3.83 g/dL (Normal: 4.0-5.0)
`;

async function testComprehensiveAnalysis() {
  console.log('\n========== COMPREHENSIVE ANALYSIS TEST ==========\n');
  console.log('[TEST] Report length:', testReport.length);
  console.log('[TEST] API Key:', process.env.OPENROUTER_API_KEY ? 'EXISTS' : 'MISSING');
  
  try {
    console.log('\n[ANALYSIS] Generating comprehensive analysis...\n');
    
    const analysisResponse = await axios.post(OPENROUTER_API_URL, {
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        { 
          role: 'system', 
          content: `You are an expert medical analyst. Analyze health reports with EXTREME DETAIL and PRECISION.

CRITICAL REQUIREMENTS:
1. Return ONLY valid JSON - no markdown, no code blocks
2. Be VERY SPECIFIC with values and numbers
3. Explain WHAT each metric is, WHY it's abnormal, WHAT causes it, HOW to fix it
4. Include normal ranges and current values for EVERY metric
5. Provide actionable, specific recommendations

JSON Structure MUST include:
{
  "summary": "5-6 sentences covering: overall health status, main issues found, severity level, key concerns, immediate actions needed, positive aspects",
  "healthScore": 50-100,
  "metrics": {
    "MetricName": {
      "value": number,
      "unit": "string",
      "normalRange": "string",
      "status": "low/normal/high",
      "whatIsIt": "detailed explanation of what this metric measures",
      "whyAbnormal": "why it's low/high - specific causes",
      "consequences": "what happens if not corrected",
      "howToFix": "specific steps to normalize",
      "normalizeTime": "estimated time to normalize",
      "foods": ["specific foods to consume"],
      "foodsToAvoid": ["foods to avoid"],
      "supplements": ["specific supplements with dosages"],
      "lifestyle": ["lifestyle changes needed"]
    }
  },
  "keyFindings": ["finding1 with values", "finding2 with values"],
  "deficiencies": [
    {
      "name": "deficiency name",
      "severity": "Mild/Moderate/Severe",
      "currentValue": "value",
      "normalRange": "range",
      "symptoms": ["symptom1", "symptom2"],
      "explanation": "detailed explanation",
      "riskLevel": "Low/Medium/High"
    }
  ],
  "dietPlan": {
    "breakfast": ["specific foods with portions"],
    "lunch": ["specific foods with portions"],
    "dinner": ["specific foods with portions"],
    "snacks": ["healthy snacks"],
    "foodsToAvoid": ["foods to avoid"],
    "hydration": "water intake recommendation",
    "mealTiming": "when to eat",
    "notes": "special dietary notes"
  },
  "fitnessPlan": {
    "cardio": "specific cardio recommendations with duration",
    "strength": "strength training recommendations",
    "flexibility": "stretching/yoga recommendations",
    "frequency": "how many days per week",
    "duration": "duration per session",
    "intensity": "intensity level",
    "precautions": "things to avoid based on health status",
    "progressionPlan": "how to progress over time"
  },
  "recommendations": {
    "immediate": ["action1", "action2"],
    "shortTerm": ["action1", "action2"],
    "longTerm": ["action1", "action2"],
    "lifestyle": ["change1", "change2"],
    "followUpTests": ["test1", "test2"]
  }
}` 
        },
        { 
          role: 'user', 
          content: `ANALYZE THIS HEALTH REPORT WITH EXTREME DETAIL:

${testReport}

REQUIREMENTS:
1. Extract ALL metrics from the report
2. For EACH metric explain: what it is, why it's abnormal, what causes it, how to fix it, normal range
3. Identify ALL deficiencies with severity levels
4. Create a personalized diet plan based on the findings
5. Create a personalized fitness plan based on the findings
6. Provide 5-6 line summary covering overall status, main issues, severity, key concerns, immediate actions, positive aspects
7. Include specific values and numbers in all recommendations
8. Be VERY DETAILED and SPECIFIC - not generic

Return ONLY valid JSON.` 
        }
      ],
      temperature: 0.3,
      max_tokens: 15000,
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
    
    let analysisContent = analysisResponse.data.choices[0].message.content;
    analysisContent = analysisContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysisData = JSON.parse(analysisContent);
    
    console.log('[ANALYSIS] ✅ Analysis generated');
    console.log('[ANALYSIS] Response length:', analysisContent.length, 'characters');
    console.log('[ANALYSIS] Health score:', analysisData.healthScore);
    console.log('[ANALYSIS] Metrics found:', Object.keys(analysisData.metrics || {}).length);
    console.log('[ANALYSIS] Deficiencies found:', (analysisData.deficiencies || []).length);
    console.log('[ANALYSIS] Key findings:', analysisData.keyFindings?.length || 0);
    console.log('[ANALYSIS] Diet plan sections:', Object.keys(analysisData.dietPlan || {}).length);
    console.log('[ANALYSIS] Fitness plan sections:', Object.keys(analysisData.fitnessPlan || {}).length);
    
    console.log('\n========== SAMPLE OUTPUT ==========\n');
    console.log('SUMMARY:');
    console.log(analysisData.summary);
    console.log('\nKEY FINDINGS:');
    analysisData.keyFindings?.forEach((finding, i) => {
      console.log(`${i + 1}. ${finding}`);
    });
    
    console.log('\nMETRICS SAMPLE (First 2):');
    Object.entries(analysisData.metrics || {}).slice(0, 2).forEach(([key, metric]) => {
      console.log(`\n${key}:`);
      console.log(`  Value: ${metric.value} ${metric.unit}`);
      console.log(`  Normal: ${metric.normalRange}`);
      console.log(`  Status: ${metric.status}`);
      console.log(`  What is it: ${metric.whatIsIt?.substring(0, 100)}...`);
    });
    
    console.log('\nDIET PLAN SAMPLE:');
    console.log('Breakfast:', analysisData.dietPlan?.breakfast?.slice(0, 2));
    console.log('Lunch:', analysisData.dietPlan?.lunch?.slice(0, 2));
    
    console.log('\nFITNESS PLAN SAMPLE:');
    console.log('Cardio:', analysisData.fitnessPlan?.cardio?.substring(0, 100));
    console.log('Strength:', analysisData.fitnessPlan?.strength?.substring(0, 100));
    
    console.log('\n========== FULL ANALYSIS ==========');
    console.log(JSON.stringify(analysisData, null, 2));
    
  } catch (error) {
    console.error('[TEST] ❌ Error:', error.message);
    if (error.response) {
      console.error('[TEST] Status:', error.response.status);
      console.error('[TEST] Data:', error.response.data);
    }
  }
}

testComprehensiveAnalysis();
