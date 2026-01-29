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
  
  // Meal breakdown
  mealsLogged: {
    breakfast: { type: Boolean, default: false },
    lunch: { type: Boolean, default: false },
    dinner: { type: Boolean, default: false },
    snacks: { type: Number, default: 0 }
  },
  
  // Water intake
  waterIntake: { type: Number, default: 0 }, // in ml
  
  // Goals for the day (from HealthGoal)
  calorieGoal: Number,
  proteinGoal: Number,
  carbsGoal: Number,
  fatsGoal: Number,
  
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
  fatsPercentage: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Compound index for user and date
nutritionSummarySchema.index({ userId: 1, date: 1 }, { unique: true });

// Calculate percentages and status
nutritionSummarySchema.methods.calculateStatus = function() {
  if (this.calorieGoal) {
    this.caloriePercentage = Math.round((this.totalCalories / this.calorieGoal) * 100);
  }
  if (this.proteinGoal) {
    this.proteinPercentage = Math.round((this.totalProtein / this.proteinGoal) * 100);
  }
  if (this.carbsGoal) {
    this.carbsPercentage = Math.round((this.totalCarbs / this.carbsGoal) * 100);
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
nutritionSummarySchema.pre('save', function(next) {
  this.calculateStatus();
  next();
});

module.exports = mongoose.model('NutritionSummary', nutritionSummarySchema);
