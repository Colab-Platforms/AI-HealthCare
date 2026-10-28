const mongoose = require('mongoose');

// Kept out of the User document on purpose: User writes invalidate the auth
// userCache, and every upload/delete touches this counter.
const vaultUsageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  usedBytes: { type: Number, default: 0, min: 0 },
  quotaBytes: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('VaultUsage', vaultUsageSchema);
