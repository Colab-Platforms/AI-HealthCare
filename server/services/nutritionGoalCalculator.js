/**
 * Nutrition Goal Calculator
 * Calculates personalized calorie and macro goals based on user profile and goals
 */

// Activity level multipliers for TDEE calculation
const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,           // Little or no exercise
  lightly_active: 1.375,    // Light exercise 1-3 days/week
  moderately_active: 1.55,  // Moderate exercise 3-5 days/week
  very_active: 1.725,       // Hard exercise 6-7 days/week
  extremely_active: 1.9     // Very hard exercise & physical job
};

// Goal-based calorie adjustments
const GOAL_ADJUSTMENTS = {
  weight_loss: -500,        // 500 cal deficit for ~0.5kg/week loss
  weight_gain: 500,         // 500 cal surplus for ~0.5kg/week gain
  muscle_gain: 250,         // 250 cal surplus for lean muscle gain (not bulking)
  maintain: 0,              // Maintenance calories
  general_health: 0         // Maintenance calories
};

// Macro ratios by goal (protein, carbs, fat as % of calories)
const MACRO_RATIOS = {
  weight_loss: { protein: 0.35, carbs: 0.35, fat: 0.30 },
  weight_gain: { protein: 0.25, carbs: 0.45, fat: 0.30 },
  muscle_gain: { protein: 0.40, carbs: 0.35, fat: 0.25 }, // Higher protein for lean muscle
  maintain: { protein: 0.30, carbs: 0.40, fat: 0.30 },
  general_health: { protein: 0.30, carbs: 0.40, fat: 0.30 }
};

/**
 * Calculate Basal Metabolic Rate (BMR) using Mifflin-St Jeor Equation
 * @param {number} weight - Weight in kg
 * @param {number} height - Height in cm
 * @param {number} age - Age in years
 * @param {string} gender - 'male' or 'female'
 * @returns {number} BMR in calories
 */
function calculateBMR(weight, height, age, gender) {
  // Mifflin-St Jeor Equation
  // Men: BMR = 10W + 6.25H - 5A + 5
  // Women: BMR = 10W + 6.25H - 5A - 161
  
  const baseBMR = (10 * weight) + (6.25 * height) - (5 * age);
  
  if (gender === 'male') {
    return baseBMR + 5;
  } else if (gender === 'female') {
    return baseBMR - 161;
  } else {
    // For 'other', use average
    return baseBMR - 78;
  }
}

/**
 * Calculate Total Daily Energy Expenditure (TDEE)
 * @param {number} bmr - Basal Metabolic Rate
 * @param {string} activityLevel - Activity level
 * @returns {number} TDEE in calories
 */
function calculateTDEE(bmr, activityLevel) {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.sedentary;
  return Math.round(bmr * multiplier);
}

/**
 * Calculate target calories based on goal
 * @param {number} tdee - Total Daily Energy Expenditure
 * @param {string} goal - Nutrition goal
 * @param {number} weeklyGoal - Target kg per week (optional)
 * @returns {number} Target calories
 */
function calculateTargetCalories(tdee, goal, weeklyGoal = 0.5) {
  let adjustment = GOAL_ADJUSTMENTS[goal] || 0;
  
  // Adjust based on weekly goal if provided
  if (goal === 'weight_loss' || goal === 'weight_gain') {
    // 1 kg fat = ~7700 calories
    // So for X kg/week, need (X * 7700) / 7 calories per day
    const caloriesPerDay = (weeklyGoal * 7700) / 7;
    adjustment = goal === 'weight_loss' ? -caloriesPerDay : caloriesPerDay;
  }
  
  const targetCalories = tdee + adjustment;
  
  // Safety limits: don't go below 1200 for women, 1500 for men
  return Math.max(Math.round(targetCalories), 1200);
}

/**
 * Calculate macro goals in grams
 * @param {number} calories - Target calories
 * @param {string} goal - Nutrition goal
 * @param {number} weight - Body weight in kg (for protein calculation)
 * @returns {object} Macro goals {protein, carbs, fat}
 */
function calculateMacros(calories, goal, weight) {
  const ratios = MACRO_RATIOS[goal] || MACRO_RATIOS.general_health;
  
  // Calculate grams for each macro
  // Protein: 4 cal/g, Carbs: 4 cal/g, Fat: 9 cal/g
  const proteinCalories = calories * ratios.protein;
  const carbsCalories = calories * ratios.carbs;
  const fatCalories = calories * ratios.fat;
  
  let protein = Math.round(proteinCalories / 4);
  const carbs = Math.round(carbsCalories / 4);
  const fat = Math.round(fatCalories / 9);
  
  // Ensure minimum protein intake (1.6-2.2g per kg body weight for muscle gain/maintenance)
  if (goal === 'muscle_gain' || goal === 'weight_loss') {
    const minProtein = Math.round(weight * 1.8);
    protein = Math.max(protein, minProtein);
  }
  
  return { protein, carbs, fat };
}

/**
 * Main function to calculate complete nutrition goals
 * @param {object} userProfile - User profile data
 * @returns {object} Complete nutrition goals
 */
function calculateNutritionGoals(userProfile) {
  const {
    age,
    gender,
    weight,
    height,
    activityLevel = 'sedentary',
    goal = 'general_health',
    targetWeight,
    weeklyGoal = 0.5
  } = userProfile;
  
  // Validate required fields
  if (!age || !gender || !weight || !height) {
    throw new Error('Missing required profile data: age, gender, weight, height');
  }
  
  // Calculate BMR
  const bmr = calculateBMR(weight, height, age, gender);
  
  // Calculate TDEE
  const tdee = calculateTDEE(bmr, activityLevel);
  
  // Calculate target calories
  const calorieGoal = calculateTargetCalories(tdee, goal, weeklyGoal);
  
  // Calculate macros
  const macros = calculateMacros(calorieGoal, goal, weight);
  
  // Calculate estimated time to goal (if applicable)
  let estimatedWeeks = null;
  if (targetWeight && (goal === 'weight_loss' || goal === 'weight_gain')) {
    const weightDifference = Math.abs(targetWeight - weight);
    estimatedWeeks = Math.ceil(weightDifference / weeklyGoal);
  }
  
  return {
    bmr: Math.round(bmr),
    tdee,
    calorieGoal,
    proteinGoal: macros.protein,
    carbsGoal: macros.carbs,
    fatGoal: macros.fat,
    estimatedWeeks,
    lastUpdated: new Date()
  };
}

/**
 * Get personalized diet recommendations based on goal
 * @param {string} goal - Nutrition goal
 * @param {string} dietaryPreference - Dietary preference
 * @returns {object} Diet recommendations
 */
function getDietRecommendations(goal, dietaryPreference) {
  const recommendations = {
    weight_loss: {
      tips: [
        'Focus on high-protein, high-fiber foods to stay full longer',
        'Drink plenty of water before meals',
        'Eat slowly and mindfully',
        'Avoid sugary drinks and processed foods',
        'Include vegetables in every meal'
      ],
      mealTiming: 'Consider intermittent fasting or eating within an 8-10 hour window',
      priority: 'Calorie deficit while maintaining protein intake'
    },
    weight_gain: {
      tips: [
        'Eat more frequently - 5-6 meals per day',
        'Include calorie-dense foods like nuts, avocados, and healthy oils',
        'Drink smoothies and shakes between meals',
        'Don\'t skip meals',
        'Add healthy snacks throughout the day'
      ],
      mealTiming: 'Eat every 2-3 hours to maintain calorie surplus',
      priority: 'Calorie surplus with balanced macros'
    },
    muscle_gain: {
      tips: [
        'Prioritize protein: 2.0-2.2g per kg body weight for lean muscle',
        'Time protein intake around workouts (pre and post)',
        'Include complex carbs for sustained energy and recovery',
        'Focus on progressive overload in training',
        'Get 7-9 hours of quality sleep for muscle recovery',
        'Stay hydrated - drink 3-4 liters of water daily'
      ],
      mealTiming: 'Eat protein-rich meal within 2 hours post-workout. Spread protein intake across 4-5 meals.',
      priority: 'High protein (40% of calories) with controlled calorie surplus for LEAN muscle gain, not bulking'
    },
    maintain: {
      tips: [
        'Maintain balanced meals with all macros',
        'Listen to your hunger cues',
        'Stay active and exercise regularly',
        'Eat a variety of colorful vegetables',
        'Limit processed foods'
      ],
      mealTiming: 'Eat regular meals at consistent times',
      priority: 'Balanced nutrition at maintenance calories'
    },
    general_health: {
      tips: [
        'Eat a rainbow of fruits and vegetables',
        'Choose whole grains over refined',
        'Include healthy fats from nuts, seeds, and fish',
        'Limit added sugars and sodium',
        'Stay hydrated with 8-10 glasses of water daily'
      ],
      mealTiming: 'Eat 3 balanced meals with 1-2 healthy snacks',
      priority: 'Overall health and disease prevention'
    }
  };
  
  return recommendations[goal] || recommendations.general_health;
}

module.exports = {
  calculateNutritionGoals,
  getDietRecommendations,
  calculateBMR,
  calculateTDEE
};
