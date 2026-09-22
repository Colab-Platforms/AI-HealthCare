const mongoose = require('mongoose');

// Shared shape for every meal-slot option below — was duplicated 5x with
// only calories/protein/carbs/fats, which meant fiber/sugar/sodium/
// saturatedFat and the Diet Quality Score's micronutrients were silently
// stripped by Mongoose's default strict mode even though dietRecommendationAI.js
// generates them (undeclared fields never survive .save()). Defined once now
// so all 5 slots stay in sync.
const mealOptionSchema = {
  name: String,
  description: String,
  portionSize: String,
  calories: Number,
  protein: Number,
  carbs: Number,
  fats: Number,
  benefits: String,
  fiber: Number,
  sugar: Number,
  sodium: Number,
  saturatedFat: Number,
  vitaminA: Number,
  vitaminC: Number,
  vitaminD: Number,
  vitaminB12: Number,
  iron: Number,
  calcium: Number,
  potassium: Number,
  magnesium: Number,
  omega3: Number
};

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
    // Optional occasion/fasting context the plan was generated for (e.g.
    // "Ramadan", "Shravan month", "Navratri upvas"). Null when not set.
    occasion: { type: String, default: null },
    activityLevel: String,
    fitnessGoals: [String],
    medicalConditions: [String],
    allergies: [String],
    dietaryDo: [String],
    dietaryDont: [String],
    hasReports: Boolean,
    lifestyle: { type: mongoose.Schema.Types.Mixed },
    alcoholSummary: { type: mongoose.Schema.Types.Mixed }
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
      fats: Number
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
    breakfast: [mealOptionSchema],
    midMorningSnack: [mealOptionSchema],
    lunch: [mealOptionSchema],
    eveningSnack: [mealOptionSchema],
    dinner: [mealOptionSchema]
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
  },
  status: {
    type: String,
    enum: ['pending', 'generating', 'completed', 'failed'],
    default: 'completed'
  },
  isFallback: {
    type: Boolean,
    default: false
  },

  // Single-slot regeneration in flight (one at a time — a second request for a
  // different slot overwrites this rather than queuing, matching the realistic
  // UX of one "regenerating..." spinner at a time). Self-healing timeout mirrors
  // the whole-plan generating->failed recovery in getActiveDietPlan.
  pendingMealRegeneration: {
    mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner'] },
    dayIndex: Number,
    status: { type: String, enum: ['generating', 'failed'] },
    requestedAt: Date
  }
}, {
  timestamps: true,
  strict: false
});

// Index for efficient queries
personalizedDietPlanSchema.index({ userId: 1, isActive: 1, generatedAt: -1 });

module.exports = mongoose.model('PersonalizedDietPlan', personalizedDietPlanSchema);
