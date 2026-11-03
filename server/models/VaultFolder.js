const mongoose = require('mongoose');

const vaultFolderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  nameLower: { type: String, required: true }, // case-insensitive uniqueness + prefix search
  category: {
    type: { type: String, enum: ['preset', 'custom'], default: 'custom' },
    key: { type: String, default: 'custom' },   // preset key, or 'custom'
    label: { type: String, default: '' },
  },
  isAdmitted: { type: Boolean, default: false },
  color: { type: String, default: '#64748B' },

  // Denormalized from vault_reports; recomputed by vaultService.refreshFolderStats
  // after every report mutation, so it cannot drift.
  stats: {
    reportCount: { type: Number, default: 0 },
    totalBytes: { type: Number, default: 0 },
    firstReportDate: { type: Date, default: null },
    latestReportDate: { type: Date, default: null },
  },

  deletedAt: { type: Date, default: null },
}, { timestamps: true });

vaultFolderSchema.index({ userId: 1, deletedAt: 1, updatedAt: -1 });
// A user can't have two live folders with the same name.
vaultFolderSchema.index(
  { userId: 1, nameLower: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

module.exports = mongoose.model('VaultFolder', vaultFolderSchema);
