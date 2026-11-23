const mongoose = require('mongoose');

/**
 * Append-only audit trail for every admin-level action (views, requests,
 * decisions, executions, exports, blocked attempts). Updates and deletes are
 * rejected at the model layer so nothing can edit history through the app.
 */
const schema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  actorRole: String,
  action: { type: String, required: true, index: true },
  module: { type: String, index: true },
  recordId: String,
  oldValue: mongoose.Schema.Types.Mixed,
  newValue: mongoose.Schema.Types.Mixed,
  reason: String,
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalRequest', index: true },
  approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  result: { type: String, enum: ['success', 'failed', 'blocked', 'pending'], default: 'success' },
  ip: String,
  device: String,
  at: { type: Date, default: Date.now, index: true },
}, { versionKey: false });

const blocked = function (next) {
  next(new Error('AdminAuditLog is append-only'));
};
['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace', 'replaceOne',
  'deleteOne', 'deleteMany', 'findOneAndDelete'].forEach((op) => schema.pre(op, blocked));
schema.pre('save', function (next) {
  if (!this.isNew) return next(new Error('AdminAuditLog is append-only'));
  next();
});

module.exports = mongoose.models.AdminAuditLog || mongoose.model('AdminAuditLog', schema);
