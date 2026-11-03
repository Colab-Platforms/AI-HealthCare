const mongoose = require('mongoose');

// The one, permanent insight per user, per day, per pillar — written by the
// 23:59 IST job from that day's complete data, so any past date can be looked
// up later. Kept apart from DailyInsight on purpose: that collection is the
// live home-screen card (rewritten during the day, 40-day TTL); this one is
// write-once history with no TTL, and nothing that refreshes the live card
// can ever touch it.
const FINAL_INSIGHT_TYPES = ['overall', 'sleep', 'fitness', 'nutrition', 'recovery'];

const finalDailyInsightSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // 'YYYY-MM-DD' IST — the day described

  // 'fitness' = activity, matching DailyInsight and the app's existing value.
  insightType: { type: String, enum: FINAL_INSIGHT_TYPES, required: true },

  title: { type: String, required: true },
  description: { type: String, required: true },
  summary: { type: String, required: true },

  // The labels the text was written from (no numbers ever reach the model).
  categories: { type: mongoose.Schema.Types.Mixed, default: {} },
  // That day's raw numbers — never shown, kept for support and future trends.
  dataSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },

  promptVersion: { type: Number },
  model: { type: String },
  // scheduled = nightly job, on_demand = generated when a missing day was requested.
  source: { type: String, enum: ['scheduled', 'on_demand'], default: 'scheduled' },
}, { timestamps: true });

// One final per user/day/type — a retried or duplicated job can never add a second.
finalDailyInsightSchema.index({ userId: 1, date: 1, insightType: 1 }, { unique: true });
finalDailyInsightSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('FinalDailyInsight', finalDailyInsightSchema);
module.exports.FINAL_INSIGHT_TYPES = FINAL_INSIGHT_TYPES;
