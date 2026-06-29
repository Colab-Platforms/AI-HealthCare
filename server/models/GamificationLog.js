const mongoose = require('mongoose');

const gamificationLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  actionType: {
    type: String,
    enum: [
      'login',
      'food_log',
      'step_goal',
      'nutrition_goal',
      'workout',
      'water_intake',
      'health_checkup',
      'system_event'
    ],
    required: true
  },
  pointsAwarded: {
    type: Number,
    required: true,
    default: 0
  },
  description: {
    type: String,
    required: true
  },
  // To ensure we don't reward multiple times for the same daily action
  // e.g., 'login_2023-10-25' or 'food_log_breakfast_2023-10-25'
  uniqueActionKey: {
    type: String,
    sparse: true
  }
}, { timestamps: true });

// Ensure unique actions per day (e.g. daily login points should only be given once a day)
gamificationLogSchema.index({ user: 1, uniqueActionKey: 1 }, { unique: true, sparse: true });
gamificationLogSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('GamificationLog', gamificationLogSchema);
