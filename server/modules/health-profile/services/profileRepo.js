const mongoose = require('mongoose');
const HealthProfile = require('../models/HealthProfile');
const ProfileHistory = require('../models/ProfileHistory');
const User = require('../../../models/User');

// MongoDB persistence for ProfileWriteService. Kept separate so the service's
// rules can be tested against an in-memory repo (tests/helpers) without a DB.
// Every method takes the transaction session explicitly.

class VersionConflictError extends Error {
    constructor() {
        super('Health profile was changed by another request. Reload and try again.');
        this.status = 409;
        this.code = 'PROFILE_VERSION_CONFLICT';
    }
}

const mongoRepo = {
    // Runs fn(session) in a transaction. Joins the caller's session when given
    // (e.g. signup creating the User and the HealthProfile together).
    async withTransaction(fn, outerSession) {
        if (outerSession) return fn(outerSession);
        const session = await mongoose.startSession();
        try {
            let result;
            // withTransaction retries the callback on transient write conflicts,
            // so two concurrent writes to one profile serialize instead of failing.
            await session.withTransaction(async () => { result = await fn(session); });
            return result;
        } finally {
            await session.endSession();
        }
    },

    async loadProfile(userId, session) {
        return HealthProfile.findOne({ user: userId }).session(session).lean();
    },

    // Insert when prevVersion is null, otherwise replace guarded by version so a
    // write based on a stale read can never overwrite a newer one.
    async saveProfile(profile, prevVersion, session) {
        if (prevVersion === null) {
            try {
                await HealthProfile.create([profile], { session });
            } catch (err) {
                if (err.code === 11000) throw new VersionConflictError();
                throw err;
            }
            return;
        }
        const res = await HealthProfile.replaceOne(
            { _id: profile._id, version: prevVersion },
            profile,
            { session },
        );
        if (res.matchedCount === 0) throw new VersionConflictError();
    },

    async loadLegacyUser(userId, session) {
        return User.findById(userId).select('profile nutritionGoal').session(session).lean();
    },

    async patchUser(userId, patch, session) {
        if (!patch.$set && !patch.$unset) return;
        await User.updateOne({ _id: userId }, patch, { session });
    },

    async insertHistory(entries, session) {
        if (entries.length) await ProfileHistory.insertMany(entries, { session });
    },

    async loadHistory(userId, historyId, session) {
        return ProfileHistory.findOne({ _id: historyId, user: userId }).session(session).lean();
    },

    // Latest change to a field that is still in effect (not undone, not itself an undo).
    async latestActiveHistory(userId, field, session) {
        return ProfileHistory.findOne({ user: userId, field, undoneAt: null, action: { $ne: 'undo' } })
            .sort({ createdAt: -1, _id: -1 })
            .session(session)
            .lean();
    },

    async markUndone(historyId, session) {
        await ProfileHistory.updateOne({ _id: historyId }, { $set: { undoneAt: new Date() } }, { session });
    },

    // ── reads outside a transaction (API / AI context) ────────────────────

    async findProfile(userId) {
        return HealthProfile.findOne({ user: userId }).lean();
    },

    // Newest first. `before` is a history id: returns entries older than it
    // (ObjectIds grow with time), for "load more".
    async listHistory(userId, { field, before, limit }) {
        const filter = { user: userId };
        if (field) filter.field = field;
        if (before) filter._id = { $lt: before };
        return ProfileHistory.find(filter).sort({ _id: -1 }).limit(limit).lean();
    },
};

module.exports = { mongoRepo, VersionConflictError };
