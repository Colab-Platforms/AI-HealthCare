const axios = require('axios');
const { robustJsonParse } = require('../utils/aiParser');

/**
 * AI Nutrition Analyzer using Anthropic Claude Direct API
 * Analyzes food from images or text descriptions
 * Exclusively uses Anthropic direct integration
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';

class NutritionAI {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
  }

  getApiParams() {
    // Re-read API key in case env changed
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    const apiUrl = ANTHROPIC_API_URL;
    const model = CLAUDE_MODEL;
    return { apiUrl, model };
  }

  async makeAIRequest(payload) {
    const { apiUrl, model } = this.getApiParams();

    console.log(`🔄 NutritionAI: Using Anthropic Direct with model: ${model}`);

    const headers = {
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    };

    try {
      // Extract system message from messages array if present
      let systemContent = payload.system || '';
      let userMessages = payload.messages || [];

      if (!systemContent && userMessages.length > 0 && userMessages[0].role === 'system') {
        systemContent = userMessages[0].content;
        userMessages = userMessages.filter(m => m.role !== 'system');
      }

      const requestPayload = {
        model: model,
        max_tokens: payload.max_tokens || 2000,
        system: systemContent,
        messages: userMessages,
        temperature: payload.temperature || 0.3
      };

      const timeout = 60000;
      const response = await axios.post(apiUrl, requestPayload, { headers, timeout });

      if (response.data && response.data.content && response.data.content[0]) {
        const aiResponse = response.data.content[0].text;
        console.log('✅ NutritionAI: Got response, length:', aiResponse.length);
        return aiResponse;
      } else {
        console.error('❌ Unexpected Anthropic response structure:', JSON.stringify(response.data).substring(0, 500));
        throw new Error('Invalid response structure from Anthropic API');
      }
    } catch (error) {
      console.error(`❌ NutritionAI Request Error:`, error.response?.data || error.message);
      throw error;
    }
  }

  _getUnifiedPrompt(context = '') {
    return `You are a professional nutritionist AI specialized in global cuisine with deep expertise in Indian foods.
    
    CONTEXT/DESCRIPTION: "${context}"
    
    CRITICAL INSTRUCTIONS:
    1. IMAGE ANALYSIS: If analyzing an image, identify EVERY food item visible on the plate.
    2. ACCURACY: Use real-world nutritional values. (e.g., 1 Roti = 70kcal, 1 bowl Rice = 200kcal).
    3. RANGES: For total nutrition, provide numeric values representing the average in JSON.
    4. ALTERNATIVES: If the meal is high in calories, oil, or sugar, suggest 3 healthy alternatives.
    5. BREAKDOWN: Provide micronutrients, health benefits, and specific tips to make this meal healthier.

    IF NO FOOD IS DETECTABLE (Only for images), return:
    { "error": "UNABLE_TO_DETECT_FOOD", "message": "I couldn't clearly identify any food in this photo. Please try shooting from a top-down angle or ensure better lighting." }
    
    RETURN RESPONSE IN THIS EXACT JSON FORMAT:
    {
      "foodItem": {
        "name": "Primary food name",
        "description": "Short visual description",
        "quantity": "Portion size estimate",
        "nutrition": {
          "calories": 250, "protein": 8, "carbs": 45, "fats": 5, "fiber": 6, "sugar": 2, "sodium": 150
        }
      },
      "totalNutrition": { "calories": 250, "protein": 8, "carbs": 45, "fats": 5, "fiber": 6, "sugar": 2, "sodium": 150 },
      "healthScore": 75,
      "analysis": "Specific nutritional analysis.",
      "micronutrients": [
        { "name": "Vitamin C", "value": "12mg", "percentage": 15 }
      ],
      "enhancementTips": [
        { "name": "Add Protein", "benefit": "Better satiety" }
      ],
      "healthBenefitsSummary": "Impact on health.",
      "warnings": ["Warning if unhealthy"],
      "alternatives": [
        {
          "name": "Alternative",
          "description": "Better choice",
          "nutrition": { "calories": 150, "protein": 10, "carbs": 20, "fats": 2 },
          "benefits": "Benefit",
          "prepTime": "10 mins",
          "satietyScore": 8
        }
      ]
    }`;
  }

  /**
   * Analyze food from image
   */
  async analyzeFromImage(imageBase64, additionalContext = '') {
    // Strip data URI prefix if present
    if (imageBase64.startsWith('data:')) {
      imageBase64 = imageBase64.split(',')[1];
    }

    const imageSizeKB = (imageBase64.length * 0.75) / 1024;
    console.log(`🖼️ Processing image for AI analysis: ${imageSizeKB.toFixed(2)} KB`);

    if (imageSizeKB > 5120) {
      throw new Error('Image too large for processing. Please use a smaller image.');
    }

    const prompt = this._getUnifiedPrompt(additionalContext);
    const systemMsg = 'You are a professional nutritionist AI with expertise in Indian food recognition and accurate nutrition data. You MUST analyze the image carefully and identify all food items visible. Return your analysis as valid JSON only.';

    const payload = {
      max_tokens: 2000,
      system: systemMsg,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageBase64
              }
            }
          ]
        }
      ],
      temperature: 0.3
    };

    try {
      const aiResponse = await this.makeAIRequest(payload);
      return this._parseResponse(aiResponse);
    } catch (error) {
      console.error('❌ NutritionAI Image Analysis failed:', error.message);
      throw error;
    }
  }

  /**
   * Helper to parse AI response
   */
  _parseResponse(aiResponse) {
    const jsonMatch = aiResponse.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) {
      console.error('❌ NutritionAI: No JSON in response:', aiResponse.substring(0, 500));
      throw new Error('No JSON in AI response');
    }

    try {
      const parsedData = robustJsonParse(jsonMatch[1]);
      return { success: true, data: parsedData, rawResponse: aiResponse };
    } catch (parseError) {
      console.error('❌ NutritionAI JSON Parse Error:', parseError.message);
      throw new Error('AI returned invalid JSON');
    }
  }

  /**
   * Analyze food from text description
   */
  async analyzeFromText(foodDescription) {
    const prompt = `Analyze this food description and provide a detailed nutrition breakdown: "${foodDescription}"
    
    Return the response in this EXACT JSON format:
    {
      "foodItems": [{ "name": "Food name", "quantity": "Quantity", "nutrition": { "calories": 0, "protein": 0, "carbs": 0, "fats": 0 } }],
      "totalNutrition": { "calories": 0, "protein": 0, "carbs": 0, "fats": 0 },
      "healthScore": 0-100,
      "analysis": "Analysis"
    }`;

    const systemMsg = 'You are a professional nutritionist AI.';
    const payload = {
      max_tokens: 2000,
      system: systemMsg,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    };

    try {
      const aiResponse = await this.makeAIRequest(payload);
      return this._parseResponse(aiResponse);
    } catch (error) {
      console.error('AI Text Analysis Error:', error.message);
      throw error;
    }
  }

  /**
   * Get personalized meal recommendations
   */
  async getMealRecommendations(userGoal, todaySummary, deficiencies = []) {
    const prompt = `Provide 3-5 INDIAN meal suggestions based on:
    Goal: ${userGoal.goalType}
    Deficiencies: ${deficiencies.join(', ')}
    
    Today's Intake: ${todaySummary.totalCalories} kcal
    
    Return JSON format.`;

    const systemMsg = 'You are a professional nutritionist AI specializing in Indian cuisine.';
    const payload = {
      max_tokens: 1500,
      system: systemMsg,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    };

    try {
      const aiResponse = await this.makeAIRequest(payload);
      return this._parseResponse(aiResponse);
    } catch (error) {
      console.error('AI Recommendations Error:', error.message);
      throw error;
    }
  }

  /**
   * Quick food check (Unified)
   */
  async quickFoodCheck(foodDescription) {
    const prompt = this._getUnifiedPrompt(foodDescription);
    const systemMsg = 'You are a professional nutritionist AI specializing in Indian cuisine.';
    const payload = {
      max_tokens: 2000,
      system: systemMsg,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    };

    try {
      const aiResponse = await this.makeAIRequest(payload);
      return this._parseResponse(aiResponse);
    } catch (error) {
      console.error('Quick Food Check Error:', error.message);
      throw error;
    }
  }

  /**
   * Analyze glucose trends with food context
   */
  async analyzeGlucoseTrends(userProfile, glucoseReadings, foodLogs, hba1cReadings = []) {
    const diabetesProfile = userProfile.diabetesProfile || {};
    const latestGlucose = glucoseReadings[0] || {};

    const prompt = `Analyze diabetes management:
    Glucose: ${latestGlucose.value} ${latestGlucose.unit}
    Food: ${foodLogs.map(l => l.mealType).join(', ')}
    
    Return JSON format with status and recommendations.`;

    const systemMsg = 'You are a professional diabetes management AI.';
    const payload = {
      max_tokens: 1500,
      system: systemMsg,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    };

    try {
      const aiResponse = await this.makeAIRequest(payload);
      return this._parseResponse(aiResponse);
    } catch (error) {
      console.error('AI Glucose Analysis Error:', error.message);
      throw error;
    }
  }
}

module.exports = new NutritionAI();
