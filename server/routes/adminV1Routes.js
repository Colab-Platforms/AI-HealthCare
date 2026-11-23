const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');
const { enforce } = require('../middleware/rbac');
const ApprovalRequest = require('../models/ApprovalRequest');
const AdminAuditLog = require('../models/AdminAuditLog');
const engine = require('../services/approvalEngine');
const { MATRIX } = require('../config/permissions');
const analytics = require('../controllers/adminAnalyticsController');

// Shared by Admin, Take Admin and Super Admin panels. Role checks run here, on the server.
router.use(protect, authorize('admin', 'takeadmin', 'superadmin'));

const wrap = (fn) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// What the signed-in role may do; the frontend uses this to build navigation only.
router.get('/me/permissions', (req, res) => {
  const out = {};
  Object.entries(MATRIX).forEach(([m, roles]) => {
    if (roles[req.user.role]) out[m] = roles[req.user.role];
  });
  res.json({ role: req.user.role, permissions: out });
});

// ---- Approval requests -------------------------------------------------
router.post('/requests', enforce('approvals', 'CREATE'), wrap((req) => {
  const { module, recordId, action, newValue, reason, priority } = req.body;
  return engine.submit(req.user, { module, recordId, action, newValue, reason, priority, httpReq: req });
}));

router.get('/requests', enforce('approvals', 'VIEW'), wrap(async (req) => {
  const q = {};
  if (req.user.role !== 'superadmin') q.requesterId = req.user._id; // non-approvers see only their own
  if (req.query.status) q.status = req.query.status;
  if (req.query.module) q.module = req.query.module;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const [items, total] = await Promise.all([
    ApprovalRequest.find(q).sort({ submittedAt: -1 }).skip((page - 1) * limit).limit(limit)
      .populate('requesterId', 'name role').lean(),
    ApprovalRequest.countDocuments(q),
  ]);
  return { items, total, page, limit };
}));

router.get('/requests/:id', enforce('approvals', 'VIEW'), wrap(async (req) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw Object.assign(new Error('Invalid id'), { status: 400 });
  const doc = await ApprovalRequest.findById(req.params.id).populate('requesterId', 'name role').lean();
  if (!doc) throw Object.assign(new Error('Request not found'), { status: 404 });
  const ownerId = String(doc.requesterId?._id || doc.requesterId);
  if (req.user.role !== 'superadmin' && ownerId !== String(req.user._id)) {
    throw Object.assign(new Error('Not your request'), { status: 403 });
  }
  return doc;
}));

router.post('/requests/:id/cancel', enforce('approvals', 'CREATE'), wrap((req) => engine.cancel(req.user, req.params.id, req)));
router.post('/requests/:id/approve', enforce('approvals', 'APPROVE'), wrap((req) => engine.approve(req.user, req.params.id, req.body.comment, req)));
router.post('/requests/:id/reject', enforce('approvals', 'APPROVE'), wrap((req) => engine.reject(req.user, req.params.id, req.body.comment, req)));
router.post('/requests/:id/request-changes', enforce('approvals', 'APPROVE'), wrap((req) => engine.requestChanges(req.user, req.params.id, req.body.comment, req)));

// ---- Analytics (group totals only; groups under 10 users are hidden) -----
router.get('/analytics/platform', enforce('user_analytics', 'VIEW'), analytics.platform);
router.get('/analytics/retention', enforce('user_analytics', 'VIEW'), analytics.retention);
router.get('/analytics/features', enforce('user_analytics', 'VIEW'), analytics.features);
router.get('/analytics/regional', enforce('regional', 'VIEW'), analytics.regional);
router.get('/analytics/behaviour', enforce('user_analytics', 'VIEW'), analytics.behaviour);

// ---- Audit log (read-only; there is deliberately no write/delete route) --
router.get('/audit-logs', enforce('audit_logs', 'VIEW'), wrap(async (req) => {
  const q = {};
  if (req.user.role !== 'superadmin') q.actorId = req.user._id; // own activity only
  ['module', 'action', 'actorRole', 'result'].forEach((k) => { if (req.query[k]) q[k] = req.query[k]; });
  if (req.query.from || req.query.to) {
    q.at = {};
    if (req.query.from) q.at.$gte = new Date(req.query.from);
    if (req.query.to) q.at.$lte = new Date(req.query.to);
  }
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const [items, total] = await Promise.all([
    AdminAuditLog.find(q).sort({ at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AdminAuditLog.countDocuments(q),
  ]);
  return { items, total, page, limit };
}));

module.exports = router;
