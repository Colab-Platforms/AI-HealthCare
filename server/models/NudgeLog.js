const mongoose = require('mongoose');

const nudgeLogSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reportId:  { type: mongoose.Schema.Types.ObjectId, ref: 'HealthReport', index: true },
  type:      { type: String, enum: ['followup_3d', 'score_drop', 'inactivity_7d'], required: true },
  title:     String,
  body:      String,
  sentAt:    { type: Date, default: Date.now, index: true },
  delivered: { type: Boolean, default: false },
}, { timestamps: false });

// Prevent duplicate nudge same type same report same user
nudgeLogSchema.index({ userId: 1, reportId: 1, type: 1 }, { unique: true, sparse: true });
// For checking last nudge per user
nudgeLogSchema.index({ userId: 1, sentAt: -1 });

module.exports = mongoose.model('NudgeLog', nudgeLogSchema);
