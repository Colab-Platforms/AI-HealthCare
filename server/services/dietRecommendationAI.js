const axios = require('axios');
const { robustJsonParse } = require('../utils/aiParser');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
// 🚨 USER SPECIFIC MODEL - The user insists on using 'claude-sonnet-4-6'
const CLAUDE_MODEL = 'claude-sonnet-4-6'; 
const CLAUDE_HAIKU_MODEL = 'claude-3-5-haiku-latest';

class DietRecommendationAI {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
  }

  async makeAIRequest(payload, modelOverride = null) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const selectedModel = modelOverride || CLAUDE_MODEL;

    console.log(`🔄 DietAI | Model: ${selectedModel} | Tokens: ${payload.max_tokens}`);

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
        timeout: 180000 
      });

      if (response.data && response.data.content && response.data.content[0]) {
        return response.data.content[0].text;
      }
      throw new Error('Invalid response');
    } catch (error) {
      console.error(`❌ Diet AI Request Error:`, error.response?.data?.error?.message || error.message);
      throw error;
    }
  }

  async generatePersonalizedDietPlan(userData, promptExtension = '') {
    const { age, gender, weight, height, currentBMI, bmiGoal, activityLevel, nutritionGoals } = userData;
    const prompt = `Indian Nutritionist. Create meal plan. 
USER: ${age}y ${gender}, BMI ${currentBMI}, Goal: ${bmiGoal}, Activity: ${activityLevel}.
JSON Structure:
{
  "dailyCalorieTarget": ${nutritionGoals?.dailyCalories || 2000},
  "mealPlan": {
    "breakfast": [{"name": "", "description": "", "portionSize": "", "calories": 0, "protein": 0, "carbs": 0, "fats": 0}],
    "midMorningSnack": [...], "lunch": [...], "eveningSnack": [...], "dinner": [...]
  }
}`;
    const systemMsg = "Clinical dietitian. Indian cuisine.";
    try {
      const aiResponse = await this.makeAIRequest({
        max_tokens: 3000,
        system: systemMsg,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      });
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      return jsonMatch ? robustJsonParse(jsonMatch[0]) : null;
    } catch (error) { throw error; }
  }

  async generateSupplementRecommendations(userData) {
    const { deficiencies, age, gender } = userData;
    const prompt = `Suggest supplements for: ${deficiencies.map(d => d.nutrient).join(', ')}. JSON: {"supplements": [{"name": ""}]}`;
    try {
      const aiResponse = await this.makeAIRequest({
        max_tokens: 1000,
        system: "Expert Clinical Dietitian.",
        messages: [{ role: 'user', content: prompt }]
      }, CLAUDE_HAIKU_MODEL);
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      return jsonMatch ? robustJsonParse(jsonMatch[0]) : { supplements: [] };
    } catch (error) { return { supplements: [] }; }
  }

  async analyzeFoodPreferences(user) {
    const prompt = `Analyze: ${JSON.stringify(user.foodPreferences)}. JSON {"overallScore": 85}`;
    try {
      const aiResponse = await this.makeAIRequest({
        max_tokens: 1500,
        system: "Nutrition Engine.",
        messages: [{ role: 'user', content: prompt }]
      }, CLAUDE_HAIKU_MODEL);
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      return jsonMatch ? robustJsonParse(jsonMatch[0]) : null;
    } catch (error) { return null; }
  }
}

module.exports = new DietRecommendationAI();
