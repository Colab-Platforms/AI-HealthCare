const axios = require('axios');

/**
 * AI Nutrition Analyzer using GPT-4o Vision
 * Analyzes food from images or text descriptions
 */

class NutritionAI {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
  }

  /**
   * Analyze food from image
   * @param {string} imageBase64 - Base64 encoded image
   * @param {string} additionalContext - Optional text description
   * @returns {Promise<Object>} Nutrition breakdown
   */
  async analyzeFromImage(imageBase64, additionalContext = '') {
    try {
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
  "analysis": "Brief analysis",
  "recommendations": "Suggestions",
  "alternatives": []
}

CRITICAL: Use accurate Indian food nutrition data. Plain roti is LOW calorie (70-80 each), not high!`;

      const response = await axios.post(
        this.apiUrl,
        {
          model: 'openai/gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`
                  }
                }
              ]
            }
          ],
          temperature: 0.3, // Lower temperature for more consistent results
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.APP_URL || 'http://localhost:5173',
            'X-Title': 'HealthAI Nutrition Analyzer'
          },
          timeout: 30000
        }
      );

      const aiResponse = response.data.choices[0].message.content;
      
      // Parse JSON response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const nutritionData = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          data: nutritionData,
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
   * @param {string} foodDescription - Text description of food
   * @returns {Promise<Object>} Nutrition breakdown
   */
  async analyzeFromText(foodDescription) {
    try {
      const prompt = `You are a professional nutritionist AI. Analyze this food description and provide a detailed nutrition breakdown.

Food description: "${foodDescription}"

Please identify all food items mentioned and provide:

1. List of food items with estimated quantities
2. Detailed nutrition breakdown for EACH item:
   - Calories (kcal)
   - Protein (g)
   - Carbohydrates (g)
   - Fats (g)
   - Fiber (g)
   - Sugar (g)
   - Sodium (mg)
   - Key vitamins and minerals (Vitamin A, C, D, B12, Iron, Calcium)

3. Total nutrition for the entire meal

Return the response in this EXACT JSON format (no markdown, just pure JSON):
{
  "foodItems": [
    {
      "name": "Food name",
      "description": "Brief description",
      "quantity": "Estimated quantity (e.g., 1 cup, 150g, 2 pieces)",
      "nutrition": {
        "calories": 0,
        "protein": 0,
        "carbs": 0,
        "fats": 0,
        "fiber": 0,
        "sugar": 0,
        "sodium": 0,
        "vitamins": {
          "vitaminA": 0,
          "vitaminC": 0,
          "vitaminD": 0,
          "vitaminB12": 0,
          "iron": 0,
          "calcium": 0
        }
      }
    }
  ],
  "totalNutrition": {
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fats": 0,
    "fiber": 0,
    "sugar": 0,
    "sodium": 0,
    "vitamins": {
      "vitaminA": 0,
      "vitaminC": 0,
      "vitaminD": 0,
      "vitaminB12": 0,
      "iron": 0,
      "calcium": 0
    }
  },
  "analysis": "Brief analysis of the meal's nutritional value and health impact",
  "recommendations": "Suggestions for improving the meal or what to eat next"
}

Be accurate with portion sizes and nutrition values. Use standard serving sizes if quantities are not specified.`;

      const response = await axios.post(
        this.apiUrl,
        {
          model: 'openai/gpt-4o',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.APP_URL || 'http://localhost:5173',
            'X-Title': 'HealthAI Nutrition Analyzer'
          },
          timeout: 30000
        }
      );

      const aiResponse = response.data.choices[0].message.content;
      
      // Parse JSON response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const nutritionData = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          data: nutritionData,
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
   * Get personalized meal recommendations based on user's goals and current intake
   * @param {Object} userGoal - User's health goal
   * @param {Object} todaySummary - Today's nutrition summary
   * @param {Array} deficiencies - User's vitamin/mineral deficiencies
   * @returns {Promise<Object>} Meal recommendations
   */
  async getMealRecommendations(userGoal, todaySummary, deficiencies = []) {
    try {
      const remainingCalories = userGoal.dailyCalorieTarget - todaySummary.totalCalories;
      const remainingProtein = userGoal.macroTargets.protein - todaySummary.totalProtein;
      const remainingCarbs = userGoal.macroTargets.carbs - todaySummary.totalCarbs;
      const remainingFats = userGoal.macroTargets.fats - todaySummary.totalFats;

      const prompt = `You are a professional nutritionist AI specializing in Indian cuisine and dietary habits. Provide personalized meal recommendations.

User's Goal: ${userGoal.goalType.replace('_', ' ')}
Dietary Preference: ${userGoal.dietaryPreference}
${userGoal.allergies?.length > 0 ? `Allergies: ${userGoal.allergies.join(', ')}` : ''}

Today's Intake:
- Calories: ${todaySummary.totalCalories}/${userGoal.dailyCalorieTarget} (${remainingCalories} remaining)
- Protein: ${todaySummary.totalProtein}g/${userGoal.macroTargets.protein}g (${remainingProtein}g remaining)
- Carbs: ${todaySummary.totalCarbs}g/${userGoal.macroTargets.carbs}g (${remainingCarbs}g remaining)
- Fats: ${todaySummary.totalFats}g/${userGoal.macroTargets.fats}g (${remainingFats}g remaining)

${deficiencies.length > 0 ? `Nutrient Deficiencies: ${deficiencies.join(', ')}` : ''}

IMPORTANT: Suggest INDIAN meals and foods that:
1. Fit within remaining calorie and macro targets
2. Address any nutrient deficiencies
3. Match dietary preferences
4. Are practical and easy to prepare
5. Use common Indian ingredients and cooking methods
6. Consider Indian eating habits and meal times

Provide 3-5 meal suggestions with Indian options.

Return response in JSON format:
{
  "recommendations": [
    {
      "mealName": "Meal name (Indian)",
      "description": "Brief description",
      "calories": 0,
      "protein": 0,
      "carbs": 0,
      "fats": 0,
      "ingredients": ["ingredient1", "ingredient2"],
      "benefits": "Why this meal is good for the user",
      "prepTime": "Preparation time",
      "indianName": "Hindi/Regional name if applicable"
    }
  ],
  "insights": "Overall insights about user's nutrition today",
  "tips": ["Tip 1", "Tip 2", "Tip 3"]
}`;

      const response = await axios.post(
        this.apiUrl,
        {
          model: 'openai/gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1500
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.APP_URL || 'http://localhost:5173',
            'X-Title': 'HealthAI Nutrition Analyzer'
          },
          timeout: 30000
        }
      );

      const aiResponse = response.data.choices[0].message.content;
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return {
          success: true,
          data: JSON.parse(jsonMatch[0])
        };
      } else {
        throw new Error('Failed to parse recommendations');
      }
    } catch (error) {
      console.error('AI Recommendations Error:', error.message);
      throw error;
    }
  }
  /**
   * Quick food check - analyze food without logging
   * @param {string} foodDescription - Food description with quantity
   * @returns {Promise<Object>} Nutrition info + alternatives if unhealthy
   */
  async quickFoodCheck(foodDescription) {
    try {
      const prompt = `You are a professional nutritionist AI specializing in Indian cuisine and dietary habits. Analyze this food and provide nutrition info plus healthy alternatives if it's junk food.

Food: "${foodDescription}"

IMPORTANT: Focus on Indian foods and eating habits. Suggest Indian alternatives when possible.

Provide:
1. Detailed nutrition breakdown
2. Health impact analysis
3. If this is junk/unhealthy food, suggest 3-5 HEALTHIER Indian alternatives that:
   - Keep the person full (high protein/fiber)
   - Have similar or fewer calories
   - Provide better nutrition
   - Are practical and easy to find in India
   - Match Indian dietary preferences
4. Consider Indian cooking methods (oil usage, spices, etc.)

Return in this EXACT JSON format:
{
  "foodItem": {
    "name": "Food name",
    "quantity": "Quantity",
    "nutrition": {
      "calories": 0,
      "protein": 0,
      "carbs": 0,
      "fats": 0,
      "fiber": 0,
      "sugar": 0,
      "sodium": 0
    }
  },
  "healthScore": 0-100,
  "isHealthy": true/false,
  "analysis": "Brief health impact analysis",
  "warnings": ["Warning 1", "Warning 2"],
  "benefits": ["Benefit 1", "Benefit 2"],
  "alternatives": [
    {
      "name": "Alternative food name (preferably Indian)",
      "description": "Why this is better",
      "nutrition": {
        "calories": 0,
        "protein": 0,
        "carbs": 0,
        "fats": 0,
        "fiber": 0
      },
      "benefits": "Key benefits"
    }
  ]
}

If the food is already healthy, return empty alternatives array.`;

      const response = await axios.post(
        this.apiUrl,
        {
          model: 'openai/gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 1500
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.APP_URL || 'http://localhost:5173',
            'X-Title': 'HealthAI Nutrition Analyzer'
          },
          timeout: 30000
        }
      );

      const aiResponse = response.data.choices[0].message.content;
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return {
          success: true,
          data: JSON.parse(jsonMatch[0])
        };
      } else {
        throw new Error('Failed to parse AI response');
      }
    } catch (error) {
      console.error('Quick Food Check Error:', error.message);
      throw error;
    }
  }

  /**
   * Get healthy alternatives for a specific food
   * @param {string} foodName - Name of the food
   * @param {Object} userPreferences - User's dietary preferences and goals
   * @returns {Promise<Object>} List of healthy alternatives
   */
  async getHealthyAlternatives(foodName, userPreferences = {}) {
    try {
      const { dietaryPreference, allergies, goal, remainingCalories } = userPreferences;

      const prompt = `You are a professional nutritionist AI. Suggest healthy alternatives for "${foodName}".

User Context:
${dietaryPreference ? `- Dietary Preference: ${dietaryPreference}` : ''}
${allergies?.length > 0 ? `- Allergies: ${allergies.join(', ')}` : ''}
${goal ? `- Goal: ${goal}` : ''}
${remainingCalories ? `- Remaining Calories Today: ${remainingCalories}` : ''}

Provide 5-7 healthier alternatives that:
1. Keep the person satisfied and full
2. Provide better nutrition
3. Match dietary preferences
4. Avoid allergens
5. Fit calorie goals

Return in JSON format:
{
  "alternatives": [
    {
      "name": "Food name",
      "description": "Brief description",
      "calories": 0,
      "protein": 0,
      "carbs": 0,
      "fats": 0,
      "fiber": 0,
      "whyBetter": "Why this is a better choice",
      "satietyScore": 0-10,
      "prepTime": "Quick/Medium/Long"
    }
  ],
  "tips": ["Tip 1", "Tip 2"]
}`;

      const response = await axios.post(
        this.apiUrl,
        {
          model: 'openai/gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1500
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.APP_URL || 'http://localhost:5173',
            'X-Title': 'HealthAI Nutrition Analyzer'
          },
          timeout: 30000
        }
      );

      const aiResponse = response.data.choices[0].message.content;
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return {
          success: true,
          data: JSON.parse(jsonMatch[0])
        };
      } else {
        throw new Error('Failed to parse alternatives');
      }
    } catch (error) {
      console.error('Get Alternatives Error:', error.message);
      throw error;
    }
  }
}

module.exports = new NutritionAI();
