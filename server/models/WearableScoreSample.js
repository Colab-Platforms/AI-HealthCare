const mongoose = require('mongoose');

// Open Wearables computes Recovery/Strain/Sleep-performance scores into its
// own Postgres health_score table, but — unlike every other data type —
// never emits a webhook for them, so they can't reach us through the normal
// push pipeline. A periodic REST pull (see services/wearableScoreSyncService.js)
// is the only way to get them; this is where that pull lands.
//
// Time-series collection, same reasoning as WearableMetricSample: unbounded
// growth belongs in its own collection, not an embedded array on WearableData.
const wearableScoreSampleSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  meta: {
    deviceType: { type: String, required: true },
    category: { type: String, required: true }, // 'recovery' | 'strain' | 'sleep' | ...
    provider: String
  },
  // Open Wearables' own health_score row id — time-series collections can't
  // carry a unique secondary index, so dedup is an app-level .exists() check
  // against this field (see applyScores in wearableIngestService.js).
  externalId: { type: String, required: true },
  timestamp: { type: Date, required: true },
  value: Number,
  qualifier: String,
  components: mongoose.Schema.Types.Mixed
}, {
  timeseries: { timeField: 'timestamp', metaField: 'meta', granularity: 'hours' },
  expireAfterSeconds: 400 * 24 * 60 * 60 // ~13 months — scores are low-volume, worth keeping longer than raw samples
});

wearableScoreSampleSchema.index({ user: 1, timestamp: -1 });
wearableScoreSampleSchema.index({ user: 1, externalId: 1 });
// Logical-identity lookup for applyScores' dedup/replace logic — see that
// function's comment for why externalId alone isn't a stable identity
// (Open Wearables regenerates it on every sleep-score recompute; recorded_at
// does not change, confirmed from Open Wearables' own source). Not a unique
// index — time-series collections can't carry one; dedup stays app-level.
wearableScoreSampleSchema.index({ user: 1, 'meta.deviceType': 1, 'meta.category': 1, timestamp: 1 });

module.exports = mongoose.model('WearableScoreSample', wearableScoreSampleSchema);
