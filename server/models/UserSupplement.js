const mongoose = require('mongoose');
const { FORMS, FREQUENCIES } = require('../utils/supplementSchedule');

// One item in a user's routine: what they take and on what schedule. The
// individual doses live in DoseLog, pre-created a week ahead (see
// services/supplementService.js#materializeSupplement).
//
// Calendar days (startDate / endDate / materializedThrough) are "YYYY-MM-DD"
// strings in the user's own timezone, not Dates — they mean a calendar day, and a
// Date would shift when read from a different zone.
const userSupplementSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    catalogId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupplementCatalog', default: null }, // null = user typed it
    name: { type: String, required: true, trim: true, maxlength: 80 },
    // lowercase/trimmed/collapsed name. Typed supplements are grouped on this to
    // find what users add most (candidates for the catalog).
    normalizedName: { type: String, required: true },
    form: { type: String, enum: FORMS, required: true },
    strength: { value: Number, unit: String }, // optional, per unit
    quantityPerDose: { type: Number, required: true, default: 1 },
    schedule: {
        frequency: { type: String, enum: FREQUENCIES, required: true },
        daysOfWeek: [{ type: Number, min: 0, max: 6 }], // 0=Sun; used by weekly/custom only
        times: [{ type: String }],                       // "HH:mm" on the user's clock
    },
    duration: {
        mode: { type: String, enum: ['fixed', 'ongoing'], required: true },
        days: Number,
        startDate: { type: String, required: true },
        endDate: { type: String, default: null }, // null while ongoing
    },
    reminder: {
        enabled: { type: Boolean, default: true },
        offsetMin: { type: Number, default: 10 },
    },
    timezone: { type: String, required: true },
    status: { type: String, enum: ['active', 'completed', 'archived'], default: 'active' },

    // Dose-row horizon bookkeeping: DoseLog rows exist for every dose up to this
    // local date. The extender job picks up supplements whose horizon is running
    // out, instead of aggregating max(scheduledFor) over DoseLog.
    materializedThrough: { type: String, required: true },
    materializationDone: { type: Boolean, default: false }, // fixed course fully created
    completedAt: Date,
    archivedAt: Date,
}, { timestamps: true });

// My Stack: a user's active / past supplements.
userSupplementSchema.index({ userId: 1, status: 1, updatedAt: -1 });

// A user can't have the same supplement active twice. Also the guard against a
// double-tapped "Add Medicine" creating two copies.
userSupplementSchema.index(
    { userId: 1, normalizedName: 1 },
    { unique: true, partialFilterExpression: { status: 'active' } }
);

// Extender tick: active, unfinished supplements whose horizon is running out.
userSupplementSchema.index(
    { materializedThrough: 1 },
    { partialFilterExpression: { status: 'active', materializationDone: false } }
);

// Completion sweep: active supplements whose fixed course has ended.
userSupplementSchema.index(
    { 'duration.endDate': 1 },
    { partialFilterExpression: { status: 'active' } }
);

module.exports = mongoose.model('UserSupplement', userSupplementSchema);
