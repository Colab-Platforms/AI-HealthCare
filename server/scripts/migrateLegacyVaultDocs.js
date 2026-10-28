/**
 * Copy legacy MedicalDocument records into the new Vault collections as
 * UNFILED reports (source: "legacy"). Files are not moved or re-uploaded:
 * encrypted blobs keep their old Cloudinary URL and are decrypted on read.
 *
 *     node scripts/migrateLegacyVaultDocs.js --dry-run   # report only
 *     node scripts/migrateLegacyVaultDocs.js             # apply
 *
 * Safe to re-run: vault_reports.legacyDocId is unique, so already-migrated
 * documents are skipped. Used storage is added to each user's vault quota.
 * Target DB: USE_STAGING_DB=true -> MONGODB_URI_STAGING, else MONGODB_URI.
 */
const path = require('path');
const dotenv = require('dotenv');
const dns = require('dns');
const mongoose = require('mongoose');

dotenv.config();
dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.RENDER && !process.env.VERCEL && !process.env.RAILWAY_ENVIRONMENT_ID && process.env.FORCE_PUBLIC_DNS !== 'false') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

const MIME_FORMAT = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'text/plain': 'txt' };

/** Map one legacy document to a vault report payload. Exported for tests. */
const toVaultReport = (doc, extractPublicId) => {
  const mime = doc.mimetype || 'application/octet-stream';
  const extra = [doc.hospital && `Hospital: ${doc.hospital}`, doc.doctorName && `Doctor: ${doc.doctorName}`].filter(Boolean).join(' · ');
  const note = [doc.notes, extra].filter(Boolean).join('\n').slice(0, 1000);
  const ext = (doc.originalName || '').split('.').pop().toLowerCase();

  return {
    userId: doc.userId,
    folderId: null,
    title: String(doc.title || doc.originalName || 'Untitled report').slice(0, 160),
    note,
    reportDate: doc.documentDate || doc.createdAt || new Date(),
    source: 'legacy',
    legacyDocId: doc._id,
    file: {
      publicId: extractPublicId(doc.fileUrl) || `legacy/${doc._id}`,
      resourceType: mime.startsWith('image/') || mime === 'application/pdf' ? 'image' : 'raw',
      format: MIME_FORMAT[mime] || ext || '',
      mime,
      sizeBytes: doc.size || 0,
      originalName: doc.originalName || '',
      encryption: doc.isEncrypted ? 'aes-cbc-legacy' : 'none',
      legacyUrl: doc.fileUrl,
    },
  };
};

const run = async () => {
  const useStaging = process.env.USE_STAGING_DB === 'true';
  const mongoUri = useStaging ? process.env.MONGODB_URI_STAGING : process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error(`${useStaging ? 'MONGODB_URI_STAGING' : 'MONGODB_URI'} is not set`);
    process.exit(1);
  }
  const dryRun = process.argv.includes('--dry-run');

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 30000, family: 4 });
  console.log(`Connected to ${mongoose.connection.host}/${mongoose.connection.name} [${useStaging ? 'STAGING' : 'PRODUCTION'}]`);
  console.log(dryRun ? 'MODE: DRY RUN\n' : 'MODE: APPLY\n');

  const MedicalDocument = require('../models/MedicalDocument');
  const VaultReport = require('../models/VaultReport');
  const VaultUsage = require('../models/VaultUsage');
  const User = require('../models/User');
  const { extractPublicId } = require('../services/cloudinary');
  const { quotaForPlan } = require('../config/vault');

  const done = new Set((await VaultReport.distinct('legacyDocId', { legacyDocId: { $ne: null } })).map(String));
  const bytesByUser = new Map();
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for await (const doc of MedicalDocument.find({}).sort({ _id: 1 }).lean().cursor()) {
    if (done.has(String(doc._id))) { skipped += 1; continue; }
    if (!doc.fileUrl) { failed += 1; console.warn(`skip ${doc._id}: no fileUrl`); continue; }

    if (dryRun) { migrated += 1; continue; }
    try {
      await VaultReport.create(toVaultReport(doc, extractPublicId));
      bytesByUser.set(String(doc.userId), (bytesByUser.get(String(doc.userId)) || 0) + (doc.size || 0));
      migrated += 1;
    } catch (err) {
      if (err.code === 11000) { skipped += 1; continue; } // raced a concurrent run
      failed += 1;
      console.error(`failed ${doc._id}:`, err.message);
    }
  }

  if (!dryRun) {
    for (const [userId, bytes] of bytesByUser) {
      const user = await User.findById(userId).select('subscription.plan').lean();
      await VaultUsage.updateOne(
        { userId },
        { $inc: { usedBytes: bytes }, $setOnInsert: { quotaBytes: quotaForPlan(user?.subscription?.plan) } },
        { upsert: true }
      );
    }
  }

  console.log(`\n${dryRun ? 'Would migrate' : 'Migrated'}: ${migrated}   already migrated: ${skipped}   failed: ${failed}`);
  await mongoose.disconnect();
};

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { toVaultReport };
