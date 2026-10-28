const mongoose = require('mongoose');

/**
 * A public share link for one report. Only the SHA-256 hash of the token is
 * stored, so a database leak does not yield working links. The raw token is
 * returned once, when the link is created.
 */
const vaultShareSchema = new mongoose.Schema({
  reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'VaultReport', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, unique: true },
  allowDownload: { type: Boolean, default: false }, // fixed at creation
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  accessCount: { type: Number, default: 0 },
  lastAccessAt: { type: Date, default: null },
}, { timestamps: true });

vaultShareSchema.index({ reportId: 1, revokedAt: 1 });
vaultShareSchema.index({ userId: 1, createdAt: -1 });
// Mongo removes the document once expiresAt has passed.
vaultShareSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('VaultShare', vaultShareSchema);
