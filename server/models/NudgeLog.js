const mongoose = require('mongoose');

const nudgeLogSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reportId:  { type: mongoose.Schema.Types.ObjectId, ref: 'HealthReport', index: true },
  type:      { type: String, enum: ['followup_3d', 'score_drop', 'inactivity_7d'], required: true },
  title:     String,
  body:      String,
  // What this nudge is "for": the reportId for report-based nudges, an ISO week
  // (e.g. "2026-W43") for inactivity_7d, which has no report. Together with
  // (userId, type) it is the dedupe identity, so the DB itself guarantees at
  // most one nudge per user per report / per week.
  periodKey: String,
  sentAt:    { type: Date, default: Date.now, index: true },
  delivered: { type: Boolean, default: false },
}, { timestamps: false });

// Dedupe identity. Partial so old rows without periodKey don't collide as null.
//
// The previous unique index on (userId, reportId, type) is NOT declared here any
// more: inactivity_7d has no reportId, so it allowed exactly one inactivity
// nudge per user, ever. It must be dropped from existing databases —
//   db.nudgelogs.dropIndex('userId_1_reportId_1_type_1')
nudgeLogSchema.index(
  { userId: 1, type: 1, periodKey: 1 },
  { unique: true, partialFilterExpression: { periodKey: { $type: 'string' } } }
);
// For checking last nudge per user
nudgeLogSchema.index({ userId: 1, sentAt: -1 });

module.exports = mongoose.model('NudgeLog', nudgeLogSchema);
