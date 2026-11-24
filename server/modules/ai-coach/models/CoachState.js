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
    // A list, not a Map: field names contain dots ("fitness.limitations") and
    // Mongoose Map keys can't.
    askedLog: {
        type: [new mongoose.Schema({ field: { type: String, required: true }, askedAt: { type: Date, required: true } }, { _id: false })],
        default: [],
    },
    pendingConfirm: {
        facts: { type: [mongoose.Schema.Types.Mixed], default: undefined },
        askedAt: Date,
    },
    // A request paused by a blocking question ("meal generate karo" -> "pait
    // kaisa hai?"): resumed with the user's answer on the next message.
    pendingRequest: {
        message: { type: String, maxlength: 2000 },
        topics: { type: [String], default: undefined },
        specialists: { type: [String], default: undefined },
        recommendsFoodOrSupplement: Boolean,
        askedAt: Date,
    },
    // A meal the user described, shown back with its nutrition, waiting for "save it".
    pendingFoodLog: {
        entry: mongoose.Schema.Types.Mixed,
        askedAt: Date,
    },
    // "Add this kind of meal to your 7-day plan?" was asked: the reply it refers to.
    pendingMealPref: {
        replyText: { type: String, maxlength: 4000 },
        askedAt: Date,
    },
    lastSaved: {
        items: { type: [mongoose.Schema.Types.Mixed], default: undefined }, // [{ target, value, historyId }]
        savedAt: Date,
    },
}, { timestamps: true, collection: 'coach_states' });

module.exports = mongoose.models.CoachState || mongoose.model('CoachState', coachStateSchema);
