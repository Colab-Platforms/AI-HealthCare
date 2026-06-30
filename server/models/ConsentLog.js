const mongoose = require('mongoose');

const consentLogSchema = new mongoose.Schema({
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    version:     { type: String, required: true },          // e.g. "1.0"
    action:      { type: String, enum: ['granted', 'withdrawn'], required: true },
    purposes:    [{ type: String }],                        // ['analytics', 'health_processing', 'marketing']
    ipAddress:   { type: String },
    userAgent:   { type: String },
    grantedAt:   { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('ConsentLog', consentLogSchema);
