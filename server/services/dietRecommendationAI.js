const axios = require('axios');
const { robustJsonParse } = require('../utils/aiParser');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-3-5-sonnet-latest';
const CLAUDE_HAIKU_MODEL = 'claude-3-5-haiku-latest';

class DietRecommendationAI {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
  }

  async makeAIRequest(payload, modelOverride = null) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const selectedModel = modelOverride || CLAUDE_MODEL;

    console.log(`🔄 DietAI Request | Model: ${selectedModel} | Tokens: ${payload.max_tokens}`);

    const headers = {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
      'Connection': 'close'
    };

    try {
      const response = await axios.post(ANTHROPIC_API_URL, {
        model: selectedModel,
        max_tokens: payload.max_tokens,
        system: payload.system || '',
        messages: payload.messages.filter(m => m.role !== 'system'),
        temperature: payload.temperature || 0.3
      }, { 
        headers, 
        timeout: 180000 // 3 minutes timeout
      });

      if (response.data && response.data.content && response.data.content[0]) {
        return response.data.content[0].text;
      }
      throw new Error('Invalid Anthropic response structure');
    } catch (error) {
      console.error(`❌ Diet AI Request Error:`, error.response?.data?.error?.message || error.message);
      throw error;
    }
  }

  /**
   * Generate a personalized diet plan - Streamlined for speed
   */
  async generatePersonalizedDietPlan(userData, promptExtension = '') {
    const {
      age, gender, weight, height, currentBMI, bmiGoal,
      dietaryPreference, activityLevel, medicalConditions,
      allergies, fitnessGoals, nutritionGoals, foodPreferences
    } = userData;

    // Use Claude 3.5 Sonnet for the complex meal plan, but ask for FEWER options to save time
    const prompt = `Expert Indian Nutritionist. Create a personalized meal plan. 
USER: ${age}y ${gender}, BMI ${currentBMI}, Goal: ${bmiGoal}, Activity: ${activityLevel}, Opt: ${dietaryPreference}.
RULES:
1. NO BEEF.
2. 2 DISTINCT meal options per category (Breakfast, Mid-Morning, Lunch, Evening, Dinner).
3. TOTAL: 10 meal options in total.
4. Portions must be mathematically accurate to macros: ${JSON.stringify(nutritionGoals)}.
5. AUTHENTIC Indian household foods only.

JSON STRUCTURE:
{
  "dailyCalorieTarget": ${nutritionGoals?.dailyCalories || 2000},
  "macroTargets": ${JSON.stringify(nutritionGoals || {})},
  "mealPlan": {
    "breakfast": [{"name": "", "description": "", "portionSize": "", "calories": 0, "protein": 0, "carbs": 0, "fats": 0, "benefits": ""}],
    "midMorningSnack": [...], "lunch": [...], "eveningSnack": [...], "dinner": [...]
  },
  "keyFoods": [], "deficiencyCorrections": [], "lifestyleRecommendations": [], "avoidFoods": []
}`;

    const systemMsg = "You are a clinical dietitian specialized in Indian cuisine. Return JSON only. Speed and mathematical accuracy are priority.";

    try {
      const aiResponse = await this.makeAIRequest({
        max_tokens: 3000, // Reduced tokens for speed
        system: systemMsg,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      });

      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) return robustJsonParse(jsonMatch[0]);
      throw new Error('No JSON in AI response');
    } catch (error) {
      console.error('AI Diet Plan Error:', error.message);
      throw error;
    }
  }

  /**
   * Generate supplement recommendations - Fast using Haiku
   */
  async generateSupplementRecommendations(userData) {
    const { deficiencies, age, gender, dietaryPreference, medicalConditions } = userData;
    const prompt = `Suggest supplements for: ${deficiencies.map(d => d.nutrient).join(', ')}. User: ${age}y ${gender}. JSON format: {"supplements": [{"name": "", "dosage": "", "timing": "", "priority": ""}], "guidance": ""}`;

    try {
      const aiResponse = await this.makeAIRequest({
        max_tokens: 1000,
        system: "Expert Clinical Dietitian. Haiku speed mode.",
        messages: [{ role: 'user', content: prompt }]
      }, CLAUDE_HAIKU_MODEL); // Use Haiku for speed

      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      return jsonMatch ? robustJsonParse(jsonMatch[0]) : { supplements: [] };
    } catch (error) { return { supplements: [] }; }
  }

  /**
   * Analyze food preferences - Fast using Haiku
   */
  async analyzeFoodPreferences(user) {
    const prompt = `Analyze preferences: ${JSON.stringify(user.foodPreferences)}. JSON format: {"overallScore": 85, "strengths": [], "concerns": [], "recommendations": {}}`;
    try {
      const aiResponse = await this.makeAIRequest({
        max_tokens: 1500,
        system: "Nutrition Insight Engine. Haiku speed mode.",
        messages: [{ role: 'user', content: prompt }]
      }, CLAUDE_HAIKU_MODEL); // Use Haiku for speed

      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      return jsonMatch ? robustJsonParse(jsonMatch[0]) : null;
    } catch (error) { return null; }
  }
}

module.exports = new DietRecommendationAI();
