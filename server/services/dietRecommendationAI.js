const axios = require('axios');

class DietRecommendationAI {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
  }

  /**
   * Generate personalized Indian diet recommendations based on comprehensive health data
   */
  async generatePersonalizedDietPlan(userData) {
    const {
      labReports = [],
      healthParameters = {},
      fitnessGoals = [],
      activityLevel = 'moderate',
      age,
      gender,
      weight,
      height,
      dietaryPreference = 'non-vegetarian',
      medicalConditions = [],
      allergies = []
    } = userData;

    const prompt = `You are an expert Indian nutritionist and dietitian. Generate a comprehensive, personalized Indian diet plan based on the following health data:

**Patient Profile:**
- Age: ${age} years
- Gender: ${gender}
- Weight: ${weight} kg
- Height: ${height} cm
- Dietary Preference: ${dietaryPreference}
- Activity Level: ${activityLevel}
${medicalConditions.length > 0 ? `- Medical Conditions: ${medicalConditions.join(', ')}` : ''}
${allergies.length > 0 ? `- Allergies: ${allergies.join(', ')}` : ''}

**Lab Report Insights:**
${labReports.length > 0 ? labReports.map(report => `- ${report.parameter}: ${report.value} ${report.unit} (${report.status})`).join('\n') : 'No lab reports available'}

**Health Parameters:**
${Object.keys(healthParameters).length > 0 ? Object.entries(healthParameters).map(([key, value]) => `- ${key}: ${value}`).join('\n') : 'No specific parameters provided'}

**Fitness Goals:**
${fitnessGoals.length > 0 ? fitnessGoals.join(', ') : 'General health maintenance'}

**Requirements:**
1. Provide ONLY Indian foods, dishes, and ingredients
2. Use Indian meal terminology (breakfast/nashta, lunch/dopahar ka khana, dinner/raat ka khana, snacks)
3. Filter all recommendations based on dietary preference: ${dietaryPreference}
4. Focus on correcting nutritional deficiencies identified in lab reports
5. Support the stated fitness goals
6. Consider activity level for calorie recommendations
7. Provide practical, home-cooked Indian meal suggestions
8. Include regional variety (North Indian, South Indian, etc.)

**Response Format (JSON):**
{
  "dailyCalorieTarget": <number>,
  "macroTargets": {
    "protein": <grams>,
    "carbs": <grams>,
    "fats": <grams>
  },
  "mealPlan": {
    "breakfast": [
      {
        "name": "<Indian dish name>",
        "description": "<brief description>",
        "calories": <number>,
        "protein": <grams>,
        "benefits": "<why this helps>"
      }
    ],
    "midMorningSnack": [...],
    "lunch": [...],
    "eveningSnack": [...],
    "dinner": [...]
  },
  "keyFoods": [
    {
      "name": "<Indian food item>",
      "reason": "<why recommended>",
      "frequency": "<how often to consume>"
    }
  ],
  "deficiencyCorrections": [
    {
      "deficiency": "<nutrient name>",
      "indianFoods": ["<food1>", "<food2>"],
      "mealSuggestions": ["<specific Indian dish>"]
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
  ]
}

Provide ONLY the JSON response, no additional text.`;

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: 'openai/gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are an expert Indian nutritionist specializing in personalized diet plans based on lab reports and health data. Always provide Indian food recommendations only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 3000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.APP_URL || 'http://localhost:5000',
            'X-Title': 'HealthAI Platform'
          }
        }
      );

      const content = response.data.choices[0].message.content.trim();
      
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
      "indianBrands": ["<available brands in India>"]
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
          model: 'openai/gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are an expert healthcare advisor specializing in nutritional supplementation for Indian patients.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.APP_URL || 'http://localhost:5000',
            'X-Title': 'HealthAI Platform'
          }
        }
      );

      const content = response.data.choices[0].message.content.trim();
      
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
