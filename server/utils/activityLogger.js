const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

// Actions always logged regardless of analytics setting (security/audit trail)
const ALWAYS_LOG = new Set([
  'LOGIN', 'LOGOUT', 'REGISTER',
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
