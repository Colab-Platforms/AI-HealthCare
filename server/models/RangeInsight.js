const mongoose = require('mongoose');

// Weekly/monthly counterpart to DailyInsight — a single day's insight text
// ("On Sept 23, you slept 5.8 hours...") is wrong when shown inside a 7- or
// 30-day view, so range summaries get their own genuinely aggregate-aware
// text and their own cache, keyed by the window's END date rather than a
// single day (see services/rangeInsightService.js for how the data is built).
const rangeInsightSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  range: { type: String, enum: ['weekly', 'monthly'], required: true },
  endDate: { type: String, required: true }, // 'YYYY-MM-DD' — the window's last day (matches the breakdown API's `date` param)
  startDate: { type: String, required: true },

  insightType: {
    type: String,
    enum: ['overall', 'sleep', 'nutrition', 'fitness', 'recovery', 'smoking', 'alcohol', 'hydration'],
    required: true,
  },

  title: { type: String, required: true },
  description: { type: String, required: true },
  summary: { type: String, required: true },

  dataSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
  model: { type: String },
}, { timestamps: true });

// A re-run (or a manual force-regenerate) must update, never duplicate.
rangeInsightSchema.index({ userId: 1, range: 1, endDate: 1, insightType: 1 }, { unique: true });

// Generous TTL — a monthly view can request an endDate up to ~90 days back
// (matching getHealthScore's DailyHealthScore retention window), so this
// needs to outlive that, unlike DailyInsight's tighter 40-day window.
rangeInsightSchema.index({ createdAt: 1 }, { expireAfterSeconds: 100 * 24 * 60 * 60 });

module.exports = mongoose.model('RangeInsight', rangeInsightSchema);
