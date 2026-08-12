const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

// Actions always logged regardless of analytics setting (security/audit trail)
// NOTE: these must match the action strings callers actually pass. This set used
// to say LOGIN/LOGOUT/REGISTER while every call site passes USER_LOGIN/
// USER_LOGOUT/USER_REGISTER, so the security-critical actions fell through to the
// opt-out branch below — costing an extra User lookup per login, and letting a
// user with analytics disabled silently disable their own auth audit trail.
const ALWAYS_LOG = new Set([
  'USER_LOGIN', 'USER_LOGOUT', 'USER_REGISTER', 'PASSWORD_CHANGED',
  'DELETE_ACCOUNT', 'EXPORT_DATA',
  'UPLOAD_REPORT', 'DELETE_REPORT',
  'UPLOAD_MEDICAL_DOCUMENT', 'DELETE_MEDICAL_DOCUMENT',
]);

const logActivity = async (userId, action, category, metadata = {}, req = null) => {
  try {
    // Respect user's analytics preference — skip non-essential logs if disabled
    if (!ALWAYS_LOG.has(action)) {
      const user = await User.findById(userId).select('privacySettings').lean();
      if (user && user.privacySettings?.analyticsEnabled === false) return;
    }

    const logData = { user: userId, action, category, metadata, timestamp: new Date() };
    if (req) {
      logData.ipAddress = req.ip || req.headers['x-forwarded-for'];
      logData.userAgent = req.headers['user-agent'];
    }
    await ActivityLog.create(logData);
  } catch (error) {
    console.error('Failed to log activity:', error.message);
  }
};

module.exports = { logActivity };
