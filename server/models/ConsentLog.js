const mongoose = require('mongoose');

const consentLogSchema = new mongoose.Schema({
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    version:     { type: String, required: true },          // e.g. "1.0"
    action:      { type: String, enum: ['granted', 'withdrawn'], required: true },
    purposes:    [{ type: String }],                        // ['analytics', 'health_processing', 'marketing']
    ipAddress:   { type: String },
    userAgent:   { type: String },
    grantedAt:   { type: Date, default: Date.now },
    metadata:    { type: mongoose.Schema.Types.Mixed },      // e.g. guardian details for under-18 consent
    // Set only once the associated account is actually deleted (purgeDate + 5
    // years) — DPDPA §6 evidence-of-compliance retention. While the account
    // is still active this stays null, so these rows are never touched by
    // the account-deletion cron and are preserved for the account's whole
    // lifetime plus 5 years afterward, not deleted alongside the account.
    retainUntil: { type: Date, default: null },
}, { timestamps: true });

// Sparse: only stamped (post-account-deletion) rows ever populate this, so
// the index stays tiny regardless of total ConsentLog volume.
consentLogSchema.index({ retainUntil: 1 }, { sparse: true });

module.exports = mongoose.model('ConsentLog', consentLogSchema);
