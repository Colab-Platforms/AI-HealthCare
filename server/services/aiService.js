const axios = require('axios');
const { robustJsonParse } = require('../utils/aiParser');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = process.env.VERCEL ? 'claude-3-5-haiku-20241022' : 'claude-sonnet-4-6';

const makeAnthropicRequest = async (messages, maxTokens = 4096) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || !apiKey.startsWith('sk-ant')) {
      throw new Error('ANTHROPIC_API_KEY is not set or invalid for direct access');
    }

    console.log('🔄 Anthropic request | model:', CLAUDE_MODEL, '| max_tokens:', maxTokens);

    // Filter out system message to use as 'system' parameter in Anthropic API
    let systemMessage = '';
    const filteredMessages = messages.filter(m => {
      if (m.role === 'system') {
        systemMessage = m.content;
        return false;
      }
      return true;
    });

    // Use shorter timeout on Vercel to stay within serverless limits (maxDuration is 120s)
    const requestTimeout = process.env.VERCEL ? 110000 : 120000;

    const response = await axios.post(
      ANTHROPIC_API_URL,
      {
        model: CLAUDE_MODEL,
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
    throw error;
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
      {"meal": "Meal Option 1", "nutrients": ["Nutrient"], "tip": "Tip"},
      {"meal": "Meal Option 2", "nutrients": ["Nutrient"], "tip": "Tip"},
      {"meal": "Meal Option 3", "nutrients": ["Nutrient"], "tip": "Tip"},
      {"meal": "Meal Option 4", "nutrients": ["Nutrient"], "tip": "Tip"}
    ],
    "lunch": [
      {"meal": "Meal 1", "nutrients": ["Nutrient"], "tip": "Tip"},
      {"meal": "Meal 2", "nutrients": ["Nutrient"], "tip": "Tip"},
      {"meal": "Meal 3", "nutrients": ["Nutrient"], "tip": "Tip"},
      {"meal": "Meal 4", "nutrients": ["Nutrient"], "tip": "Tip"}
    ],
    "dinner": [
      {"meal": "Meal 1", "nutrients": ["Nutrient"], "tip": "Tip"},
      {"meal": "Meal 2", "nutrients": ["Nutrient"], "tip": "Tip"},
      {"meal": "Meal 3", "nutrients": ["Nutrient"], "tip": "Tip"},
      {"meal": "Meal 4", "nutrients": ["Nutrient"], "tip": "Tip"}
    ],
    "snacks": [
      {"meal": "Snack 1", "nutrients": ["Nutrient"], "tip": "Tip"},
      {"meal": "Snack 2", "nutrients": ["Nutrient"], "tip": "Tip"},
      {"meal": "Snack 3", "nutrients": ["Nutrient"], "tip": "Tip"},
      {"meal": "Snack 4", "nutrients": ["Nutrient"], "tip": "Tip"}
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
    "urgency": "low",
    "specializations": ["Specialist"],
    "reason": "Brief reason"
  }
}

CRITICAL RULES:
1. Return ONLY valid JSON. No markdown, no extra text.
2. Keep string values SHORT and CONCISE, EXCEPT for the "summary" field which should be detailed and thorough.
3. Include ALL metrics found in the report with correct status (normal/high/low/borderline).
4. Provide EXACTLY 4 meal options for EACH meal category (breakfast, lunch, dinner, snacks).
5. Use Indian food options when appropriate.
6. Use numbers for numeric values, not strings.
7. Always provide at least 3-5 summaryPoints as individual pointers for the user.
8. Do NOT use true/false as unquoted literals in string fields.`;

exports.analyzeHealthReport = async (reportText, user = {}, imageData = null) => {
  try {
    console.log('🔄 Analyzing report...');

    // Build user profile context for AI
    let userContext = "User Profile: ";
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

    // Use fewer tokens on Vercel to stay within timeout limits
    const maxTokens = process.env.VERCEL ? 8000 : 20000;
    const content = await makeAnthropicRequest(messages, maxTokens);

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
