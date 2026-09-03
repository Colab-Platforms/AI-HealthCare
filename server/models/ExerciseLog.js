const mongoose = require('mongoose');
const { MET_VALUES, ACTIVITY_CATEGORY } = require('../config/activityCatalog');

// caloriesBurned = MET * weightKg * (durationMinutes / 60)
const INTENSITY_MULTIPLIERS = {
  low: 0.8,
  medium: 1.0,
  high: 1.25
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
  // Validated against config/activityCatalog.js's isValidActivityId() in the
  // controller rather than a Mongoose enum, so adding a new activity doesn't
  // require a schema change.
  activityType: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['cardio', 'strength', 'flexibility', 'other'],
  },
  duration: { type: Number, required: true, min: 0 }, // minutes

  // Cardio-specific
  distance: { type: Number, min: 0 }, // km
  avgPace: { type: Number, min: 0 }, // min/km, auto-computed from duration/distance when omitted
  steps: { type: Number, min: 0 }, // estimated from distance when omitted
  avgHeartRate: { type: Number, min: 0 },
  minHeartRate: { type: Number, min: 0 },
  maxHeartRate: { type: Number, min: 0 },
  elevationGain: { type: Number, min: 0 }, // meters

  // Minutes spent in each %-of-max-HR band (zone1 = 50-60% ... zone5 = 90-100%),
  // computed from wearable samples when available — see utils/heartRateZones.js
  heartRateZones: {
    zone1: { type: Number, min: 0 },
    zone2: { type: Number, min: 0 },
    zone3: { type: Number, min: 0 },
    zone4: { type: Number, min: 0 },
    zone5: { type: Number, min: 0 }
  },

  // Precise session window, when known — lets the server pull matching wearable
  // heart-rate samples. `timestamp` mirrors startTime when this is set.
  startTime: Date,
  endTime: Date,

  // Strength-specific
  exercises: [exerciseEntrySchema],

  // Flexibility/other
  intensity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },

  caloriesBurned: { type: Number, default: 0 },
  metValue: { type: Number },

  // 'wearable_sync' = HR fields computed entirely from device samples,
  // 'hybrid' = some fields manual, HR from device
  source: { type: String, enum: ['manual', 'wearable_sync', 'hybrid'], default: 'manual' },
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
