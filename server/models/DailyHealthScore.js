const mongoose = require('mongoose');

// One document per user per calendar day. Recomputed whenever a log affecting
// it changes; stored (not just cached) so the Overall score's Today,
// Consistency, and Trend components can query a real rolling window instead
// of recomputing every day's score from scratch on every request.
const dailyHealthScoreSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // 'YYYY-MM-DD', UTC — matches dashboard's date-key convention

  finalScore: { type: Number, required: true, min: 0, max: 100 },

  // Per-component breakdown — powers the "why did my score move" explainability panel.
  // A component is absent (not zero) when there was no data for it that day.
  components: {
    sleep: Number,
    nutrition: Number,
    activity: Number,
    smoking: Number,
    alcohol: Number,
    hydration: Number,
    recovery: Number, // HRV+RHR+RR physiology sub-score only — see dailyHealthScoreService.js
  },
  // Since config v2 only sleep/nutrition/activity/recovery are weighted.
  // hydration (now part of nutrition), smoking and alcohol stay in
  // `components` as display-only 0-100 sub-scores for the breakdown UI.

  // v2 scoring trace — how finalScore was produced.
  baseScore: Number, // 4-pillar weighted score before penalties
  penalties: {
    smoking: Number, // points subtracted (0-25)
    alcohol: Number,
  },
  missingComponents: [String], // applicable pillars not logged — scored as 0
  notApplicableComponents: [String], // pillars excluded for this user (weights renormalised)

  configVersion: { type: Number, required: true }, // traces this score to the weights that produced it
}, { timestamps: true });

dailyHealthScoreSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyHealthScore', dailyHealthScoreSchema);
