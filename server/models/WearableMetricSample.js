const mongoose = require('mongoose');

// Replaces WearableData.metrics[]. Generic fallback for any OpenWearables
// series_type (VO2 max, running power, UV exposure, ...) without a
// dedicated model — this is the array that was most at risk of growing an
// embedded document past Mongo's 16MB cap, so it gets its own time-series
// collection rather than living inside WearableData.
const wearableMetricSampleSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  meta: {
    deviceType: { type: String, required: true },
    seriesType: { type: String, required: true },
    provider: String,
    device: String
  },
  timestamp: { type: Date, required: true },
  value: Number,
  unit: String
}, {
  timeseries: { timeField: 'timestamp', metaField: 'meta', granularity: 'minutes' },
  expireAfterSeconds: 90 * 24 * 60 * 60
});

wearableMetricSampleSchema.index({ user: 1, timestamp: -1 });

module.exports = mongoose.model('WearableMetricSample', wearableMetricSampleSchema);
