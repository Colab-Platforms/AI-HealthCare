/**
 * Background maintenance for the Medical Vault. Both jobs are idempotent and
 * process a bounded batch per run, so a long backlog just takes several runs.
 */
const VaultReport = require('../models/VaultReport');
const VaultUploadSession = require('../models/VaultUploadSession');
const storage = require('./vaultStorage');

const BATCH = 100;

/**
 * Destroy the Cloudinary assets of reports that were deleted more than the
 * grace period ago. Migrated legacy files are skipped: their assets belong to
 * the old MedicalDocument records, which the migration script handles.
 */
const purgeDeletedReports = async () => {
  const due = await VaultReport.find({
    status: 'deleted',
    purgedAt: null,
    purgeAfter: { $lte: new Date() },
  })
    .limit(BATCH)
    .select('_id file.publicId file.resourceType file.encryption file.legacyUrl')
    .lean();

  let purged = 0;
  for (const r of due) {
    try {
      if (!storage.isLegacyFile(r.file)) {
        await storage.destroyAsset({ publicId: r.file.publicId, resourceType: r.file.resourceType });
      }
      await VaultReport.updateOne({ _id: r._id }, { $set: { purgedAt: new Date() } });
      purged += 1;
    } catch (err) {
      // Left unpurged; the next run retries it.
      console.error(`[VaultJobs] purge failed for report ${r._id}:`, err.message);
    }
  }
  return { due: due.length, purged };
};

/**
 * Assets that were uploaded to Cloudinary but never finalized into a report
 * (app killed mid-flow, user cancelled) are destroyed once their sign session
 * has expired.
 */
const cleanOrphanUploads = async () => {
  const sessions = await VaultUploadSession.find({ expiresAt: { $lte: new Date() }, cleanedAt: null })
    .limit(BATCH)
    .lean();

  let destroyed = 0;
  for (const s of sessions) {
    try {
      for (const f of s.files.filter((x) => !x.consumed)) {
        await storage.destroyAsset({ publicId: f.publicId, resourceType: f.resourceType });
        destroyed += 1;
      }
      await VaultUploadSession.updateOne({ _id: s._id }, { $set: { cleanedAt: new Date() } });
    } catch (err) {
      console.error(`[VaultJobs] orphan cleanup failed for session ${s._id}:`, err.message);
    }
  }
  return { sessions: sessions.length, destroyed };
};

module.exports = { purgeDeletedReports, cleanOrphanUploads };
