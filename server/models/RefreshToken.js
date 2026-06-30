const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token:     { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    userAgent: { type: String },
    ipAddress: { type: String },
}, { timestamps: true });

// MongoDB TTL index — auto-deletes expired tokens from DB
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
