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

    const prompt = `You are an expert Indian nutritionist and clinical dietitian who has deep knowledge of REAL Indian cuisine and eating habits. Generate a highly personalized Indian meal plan using ONLY authentic, commonly eaten Indian foods.

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

═══════════════════════════════════════════════════
🚫 ABSOLUTE BAN - BEEF (MOST IMPORTANT RULE):
═══════════════════════════════════════════════════
NEVER suggest beef, steak, beef curry, beef biryani, beef fry, beef keema, beef stew, or ANY beef-based dish to ANY user regardless of their dietary preference. This is a strict cultural rule for this platform. Use chicken, mutton/goat, fish, eggs, paneer, or dal as protein alternatives instead.

═══════════════════════════════════════════════════
🚫 BANNED FOOD COMBINATIONS (DO NOT SUGGEST THESE):
═══════════════════════════════════════════════════
The following are UNNATURAL combinations that NO Indian eats. NEVER suggest these:
- "White egg with sambar" or "Egg sambar" — Indians don't eat this
- "Palak chicken" or "Spinach chicken" — This is not an Indian dish
- "Chicken poha" — No Indian eats chicken in poha
- "Paneer dosa" — This is not a real Indian combo
- "Chicken idli" — Nobody eats this
- "Egg uttapam" — Not a common Indian dish
- "Fish paratha" — Indians don't eat this
- "Chicken upma" — Not an Indian dish
- "Mutton poha" — This does not exist
- "Paneer with sambar" — Not eaten together
- "Chicken with curd rice" — Not a real combo
- Any fusion of South Indian + North Indian items that don't go together

═══════════════════════════════════════════════════
✅ AUTHENTIC INDIAN MEAL EXAMPLES (USE THESE AS REFERENCE):
═══════════════════════════════════════════════════
BREAKFAST (what Indians ACTUALLY eat):
- Poha (plain, or with peanuts/sev), Upma, Idli with coconut chutney & sambar, Dosa with chutney & sambar
- Paratha (aloo/gobi/methi) with curd & pickle, Stuffed paratha with butter
- Besan chilla / Moong dal chilla, Bread omelette, Boiled eggs with toast
- Oats porridge, Daliya/broken wheat porridge, Rava idli, Medu vada with sambar
- Poori with aloo sabzi, Chole bhature, Pongal with chutney
- Ragi dosa, Pesarattu, Sabudana khichdi

MID-MORNING SNACK (what Indians ACTUALLY eat):
- Fruits (banana, apple, papaya, guava, pomegranate, seasonal fruits)
- Handful of dry fruits (almonds, walnuts, cashews)
- Buttermilk / Chaas, Coconut water, Nimbu pani / lemon water
- Makhana (roasted fox nuts), Chana (roasted chickpeas)
- Sprouts chaat, Fruit chaat

LUNCH (what Indians ACTUALLY eat):
- Dal (toor/moong/masoor) + Rice + Sabzi + Roti + Salad
- Rajma chawal, Chole chawal, Kadhi chawal
- Chicken curry with rice/roti, Egg curry with rice/roti
- Fish curry with rice (especially South/East India)
- Mutton curry with roti/rice, Keema with roti
- Sambar rice, Rasam rice, Curd rice with pickle
- Biryani (chicken/mutton/veg), Pulao with raita
- Roti + dal + any seasonal sabzi (bhindi, lauki, tinda, baingan, aloo gobi, mixed veg)
- Paneer butter masala with naan/roti, Palak paneer with roti

EVENING SNACK (what Indians ACTUALLY eat):
- Chai/coffee with biscuits or rusk, Bread pakora, Samosa
- Dhokla, Khandvi, Bhel puri, Sev puri
- Idli or dosa (leftover), Vada pav, Aloo tikki
- Popcorn, Makhana, Murmura/puffed rice, Mixture/chivda
- Fruit plate, Sprouts salad

DINNER (what Indians ACTUALLY eat):
- Roti/chapati with dal + sabzi, Paratha with curd
- Khichdi with papad + ghee, Dal rice with sabzi
- Chicken curry/butter chicken with roti/naan
- Egg bhurji with roti, Paneer bhurji with roti
- Fish fry with rice + dal, Grilled chicken with salad
- Light moong dal with jeera rice, Mix veg sabzi with roti
- Palak paneer with roti, Dal makhani with jeera rice

═══════════════════════════════════════════════════
📋 CRITICAL INSTRUCTIONS:
═══════════════════════════════════════════════════
1. NEVER suggest beef or any beef-based dish. This is NON-NEGOTIABLE.
2. ONLY suggest meals that a typical Indian household would cook and eat. If a meal combination would look strange to an average Indian person, DO NOT suggest it.
3. GOLDEN RULE: If a dish doesn't exist on any normal Indian restaurant menu or in any Indian household, DO NOT invent it.
4. Keep food combinations culturally authentic — sambar goes with idli/dosa/rice, dal goes with rice/roti, curries go with rice/roti/naan, etc.
5. If 'Preferred Foods' or 'Meal Favorites' are provided, construct the plan from those items BUT still follow authentic combinations.
6. Provide EXACTLY 3 DISTINCT meal options for EVERY category (breakfast, midMorningSnack, lunch, eveningSnack, dinner).
7. BE ULTRA-CONCISE. Use short meal names and 1-sentence descriptions.
8. Ensure the combined nutrition FULFILLS the user's daily macro targets.
9. MEAL CALORIE TARGETS (CRITICAL): Every meal option you suggest must strictly follow the calorie distribution for that meal time (±50 kcal):
   - Breakfast: 25% of daily calories (~${Math.round((userData.nutritionGoals?.dailyCalories || 2000) * 0.25)} kcal)
   - Mid-Morning: 10% of daily calories (~${Math.round((userData.nutritionGoals?.dailyCalories || 2000) * 0.10)} kcal)
   - Lunch: 30% of daily calories (~${Math.round((userData.nutritionGoals?.dailyCalories || 2000) * 0.30)} kcal)
   - Evening: 10% of daily calories (~${Math.round((userData.nutritionGoals?.dailyCalories || 2000) * 0.10)} kcal)
   - Dinner: 25% of daily calories (~${Math.round((userData.nutritionGoals?.dailyCalories || 2000) * 0.25)} kcal)
10. Ensure variety — no two options should be similar.
11. Provide specific portion sizes in grams, pieces, or cups in a new field: "portionSize".
12. MEAL NUTRITION TARGETS (NON-NEGOTIABLE): Every meal option you suggest MUST STRICTLY follow both calorie AND macro distributions (±10%):
    - Breakfast: 25% of daily targets (Cal: ~${Math.round((userData.nutritionGoals?.dailyCalories || 2000) * 0.25)} kcal, Protein: ~${Math.round((userData.nutritionGoals?.protein || 120) * 0.25)}g, Carbs: ~${Math.round((userData.nutritionGoals?.carbs || 200) * 0.25)}g, Fats: ~${Math.round((userData.nutritionGoals?.fats || 60) * 0.25)}g)
    - Mid-Morning: 10% of daily targets (Cal: ~${Math.round((userData.nutritionGoals?.dailyCalories || 2000) * 0.10)} kcal, Protein: ~${Math.round((userData.nutritionGoals?.protein || 120) * 0.10)}g, Carbs: ~${Math.round((userData.nutritionGoals?.carbs || 200) * 0.10)}g, Fats: ~${Math.round((userData.nutritionGoals?.fats || 60) * 0.10)}g)
    - Lunch: 30% of daily targets (Cal: ~${Math.round((userData.nutritionGoals?.dailyCalories || 2000) * 0.30)} kcal, Protein: ~${Math.round((userData.nutritionGoals?.protein || 120) * 0.30)}g, Carbs: ~${Math.round((userData.nutritionGoals?.carbs || 200) * 0.30)}g, Fats: ~${Math.round((userData.nutritionGoals?.fats || 60) * 0.30)}g)
    - Evening: 10% of daily targets (Cal: ~${Math.round((userData.nutritionGoals?.dailyCalories || 2000) * 0.10)} kcal, Protein: ~${Math.round((userData.nutritionGoals?.protein || 120) * 0.10)}g, Carbs: ~${Math.round((userData.nutritionGoals?.carbs || 200) * 0.10)}g, Fats: ~${Math.round((userData.nutritionGoals?.fats || 60) * 0.10)}g)
    - Dinner: 25% of daily targets (Cal: ~${Math.round((userData.nutritionGoals?.dailyCalories || 2000) * 0.25)} kcal, Protein: ~${Math.round((userData.nutritionGoals?.protein || 120) * 0.25)}g, Carbs: ~${Math.round((userData.nutritionGoals?.carbs || 200) * 0.25)}g, Fats: ~${Math.round((userData.nutritionGoals?.fats || 60) * 0.25)}g)
13. Each meal option MUST include: name, description, portionSize, calories, protein, carbs, fats, and benefits. Do NOT exceed the daily total goal when the meals are combined.
13. STRICTLY avoid any 'Foods to Avoid' and adhere to 'Dietary Restrictions'.
14. Use ONLY authentic Indian foods that are commonly available across India.
15. If the user wants to REGENERATE, provide COMPLETELY DIFFERENT meal options.
16. For vegetarian users: Use paneer, dal, chole, rajma, soya chunks, tofu, sprouts, dairy as protein sources.
17. For non-vegetarian users: Use chicken, mutton/goat, fish, eggs (NEVER beef) along with vegetarian options.
18. SPECIAL DIABETIC PROTOCOL (IF APPLICABLE):
    If the user is diabetic:
    - Strictly PRIORITIZE low Glycemic Index (GI) foods (e.g., Brown Rice, Whole Wheat, Bajra, Jowar, Ragi, Oats).
    - Ensure EVERY meal has a high fiber component (green leafy vegetables, legumes).
    - NEVER suggest refined sugars, white flour (Maida), white bread, or sweetened juices.
    - Suggest small, frequent meals if appropriate, but keep to the 5-meal structure.
    - Focus on proteins and healthy fats to slow down glucose absorption.
    - Limit high-sugar fruits (like mango, chickoo, grapes) and suggest low-GI fruits like apple, pear, or papaya instead.

19. ${promptExtension || ''}

RETURN JSON ONLY. Ensure the JSON is valid and complete:
{
  "dailyCalorieTarget": number,
  "macroTargets": { "protein": number, "carbs": number, "fats": number },
  "mealPlan": {
    "breakfast": [
      { "name": "Meal Name", "description": "desc", "portionSize": "100g / 2 pieces", "calories": 300, "protein": 15, "carbs": 40, "fats": 10, "benefits": "benefits" }
    ],
    "midMorningSnack": [
      { "name": "Meal Name", "description": "desc", "portionSize": "1 bowl", "calories": 150, "protein": 5, "carbs": 20, "fats": 5, "benefits": "benefits" }
    ],
    "lunch": [
      { "name": "Meal Name", "description": "desc", "portionSize": "2 rotis + 1 bowl dal", "calories": 500, "protein": 30, "carbs": 60, "fats": 15, "benefits": "benefits" }
    ],
    "eveningSnack": [
      { "name": "Meal Name", "description": "desc", "portionSize": "1 cup", "calories": 150, "protein": 5, "carbs": 20, "fats": 5, "benefits": "benefits" }
    ],
    "dinner": [
      { "name": "Meal Name", "description": "desc", "portionSize": "1 plate", "calories": 400, "protein": 25, "carbs": 50, "fats": 10, "benefits": "benefits" }
    ]
  },
  "keyFoods": [{ "name": "Food", "reason": "Why", "frequency": "Daily" }],
  "deficiencyCorrections": [{ "deficiency": "Name", "indianFoods": [], "mealSuggestions": [] }],
  "lifestyleRecommendations": [],
  "avoidFoods": [{ "food": "Name", "reason": "Why" }],
  "avoidSuggestions": ["Suggestion 1", "Suggestion 2"]
}`;

    const systemMsg = "You are an expert Indian nutritionist and clinical dietitian. Provide personalized meal plans in JSON format. CRITICAL RULES: 1) NEVER suggest beef or any beef product to any user. 2) ONLY suggest authentic Indian meals that real Indian families actually cook and eat daily. 3) Do NOT invent weird food combinations — every suggested meal must be something commonly found in Indian households or restaurants. 4) Use chicken, mutton/goat, fish, eggs, paneer, dal, legumes as protein sources — NEVER beef.";

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
