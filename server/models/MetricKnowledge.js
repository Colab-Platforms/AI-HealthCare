const mongoose = require('mongoose');

/**
 * Report-independent "textbook" facts about a lab marker.
 *
 * whatIsThis / whatItDoes / lowHighImpact / topFoods / symptoms describe the
 * marker itself ("what does Hemoglobin do"), not any one patient's result, so
 * they are identical for every user. Generating them inside every report
 * analysis made up ~75% of the AI output tokens (and therefore latency). They
 * are generated once per marker, stored here, and merged into each report.
 *
 * `key` is the lowercased canonical metric name (see services/metricKnowledgeService
 * knowledgeKey), so "Hb" / "HGB" / "Haemoglobin" all resolve to one row.
 *
 * To correct a bad explanation: edit or delete the row, then clear the
 * `metricKnowledge:v1:<key>` cache entry. A deleted row is regenerated the next
 * time that marker appears in a report.
 */
const metricKnowledgeSchema = new mongoose.Schema({
  key:         { type: String, required: true, unique: true, trim: true },
  displayName: { type: String, required: true, trim: true },
  whatIsThis:  { type: String, required: true },
  whatItDoes:  { type: String, required: true },
  lowHighImpact: { type: String, required: true },
  topFoods:    { type: [String], default: [] },
  symptoms:    { type: [String], default: [] },
  source:      { type: String, enum: ['ai', 'seed', 'manual'], default: 'ai' },
  model:       { type: String, default: null },
  version:     { type: Number, default: 1 },
}, { timestamps: true });

module.exports = mongoose.model('MetricKnowledge', metricKnowledgeSchema);
