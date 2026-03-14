const axios = require('axios');
const { robustJsonParse } = require('../utils/aiParser');

/**
 * AI Diet Recommendation Service
 * Generates personalized diet plans and supplement recommendations
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-6';

class DietRecommendationAI {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
  }

  getApiParams() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    const apiUrl = ANTHROPIC_API_URL;
    const model = 'claude-sonnet-4-6';
    return { apiUrl, model };
  }

  async makeAIRequest(payload) {
    const { apiUrl, model } = this.getApiParams();

    console.log(`🔄 DietAI: Using Anthropic Direct with model: ${model}`);

    const headers = {
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
      'Connection': 'close'
    };

    try {
      const requestPayload = {
        model: model,
        max_tokens: payload.max_tokens,
        system: payload.system || (payload.messages && payload.messages[0].role === 'system' ? payload.messages[0].content : ''),
        messages: payload.messages.filter(m => m.role !== 'system'),
        temperature: payload.temperature
      };

      const response = await axios.post(apiUrl, requestPayload, { headers, timeout: 120000 });

      if (response.data && response.data.content && response.data.content[0]) {
        return response.data.content[0].text;
      } else {
        throw new Error('Invalid Anthropic response structure');
      }
    } catch (error) {
      console.error(`Diet AI Request Error:`, error.response?.data || error.message);
      if (error.response?.data) {
        console.error('Anthropic Error Details:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  /**
   * Generate a personalized diet plan
   */
  async generatePersonalizedDietPlan(userData, promptExtension = '') {
    const {
      age, gender, weight, height, currentBMI, bmiGoal,
      dietaryPreference, activityLevel, medicalConditions,
      allergies, fitnessGoals, diabetesInfo, labReports, deficiencies,
      nutritionGoals, foodPreferences
    } = userData;

    const prompt = `You are an expert Indian nutritionist and clinical dietitian. Generate a highly personalized Indian meal plan.

USER PROFILE:
- Age/Gender: ${age}, ${gender}
- BMI: ${currentBMI} (${bmiGoal} goal)
- Activity: ${activityLevel}
- Preference: ${dietaryPreference}
- Conditions: ${medicalConditions?.join(', ') || 'None'}
- Allergies: ${allergies?.join(', ') || 'None'}
${diabetesInfo ? `- Diabetes: ${diabetesInfo.diabetesType}, HbA1c: ${diabetesInfo.hba1c || 'N/A'}` : ''}

FOOD PREFERENCES:
- Preferred Foods (Try to include): ${foodPreferences?.preferredFoods?.join(', ') || 'None specified'}
- Foods to Avoid (Do NOT include): ${foodPreferences?.foodsToAvoid?.join(', ') || 'None specified'}
- Dietary Restrictions (STRICTLY adhere to): ${foodPreferences?.dietaryRestrictions?.join(', ') || 'None specified'}
- Breakfast Favorites: ${foodPreferences?.mealPreferences?.breakfast?.join(', ') || 'None specified'}
- Lunch Favorites: ${foodPreferences?.mealPreferences?.lunch?.join(', ') || 'None specified'}
- Dinner Favorites: ${foodPreferences?.mealPreferences?.dinner?.join(', ') || 'None specified'}
- Snack Favorites: ${foodPreferences?.mealPreferences?.snacks?.join(', ') || 'None specified'}

FITNESS GOAL & TARGETS:
- Goal: ${bmiGoal || 'General Health'}
- Target Calories: ${nutritionGoals?.dailyCalories || 2000} kcal
- Target Protein: ${nutritionGoals?.protein || 120}g
- Target Carbs: ${nutritionGoals?.carbs || 250}g
- Target Fats: ${nutritionGoals?.fats || 60}g

LAB REPORT DATA & DEFICIENCIES:
${labReports?.length > 0 ? labReports.map(r => `- ${r.parameter}: ${r.value} ${r.unit} (${r.status})`).join('\n') : 'No lab data available, base recommendations on Fitness Goal and BMI.'}
${deficiencies?.length > 0 ? deficiencies.map(d => `- ${d.nutrient || d.name} (${d.severity})`).join('\n') : ''}

CRITICAL INSTRUCTIONS:
1. Provide EXACTLY 3 DISTINCT meal options for EVERY category (breakfast, midMorningSnack, lunch, eveningSnack, dinner).
2. BE ULTRA-CONCISE. Use short meal names and 1-sentence descriptions. This is critical for performance.
3. Ensure the combined nutrition of these options FULFILLS the user's daily macro targets.
4. Use ONLY Indian foods.
5. TRULY PRIORITIZE the user's specific food preferences for each meal.
6. STRICTLY avoid any 'Foods to Avoid' and adhere to 'Dietary Restrictions'.
7. Provide specific portion sizes in grams/pieces.
8. Each meal option MUST include: name, description, calories, protein, carbs, fats, and benefits.
9. Ensure variety - no two options should be similar.
10. If the user wants to REGENERATE, provide COMPLETELY DIFFERENT meal options.
11. ${promptExtension || ''}

RETURN JSON ONLY. Ensure the JSON is valid and complete:
{
  "dailyCalorieTarget": number,
  "macroTargets": { "protein": number, "carbs": number, "fats": number },
  "mealPlan": {
    "breakfast": [
      { "name": "Meal Name", "description": "desc", "calories": 300, "protein": 15, "carbs": 40, "fats": 10, "benefits": "benefits" }
    ],
    "midMorningSnack": [
      { "name": "Meal Name", "description": "desc", "calories": 150, "protein": 5, "carbs": 20, "fats": 5, "benefits": "benefits" }
    ],
    "lunch": [
      { "name": "Meal Name", "description": "desc", "calories": 500, "protein": 30, "carbs": 60, "fats": 15, "benefits": "benefits" }
    ],
    "eveningSnack": [
      { "name": "Meal Name", "description": "desc", "calories": 150, "protein": 5, "carbs": 20, "fats": 5, "benefits": "benefits" }
    ],
    "dinner": [
      { "name": "Meal Name", "description": "desc", "calories": 400, "protein": 25, "carbs": 50, "fats": 10, "benefits": "benefits" }
    ]
  },
  "keyFoods": [{ "name": "Food", "reason": "Why", "frequency": "Daily" }],
  "deficiencyCorrections": [{ "deficiency": "Name", "indianFoods": [], "mealSuggestions": [] }],
  "lifestyleRecommendations": [],
  "avoidFoods": [{ "food": "Name", "reason": "Why" }],
  "avoidSuggestions": ["Suggestion 1", "Suggestion 2"]
}`;

    const systemMsg = "You are an expert Indian nutritionist and clinical dietitian. Provide personalized meal plans in JSON format.";

    const payload = {
      max_tokens: 4000,
      system: systemMsg,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    };

    console.log('[DietAI] FULL PROMPT PREVIEW:', prompt.substring(0, 500) + '...');

    try {
      const aiResponse = await this.makeAIRequest(payload);
      console.log('AI Response for Diet Plan received (first 200 chars):', aiResponse.substring(0, 200));
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return robustJsonParse(jsonMatch[0]);
        } catch (parseError) {
          console.error('JSON Parse Error in Diet AI:', parseError.message);
          console.error('Raw content around failure:', jsonMatch[0].substring(0, 1000));
          throw parseError;
        }
      }
      throw new Error('Failed to parse diet plan JSON - No braces found');
    } catch (error) {
      console.error('AI Diet Plan Error:', error.message);
      throw error;
    }
  }

  /**
   * Generate supplement recommendations
   */
  async generateSupplementRecommendations(userData) {
    const { deficiencies, age, gender, dietaryPreference, medicalConditions, currentMedications } = userData;

    const prompt = `Suggest supplements for these deficiencies: ${deficiencies.map(d => d.nutrient).join(', ')}.
User: ${age}y ${gender}, ${dietaryPreference}, Conditions: ${medicalConditions.join(', ')}.

RETURN JSON:
{
  "supplements": [
    { "name": "Name", "deficiency": "Target", "dosage": "Exact", "timing": "Best time", "reason": "Why", "foodAlternatives": [], "precautions": "Warnings", "indianBrands": [], "priority": "high/medium/low" }
  ],
  "generalGuidance": [], "consultationNote": "Warning"
}`;

    const systemMsg = "You are a clinical dietitian specialized in supplements and nutritional deficiencies.";

    const payload = {
      max_tokens: 2000,
      system: systemMsg,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5
    };

    try {
      const aiResponse = await this.makeAIRequest(payload);
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) return robustJsonParse(jsonMatch[0]);
      throw new Error('Failed to parse supplement recommendations JSON');
    } catch (error) {
      console.error('AI Supplement Error:', error.message);
      throw error;
    }
  }

  /**
   * Analyze user food preferences and provide recommendations
   */
  async analyzeFoodPreferences(user) {
    const { foodPreferences, profile, nutritionGoal } = user;

    const systemMsg = `You are a nutrition expert analyzing user food preferences. Provide personalized recommendations based on their food choices, health goals, and dietary needs.`;

    const prompt = `Analyze these food preferences and provide recommendations:

User Profile:
- Age: ${profile?.age || 'Not specified'}
- Gender: ${profile?.gender || 'Not specified'}
- Dietary Preference: ${profile?.dietaryPreference || 'Not specified'}
- Activity Level: ${profile?.activityLevel || 'Not specified'}
- Health Goal: ${nutritionGoal?.goal || 'general_health'}

Food Preferences:
- Preferred Foods: ${foodPreferences.preferredFoods?.join(', ') || 'None specified'}
- Foods to Avoid: ${foodPreferences.foodsToAvoid?.join(', ') || 'None specified'}
- Dietary Restrictions: ${foodPreferences.dietaryRestrictions?.join(', ') || 'None specified'}

Provide analysis in this JSON format:
{
  "overallScore": 85,
  "strengths": ["Good protein sources", "Includes vegetables"],
  "concerns": ["High sodium foods", "Limited fiber sources"],
  "recommendations": {
    "foodsToAdd": [
      {"name": "Quinoa", "reason": "High protein and fiber", "benefit": "Supports muscle recovery"},
      {"name": "Spinach", "reason": "Rich in iron", "benefit": "Boosts energy levels"}
    ],
    "foodsToLimit": [
      {"name": "Processed snacks", "reason": "High in sodium", "alternative": "Nuts or fruits"}
    ],
    "mealIdeas": [
      {"meal": "Breakfast", "suggestion": "Oatmeal with berries and nuts"},
      {"meal": "Lunch", "suggestion": "Grilled chicken salad with quinoa"}
    ]
  },
  "nutritionalGaps": ["Omega-3 fatty acids", "Vitamin D"],
  "tips": ["Drink more water", "Include more whole grains"]
}`;

    const payload = {
      max_tokens: 2500,
      system: systemMsg,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    };

    try {
      const aiResponse = await this.makeAIRequest(payload);
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) return robustJsonParse(jsonMatch[0]);
      throw new Error('Failed to parse food preference analysis JSON');
    } catch (error) {
      console.error('AI Food Preference Analysis Error:', error.message);
      throw error;
    }
  }
}

module.exports = new DietRecommendationAI();
