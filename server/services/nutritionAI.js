const axios = require('axios');
const { robustJsonParse } = require('../utils/aiParser');
const UsageLog = require('../models/UsageLog');
const openrouterAI = require('./openrouterAI');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-6';

class NutritionAI {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
  }

  // The OpenRouter/Gemini backend occasionally returns a truncated response for no
  // discernible reason (observed even with ample max_tokens and reasoning disabled) —
  // one retry absorbs that flakiness instead of surfacing a 500 to the user.
  async _withRetry(fn, retries = 1) {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) throw error;
      console.warn(`⚠️ [NutritionAI] Request failed (${error.message}), retrying once...`);
      return this._withRetry(fn, retries - 1);
    }
  }

  getApiParams() {
    this.apiKey = process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.trim() : '';
    return { apiUrl: ANTHROPIC_API_URL, model: CLAUDE_MODEL };
  }

  async makeAIRequest(payload) {
    const { apiUrl, model } = this.getApiParams();
    if (!this.apiKey) {
      console.error('❌ ANTHROPIC_API_KEY is not defined in environment');
      throw new Error('ANTHROPIC_API_KEY missing');
    }

    console.log('🔄 [NutritionAI] Request | Model:', model, '| Key:', this.apiKey.substring(0, 10) + '...');

    const headers = {
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    };

    try {
      const requestPayload = {
        model,
        max_tokens: payload.max_tokens || 2000,
        system: payload.system || '',
        messages: payload.messages || [],
        temperature: 0.4
      };

      const startTime = Date.now();
      const resp = await axios.post(apiUrl, requestPayload, { headers, timeout: 120000 });
      const text = resp.data?.content?.[0]?.text;

      if (!text) {
        console.error('❌ [NutritionAI] Empty response body:', resp.data);
        throw new Error('No content in Anthropic response');
      }

      const usage = resp.data?.usage || {};
      UsageLog.create({
        userId:           payload.userId || null,
        feature:          'diet_plan',
        model:            requestPayload.model,
        inputTokens:      usage.input_tokens               || 0,
        outputTokens:     usage.output_tokens              || 0,
        cacheReadTokens:  usage.cache_read_input_tokens    || 0,
        cacheWriteTokens: usage.cache_creation_input_tokens || 0,
        durationMs:       Date.now() - startTime,
        status:           'success',
      }).catch(e => console.error('UsageLog save failed:', e.message));

      return text;
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.message;
      console.error('❌ [NutritionAI] API ERROR:', errorMsg);
      if (err.response?.data) {
        console.error('❌ [NutritionAI] Full API Error Data:', JSON.stringify(err.response.data));
      }
      throw new Error(`AI Analysis failed: ${errorMsg}`);
    }
  }

  // imageCount > 0 tailors the instructions for image input (single or multi-photo); 0 = text-only input.
  // medicalContext (from utils/medicalContext.js) is '' when the user has no relevant conditions/allergies on file.
  _getUnifiedPrompt(context = '', imageCount = 0, medicalContext = '') {
    const multiImageNote = imageCount > 1
      ? `\n    MULTI-IMAGE INPUT: You have been given ${imageCount} separate photos that together make up ONE meal. In most cases each photo shows a DIFFERENT dish — treat each photo as contributing one or more entries to the "dishes" array. Do NOT merge two visibly different photos into a single dish unless they are clearly duplicate angles of the exact same plate. If any single photo itself shows multiple distinct food items side by side (e.g. a thali or a tray), split THAT photo into multiple dish entries as well.`
      : '';

    return `Analyze the provided image(s) and/or text and return a JSON object describing the FULL meal.
    Context: "${context}"
    ${multiImageNote}${medicalContext}

    TASK:
    1. Determine if the input contains actual FOOD or drink.
    2. If NOT food (e.g., a person, a car, a document, or a completely empty plate), set "isFood" to false and provide a helpful "errorMessage".
    3. If it IS food, identify EVERY distinct dish present, break EACH dish down into its real component ingredients, and perform high-precision nutritional analysis at the ingredient level — then roll that up to dish level and meal level.

    - IDENTIFICATION: Be specific per dish (e.g., "Egg Curry" vs "Boiled Egg").
    - REFERENCE DATA: Use official nutritional databases (USDA, Indian Food Composition Tables (IFCT)) as your primary source for all values.
    - PORTION SENSE: Use the context "${context}" for quantity when it specifies one. Where context is missing for a dish/ingredient, use standard serving sizes.
    - MACRO PRECISION (MANDATORY): Use these multipliers:
        * 1g Protein = 4 kcal
        * 1g Carb = 4 kcal
        * 1g Fat = 9 kcal
      For every ingredient, every dish, and the meal total: (Protein*4 + Carbs*4 + Fats*9) MUST closely match the calories returned.
    - FIBER PRECISION (MANDATORY): Never default fiber to 0 unless the food genuinely contains none (e.g., oil, sugar, plain meat). Estimate fiber from real food-composition data (USDA, IFCT) for every ingredient with the same rigor as protein/carbs/fats — grains, legumes, vegetables, and fruits all carry meaningful fiber and must reflect it.
    - COMPOSITE DECOMPOSITION (MANDATORY): For EVERY dish, list its real component ingredients with individual quantity + nutrition (e.g., "Egg Curry" → Boiled Egg, Onion-Tomato Gravy, Cooking Oil, Spices). Never return a dish with zero or exactly one vague ingredient when it's clearly a composite dish — decompose it like a nutritionist would. Do not use generic "combo meal" averages.
    - EXCLUSIVITY: Account for the specific preparation mentioned (oils, frying, etc.) rather than generic assumptions.

    JSON STRUCTURE (return EXACTLY this shape, always — even for a single dish/photo/text input, "dishes" must still be a 1-item array):
    {
      "isFood": true/false,
      "errorMessage": "Helpful message if not food (e.g., 'This looks like a medical report, not a meal. Please upload a food photo.')",
      "dishes": [
        {
          "name": "Specific dish name",
          "quantity": "Estimated portion for this dish (e.g., 1 bowl, 250g)",
          "ingredients": [
            {
              "name": "Ingredient name",
              "quantity": "Estimated quantity (e.g., 100g, 1 tsp)",
              "nutrition": { "calories": 0, "protein": 0, "carbs": 0, "fats": 0, "fiber": 0, "sugar": 0, "sodium": 0 }
            }
          ],
          "nutrition": { "calories": 0, "protein": 0, "carbs": 0, "fats": 0, "fiber": 0, "sugar": 0, "sodium": 0 },
          "healthScore": 0-100
        }
      ],
      "foodItem": {
        "name": "All dish names joined with ', ' (or the single dish name if only one)",
        "quantity": "Combined portion summary across all dishes",
        "nutrition": { "calories": 0, "protein": 0, "carbs": 0, "fats": 0, "fiber": 0, "sugar": 0, "sodium": 0 }
      },
      "totalNutrition": { "calories": 0, "protein": 0, "carbs": 0, "fats": 0, "fiber": 0, "sugar": 0, "sodium": 0 },
      "healthScore": 0-100,
      "analysis": "Short 2-sentence summary of the FULL meal's health impact",
      "micronutrients": [{ "name": "Vitamin C", "amount": "12", "unit": "mg", "percentage": 13 }],
      "enhancementTips": [{ "name": "Tip Title", "benefit": "Explanation" }],
      "healthBenefitsSummary": "Positive impact summary for the whole meal",
      "warnings": ["Disadvantages if genuinely unhealthy for this meal specifically. Follow the MEDICAL WARNING RULES above strictly if a USER MEDICAL CONTEXT block is present — most meals should have zero or one medical warning, not a full checklist of every condition on file."],
      "alternatives": [{ "name": "Name", "description": "Why better", "nutrition": { "calories": 0, "protein": 0 } }]
    }

    CRITICAL CONSISTENCY RULES:
    - "totalNutrition" and "foodItem.nutrition" MUST equal the SUM of all "dishes[].nutrition".
    - Each "dishes[].nutrition" MUST equal the SUM of that dish's "ingredients[].nutrition".
    - Top-level "healthScore" is the calorie-weighted average of all dishes' healthScore.`;
  }

  // Normalizes a raw image input (string, data-URI string, or {data, mediaType}) into { data, mediaType }
  _normalizeImageInput(img) {
    if (img && typeof img === 'object' && img.data) {
      const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      return { data: img.data, mediaType: supportedTypes.includes(img.mediaType) ? img.mediaType : 'image/jpeg' };
    }

    let data = String(img);
    let mediaType = 'image/jpeg';
    if (data.startsWith('data:')) {
      const match = data.match(/^data:([^;]+);base64,/);
      if (match) mediaType = match[1];
      data = data.split(',')[1];
    }
    const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!supportedTypes.includes(mediaType)) mediaType = 'image/jpeg';
    return { data, mediaType };
  }

  // Defensive fallback: if the model ever omits "dishes" (schema drift), synthesize one from foodItem/totalNutrition
  _ensureDishesArray(data) {
    if (!data) return data;
    if (Array.isArray(data.dishes) && data.dishes.length > 0) return data;
    data.dishes = data.foodItem ? [{
      name: data.foodItem.name || 'Food Item',
      quantity: data.foodItem.quantity || '1 serving',
      ingredients: [],
      nutrition: data.foodItem.nutrition || data.totalNutrition || {},
      healthScore: data.healthScore || 50
    }] : [];
    return data;
  }

  // `images` accepts a single base64/data-URI string (legacy) OR an array of those / {data, mediaType} objects (multi-photo)
  async analyzeFromImage(images, additionalContext = '', userId = null, medicalContext = '') {
    const imageList = (Array.isArray(images) ? images : [images]).filter(Boolean);
    const normalized = imageList.map((img) => this._normalizeImageInput(img));

    if (normalized.length === 0) {
      throw new Error('At least one image is required for image analysis');
    }

    console.log(`🖼️ [NutritionAI] Preparing ${normalized.length} image(s) for Gemini | Context:`, additionalContext.substring(0, 50));

    const prompt = this._getUnifiedPrompt(additionalContext, normalized.length, medicalContext);

    try {
      const data = await this._withRetry(async () => {
        const response = await openrouterAI.chatCompletion({
          model: openrouterAI.MODELS.GEMINI_FLASH,
          system: 'You are a professional nutritionist AI specialized in Indian and global cuisine. Analyze the food in the image(s). IMPORTANT: Always prioritize the quantity mentioned in the user text/context for all nutritional calculations. Return ONLY a JSON response.',
          messages: [{
            role: 'user',
            content: [
              openrouterAI.buildTextPart(prompt),
              ...normalized.map((n) => openrouterAI.buildImagePart(n.data, n.mediaType))
            ]
          }],
          maxTokens: Math.min(6000, 2500 + normalized.length * 1200),
          feature: 'nutrition_analysis',
          userId
        });
        return this._ensureDishesArray(openrouterAI.parseJsonResponse(response));
      });
      return { success: true, data };
    } catch (error) {
      console.error('❌ [NutritionAI] Image analysis failed:', error.message);
      throw error;
    }
  }

  async quickFoodCheck(foodDescription, additionalContext = '', userId = null, medicalContext = '') {
    const combined = additionalContext
      ? `Food: ${foodDescription}. Context: ${additionalContext}`
      : foodDescription;
    const prompt = this._getUnifiedPrompt(combined, 0, medicalContext);

    const data = await this._withRetry(async () => {
      const response = await openrouterAI.chatCompletion({
        model: openrouterAI.MODELS.GEMINI_FLASH,
        system: 'You are a professional nutritionist AI. Respond ONLY with valid JSON. Be extremely concise. CRITICAL: You must calculate nutrition based on the EXACT quantity provided in the context (e.g., if user says "3 eggs", calculate for 3, NOT 1).',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 2500,
        feature: 'nutrition_analysis',
        userId
      });
      return this._ensureDishesArray(openrouterAI.parseJsonResponse(response));
    });
    return { success: true, data };
  }

  // The user has already reviewed and edited the AI's dish/ingredient guess — this prompt
  // treats that edited list as ground truth and asks the model ONLY to compute nutrition,
  // never to re-identify or second-guess the dish/ingredient names or quantities.
  _getRecalculationPrompt(dishes, medicalContext = '') {
    const confirmedDishes = dishes.map((d) => ({
      name: d.name,
      quantity: d.quantity,
      ingredients: Array.isArray(d.ingredients) && d.ingredients.length > 0
        ? d.ingredients.map((i) => ({ name: i.name, quantity: i.quantity }))
        : undefined
    }));

    return `The user has EDITED and CONFIRMED the exact dishes, ingredients, and quantities for a meal they ate. This is ground truth from the user — you MUST NOT rename, add, remove, merge, or re-identify any dish or ingredient. Do not second-guess their input.

    CONFIRMED MEAL:
    ${JSON.stringify(confirmedDishes, null, 2)}${medicalContext}

    TASK: For each ingredient (or for the dish as a whole if it has no listed ingredients), calculate accurate nutrition using official databases (USDA, Indian Food Composition Tables (IFCT)) based purely on the given name and quantity.

    MACRO PRECISION (MANDATORY): 1g Protein = 4 kcal, 1g Carb = 4 kcal, 1g Fat = 9 kcal. (Protein*4 + Carbs*4 + Fats*9) MUST closely match the calories at ingredient, dish, and meal level.

    FIBER PRECISION (MANDATORY): Never default fiber to 0 unless the food genuinely contains none. Estimate fiber from real food-composition data with the same rigor as protein/carbs/fats.

    Return EXACTLY this JSON shape:
    {
      "dishes": [
        {
          "name": "(same name as given — do not change)",
          "quantity": "(same quantity as given — do not change)",
          "ingredients": [{ "name": "(same as given)", "quantity": "(same as given)", "nutrition": { "calories": 0, "protein": 0, "carbs": 0, "fats": 0, "fiber": 0, "sugar": 0, "sodium": 0 } }],
          "nutrition": { "calories": 0, "protein": 0, "carbs": 0, "fats": 0, "fiber": 0, "sugar": 0, "sodium": 0 },
          "healthScore": 0-100
        }
      ],
      "foodItem": { "name": "All dish names joined with ', '", "quantity": "Combined portion summary", "nutrition": { "calories": 0, "protein": 0, "carbs": 0, "fats": 0, "fiber": 0, "sugar": 0, "sodium": 0 } },
      "totalNutrition": { "calories": 0, "protein": 0, "carbs": 0, "fats": 0, "fiber": 0, "sugar": 0, "sodium": 0 },
      "healthScore": 0-100,
      "analysis": "Short 2-sentence summary of the full meal's health impact",
      "micronutrients": [{ "name": "Vitamin C", "amount": "12", "unit": "mg", "percentage": 13 }],
      "enhancementTips": [{ "name": "Tip Title", "benefit": "Explanation" }],
      "healthBenefitsSummary": "Positive impact summary for the whole meal",
      "warnings": ["Disadvantages if genuinely unhealthy for this meal specifically. Follow the MEDICAL WARNING RULES above strictly if a USER MEDICAL CONTEXT block is present — most meals should have zero or one medical warning, not a full checklist of every condition on file."],
      "alternatives": [{ "name": "Name", "description": "Why better", "nutrition": { "calories": 0, "protein": 0 } }]
    }

    CONSISTENCY RULES: "totalNutrition"/"foodItem.nutrition" MUST equal the SUM of all "dishes[].nutrition". Each "dishes[].nutrition" MUST equal the SUM of that dish's "ingredients[].nutrition". Top-level "healthScore" is the calorie-weighted average of all dishes' healthScore.`;
  }

  // Called on the second (log-meal) API call, only when the user actually edited the AI's first guess.
  async recalculateNutrition(dishes, userId = null, medicalContext = '') {
    if (!Array.isArray(dishes) || dishes.length === 0) {
      throw new Error('At least one dish is required for nutrition recalculation');
    }

    const prompt = this._getRecalculationPrompt(dishes, medicalContext);

    const data = await this._withRetry(async () => {
      const response = await openrouterAI.chatCompletion({
        model: openrouterAI.MODELS.GEMINI_FLASH,
        system: 'You are a professional nutritionist AI. The user has already confirmed the exact dishes/ingredients/quantities for their meal — treat that as ground truth and do not re-identify anything. Respond ONLY with valid JSON.',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: Math.min(6000, 2200 + dishes.length * 1200),
        feature: 'nutrition_analysis',
        userId
      });
      return this._ensureDishesArray(openrouterAI.parseJsonResponse(response));
    });
    return { success: true, data };
  }

  async getMealRecommendations(userGoal, todaySummary, deficiencies = []) {
    const prompt = `Provide 3-5 meal suggestions for: ${userGoal.goalType}. Today's calories: ${todaySummary.totalCalories}. JSON format only.`;
    const payload = {
      system: 'Professional nutritionist AI.',
      messages: [{ role: 'user', content: prompt }]
    };
    return this._parseResponse(await this.makeAIRequest(payload));
  }

  async analyzeGlucoseTrends(userProfile, glucoseReadings, foodLogs, hba1cReadings = [], alcoholSummary = null) {
    const alcoholNote = alcoholSummary
      ? `Alcohol tracker (last 7d): today ${alcoholSummary.today} drinks, avg ${alcoholSummary.avg7 ?? 'n/a'}, binge pattern: ${alcoholSummary.bingePattern ? 'yes' : 'no'}. Factor alcohol into hypoglycemia and variability risk.`
      : '';
    const prompt = `Analyze current glucose trends and food impact. 
    User Profile: ${JSON.stringify(userProfile)}
    Recent Glucose Readings: ${JSON.stringify(glucoseReadings)}
    Today's Food Logs: ${JSON.stringify(foodLogs)}
    Recent HbA1c: ${JSON.stringify(hba1cReadings)}
    ${alcoholNote}

    Return ONLY a JSON object with this exact structure:
    {
      "status": "Short status string (e.g. Critical Spike, Stable, Warning Trend)",
      "statusColor": "green (stable), yellow (warning), orange (high), or red (critical)",
      "analysis": "1 concise sentence explaining the current metabolic state.",
      "spikeCause": "Direct cause of recent spike (e.g., 'White rice at 1:30 PM')",
      "emergencySignal": "true/false (if level is dangerously high)",
      "immediateAction": "The single most important step to take RIGHT NOW.",
      "recommendations": [
        "Pointer 1: Why this happened (concise)",
        "Pointer 2: Immediate corrective action (concise)",
        "Pointer 3: Next meal adjustment (concise)",
        "Pointer 4: Lifestyle/Activity tip (concise)"
      ]
    }
    
    CRITICAL: Keep recommendations limited to exactly 3-4 high-impact pointers. Avoid long paragraphs. If data is insufficient, provide a placeholder analysis asking for more logs.`;
    
    const payload = {
      system: 'You are an expert Endocrinologist AI. Provide clinical-grade analysis of glucose data and its relationship with food logs. Return ONLY valid JSON.',
      messages: [{ role: 'user', content: prompt }]
    };
    return this._parseResponse(await this.makeAIRequest(payload));
  }

  _parseResponse(r) {
    if (!r) {
      console.error('❌ [NutritionAI] Empty response received');
      throw new Error('Empty AI response from server');
    }

    console.log('📥 [NutritionAI] Raw response length:', r.length);
    console.log('📥 [NutritionAI] First 200 chars:', r.substring(0, 200));

    // Extract JSON block
    const start = r.indexOf('{');
    const end = r.lastIndexOf('}');

    if (start === -1 || end === -1) {
      console.error('❌ [NutritionAI] No JSON markers found in response');
      console.error('❌ [NutritionAI] RAW RESPONSE:', r.substring(0, 500) + '...');
      throw new Error('AI failed to return structured data. Please try again with more details.');
    }

    const jsonStr = r.substring(start, end + 1);
    console.log('📥 [NutritionAI] Extracted JSON length:', jsonStr.length);
    
    try {
      const parsed = robustJsonParse(jsonStr);
      if (!parsed) {
        console.error('❌ [NutritionAI] JSON parser returned null/undefined');
        throw new Error('JSON parser returned empty result');
      }
      console.log('✅ [NutritionAI] Successfully parsed JSON');
      return { success: true, data: parsed };
    } catch (err) {
      console.error('❌ [NutritionAI] JSON Parse Failed');
      console.error('❌ [NutritionAI] Parse error:', err.message);
      console.error('❌ [NutritionAI] Problematic snippet:', jsonStr.substring(0, 200) + '...');
      console.error('❌ [NutritionAI] Tail snippet:', jsonStr.substring(Math.max(0, jsonStr.length - 200)));
      throw new Error(`Data processing error: ${err.message}`);
    }
  }
}

module.exports = new NutritionAI();
