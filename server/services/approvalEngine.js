const crypto = require('crypto');
const mongoose = require('mongoose');
const ApprovalRequest = require('../models/ApprovalRequest');
const User = require('../models/User');
const QuickFoodCheck = require('../models/QuickFoodCheck');
const { can, isHighRisk } = require('../config/permissions');
const { logAudit } = require('./auditService');

const fingerprint = (snap) =>
  crypto.createHash('sha1').update(JSON.stringify(snap ?? null)).digest('hex');

const PROFILE_FIELDS = ['age', 'gender', 'dietaryPreference', 'height', 'weight', 'allergies'];

/**
 * Each module registers how to (a) snapshot the live record and (b) apply an
 * approved change. The engine knows nothing module-specific, so adding a new
 * approvable module is one entry here.
 */
const HANDLERS = {
  health_profiles: {
    snapshot: async (id) => {
      const u = await User.findById(id).select('profile').lean();
      if (!u) return null;
      const out = {};
      PROFILE_FIELDS.forEach((f) => { out[f] = u.profile?.[f]; });
      return out;
    },
    apply: async (req) => {
      if (req.action !== 'edit') throw new Error('Unsupported action for health_profiles');
      const set = {};
      Object.keys(req.newValue || {}).forEach((k) => {
        if (!PROFILE_FIELDS.includes(k)) throw new Error('Field not editable via approval: ' + k);
        set['profile.' + k] = req.newValue[k];
      });
      const r = await User.updateOne({ _id: req.recordId }, { $set: set }, { runValidators: true });
      if (!r.matchedCount) throw new Error('User not found');
    },
  },
  users: {
    snapshot: async (id) => User.findById(id).select('isActive role').lean(),
    apply: async (req) => {
      const u = await User.findById(req.recordId).select('role');
      if (!u) throw new Error('User not found');
      if (['admin', 'superadmin', 'takeadmin'].includes(u.role)) {
        throw new Error('Admin accounts cannot be changed through user requests');
      }
      if (req.action === 'edit') {
        if (typeof req.newValue?.isActive !== 'boolean') throw new Error('Only isActive can be changed');
        await User.updateOne({ _id: req.recordId }, { $set: { isActive: req.newValue.isActive } });
      } else {
        throw new Error('Permanent deletion must use the dedicated deletion flow');
      }
    },
  },
  food_database: {
    snapshot: async (id) => (id ? QuickFoodCheck.findById(id).lean() : null),
    apply: async (req) => {
      if (req.action === 'create') {
        await QuickFoodCheck.create({ ...req.newValue, userId: req.requesterId });
      } else if (req.action === 'edit') {
        const r = await QuickFoodCheck.updateOne({ _id: req.recordId }, { $set: req.newValue });
        if (!r.matchedCount) throw new Error('Food item not found');
      } else if (req.action === 'delete') {
        await QuickFoodCheck.deleteOne({ _id: req.recordId });
      } else {
        throw new Error('Unsupported action');
      }
    },
  },
};

const push = (doc, to, by, comment) => {
  doc.history.push({ fromStatus: doc.status, toStatus: to, by: by._id, byRole: by.role, comment });
  doc.status = to;
};

const httpError = (status, message) => Object.assign(new Error(message), { status });

exports.HANDLERS = HANDLERS;

exports.submit = async (user, { module, recordId, action, newValue, reason, priority, httpReq }) => {
  if (!can(user.role, module, 'REQUEST') && !can(user.role, module, 'CREATE')) {
    throw httpError(403, 'Role cannot raise requests for ' + module);
  }
  const h = HANDLERS[module];
  if (!h) throw httpError(400, 'Module not approvable: ' + module);
  if (!reason || String(reason).trim().length < 10) throw httpError(400, 'Reason must be at least 10 characters');
  if (action !== 'create' && !mongoose.isValidObjectId(recordId)) throw httpError(400, 'Valid recordId required');

  const oldValue = action === 'create' ? null : await h.snapshot(recordId);
  if (action !== 'create' && oldValue == null) throw httpError(404, 'Record not found');

  const highRisk = isHighRisk(module, action);
  const doc = await ApprovalRequest.create({
    requesterId: user._id,            // always from the session, never the body
    requesterRole: user.role,
    module, recordId, action, oldValue, newValue,
    recordVersion: fingerprint(oldValue),
    reason: String(reason).trim(),
    priority: highRisk ? 'high' : (priority || 'normal'),
    highRisk,
    history: [{ fromStatus: null, toStatus: 'pending_approval', by: user._id, byRole: user.role, comment: 'Submitted' }],
  });
  await logAudit(httpReq, { action: 'request:' + action, module, recordId: String(recordId || ''), oldValue, newValue, reason, requestId: doc._id, result: 'pending' });
  return doc;
};

exports.cancel = async (user, id, httpReq) => {
  const doc = await ApprovalRequest.findById(id);
  if (!doc) throw httpError(404, 'Request not found');
  if (String(doc.requesterId) !== String(user._id)) throw httpError(403, 'Only the requester can cancel');
  if (!['pending_approval', 'changes_requested', 'draft'].includes(doc.status)) throw httpError(409, 'Request can no longer be cancelled');
  push(doc, 'cancelled', user, 'Cancelled by requester');
  await doc.save();
  await logAudit(httpReq, { action: 'cancel', module: doc.module, requestId: doc._id });
  return doc;
};

exports.reject = async (user, id, comment, httpReq) => {
  if (!can(user.role, 'approvals', 'APPROVE')) throw httpError(403, 'Not an approver');
  if (!comment || !String(comment).trim()) throw httpError(400, 'Rejection requires a reason');
  const doc = await ApprovalRequest.findById(id);
  if (!doc) throw httpError(404, 'Request not found');
  if (String(doc.requesterId) === String(user._id)) throw httpError(403, 'Cannot decide your own request');
  if (!['pending_approval', 'under_review'].includes(doc.status)) throw httpError(409, 'Request is not awaiting a decision');
  doc.decision = 'rejected'; doc.decisionReason = comment; doc.decidedBy = user._id; doc.decidedAt = new Date();
  push(doc, 'rejected', user, comment);
  await doc.save();
  await logAudit(httpReq, { action: 'reject', module: doc.module, requestId: doc._id, reason: comment, approverId: user._id });
  return doc;
};

exports.requestChanges = async (user, id, comment, httpReq) => {
  if (!can(user.role, 'approvals', 'APPROVE')) throw httpError(403, 'Not an approver');
  if (!comment || !String(comment).trim()) throw httpError(400, 'Please say what information is needed');
  const doc = await ApprovalRequest.findById(id);
  if (!doc) throw httpError(404, 'Request not found');
  if (String(doc.requesterId) === String(user._id)) throw httpError(403, 'Cannot decide your own request');
  if (!['pending_approval', 'under_review'].includes(doc.status)) throw httpError(409, 'Request is not awaiting a decision');
  doc.decision = 'changes_requested'; doc.decisionReason = comment;
  push(doc, 'changes_requested', user, comment);
  await doc.save();
  await logAudit(httpReq, { action: 'changes_requested', module: doc.module, requestId: doc._id, reason: comment, approverId: user._id });
  return doc;
};

/**
 * Approve + execute. Rules enforced here (not in the UI):
 *  - approver must hold APPROVE on approvals and differ from the requester
 *  - high-risk requests need a first approver AND a different second confirmer
 *  - the live record must still match the snapshot taken at submit
 *  - a failed execution is stored as execution_failed, never as executed
 */
exports.approve = async (user, id, comment, httpReq) => {
  if (!can(user.role, 'approvals', 'APPROVE')) throw httpError(403, 'Not an approver');
  const doc = await ApprovalRequest.findById(id);
  if (!doc) throw httpError(404, 'Request not found');
  if (String(doc.requesterId) === String(user._id)) throw httpError(403, 'Cannot approve your own request');
  if (!['pending_approval', 'under_review'].includes(doc.status)) throw httpError(409, 'Request is not awaiting a decision');

  if (doc.highRisk && !doc.decidedBy) {
    // First approval of a high-risk request: record it, wait for a second Super Admin.
    doc.decision = 'approved'; doc.decidedBy = user._id; doc.decidedAt = new Date(); doc.decisionReason = comment;
    push(doc, 'under_review', user, 'First approval; awaiting second Super Admin confirmation');
    await doc.save();
    await logAudit(httpReq, { action: 'approve:first', module: doc.module, requestId: doc._id, approverId: user._id, result: 'pending' });
    return doc;
  }
  if (doc.highRisk) {
    if (String(doc.decidedBy) === String(user._id)) throw httpError(403, 'A different Super Admin must confirm high-risk actions');
    doc.confirmedBy = user._id; doc.confirmedAt = new Date();
  } else {
    doc.decision = 'approved'; doc.decidedBy = user._id; doc.decidedAt = new Date(); doc.decisionReason = comment;
  }
  push(doc, 'approved', user, comment || 'Approved');

  const h = HANDLERS[doc.module];
  try {
    if (!h) throw new Error('No executor for module ' + doc.module);
    if (doc.action !== 'create') {
      const live = await h.snapshot(doc.recordId);
      if (fingerprint(live) !== doc.recordVersion) {
        // Record moved since submit: send back for a fresh review instead of overwriting.
        doc.decision = undefined; doc.decidedBy = undefined; doc.confirmedBy = undefined;
        push(doc, 'changes_requested', user, 'Record changed after submission; resubmit for fresh review');
        await doc.save();
        await logAudit(httpReq, { action: 'approve:stale', module: doc.module, requestId: doc._id, result: 'failed' });
        throw httpError(409, 'Record changed since the request was made; it was sent back for a fresh review');
      }
    }
    await h.apply(doc);
    doc.executionStatus = 'success'; doc.executedAt = new Date();
    push(doc, 'executed', { _id: null, role: 'system' }, 'Executed');
    await doc.save();
    await logAudit(httpReq, {
      action: 'execute', module: doc.module, recordId: String(doc.recordId || ''),
      oldValue: doc.oldValue, newValue: doc.newValue, reason: doc.reason,
      requestId: doc._id, approverId: user._id, result: 'success',
    });
    return doc;
  } catch (err) {
    if (err.status) throw err;
    doc.executionStatus = 'failed'; doc.executionError = err.message;
    push(doc, 'execution_failed', { _id: null, role: 'system' }, err.message);
    await doc.save();
    await logAudit(httpReq, { action: 'execute', module: doc.module, requestId: doc._id, approverId: user._id, result: 'failed', reason: err.message });
    throw httpError(500, 'Approved but execution failed: ' + err.message);
  }
};
