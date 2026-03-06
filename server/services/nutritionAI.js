const axios = require('axios');
const { robustJsonParse } = require('../utils/aiParser');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
// Using the exact model ID requested by the user
const CLAUDE_MODEL = 'claude-sonnet-4-6';

class NutritionAI {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
  }

  getApiParams() {
    this.apiKey = process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.trim() : '';
    return { apiUrl: ANTHROPIC_API_URL, model: CLAUDE_MODEL };
  }

  async makeAIRequest(payload) {
    const { apiUrl, model } = this.getApiParams();
    if (!this.apiKey) {
      console.error('❌ ANTHROPIC_API_KEY is not defined in environment');
      throw new Error('ANTHROPIC_API_KEY missing');
    }

    console.log('🔄 [NutritionAI] Request | Model:', model, '| Key:', this.apiKey.substring(0, 10) + '...');

    const headers = {
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    };

    try {
      const requestPayload = {
        model,
        max_tokens: payload.max_tokens || 4000,
        system: payload.system || '',
        messages: payload.messages || [],
        temperature: 0
      };

      // Vision requests can be very slow - using 2-minute timeout
      const resp = await axios.post(apiUrl, requestPayload, { headers, timeout: 120000 });
      const text = resp.data?.content?.[0]?.text;

      if (!text) {
        console.error('❌ [NutritionAI] Empty response body:', resp.data);
        throw new Error('No content in Anthropic response');
      }

      return text;
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.message;
      const errorType = err.response?.data?.error?.type;

      console.error('❌ [NutritionAI] API ERROR:', errorMsg);

      // Proactive fallback for model-not-found errors (custom model name issues)
      if (errorType === 'not_found_error' && model === 'claude-sonnet-4-6') {
        console.warn('⚠️ [NutritionAI] Model "claude-sonnet-4-6" not found. Falling back to standard Claude 3.5 Sonnet...');
        const fallbackPayload = { ...payload, model: 'claude-3-5-sonnet-20240620' };
        // Remove recursion safety or just call once with different model
        const { apiUrl } = this.getApiParams();
        const fallbackRequest = {
          ...requestPayload,
          model: 'claude-3-5-sonnet-20240620'
        };
        try {
          const fallbackResp = await axios.post(apiUrl, fallbackRequest, { headers, timeout: 120000 });
          const fallbackText = fallbackResp.data?.content?.[0]?.text;
          if (fallbackText) return fallbackText;
        } catch (fallbackErr) {
          console.error('❌ [NutritionAI] Fallback also failed:', fallbackErr.message);
        }
      }

      if (err.response?.data) {
        console.error('❌ [NutritionAI] Full API Error Data:', JSON.stringify(err.response.data));
      }
      throw new Error(`AI Analysis failed: ${errorMsg}`);
    }
  }

  _getUnifiedPrompt(context = '') {
    return `Analyze this food and return ONLY a JSON object.
    Context: "${context}"
    
    Format:
    {
      "foodItem": {
        "name": "Food name",
        "quantity": "Portion",
        "nutrition": { "calories": 0, "protein": 0, "carbs": 0, "fats": 0, "fiber": 0, "sugar": 0, "sodium": 0 }
      },
      "totalNutrition": { "calories": 0, "protein": 0, "carbs": 0, "fats": 0, "fiber": 0, "sugar": 0, "sodium": 0 },
      "healthScore": 0,
      "analysis": "2-sentence summary",
      "micronutrients": [],
      "enhancementTips": [],
      "healthBenefitsSummary": "",
      "warnings": [],
      "alternatives": []
    }`;
  }

  async analyzeFromImage(imageBase64, additionalContext = '') {
    let mediaType = 'image/jpeg'; // Default

    if (imageBase64.startsWith('data:')) {
      // Extract mime type if present
      const match = imageBase64.match(/^data:([^;]+);base64,/);
      if (match) {
        mediaType = match[1];
      }
      imageBase64 = imageBase64.split(',')[1];
    }

    // Supported mime types for Anthropic
    const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!supportedTypes.includes(mediaType)) {
      console.warn(`⚠️ [NutritionAI] Unsupported media type ${mediaType}, falling back to image/jpeg`);
      mediaType = 'image/jpeg';
    }

    console.log('🖼️ [NutritionAI] Preparing image for Claude:', mediaType, '| Context:', additionalContext.substring(0, 50));

    const prompt = this._getUnifiedPrompt(additionalContext);
    const payload = {
      system: 'You are a professional nutritionist AI specialized in Indian and global cuisine. Analyze the food in the image and return ONLY a JSON response. No text before or after the JSON.',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } }
        ]
      }]
    };

    try {
      const response = await this.makeAIRequest(payload);
      return this._parseResponse(response);
    } catch (error) {
      console.error('❌ [NutritionAI] Image analysis failed:', error.message);
      throw error;
    }
  }

  async quickFoodCheck(foodDescription) {
    const prompt = this._getUnifiedPrompt(foodDescription);
    const payload = {
      system: 'You are a professional nutritionist AI. Respond ONLY with valid JSON.',
      messages: [{ role: 'user', content: prompt }]
    };
    return this._parseResponse(await this.makeAIRequest(payload));
  }

  async getMealRecommendations(userGoal, todaySummary, deficiencies = []) {
    const prompt = `Provide 3-5 meal suggestions for: ${userGoal.goalType}. Today's calories: ${todaySummary.totalCalories}. JSON format only.`;
    const payload = {
      system: 'Professional nutritionist AI.',
      messages: [{ role: 'user', content: prompt }]
    };
    return this._parseResponse(await this.makeAIRequest(payload));
  }

  async analyzeGlucoseTrends(userProfile, glucoseReadings, foodLogs, hba1cReadings = []) {
    const prompt = `Analyze trends for patient. Data: ${JSON.stringify({ userProfile, glucoseReadings, foodLogs, hba1cReadings })}. JSON format only.`;
    const payload = {
      system: 'Professional endocrinologist AI. JSON format only.',
      messages: [{ role: 'user', content: prompt }]
    };
    return this._parseResponse(await this.makeAIRequest(payload));
  }

  _parseResponse(r) {
    if (!r) throw new Error('Empty AI response from server');

    // Extract JSON block
    const start = r.indexOf('{');
    const end = r.lastIndexOf('}');

    if (start === -1 || end === -1) {
      console.error('❌ [NutritionAI] No JSON markers found in response');
      console.error('❌ [NutritionAI] RAW RESPONSE:', r.substring(0, 500) + '...');
      throw new Error('AI failed to return structured data. Please try again with more details.');
    }

    const jsonStr = r.substring(start, end + 1);
    try {
      const parsed = robustJsonParse(jsonStr);
      if (!parsed) throw new Error('JSON parser returned empty result');
      return { success: true, data: parsed };
    } catch (err) {
      console.error('❌ [NutritionAI] JSON Parse Failed');
      console.error('❌ [NutritionAI] Problematic snippet:', jsonStr.substring(0, 100) + '...');
      console.error('❌ [NutritionAI] Tail snippet:', jsonStr.substring(jsonStr.length - 100));
      throw new Error(`Data processing error: ${err.message}`);
    }
  }
}

module.exports = new NutritionAI();
