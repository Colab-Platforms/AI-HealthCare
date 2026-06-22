const axios = require('axios');
const { robustJsonParse } = require('../utils/aiParser');
const UsageLog = require('../models/UsageLog');

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
    const RETRY_DELAYS = [8000, 20000, 40000, 60000, 90000];
    const startTime = Date.now();

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
          const usage = response.data?.usage || {};
          UsageLog.create({
            userId:           payload.userId || null,
            feature:          'diet_plan',
            model:            currentModel,
            inputTokens:      usage.input_tokens               || 0,
            outputTokens:     usage.output_tokens              || 0,
            cacheReadTokens:  usage.cache_read_input_tokens    || 0,
            cacheWriteTokens: usage.cache_creation_input_tokens || 0,
            durationMs:       Date.now() - startTime,
            status:           'success',
          }).catch(e => console.error('UsageLog save failed:', e.message));
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
    const { age, gender, weight, height, currentBMI, bmiGoal, activityLevel, nutritionGoals, medicalConditions, allergies, diabetesInfo, alcoholContext, alcoholSummary, lifestyle, country, region, foodPreferences } = userData;
    const isDiabetic = !!diabetesInfo;
    const alcoholLine = alcoholContext || 'No alcohol tracker data';
    const elevatedNote = alcoholSummary?.bingePattern || (alcoholSummary?.today >= 3)
      ? 'User logged several drinks recently — prefer lighter dinner options and avoid suggesting alcohol pairings; do not make medical claims.'
      : '';

    // Build food preference context
    const prefLines = [];
    if (foodPreferences?.mealPreferences?.breakfast?.length) prefLines.push(`- Breakfast Favorites: ${foodPreferences.mealPreferences.breakfast.join(', ')}`);
    if (foodPreferences?.mealPreferences?.lunch?.length) prefLines.push(`- Lunch Favorites: ${foodPreferences.mealPreferences.lunch.join(', ')}`);
    if (foodPreferences?.mealPreferences?.snacks?.length) prefLines.push(`- Snack Preferences: ${foodPreferences.mealPreferences.snacks.join(', ')}`);
    if (foodPreferences?.mealPreferences?.dinner?.length) prefLines.push(`- Dinner Favorites: ${foodPreferences.mealPreferences.dinner.join(', ')}`);
    if (foodPreferences?.preferredFoods?.length) prefLines.push(`- General Preferred Foods: ${foodPreferences.preferredFoods.join(', ')}`);
    if (foodPreferences?.foodsToAvoid?.length) prefLines.push(`- MUST AVOID (user dislikes): ${foodPreferences.foodsToAvoid.join(', ')}`);
    if (foodPreferences?.dietaryRestrictions?.length) prefLines.push(`- Dietary Restrictions: ${foodPreferences.dietaryRestrictions.join(', ')}`);
    const prefContext = prefLines.length ? `\nUser Food Preferences:\n${prefLines.join('\n')}` : '';
    const diabeticAlcoholNote = isDiabetic
      ? 'Diabetic user: do not suggest alcohol; keep meals steady and practical without medical claims about glucose and alcohol.'
      : '';
    
    // Build region/country specific instructions
    let regionCountryInstructions = '';
    const userCountry = country || 'India';
    const userRegion = region || 'other';
    
    if (userCountry === 'India') {
      if (userRegion && userRegion !== 'other') {
        regionCountryInstructions = `\n- REGION FOCUS: Prioritize ${userRegion} Indian cuisine and regional specialties. Include traditional ${userRegion} dishes.`;
      } else {
        regionCountryInstructions = '\n- CUISINE: Focus on diverse Indian cuisine from all regions.';
      }
    } else {
      regionCountryInstructions = `\n- COUNTRY FOCUS: User is from ${userCountry}. Suggest cuisine popular in ${userCountry} that aligns with their dietary preferences.`;
      if (userRegion && userRegion !== 'other') {
        regionCountryInstructions += `\n- REGION PREFERENCE: User prefers ${userRegion} style cuisine if available in ${userCountry}.`;
      }
    }
    
    const prompt = `Indian Clinical Nutritionist. Generate a 100% accurate JSON meal plan with 7 daily options per meal (one for each day of the week).
STRUCTURE:
{
  "dailyCalorieTarget": ${nutritionGoals?.dailyCalories || 2000},
  "mealPlan": {
    "breakfast": [
      {"name": "Meal Name", "portionSize": "1 bowl / 2 pieces / 200g", "calories": 0, "protein": 0, "carbs": 0, "fats": 0},
      ... 7 items total
    ],
    "lunch": [
      {"name": "Meal Name", "portionSize": "1 plate / 1.5 bowl / 350g", "calories": 0, "protein": 0, "carbs": 0, "fats": 0},
      ... 7 items total
    ],
    "dinner": [
      {"name": "Meal Name", "portionSize": "1 bowl / 150g", "calories": 0, "protein": 0, "carbs": 0, "fats": 0},
      ... 7 items total
    ]
  }
}
USER DATA:
- Profile: ${age}y ${gender}, Weight: ${weight}kg, Height: ${height}cm, BMI: ${currentBMI}
- Goal: ${bmiGoal}
- Activity: ${activityLevel}
- Medical Conditions: ${medicalConditions?.join(', ') || 'None'}
- Allergies: ${allergies?.join(', ') || 'None'}
- Diabetes Status: ${isDiabetic ? `Positive (${diabetesInfo.diabetesType})` : 'Negative'}
- Alcohol / Lifestyle: ${alcoholLine}
- Profile alcohol flag: ${lifestyle?.alcohol ? `Yes (${lifestyle.alcoholFrequency || 'unspecified'})` : 'No or not set'}
- Macro Targets: Protein ${nutritionGoals?.protein}g, Carbs ${nutritionGoals?.carbs}g, Fats ${nutritionGoals?.fats}g${prefContext}${regionCountryInstructions}

REQUIREMENTS:
1. CRITICAL CALORIE RULE: Each breakfast+lunch+dinner COMBO (same array index across all three meals) MUST total exactly ${nutritionGoals?.dailyCalories || 2000} kcal ± 50 kcal. So breakfast[0].calories + lunch[0].calories + dinner[0].calories = target. Same for index 1, 2, 3, 4, 5, 6. NEVER let any single day's combo exceed ${nutritionGoals?.dailyCalories || 2000} kcal.
2. PRECISE PORTIONS: Use measurements like "1.5 Bowl (250g)", "2 Medium Roti (80g)", etc. Include both visual quantity AND approximate weight.
3. OUTPUT EXACTLY 7 unique meal options per meal type (breakfast, lunch, dinner) — all 7 must be completely different dishes.
4. STRICTLY FOLLOW user food preferences above. Prioritize their favorites. NEVER suggest foods from their "MUST AVOID" list.
5. If alcohol intake is elevated per user log, prefer lighter dinners and fewer empty calories — no medical claims.
6. ${elevatedNote} ${diabeticAlcoholNote}
7. ${promptExtension}

JSON output ONLY. No markdown. Exact calorie math is mandatory.`;

    try {
      const aiResponse = await this.makeAIRequest({
        max_tokens: 8000,
        system: "Expert Clinical Dietitian. Generate varied, scientifically accurate 7-day meal plans based on user's region, country, and food preferences. Each day must have a completely different meal. Never repeat dishes. Strict calorie compliance per day combo is mandatory.",
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
