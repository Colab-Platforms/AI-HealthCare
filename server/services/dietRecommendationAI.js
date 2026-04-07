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
<<<<<<< HEAD
        timeout: 300000 
=======
        timeout: 280000 
>>>>>>> 3b4b025e0dd07e969b27879e47e90e6678a4857a
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
<<<<<<< HEAD
    "breakfast": [{"name": "Poha", "portionSize": "1 cup (150g)", "calories": 250, "protein": 5, "carbs": 40, "fats": 7}],
    "midMorningSnack": [{"name": "Mixed Fruit", "portionSize": "1 small bowl (100g)", "calories": 100, "protein": 1, "carbs": 25, "fats": 0}],
    "lunch": [{"name": "Dal & 2 Roti", "portionSize": "1 bowl dal, 2 medium roti", "calories": 450, "protein": 15, "carbs": 60, "fats": 10}],
    "eveningSnack": [{"name": "Roasted Makhana", "portionSize": "1 small cup (30g)", "calories": 110, "protein": 3, "carbs": 15, "fats": 4}],
    "dinner": [{"name": "Grilled Paneer & Veggies", "portionSize": "150g paneer, 1 bowl stir-fry", "calories": 350, "protein": 25, "carbs": 10, "fats": 15}]
  }
}
USER: ${age}y ${gender}, BMI ${currentBMI}, Goal: ${bmiGoal}. Focus on Indian split based on preferences. Output 1-2 options per meal. IMPORTANT: You MUST provide descriptive measurements for each meal (e.g., 100g, 1 bowl, 2 pieces, 1 cup) in the "portionSize" field. ${promptExtension}`;
=======
    "breakfast": [{"name": "Meal Name", "portionSize": "descriptive size (e.g. 1 bowl, 2 pieces)", "calories": 0, "protein": 0, "carbs": 0, "fats": 0}],
    "midMorningSnack": [...],
    "lunch": [...],
    "eveningSnack": [...],
    "dinner": [...]
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
>>>>>>> 3b4b025e0dd07e969b27879e47e90e6678a4857a

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
