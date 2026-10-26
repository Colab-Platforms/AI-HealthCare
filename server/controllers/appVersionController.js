const { reportAppVersion } = require('../services/appUpdateNotificationService');

// @desc    App reports its own running version on launch. If it's the first
//          device to report a build newer than what we've seen for this
//          platform, this triggers a notify-everyone-else push in the
//          background (see appUpdateNotificationService for the CAS logic
//          that keeps concurrent reports from double-notifying).
// @route   POST /api/app-version/report
exports.reportVersion = async (req, res) => {
  try {
    const { platform, version, buildNumber } = req.body;

    if (!['android', 'ios'].includes(platform)) {
      return res.status(400).json({ success: false, message: 'platform must be "android" or "ios"' });
    }
    if (!version || typeof version !== 'string') {
      return res.status(400).json({ success: false, message: 'version is required' });
    }
    const build = Number(buildNumber);
    if (!Number.isInteger(build) || build <= 0) {
      return res.status(400).json({ success: false, message: 'buildNumber must be a positive integer' });
    }

    // Logged-in requests exclude the reporting user from the broadcast —
    // they're already on the new build, no need to tell them to update.
    const excludeUserId = req.user?._id;

    const result = await reportAppVersion(platform, version, build, { excludeUserId });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('reportVersion error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to report app version' });
  }
};
