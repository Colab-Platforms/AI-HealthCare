const mongoose = require('mongoose');

const personalizedDietPlanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  },

  // Input data used for generation
  inputData: {
    age: Number,
    gender: String,
    weight: Number,
    height: Number,
    currentBMI: String,
    bmiGoal: String,
    targetWeight: Number,
    dietaryPreference: String,
    activityLevel: String,
    fitnessGoals: [String],
    medicalConditions: [String],
    allergies: [String],
    hasReports: Boolean
  },

  // Lab report insights
  labReportInsights: [{
    parameter: String,
    value: String,
    unit: String,
    status: String,
    reportId: mongoose.Schema.Types.ObjectId
  }],

  // Nutrition goals
  nutritionGoals: {
    dailyCalorieTarget: Number,
    macroTargets: {
      protein: Number,
      carbs: Number,
      fat: Number
    }
  },

  // Generated diet plan
  dailyCalorieTarget: Number,
  macroTargets: {
    protein: Number,
    carbs: Number,
    fats: Number
  },

  mealPlan: {
    breakfast: [{
      name: String,
      description: String,
      calories: Number,
      protein: Number,
      benefits: String
    }],
    midMorningSnack: [{
      name: String,
      description: String,
      calories: Number,
      protein: Number,
      benefits: String
    }],
    lunch: [{
      name: String,
      description: String,
      calories: Number,
      protein: Number,
      benefits: String
    }],
    eveningSnack: [{
      name: String,
      description: String,
      calories: Number,
      protein: Number,
      benefits: String
    }],
    dinner: [{
      name: String,
      description: String,
      calories: Number,
      protein: Number,
      benefits: String
    }]
  },

  keyFoods: [{
    name: String,
    reason: String,
    frequency: String
  }],

  deficiencyCorrections: [{
    deficiency: String,
    indianFoods: [String],
    mealSuggestions: [String]
  }],

  lifestyleRecommendations: [String],

  avoidFoods: [{
    food: String,
    reason: String
  }],

  avoidSuggestions: [String],

  // User feedback
  userRating: {
    type: Number,
    min: 1,
    max: 5
  },
  userFeedback: String,

  // Status
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
personalizedDietPlanSchema.index({ userId: 1, isActive: 1, generatedAt: -1 });

module.exports = mongoose.model('PersonalizedDietPlan', personalizedDietPlanSchema);
