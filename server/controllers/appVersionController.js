const AppVersionConfig = require('../models/AppVersionConfig');

const DEFAULT_MESSAGE = 'A new version of Take Health is available. Please update the app.';
const DEFAULT_STORE_URLS = {
  android: 'https://play.google.com/store/apps/details?id=com.takehealth.app',
  ios: 'https://apps.apple.com/in/app/take-health/id6809424667',
};

const isPositiveInt = (n) => Number.isInteger(n) && n > 0;

// The gate the app compares its own build against. Never fails on missing
// data: no document (or one saved before minBuild existed) means "never
// forced" (minBuild 1) and "no optional update" (latestBuild 1).
const gateFor = (platform, config) => {
  const latestBuild = isPositiveInt(config?.latestBuild) ? config.latestBuild : 1;
  const minBuild = isPositiveInt(config?.minBuild) ? config.minBuild : 1;
  return {
    minBuild,
    latestBuild: Math.max(latestBuild, minBuild),
    message: config?.message || DEFAULT_MESSAGE,
    storeUrl: config?.storeUrl || DEFAULT_STORE_URLS[platform],
  };
};

// @desc    App sends its platform (and, optionally, its version/build) on
//          launch and gets back the version gate. The app itself compares its
//          build number with minBuild (forced update) and latestBuild
//          (optional update). Only `platform` is required; the app's own
//          version/buildNumber are informational and never make this fail.
// @route   POST /api/app-version/report
exports.reportVersion = async (req, res) => {
  try {
    const { platform } = req.body || {};
    if (!['android', 'ios'].includes(platform)) {
      return res.status(400).json({ success: false, message: 'platform must be "android" or "ios"' });
    }

    const config = await AppVersionConfig.findOne({ platform })
      .select('minBuild latestBuild message storeUrl').lean();

    res.json({ success: true, ...gateFor(platform, config) });
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
      .select('platform version minBuild latestBuild message storeUrl').lean();
    const byPlatform = { android: null, ios: null };
    docs.forEach((d) => { byPlatform[d.platform] = { ...d, minBuild: isPositiveInt(d.minBuild) ? d.minBuild : 1 }; });
    res.json({ success: true, ...byPlatform });
  } catch (error) {
    console.error('getVersionConfig error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to load app version config' });
  }
};

// @desc    Admin saves the version gate for one or both platforms. Pure config
//          write — no notification, no broadcast. minBuild is optional: when
//          left out, the saved minBuild is kept.
// @route   POST /api/admin/app-version/push
exports.pushVersionUpdate = async (req, res) => {
  try {
    const { android, ios } = req.body || {};
    if (!android && !ios) {
      return res.status(400).json({ success: false, message: 'Provide android and/or ios update details' });
    }

    // Validate everything first, so a bad iOS payload can't leave Android saved.
    const updates = {};
    for (const [platform, payload] of [['android', android], ['ios', ios]]) {
      if (!payload) continue;
      const { version, latestBuild, minBuild, message, storeUrl } = payload;
      if (!version || typeof version !== 'string') {
        return res.status(400).json({ success: false, message: `${platform}.version is required` });
      }
      const latest = Number(latestBuild);
      if (!isPositiveInt(latest)) {
        return res.status(400).json({ success: false, message: `${platform}.latestBuild must be a positive integer` });
      }
      let min;
      if (minBuild !== undefined && minBuild !== null && minBuild !== '') {
        min = Number(minBuild);
        if (!isPositiveInt(min)) {
          return res.status(400).json({ success: false, message: `${platform}.minBuild must be a positive integer` });
        }
      } else {
        const existing = await AppVersionConfig.findOne({ platform }).select('minBuild').lean();
        min = isPositiveInt(existing?.minBuild) ? existing.minBuild : 1;
      }
      if (min > latest) {
        return res.status(400).json({ success: false, message: `${platform}.minBuild (${min}) cannot be higher than latestBuild (${latest})` });
      }

      const set = { version, latestBuild: latest, minBuild: min };
      if (message) set.message = message;
      if (storeUrl) set.storeUrl = storeUrl;
      updates[platform] = set;
    }

    const results = {};
    for (const [platform, set] of Object.entries(updates)) {
      const saved = await AppVersionConfig.findOneAndUpdate(
        { platform },
        { $set: set },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).lean();
      results[platform] = { version: saved.version, ...gateFor(platform, saved) };
    }

    res.json({ success: true, updated: results });
  } catch (error) {
    console.error('pushVersionUpdate error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to push app version update' });
  }
};
