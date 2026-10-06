const mongoose = require('mongoose');

// One-off/periodic bulk-announcement send tracking — kept separate from the
// User schema so campaign-specific state doesn't bloat the core model.
// A document here means "this campaign has already been emailed to this user"
// so re-running the send script never double-emails anyone.
const announcementEmailLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    campaign: {
        type: String,
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['sent', 'failed'],
        default: 'sent'
    },
    error: String
}, { timestamps: true });

announcementEmailLogSchema.index({ campaign: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('AnnouncementEmailLog', announcementEmailLogSchema);
