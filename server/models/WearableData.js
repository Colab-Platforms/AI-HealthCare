const mongoose = require('mongoose');

const wearableDataSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deviceType: { 
    type: String, 
    // Values match Open Wearables provider slugs so a webhook's `provider` field
    // maps straight onto deviceType; the first few predate that integration.
    enum: [
      'fitbit', 'apple_watch', 'garmin', 'samsung', 'xiaomi', 'other',
      'google', 'whoop', 'oura', 'polar', 'strava', 'suunto', 'ultrahuman', 'sensorbio', 'apple',
      'noise', 'boat'
    ],
    required: true 
  },
  deviceName: String,
  isConnected: { type: Boolean, default: true },
  lastSyncedAt: { type: Date, default: Date.now },

  // Open Wearables service ka internal user ID — webhook se aane wale data ko
  // isi field se match karke pata chalega ye kis user ka data hai
  openWearablesUserId: { type: String, index: true },
  // Source metadata for records imported from Health Connect or HealthKit.
  osHealthSource: { type: String, enum: ['health_connect', 'healthkit'] },
  sourceDeviceId: String,

  // Daily metrics
  dailyMetrics: [{
    date: { type: Date, required: true },
    steps: { type: Number, default: 0 },
    caloriesBurned: { type: Number, default: 0 },
    activeMinutes: { type: Number, default: 0 },
    distance: { type: Number, default: 0 }, // in km
    floorsClimbed: { type: Number, default: 0 },
    source: String,
    sourceRecordId: String
  }],

  // Heart rate data — raw samples, capped to the most recent 100 (see
  // wearableController). Fine for a "recent readings" widget, but too short a
  // window for week-over-week trends, hence heartRateDailySummary below.
  heartRate: [{
    timestamp: { type: Date, default: Date.now },
    bpm: { type: Number, required: true },
    type: { type: String, enum: ['resting', 'active', 'peak', 'cardio'], default: 'resting' },
    source: String,
    sourceRecordId: String
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
    wakeTime: Date,
    source: String,
    sourceRecordId: String
  }],

  // Blood oxygen (SpO2)
  bloodOxygen: [{
    timestamp: { type: Date, default: Date.now },
    percentage: { type: Number, min: 0, max: 100 },
    source: String,
    sourceRecordId: String
  }],

  // Body composition (weight, body fat, BMI) — populated from provider webhooks
  bodyComposition: [{
    timestamp: { type: Date, default: Date.now },
    weightKg: Number,
    bodyFatPercentage: { type: Number, min: 0, max: 100 },
    bmi: Number,
    leanBodyMassKg: Number,
    source: String,
    sourceRecordId: String
  }],

  // Stress levels
  stressLevels: [{
    timestamp: { type: Date, default: Date.now },
    level: { type: Number, min: 0, max: 100 },
    category: { type: String, enum: ['low', 'medium', 'high'] }
  }],

  // Generic time-series store for any metric Open Wearables reports (its
  // `series_type` — 90+ values covering VO2 max, running power, HRV, UV
  // exposure, etc.) that predates or falls outside the named arrays above.
  // Kept alongside the named arrays rather than replacing them, since the
  // dashboard reads those directly.
  metrics: [{
    seriesType: { type: String, required: true, index: true },
    value: Number,
    unit: String,
    timestamp: { type: Date, required: true, index: true },
    provider: String,
    device: String
  }],

  // Workout/exercise sessions — kept separate from dailyMetrics (which only
  // accumulates calories/distance/activeMinutes per day) since a workout is
  // a single event with its own start/end and stats.
  workouts: [{
    workoutId: String,
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
wearableDataSchema.index({ user: 1, 'metrics.seriesType': 1, 'metrics.timestamp': -1 });

module.exports = mongoose.model('WearableData', wearableDataSchema);
