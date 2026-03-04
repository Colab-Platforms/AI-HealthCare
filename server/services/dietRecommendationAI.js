const axios = require('axios');
const { robustJsonParse } = require('../utils/aiParser');

/**
 * AI Diet Recommendation Service
 * Generates personalized diet plans and supplement recommendations
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-3-5-sonnet-20240620';

class DietRecommendationAI {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
  }

  getApiParams() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    const apiUrl = ANTHROPIC_API_URL;
    const model = CLAUDE_MODEL;
    return { apiUrl, model };
  }

  async makeAIRequest(payload) {
    const { apiUrl, model } = this.getApiParams();

    console.log(`🔄 DietAI: Using Anthropic Direct with model: ${model}`);

    const headers = {
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    };

    try {
      const requestPayload = {
        model: model,
        max_tokens: payload.max_tokens,
        system: payload.system || (payload.messages && payload.messages[0].role === 'system' ? payload.messages[0].content : ''),
        messages: payload.messages.filter(m => m.role !== 'system'),
        temperature: payload.temperature
      };

      const response = await axios.post(apiUrl, requestPayload, { headers, timeout: 60000 });

      if (response.data && response.data.content && response.data.content[0]) {
        return response.data.content[0].text;
      } else {
        throw new Error('Invalid Anthropic response structure');
      }
    } catch (error) {
      console.error(`Diet AI Request Error:`, error.response?.data || error.message);
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
- Target Fat: ${nutritionGoals?.fat || 60}g

LAB REPORT DATA & DEFICIENCIES:
${labReports?.length > 0 ? labReports.map(r => `- ${r.parameter}: ${r.value} ${r.unit} (${r.status})`).join('\n') : 'No lab data available, base recommendations on Fitness Goal and BMI.'}
${deficiencies?.length > 0 ? deficiencies.map(d => `- ${d.nutrient || d.name} (${d.severity})`).join('\n') : ''}

CRITICAL INSTRUCTIONS:
1. Provide EXACTLY 4 DISTINCT meal options for EVERY category (breakfast, midMorningSnack, lunch, eveningSnack, dinner).
2. Each option should be a complete alternative with a DESCRIPTIVE MEAL NAME (e.g., "Masala Dosa", "Idli with Sambar", "Poha with Peanuts", "Oats Upma"). DO NOT use generic names like "Option 1", "Option 2", etc.
3. Ensure the combined nutrition of these options FULFILLS the user's daily macro targets (if user picks one option from each category).
4. Use ONLY Indian foods and traditional Indian recipes.
5. TRULY PRIORITIZE the user's specific food preferences for each meal. If they list breakfast favorites, use them for breakfast options.
6. STRICTLY avoid any 'Foods to Avoid' and adhere to 'Dietary Restrictions'. Try to incorporate 'Preferred Foods'.
7. If no lab data is provided, prioritize the Fitness Goal (${bmiGoal}) and BMI-based needs.
8. Provide specific portion sizes in grams/pieces/cups.
9. DO NOT provide more than 4 options per meal.
10. Each meal option MUST include: name, description, calories, protein, and benefits.
11. Ensure variety - no two options should be similar (e.g., don't have two rice-based meals).
12. ${promptExtension || ''}

RETURN JSON ONLY:
{
  "dailyCalorieTarget": number,
  "macroTargets": { "protein": number, "carbs": number, "fats": number },
  "mealPlan": {
    "breakfast": [
      { "name": "Masala Dosa with Sambar", "description": "Crispy dosa with spiced potato filling and sambar", "calories": 350, "protein": 12, "carbs": 45, "fats": 12, "benefits": "High in carbs for energy, good protein from lentils" },
      { "name": "Idli with Chutney", "description": "Steamed rice cakes with coconut chutney and sambar", "calories": 280, "protein": 10, "carbs": 38, "fats": 8, "benefits": "Light, easy to digest, good for weight management" },
      { "name": "Poha with Peanuts", "description": "Flattened rice with vegetables, peanuts and spices", "calories": 320, "protein": 14, "carbs": 40, "fats": 10, "benefits": "Rich in protein from peanuts, quick energy" },
      { "name": "Oats Upma", "description": "Savory oats with vegetables, peas and spices", "calories": 300, "protein": 11, "carbs": 42, "fats": 9, "benefits": "High fiber, sustained energy, good for digestion" }
    ],
    "midMorningSnack": [
      { "name": "Greek Yogurt with Berries", "description": "Protein-rich yogurt with fresh berries and honey", "calories": 150, "protein": 15, "carbs": 18, "fats": 2, "benefits": "High protein, probiotics for gut health" },
      { "name": "Almonds and Apple", "description": "Handful of almonds (25g) with fresh apple", "calories": 180, "protein": 6, "carbs": 20, "fats": 10, "benefits": "Healthy fats, fiber, sustained energy" },
      { "name": "Protein Smoothie", "description": "Banana, protein powder, milk and honey blend", "calories": 200, "protein": 20, "carbs": 22, "fats": 3, "benefits": "High protein, quick recovery, muscle building" },
      { "name": "Boiled Eggs with Toast", "description": "2 boiled eggs with whole wheat toast and butter", "calories": 220, "protein": 16, "carbs": 18, "fats": 10, "benefits": "Complete protein, choline for brain health" }
    ],
    "lunch": [
      { "name": "Chicken Biryani", "description": "Fragrant basmati rice with tender chicken and spices", "calories": 550, "protein": 35, "carbs": 60, "fats": 15, "benefits": "Complete meal, high protein, satisfying" },
      { "name": "Dal Makhani with Roti", "description": "Creamy lentil curry with 2 whole wheat rotis", "calories": 480, "protein": 18, "carbs": 65, "fats": 12, "benefits": "Plant-based protein, fiber-rich, vegetarian" },
      { "name": "Paneer Tikka Masala", "description": "Cottage cheese in tomato-based gravy with rice", "calories": 520, "protein": 28, "carbs": 58, "fats": 16, "benefits": "High calcium, protein-rich, satisfying" },
      { "name": "Fish Curry with Rice", "description": "Spiced fish in coconut gravy with basmati rice", "calories": 500, "protein": 32, "carbs": 55, "fats": 14, "benefits": "Omega-3 rich, high protein, heart-healthy" }
    ],
    "eveningSnack": [
      { "name": "Roasted Chickpeas", "description": "Spiced roasted chickpeas (100g)", "calories": 140, "protein": 8, "carbs": 16, "fats": 4, "benefits": "High fiber, plant-based protein, crunchy" },
      { "name": "Mixed Nuts", "description": "Almonds, cashews, walnuts mix (30g)", "calories": 180, "protein": 6, "carbs": 8, "fats": 16, "benefits": "Healthy fats, antioxidants, energy boost" },
      { "name": "Cucumber and Hummus", "description": "Fresh cucumber slices with hummus dip", "calories": 120, "protein": 5, "carbs": 12, "fats": 5, "benefits": "Low calorie, hydrating, light" },
      { "name": "Sprout Salad", "description": "Fresh sprouts with lemon dressing and spices", "calories": 100, "protein": 7, "carbs": 10, "fats": 3, "benefits": "Nutrient-dense, enzymes for digestion" }
    ],
    "dinner": [
      { "name": "Vegetable Khichdi", "description": "One-pot rice and lentil dish with vegetables", "calories": 380, "protein": 14, "carbs": 52, "fats": 10, "benefits": "Light, easy to digest, complete meal" },
      { "name": "Grilled Chicken with Salad", "description": "Protein-rich grilled chicken with fresh vegetable salad", "calories": 420, "protein": 38, "carbs": 28, "fats": 12, "benefits": "High protein, low carb, muscle building" },
      { "name": "Moong Dal Soup", "description": "Light lentil soup with vegetables and spices", "calories": 280, "protein": 12, "carbs": 38, "fats": 6, "benefits": "Light, nutritious, easy to digest" },
      { "name": "Tofu Stir-fry", "description": "Tofu with mixed vegetables and light sauce", "calories": 350, "protein": 20, "carbs": 35, "fats": 14, "benefits": "Plant-based protein, low calorie, vegetarian" }
    ]
  },
  "keyFoods": [{ "name": "Food", "reason": "Why", "frequency": "Daily" }],
  "deficiencyCorrections": [{ "deficiency": "Name", "indianFoods": [], "mealSuggestions": [] }],
  "lifestyleRecommendations": [],
  "avoidFoods": [{ "food": "Name", "reason": "Why" }],
  "avoidSuggestions": ["Suggestion 1", "Suggestion 2"]
}`;

    const payload = {
      max_tokens: 4000,
      system: systemMsg,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    };

    try {
      const aiResponse = await this.makeAIRequest(payload);
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) return robustJsonParse(jsonMatch[0]);
      throw new Error('Failed to parse diet plan JSON');
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
