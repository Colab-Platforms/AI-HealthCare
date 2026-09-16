const mongoose = require('mongoose');

// Respiratory rate, skin temperature, blood pressure, ECG classification —
// greenfield, none of this exists today. One flexible shape rather than
// four separate models since these are all low-cardinality "vital sign at a
// point in time" readings read the same way (date-range trend, min/max).
const vitalsSampleSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  meta: {
    deviceType: { type: String, required: true },
    source: String
  },
  timestamp: { type: Date, required: true },
  respiratoryRate: Number, // breaths/min
  // Absolute skin/wrist temperature in °C (confirmed for HealthKit — an
  // Apple Watch reading like 33.4 is normal). recoveryScoreService compares
  // this against the user's own rolling baseline, not a fixed reference
  // point. If a future provider reports a delta-from-baseline instead,
  // that'll need handling here (a separate field, not overloading this one).
  skinTemperatureCelsius: Number,
  bloodPressureSystolic: Number,
  bloodPressureDiastolic: Number,
  ecgClassification: { type: String, enum: ['sinus_rhythm', 'atrial_fibrillation', 'inconclusive', 'other'] },
  sourceRecordId: String
}, {
  timeseries: { timeField: 'timestamp', metaField: 'meta', granularity: 'minutes' },
  expireAfterSeconds: 90 * 24 * 60 * 60
});

vitalsSampleSchema.index({ user: 1, timestamp: -1 });

module.exports = mongoose.model('VitalsSample', vitalsSampleSchema);
