const mongoose = require('mongoose');

// Replaces WearableData.bodyComposition[]. Low frequency (weigh-ins), plain
// collection, deduped by sourceRecordId where the source provides one.
const bodyCompositionSampleSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  deviceType: { type: String, required: true },
  timestamp: { type: Date, required: true },
  weightKg: Number,
  bodyFatPercentage: { type: Number, min: 0, max: 100 },
  bmi: Number,
  leanBodyMassKg: Number,
  source: String,
  sourceRecordId: String
}, { timestamps: true });

bodyCompositionSampleSchema.index({ user: 1, timestamp: -1 });
bodyCompositionSampleSchema.index({ user: 1, deviceType: 1, sourceRecordId: 1 });

module.exports = mongoose.model('BodyCompositionSample', bodyCompositionSampleSchema);
