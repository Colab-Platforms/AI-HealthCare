const axios = require('axios');

/**
 * AI Nutrition Analyzer using Claude Direct API / OpenRouter
 * Analyzes food from images or text descriptions
 * Supports both Anthropic direct API (sk-ant keys) and OpenRouter
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const PRIMARY_MODEL = 'anthropic/claude-3.5-sonnet';
const BACKUP_MODEL = 'openai/gpt-4o-mini';
const FALLBACK_MODEL = 'google/gemini-pro-1.5';

class NutritionAI {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY;
  }

  getApiParams(attempt = 0) {
    // Re-read API key in case env changed
    this.apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY;

    const isAnthropicDirect = this.apiKey?.startsWith('sk-ant');
    const apiUrl = isAnthropicDirect ? ANTHROPIC_API_URL : OPENROUTER_API_URL;

    // Use correct model names for each API
    let model = isAnthropicDirect ? 'claude-3-5-sonnet-20241022' : 'anthropic/claude-3-5-sonnet';
    if (!isAnthropicDirect && attempt === 1) model = 'openai/gpt-4o-mini';
    if (!isAnthropicDirect && attempt >= 2) model = 'google/gemini-pro-1.5';

    return { isAnthropicDirect, apiUrl, model };
  }

  async makeAIRequest(payload, attempt = 0) {
    const { isAnthropicDirect, apiUrl, model } = this.getApiParams(attempt);

    console.log(`🔄 NutritionAI: Using ${isAnthropicDirect ? 'Anthropic Direct' : 'OpenRouter'} with model: ${model} (attempt ${attempt + 1})`);

    const headers = isAnthropicDirect ? {
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    } : {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://fitcure.ai',
      'X-Title': 'FitCure Nutrition'
    };

    try {
      payload.model = model;

      // Build the correct payload format for each API
      let requestPayload;

      if (isAnthropicDirect) {
        // Extract system message from messages array if present
        let systemContent = payload.system || '';
        let userMessages = payload.messages || [];

        if (!systemContent && userMessages.length > 0 && userMessages[0].role === 'system') {
          systemContent = userMessages[0].content;
          userMessages = userMessages.filter(m => m.role !== 'system');
        }

        requestPayload = {
          model: model,
          max_tokens: payload.max_tokens || 2000,
          system: systemContent,
          messages: userMessages,
          temperature: payload.temperature || 0.3
        };
      } else {
        requestPayload = payload;
      }

      const timeout = isAnthropicDirect ? 60000 : (attempt === 0 ? 45000 : 60000);
      const response = await axios.post(apiUrl, requestPayload, { headers, timeout });

      let aiResponse = '';
      if (isAnthropicDirect) {
        if (response.data && response.data.content && response.data.content[0]) {
          aiResponse = response.data.content[0].text;
        } else {
          console.error('❌ Unexpected Anthropic response structure:', JSON.stringify(response.data).substring(0, 500));
          throw new Error('Invalid response structure from Anthropic API');
        }
      } else {
        if (response.data && response.data.choices && response.data.choices[0]) {
          aiResponse = response.data.choices[0].message.content;
        } else {
          console.error('❌ Unexpected OpenRouter response structure:', JSON.stringify(response.data).substring(0, 500));
          throw new Error('Invalid response structure from OpenRouter API');
        }
      }

      console.log('✅ NutritionAI: Got response, length:', aiResponse.length);
      return aiResponse;
    } catch (error) {
      // LOG THE FULL ERROR RESPONSE FOR DIAGNOSIS
      let errorDetail = error.message;
      if (error.response?.data) {
        errorDetail = `API Error (${error.response.status}): ${JSON.stringify(error.response.data)}`;
        console.error(`❌ NutritionAI API ERROR details:`, error.response.data);
      }

      console.error(`❌ NutritionAI Request Error (Attempt ${attempt + 1}):`, errorDetail.substring(0, 1000));

      // Retry logic for OpenRouter with fallback models
      if (!isAnthropicDirect && attempt < 2) {
        console.log(`⚠️ Attempt ${attempt + 1} failed. Retrying with fallback model...`);
        return this.makeAIRequest(payload, attempt + 1);
      }

      // If Anthropic direct fails and OpenRouter key exists, try OpenRouter as fallback
      if (isAnthropicDirect && process.env.OPENROUTER_API_KEY) {
        console.log('⚠️ Anthropic direct failed. Trying OpenRouter as fallback...');
        const origKey = process.env.ANTHROPIC_API_KEY;
        process.env.ANTHROPIC_API_KEY = '';
        try {
          // If the payload contains an image, we MUST convert it to OpenRouter format
          let orPayload = payload;
          if (payload.messages?.[0]?.content && Array.isArray(payload.messages[0].content)) {
            const hasImage = payload.messages[0].content.some(c => c.type === 'image');
            if (hasImage) {
              console.log('🔄 Converting Anthropic image payload to OpenRouter format for fallback');
              const textContent = payload.messages[0].content.find(c => c.type === 'text')?.text || '';
              const imageContent = payload.messages[0].content.find(c => c.type === 'image');

              orPayload = {
                messages: [
                  { role: 'system', content: payload.system || 'You are a professional nutritionist AI.' },
                  {
                    role: 'user',
                    content: [
                      { type: 'text', text: textContent },
                      {
                        type: 'image_url',
                        image_url: {
                          url: `data:image/jpeg;base64,${imageContent.source.data}`
                        }
                      }
                    ]
                  }
                ],
                temperature: 0.3,
                max_tokens: 2000
              };
            }
          }

          const result = await this.makeAIRequest(orPayload, 0);
          process.env.ANTHROPIC_API_KEY = origKey;
          return result;
        } catch (retryErr) {
          process.env.ANTHROPIC_API_KEY = origKey;
          throw retryErr;
        }
      }

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
    // Strip data URI prefix if present (e.g., "data:image/jpeg;base64,...")
    if (imageBase64.startsWith('data:')) {
      imageBase64 = imageBase64.split(',')[1];
    }

    // Validate image size to prevent memory issues
    const imageSizeKB = (imageBase64.length * 0.75) / 1024;
    console.log(`🖼️ Processing image for AI analysis: ${imageSizeKB.toFixed(2)} KB`);

    if (imageSizeKB > 5120) { // 5MB limit
      throw new Error('Image too large for processing. Please use a smaller image.');
    }

    const prompt = this._getUnifiedPrompt(additionalContext);
    const systemMsg = 'You are a professional nutritionist AI with expertise in Indian food recognition and accurate nutrition data. You MUST analyze the image carefully and identify all food items visible. Return your analysis as valid JSON only.';

    // Helper to build Anthropic Direct payload
    const buildAnthropicPayload = () => ({
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
    });

    // Helper to build OpenRouter payload (different image format!)
    const buildOpenRouterPayload = () => ({
      messages: [
        { role: 'system', content: systemMsg },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    // Helper to parse AI response
    const parseResponse = (aiResponse) => {
      console.log('🧠 AI raw response length:', aiResponse.length);
      console.log('🧠 AI response preview:', aiResponse.substring(0, 300));

      const jsonMatch = aiResponse.match(/(\{[\s\S]*\})/);
      if (!jsonMatch) {
        console.error('❌ No JSON found in AI response:', aiResponse.substring(0, 500));
        throw new Error('No JSON in AI response');
      }

      try {
        const parsed = JSON.parse(jsonMatch[1]);
        console.log('✅ Parsed food:', parsed.foodItem?.name || 'Unknown');
        return { success: true, data: parsed, rawResponse: aiResponse };
      } catch (parseError) {
        // Try relaxed parsing
        let cleanedJson = jsonMatch[1]
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
          .replace(/[\x00-\x1F\x7F]/g, ' ');

        try {
          const parsed = JSON.parse(cleanedJson);
          console.log('✅ Relaxed parsing succeeded:', parsed.foodItem?.name || 'Unknown');
          return { success: true, data: parsed, rawResponse: aiResponse };
        } catch (e) {
          throw new Error('AI returned invalid JSON');
        }
      }
    };

    // ─── ATTEMPT 1: Try Anthropic Direct if key is available ───
    const hasAnthropicKey = process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.startsWith('sk-ant');

    if (hasAnthropicKey) {
      try {
        console.log('🧠 [Attempt 1] Trying Anthropic Direct API for image analysis...');
        const anthropicPayload = buildAnthropicPayload();

        // Call Anthropic Direct API directly (not through makeAIRequest to avoid bad fallback)
        const model = 'claude-3-5-sonnet-20241022';
        const response = await axios.post(ANTHROPIC_API_URL, {
          model: model,
          max_tokens: 2000,
          system: anthropicPayload.system,
          messages: anthropicPayload.messages,
          temperature: 0.3
        }, {
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          },
          timeout: 90000
        });

        if (response.data?.content?.[0]?.text) {
          const aiResponse = response.data.content[0].text;
          console.log('✅ Anthropic Direct image analysis succeeded');
          return parseResponse(aiResponse);
        } else {
          throw new Error('Invalid response structure from Anthropic');
        }
      } catch (anthropicError) {
        const errDetail = anthropicError.response?.data
          ? JSON.stringify(anthropicError.response.data).substring(0, 300)
          : anthropicError.message;
        console.error('❌ Anthropic Direct failed:', errDetail);
        console.log('⚠️ Will try OpenRouter next...');
      }
    }

    // ─── ATTEMPT 2: Try OpenRouter with vision-capable models ───
    const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;

    if (hasOpenRouterKey) {
      const openRouterModels = [
        'anthropic/claude-3.5-sonnet',
        'google/gemini-flash-1.5',
        'openai/gpt-4o-mini',
        'google/gemini-pro-1.5'
      ];

      for (let i = 0; i < openRouterModels.length; i++) {
        try {
          const modelName = openRouterModels[i];
          console.log(`🧠 [Attempt ${i + 2}] Trying OpenRouter with ${modelName}...`);

          const openRouterPayload = buildOpenRouterPayload();
          openRouterPayload.model = modelName;

          const response = await axios.post(OPENROUTER_API_URL, openRouterPayload, {
            headers: {
              'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://fitcure.ai',
              'X-Title': 'FitCure Nutrition'
            },
            timeout: 90000
          });

          if (response.data?.choices?.[0]?.message?.content) {
            const aiResponse = response.data.choices[0].message.content;
            console.log(`✅ OpenRouter (${modelName}) image analysis succeeded`);
            return parseResponse(aiResponse);
          } else {
            throw new Error('Invalid OpenRouter response');
          }
        } catch (orError) {
          const errDetail = orError.response?.data
            ? JSON.stringify(orError.response.data).substring(0, 300)
            : orError.message;
          console.error(`❌ OpenRouter model ${openRouterModels[i]} failed:`, errDetail);

          if (i < openRouterModels.length - 1) {
            console.log('⚠️ Trying next model...');
          }
        }
      }
    }

    // ─── ALL ATTEMPTS FAILED ───
    console.error('❌ ALL image analysis attempts failed! No API could process the image.');
    throw new Error('Failed to analyze food image with any available AI model. Please try text input instead.');
  }

  /**
   * Analyze food from text description
   */
  async analyzeFromText(foodDescription) {
    const prompt = `You are a professional nutritionist AI. Analyze this food description and provide a detailed nutrition breakdown.

Food description: "${foodDescription}"

Please identify all food items mentioned and provide:
1. List of food items with estimated quantities
2. Detailed nutrition breakdown for EACH item
3. Total nutrition for the entire meal

Return the response in this EXACT JSON format (no markdown, just pure JSON):
{
  "foodItems": [
    {
      "name": "Food name",
      "description": "Brief description",
      "quantity": "Estimated quantity (e.g., 1 cup, 150g, 2 pieces)",
      "nutrition": {
        "calories": 0, "protein": 0, "carbs": 0, "fats": 0, "fiber": 0, "sugar": 0, "sodium": 0,
        "vitamins": { "vitaminA": 0, "vitaminC": 0, "vitaminD": 0, "vitaminB12": 0, "iron": 0, "calcium": 0 }
      }
    }
  ],
  "totalNutrition": {
    "calories": 0, "protein": 0, "carbs": 0, "fats": 0, "fiber": 0, "sugar": 0, "sodium": 0,
    "vitamins": { "vitaminA": 0, "vitaminC": 0, "vitaminD": 0, "vitaminB12": 0, "iron": 0, "calcium": 0 }
  },
  "healthScore": 0-100,
  "isHealthy": true/false,
  "analysis": "Brief analysis",
  "micronutrients": [],
  "enhancementTips": [],
  "healthBenefitsSummary": "Summary",
  "recommendations": "Suggestions"
}

Be accurate with portion sizes and nutrition values. Use standard serving sizes if quantities are not specified.`;

    const systemMsg = 'You are a professional nutritionist AI.';
    const { isAnthropicDirect } = this.getApiParams();

    const payload = isAnthropicDirect ? {
      max_tokens: 2000,
      system: systemMsg,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    } : {
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
    };

    try {
      const aiResponse = await this.makeAIRequest(payload);
      const jsonMatch = aiResponse.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        try {
          return {
            success: true,
            data: JSON.parse(jsonMatch[1]),
            rawResponse: aiResponse
          };
        } catch (parseError) {
          console.error('JSON Parse Error. Attempting relaxed parsing...');
          // Try to find the inner-most JSON if possible, or just throw
          throw new Error('AI returned invalid JSON structure');
        }
      } else {
        throw new Error('Failed to parse AI response');
      }
    } catch (error) {
      console.error('AI Text Analysis Error:', error.message);
      throw error;
    }
  }

  /**
   * Get personalized meal recommendations
   */
  async getMealRecommendations(userGoal, todaySummary, deficiencies = []) {
    const remainingCalories = userGoal.dailyCalorieTarget - todaySummary.totalCalories;
    const remainingProtein = userGoal.macroTargets.protein - todaySummary.totalProtein;
    const remainingCarbs = userGoal.macroTargets.carbs - todaySummary.totalCarbs;
    const remainingFats = userGoal.macroTargets.fats - todaySummary.totalFats;

    const prompt = `You are a professional nutritionist AI specializing in Indian cuisine and dietary habits. Provide personalized meal recommendations.

User's Goal: ${userGoal.goalType?.replace('_', ' ') || 'General health'}
Dietary Preference: ${userGoal.dietaryPreference}
${userGoal.allergies?.length > 0 ? `Allergies: ${userGoal.allergies.join(', ')}` : ''}

Today's Intake:
- Calories: ${todaySummary.totalCalories}/${userGoal.dailyCalorieTarget} (${remainingCalories} remaining)
- Protein: ${todaySummary.totalProtein}g/${userGoal.macroTargets.protein}g (${remainingProtein}g remaining)
- Carbs: ${todaySummary.totalCarbs}g/${userGoal.macroTargets.carbs}g (${remainingCarbs}g remaining)
- Fats: ${todaySummary.totalFats}g/${userGoal.macroTargets.fats}g (${remainingFats}g remaining)

${deficiencies.length > 0 ? `Nutrient Deficiencies: ${deficiencies.join(', ')}` : ''}

Provide 3-5 INDIAN meal suggestions in JSON:
{
  "recommendations": [
    {
      "mealName": "Name", "description": "Desc", "calories": 0, "protein": 0, "carbs": 0, "fats": 0,
      "ingredients": [], "benefits": "Why", "prepTime": "Time", "indianName": "Name"
    }
  ],
  "insights": "Insights",
  "tips": []
}`;

    const systemMsg = 'You are a professional nutritionist AI specializing in Indian cuisine.';
    const { isAnthropicDirect } = this.getApiParams();

    const payload = isAnthropicDirect ? {
      max_tokens: 1500,
      system: systemMsg,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    } : {
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500
    };

    try {
      const aiResponse = await this.makeAIRequest(payload);
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return { success: true, data: JSON.parse(jsonMatch[0]) };
      } else {
        throw new Error('Failed to parse recommendations');
      }
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
    const { isAnthropicDirect } = this.getApiParams();

    const payload = isAnthropicDirect ? {
      max_tokens: 2000,
      system: systemMsg,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    } : {
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
    };

    try {
      const aiResponse = await this.makeAIRequest(payload);
      const jsonMatch = aiResponse.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        try {
          return { success: true, data: JSON.parse(jsonMatch[1]) };
        } catch (e) {
          throw new Error('AI returned invalid JSON in unified check');
        }
      } else {
        throw new Error('Failed to parse AI response');
      }
    } catch (error) {
      console.error('Quick Food Check Error:', error.message);
      throw error;
    }
  }
}

module.exports = new NutritionAI();
