const mongoose = require('mongoose');

// Permanent daily rollup over StressSample, same shape/update pattern as
// HeartRateDailySummary — incrementally updated as raw samples arrive.
const stressDailySummarySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deviceType: { type: String, required: true },
  date: { type: Date, required: true },
  avgLevel: { type: Number, default: 0 },
  min: {
    value: Number,
    timestamp: Date
  },
  max: {
    value: Number,
    timestamp: Date
  },
  readingCount: { type: Number, default: 0 },
  highStressMinutes: { type: Number, default: 0 }, // minutes spent in category:'high'

  // Real HRV (RMSSD, ms) — its own running average, tracked separately from
  // avgLevel/min/max above (those belong to the 0-100 stress-level reading,
  // not HRV). The webhook has carried sample.hrv on every stress sample all
  // along (see StressSample.hrv) but this rollup silently discarded it —
  // recoveryScoreService's HRV engine needs it.
  avgHrvMs: Number,
  hrvReadingCount: { type: Number, default: 0 }
}, { timestamps: true });

stressDailySummarySchema.index({ user: 1, deviceType: 1, date: 1 }, { unique: true });
stressDailySummarySchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('StressDailySummary', stressDailySummarySchema);
