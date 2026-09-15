const mongoose = require('mongoose');

// Replaces WearableData.dailyMetrics[]. One doc per user+deviceType+day —
// low frequency (1 write/day/device), so a plain collection is fine, no
// time-series bucketing needed.
const dailyActivityMetricSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  deviceType: { type: String, required: true },
  date: { type: Date, required: true },
  steps: { type: Number, default: 0 },
  caloriesBurned: { type: Number, default: 0 },
  activeMinutes: { type: Number, default: 0 },
  distance: { type: Number, default: 0 }, // km
  floorsClimbed: { type: Number, default: 0 },
  source: String,
  sourceRecordId: String
}, { timestamps: true });

dailyActivityMetricSchema.index({ user: 1, deviceType: 1, date: 1 }, { unique: true });
dailyActivityMetricSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('DailyActivityMetric', dailyActivityMetricSchema);
