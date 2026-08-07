const mongoose = require('mongoose');

// Versioned weights/thresholds for the Health Score engine.
// Only one document should have isActive:true at a time — the engine always
// reads the active config, so product can retune weights via DB update
// (or an admin endpoint later) without a code release. Every computed score
// stores which config version produced it (see DailyHealthScore/User.healthScore),
// so historical scores stay explainable even after weights change.
const healthScoreConfigSchema = new mongoose.Schema({
  version: { type: Number, required: true, unique: true },
  isActive: { type: Boolean, default: false },

  dailyWeights: {
    sleep: { type: Number, default: 0.25 },
    nutrition: { type: Number, default: 0.20 },
    activity: { type: Number, default: 0.20 },
    cleanHabits: { type: Number, default: 0.15 },
    hydration: { type: Number, default: 0.10 },
    consistency: { type: Number, default: 0.10 },
  },

  longTermWeights: {
    clinical: { type: Number, default: 0.35 },
    lifestyle: { type: Number, default: 0.30 },
    consistency: { type: Number, default: 0.20 },
    trend: { type: Number, default: 0.15 },
  },

  // Minimum days of history required before a component is included —
  // below this, it's excluded and remaining weights are rescaled (avoids a
  // noisy 1-2 data-point trend/consistency masquerading as a stable number).
  minHistoryDays: {
    trend: { type: Number, default: 7 },
    consistency: { type: Number, default: 5 },
  },

  // EWMA population-to-personal blend half-life, per metric (see docs/health-score-formulas.md)
  personalBaselineTau: {
    sleep: { type: Number, default: 10 },
    steps: { type: Number, default: 10 },
    hydration: { type: Number, default: 10 },
    labMarker: { type: Number, default: 3 }, // measured in report count, not days
  },

  riskAdjustment: {
    floor: { type: Number, default: 0.6 }, // score can never be derated below this fraction
    severityWeights: {
      mild: { type: Number, default: 0.05 },
      moderate: { type: Number, default: 0.15 },
      severe: { type: Number, default: 0.3 },
    },
  },

  bloodPressureCategories: {
    // Ordered worst-to-best is not required; scorer picks by threshold match.
    // "worse of systolic/diastolic category wins" — see healthScoreService.js
    type: [{
      name: String,
      maxSystolic: Number,
      maxDiastolic: Number,
      score: Number,
    }],
    default: [
      { name: 'normal', maxSystolic: 119, maxDiastolic: 79, score: 100 },
      { name: 'elevated', maxSystolic: 129, maxDiastolic: 79, score: 85 },
      { name: 'stage1', maxSystolic: 139, maxDiastolic: 89, score: 60 },
      { name: 'stage2', maxSystolic: 179, maxDiastolic: 119, score: 35 },
      { name: 'crisis', maxSystolic: Infinity, maxDiastolic: Infinity, score: 10 },
    ],
  },
}, { timestamps: true });

module.exports = mongoose.model('HealthScoreConfig', healthScoreConfigSchema);
