const mongoose = require('mongoose');

// One document per user. Tracks a running (Welford's algorithm) mean/variance
// per metric, updated incrementally on every new data point — no need to
// replay full history to update the baseline (see docs/health-score-formulas.md
// Section 5.3, the population-to-personal EWMA blend).
const metricBaselineSchema = new mongoose.Schema({
  count: { type: Number, default: 0 },      // n — data points seen so far
  mean: { type: Number, default: 0 },        // running mean
  m2: { type: Number, default: 0 },          // Welford's sum-of-squares accumulator (for variance)
  lastValue: Number,
  lastUpdated: Date,
}, { _id: false });

const userMetricBaselineSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  metrics: {
    type: Map,
    of: metricBaselineSchema,
    default: () => ({}),
  },
}, { timestamps: true });

module.exports = mongoose.model('UserMetricBaseline', userMetricBaselineSchema);
