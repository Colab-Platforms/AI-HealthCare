const mongoose = require('mongoose');

const wearableDataSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deviceType: { 
    type: String, 
    // Values match Open Wearables provider slugs so a webhook's `provider` field
    // maps straight onto deviceType; the first few predate that integration.
    enum: [
      'fitbit', 'apple_watch', 'garmin', 'samsung', 'xiaomi', 'other',
      'google', 'whoop', 'oura', 'polar', 'strava', 'suunto', 'ultrahuman', 'sensorbio', 'apple'
    ],
    required: true 
  },
  deviceName: String,
  isConnected: { type: Boolean, default: true },
  lastSyncedAt: { type: Date, default: Date.now },

  // Open Wearables service ka internal user ID — webhook se aane wale data ko
  // isi field se match karke pata chalega ye kis user ka data hai
  openWearablesUserId: { type: String, index: true },

  // Daily metrics
  dailyMetrics: [{
    date: { type: Date, required: true },
    steps: { type: Number, default: 0 },
    caloriesBurned: { type: Number, default: 0 },
    activeMinutes: { type: Number, default: 0 },
    distance: { type: Number, default: 0 }, // in km
    floorsClimbed: { type: Number, default: 0 }
  }],

  // Heart rate data — raw samples, capped to the most recent 100 (see
  // wearableController). Fine for a "recent readings" widget, but too short a
  // window for week-over-week trends, hence heartRateDailySummary below.
  heartRate: [{
    timestamp: { type: Date, default: Date.now },
    bpm: { type: Number, required: true },
    type: { type: String, enum: ['resting', 'active', 'peak', 'cardio'], default: 'resting' }
  }],

  // One rollup per calendar day, updated incrementally as samples arrive —
  // same pattern as dailyMetrics. Never evicted, so this is the source of
  // truth for any HR trend spanning more than a day or two.
  heartRateDailySummary: [{
    date: { type: Date, required: true },
    avgBpm: { type: Number, default: 0 },
    minBpm: { type: Number },
    maxBpm: { type: Number },
    readingCount: { type: Number, default: 0 },
    // Running min of samples tagged type==='resting' that day — distinct from
    // avgBpm/minBpm/maxBpm above, which mix all sample types together
    restingBpm: { type: Number }
  }],

  // Sleep data
  sleepData: [{
    date: { type: Date, required: true },
    totalSleepMinutes: Number,
    deepSleepMinutes: Number,
    lightSleepMinutes: Number,
    remSleepMinutes: Number,
    awakeMinutes: Number,
    sleepScore: { type: Number, min: 0, max: 100 },
    bedTime: Date,
    wakeTime: Date
  }],

  // Blood oxygen (SpO2)
  bloodOxygen: [{
    timestamp: { type: Date, default: Date.now },
    percentage: { type: Number, min: 0, max: 100 }
  }],

  // Body composition (weight, body fat, BMI) — populated from provider webhooks
  bodyComposition: [{
    timestamp: { type: Date, default: Date.now },
    weightKg: Number,
    bodyFatPercentage: { type: Number, min: 0, max: 100 },
    bmi: Number,
    leanBodyMassKg: Number
  }],

  // Stress levels
  stressLevels: [{
    timestamp: { type: Date, default: Date.now },
    level: { type: Number, min: 0, max: 100 },
    category: { type: String, enum: ['low', 'medium', 'high'] }
  }],

  // Weekly/Monthly summaries
  weeklySummary: {
    avgSteps: Number,
    avgHeartRate: Number,
    avgSleepHours: Number,
    avgCaloriesBurned: Number,
    totalActiveMinutes: Number
  }
}, { timestamps: true });

// Index for efficient queries
wearableDataSchema.index({ user: 1, 'dailyMetrics.date': -1 });
wearableDataSchema.index({ user: 1, 'heartRateDailySummary.date': -1 });
wearableDataSchema.index({ user: 1, 'heartRate.timestamp': -1 });
wearableDataSchema.index({ user: 1, isConnected: 1 });
wearableDataSchema.index({ user: 1, deviceType: 1 });

module.exports = mongoose.model('WearableData', wearableDataSchema);
