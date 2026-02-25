const axios = require('axios');

/**
 * AI Diet Recommendation Service
 * Generates personalized diet plans and supplement recommendations
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const PRIMARY_MODEL = 'anthropic/claude-3.5-sonnet';
const BACKUP_MODEL = 'openai/gpt-4o-mini';
const FALLBACK_MODEL = 'google/gemini-pro-1.5';

class DietRecommendationAI {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY;
  }

  getApiParams(attempt = 0) {
    // Re-read API key in case env changed
    this.apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY;

    const isAnthropicDirect = this.apiKey?.startsWith('sk-ant');
    const apiUrl = isAnthropicDirect ? ANTHROPIC_API_URL : OPENROUTER_API_URL;

    let model = isAnthropicDirect ? 'claude-3-5-sonnet-20241022' : 'anthropic/claude-3-5-sonnet';
    if (!isAnthropicDirect && attempt === 1) model = BACKUP_MODEL;
    if (!isAnthropicDirect && attempt >= 2) model = FALLBACK_MODEL;

    return { isAnthropicDirect, apiUrl, model };
  }

  async makeAIRequest(payload, attempt = 0) {
    const { isAnthropicDirect, apiUrl, model } = this.getApiParams(attempt);

    console.log(`🔄 DietAI: Using ${isAnthropicDirect ? 'Anthropic Direct' : 'OpenRouter'} with model: ${model} (attempt ${attempt + 1})`);

    const headers = isAnthropicDirect ? {
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    } : {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://fitcure.ai',
      'X-Title': 'FitCure Diet'
    };

    try {
      payload.model = model;
      // Adjust payload for Anthropic Direct if needed (it uses 'system' property differently)
      const requestPayload = isAnthropicDirect ? {
        model: payload.model,
        max_tokens: payload.max_tokens,
        system: payload.system || (payload.messages && payload.messages[0].role === 'system' ? payload.messages[0].content : ''),
        messages: payload.messages.filter(m => m.role !== 'system'),
        temperature: payload.temperature
      } : payload;

      const response = await axios.post(apiUrl, requestPayload, { headers, timeout: 60000 });

      let aiResponse = '';
      if (isAnthropicDirect) {
        if (response.data && response.data.content && response.data.content[0]) {
          aiResponse = response.data.content[0].text;
        } else {
          throw new Error('Invalid Anthropic response structure');
        }
      } else {
        if (response.data && response.data.choices && response.data.choices[0]) {
          aiResponse = response.data.choices[0].message.content;
        } else {
          throw new Error('Invalid OpenRouter response structure');
        }
      }
      return aiResponse;
    } catch (error) {
      console.error(`Diet AI Request Error (Attempt ${attempt + 1}):`, error.response?.data || error.message);

      if (!isAnthropicDirect && attempt < 2) {
        console.log(`⚠️ Attempt ${attempt + 1} failed. Retrying with fallback model...`);
        return this.makeAIRequest(payload, attempt + 1);
      }

      // If Anthropic direct fails and OpenRouter key exists, try OpenRouter as fallback
      if (isAnthropicDirect && process.env.OPENROUTER_API_KEY) {
        console.log('⚠️ Anthropic direct failed. Trying OpenRouter as fallback...');
        const origKey = process.env.ANTHROPIC_API_KEY;
        process.env.ANTHROPIC_API_KEY = '';
        try {
          const result = await this.makeAIRequest(payload, 0);
          process.env.ANTHROPIC_API_KEY = origKey;
          return result;
        } catch (retryErr) {
          process.env.ANTHROPIC_API_KEY = origKey;
          throw retryErr;
        }
      }

      throw error;
    }
  }

  /**
   * Generate a personalized diet plan
   */
  async generatePersonalizedDietPlan(userData) {
    const {
      age, gender, weight, height, currentBMI, bmiGoal,
      dietaryPreference, activityLevel, medicalConditions,
      allergies, fitnessGoals, diabetesInfo, labReports, deficiencies,
      nutritionGoals
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
1. Provide 4 DISTINCT meal options for EVERY category (breakfast, midMorningSnack, lunch, eveningSnack, dinner).
2. Ensure the combined nutrition of these meals FULFILLS the user's daily macro targets.
3. Use ONLY Indian foods.
4. If no lab data is provided, prioritize the Fitness Goal (${bmiGoal}) and BMI-based needs.
5. Provide specific portion sizes in grams/pieces.

RETURN JSON ONLY:
{
  "dailyCalorieTarget": number,
  "macroTargets": { "protein": number, "carbs": number, "fats": number },
  "mealPlan": {
    "breakfast": [
      { "name": "Option 1", "description": "Desc", "calories": number, "protein": number, "benefits": "Why" },
      { "name": "Option 2", "description": "Desc", "calories": number, "protein": number, "benefits": "Why" },
      { "name": "Option 3", "description": "Desc", "calories": number, "protein": number, "benefits": "Why" },
      { "name": "Option 4", "description": "Desc", "calories": number, "protein": number, "benefits": "Why" }
    ],
    "lunch": [
       { "name": "Option 1", "description": "Desc", "calories": number, "protein": number, "benefits": "Why" },
       { "name": "Option 2", "description": "Desc", "calories": number, "protein": number, "benefits": "Why" },
       { "name": "Option 3", "description": "Desc", "calories": number, "protein": number, "benefits": "Why" },
       { "name": "Option 4", "description": "Desc", "calories": number, "protein": number, "benefits": "Why" }
    ],
    "dinner": [
       { "name": "Option 1", "description": "Desc", "calories": number, "protein": number, "benefits": "Why" },
       { "name": "Option 2", "description": "Desc", "calories": number, "protein": number, "benefits": "Why" },
       { "name": "Option 3", "description": "Desc", "calories": number, "protein": number, "benefits": "Why" },
       { "name": "Option 4", "description": "Desc", "calories": number, "protein": number, "benefits": "Why" }
    ],
    "midMorningSnack": [
       { "name": "Option 1", "description": "Desc", "calories": number, "protein": number, "benefits": "Why" },
       { "name": "Option 2", "description": "Desc", "calories": number, "protein": number, "benefits": "Why" },
       { "name": "Option 3", "description": "Desc", "calories": number, "protein": number, "benefits": "Why" },
       { "name": "Option 4", "description": "Desc", "calories": number, "protein": number, "benefits": "Why" }
    ],
    "eveningSnack": [
       { "name": "Option 1", "description": "Desc", "calories": number, "protein": number, "benefits": "Why" },
       { "name": "Option 2", "description": "Desc", "calories": number, "protein": number, "benefits": "Why" },
       { "name": "Option 3", "description": "Desc", "calories": number, "protein": number, "benefits": "Why" },
       { "name": "Option 4", "description": "Desc", "calories": number, "protein": number, "benefits": "Why" }
    ]
  },
  "keyFoods": [{ "name": "Food", "reason": "Why", "frequency": "Daily" }],
  "deficiencyCorrections": [{ "deficiency": "Name", "indianFoods": [], "mealSuggestions": [] }],
  "lifestyleRecommendations": [],
  "avoidFoods": [{ "food": "Name", "reason": "Why" }]
}`;

    const { isAnthropicDirect } = this.getApiParams();
    const systemMsg = 'You are an expert Indian nutritionist specializing in personalized diet plans.';

    const payload = !isAnthropicDirect ? {
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4000
    } : {
      max_tokens: 4000,
      system: systemMsg,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    };

    try {
      const aiResponse = await this.makeAIRequest(payload);
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
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

    const { isAnthropicDirect } = this.getApiParams();
    const systemMsg = 'You are an expert clinical nutritionist.';

    const payload = !isAnthropicDirect ? {
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 2000
    } : {
      max_tokens: 2000,
      system: systemMsg,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5
    };

    try {
      const aiResponse = await this.makeAIRequest(payload);
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      throw new Error('Failed to parse supplement recommendations JSON');
    } catch (error) {
      console.error('AI Supplement Error:', error.message);
      throw error;
    }
  }
}

module.exports = new DietRecommendationAI();
