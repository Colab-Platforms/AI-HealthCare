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
    respiratoryRate: Number,
    spo2: Number,
    skinTemperature: Number,
    sleepContribution: Number,
    strainContribution: Number, // prior day's activity/exercise load
  },

  deviceType: String, // primary device the inputs were sourced from, when known

  // --- Phase 1 additions (recoveryScoreService's z-score/T-score rewrite) ---
  // Purely additive: recoveryScore/components above are unchanged, so any
  // client reading only those two fields keeps working exactly as before.
  // Newer clients can also read these for the fuller breakdown.
  confidence: {
    type: String,
    // 'population_reference': a real score IS shown, but computed against
    // published population norms (see recoveryScoreService's
    // POPULATION_REFERENCE) because the user has no personal history yet —
    // distinct from 'insufficient_baseline', which means no score at all.
    enum: ['population_reference', 'insufficient_baseline', 'low', 'moderate', 'good', 'high']
  },
  // 4-tier band matching Oura's published Readiness thresholds (85+/70-84/
  // 50-69/<50) — see recoveryScoreService.js's classifyRecoveryBand.
  band: {
    key: { type: String, enum: ['optimal', 'moderate', 'low', 'very_low'] },
    label: String,
    _id: false
  },
  // Independent of recoveryScore — fixed clinical reference-range flags
  // (see recoveryScoreService.js's SAFETY_FLOOR) that can fire even when the
  // personal-baseline score itself looks fine.
  warnings: [{
    code: String,
    message: String,
    _id: false
  }],
  // Full per-metric detail (today/baseline14/baseline90/z-scores) behind the
  // rounded numbers in `components` — powers an "explain this score" UI
  // without recomputing anything client-side.
  metricDetails: mongoose.Schema.Types.Mixed,

  // Rule-based (not AI) recommendation snapshot from recoveryRecommendationService —
  // stored so history/analytics can show what was recommended on a past day.
  recommendation: mongoose.Schema.Types.Mixed,

  // 'stable' | 'depressed_recent_baseline' — see recoveryScoreService.js's
  // computeBaselineDrift(). Independent status flag; when 'depressed', the
  // (placeholder) Recovery Ceiling may also have capped recoveryScore.
  baselineStatus: {
    type: String,
    enum: ['stable', 'depressed_recent_baseline']
  }
}, { timestamps: true });

recoveryDailySummarySchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('RecoveryDailySummary', recoveryDailySummarySchema);
