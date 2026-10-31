const mongoose = require('mongoose');

/**
 * One report = one file. The phone uploads a finished PDF/image/TXT directly to
 * Cloudinary (type: authenticated); we only store the reference.
 */
const fileSchema = new mongoose.Schema({
  publicId: { type: String, required: true },
  resourceType: { type: String, enum: ['image', 'raw'], required: true },
  format: { type: String, default: '' },        // pdf | jpg | png | txt
  mime: { type: String, required: true },
  sizeBytes: { type: Number, default: 0 },
  originalName: { type: String, default: '' },
  pageCount: { type: Number, default: null },   // PDFs only
  // 'none'            -> new uploads, private Cloudinary storage
  // 'aes-cbc-legacy'  -> migrated MedicalDocument blobs, decrypted on read
  encryption: { type: String, enum: ['none', 'aes-cbc-legacy'], default: 'none' },
  legacyUrl: { type: String, default: null },   // full Cloudinary URL for legacy blobs
}, { _id: false });

const vaultReportSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'VaultFolder', default: null }, // null = unfiled
  title: { type: String, required: true, trim: true, maxlength: 160 },
  note: { type: String, default: '', maxlength: 1000 },
  reportDate: { type: Date, required: true, default: Date.now },
  source: { type: String, enum: ['upload', 'camera', 'legacy'], default: 'upload' },
  file: { type: fileSchema, required: true },

  status: { type: String, enum: ['active', 'deleted'], default: 'active' },
  deletedAt: { type: Date, default: null },
  purgeAfter: { type: Date, default: null },     // when the Cloudinary asset may be destroyed
  purgedAt: { type: Date, default: null },
  legacyDocId: { type: mongoose.Schema.Types.ObjectId }, // no default: a stored null would collide in the unique index below
}, { timestamps: true });

// Folder timeline (cursor pagination on reportDate desc, _id desc)
vaultReportSchema.index({ userId: 1, folderId: 1, status: 1, reportDate: -1, _id: -1 });
// Global timeline
vaultReportSchema.index({ userId: 1, status: 1, reportDate: -1, _id: -1 });
// Purge job
vaultReportSchema.index({ status: 1, purgedAt: 1, purgeAfter: 1 });
// Migration idempotency
// Partial (not sparse): a sparse index still indexes explicit nulls, so two reports with legacyDocId: null would collide.
vaultReportSchema.index(
  { legacyDocId: 1 },
  { unique: true, partialFilterExpression: { legacyDocId: { $type: 'objectId' } } }
);

module.exports = mongoose.model('VaultReport', vaultReportSchema);
