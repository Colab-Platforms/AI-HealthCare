const mongoose = require('mongoose');

// One scheduled dose = one row, created ahead of time ("materialized"). The user
// only ever flips its status; reminders, the missed sweep, the Today screen and
// the consistency stats are all indexed reads over this collection, so their cost
// scales with doses due *now*, not with the number of users.
//
// This is the hottest collection of the feature. Every index below exists for a
// specific query; do not add one without naming it.
const doseLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userSupplementId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserSupplement', required: true },

    scheduledFor: { type: Date, required: true }, // exact UTC instant, computed once at creation
    localDate: { type: String, required: true },  // "YYYY-MM-DD" in the user's zone — what "today" means to them
    slot: { type: Number, default: 0 },           // index within that day's times

    // Frozen copy of the supplement at creation: editing the supplement later
    // can't rewrite history, and Today renders without a join.
    snapshot: {
        name: { type: String, required: true },
        form: String,
        strength: { value: Number, unit: String },
        quantityPerDose: Number,
    },

    status: { type: String, enum: ['pending', 'taken', 'missed'], default: 'pending' },
    takenAt: Date,
    missedAt: Date,
    // 'auto' = the 3h sweep ("not logged"); 'user' = the user tapped Missed.
    missedSource: { type: String, enum: ['auto', 'user'] },

    // Reminder state.
    remindAt: { type: Date, default: null },       // scheduledFor - offset; null if reminders are off
    reminderPending: { type: Boolean, default: false }, // armed and not yet claimed
    reminderClaimId: String,                       // which tick claimed it (atomic claim, see supplementReminderService)

    createdAt: { type: Date, default: Date.now },
}, { timestamps: false });

// Identity of a dose, and what makes materialization idempotent (upsert on this).
doseLogSchema.index({ userSupplementId: 1, scheduledFor: 1 }, { unique: true });

// Today / dose lists / weekly + calendar stats: "this user's doses for these days".
doseLogSchema.index({ userId: 1, localDate: 1, scheduledFor: 1 });

// Reminder tick: due-now lookup. Partial, so it only holds armed, unclaimed rows —
// a row leaves the index the moment it is claimed, taken or missed, which keeps it
// tiny however large the history grows.
doseLogSchema.index({ remindAt: 1 }, { partialFilterExpression: { reminderPending: true } });

// Missed sweep: pending doses past the grace period. Partial on the same idea.
doseLogSchema.index({ scheduledFor: 1 }, { partialFilterExpression: { status: 'pending' } });

module.exports = mongoose.model('DoseLog', doseLogSchema);
