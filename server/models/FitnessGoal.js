const mongoose = require('mongoose');

// Weekly fitness targets — the exercise-side equivalent of nutrition's HealthGoal,
// but without any BMR/TDEE math: just user-set (or default) weekly targets to
// track progress against.
const fitnessGoalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  weeklyMinutesTarget: { type: Number, min: 0, default: 150 }, // WHO guideline default
  weeklyCaloriesTarget: { type: Number, min: 0, default: 2000 },
  weeklyDistanceKmTarget: { type: Number, min: 0, default: 10 },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

fitnessGoalSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model('FitnessGoal', fitnessGoalSchema);
