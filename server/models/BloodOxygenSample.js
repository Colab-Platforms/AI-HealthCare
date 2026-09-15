const mongoose = require('mongoose');

// Replaces WearableData.bloodOxygen[]. High-frequency (continuous SpO2 on
// some devices), so this is a native Mongo time-series collection — bucketed
// storage instead of one row per sample, same idea as HeartRateSample but
// using Mongo's purpose-built type. Dedup by sourceRecordId is done at the
// application layer (time-series collections don't support unique indexes),
// same pattern already used for HeartRateSample via .exists() checks.
const bloodOxygenSampleSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  meta: {
    deviceType: { type: String, required: true },
    source: String
  },
  timestamp: { type: Date, required: true },
  percentage: { type: Number, min: 0, max: 100 },
  sourceRecordId: String
}, {
  timeseries: { timeField: 'timestamp', metaField: 'meta', granularity: 'minutes' },
  expireAfterSeconds: 90 * 24 * 60 * 60
});

bloodOxygenSampleSchema.index({ user: 1, timestamp: -1 });

module.exports = mongoose.model('BloodOxygenSample', bloodOxygenSampleSchema);
