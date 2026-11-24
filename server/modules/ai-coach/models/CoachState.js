const mongoose = require('mongoose');

// Per-user coach memory between messages (one small doc per user):
// - pendingQuestion: the profile question the coach asked last turn, so the
//   next message can be read as its answer;
// - askedLog: when each profile field was last asked (7-day snooze);
// - pendingConfirm: facts the user volunteered, waiting for "yes, save it";
// - lastSaved: what the coach saved last, so "undo" / "hata do" can revert it.
//
// Kept out of ChatHistory on purpose: the app syncs ChatHistory itself and
// could overwrite fields it doesn't know. Contains health facts: covered by
// DPDPA delete and export (privacyController, adminController).

const coachStateSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    pendingQuestion: {
        field: String,
        question: String,
        askedAt: Date,
    },
    askedLog: { type: Map, of: Date, default: {} },
    pendingConfirm: {
        facts: { type: [mongoose.Schema.Types.Mixed], default: undefined },
        askedAt: Date,
    },
    lastSaved: {
        items: { type: [mongoose.Schema.Types.Mixed], default: undefined }, // [{ target, value, historyId }]
        savedAt: Date,
    },
}, { timestamps: true, collection: 'coach_states' });

module.exports = mongoose.models.CoachState || mongoose.model('CoachState', coachStateSchema);
