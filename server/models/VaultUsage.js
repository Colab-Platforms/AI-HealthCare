const mongoose = require('mongoose');
const { FREE_BASE_BYTES } = require('../config/vault');

// Kept out of the User document on purpose: User writes invalidate the auth
// userCache, and every upload/delete touches this counter.
//
//   quotaBytes = FREE_BASE_BYTES + grantedBytes
//
// quotaBytes is a stored copy so uploads can check "used + new <= quota" in one
// atomic update. It is recomputed from the config + grantedBytes whenever usage
// is read (services/vaultService.getUsage), and grantedBytes is rebuilt from the
// VaultStorageGrant ledger by the reconcile job, so neither can drift for long.
const vaultUsageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  usedBytes: { type: Number, default: 0, min: 0 },
  grantedBytes: { type: Number, default: 0, min: 0 },
  quotaBytes: { type: Number, default: FREE_BASE_BYTES },
}, { timestamps: true });

module.exports = mongoose.model('VaultUsage', vaultUsageSchema);
