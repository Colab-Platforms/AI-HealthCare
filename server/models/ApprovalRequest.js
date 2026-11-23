const mongoose = require('mongoose');

const STATUSES = ['draft', 'pending_approval', 'under_review', 'changes_requested',
  'approved', 'rejected', 'executed', 'execution_failed', 'cancelled'];

const historySchema = new mongoose.Schema({
  fromStatus: String,
  toStatus: String,
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  byRole: String,
  comment: String,
  at: { type: Date, default: Date.now },
}, { _id: false });

const schema = new mongoose.Schema({
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  requesterRole: { type: String, required: true },
  module: { type: String, required: true, index: true },
  recordId: { type: String },
  action: { type: String, enum: ['create', 'edit', 'delete', 'publish'], required: true },
  oldValue: mongoose.Schema.Types.Mixed,   // snapshot taken by the server at submit
  newValue: mongoose.Schema.Types.Mixed,
  recordVersion: String,                    // fingerprint of the record at submit
  reason: { type: String, required: true, minlength: 10 },
  priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
  highRisk: { type: Boolean, default: false },
  status: { type: String, enum: STATUSES, default: 'pending_approval', index: true },
  decision: { type: String, enum: ['approved', 'rejected', 'changes_requested'] },
  decisionReason: String,
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  decidedAt: Date,
  // High-risk actions need a second, different approver.
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  confirmedAt: Date,
  executedAt: Date,
  executionStatus: { type: String, enum: ['not_run', 'success', 'failed'], default: 'not_run' },
  executionError: String,
  history: [historySchema],
}, { timestamps: { createdAt: 'submittedAt', updatedAt: 'updatedAt' } });

schema.statics.STATUSES = STATUSES;
module.exports = mongoose.models.ApprovalRequest || mongoose.model('ApprovalRequest', schema);
