const axios = require('axios');
const { robustJsonParse } = require('../utils/aiParser');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
// Next-gen high-fidelity model for results in 10-15 seconds
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
        max_tokens: payload.max_tokens || 2000,
        system: payload.system || '',
        messages: payload.messages || [],
        temperature: 0.4
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
      console.error('❌ [NutritionAI] API ERROR:', errorMsg);

      if (err.response?.data) {
        console.error('❌ [NutritionAI] Full API Error Data:', JSON.stringify(err.response.data));
      }
      throw new Error(`AI Analysis failed: ${errorMsg}`);
    }
  }

  _getUnifiedPrompt(context = '') {
    return `Analyze the provided image or text and return a JSON object.
    Context: "${context}"
    
    TASK:
    1. Determine if the image/text contains actual FOOD or drink.
    2. If NOT food (e.g., a person, a car, a document, or a completely empty plate), set "isFood" to false and provide a helpful "errorMessage".
    3. If it IS food, perform high-precision nutritional analysis.
    
    - IDENTIFICATION: Be specific. Identify the exact dish (e.g., "Egg Curry" vs "Boiled Egg").
    - REFERENCE DATA: Use official nutritional databases (USDA, Indian Food Composition Tables (IFCT)) as your primary source for all values.
    - PORTION SENSE: Use the context "${context}" for quantity. If context is missing, use standard serving sizes.
    - MACRO PRECISION (MANDATORY): Use these multipliers:
        * 1g Protein = 4 kcal
        * 1g Carb = 4 kcal
        * 1g Fat = 9 kcal
      The sum (Protein*4 + Carbs*4 + Fats*9) MUST exactly match the total calories returned.
    - COMPOSITE DECOMPOSITION: For complex meals (e.g., "Bagel with Cream Cheese and Chicken"), mentally break down the food into its components (Bagel + Cream Cheese + Chicken), calculate for each, and then aggregate. Do not use generic "Sandwich" averages.
    - EXCLUSIVITY: Do NOT use generic averages. Account for the specific preparation mentioned (oils, frying, etc.).
    
    JSON STRUCTURE:
    {
      "isFood": true/false,
      "errorMessage": "Helpful message if not food (e.g., 'This looks like a medical report, not a meal. Please upload a food photo.')",
      "foodItem": {
        "name": "Specific food name",
        "quantity": "Estimated portion (e.g., 250g, 1 bowl)",
        "nutrition": { "calories": 0, "protein": 0, "carbs": 0, "fats": 0, "fiber": 0, "sugar": 0, "sodium": 0 }
      },
      "totalNutrition": { "calories": 0, "protein": 0, "carbs": 0, "fats": 0, "fiber": 0, "sugar": 0, "sodium": 0 },
      "healthScore": 0-100,
      "analysis": "Short 2-sentence summary of health impact",
      "micronutrients": [{ "name": "Vitamin C", "amount": "12", "unit": "mg", "percentage": 13 }],
      "enhancementTips": [{ "name": "Tip Title", "benefit": "Explanation" }],
      "healthBenefitsSummary": "Positive impact summary",
      "warnings": ["Disadvantages if unhealthy"],
      "alternatives": [{ "name": "Name", "description": "Why better", "nutrition": { "calories": 0, "protein": 0 } }]
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
      system: 'You are a professional nutritionist AI specialized in Indian and global cuisine. Analyze the food in the image. IMPORTANT: Always prioritize the quantity mentioned in the user text/context for all nutritional calculations. Return ONLY a JSON response.',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } }
        ]
      }],
      max_tokens: 2000
    };

    try {
      const response = await this.makeAIRequest(payload);
      return this._parseResponse(response);
    } catch (error) {
      console.error('❌ [NutritionAI] Image analysis failed:', error.message);
      throw error;
    }
  }

  async quickFoodCheck(foodDescription, additionalContext = '') {
    const combined = additionalContext 
      ? `Food: ${foodDescription}. Context: ${additionalContext}`
      : foodDescription;
    const prompt = this._getUnifiedPrompt(combined);
    const payload = {
      system: 'You are a professional nutritionist AI. Respond ONLY with valid JSON. Be extremely concise. CRITICAL: You must calculate nutrition based on the EXACT quantity provided in the context (e.g., if user says "3 eggs", calculate for 3, NOT 1).',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500
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
    const prompt = `Analyze current glucose trends and food impact. 
    User Profile: ${JSON.stringify(userProfile)}
    Recent Glucose Readings: ${JSON.stringify(glucoseReadings)}
    Today's Food Logs: ${JSON.stringify(foodLogs)}
    Recent HbA1c: ${JSON.stringify(hba1cReadings)}

    Return ONLY a JSON object with this exact structure:
    {
      "status": "Short status string (e.g. Critical Spike, Stable, Warning Trend)",
      "statusColor": "green (stable), yellow (warning), orange (high), or red (critical)",
      "analysis": "1 concise sentence explaining the current metabolic state.",
      "spikeCause": "Direct cause of recent spike (e.g., 'White rice at 1:30 PM')",
      "emergencySignal": "true/false (if level is dangerously high)",
      "immediateAction": "The single most important step to take RIGHT NOW.",
      "recommendations": [
        "Pointer 1: Why this happened (concise)",
        "Pointer 2: Immediate corrective action (concise)",
        "Pointer 3: Next meal adjustment (concise)",
        "Pointer 4: Lifestyle/Activity tip (concise)"
      ]
    }
    
    CRITICAL: Keep recommendations limited to exactly 3-4 high-impact pointers. Avoid long paragraphs. If data is insufficient, provide a placeholder analysis asking for more logs.`;
    
    const payload = {
      system: 'You are an expert Endocrinologist AI. Provide clinical-grade analysis of glucose data and its relationship with food logs. Return ONLY valid JSON.',
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
