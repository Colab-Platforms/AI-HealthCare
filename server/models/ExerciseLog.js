const mongoose = require('mongoose');

// MET (Metabolic Equivalent of Task) values used for calorie-burn estimation.
// caloriesBurned = MET * weightKg * (durationMinutes / 60)
const MET_VALUES = {
  running: 9.8,
  cycling: 7.5,
  walking: 3.8,
  swimming: 8.3,
  gym_strength: 5.0,
  yoga: 2.5,
  hiit: 8.0,
  sports: 7.0,
  other: 4.0
};

const INTENSITY_MULTIPLIERS = {
  low: 0.8,
  medium: 1.0,
  high: 1.25
};

const ACTIVITY_CATEGORY = {
  running: 'cardio',
  cycling: 'cardio',
  walking: 'cardio',
  swimming: 'cardio',
  gym_strength: 'strength',
  yoga: 'flexibility',
  hiit: 'cardio',
  sports: 'cardio',
  other: 'other'
};

const DEFAULT_WEIGHT_KG = 70;

function calculateCalories(activityType, intensity, durationMin, weightKg) {
  const met = MET_VALUES[activityType] || MET_VALUES.other;
  const multiplier = INTENSITY_MULTIPLIERS[intensity] || 1.0;
  const weight = Number(weightKg) > 0 ? Number(weightKg) : DEFAULT_WEIGHT_KG;
  const duration = Number(durationMin) > 0 ? Number(durationMin) : 0;
  const calories = met * multiplier * weight * (duration / 60);
  return { calories: Math.round(calories), metValue: met };
}

const setSchema = new mongoose.Schema({
  reps: { type: Number, min: 0 },
  weight: { type: Number, min: 0 }, // kg
  restSeconds: { type: Number, min: 0 }
}, { _id: false });

const exerciseEntrySchema = new mongoose.Schema({
  name: { type: String, required: true },
  sets: [setSchema]
}, { _id: false });

const exerciseLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  activityType: {
    type: String,
    enum: Object.keys(MET_VALUES),
    required: true
  },
  category: {
    type: String,
    enum: ['cardio', 'strength', 'flexibility', 'other'],
  },
  duration: { type: Number, required: true, min: 0 }, // minutes

  // Cardio-specific
  distance: { type: Number, min: 0 }, // km
  avgPace: { type: Number, min: 0 }, // min/km
  avgHeartRate: { type: Number, min: 0 },
  maxHeartRate: { type: Number, min: 0 },
  elevationGain: { type: Number, min: 0 }, // meters

  // Strength-specific
  exercises: [exerciseEntrySchema],

  // Flexibility/other
  intensity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },

  caloriesBurned: { type: Number, default: 0 },
  metValue: { type: Number },

  source: { type: String, enum: ['manual'], default: 'manual' },
  notes: String,

  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

exerciseLogSchema.index({ userId: 1, timestamp: -1 });

exerciseLogSchema.pre('save', function (next) {
  if (!this.category) {
    this.category = ACTIVITY_CATEGORY[this.activityType] || 'other';
  }
  next();
});

exerciseLogSchema.statics.MET_VALUES = MET_VALUES;
exerciseLogSchema.statics.calculateCalories = calculateCalories;

module.exports = mongoose.model('ExerciseLog', exerciseLogSchema);
