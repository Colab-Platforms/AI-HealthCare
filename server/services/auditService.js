const AdminAuditLog = require('../models/AdminAuditLog');

/** Never throws: auditing must not break the request, but failures are logged loudly. */
exports.logAudit = async (req, entry = {}) => {
  try {
    await AdminAuditLog.create({
      actorId: req?.user?._id,
      actorRole: req?.user?.role,
      ip: req?.ip,
      device: req?.headers?.['user-agent'],
      ...entry,
    });
  } catch (err) {
    console.error('[AUDIT] failed to write audit entry:', err.message);
  }
};
