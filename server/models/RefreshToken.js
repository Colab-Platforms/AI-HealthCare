const mongoose = require('mongoose');

const DAY_MS = 24 * 60 * 60 * 1000;

// Sliding session: a refresh token stays valid as long as it is used at least
// once every TTL. It used to be a fixed 7 days from login with no renewal, so
// even a daily user was logged out exactly a week after signing in.
const REFRESH_TOKEN_TTL_MS = 30 * DAY_MS;

// The app refreshes every ~15 min; extending on every call would be a DB write
// per user per 15 min for a few minutes of extra lifetime. Extend at most once
// a day instead — the window can then be short by at most this much.
const RENEW_INTERVAL_MS = DAY_MS;

const refreshTokenSchema = new mongoose.Schema({
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token:     { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    userAgent: { type: String },
    ipAddress: { type: String },
}, { timestamps: true });

// MongoDB TTL index — auto-deletes expired tokens from DB
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

refreshTokenSchema.statics.expiryFromNow = function (now = Date.now()) {
    return new Date(now + REFRESH_TOKEN_TTL_MS);
};

/**
 * Validates a refresh token and slides its expiry forward.
 * Returns the stored token record, or null when the token is unknown/expired.
 *
 * - The TTL monitor only sweeps every ~60s, so an expired row can still be
 *   found; the explicit expiry check covers that gap.
 * - The renewal update is conditional on the token still existing and being
 *   unexpired, so a logout/password-change/device-takeover that deletes it
 *   between our read and write is never undone (updateOne never upserts).
 * - Two parallel refreshes both writing the same new expiry is harmless.
 */
refreshTokenSchema.statics.consume = async function (token, now = Date.now()) {
    // Defence in depth: express-mongo-sanitize already strips `$` operators,
    // but a non-string here must never reach the query as a filter object.
    if (typeof token !== 'string' || !token) return null;

    const stored = await this.findOne({ token }).lean();
    if (!stored) return null;

    const expiresAtMs = new Date(stored.expiresAt).getTime();
    if (!(expiresAtMs > now)) {
        await this.deleteOne({ _id: stored._id });
        return null;
    }

    const renewDue = expiresAtMs - now < REFRESH_TOKEN_TTL_MS - RENEW_INTERVAL_MS;
    if (renewDue) {
        const expiresAt = this.expiryFromNow(now);
        await this.updateOne(
            { _id: stored._id, expiresAt: { $gt: new Date(now) } },
            { $set: { expiresAt } }
        );
        stored.expiresAt = expiresAt;
    }
    return stored;
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
module.exports.REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_MS;
module.exports.RENEW_INTERVAL_MS = RENEW_INTERVAL_MS;
