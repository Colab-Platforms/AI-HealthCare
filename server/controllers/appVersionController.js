const { reportAppVersion } = require('../services/appUpdateNotificationService');
const AppVersionConfig = require('../models/AppVersionConfig');

// @desc    App reports its own running version on launch and gets back the
//          version-gate it should enforce client-side: minBuild (below this,
//          hard-block with a force-update screen), latestBuild (what's
//          current — anything in [minBuild, latestBuild) can show a
//          dismissible "update available" nudge instead), plus the message
//          and store link to show in that dialog. The app owns the actual
//          gating decision; this endpoint only hands it the numbers.
//
//          Reporting the device's own version/buildNumber still feeds the
//          separate organic push-notification broadcast in
//          appUpdateNotificationService (unrelated to the gate fields below —
//          that system notifies users who haven't opened the app in a while;
//          this response is what every app-open checks for itself).
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

    const [, config] = await Promise.all([
      reportAppVersion(platform, version, build, { excludeUserId }),
      AppVersionConfig.findOne({ platform }).select('minBuild latestBuild message storeUrl').lean(),
    ]);

    res.json({
      success: true,
      minBuild: config?.minBuild ?? 1,
      latestBuild: config?.latestBuild ?? 1,
      message: config?.message ?? 'A new version of Take Health is available. Please update the app.',
      storeUrl: config?.storeUrl ?? '',
    });
  } catch (error) {
    console.error('reportVersion error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to report app version' });
  }
};
