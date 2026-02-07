const axios = require('axios');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// GPT-4 MODELS ONLY - NO CLAUDE!
const AI_MODELS = [
  'openai/gpt-4-turbo',
  'openai/gpt-4-turbo-preview',
  'openai/gpt-4',
  'openai/gpt-3.5-turbo-16k'
];

let CURRENT_MODEL_INDEX = 0;

const makeOpenRouterRequest = async (messages, maxTokens = 3000, retryCount = 0) => {
  const currentModel = AI_MODELS[CURRENT_MODEL_INDEX] || AI_MODELS[0];
  
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not set');
    }

    console.log('🔄 Making OpenRouter request with model:', currentModel);
    console.log('API Key present:', !!process.env.OPENROUTER_API_KEY);
    
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: currentModel,
        messages,
        temperature: 0,
        max_tokens: maxTokens,
        seed: 42,
        top_p: 1
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:5173',
          'X-Title': 'HealthAI Platform'
        },
        timeout: 120000
      }
    );
    
    console.log('✅ API call successful with', currentModel);
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('❌ API Error:', error.message);
    
    if ((error.response?.status === 404 || error.response?.status === 403) && 
        CURRENT_MODEL_INDEX < AI_MODELS.length - 1) {
      console.log('⚠️ Trying next model...');
      CURRENT_MODEL_INDEX++;
      return makeOpenRouterRequest(messages, maxTokens, retryCount + 1);
    }
    
    throw error;
  }
};

const HEALTH_ANALYSIS_PROMPT = `Analyze health report and return JSON with: patientName, healthScore, metrics, deficiencies, supplements, dietPlan, recommendations.`;

exports.analyzeHealthReport = async (reportText) => {
  try {
    console.log('🔄 Analyzing report...');
    console.log('🤖 Models:', AI_MODELS);
    
    const content = await makeOpenRouterRequest([
      { role: 'system', content: HEALTH_ANALYSIS_PROMPT },
      { role: 'user', content: reportText }
    ]);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const analysis = JSON.parse(jsonMatch[0]);
    console.log('✅ Analysis complete');
    return analysis;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return {
      patientName: 'Patient',
      healthScore: 70,
      summary: 'Analysis failed',
      keyFindings: ['Error: ' + error.message],
      metrics: {},
      deficiencies: [],
      supplements: [],
      dietPlan: { overview: 'Pending' },
      recommendations: { lifestyle: [] }
    };
  }
};

exports.compareReports = async () => { return {}; };
exports.chatWithReport = async () => { return 'Response'; };
exports.generateMetricInfo = async () => { return {}; };
