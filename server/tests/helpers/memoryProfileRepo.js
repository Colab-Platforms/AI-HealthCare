// In-memory stand-in for modules/health-profile/services/profileRepo.js so
// ProfileWriteService runs without a database.
//
// Transactions behave like MongoDB's: reads see committed data, writes are
// buffered in the session and applied only on commit. A profile that another
// transaction committed in the meantime is a write conflict, and the whole
// callback is retried (as session.withTransaction does). An error discards the
// buffer, so a failed transaction never touches other transactions' data.

const { VersionConflictError } = require('../../modules/health-profile/services/profileRepo');

const copy = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const tick = () => new Promise((r) => setImmediate(r));

class WriteConflict extends Error {}

function applyPatch(doc, patch) {
    for (const [path, value] of Object.entries(patch.$set || {})) {
        const keys = path.split('.');
        let o = doc;
        for (const k of keys.slice(0, -1)) o = o[k] ??= {};
        o[keys.at(-1)] = copy(value);
    }
    for (const path of Object.keys(patch.$unset || {})) {
        const keys = path.split('.');
        let o = doc;
        for (const k of keys.slice(0, -1)) o = o?.[k];
        if (o) delete o[keys.at(-1)];
    }
}

function createMemoryProfileRepo({ users = {} } = {}) {
    const state = { profiles: {}, users: copy(users), history: [] };
    const calls = { patchUser: 0, transactions: 0 };
    const failures = {}; // e.g. failures.patchUser = new Error('boom')

    function commit(session) {
        // Conflict check first, so a conflicting commit applies nothing.
        for (const op of session.ops) {
            if (op.type !== 'profile') continue;
            const current = state.profiles[op.key];
            const currentVersion = current ? current.version : null;
            if (currentVersion !== op.prevVersion) throw new WriteConflict();
        }
        for (const op of session.ops) op.apply();
    }

    const repo = {
        state,
        calls,
        failures,

        async withTransaction(fn, outerSession) {
            if (outerSession) return fn(outerSession);
            for (let attempt = 0; attempt < 5; attempt++) {
                calls.transactions++;
                const session = { ops: [] };
                try {
                    const result = await fn(session);
                    await tick();
                    commit(session);
                    return result;
                } catch (err) {
                    if (err instanceof WriteConflict) continue;
                    throw err;
                }
            }
            throw new VersionConflictError();
        },

        async loadProfile(userId) {
            await tick();
            return copy(state.profiles[String(userId)]) || null;
        },

        async saveProfile(profile, prevVersion, session) {
            await tick();
            const key = String(profile.user);
            const value = copy(profile);
            session.ops.push({ type: 'profile', key, prevVersion, apply: () => { state.profiles[key] = value; } });
        },

        async loadLegacyUser(userId) {
            await tick();
            return copy(state.users[String(userId)]) || null;
        },

        async patchUser(userId, patch, session) {
            calls.patchUser++;
            if (failures.patchUser) throw failures.patchUser;
            if (!patch.$set && !patch.$unset) return;
            const p = copy(patch);
            session.ops.push({ type: 'user', apply: () => applyPatch(state.users[String(userId)], p) });
        },

        async insertHistory(entries, session) {
            const list = copy(entries);
            session.ops.push({
                type: 'history',
                apply: () => {
                    for (const e of list) {
                        state.history.push({ _id: `h${state.history.length + 1}`, undoneAt: null, ...e });
                    }
                },
            });
        },

        async loadHistory(userId, historyId) {
            return copy(state.history.find((h) => h._id === String(historyId) && h.user === String(userId))) || null;
        },

        async latestActiveHistory(userId, field) {
            const list = state.history.filter((h) => h.user === String(userId) && h.field === field && !h.undoneAt && h.action !== 'undo');
            return copy(list.at(-1)) || null;
        },

        async markUndone(historyId, session) {
            session.ops.push({
                type: 'undo-mark',
                apply: () => {
                    const h = state.history.find((x) => x._id === String(historyId));
                    if (h) h.undoneAt = new Date().toISOString();
                },
            });
        },
    };
    return repo;
}

module.exports = { createMemoryProfileRepo };
