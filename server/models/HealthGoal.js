const mongoose = require('mongoose');

const healthGoalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  goalType: {
    type: String,
    enum: ['weight_loss', 'weight_gain', 'muscle_gain', 'maintain', 'maintenance', 'health_improvement', 'general_health'],
    required: true
  },
  currentWeight: {
    type: Number,
    required: true,
    min: [30, 'Weight must be at least 30kg'],
    max: [300, 'Weight must be less than 300kg']
  },
  targetWeight: {
    type: Number,
    required: true,
    min: [30, 'Target weight must be at least 30kg'],
    max: [300, 'Weight must be less than 300kg']
  },
  height: {
    type: Number, // in cm
    required: true,
    min: [100, 'Height must be at least 100cm'],
    max: [250, 'Height must be less than 250cm']
  },
  age: {
    type: Number,
    required: true,
    min: [1, 'Age must be at least 1'],
    max: [120, 'Age must be less than 120']
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  activityLevel: {
    type: String,
    enum: ['sedentary', 'lightly_active', 'moderately_active', 'moderate', 'very_active', 'extremely_active'],
    default: 'sedentary'
  },
  targetDate: Date,

  // Calculated values
  bmr: Number, // Basal Metabolic Rate
  tdee: Number, // Total Daily Energy Expenditure
  dailyCalorieTarget: Number,

  macroTargets: {
    protein: Number, // grams
    carbs: Number, // grams
    fats: Number // grams
  },

  // Progress tracking
  startWeight: Number,
  startDate: {
    type: Date,
    default: Date.now
  },
  weeklyWeightLogs: [{
    weight: Number,
    date: Date,
    notes: String
  }],

  // Preferences
  dietaryPreference: {
    type: String,
    enum: ['vegetarian', 'vegan', 'non-vegetarian', 'eggetarian'],
    default: 'non-vegetarian'
  },
  allergies: [String],
  dislikedFoods: [String],

  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Calculate BMR using Mifflin-St Jeor Equation
healthGoalSchema.methods.calculateBMR = function () {
  if (this.gender === 'male') {
    this.bmr = (10 * this.currentWeight) + (6.25 * this.height) - (5 * this.age) + 5;
  } else {
    this.bmr = (10 * this.currentWeight) + (6.25 * this.height) - (5 * this.age) - 161;
  }
  return this.bmr;
};

// Calculate TDEE based on activity level
healthGoalSchema.methods.calculateTDEE = function () {
  const activityMultipliers = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    moderate: 1.55,
    very_active: 1.725,
    extremely_active: 1.9
  };

  if (!this.bmr) {
    this.calculateBMR();
  }

  this.tdee = this.bmr * activityMultipliers[this.activityLevel];
  return this.tdee;
};

// Calculate daily calorie target based on goal (scientifically backed)
healthGoalSchema.methods.calculateCalorieTarget = function () {
  if (!this.tdee) {
    this.calculateTDEE();
  }

  let calorieAdjust = 0;

  switch (this.goalType) {
    case 'weight_loss':
      calorieAdjust = -500; // Fat loss: 500 calorie deficit for ~0.5kg/week
      break;
    case 'weight_gain':
      calorieAdjust = 500; // Weight gain: 500 calorie surplus
      break;
    case 'muscle_gain':
      calorieAdjust = 300; // Muscle gain: 300 calorie lean surplus
      break;
    case 'maintenance':
    case 'maintain':
    case 'health_improvement':
    case 'general_health':
      calorieAdjust = 0; // Maintenance: no adjustment
      break;
    default:
      calorieAdjust = 0;
  }

  this.dailyCalorieTarget = Math.round(this.tdee + calorieAdjust);
  return this.dailyCalorieTarget;
};

// Calculate macro targets (adjusted for realistic intake)
healthGoalSchema.methods.calculateMacros = function () {
  if (!this.dailyCalorieTarget) {
    this.calculateCalorieTarget();
  }

  // Dynamic multipliers based on goal
  let proteinPerKg = 1.2; // Base healthy active adult target
  let fatPerKg = 0.8; // Essential hormone production baseline

  switch (this.goalType) {
    case 'weight_loss':
      proteinPerKg = 1.6; // Higher protein to preserve muscle mass in deficit
      fatPerKg = 0.6; // Lower fat to accommodate caloric restriction
      break;
    case 'muscle_gain':
      proteinPerKg = 1.8; // High protein for optimal muscle protein synthesis
      fatPerKg = 0.8;
      break;
    case 'weight_gain':
      proteinPerKg = 1.4;
      fatPerKg = 1.0; // Higher fat for easier caloric surplus
      break;
    default:
      proteinPerKg = 1.2;
      fatPerKg = 0.8;
      break;
  }

  let protein = Math.round(this.currentWeight * proteinPerKg);
  let fats = Math.round(this.currentWeight * fatPerKg);

  // Safety cap for extremely large weights ensuring protein/fats aren't absurdly high
  const maxProtein = Math.round((this.dailyCalorieTarget * 0.35) / 4);
  protein = Math.min(protein, maxProtein, 250);

  const proteinCalories = protein * 4;
  const fatsCalories = fats * 9;
  
  let remainingCalories = this.dailyCalorieTarget - proteinCalories - fatsCalories;
  
  // If baseline calories drop too low, re-adjust fats to ensure at least some carbs
  if (remainingCalories < 400) {
    fats = Math.max(Math.round((this.dailyCalorieTarget * 0.2) / 9), 30);
    remainingCalories = this.dailyCalorieTarget - proteinCalories - (fats * 9);
  }

  const carbs = Math.round(Math.max(remainingCalories / 4, 0)); // Carbs provide 4 cal/g

  this.macroTargets = {
    protein: protein,
    carbs: carbs,
    fats: fats
  };

  return this.macroTargets;
};

// Calculate all targets before saving
healthGoalSchema.pre('save', function (next) {
  if (!this.startWeight) {
    this.startWeight = this.currentWeight;
  }

  this.calculateBMR();
  this.calculateTDEE();
  this.calculateCalorieTarget();
  this.calculateMacros();

  next();
});

module.exports = mongoose.model('HealthGoal', healthGoalSchema);
