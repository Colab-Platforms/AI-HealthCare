// Load / save CoachState (models/CoachState.js). Tests use an in-memory stand-in
// that runs the SAME serialisation, so a shape the real model rejects fails
// in tests too (the Map-with-dotted-keys bug was missed because it didn't).
//
// In the graph, askedLog is { [field]: Date }; in Mongo it is
// [{ field, askedAt }] (field names contain dots, which Map keys can't).

const KEYS = ['pendingQuestion', 'pendingConfirm', 'pendingRequest', 'pendingFoodLog', 'pendingMealPref', 'lastSaved'];

function toDoc(state = {}) {
    const doc = {};
    for (const key of KEYS) doc[key] = state[key] || null;
    doc.askedLog = Object.entries(state.askedLog || {})
        .filter(([field, at]) => field && at)
        .map(([field, at]) => ({ field, askedAt: new Date(at) }));
    return doc;
}

function fromDoc(doc) {
    if (!doc) return {};
    const askedLog = {};
    for (const e of Array.isArray(doc.askedLog) ? doc.askedLog : []) {
        if (e?.field && e.askedAt) askedLog[e.field] = e.askedAt;
    }
    return {
        pendingQuestion: doc.pendingQuestion?.field ? doc.pendingQuestion : null,
        askedLog,
        pendingConfirm: doc.pendingConfirm?.facts?.length ? doc.pendingConfirm : null,
        pendingRequest: doc.pendingRequest?.message ? doc.pendingRequest : null,
        pendingMealPref: doc.pendingMealPref?.replyText ? doc.pendingMealPref : null,
        pendingFoodLog: doc.pendingFoodLog?.entry ? doc.pendingFoodLog : null,
        lastSaved: doc.lastSaved?.items?.length ? doc.lastSaved : null,
    };
}

const mongoRepo = {
    async load(userId) {
        const CoachState = require('../models/CoachState');
        return fromDoc(await CoachState.findOne({ user: userId }).lean());
    },

    async save(userId, state) {
        const CoachState = require('../models/CoachState');
        const doc = toDoc(state);
        const $set = { askedLog: doc.askedLog };
        const $unset = {};
        for (const key of KEYS) {
            if (doc[key]) $set[key] = doc[key];
            else $unset[key] = '';
        }
        const update = { $set };
        if (Object.keys($unset).length) update.$unset = $unset;
        await CoachState.updateOne({ user: userId }, update, { upsert: true, runValidators: true });
    },
};

// Same toDoc/fromDoc round trip, and validates against the real schema.
function createMemoryCoachStateRepo(initial = {}) {
    const store = new Map(Object.entries(initial));
    return {
        store,
        async load(userId) { return fromDoc(store.get(String(userId))); },
        async save(userId, state) {
            const CoachState = require('../models/CoachState');
            const doc = toDoc(state);
            const err = new CoachState({ user: userId, ...doc }).validateSync();
            if (err) throw err;
            store.set(String(userId), JSON.parse(JSON.stringify(doc)));
        },
    };
}

module.exports = { mongoRepo, createMemoryCoachStateRepo, toDoc, fromDoc };
