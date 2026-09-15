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
  readingCount: { type: Number, default: 0 }
}, { timestamps: true });

vitalsDailySummarySchema.index({ user: 1, deviceType: 1, date: 1 }, { unique: true });
vitalsDailySummarySchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('VitalsDailySummary', vitalsDailySummarySchema);
