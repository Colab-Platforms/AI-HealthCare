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

// Diabetic-Specific Macro Adjustments (Lower Carbs, Higher Protein/Fats)
const DIABETIC_MACRO_RATIOS = {
  weight_loss: { protein: 0.45, carbs: 0.25, fat: 0.30 },
  weight_gain: { protein: 0.35, carbs: 0.30, fat: 0.35 },
  muscle_gain: { protein: 0.45, carbs: 0.25, fat: 0.30 },
  maintain: { protein: 0.40, carbs: 0.25, fat: 0.35 },
  general_health: { protein: 0.40, carbs: 0.25, fat: 0.35 }
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

// Max safe weekly rate of weight change as a fraction of bodyweight — mirrors HealthGoal.js.
// weight_loss: ACSM/CDC safe-loss guideline (~1%/week). weight_gain: general bulk cap (~0.5%/week).
// muscle_gain: natural muscle-protein-synthesis ceiling (~0.25%/week) — surplus beyond what the
// body can actually build muscle with just becomes fat, regardless of how fast the user wants to go.
const MAX_WEEKLY_RATE_FRACTION = {
  weight_loss: 0.01,
  weight_gain: 0.005,
  muscle_gain: 0.0025,
};
const KCAL_PER_KG_FAT = 7700; // Wishnofsky rule — standard energy-density-of-fat approximation

/**
 * Calculate target calories based on goal
 * @param {number} tdee - Total Daily Energy Expenditure
 * @param {string} goal - Nutrition goal
 * @param {number} weeklyGoal - Requested kg/week rate of change (will be capped to a safe max)
 * @param {number} weight - Body weight in kg (for capping the rate and the safety floor)
 * @param {string} gender - 'male'/'female'/'other' (for the safety floor)
 * @param {number} bmr - Basal Metabolic Rate (for the safety floor)
 * @param {boolean} isDiabetic - Applies a gentler adjustment for glycemic safety margin
 * @returns {number} Target calories
 */
// Clamps a requested kg/week rate to a physiologically realistic max for the given goal + bodyweight,
// in the correct sign/direction. Shared by calculateTargetCalories and the estimatedWeeks calculation
// below so the "safe rate" and "realistic ETA" always agree with each other.
function getCappedWeeklyRate(goal, weeklyGoal, weight) {
  if (!['weight_loss', 'weight_gain', 'muscle_gain'].includes(goal)) return 0;
  const maxRate = (MAX_WEEKLY_RATE_FRACTION[goal] || 0.005) * weight;
  const requestedRate = Math.abs(weeklyGoal);
  return goal === 'weight_loss'
    ? -Math.min(requestedRate, maxRate)
    : Math.min(requestedRate, maxRate);
}

function calculateTargetCalories(tdee, goal, weeklyGoal = 0.5, weight = 70, gender = 'male', bmr = null, isDiabetic = false) {
  let adjustment = GOAL_ADJUSTMENTS[goal] || 0;

  if (goal === 'weight_loss' || goal === 'weight_gain' || goal === 'muscle_gain') {
    const cappedRate = getCappedWeeklyRate(goal, weeklyGoal, weight);
    // 1 kg fat = ~7700 calories, so for X kg/week we need (X * 7700) / 7 calories/day
    adjustment = (cappedRate * KCAL_PER_KG_FAT) / 7;
    if (isDiabetic) adjustment *= 0.8;
  }

  const targetCalories = tdee + adjustment;

  // Safety floor: never below 1200 (women) / 1500 (men), or below 1.1x BMR
  const safeMinimum = Math.max(gender === 'male' ? 1500 : 1200, bmr ? Math.round(bmr * 1.1) : 0);
  return Math.max(Math.round(targetCalories), safeMinimum);
}

/**
 * Calculate macro goals in grams
 * @param {number} calories - Target calories
 * @param {string} goal - Nutrition goal
 * @param {number} weight - Body weight in kg (for protein calculation)
 * @param {boolean} isDiabetic - Whether the user is diabetic
 * @returns {object} Macro goals {protein, carbs, fat}
 */
function calculateMacros(calories, goal, weight, isDiabetic = false) {
  // Use diabetic-specific ratios if user is diabetic
  const standardRatios = MACRO_RATIOS[goal] || MACRO_RATIOS.general_health;
  const diabeticRatios = DIABETIC_MACRO_RATIOS[goal] || DIABETIC_MACRO_RATIOS.general_health;
  
  const ratios = isDiabetic ? diabeticRatios : standardRatios;
  
  // PROTEIN CALCULATION: Weight-based is more accurate than % for very high/low calorie diets
  // Standard (1.2g/kg): Good balance for moderate activity and general health
  // Muscle Gain (1.8g/kg): For muscle growth support
  // Weight Loss (1.6g/kg): To preserve muscle during deficit
  // Diabetic (1.0g-1.2g/kg): Kidney-safe moderate intake
  
  let proteinPerKg;
  if (isDiabetic) {
    proteinPerKg = 1.2; // Optimized for diabetic kidney health
  } else if (goal === 'muscle_gain') {
    proteinPerKg = 1.8; // High protein for growth
  } else if (goal === 'weight_loss') {
    proteinPerKg = 1.6; // Preserving muscle during deficit
  } else {
    proteinPerKg = 1.2; // Base healthy active adult target (1.2g/kg)
  }
  
  let protein = Math.round(weight * proteinPerKg);
  
  // Safety cap for protein: Don't exceed 35% of total calories or 250g unless specifically for high performance
  const maxProteinByCalories = Math.round((calories * 0.35) / 4);
  protein = Math.min(protein, maxProteinByCalories, 220); 

  // CARB CALCULATION: 
  // Diabetic users should have capped carbs (usually 40-45% max or fixed limit)
  let carbsRatio = ratios.carbs;
  if (isDiabetic) {
    carbsRatio = Math.min(carbsRatio, 0.30); // Cap carbs at 30% for diabetics
  }

  // Calculate grams for Fat and then Carbs (the remainder)
  // Fat: 9 cal/g, Carbs: 4 cal/g
  let fatCalories = calories * ratios.fat;
  let fat = Math.round(fatCalories / 9);
  
  // Carbs are the remainder: Total Calories - (Protein*4 + Fat*9)
  let remainingCalories = calories - (protein * 4) - (fat * 9);
  let carbs = Math.round(remainingCalories / 4);

  // If carbs are too low (<100g), adjust fat down to allow more carbs
  if (carbs < 100 && !isDiabetic) {
      carbs = 100;
      remainingCalories = calories - (protein * 4) - (carbs * 4);
      fat = Math.round(remainingCalories / 9);
  } else if (carbs < 60 && isDiabetic) {
      carbs = 70; // Hard floor for diabetic carbs to prevent keto flu unless intended
      remainingCalories = calories - (protein * 4) - (carbs * 4);
      fat = Math.round(remainingCalories / 9);
  }

  return { protein, carbs, fat };
}

/**
 * Main function to calculate complete nutrition goals
 * @param {object} userProfile - User profile data (including isDiabetic)
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
    weeklyGoal = 0.5,
    isDiabetic = false
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
  const calorieGoal = calculateTargetCalories(tdee, goal, weeklyGoal, weight, gender, bmr, isDiabetic);

  // Calculate macros
  const macros = calculateMacros(calorieGoal, goal, weight, isDiabetic);

  // Calculate estimated time to goal (if applicable) — uses the SAME capped rate as the calorie
  // calculation above, so this reflects the realistic ETA, not the (possibly unsafe) rate requested.
  let estimatedWeeks = null;
  if (targetWeight && (goal === 'weight_loss' || goal === 'weight_gain' || goal === 'muscle_gain')) {
    const weightDifference = Math.abs(targetWeight - weight);
    const cappedRate = Math.abs(getCappedWeeklyRate(goal, weeklyGoal, weight));
    estimatedWeeks = cappedRate > 0 ? Math.ceil(weightDifference / cappedRate) : null;
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
  calculateTDEE,
  calculateTargetCalories,
  getCappedWeeklyRate
};
