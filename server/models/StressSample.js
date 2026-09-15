const mongoose = require('mongoose');

// Raw HRV/stress-index ticks feeding StressDailySummary — greenfield, no
// legacy data. Time-series collection: continuous-monitoring devices
// (Whoop/Oura/Ultrahuman-class) can push very frequent readings.
const stressSampleSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  meta: {
    deviceType: { type: String, required: true },
    source: String
  },
  timestamp: { type: Date, required: true },
  level: { type: Number, min: 0, max: 100 }, // normalized stress index, 0-100
  category: { type: String, enum: ['rest', 'low', 'medium', 'high'] },
  hrv: Number, // ms, when the provider reports it alongside the stress tick
  sourceRecordId: String
}, {
  timeseries: { timeField: 'timestamp', metaField: 'meta', granularity: 'minutes' },
  expireAfterSeconds: 90 * 24 * 60 * 60
});

stressSampleSchema.index({ user: 1, timestamp: -1 });

module.exports = mongoose.model('StressSample', stressSampleSchema);
