const axios = require('axios');

/**
 * AI Nutrition Analyzer using Claude 3.5 Sonnet / GPT-4o
 * Analyzes food from images or text descriptions
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
    const isAnthropicDirect = this.apiKey?.startsWith('sk-ant');
    const apiUrl = isAnthropicDirect ? ANTHROPIC_API_URL : OPENROUTER_API_URL;

    let model = isAnthropicDirect ? 'claude-3-5-sonnet-latest' : 'anthropic/claude-3-5-sonnet';
    if (!isAnthropicDirect && attempt === 1) model = 'openai/gpt-4o-mini';
    if (!isAnthropicDirect && attempt >= 2) model = 'google/gemini-pro-1.5';

    return { isAnthropicDirect, apiUrl, model };
  }

  async makeAIRequest(payload, attempt = 0) {
    const { isAnthropicDirect, apiUrl, model } = this.getApiParams(attempt);
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

      // Adjust payload for Anthropic Direct if needed
      const requestPayload = isAnthropicDirect ? {
        model: payload.model,
        max_tokens: payload.max_tokens,
        system: payload.system || (payload.messages && payload.messages[0].role === 'system' ? payload.messages[0].content : ''),
        messages: payload.messages.filter(m => m.role !== 'system'),
        temperature: payload.temperature
      } : payload;

      const response = await axios.post(apiUrl, requestPayload, { headers, timeout: attempt === 0 ? 45000 : 60000 });

      let aiResponse = '';
      if (!isAnthropicDirect) {
        aiResponse = response.data.choices[0].message.content;
      } else {
        aiResponse = response.data.content[0].text;
      }
      return aiResponse;
    } catch (error) {
      console.error(`Nutrition AI Request Error (Attempt ${attempt + 1}):`, error.response?.data || error.message);

      if (!isAnthropicDirect && attempt < 2) {
        console.log(`⚠️ Attempt ${attempt + 1} failed. Retrying with fallback model...`);
        return this.makeAIRequest(payload, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Analyze food from image
   */
  async analyzeFromImage(imageBase64, additionalContext = '') {
    const prompt = `You are a professional nutritionist AI with expertise in Indian food recognition and accurate nutrition data. Carefully analyze this food image.

${additionalContext ? `User provided context: ${additionalContext}` : ''}

CRITICAL INSTRUCTIONS FOR ACCURACY:
1. LOOK AT THE IMAGE CAREFULLY - Identify the EXACT food items visible
2. IF YOU CANNOT CLEARLY SEE FOOD IN THE IMAGE:
   - Return error JSON with "error": "UNABLE_TO_DETECT_FOOD"
   - Do NOT make up food names
   - Do NOT return random food like "paneer butter masala" if you don't see it
3. USE ACCURATE INDIAN FOOD NUTRITION DATA:
   - Plain roti/chapati (1 medium): 70-80 kcal, 2-3g protein, 14-15g carbs, 0.5-1g fat
   - Samosa (1 medium): 250-300 kcal, 5-7g protein, 30-35g carbs, 12-17g fat
   - Rice (1 cup cooked): 200-240 kcal, 4-5g protein, 45-50g carbs, 0.5-1g fat
4. PAY ATTENTION TO QUANTITY - If user says "3 pieces", multiply nutrition by 3
5. ALWAYS provide RANGES (e.g., "210-240" not "225")
6. DO NOT OVERESTIMATE - Plain roti is low calorie, don't confuse with paratha

IF IMAGE IS UNCLEAR OR NO FOOD VISIBLE:
Return this exact JSON:
{
  "error": "UNABLE_TO_DETECT_FOOD",
  "message": "Could not clearly identify food in the image. Please try again with a clearer photo showing the food."
}

QUANTITY HANDLING:
- If user mentions "3 pieces", calculate for 3 pieces
- Example: 3 plain rotis = 210-240 kcal (NOT 720 kcal)
- Example: 3 samosas = 750-900 kcal

NUTRITION VALUE FORMAT - MANDATORY RANGES:
- ALWAYS use ranges: "210-240" never single values
- Format: "calories": "210-240", "protein": "6-9", "carbs": "42-45"
- This is REQUIRED for all nutrition values

COMMON INDIAN FOODS (per piece/serving):
- Plain roti: 70-80 kcal, 2-3g protein, 14-15g carbs, 0.5-1g fat
- Paratha (with oil): 150-200 kcal, 3-4g protein, 20-25g carbs, 7-10g fat
- Samosa: 250-300 kcal, 5-7g protein, 30-35g carbs, 12-17g fat
- Idli (2 pieces): 80-100 kcal, 3-4g protein, 16-20g carbs, 0.5-1g fat
- Dosa (1 plain): 120-150 kcal, 3-4g protein, 22-28g carbs, 2-4g fat

Return response in EXACT JSON format (no markdown):
{
  "foodItems": [
    {
      "name": "Exact food name",
      "description": "What you see",
      "quantity": "User quantity or visual estimate",
      "nutrition": {
        "calories": "210-240",
        "protein": "6-9",
        "carbs": "42-45",
        "fats": "1.5-3",
        "fiber": "6-9",
        "sugar": "0-1",
        "sodium": "0-10"
      }
    }
  ],
  "totalNutrition": {
    "calories": "210-240",
    "protein": "6-9",
    "carbs": "42-45",
    "fats": "1.5-3",
    "fiber": "6-9",
    "sugar": "0-1",
    "sodium": "0-10"
  },
  "healthScore": 0-100,
  "healthScore10": 0.0-10.0,
  "isHealthy": true/false,
  "analysis": "Brief analysis",
  "micronutrients": [
    { "name": "Vitamin C", "value": "12mg", "percentage": 15 },
    { "name": "Iron", "value": "1.2mg", "percentage": 8 }
  ],
  "enhancementTips": [
    { "name": "Sprouts", "benefit": "Adds 5g of plant-based protein and fiber" },
    { "name": "Lemon Juice", "benefit": "Increases Iron absorption with Vitamin C" }
  ],
  "healthBenefitsSummary": "This meal provide a balanced mix of complex carbs and protein. Adding greens would improve the fiber content and provide essential Vitamin K for bone health.",
  "recommendations": "Suggestions",
  "alternatives": []
}

CRITICAL: Use accurate Indian food nutrition data. Plain roti is LOW calorie (70-80 each), not high!`;

    const isOpenRouter = this.apiKey?.startsWith('sk-or');
    const systemMsg = 'You are a professional nutritionist AI with expertise in Indian food recognition and accurate nutrition data.';

    const payload = isOpenRouter ? {
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
    } : {
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
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return {
          success: true,
          data: JSON.parse(jsonMatch[0]),
          rawResponse: aiResponse
        };
      } else {
        throw new Error('Failed to parse AI response');
      }
    } catch (error) {
      console.error('AI Image Analysis Error:', error.message);
      throw error;
    }
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

    const isOpenRouter = this.apiKey?.startsWith('sk-or');
    const systemMsg = 'You are a professional nutritionist AI.';

    const payload = isOpenRouter ? {
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
    } : {
      max_tokens: 2000,
      system: systemMsg,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    };

    try {
      const aiResponse = await this.makeAIRequest(payload);
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return {
          success: true,
          data: JSON.parse(jsonMatch[0]),
          rawResponse: aiResponse
        };
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

    const isOpenRouter = this.apiKey?.startsWith('sk-or');
    const systemMsg = 'You are a professional nutritionist AI specializing in Indian cuisine.';

    const payload = isOpenRouter ? {
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500
    } : {
      max_tokens: 1500,
      system: systemMsg,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
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
   * Quick food check
   */
  async quickFoodCheck(foodDescription) {
    const prompt = `You are a professional nutritionist AI specialized in Indian cuisine. Analyze "${foodDescription}".
If it's junk, suggest 3-5 HEALTHY Indian alternatives.

Return in JSON:
{
  "foodItem": { "name": "Name", "quantity": "Qty", "nutrition": { "calories": 0, "protein": 0, "carbs": 0, "fats": 0, "fiber": 0, "sugar": 0, "sodium": 0 } },
  "healthScore": 0-100, "isHealthy": true/false, "analysis": "Analysis",
  "micronutrients": [], "enhancementTips": [], "healthBenefitsSummary": "Summary",
  "alternatives": [ { "name": "Name", "description": "Why", "nutrition": {}, "benefits": "Key" } ]
}`;

    const isOpenRouter = this.apiKey?.startsWith('sk-or');
    const systemMsg = 'You are a professional nutritionist AI specializing in Indian cuisine.';

    const payload = isOpenRouter ? {
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1500
    } : {
      max_tokens: 1500,
      system: systemMsg,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    };

    try {
      const aiResponse = await this.makeAIRequest(payload);
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return { success: true, data: JSON.parse(jsonMatch[0]) };
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
