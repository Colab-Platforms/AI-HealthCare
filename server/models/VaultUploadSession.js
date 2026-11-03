const mongoose = require('mongoose');

/**
 * Issued by POST /vault/uploads/sign. Records which Cloudinary public IDs the
 * client was allowed to upload, so finalize can only attach assets that this
 * user was actually granted (never someone else's), and so assets that were
 * uploaded but never finalized can be found and destroyed.
 */
const vaultUploadSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  files: [{
    publicId: { type: String, required: true },
    resourceType: { type: String, enum: ['image', 'raw'], required: true },
    mime: { type: String, required: true },
    declaredSize: { type: Number, default: 0 },
    consumed: { type: Boolean, default: false },
    _id: false,
  }],
  expiresAt: { type: Date, required: true },
  cleanedAt: { type: Date, default: null },
}, { timestamps: true });

vaultUploadSessionSchema.index({ userId: 1, createdAt: -1 });
vaultUploadSessionSchema.index({ 'files.publicId': 1 });
// Orphan cleanup scans sessions after expiry; keep them 7 days past that, then drop.
vaultUploadSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });

module.exports = mongoose.model('VaultUploadSession', vaultUploadSessionSchema);
