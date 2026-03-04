const axios = require('axios');
const { robustJsonParse } = require('../utils/aiParser');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-6';

const makeAnthropicRequest = async (messages, maxTokens = 3000) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || !apiKey.startsWith('sk-ant')) {
      throw new Error('ANTHROPIC_API_KEY is not set or invalid for direct access');
    }

    console.log('🔄 Making Anthropic Direct request with model:', CLAUDE_MODEL);

    // Filter out system message to use as 'system' parameter in Anthropic API
    let systemMessage = '';
    const filteredMessages = messages.filter(m => {
      if (m.role === 'system') {
        systemMessage = m.content;
        return false;
      }
      return true;
    });

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
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );

    if (response.data && response.data.content && response.data.content[0]) {
      console.log('✅ Anthropic call successful');
      return response.data.content[0].text;
    }

    throw new Error('Invalid response structure from Anthropic API');
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    console.error('❌ Anthropic Direct Error:', errorMsg);
    throw error;
  }
};

const HEALTH_ANALYSIS_PROMPT = `You are a professional medical report analyzer. Analyze the provided health report text and return a comprehensive JSON object.
    
    JSON STRUCTURE:
    {
      "patientName": "Full name found in report",
      "reportDate": "Date of report (YYYY-MM-DD)",
      "healthScore": 0-100 score (higher is healthier),
      "summary": "2-3 sentence overview of health status",
      "keyFindings": ["3-5 most important findings"],
      "riskFactors": ["Identified health risks"],
      "metrics": {
         "Hemoglobin": { "value": 14.2, "unit": "g/dL", "status": "normal", "normalRange": "12.0 - 16.0" },
         "Glucose (Fasting)": { "value": 110, "unit": "mg/dL", "status": "borderline", "normalRange": "70 - 99" }
      },
      "deficiencies": [
        { "name": "Vitamin D", "severity": "moderate", "currentValue": "15 ng/mL", "normalRange": "30-100", "symptoms": ["Fatigue", "Bone pain"] }
      ],
      "supplements": [
        { "category": "Vitamins", "reason": "Vitamin D deficiency", "naturalSources": "Sunlight, Fatty fish", "note": "Consult doctor for dosage" }
      ],
      "dietPlan": {
        "overview": "Dietary strategy based on results",
        "breakfast": [{ "meal": "Oatmeal", "nutrients": ["Fiber", "Complex carbs"], "tip": "Add nuts" }],
        "lunch": [{ "meal": "Grilled chicken/Tofu salad", "nutrients": ["Protein", "Vitamins"], "tip": "Avoid heavy dressing" }],
        "dinner": [{ "meal": "Lentil soup/Grilled Fish", "nutrients": ["Protein", "low fat"], "tip": "Eat early" }],
        "snacks": [{ "meal": "Walnuts", "nutrients": ["Healthy fats"], "tip": "Small handful" }],
        "foodsToIncrease": ["Leafy greens", "Protein"],
        "foodsToLimit": ["Refined sugar", "Excess salt"],
        "tips": ["Stay hydrated", "Monitor blood sugar"]
      },
      "recommendations": {
        "immediate": ["Quick actions"],
        "shortTerm": ["Next 1-3 months"],
        "longTerm": ["Lifestyle changes"],
        "lifestyle": ["Habits to adopt"],
        "tests": ["Follow-up tests needed"]
      },
      "doctorConsultation": {
        "recommended": true/false,
        "urgency": "low/medium/high/urgent",
        "specializations": ["Endocrinologist", "General Physician"],
        "reason": "Why a doctor is needed"
      }
    }
    
    IMPORTANT: Return ONLY the JSON object. Do not include markdown formatting or extra text.`;

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

    const content = await makeAnthropicRequest(messages);

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
    const prompt = `Explain the medical metric "${metricName}" in simple terms.
    Current Value: ${metricValue} ${unit}
    Normal Range: ${normalRange}
    
    Return JSON:
    {
      "whatIsIt": "Simple explanation",
      "significance": "Why it matters",
      "interpretation": "What the user's current value means",
      "actions": ["Steps to take"],
      "dietaryTips": ["Foods that help"]
    }`;

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
