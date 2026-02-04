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

BIOCHEMISTRY - LIVER FUNCTION TEST:
- Bilirubin Total: 1.47 mg/dL (Normal: 0.3-1.2)
- SGOT (AST): 46.5 U/L (Normal: 13-30)
- SGPT (ALT): 26.7 U/L (Normal: 10-35)
- GGT: 65 U/L (Normal: 10-47)
- Albumin: 3.83 g/dL (Normal: 4.0-5.0)
`;

async function testTwoStepAnalysis() {
  console.log('\n========== TWO-STEP ANALYSIS TEST ==========\n');
  console.log('[TEST] Report length:', testReport.length);
  console.log('[TEST] API Key:', process.env.OPENROUTER_API_KEY ? 'EXISTS' : 'MISSING');
  
  try {
    // Step 1: Extract metrics
    console.log('\n[STEP 1] Extracting metrics...\n');
    
    const metricsResponse = await axios.post(OPENROUTER_API_URL, {
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        { 
          role: 'system', 
          content: `You are a medical data extraction expert. Extract EVERY metric from the health report.
Return ONLY valid JSON with this structure:
{
  "metrics": {
    "MetricName": {"value": number, "unit": "string", "normalRange": "string", "status": "low/normal/high"}
  },
  "reportDate": "date",
  "reportType": "type"
}` 
        },
        { 
          role: 'user', 
          content: `Extract ALL metrics from this report. Return ONLY JSON:\n\n${testReport}` 
        }
      ],
      temperature: 0.1,
      max_tokens: 8000,
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
    
    let metricsContent = metricsResponse.data.choices[0].message.content;
    metricsContent = metricsContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const metricsData = JSON.parse(metricsContent);
    
    console.log('[STEP 1] ✅ Metrics extracted');
    console.log('[STEP 1] Metrics count:', Object.keys(metricsData.metrics || {}).length);
    console.log('[STEP 1] Response length:', metricsContent.length);
    console.log('[STEP 1] Metrics:', JSON.stringify(metricsData.metrics, null, 2));
    
    // Step 2: Generate comprehensive analysis
    console.log('\n[STEP 2] Generating comprehensive analysis...\n');
    
    const analysisResponse = await axios.post(OPENROUTER_API_URL, {
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        { 
          role: 'system', 
          content: `You are a medical analyst. Analyze health metrics and provide comprehensive recommendations.
Return ONLY valid JSON with detailed analysis, deficiencies, food recommendations, and supplements.` 
        },
        { 
          role: 'user', 
          content: `Analyze these metrics and provide comprehensive analysis with deficiencies, food recommendations, and supplements:

Metrics: ${JSON.stringify(metricsData.metrics)}
Report: ${testReport}

Return JSON with: summary, healthScore, deficiencies (array with name, severity, symptoms, explanation), foodRecommendations (object), supplementRecommendations (object), keyFindings (array), recommendations (object with immediate, shortTerm, longTerm, diet, lifestyle, followUpTests)` 
        }
      ],
      temperature: 0.2,
      max_tokens: 8000,
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
    
    let analysisContent = analysisResponse.data.choices[0].message.content;
    analysisContent = analysisContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysisData = JSON.parse(analysisContent);
    
    console.log('[STEP 2] ✅ Analysis generated');
    console.log('[STEP 2] Response length:', analysisContent.length);
    console.log('[STEP 2] Health score:', analysisData.healthScore);
    console.log('[STEP 2] Deficiencies count:', (analysisData.deficiencies || []).length);
    console.log('[STEP 2] Key findings:', analysisData.keyFindings);
    console.log('[STEP 2] Summary:', analysisData.summary);
    
    // Combine results
    const finalAnalysis = {
      patientName: metricsData.patientName || 'Not specified',
      reportDate: metricsData.reportDate || new Date().toLocaleDateString(),
      reportType: metricsData.reportType || 'Health Report',
      metrics: metricsData.metrics || {},
      summary: analysisData.summary || 'Health report analyzed',
      healthScore: analysisData.healthScore || 70,
      deficiencies: analysisData.deficiencies || [],
      foodRecommendations: analysisData.foodRecommendations || {},
      supplementRecommendations: analysisData.supplementRecommendations || {},
      keyFindings: analysisData.keyFindings || [],
      recommendations: analysisData.recommendations || {}
    };
    
    console.log('\n========== FINAL ANALYSIS ==========');
    console.log(JSON.stringify(finalAnalysis, null, 2));
    
  } catch (error) {
    console.error('[TEST] ❌ Error:', error.message);
    if (error.response) {
      console.error('[TEST] Status:', error.response.status);
      console.error('[TEST] Data:', error.response.data);
    }
  }
}

testTwoStepAnalysis();
