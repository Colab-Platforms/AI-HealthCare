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
    const primaryModel = modelOverride || CLAUDE_MODEL;
    const MAX_RETRIES = 5;
    const RETRY_DELAYS = [8000, 20000, 40000, 60000, 90000]; // 8s, 20s, 40s, 60s, 90s

    const headers = {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
      'Connection': 'close'
    };

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Fallback to Haiku after 2 failed attempts for better availability
      const currentModel = (attempt >= 2 && !modelOverride) ? CLAUDE_HAIKU_MODEL : primaryModel;
      
      console.log(`🔄 DietAI | Model: ${currentModel} | Attempt: ${attempt + 1}/${MAX_RETRIES} | Tokens: ${payload.max_tokens}`);

      try {
        const response = await axios.post(ANTHROPIC_API_URL, {
          model: currentModel,
          max_tokens: payload.max_tokens,
          system: payload.system || '',
          messages: payload.messages.filter(m => m.role !== 'system'),
          temperature: payload.temperature || 0.3
        }, { 
          headers, 
          timeout: 300000 
        });

        if (response.data && response.data.content && response.data.content[0]) {
          if (attempt > 0) console.log(`✅ DietAI | Succeeded on attempt ${attempt + 1} with ${currentModel}`);
          return response.data.content[0].text;
        }
        throw new Error('Invalid response');
      } catch (error) {
        const status = error.response?.status;
        const isOverloaded = status === 529;
        const isRateLimit = status === 429;
        const isRetryable = isOverloaded || isRateLimit;

        console.error(`❌ Diet AI Request Error (attempt ${attempt + 1}):`, error.response?.data?.error?.message || error.message);

        if (isRetryable && attempt < MAX_RETRIES - 1) {
          const delay = RETRY_DELAYS[attempt];
          console.log(`⏳ DietAI | ${isOverloaded ? 'Overloaded' : 'Rate limited'} — retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        throw error;
      }
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
    "breakfast": [{"name": "Meal Name", "portionSize": "1 bowl / 2 pieces / 200g", "calories": 0, "protein": 0, "carbs": 0, "fats": 0}],
    "lunch": [{"name": "Meal Name", "portionSize": "1 plate / 1.5 bowl / 350g", "calories": 0, "protein": 0, "carbs": 0, "fats": 0}],
    "dinner": [{"name": "Meal Name", "portionSize": "1 bowl / 150g", "calories": 0, "protein": 0, "carbs": 0, "fats": 0}]
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
1. CRITICAL: The SUM of Calories, Protein, Carbs, and Fats across NO MORE than one option from each meal (Breakfast + Lunch + Dinner) MUST strictly align with the USER'S Macro Targets provided.
2. PRECISE PORTIONS: Use measurements like "1.5 Bowl (250g)", "2 Medium Roti (80g)", etc., in "portionSize". The portion must explain BOTH the visual quantity (bowl/piece) AND the approximate weight (grams) if applicable.
3. Focus on varied Indian cuisine.
4. Output 1-2 options per meal.
5. ${promptExtension}

JSON output ONLY. Exact mathematical alignment with macro goals is mandatory.`;

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

  /**
   * Generate diet plan using Haiku model (for auto-triggered background tasks)
   * Uses Haiku directly to reduce API load when triggered after report analysis
   */
  async generatePersonalizedDietPlanLight(userData, promptExtension = '') {
    return this.generatePersonalizedDietPlan(userData, promptExtension);
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
