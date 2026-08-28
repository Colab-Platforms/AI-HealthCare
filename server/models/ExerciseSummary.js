const mongoose = require('mongoose');

const exerciseSummarySchema = new mongoose.Schema({
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

  totalDuration: { type: Number, default: 0 }, // minutes
  totalCaloriesBurned: { type: Number, default: 0 },
  sessionsCount: { type: Number, default: 0 },
  totalDistance: { type: Number, default: 0 }, // km
  avgHeartRate: { type: Number, default: 0 },

  // Count of sessions per activityType, e.g. { running: 1, gym_strength: 2 }
  sessionsByType: { type: Map, of: Number, default: {} }
}, {
  timestamps: true
});

exerciseSummarySchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('ExerciseSummary', exerciseSummarySchema);
