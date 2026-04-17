const ActivityLog = require('../models/ActivityLog');

/**
 * Logs a user activity to the database
 * @param {string} userId - ID of the user performing the action
 * @param {string} action - Descriptive name of the action (e.g., 'UPLOAD_REPORT')
 * @param {string} category - Category of action (e.g., 'diagnostics')
 * @param {Object} metadata - Additional data related to the action
 * @param {Object} req - Express request object (optional, for IP/User-Agent)
 */
const logActivity = async (userId, action, category, metadata = {}, req = null) => {
  try {
    const logData = {
      user: userId,
      action,
      category,
      metadata,
      timestamp: new Date()
    };

    if (req) {
      logData.ipAddress = req.ip || req.headers['x-forwarded-for'];
      logData.userAgent = req.headers['user-agent'];
    }

    await ActivityLog.create(logData);
  } catch (error) {
    console.error('Failed to log activity:', error.message);
    // Don't throw error to avoid breaking the main request flow
  }
};

module.exports = { logActivity };
