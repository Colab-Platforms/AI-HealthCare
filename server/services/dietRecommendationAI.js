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
        timeout: 300000 
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
    const { age, gender, weight, height, currentBMI, bmiGoal, activityLevel, nutritionGoals, medicalConditions, allergies, diabetesInfo } = userData;
    const isDiabetic = !!diabetesInfo;
    
    const prompt = `Indian Clinical Nutritionist. Generate a 100% accurate JSON meal plan.
STRUCTURE:
{
  "dailyCalorieTarget": ${nutritionGoals?.dailyCalories || 2000},
  "mealPlan": {
    "breakfast": [{"name": "Meal Name", "portionSize": "descriptive size (e.g. 1 bowl, 2 pieces)", "calories": 0, "protein": 0, "carbs": 0, "fats": 0}],
    "midMorningSnack": [{"name": "Snack Name", "portionSize": "descriptive size", "calories": 0, "protein": 0, "carbs": 0, "fats": 0}],
    "lunch": [{"name": "Meal Name", "portionSize": "descriptive size", "calories": 0, "protein": 0, "carbs": 0, "fats": 0}],
    "eveningSnack": [{"name": "Snack Name", "portionSize": "descriptive size", "calories": 0, "protein": 0, "carbs": 0, "fats": 0}],
    "dinner": [{"name": "Meal Name", "portionSize": "descriptive size", "calories": 0, "protein": 0, "carbs": 0, "fats": 0}]
  }
}
USER DATA:
- Profile: ${age}y ${gender}, Weight: ${weight}kg, Height: ${height}cm, BMI: ${currentBMI}
- Goal: ${bmiGoal}
- Activity: ${activityLevel}
- Medical Conditions: ${medicalConditions?.join(', ') || 'None'}
- Allergies: ${allergies?.join(', ') || 'None'}
- Diabetes Status: ${isDiabetic ? `Positive (${diabetesInfo.diabetesType})` : 'Negative'}
- Macro Targets: Protein ${nutritionGoals?.protein}g, Carbs ${nutritionGoals?.carbs}g, Fats ${nutritionGoals?.fats}g

REQUIREMENTS:
1. Provide COMPLETELY UNIQUE AND VARIED options. Do NOT repeat standardized meals for every user.
2. Focus on Indian cuisine (varied regions: North, South, East, West).
3. Output 1-2 options per meal.
4. Descriptive measurements (e.g., 100g, 1 bowl, 2 pieces) required in "portionSize".
5. For Diabetic users: Low Glycemic Index (GI), higher fiber, controlled portions.
6. ${promptExtension}

JSON output ONLY. High variety requested.`;

    try {
      const aiResponse = await this.makeAIRequest({
        max_tokens: 4000,
        system: "Expert Clinical Dietitian. Generate varied, scientifically accurate Indian meal plans. Never repeat the same plan for different users. Variety is prioritized.",
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7 // Increased for variety
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
