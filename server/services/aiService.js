const axios = require('axios');
const { robustJsonParse } = require('../utils/aiParser');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-6';
const CLAUDE_HAIKU_MODEL = 'claude-haiku-4-5';

const makeAnthropicRequest = async (messages, maxTokens = 4096, modelOverride = null) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || !apiKey.startsWith('sk-ant')) {
      throw new Error('ANTHROPIC_API_KEY is not set or invalid for direct access');
    }

    const selectedModel = modelOverride || CLAUDE_MODEL;
    console.log('🔄 Anthropic request | model:', selectedModel, '| max_tokens:', maxTokens);

    // Filter out system message to use as 'system' parameter in Anthropic API
    let systemMessage = '';
    const filteredMessages = messages.filter(m => {
      if (m.role === 'system') {
        systemMessage = m.content;
        return false;
      }
      return true;
    });

    // Match timeout to vercel.json maxDuration (120s) minus a small buffer
    const requestTimeout = (process.env.VERCEL || process.env.VERCEL_ID) ? 110000 : 120000;

    const response = await axios.post(
      ANTHROPIC_API_URL,
      {
        model: selectedModel,
        system: systemMessage,
        messages: filteredMessages,
        max_tokens: maxTokens,
        temperature: 0
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
          'Connection': 'close'
        },
        timeout: requestTimeout
      }
    );

    if (response.data && response.data.content && response.data.content[0]) {
      const stopReason = response.data.stop_reason;
      console.log('✅ Anthropic OK, stop_reason:', stopReason);

      if (stopReason === 'max_tokens') {
        console.warn('⚠️ Response TRUNCATED (max_tokens: ' + maxTokens + ')');
      }

      return response.data.content[0].text;
    }

    throw new Error('Invalid response structure from Anthropic API');
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    console.error('❌ Anthropic Error:', errorMsg);
    
    // Add specific Vercel troubleshooting hint
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      throw new Error(`AI Analysis Timed Out: Vercel functions have strict execution limits. Try smaller files.`);
    }
    
    throw new Error(`AI Analysis Failed: ${errorMsg}`);
  }
};

const HEALTH_ANALYSIS_PROMPT = `You are a medical report analyzer. Analyze the health report and return a JSON object. Be CONCISE - use short strings, not paragraphs. Keep each string value under 100 characters.

JSON STRUCTURE (follow EXACTLY):
{
  "patientName": "Name from report",
  "reportDate": "YYYY-MM-DD",
  "healthScore": 75,
  "summary": "Detailed overview of health status. Provide this as a newline-separated list of 3-5 bullet points (start each line with •).",
  "summaryPoints": [
    "Crucial finding 1 with simple explanation",
    "Crucial finding 2 with simple explanation",
    "Overall wellbeing status pointer"
  ],
  "keyFindings": ["finding1", "finding2", "finding3"],
  "riskFactors": ["risk1", "risk2"],
  "metrics": {
    "MetricName": {
      "value": 14.2, 
      "unit": "g/dL", 
      "status": "normal", 
      "normalRange": "12-16",
      "whatIsThis": "Explain what this metric is in very simple layman terms (e.g. 'Hemoglobin is a protein in red blood cells that carries oxygen')",
      "whatItDoes": "Brief explanation of its role in body",
      "lowHighImpact": "What happens if Low (e.g. Fatigue) vs High (e.g. Risk)",
      "topFoods": ["Food 1", "Food 2"],
      "symptoms": ["Symptom 1", "Symptom 2"]
    }
  },
  "deficiencies": [
    {"name": "Vitamin D", "severity": "moderate", "currentValue": "15", "normalRange": "30-100", "symptoms": ["Fatigue"]}
  ],
  "supplements": [
    {"category": "Vitamins", "reason": "Deficiency", "naturalSources": "Foods", "note": "Consult doctor"}
  ],
  "dietPlan": {
    "overview": "Brief dietary strategy based on results",
    "breakfast": [
      {"meal": "Meal Option 1", "nutrients": ["Nutrient"], "tip": "Tip"}
    ],
    "midMorningSnack": [
      {"meal": "Meal Option 1", "nutrients": ["Nutrient"], "tip": "Tip"}
    ],
    "lunch": [
      {"meal": "Meal Option 1", "nutrients": ["Nutrient"], "tip": "Tip"}
    ],
    "eveningSnack": [
      {"meal": "Meal Option 1", "nutrients": ["Nutrient"], "tip": "Tip"}
    ],
    "dinner": [
      {"meal": "Meal Option 1", "nutrients": ["Nutrient"], "tip": "Tip"}
    ],
    "foodsToIncrease": ["food1", "food2", "food3"],
    "foodsToLimit": ["food1", "food2"],
    "tips": ["tip1", "tip2", "tip3"]
  },
  "recommendations": {
    "immediate": ["action1", "action2"],
    "shortTerm": ["action1", "action2"],
    "longTerm": ["action1", "action2"],
    "lifestyle": ["habit1", "habit2"],
    "tests": ["test1"]
  },
  "doctorConsultation": {
    "recommended": true,
    "urgency": "low / medium / high / urgent",
    "specializations": ["Specialist"],
    "reason": "Brief reason"
  },
  "mriData": {
    "bodyRegion": "e.g. Spine, Brain, Knee",
    "studyDate": "Nov 26, 2025",
    "modality": "MRI",
    "accession": "WM2352-109",
    "description": "e.g. MRI Spine Lumbar",
    "institution": "City Hospital PACS",
    "series": [
      {"name": "Localizer", "count": 383, "region": "Whole Body"},
      {"name": "Spine Sagittal T2", "count": 95, "region": "Spine", "active": true},
      {"name": "Spine STIR", "count": 28, "region": "Spine"}
    ],
    "radiologistReport": {
      "findings": "Detailed medical findings from the MRI slices",
      "impressions": ["Key takeaway 1", "Key takeaway 2"],
      "patientFriendlySummary": "Explain the MRI findings in very simple, plain English for a non-medical person (3-4 sentences).",
      "status": "Final",
      "radiologist": "Dr. Smith"
    }
  }
}

CRITICAL RULES:
1. Return ONLY valid JSON. No markdown, no extra text.
2. Keep string values SHORT and CONCISE, EXCEPT for the "summary", "radiologistReport.findings", and "patientFriendlySummary" fields.
3. Include ALL metrics found in the report with correct status (normal/high/low/borderline) for standard lab reports.
4. For MRI reports, SKIP metrics and dietPlan to focus entirely on anatomical findings.
5. Provide EXACTLY 2 meal options for EACH of these 5 categories: "breakfast", "midMorningSnack", "lunch", "eveningSnack", and "dinner". Keep it extremely brief.
6. Use Indian food options when appropriate.
7. Use numbers for numeric values, not strings.
8. Always provide at least 3-5 summaryPoints as individual pointers for the user.
9. If reportType is MRI, populate the "mriData" field comprehensively and skip dietary advice.
10. Do NOT use true/false as unquoted literals in string fields.`;

exports.analyzeHealthReport = async (reportText, user = {}, imageData = null, reportType = 'general') => {
  try {
    console.log(`🔄 Analyzing ${reportType} report...`);

    // Build user profile context for AI
    let userContext = `Report Type: ${reportType}\nUser Profile: `;
    if (user.name) userContext += `Name: ${user.name}, `;
    if (user.profile) {
      if (user.profile.age) userContext += `Age: ${user.profile.age}, `;
      if (user.profile.gender) userContext += `Gender: ${user.profile.gender}, `;
      if (user.profile.dietaryPreference) userContext += `Dietary Preference: ${user.profile.dietaryPreference}, `;
      if (user.profile.medicalHistory?.conditions?.length > 0) {
        userContext += `Conditions: ${user.profile.medicalHistory.conditions.join(', ')}, `;
      }
    }

    const userContent = [];

    // Add text content if available
    if (reportText && reportText.trim().length > 0) {
      userContent.push({
        type: 'text',
        text: `${userContext}\n\nPlease analyze the following health report text:\n\n${reportText}`
      });
    } else if (imageData) {
      // If no text but we have image, add context
      userContent.push({
        type: 'text',
        text: `${userContext}\n\nPlease analyze this health report image.`
      });
    }

    // Add image content if available
    if (imageData && imageData.buffer) {
      const base64Image = imageData.buffer.toString('base64');
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: imageData.mimetype || 'image/jpeg',
          data: base64Image
        }
      });
    }

    if (userContent.length === 0) {
      throw new Error('No content provided for analysis (text or image)');
    }

    const messages = [
      { role: 'system', content: HEALTH_ANALYSIS_PROMPT },
      { role: 'user', content: userContent }
    ];

    // Use 10000 tokens on Vercel to get full analysis (vercel.json maxDuration=120s gives plenty of time)
    // local/non-vercel: 12k for extra room
    const maxTokens = (process.env.VERCEL || process.env.VERCEL_ID) ? 10000 : 12000;

    const content = await makeAnthropicRequest(messages, maxTokens, CLAUDE_MODEL);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ No JSON found in AI response. Raw content:', content.substring(0, 500));
      throw new Error('AI Response was not valid JSON format');
    }

    try {
      const analysis = robustJsonParse(jsonMatch[0]);
      console.log('✅ Analysis complete');
      return analysis;
    } catch (parseError) {
      console.error('❌ JSON Parse Error. Raw content around error:', content.substring(Math.max(0, content.indexOf('{') - 50), 2000));
      throw new Error(`AI Analysis failed: ${parseError.message}`);
    }
  } catch (error) {
    console.error('❌ Error in analyzeHealthReport:', error.message);
    throw error; // Rethrow to let controller handle it
  }
};

exports.compareReports = async (currentReport, previousReport) => {
  try {
    const prompt = `You are a medical data analyst. Compare the following two reports for the same patient and identify trends, improvements, and areas of concern.
    
    Current Report (${currentReport.createdAt}):
    ${JSON.stringify(currentReport.aiAnalysis?.metrics || {})}
    
    Previous Report (${previousReport.createdAt}):
    ${JSON.stringify(previousReport.aiAnalysis?.metrics || {})}
    
    Return JSON:
    {
      "overallTrend": "improving / stable / declining",
      "summary": "Brief summary of changes",
      "improvements": ["Items that got better"],
      "deteriorations": ["Items that got worse"],
      "stableMetrics": ["Items that stayed the same"],
      "recommendations": ["Adjusted advice based on trends"]
    }`;

    const content = await makeAnthropicRequest([
      { role: 'system', content: 'You are a medical trend analyst. Return JSON only.' },
      { role: 'user', content: prompt }
    ]);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { overallTrend: 'unknown', summary: 'No JSON returned' };

    try {
      return robustJsonParse(jsonMatch[0]);
    } catch (e) {
      return { overallTrend: 'unknown', summary: 'JSON parse error in comparison' };
    }
  } catch (error) {
    console.error('Comparison error:', error);
    return { overallTrend: 'unknown', summary: 'Failed to generate comparison.' };
  }
};

exports.chatWithReport = async (report, message, chatHistory) => {
  try {
    const systemPrompt = `You are a medical AI assistant. You have access to the user's health report:
    Report Summary: ${report.aiAnalysis?.summary}
    Health Score: ${report.aiAnalysis?.healthScore}
    Key Findings: ${report.aiAnalysis?.keyFindings?.join(', ')}
    
    Answer the user's questions based on this data. Be helpful but remind them to consult a doctor for serious concerns.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.slice(-5),
      { role: 'user', content: message }
    ];

    return await makeAnthropicRequest(messages, 1000);
  } catch (error) {
    return "I'm sorry, I'm having trouble analyzing your report right now.";
  }
};

exports.generateMetricInfo = async (metricName, metricValue, normalRange, unit) => {
  try {
    const prompt = `Explain the medical metric "${metricName}" in simple terms for a patient.
    Current Value: ${metricValue} ${unit}
    Normal Range: ${normalRange}
    
    Return a JSON object with two keys "en" and "hi".
    The "en" key should contain the English explanation.
    The "hi" key should contain the Hindi translation.
    
    Structure:
    {
      "en": {
        "whatIsIt": "Simple explanation of what this metric is",
        "significance": "Why this metric is important for health",
        "interpretation": "What the current value means exactly for the user",
        "actions": ["Bullet points of what to do"],
        "dietaryTips": ["Food items that help improve this metric"]
      },
      "hi": {
        "whatIsIt": "Hindi translation of whatIsIt",
        "significance": "Hindi translation of significance",
        "interpretation": "Hindi translation of interpretation",
        "actions": ["Hindi translation of actions"],
        "dietaryTips": ["Hindi translation of dietaryTips"]
      }
    }
    
    CRITICAL: Return ONLY valid JSON. Keep it concise.`;

    const content = await makeAnthropicRequest([
      { role: 'system', content: 'You are a medical educator. Return JSON only.' },
      { role: 'user', content: prompt }
    ], 1000);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { whatIsIt: 'JSON Missing' };

    try {
      return robustJsonParse(jsonMatch[0]);
    } catch (e) {
      return { whatIsIt: 'Format error.' };
    }
  } catch (error) {
    return { whatIsIt: 'Information unavailable.' };
  }
};

exports.generateVitalsInsights = async (metricType, history, user) => {
  try {
    const prompt = `Analyze the user's ${metricType} history for the last 7 days and provide professional health advice.
    
    Metric Type: ${metricType}
    History Data: ${JSON.stringify(history)}
    User Profile: ${JSON.stringify(user.profile || {})}
    User Goal: ${JSON.stringify(user.nutritionGoal || {})}
    
    Your goal is to tell the user how they are doing and what they should do for betterment. Be ultra-concise.
    
    Return a JSON object:
    {
      "status": "A very short status (e.g., 'Excellent', 'Stable', 'Needs Work')",
      "analysis": "A one-sentence impact analysis of the trend (e.g. 'Consistent step count shows improved stamina.')",
      "recommendations": ["3-4 very short actionable points (max 5 words each)"],
      "encouragement": "A short motivating one-liner"
    }
    
    CRITICAL: Return ONLY valid JSON. Keep it extremely brief. no fluff. JSON only.`;

    const content = await makeAnthropicRequest([
      { role: 'system', content: 'You are a professional health and fitness AI coach. Return JSON only.' },
      { role: 'user', content: prompt }
    ], 1000);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI response missing JSON');

    return robustJsonParse(jsonMatch[0]);
  } catch (error) {
    console.error('Error generating vitals insights:', error);
    throw error;
  }
};
