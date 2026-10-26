// Detects a new app release and notifies every user on that platform —
// triggered by the app itself reporting its running version on launch (not
// an admin action). See docs discussion: the app already knows its own
// version/buildNumber (Flutter's package_info_plus), so the first device to
// report a build newer than what we've seen is effectively the live signal
// that a new store release has gone out.
const AppVersionConfig = require('../models/AppVersionConfig');
const User = require('../models/User');
const FCMToken = require('../models/FCMToken');
const Notification = require('../models/Notification');
const { sendToUsersBulk } = require('./fcmService');

const INSERT_CHUNK = 500;
const CHUNK_CONCURRENCY = 5;

// Compares the reported build against the stored one and, if it's newer,
// atomically claims the update via compare-and-swap before fanning out —
// without the CAS step, two users reporting the same new build within
// milliseconds of each other would both see "newer" and both trigger a full
// notify-everyone broadcast, double-pushing every user on the platform.
async function reportAppVersion(platform, version, buildNumber, { excludeUserId } = {}) {
  const config = await AppVersionConfig.findOne({ platform });

  if (!config) {
    // First report ever for this platform — nothing to compare against, and
    // no prior users to notify about an "update" from a version that never
    // existed in our records. Just establish the baseline.
    await AppVersionConfig.create({ platform, version, buildNumber });
    return { isNewVersion: false };
  }

  if (buildNumber <= config.buildNumber) {
    return { isNewVersion: false }; // the normal case — most reports land here
  }

  // CAS: only succeeds if buildNumber in the DB is still what we just read.
  // If another concurrent request already won the race and updated it, this
  // filter no longer matches and findOneAndUpdate returns null — this call
  // loses cleanly instead of double-notifying.
  const claimed = await AppVersionConfig.findOneAndUpdate(
    { platform, buildNumber: config.buildNumber },
    { $set: { buildNumber, version } },
    { new: true }
  );
  if (!claimed) return { isNewVersion: false };

  notifyAllUsers(platform, version, excludeUserId).catch((e) =>
    console.error('[AppUpdate] notifyAllUsers failed:', e.message)
  );

  return { isNewVersion: true };
}

// Fans out an in-app Notification + push to every active user who has a
// token on this platform — same chunked-insert + bounded-concurrency pattern
// notificationService.js's nightly tick already uses at 6,000+ user scale,
// reused here rather than reimplemented.
async function notifyAllUsers(platform, version, excludeUserId) {
  const userIds = await FCMToken.distinct('userId', { platform, isActive: true });
  const targetIds = excludeUserId
    ? userIds.filter((id) => id.toString() !== excludeUserId.toString())
    : userIds;

  if (targetIds.length === 0) return;

  const activeIds = await User.find({ _id: { $in: targetIds }, isActive: true }).distinct('_id');

  const docs = activeIds.map((userId) => ({
    userId,
    type: 'app_update',
    title: 'New update available',
    message: `Version ${version} is here — update now for the latest features and fixes.`,
    priority: 'low',
  }));

  const chunks = [];
  for (let i = 0; i < docs.length; i += INSERT_CHUNK) {
    chunks.push(docs.slice(i, i + INSERT_CHUNK));
  }

  for (let i = 0; i < chunks.length; i += CHUNK_CONCURRENCY) {
    const wave = chunks.slice(i, i + CHUNK_CONCURRENCY);
    await Promise.allSettled(wave.map(async (chunk) => {
      try {
        const inserted = await Notification.insertMany(chunk, { ordered: false });
        const entries = inserted.map((n) => ({
          userId: n.userId,
          payload: { title: n.title, body: n.message, data: { type: 'app_update', version } },
        }));
        await sendToUsersBulk(entries);
      } catch (error) {
        console.error('[AppUpdate] notify chunk failed:', error.message);
      }
    }));
  }

  console.log(`[AppUpdate] Notified ${docs.length} users about ${platform} v${version}`);
}

module.exports = { reportAppVersion };
