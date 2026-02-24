const axios = require('axios');

class DietRecommendationAI {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    this.apiUrl = 'https://api.anthropic.com/v1/messages';
    this.model = 'claude-3-5-sonnet-20240620';
  }

  /**
   * Generate personalized Indian diet recommendations based on comprehensive health data
   * ENSURES MEALS EXACTLY MEET DAILY CALORIE AND MACRO TARGETS WITH EASY INDIAN DISHES
   */
  async generatePersonalizedDietPlan(userData) {
    const {
      labReports = [],
      healthParameters = {},
      fitnessGoals = [],
      primaryFitnessGoal = '',
      activityLevel = 'moderate',
      age,
      gender,
      weight,
      height,
      currentBMI,
      bmiGoal = 'maintain',
      targetWeight,
      dietaryPreference = 'non-vegetarian',
      medicalConditions = [],
      allergies = [],
      currentMedications = [],
      reportConditions = [],
      deficiencies = [],
      hasReports = false,
      nutritionGoals = {},
      diabetesInfo = null   // NEW: full diabetes context
    } = userData;

    const dailyCalories = nutritionGoals.dailyCalories || 2000;
    const proteinGoal = nutritionGoals.protein || 150;
    const carbsGoal = nutritionGoals.carbs || 200;
    const fatGoal = nutritionGoals.fat || 65;

    // Build BMI goal description
    let bmiGoalDescription = '';
    if (bmiGoal === 'weight_loss') {
      bmiGoalDescription = `WEIGHT LOSS GOAL: User wants to lose weight from ${weight}kg to ${targetWeight || 'target'}kg. Focus on calorie deficit, high protein, moderate carbs.`;
    } else if (bmiGoal === 'weight_gain') {
      bmiGoalDescription = `WEIGHT GAIN GOAL: User wants to gain weight from ${weight}kg to ${targetWeight || 'target'}kg. Focus on calorie surplus, high protein, high carbs.`;
    } else {
      bmiGoalDescription = `MAINTAIN WEIGHT: User wants to maintain current weight of ${weight}kg. Focus on balanced nutrition.`;
    }

    // Build report conditions description (only if reports exist)
    let reportConditionsDescription = '';
    let deficienciesDescription = '';

    if (hasReports) {
      if (reportConditions.length > 0) {
        reportConditionsDescription = `\n**CRITICAL: Health Report Conditions (MUST ADDRESS IN DIET):**\n${reportConditions.map(c =>
          c.finding ? `- ${c.finding}` : `- ${c.parameter}: ${c.value} (${c.status})`
        ).join('\n')}`;
      }

      if (deficiencies.length > 0) {
        deficienciesDescription = `\n**CRITICAL: Nutrient Deficiencies (MUST ADDRESS IN DIET):**\n${deficiencies.map(d =>
          `- ${d.nutrient} (${d.severity})`
        ).join('\n')}`;
      }
    }

    // Build scenario-specific instructions
    const scenarioInstructions = hasReports
      ? `
**SCENARIO: User HAS uploaded health reports**
Your diet plan MUST address:
1. User's BMI goal (${bmiGoal})
2. Health report conditions (abnormal values)
3. Nutrient deficiencies detected in reports
4. Daily nutrition targets

PRIORITY ORDER:
1. Fix deficiencies and abnormal conditions (HIGHEST PRIORITY)
2. Meet daily nutrition targets
3. Support BMI goal achievement
4. Use Indian foods that address all above

Example: If user has Vitamin D deficiency + wants weight loss:
- Include Vitamin D rich foods (mushrooms, fortified milk, eggs)
- Keep calories in deficit for weight loss
- Ensure protein is high to preserve muscle
- Suggest practical Indian meals
`
      : `
**SCENARIO: User has NOT uploaded any health reports**
Your diet plan MUST focus ONLY on:
1. User's BMI goal (${bmiGoal})
2. Meeting daily nutrition targets EXACTLY
3. Practical Indian meals

PRIORITY ORDER:
1. Meet daily nutrition targets (calories, protein, carbs, fat)
2. Support BMI goal achievement
3. Use easy, practical Indian foods
4. Ensure meals are balanced and sustainable

Example: If user wants weight loss:
- Create calorie deficit diet
- High protein to preserve muscle
- Moderate carbs for energy
- Healthy fats for satiety
- All using common Indian foods
`;

    const prompt = `You are an expert Indian nutritionist specializing in creating practical, easy-to-prepare Indian diet plans. Your task is to generate a PRECISE diet plan where meals EXACTLY meet the user's daily nutrition targets.

CRITICAL REQUIREMENTS - MUST FOLLOW STRICTLY:
1. ALL meals combined MUST total EXACTLY ${dailyCalories} calories (tolerance: ±50 cal)
2. ALL meals combined MUST total EXACTLY ${proteinGoal}g protein (tolerance: ±5g)
3. ALL meals combined MUST total EXACTLY ${carbsGoal}g carbs (tolerance: ±10g)
4. ALL meals combined MUST total EXACTLY ${fatGoal}g fat (tolerance: ±3g)
5. Use ONLY easy, practical Indian dishes that are commonly eaten in Indian households
6. Include EXACT portion sizes in grams/ml for every ingredient
7. Suggest common Indian ingredients and traditional cooking methods
8. Make meals achievable for busy Indian families (preparation time < 30 mins)
9. Provide cooking instructions for each meal
10. Include difficulty level (Easy/Medium) for each meal

${scenarioInstructions}

**BMI GOAL (CRITICAL - MUST ALIGN DIET WITH THIS):**
${bmiGoalDescription}
- Current BMI: ${currentBMI}
${reportConditionsDescription}
${deficienciesDescription}
${diabetesInfo ? `
**🚨 DIABETES / PREDIABETES - STRICT DIETARY RULES (HIGHEST PRIORITY):**
This user ${diabetesInfo.isPrediabetic && !diabetesInfo.isDiabetic ? 'is PREDIABETIC' : `has ${diabetesInfo.diabetesType || 'Type 2'} Diabetes (${diabetesInfo.diabetesStatus || 'detected'})`}.
${diabetesInfo.hba1c ? `HbA1c: ${diabetesInfo.hba1c}%` : ''}
${diabetesInfo.fastingGlucose ? `Fasting Glucose: ${diabetesInfo.fastingGlucose}` : ''}
${diabetesInfo.onMedication ? `On medication: ${(diabetesInfo.medicationType || []).join(', ') || 'yes'}` : ''}

MANDATORY RULES FOR DIABETIC DIET:
1. ALL carbohydrates MUST be LOW GLYCEMIC INDEX (GI < 55) - NO high GI foods
2. STRICTLY AVOID: White rice, white bread, maida, refined flour, sugar, sweets, mithai, fruit juices, potato (fried)
3. REPLACE with: Brown rice (small portion), jowar/bajra/ragi roti, whole wheat chapati, oats, barley
4. Space ALL meals 3-4 hours apart to avoid glucose spikes
5. EVERY meal MUST include fiber-rich vegetables (karela, methi, palak, lauki)
6. Protein at EVERY meal to slow glucose absorption
7. Max carbs per meal: 30-45g (strictly)
8. Include diabetes-friendly Indian foods: bitter gourd (karela), fenugreek (methi), jamun, amla
9. NO fruit juices - only whole fruits with low GI (guava, apple, pear - max 1 serving/day)
10. Cook with minimal oil (use olive oil or mustard oil in small quantity)
11. Include cinnamon (dalchini) in diet - natural blood sugar regulator
12. Suggest post-meal 10-minute walk as lifestyle tip
` : ''}
${primaryFitnessGoal ? `
**FITNESS GOAL:** User's primary fitness goal is: "${primaryFitnessGoal}". Align meal plan to support this goal.` : ''}

MEAL SELECTION GUIDELINES:
- Breakfast: Traditional Indian options (Idli, Dosa, Upma, Poha, Oats${diabetesInfo ? ', Moong chilla, Besan cheela' : ', Paratha, Eggs'})
- Mid-Morning Snack: Light options (${diabetesInfo ? 'Nuts, Buttermilk, Sprouted chana, Cucumber' : 'Fruit, Yogurt, Nuts, Chana'})
- Lunch: Main meal with protein + veggies + controlled carbs (${diabetesInfo ? 'Dal + Jowar roti + Sabzi (no white rice)' : 'Curry + Rice/Roti, Dal + Rice'})
- Evening Snack: Light options (${diabetesInfo ? 'Roasted makhana, Buttermilk, 4-5 almonds' : 'Tea with snack, Fruit, Nuts'})
- Dinner: Lighter than lunch (${diabetesInfo ? 'Soup + Salad + 1 roti + light dal' : 'Soup, Salad, Light curry with Roti'})

PORTION SIZE EXAMPLES:
- Brown Rice: 100g cooked = ~130 cal, 3g protein, 28g carbs (GI=50)
- Jowar Roti: 1 piece (35g) = ~90 cal, 3g protein, 18g carbs (GI=43)
- Whole Wheat Roti: 1 piece (30g) = ~80 cal, 2.5g protein, 15g carbs
- Dal: 150ml cooked = ~100 cal, 8g protein, 15g carbs
- Chicken: 100g = ~165 cal, 31g protein, 0g carbs
- Paneer: 100g = ~265 cal, 18g protein, 6g carbs, 20g fat
- Vegetables: 100g = ~25-50 cal, 1-2g protein, 5-10g carbs

Generate a comprehensive, personalized Indian diet plan based on the following health data:

**Patient Profile:**
- Age: ${age} years
- Gender: ${gender}
- Weight: ${weight} kg
- Height: ${height} cm
- Current BMI: ${currentBMI}
- BMI Goal: ${bmiGoal}
${targetWeight ? `- Target Weight: ${targetWeight} kg` : ''}
- Dietary Preference: ${dietaryPreference}
- Activity Level: ${activityLevel}
${primaryFitnessGoal ? `- Primary Fitness Goal: ${primaryFitnessGoal}` : ''}
${medicalConditions.length > 0 ? `- Medical Conditions: ${medicalConditions.join(', ')}` : ''}
${allergies.length > 0 ? `- Allergies: ${allergies.join(', ')}` : ''}
${currentMedications.length > 0 ? `- Current Medications: ${currentMedications.join(', ')}` : ''}
${diabetesInfo ? `- Diabetes Status: ${diabetesInfo.diabetesType} (${diabetesInfo.diabetesStatus}) - APPLY STRICT DIABETIC DIET RULES` : ''}
- Has Health Reports: ${hasReports ? 'YES' : 'NO'}

**DAILY NUTRITION TARGETS (MUST BE MET BY SUGGESTED MEALS):**
- Daily Calories: ${dailyCalories} kcal (±50 cal)
- Protein: ${proteinGoal}g (±5g)
- Carbohydrates: ${carbsGoal}g (±10g)
- Fats: ${fatGoal}g (±3g)

${hasReports && labReports.length > 0 ? `**Lab Report Insights:**\n${labReports.map(report => `- ${report.parameter}: ${report.value} ${report.unit} (${report.status})`).join('\n')}` : ''}

**Health Parameters:**
${Object.keys(healthParameters).length > 0 ? Object.entries(healthParameters).map(([key, value]) => `- ${key}: ${value}`).join('\n') : 'No specific parameters provided'}

**Fitness Goals:**
${fitnessGoals.length > 0 ? fitnessGoals.join(', ') : 'General health maintenance'}

**Response Format (JSON):**
{
  "dailyCalorieTarget": ${dailyCalories},
  "macroTargets": {
    "protein": ${proteinGoal},
    "carbs": ${carbsGoal},
    "fat": ${fatGoal}
  },
  "mealPlan": {
    "breakfast": {
      "name": "<Indian dish name>",
      "description": "<brief description>",
      "calories": <number>,
      "protein": <grams>,
      "carbs": <grams>,
      "fat": <grams>,
      "portionSize": "<exact portion in grams/ml>",
      "ingredients": [
        {
          "item": "<ingredient name>",
          "quantity": "<amount in grams/ml>",
          "calories": <number>,
          "protein": <grams>,
          "carbs": <grams>,
          "fat": <grams>
        }
      ],
      "cookingMethod": "<how to prepare>",
      "cookingTime": "<minutes>",
      "difficulty": "Easy|Medium",
      "benefits": "<why this helps>"
    },
    "midMorningSnack": {
      "name": "<Indian snack>",
      "description": "<brief description>",
      "calories": <number>,
      "protein": <grams>,
      "carbs": <grams>,
      "fat": <grams>,
      "portionSize": "<exact portion in grams/ml>",
      "ingredients": [
        {
          "item": "<ingredient name>",
          "quantity": "<amount in grams/ml>",
          "calories": <number>,
          "protein": <grams>,
          "carbs": <grams>,
          "fat": <grams>
        }
      ],
      "cookingMethod": "<how to prepare>",
      "cookingTime": "<minutes>",
      "difficulty": "Easy|Medium",
      "benefits": "<why this helps>"
    },
    "lunch": {
      "name": "<Indian dish name>",
      "description": "<brief description>",
      "calories": <number>,
      "protein": <grams>,
      "carbs": <grams>,
      "fat": <grams>,
      "portionSize": "<exact portion in grams/ml>",
      "ingredients": [
        {
          "item": "<ingredient name>",
          "quantity": "<amount in grams/ml>",
          "calories": <number>,
          "protein": <grams>,
          "carbs": <grams>,
          "fat": <grams>
        }
      ],
      "cookingMethod": "<how to prepare>",
      "cookingTime": "<minutes>",
      "difficulty": "Easy|Medium",
      "benefits": "<why this helps>"
    },
    "eveningSnack": {
      "name": "<Indian snack>",
      "description": "<brief description>",
      "calories": <number>,
      "protein": <grams>,
      "carbs": <grams>,
      "fat": <grams>,
      "portionSize": "<exact portion in grams/ml>",
      "ingredients": [
        {
          "item": "<ingredient name>",
          "quantity": "<amount in grams/ml>",
          "calories": <number>,
          "protein": <grams>,
          "carbs": <grams>,
          "fat": <grams>
        }
      ],
      "cookingMethod": "<how to prepare>",
      "cookingTime": "<minutes>",
      "difficulty": "Easy|Medium",
      "benefits": "<why this helps>"
    },
    "dinner": {
      "name": "<Indian dish name>",
      "description": "<brief description>",
      "calories": <number>,
      "protein": <grams>,
      "carbs": <grams>,
      "fat": <grams>,
      "portionSize": "<exact portion in grams/ml>",
      "ingredients": [
        {
          "item": "<ingredient name>",
          "quantity": "<amount in grams/ml>",
          "calories": <number>,
          "protein": <grams>,
          "carbs": <grams>,
          "fat": <grams>
        }
      ],
      "cookingMethod": "<how to prepare>",
      "cookingTime": "<minutes>",
      "difficulty": "Easy|Medium",
      "benefits": "<why this helps>"
    }
  },
  "dailyMacroSummary": {
    "totalCalories": <sum of all meals - MUST be ${dailyCalories} ±50>,
    "totalProtein": <sum of all protein - MUST be ${proteinGoal}g ±5g>,
    "totalCarbs": <sum of all carbs - MUST be ${carbsGoal}g ±10g>,
    "totalFat": <sum of all fats - MUST be ${fatGoal}g ±3g>,
    "calorieAccuracy": "<percentage match to target>",
    "proteinAccuracy": "<percentage match to target>",
    "carbsAccuracy": "<percentage match to target>",
    "fatAccuracy": "<percentage match to target>",
    "note": "All values MUST match the daily targets within specified tolerances"
  },
  "keyFoods": [
    {
      "name": "<Indian food item>",
      "reason": "<why recommended>",
      "frequency": "<how often to consume>",
      "servingSize": "<portion in grams/ml>"
    }
  ],
  "deficiencyCorrections": [
    {
      "deficiency": "<nutrient name>",
      "indianFoods": ["<food1>", "<food2>"],
      "mealSuggestions": ["<specific Indian dish>"],
      "servingSize": "<portion in grams/ml>"
    }
  ],
  "lifestyleRecommendations": [
    "<practical Indian lifestyle tip>"
  ],
  "avoidFoods": [
    {
      "food": "<food to avoid>",
      "reason": "<why to avoid>"
    }
  ],
  "trackingTips": [
    "Measure portions using a kitchen scale for accuracy",
    "Track your meals daily to ensure you meet targets",
    "Adjust portion sizes if consistently over or under targets",
    "Drink 8-10 glasses of water daily",
    "Prepare meals in advance for busy days"
  ],
  "shoppingList": [
    {
      "category": "<category name>",
      "items": [
        {
          "item": "<ingredient>",
          "quantity": "<amount needed for week>",
          "unit": "kg|liters|pieces"
        }
      ]
    }
  ]
}

IMPORTANT: Provide ONLY the JSON response, no additional text. Ensure all calorie and macro calculations are accurate and sum to the daily targets.`;

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          max_tokens: 4000,
          system: 'You are an expert Indian nutritionist specializing in personalized diet plans based on lab reports and health data. Always provide Indian food recommendations only. CRITICAL: Ensure all meal suggestions add up to meet the user\'s daily calorie and macro targets. Include detailed calorie and macro information for each meal.',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      const content = response.data.content[0].text.trim();

      // Extract JSON from response
      let jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      const dietPlan = JSON.parse(jsonMatch[0]);
      return dietPlan;

    } catch (error) {
      console.error('Diet recommendation AI error:', error.response?.data || error.message);
      throw new Error('Failed to generate personalized diet plan');
    }
  }

  /**
   * Generate supplement recommendations based on deficiencies
   */
  async generateSupplementRecommendations(userData) {
    const {
      deficiencies = [],
      age,
      gender,
      dietaryPreference,
      medicalConditions = [],
      currentMedications = []
    } = userData;

    if (deficiencies.length === 0) {
      return { supplements: [], note: 'No deficiencies detected' };
    }

    const prompt = `You are an expert Indian healthcare advisor. Recommend appropriate supplements for the following profile:

**Patient Profile:**
- Age: ${age} years
- Gender: ${gender}
- Dietary Preference: ${dietaryPreference}
${medicalConditions.length > 0 ? `- Medical Conditions: ${medicalConditions.join(', ')}` : ''}
${currentMedications.length > 0 ? `- Current Medications: ${currentMedications.join(', ')}` : ''}

**Identified Deficiencies:**
${deficiencies.map(d => `- ${d.nutrient || d}: ${d.severity || 'detected'}`).join('\n')}

**Requirements:**
1. Recommend supplements available in India
2. Provide dosage guidance (general, not prescription)
3. Explain WHY each supplement is needed
4. Mention best time to take
5. Note any precautions or interactions
6. Prioritize food sources over supplements when possible
7. Use Indian brand examples where relevant

**Response Format (JSON):**
{
  "supplements": [
    {
      "name": "<supplement name>",
      "deficiency": "<which deficiency it addresses>",
      "dosage": "<general dosage guidance>",
      "timing": "<when to take>",
      "reason": "<why needed based on lab reports>",
      "foodAlternatives": ["<Indian food sources>"],
      "precautions": "<any warnings>",
      "indianBrands": ["<available brands in India>"],
      "priority": "high|medium|low"
    }
  ],
  "generalGuidance": [
    "<important tips about supplementation>"
  ],
  "consultationNote": "<reminder to consult doctor>"
}

Provide ONLY the JSON response, no additional text.`;

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          max_tokens: 2000,
          system: 'You are an expert healthcare advisor specializing in nutritional supplementation for Indian patients.',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const content = response.data.content[0].text.trim();

      // Extract JSON from response
      let jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      const recommendations = JSON.parse(jsonMatch[0]);
      return recommendations;

    } catch (error) {
      console.error('Supplement recommendation AI error:', error.response?.data || error.message);
      throw new Error('Failed to generate supplement recommendations');
    }
  }
}

module.exports = new DietRecommendationAI();
