const mongoose = require('mongoose');

// One document per user per calendar day — mirrors DailyHealthScore's shape
// (finalScore + per-component breakdown) so Recovery slots into the same
// event-driven recompute pattern instead of a new cron.
const recoveryDailySummarySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // 'YYYY-MM-DD', UTC — matches DailyHealthScore's date-key convention

  recoveryScore: { type: Number, min: 0, max: 100 },

  // Per-component breakdown — a component is absent (not zero) when there
  // was no data for it that day, same convention as DailyHealthScore.components.
  components: {
    hrv: Number,
    restingHeartRate: Number,
    spo2: Number,
    skinTemperature: Number,
    sleepContribution: Number,
    strainContribution: Number, // prior day's activity/exercise load
  },

  deviceType: String // primary device the inputs were sourced from, when known
}, { timestamps: true });

recoveryDailySummarySchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('RecoveryDailySummary', recoveryDailySummarySchema);
