const { can } = require('../config/permissions');
const { logAudit } = require('../services/auditService');

/** Backend permission gate. Blocked attempts are written to the audit log. */
exports.enforce = (module, level) => async (req, res, next) => {
  const role = req.user && req.user.role;
  if (can(role, module, level)) return next();
  await logAudit(req, { action: 'blocked:' + level, module, result: 'blocked' });
  return res.status(403).json({ message: 'Role ' + role + ' lacks ' + level + ' on ' + module });
};
