const mongoose = require('mongoose');

// Permanent daily rollup over VitalsSample — same incremental-update
// pattern as HeartRateDailySummary, one row per vital sign per day.
const vitalsDailySummarySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deviceType: { type: String, required: true },
  date: { type: Date, required: true },
  avgRespiratoryRate: Number,
  avgSkinTemperatureCelsius: Number,
  bloodPressure: {
    min: { systolic: Number, diastolic: Number, timestamp: Date },
    max: { systolic: Number, diastolic: Number, timestamp: Date }
  },
  // Each field arrives independently (different sensors, different times of
  // day), so each average needs its OWN count as the divisor — a sample
  // reporting only skinTemperature must not dilute avgRespiratoryRate by
  // being counted as a zero reading for it. `readingCount` stays as the
  // total-samples-processed-that-day figure (informational).
  respiratoryRateCount: { type: Number, default: 0 },
  skinTemperatureCount: { type: Number, default: 0 },
  readingCount: { type: Number, default: 0 }
}, { timestamps: true });

vitalsDailySummarySchema.index({ user: 1, deviceType: 1, date: 1 }, { unique: true });
vitalsDailySummarySchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('VitalsDailySummary', vitalsDailySummarySchema);
