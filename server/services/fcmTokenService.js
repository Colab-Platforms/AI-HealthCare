const FCMToken = require('../models/FCMToken');
const User = require('../models/User');

// The single write path into the FCMToken collection. Every sender in
// fcmService reads ONLY from this collection, so any endpoint that records a
// device token must go through here — a route that only wrote User.fcmToken
// (POST /users/fcm-token used to) produced a token no push was ever sent to.

const PLATFORMS = new Set(['web', 'android', 'ios']);
const MIN_TOKEN_LENGTH = 20;
const MAX_TOKEN_LENGTH = 4096;
const MAX_LABEL_LENGTH = 100;

// Returns the trimmed token, or null if it isn't a plausible FCM token. Rejects
// non-strings outright so an object body ({ $ne: null }) can never reach a query.
const normalizeToken = (raw) => {
  if (typeof raw !== 'string') return null;
  const token = raw.trim();
  return token.length >= MIN_TOKEN_LENGTH && token.length <= MAX_TOKEN_LENGTH ? token : null;
};

// findOneAndUpdate skips schema validators, so the enum is enforced here.
const normalizePlatform = (platform, fallback = 'web') => (PLATFORMS.has(platform) ? platform : fallback);

const normalizeLabel = (label) =>
  typeof label === 'string' && label.trim() ? label.trim().slice(0, MAX_LABEL_LENGTH) : 'Unknown Device';

// Upsert by token: a token that already exists (same device, new login, or a
// shared device switching users) is re-pointed at this user and reactivated
// instead of creating a duplicate row.
const upsertToken = async (userId, rawToken, { platform, deviceLabel, defaultPlatform = 'web' } = {}) => {
  const token = normalizeToken(rawToken);
  if (!token) return null;

  await FCMToken.findOneAndUpdate(
    { token },
    {
      userId,
      platform: normalizePlatform(platform, defaultPlatform),
      deviceLabel: normalizeLabel(deviceLabel),
      isActive: true,
      lastUsedAt: new Date(),
    },
    { upsert: true, new: true }
  );
  return token;
};

// Stop pushes to this device. Scoped to `userId` when given (the deregister
// endpoint); logout passes none because the token alone identifies the device.
const deactivateToken = async (rawToken, userId) => {
  const token = normalizeToken(rawToken);
  if (!token) return false;

  const filter = userId ? { token, userId } : { token };
  await FCMToken.updateMany(filter, { isActive: false });
  return true;
};

// Keeps the legacy single-token field on User in step. Best-effort — nothing
// reads it for delivery anymore, only the profile response.
const syncLegacyField = (userId, token) =>
  User.updateOne({ _id: userId }, { fcmToken: token })
    .catch((e) => console.error('User.fcmToken sync failed:', e.message));

const clearLegacyField = (userId, token) =>
  User.updateOne({ _id: userId, fcmToken: token }, { fcmToken: null })
    .catch((e) => console.error('User.fcmToken clear failed:', e.message));

module.exports = { normalizeToken, upsertToken, deactivateToken, syncLegacyField, clearLegacyField };
