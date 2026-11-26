const mongoose = require('mongoose');

// Append-only change log for HealthProfile. Never updated except to mark an
// entry as undone. Used for audit (who/what changed a health fact and from
// where), Undo of chat-saved values, and field trends (e.g. weight over time).

const profileHistorySchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    field: { type: String, required: true },      // e.g. "body.weightKg", "allergies"
    action: {
        type: String,
        enum: ['create', 'set', 'add_item', 'update_item', 'remove_item', 'mark_none', 'undo'],
        required: true,
    },
    itemId: { type: mongoose.Schema.Types.ObjectId }, // for list item actions
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },
    source: { type: String, enum: ['manual', 'device', 'report', 'chat', 'migration'], required: true },
    profileVersion: { type: Number },              // HealthProfile.version after this change
    undoneAt: { type: Date, default: null },
    undoOf: { type: mongoose.Schema.Types.ObjectId, ref: 'ProfileHistory' }, // set on action 'undo'
}, { timestamps: { createdAt: true, updatedAt: false }, collection: 'profile_history' });

profileHistorySchema.index({ user: 1, createdAt: -1 });        // recent changes / audit
profileHistorySchema.index({ user: 1, field: 1, createdAt: -1 }); // field trend, e.g. weight

module.exports = mongoose.models.ProfileHistory || mongoose.model('ProfileHistory', profileHistorySchema);
