const axios = require('axios');
const { robustJsonParse } = require('../utils/aiParser');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// 🚨 USER SPECIFIC MODEL - The user insists on using 'claude-sonnet-4-6' for EVERYTHING
const CLAUDE_MODEL = 'claude-sonnet-4-6'; 
const CLAUDE_HAIKU_MODEL = 'claude-sonnet-4-6';

const makeAnthropicRequest = async (messages, maxTokens = 4096, modelOverride = null) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const selectedModel = modelOverride || CLAUDE_MODEL;

    console.log(`🔄 Anthropic | Model: ${selectedModel} | Tokens: ${maxTokens}`);

    // Filter messages for Anthropic structure
    let systemMessage = '';
    const filteredMessages = messages.filter(m => {
      if (m.role === 'system') {
        systemMessage = m.content;
        return false;
      }
      return true;
    });

    const requestTimeout = (process.env.VERCEL || process.env.VERCEL_ID) ? 280000 : 150000;

    const response = await axios.post(
      ANTHROPIC_API_URL,
      {
        model: selectedModel,
        system: systemMessage,
        messages: filteredMessages,
        max_tokens: maxTokens || 4000,
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
      return response.data.content[0].text;
    }
    throw new Error('Invalid response');
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    console.error('❌ Anthropic Error:', errorMsg);
    throw new Error(`AI Analysis Failed: ${errorMsg}`);
  }
};

const HEALTH_ANALYSIS_PROMPT = `Analyze this health report as an expert medical AI. You MUST extract EVERY SINGLE health marker, lab result, and medical observation found in the report text without exception.
STRUCTURE:
{
  "patientName": "Name",
  "reportDate": "YYYY-MM-DD",
  "healthScore": 75,
  "summary": "Short 3-5 bullet points (•).",
  "summaryPoints": ["Brief findings"],
  "keyFindings": ["finding1"],
  "metrics": {
    "MetricName": {
      "value": 14.2, 
      "unit": "unit", 
      "status": "normal/high/low", 
      "normalRange": "range",
      "whatIsThis": "1-line definition of this marker",
      "whatItDoes": "Detailed role this marker plays in the body",
      "lowHighImpact": "What it means when this value is low or high for health",
      "topFoods": ["Food1", "Food2", "Food3"],
      "symptoms": ["Symptom1", "Symptom2"]
    }
  },
  "deficiencies": [{"name": "Vit D", "severity": "mild/moderate/severe"}],
  "recommendations": {"immediate": [], "lifestyle": []},
  "doctorConsultation": {"recommended": true, "urgency": "low", "specializations": ["Specialist"]}
}
CRITICAL: Extraction is your priority. Scan the entire report text and populate the "metrics" object with ALL found markers. For EACH metric, you MUST fill in whatIsThis, whatItDoes, lowHighImpact, topFoods, and symptoms.
IMPORTANT: Deficiency "severity" MUST be one of: "mild", "moderate", "severe".`;

exports.analyzeHealthReport = async (reportText, user = {}, imageData = null, reportType = 'general') => {
  try {
    let userContext = `User: ${user.name || 'Patient'}. Type: ${reportType}`;
    const userContent = [];
    
    if (reportText) {
      userContent.push({ type: 'text', text: `${userContext}\n\nReport:\n${reportText.substring(0, 30000)}` });
    }

    if (imageData && imageData.buffer) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: imageData.mimetype || 'image/jpeg', data: imageData.buffer.toString('base64') }
      });
    }

    const messages = [{ role: 'system', content: HEALTH_ANALYSIS_PROMPT }, { role: 'user', content: userContent }];
    const content = await makeAnthropicRequest(messages, 8000); // 8000 tokens for comprehensive extraction

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI format invalid');
    return robustJsonParse(jsonMatch[0]);
  } catch (error) {
    throw error;
  }
};

exports.compareReports = async (currentReport, previousReport) => {
  try {
    const prompt = `Compare: ${JSON.stringify(currentReport.aiAnalysis?.metrics)} and ${JSON.stringify(previousReport.aiAnalysis?.metrics)}. Return JSON {"overallTrend": "improving/declining"}`;
    const content = await makeAnthropicRequest([{ role: 'user', content: prompt }], 1000, CLAUDE_HAIKU_MODEL);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch ? robustJsonParse(jsonMatch[0]) : { overallTrend: 'stable' };
  } catch (e) { return { overallTrend: 'unknown' }; }
};

exports.chatWithReport = async (report, message, chatHistory) => {
  try {
    const systemPrompt = `Assistant for report: ${report.aiAnalysis?.summary}`;
    return await makeAnthropicRequest([{ role: 'system', content: systemPrompt }, ...chatHistory.slice(-4), { role: 'user', content: message }], 800, CLAUDE_HAIKU_MODEL);
  } catch (e) { return "Trouble analyzing right now."; }
};

exports.generateMetricInfo = async (metricName, metricValue, normalRange, unit) => {
  try {
    const prompt = `Provide a professional medical explanation for the health metric "${metricName}" with a current value of ${metricValue} ${unit} (Normal Range: ${normalRange}). 
    
    Return ONLY a JSON object with this structure:
    {
      "en": {
        "whatIsIt": "A concise 1-sentence medical definition.",
        "whatItDoes": "Detailed explanation of its physiological role.",
        "significance": "What the current status (${metricValue} ${unit}) specifically means for health.",
        "dietaryTips": ["Food 1", "Food 2", "Food 3"],
        "symptoms": ["Symptom 1", "Symptom 2"],
        "actions": ["Action 1", "Action 2"]
      }
    }`;
    
    const content = await makeAnthropicRequest([{ role: 'user', content: prompt }], 1200, CLAUDE_HAIKU_MODEL);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch ? robustJsonParse(jsonMatch[0]) : null;
  } catch (e) { 
    console.error('generateMetricInfo error:', e);
    return null; 
  }
};

exports.generateVitalsInsights = async (metricType, history, user) => {
  try {
    const prompt = `Insights for ${metricType}: ${JSON.stringify(history)}. JSON {"analysis": ""}`;
    const content = await makeAnthropicRequest([{ role: 'user', content: prompt }], 800, CLAUDE_HAIKU_MODEL);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch ? robustJsonParse(jsonMatch[0]) : null;
  } catch (e) { return null; }
};

exports.generateHealthDNA = async (userData, metricsSummary, recentTrends) => {
  try {
    const prompt = `Create a "Complete Health DNA Profile" for ${userData.name}.
    Context:
    - User Profile: ${JSON.stringify(userData)}
    - Aggregated Lab Metrics: ${JSON.stringify(metricsSummary)}
    - Recent Vitals Trends: ${JSON.stringify(recentTrends)}

    Return ONLY a JSON object with this structure:
    {
      "personality": {
        "title": "Short catchy title (e.g. The Balanced Athlete)",
        "motto": "A health motto",
        "description": "2-3 sentences describing their current health state/archetype"
      },
      "organHealth": [
        { "organ": "Heart", "score": 85, "status": "Optimal", "detail": "Detail based on BP/Heart rate" },
        { "organ": "Kidneys", "score": 75, "status": "Good", "detail": "Detail based on Urea/Creatinine" },
        { "organ": "Metabolism", "score": 60, "status": "Needs Focus", "detail": "Detail based on Glucose/A1c" }
      ],
      "riskAssessment": [
        { "hazard": "Diabetes", "riskLevel": "Moderate", "trend": "Increasing", "prevention": "Top advice" }
      ],
      "nutritionalGaps": {
        "critical": ["Vitamin D"],
        "optimal": ["Iron"],
        "advice": "Summary dietary advice"
      },
      "healthStory": "A long-form, 200-word personalized narrative of their health journey based on all data. Mention improvements or areas of regression."
    }`;
    
    const content = await makeAnthropicRequest([{ role: 'user', content: prompt }], 2500, CLAUDE_MODEL);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch ? robustJsonParse(jsonMatch[0]) : null;
  } catch (e) {
    console.error('generateHealthDNA error:', e);
    return null;
  }
};

