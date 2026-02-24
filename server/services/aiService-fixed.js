const axios = require('axios');

console.log('✅ aiService-fixed.js loaded - IMPROVED VERSION WITH EXPLICIT PROMPT');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const PRIMARY_MODEL = 'anthropic/claude-3.5-sonnet';
const BACKUP_MODEL = 'openai/gpt-4o-mini';
const FALLBACK_MODEL = 'google/gemini-pro-1.5';

const makeAIRequest = async (reportText, userProfile = {}, attempt = 0) => {
  try {
    // Use OpenRouter with Claude - more reliable than direct Anthropic API
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not found');
    }

    const apiUrl = OPENROUTER_API_URL;

    // Select model - try Claude first, then fallback to GPT-4
    let model = PRIMARY_MODEL; // anthropic/claude-3.5-sonnet
    if (attempt === 1) model = BACKUP_MODEL; // openai/gpt-4o-mini
    if (attempt >= 2) model = FALLBACK_MODEL; // google/gemini-pro-1.5

    const fitnessGoal = userProfile?.fitnessProfile?.primaryGoal || userProfile?.nutritionGoal?.goal || 'general health';
    const age = userProfile?.profile?.age || userProfile?.age || 'unknown';
    const gender = userProfile?.profile?.gender || userProfile?.gender || 'unknown';

    console.log(`\n🔄 [Attempt ${attempt + 1}] Making AI request with ${model} via OpenRouter for ${fitnessGoal}...`);

    const prompt = `You are a medical report analyzer. Extract information from this health report and return ONLY valid JSON.

USER PROFILE:
- Age: ${age}
- Gender: ${gender}
- Fitness Goal: ${fitnessGoal}

HEALTH REPORT TEXT:
${reportText}

CRITICAL INSTRUCTIONS:
1. Extract ACTUAL numeric values from the report. DO NOT use "See report" or "Normal". 
   - If report says "Iron: 45 ug/dL", use "45 ug/dL" as currentValue.
   - Extract the reference range as normalRange (e.g. "60-170 ug/dL").
   - This applies to EVERY deficiency you find.
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
    {
      "name": "Vitamin D",
      "severity": "moderate",
      "currentValue": "12 ng/mL",
      "normalRange": "30-100 ng/mL",
      "symptoms": ["Fatigue", "Bone pain"]
    }
  ],
  "supplements": [
    "Recommend supplements based on deficiencies"
  ],
  "dietPlan": {
    "overview": "Summary of dietary approach based on report and goal",
    "breakfast": [
      {"meal": "Option 1 name", "nutrients": ["Nutrient1", "Nutrient2"], "tip": "Cooking or eating tip"},
      {"meal": "Option 2 name", "nutrients": ["Nutrient1", "Nutrient2"], "tip": "Cooking or eating tip"},
      {"meal": "Option 3 name", "nutrients": ["Nutrient1", "Nutrient2"], "tip": "Cooking or eating tip"},
      {"meal": "Option 4 name", "nutrients": ["Nutrient1", "Nutrient2"], "tip": "Cooking or eating tip"}
    ],
    "lunch": [
      {"meal": "Option 1 name", "nutrients": ["Nutrient1", "Nutrient2"], "tip": "Cooking or eating tip"},
      {"meal": "Option 2 name", "nutrients": ["Nutrient1", "Nutrient2"], "tip": "Cooking or eating tip"},
      {"meal": "Option 3 name", "nutrients": ["Nutrient1", "Nutrient2"], "tip": "Cooking or eating tip"},
      {"meal": "Option 4 name", "nutrients": ["Nutrient1", "Nutrient2"], "tip": "Cooking or eating tip"}
    ],
    "dinner": [
      {"meal": "Option 1 name", "nutrients": ["Nutrient1", "Nutrient2"], "tip": "Cooking or eating tip"},
      {"meal": "Option 2 name", "nutrients": ["Nutrient1", "Nutrient2"], "tip": "Cooking or eating tip"},
      {"meal": "Option 3 name", "nutrients": ["Nutrient1", "Nutrient2"], "tip": "Cooking or eating tip"},
      {"meal": "Option 4 name", "nutrients": ["Nutrient1", "Nutrient2"], "tip": "Cooking or eating tip"}
    ],
    "snacks": [
      {"meal": "Option 1 name", "nutrients": ["Nutrient1", "Nutrient2"], "tip": "Cooking or eating tip"},
      {"meal": "Option 2 name", "nutrients": ["Nutrient1", "Nutrient2"], "tip": "Cooking or eating tip"},
      {"meal": "Option 3 name", "nutrients": ["Nutrient1", "Nutrient2"], "tip": "Cooking or eating tip"},
      {"meal": "Option 4 name", "nutrients": ["Nutrient1", "Nutrient2"], "tip": "Cooking or eating tip"}
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
"deficiencies": [
  {
    "name": "Iron deficiency (Anemia)",
    "severity": "moderate",
    "currentValue": "11.6 g/dL",
    "normalRange": "13-17 g/dL",
    "symptoms": ["Weakness", "Dizziness"]
  }
]

NOW ANALYZE THE REPORT AND RETURN ONLY THE JSON OBJECT:`;

    const response = await axios.post(
      apiUrl,
      {
        model: model,
        messages: [
          { role: 'system', content: 'You are a medical report analyzer. Always return valid JSON only, no markdown, no extra text.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 4000
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://fitcure.ai',
          'X-Title': 'FitCure Health'
        },
        timeout: 120000
      }
    );

    let content = '';
    if (!response.data.choices || !response.data.choices[0]) {
      console.error('❌ OpenRouter Error Details:', response.data);
      throw new Error('Invalid response from OpenRouter');
    }
    content = response.data.choices[0].message.content;

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

    // Convert string arrays to object arrays, but ONLY if they are not already objects
    if (analysis.deficiencies.length > 0 && typeof analysis.deficiencies[0] === 'string') {
      analysis.deficiencies = analysis.deficiencies.map(d => ({
        name: d,
        severity: 'moderate',
        currentValue: 'See report',
        normalRange: 'See report',
        symptoms: []
      }));
    } else if (analysis.deficiencies.length > 0) {
      // Ensure all fields exist in objects
      analysis.deficiencies = analysis.deficiencies.map(d => ({
        name: d.name || d.deficiency || 'Unknown deficiency',
        severity: d.severity || 'moderate',
        currentValue: d.currentValue && d.currentValue !== 'See report' ? d.currentValue : 'Extract from report',
        normalRange: d.normalRange && d.normalRange !== 'See report' ? d.normalRange : 'Extract from report',
        symptoms: d.symptoms || []
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
    console.error(`❌ AI Error (Attempt ${attempt + 1}):`, error.response?.data || error.message);

    // Retry logic with fallback models for OpenRouter
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY;
    const isOpenRouter = apiKey?.startsWith('sk-or');

    if (isOpenRouter && attempt < 2) {
      console.log(`⚠️ Attempt ${attempt + 1} failed. Retrying with fallback model...`);
      return makeAIRequest(reportText, userProfile, attempt + 1);
    }

    throw error;
  }
};

exports.analyzeHealthReport = makeAIRequest;

const compareReports = async (currentReport, previousReport) => {
  try {
    const currentText = currentReport.extractedText || JSON.stringify(currentReport.aiAnalysis);
    const previousText = previousReport.extractedText || JSON.stringify(previousReport.aiAnalysis);

    const prompt = `You are a medical data analyst. Compare these two health reports for the same patient and identify trends.
    
    REPORT 1 (Previous - ${previousReport.createdAt}):
    ${previousText.substring(0, 3000)}
    
    REPORT 2 (Current - ${currentReport.createdAt}):
    ${currentText.substring(0, 3000)}
    
    INSTRUCTIONS:
    1. Identify which metrics have improved, worsened, or stayed stable.
    2. Provide an overall trend summary (1-2 sentences).
    3. List 3-5 specific comparison points with values from both reports.
    
    RETURN ONLY VALID JSON:
    {
      "overallTrend": "improving/declining/stable",
      "summary": "Overall trend description",
      "comparisons": [
        { "parameter": "Hemoglobin", "previous": "12.1", "current": "13.5", "trend": "improved", "note": "Normalization of iron levels" }
      ],
      "improvements": ["Metric 1", "Metric 2"],
      "concerns": ["Metric 1"]
    }`;

    // Create a dummy user profile for the request
    const dummyProfile = { age: currentReport.aiAnalysis?.patientAge, gender: currentReport.aiAnalysis?.patientGender };

    return await makeAIRequest(prompt, dummyProfile);
  } catch (error) {
    console.error('❌ Comparison failed:', error.message);
    return { overallTrend: 'stable', summary: 'Could not generate detailed comparison.' };
  }
};

const chatWithReport = async (reportText, userQuestion, history = []) => {
  try {
    const prompt = `You are a medical assistant. Answer the user's question based on their health report.
    
    REPORT CONTENT:
    ${reportText.substring(0, 5000)}
    
    USER QUESTION:
    ${userQuestion}
    
    PAST CONVERSATION:
    ${history.map(h => `${h.role}: ${h.content}`).join('\n')}
    
    INSTRUCTIONS:
    1. Be helpful and professional.
    2. Use data from the report to support your answer.
    3. Always include a disclaimer that you are an AI and they should consult a doctor.
    4. Keep the answer concise.
    
    RESPONSE:`;

    const response = await makeAIRequest(prompt, {});
    // If makeAIRequest returns an object (and this prompt asks for text), try to extract a summary or message
    return typeof response === 'object' ? (response.summary || response.answer || JSON.stringify(response)) : response;
  } catch (error) {
    return "I'm sorry, I'm having trouble analyzing your report right now. Please consult your doctor for medical advice.";
  }
};

exports.compareReports = compareReports;
exports.chatWithReport = chatWithReport;
exports.generateMetricInfo = async () => ({ en: { name: 'Metric' } });
