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
    enum: ['weight_loss', 'weight_gain', 'muscle_gain', 'maintenance', 'health_improvement'],
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
    max: [300, 'Target weight must be less than 300kg']
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
    min: [10, 'Age must be at least 10'],
    max: [120, 'Age must be less than 120']
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  activityLevel: {
    type: String,
    enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
    default: 'moderate'
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
healthGoalSchema.methods.calculateBMR = function() {
  if (this.gender === 'male') {
    this.bmr = (10 * this.currentWeight) + (6.25 * this.height) - (5 * this.age) + 5;
  } else {
    this.bmr = (10 * this.currentWeight) + (6.25 * this.height) - (5 * this.age) - 161;
  }
  return this.bmr;
};

// Calculate TDEE based on activity level
healthGoalSchema.methods.calculateTDEE = function() {
  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9
  };
  
  if (!this.bmr) {
    this.calculateBMR();
  }
  
  this.tdee = this.bmr * activityMultipliers[this.activityLevel];
  return this.tdee;
};

// Calculate daily calorie target based on goal (scientifically backed)
healthGoalSchema.methods.calculateCalorieTarget = function() {
  if (!this.tdee) {
    this.calculateTDEE();
  }
  
  let calorieAdjust = 0;
  
  switch (this.goalType) {
    case 'weight_loss':
      calorieAdjust = -400; // Fat loss: 400 calorie deficit
      break;
    case 'weight_gain':
      calorieAdjust = 350; // Weight gain: 350 calorie surplus
      break;
    case 'muscle_gain':
      calorieAdjust = 350; // Muscle gain: 350 calorie surplus
      break;
    case 'maintenance':
    case 'health_improvement':
      calorieAdjust = 0; // Maintenance: no adjustment
      break;
    default:
      calorieAdjust = 0;
  }
  
  this.dailyCalorieTarget = Math.round(this.tdee + calorieAdjust);
  return this.dailyCalorieTarget;
};

// Calculate macro targets (adjusted for realistic intake)
healthGoalSchema.methods.calculateMacros = function() {
  if (!this.dailyCalorieTarget) {
    this.calculateCalorieTarget();
  }
  
  // Protein: 1.6g per kg body weight (realistic and sustainable for most people)
  // This is sufficient for muscle maintenance and growth without being excessive
  const protein = Math.round(this.currentWeight * 1.6);
  
  // Fats: 0.8g per kg body weight (essential for hormone production)
  const fats = Math.round(this.currentWeight * 0.8);
  
  // Carbs: Fill remaining calories
  // Protein provides 4 cal/g, Fats provide 9 cal/g
  const proteinCalories = protein * 4;
  const fatsCalories = fats * 9;
  const remainingCalories = this.dailyCalorieTarget - proteinCalories - fatsCalories;
  const carbs = Math.round(remainingCalories / 4); // Carbs provide 4 cal/g
  
  this.macroTargets = {
    protein: protein,
    carbs: Math.max(carbs, 0), // Ensure non-negative
    fats: fats
  };
  
  return this.macroTargets;
};

// Calculate all targets before saving
healthGoalSchema.pre('save', function(next) {
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
