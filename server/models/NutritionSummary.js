const mongoose = require('mongoose');

const nutritionSummarySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },

  // Totals for the day
  totalCalories: { type: Number, default: 0 },
  totalProtein: { type: Number, default: 0 },
  totalCarbs: { type: Number, default: 0 },
  totalFats: { type: Number, default: 0 },
  totalFiber: { type: Number, default: 0 },
  totalSugar: { type: Number, default: 0 },
  totalSodium: { type: Number, default: 0 },
  totalVitaminA: { type: Number, default: 0 },
  totalVitaminC: { type: Number, default: 0 },
  totalVitaminD: { type: Number, default: 0 },
  totalVitaminB12: { type: Number, default: 0 },
  totalIron: { type: Number, default: 0 },
  totalCalcium: { type: Number, default: 0 },
  // Diet Quality Score additions — see nutrientTargets.js for the age/gender-
  // aware NIH ODS/AHA targets these are compared against.
  totalSaturatedFat: { type: Number, default: 0 },
  totalPotassium: { type: Number, default: 0 },
  totalMagnesium: { type: Number, default: 0 },
  totalOmega3: { type: Number, default: 0 },
  averageHealthScore: { type: Number, default: 0 },

  // Nutrition Score (MAR/AMDR/HEI formula, dietQualityScoreService.js) is
  // still computed live on every read — that's deliberate, so a future fix to
  // the formula applies retroactively to every past day without a backfill
  // migration. These fields are a write-through snapshot of the last computed
  // result, kept only so the score is visible directly on the record (Compass,
  // analytics scripts, etc.) without re-running the formula or hitting the
  // API. Never read these back as the source of truth inside the app itself.
  dietQualityScore: { type: Number, default: null },
  dietQualityHealthyNutrientsScore: { type: Number, default: null },
  dietQualityJunkControlScore: { type: Number, default: null },
  dietQualityBand: { type: String, enum: ['excellent', 'good', 'fair', 'needs_attention', null], default: null },
  dietQualityComputedAt: { type: Date, default: null },
  
  // Quality breakdown
  healthyFoodsCount: { type: Number, default: 0 },
  junkFoodsCount: { type: Number, default: 0 },
  totalFoodsCount: { type: Number, default: 0 },

  // Meal breakdown
  mealsLogged: {
    breakfast: { type: Boolean, default: false },
    lunch: { type: Boolean, default: false },
    dinner: { type: Boolean, default: false },
    snacks: { type: Number, default: 0 }
  },

  // Water intake
  waterIntake: { type: Number, default: 0 }, // in ml — running total for the day
  // Individual log entries behind that total, for a per-tap history view
  waterLogs: [{
    amountMl: { type: Number, required: true },
    loggedAt: { type: Date, default: Date.now },
    label: String // e.g. "Custom", "250ml preset" — optional, for display
  }],

  // Calories burned via logged activity (manual entry or wearable sync) — offsets the daily total
  caloriesBurned: { type: Number, default: 0 },

  // Goals for the day (from HealthGoal)
  calorieGoal: Number,
  proteinGoal: Number,
  carbsGoal: Number,
  fatsGoal: Number,
  fiberGoal: Number, // 14g per 1000 kcal — USDA Dietary Guidelines for Americans / WHO

  // Status
  status: {
    type: String,
    enum: ['under', 'on_track', 'over'],
    default: 'under'
  },

  // Percentage of goals met
  caloriePercentage: { type: Number, default: 0 },
  proteinPercentage: { type: Number, default: 0 },
  carbsPercentage: { type: Number, default: 0 },
  fatsPercentage: { type: Number, default: 0 },
  fiberPercentage: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Compound index for user and date
nutritionSummarySchema.index({ userId: 1, date: 1 }, { unique: true });

// Calculate percentages and status
nutritionSummarySchema.methods.calculateStatus = function () {
  if (this.calorieGoal) {
    // Exercise calories (gym workouts + wearable activity) extend the day's
    // effective budget — the "eat back your exercise calories" pattern used
    // by MyFitnessPal/Fitbit, so a workout is reflected in on_track/over
    // status instead of sitting unused in caloriesBurned.
    const effectiveGoal = this.calorieGoal + (this.caloriesBurned || 0);
    this.caloriePercentage = Math.round((this.totalCalories / effectiveGoal) * 100);
  }
  if (this.proteinGoal) {
    this.proteinPercentage = Math.round((this.totalProtein / this.proteinGoal) * 100);
  }
  if (this.carbsGoal) {
    this.carbsPercentage = Math.round((this.totalCarbs / this.carbsGoal) * 100);
  }
  if (this.fiberGoal) {
    this.fiberPercentage = Math.round((this.totalFiber / this.fiberGoal) * 100);
  }
  if (this.fatsGoal) {
    this.fatsPercentage = Math.round((this.totalFats / this.fatsGoal) * 100);
  }

  // Determine overall status
  if (this.caloriePercentage < 80) {
    this.status = 'under';
  } else if (this.caloriePercentage >= 80 && this.caloriePercentage <= 110) {
    this.status = 'on_track';
  } else {
    this.status = 'over';
  }

  return this.status;
};

// Update summary before saving
nutritionSummarySchema.pre('save', function (next) {
  this.calculateStatus();
  next();
});

module.exports = mongoose.model('NutritionSummary', nutritionSummarySchema);
