const mongoose = require('mongoose');

// Replaces WearableData.workouts[]. One doc per workout/exercise session
// reported by a device (distinct from ExerciseLog, which is user-logged).
const workoutSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  deviceType: { type: String, required: true },
  workoutId: { type: String, required: true },
  type: String,
  startTime: Date,
  endTime: Date,
  durationSeconds: Number,
  caloriesKcal: Number,
  distanceMeters: Number,
  avgHeartRateBpm: Number,
  maxHeartRateBpm: Number,
  elevationGainMeters: Number,
  provider: String
}, { timestamps: true });

workoutSchema.index({ user: 1, deviceType: 1, workoutId: 1 }, { unique: true });
workoutSchema.index({ user: 1, startTime: -1 });

module.exports = mongoose.model('Workout', workoutSchema);
