// Load / save CoachState (models/CoachState.js). Tests use an in-memory stand-in.

const mongoRepo = {
    async load(userId) {
        const CoachState = require('../models/CoachState');
        const doc = await CoachState.findOne({ user: userId }).lean();
        if (!doc) return {};
        return {
            pendingQuestion: doc.pendingQuestion?.field ? doc.pendingQuestion : null,
            askedLog: doc.askedLog ? Object.fromEntries(Object.entries(doc.askedLog)) : {},
            pendingConfirm: doc.pendingConfirm?.facts?.length ? doc.pendingConfirm : null,
            lastSaved: doc.lastSaved?.items?.length ? doc.lastSaved : null,
        };
    },

    // `state` is the full next state; null clears a field.
    async save(userId, state) {
        const CoachState = require('../models/CoachState');
        const $set = {};
        const $unset = {};
        for (const key of ['pendingQuestion', 'pendingConfirm', 'lastSaved']) {
            if (state[key]) $set[key] = state[key];
            else $unset[key] = '';
        }
        $set.askedLog = state.askedLog || {};
        const update = { $set };
        if (Object.keys($unset).length) update.$unset = $unset;
        await CoachState.updateOne({ user: userId }, update, { upsert: true });
    },
};

function createMemoryCoachStateRepo(initial = {}) {
    const store = new Map(Object.entries(initial));
    return {
        store,
        async load(userId) { return JSON.parse(JSON.stringify(store.get(String(userId)) || {})); },
        async save(userId, state) { store.set(String(userId), JSON.parse(JSON.stringify(state))); },
    };
}

module.exports = { mongoRepo, createMemoryCoachStateRepo };
