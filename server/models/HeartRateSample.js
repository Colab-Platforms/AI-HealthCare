const mongoose = require('mongoose');

const heartRateSampleSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  deviceType: { type: String, required: true, index: true },
  timestamp: { type: Date, required: true },
  bpm: { type: Number, required: true, min: 20, max: 250 },
  // 'unspecified' means the provider gave no reliable rest/activity context —
  // it must NOT default to 'resting', or restingBpm rollups get contaminated
  // with non-rest samples (see wearableController.js heart_rate.created).
  type: { type: String, enum: ['resting', 'active', 'peak', 'cardio', 'unspecified'], default: 'unspecified' },
  source: String,
  sourceRecordId: String
}, {
  timestamps: true
});

// Raw samples are retained for 90 days; daily summaries remain permanent.
heartRateSampleSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
heartRateSampleSchema.index({ user: 1, timestamp: 1 });
heartRateSampleSchema.index({ user: 1, deviceType: 1, timestamp: 1 });
heartRateSampleSchema.index({ user: 1, deviceType: 1, sourceRecordId: 1 });

module.exports = mongoose.model('HeartRateSample', heartRateSampleSchema);
