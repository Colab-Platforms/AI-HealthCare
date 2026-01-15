const mongoose = require('mongoose');

const wearableDataSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deviceType: { 
    type: String, 
    enum: ['fitbit', 'apple_watch', 'garmin', 'samsung', 'xiaomi', 'other'],
    required: true 
  },
  deviceName: String,
  isConnected: { type: Boolean, default: true },
  lastSyncedAt: { type: Date, default: Date.now },
  
  // Daily metrics
  dailyMetrics: [{
    date: { type: Date, required: true },
    steps: { type: Number, default: 0 },
    caloriesBurned: { type: Number, default: 0 },
    activeMinutes: { type: Number, default: 0 },
    distance: { type: Number, default: 0 }, // in km
    floorsClimbed: { type: Number, default: 0 }
  }],

  // Heart rate data
  heartRate: [{
    timestamp: { type: Date, default: Date.now },
    bpm: { type: Number, required: true },
    type: { type: String, enum: ['resting', 'active', 'peak', 'cardio'], default: 'resting' }
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
wearableDataSchema.index({ user: 1, 'heartRate.timestamp': -1 });

module.exports = mongoose.model('WearableData', wearableDataSchema);
