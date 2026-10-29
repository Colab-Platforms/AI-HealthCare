const AppVersionConfig = require('../models/AppVersionConfig');

// @desc    App reports its own running version on launch and gets back the
//          latest build + nudge message/store link. The app itself compares
//          its own minBuild against latestBuild and decides whether to
//          show a dismissible "update available" popup — this endpoint only
//          hands it the numbers, never triggers a push of its own, and
//          never blocks the app.
// @route   POST /api/app-version/report
exports.reportVersion = async (req, res) => {
  try {
    const { platform, version, minBuild } = req.body;

    if (!['android', 'ios'].includes(platform)) {
      return res.status(400).json({ success: false, message: 'platform must be "android" or "ios"' });
    }
    if (!version || typeof version !== 'string') {
      return res.status(400).json({ success: false, message: 'version is required' });
    }
    const build = Number(minBuild);
    if (!Number.isInteger(build) || build <= 0) {
      return res.status(400).json({ success: false, message: 'minBuild must be a positive integer' });
    }

    const config = await AppVersionConfig.findOne({ platform })
      .select('latestBuild message storeUrl').lean();

    res.json({
      success: true,
      latestBuild: config?.latestBuild ?? 1,
      message: config?.message ?? 'A new version of Take Health is available. Please update the app.',
      storeUrl: config?.storeUrl ?? '',
    });
  } catch (error) {
    console.error('reportVersion error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to report app version' });
  }
};

// @desc    Current version config for both platforms, for the admin screen
//          to prefill its form with.
// @route   GET /api/admin/app-version
exports.getVersionConfig = async (req, res) => {
  try {
    const docs = await AppVersionConfig.find({})
      .select('platform version latestBuild message storeUrl').lean();
    const byPlatform = { android: null, ios: null };
    docs.forEach((d) => { byPlatform[d.platform] = d; });
    res.json({ success: true, ...byPlatform });
  } catch (error) {
    console.error('getVersionConfig error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to load app version config' });
  }
};

// @desc    Admin pushes a new release's version-gate for one or both
//          platforms. Pure config write — no notification, no broadcast;
//          the app itself decides to show the update nudge next time it
//          calls POST /app-version/report and compares its own minBuild.
// @route   POST /api/admin/app-version/push
exports.pushVersionUpdate = async (req, res) => {
  try {
    const { android, ios } = req.body;
    if (!android && !ios) {
      return res.status(400).json({ success: false, message: 'Provide android and/or ios update details' });
    }

    const updates = { android, ios };
    const results = {};

    for (const platform of ['android', 'ios']) {
      const payload = updates[platform];
      if (!payload) continue;

      const { version, latestBuild, message, storeUrl } = payload;
      if (!version || typeof version !== 'string') {
        return res.status(400).json({ success: false, message: `${platform}.version is required` });
      }
      const build = Number(latestBuild);
      if (!Number.isInteger(build) || build <= 0) {
        return res.status(400).json({ success: false, message: `${platform}.latestBuild must be a positive integer` });
      }

      const set = { version, latestBuild: build };
      if (message) set.message = message;
      if (storeUrl) set.storeUrl = storeUrl;

      const saved = await AppVersionConfig.findOneAndUpdate(
        { platform },
        { $set: set },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      results[platform] = {
        version: saved.version, latestBuild: saved.latestBuild,
        message: saved.message, storeUrl: saved.storeUrl,
      };
    }

    res.json({ success: true, updated: results });
  } catch (error) {
    console.error('pushVersionUpdate error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to push app version update' });
  }
};
