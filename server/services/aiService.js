const axios = require('axios');
const { robustJsonParse } = require('../utils/aiParser');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-3-5-sonnet-latest';
const CLAUDE_HAIKU_MODEL = 'claude-3-5-haiku-latest';

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
    const requestTimeout = (process.env.VERCEL || process.env.VERCEL_ID) ? 140000 : 150000;

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

const HEALTH_ANALYSIS_PROMPT = `Analyze this health report as an expert medical AI. Be extremely concise and fast.

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
      "whatIsThis": "ONE SENTENCE (only for non-normal metrics)",
      "topFoods": ["Indian foods only if low/high"],
      "symptoms": ["Only if low/high"]
    }
  },
  "deficiencies": [{"name": "Vit D", "severity": "mod", "currentValue": "15"}],
  "recommendations": {"immediate": ["action1"], "lifestyle": ["habit1"]},
  "doctorConsultation": {"recommended": true, "urgency": "low-high", "specializations": ["Specialist"]},
  "mriData": {
    "findings": "Anatomical findings",
    "impressions": ["takeaway"],
    "patientFriendlySummary": "3-4 simple sentences"
  }
}

RULES:
1. Provide medical details/foods ONLY for flagged/abnormal results. Keep normal results brief.
2. Return ONLY valid JSON. 
3. Include max 12 most critical lab metrics to ensure speed.
4. MRI reports focus on anatomical findings.`;

exports.analyzeHealthReport = async (reportText, user = {}, imageData = null, reportType = 'general') => {
  try {
    console.log(`🔄 Analyzing ${reportType} report...`);

    let userContext = `Type: ${reportType}\nProfile: `;
    if (user.name) userContext += `${user.name}, `;
    if (user.profile?.age) userContext += `${user.profile.age}y, `;
    if (user.profile?.gender) userContext += `${user.profile.gender}, `;

    const userContent = [];
    if (reportText && reportText.trim().length > 0) {
      // Truncate text to avoid huge payloads that slow down analysis
      const truncatedText = reportText.length > 30000 ? reportText.substring(0, 30000) + '...[truncated]' : reportText;
      userContent.push({
        type: 'text',
        text: `${userContext}\n\nReport Text:\n${truncatedText}`
      });
    }

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

    if (userContent.length === 0) throw new Error('No content provided');

    const messages = [
      { role: 'system', content: HEALTH_ANALYSIS_PROMPT },
      { role: 'user', content: userContent }
    ];

    const maxTokens = (process.env.VERCEL || process.env.VERCEL_ID) ? 8000 : 10000;
    const content = await makeAnthropicRequest(messages, maxTokens, CLAUDE_MODEL);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI Response invalid format');

    return robustJsonParse(jsonMatch[0]);
  } catch (error) {
    console.error('❌ AI Analysis Error:', error.message);
    throw error;
  }
};

exports.compareReports = async (currentReport, previousReport) => {
  try {
    const prompt = `Trend analyzer: Compare reports.\nCurrent: ${JSON.stringify(currentReport.aiAnalysis?.metrics || {})}\nPrev: ${JSON.stringify(previousReport.aiAnalysis?.metrics || {})}\nReturn JSON: {"overallTrend": "improving/declining", "summary": "brief", "improvements": [], "deteriorations": []}`;
    const content = await makeAnthropicRequest([{ role: 'user', content: prompt }], 1000, CLAUDE_HAIKU_MODEL);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch ? robustJsonParse(jsonMatch[0]) : { overallTrend: 'stable' };
  } catch (e) { return { overallTrend: 'unknown' }; }
};

exports.chatWithReport = async (report, message, chatHistory) => {
  try {
    const systemPrompt = `AI medical assistant. Report: ${report.aiAnalysis?.summary}. Findings: ${report.aiAnalysis?.keyFindings?.join(', ')}`;
    return await makeAnthropicRequest([{ role: 'system', content: systemPrompt }, ...chatHistory.slice(-4), { role: 'user', content: message }], 800, CLAUDE_HAIKU_MODEL);
  } catch (e) { return "I'm sorry, I'm having trouble analyzing your report right now."; }
};

exports.generateMetricInfo = async (metricName, metricValue, normalRange, unit) => {
  try {
    const prompt = `Metric Educator. Explain "${metricName}" (${metricValue} ${unit}, Normal: ${normalRange}). JSON: {"en": {"whatIsIt": "", "significance": "", "interpretation": ""}, "hi": {...}}`;
    const content = await makeAnthropicRequest([{ role: 'user', content: prompt }], 1000, CLAUDE_HAIKU_MODEL);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch ? robustJsonParse(jsonMatch[0]) : { whatIsIt: 'Missing' };
  } catch (e) { return { whatIsIt: 'Error' }; }
};

exports.generateVitalsInsights = async (metricType, history, user) => {
  try {
    const prompt = `Health Coach. ${metricType} history: ${JSON.stringify(history)}. Return JSON: {"status": "", "analysis": "", "recommendations": []}`;
    const content = await makeAnthropicRequest([{ role: 'user', content: prompt }], 800, CLAUDE_HAIKU_MODEL);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch ? robustJsonParse(jsonMatch[0]) : null;
  } catch (e) { throw e; }
};
