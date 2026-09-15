const mongoose = require('mongoose');

// Replaces WearableData.heartRateDailySummary[]. Permanent, never evicted —
// the source of truth for any HR trend spanning longer than raw
// HeartRateSample's 90-day retention. Unlike the embedded version this
// predates, min/max carry the timestamp they occurred at, not just the
// value, so "highest/lowest HR and when" stays answerable indefinitely.
const heartRateDailySummarySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deviceType: { type: String, required: true },
  date: { type: Date, required: true },
  avgBpm: { type: Number, default: 0 },
  min: {
    value: Number,
    timestamp: Date
  },
  max: {
    value: Number,
    timestamp: Date
  },
  readingCount: { type: Number, default: 0 },
  // Running min of samples tagged type==='resting' that day.
  restingBpm: {
    value: Number,
    timestamp: Date
  }
}, { timestamps: true });

heartRateDailySummarySchema.index({ user: 1, deviceType: 1, date: 1 }, { unique: true });
heartRateDailySummarySchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('HeartRateDailySummary', heartRateDailySummarySchema);
