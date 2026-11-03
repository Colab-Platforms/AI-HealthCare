/**
 * Medical Vault API (mobile). Mounted at /api/v1/vault, all routes protected.
 *
 * Folders hold reports; a report is one file stored privately on Cloudinary.
 * Files never pass through this server on upload: the app uploads directly
 * with parameters signed by signUploads, then calls createReports to finalize.
 */
const VaultFolder = require('../models/VaultFolder');
const VaultReport = require('../models/VaultReport');
const VaultShare = require('../models/VaultShare');
const VaultUploadSession = require('../models/VaultUploadSession');
const svc = require('../services/vaultService');
const storage = require('../services/vaultStorage');
const { logActivity } = require('../utils/activityLogger');
const {
  MAX_FILE_BYTES,
  MAX_FILES_PER_UPLOAD,
  ALLOWED_FILE_TYPES,
  UPLOAD_SESSION_TTL_SEC,
} = require('../config/vault');

const MAX_FOLDERS_PER_USER = 200;

// Controllers throw `{status, message}` errors; anything else is a 500 with a
// generic message (details are logged, never returned).
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err.status && err.status < 500) {
      return res.status(err.status).json({ message: err.message, ...(err.details || {}) });
    }
    if (err.code === 11000) {
      return res.status(409).json({ message: 'A folder with this name already exists' });
    }
    console.error(`[Vault] ${req.method} ${req.originalUrl} failed:`, err.message);
    res.status(err.status || 500).json({ message: 'Something went wrong. Please try again.' });
  }
};

const httpError = (status, message, details) => Object.assign(new Error(message), { status, details });

const requireId = (value, label = 'id') => {
  if (!svc.isValidId(value)) throw httpError(400, `Invalid ${label}`);
  return svc.toObjectId(value);
};

const loadFolder = async (userId, id) => {
  const folder = await VaultFolder.findOne({ _id: requireId(id, 'folder id'), userId, deletedAt: null });
  if (!folder) throw httpError(404, 'Folder not found');
  return folder;
};

const loadReport = async (userId, id) => {
  const report = await VaultReport.findOne({ _id: requireId(id, 'report id'), userId, status: 'active' });
  if (!report) throw httpError(404, 'Report not found');
  return report;
};

const monthKey = (d) => {
  const x = new Date(d);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}`;
};

const groupByMonth = (reports) => {
  const groups = [];
  const index = new Map();
  for (const r of reports) {
    const key = monthKey(r.reportDate);
    if (!index.has(key)) {
      index.set(key, { month: key, reports: [] });
      groups.push(index.get(key));
    }
    index.get(key).reports.push(r);
  }
  return groups;
};

const trimString = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/* ═══════════════════════════ Home ═══════════════════════════ */

/**
 * One round trip for the vault home screen: folders, storage meter, unfiled
 * count. With q / from / to it also returns matching reports (search + the
 * calendar filter) and narrows the folders to those that match.
 */
exports.getHome = handle(async (req, res) => {
  const userId = req.user._id;
  const q = trimString(req.query.q, 80);
  const range = svc.dateRangeFilter(req.query.from, req.query.to);
  const filtering = !!(q || range);

  const folderQuery = { userId, deletedAt: null };
  let reports = [];

  if (filtering) {
    const reportQuery = { userId, status: 'active' };
    if (range) reportQuery.reportDate = range;
    if (q) reportQuery.title = { $regex: svc.escapeRegex(q), $options: 'i' };

    const found = await VaultReport.find(reportQuery).sort({ reportDate: -1, _id: -1 }).limit(30).lean();
    reports = found.map((r) => svc.serializeReport(r));

    // Folders that hold a report matching the whole filter (title + date)...
    const folderIdsFromReports = await VaultReport.distinct('folderId', { ...reportQuery, folderId: { $ne: null } });
    const clauses = [{ _id: { $in: folderIdsFromReports } }];
    if (q) {
      // ...or folders whose own name matches (and, with a date filter, that have a report in range).
      const nameMatch = { nameLower: { $regex: svc.escapeRegex(q.toLowerCase()) } };
      if (range) {
        const inRange = await VaultReport.distinct('folderId', { userId, status: 'active', reportDate: range, folderId: { $ne: null } });
        clauses.push({ ...nameMatch, _id: { $in: inRange } });
      } else {
        clauses.push(nameMatch);
      }
    }
    folderQuery.$or = clauses;
  }

  const [folders, usage, unfiledCount] = await Promise.all([
    VaultFolder.find(folderQuery).sort({ updatedAt: -1 }).limit(MAX_FOLDERS_PER_USER).lean(),
    svc.getUsage(req.user),
    VaultReport.countDocuments({ userId, folderId: null, status: 'active' }),
  ]);

  res.json({
    folders: folders.map(svc.serializeFolder),
    reports,
    unfiledCount,
    usage,
    limits: { maxFileBytes: MAX_FILE_BYTES, maxFilesPerUpload: MAX_FILES_PER_UPLOAD },
  });
});

exports.getUsage = handle(async (req, res) => {
  res.json({ usage: await svc.getUsage(req.user) });
});

/* ═══════════════════════════ Folders ═══════════════════════════ */

exports.createFolder = handle(async (req, res) => {
  const name = trimString(req.body.name, 80);
  if (!name) throw httpError(400, 'Folder name is required');

  const count = await VaultFolder.countDocuments({ userId: req.user._id, deletedAt: null });
  if (count >= MAX_FOLDERS_PER_USER) throw httpError(400, `You can have up to ${MAX_FOLDERS_PER_USER} folders`);

  const { category, color } = svc.resolveCategory(req.body.category);
  const folder = await VaultFolder.create({
    userId: req.user._id,
    name,
    nameLower: name.toLowerCase(),
    category,
    color,
    isAdmitted: req.body.isAdmitted === true,
  });
  res.status(201).json({ folder: svc.serializeFolder(folder) });
});

exports.getFolder = handle(async (req, res) => {
  const folder = await loadFolder(req.user._id, req.params.id);
  res.json({ folder: svc.serializeFolder(folder) });
});

exports.updateFolder = handle(async (req, res) => {
  const folder = await loadFolder(req.user._id, req.params.id);

  if (req.body.name !== undefined) {
    const name = trimString(req.body.name, 80);
    if (!name) throw httpError(400, 'Folder name cannot be empty');
    folder.name = name;
    folder.nameLower = name.toLowerCase();
  }
  if (req.body.category !== undefined) {
    const { category, color } = svc.resolveCategory(req.body.category);
    folder.category = category;
    folder.color = color;
  }
  if (req.body.isAdmitted !== undefined) folder.isAdmitted = req.body.isAdmitted === true;

  await folder.save();
  res.json({ folder: svc.serializeFolder(folder) });
});

/**
 * Deleting a folder that still has reports needs an explicit choice:
 *   ?mode=move   -> reports move to Unfiled
 *   ?mode=delete -> reports are deleted too (their share links stop working)
 * Without a mode, a non-empty folder returns 409 so the app can ask the user.
 */
exports.deleteFolder = handle(async (req, res) => {
  const userId = req.user._id;
  const folder = await loadFolder(userId, req.params.id);
  const mode = req.query.mode;
  if (mode !== undefined && !['move', 'delete'].includes(mode)) {
    throw httpError(400, 'mode must be "move" or "delete"');
  }

  const reportCount = await VaultReport.countDocuments({ userId, folderId: folder._id, status: 'active' });
  if (reportCount > 0 && !mode) {
    throw httpError(409, 'This folder contains reports. Choose to move them to Unfiled or delete them.', {
      code: 'FOLDER_NOT_EMPTY',
      reportCount,
    });
  }

  let deletedReports = 0;
  let movedReports = 0;
  if (reportCount > 0 && mode === 'move') {
    const r = await VaultReport.updateMany(
      { userId, folderId: folder._id, status: 'active' },
      { $set: { folderId: null } }
    );
    movedReports = r.modifiedCount;
  } else if (reportCount > 0 && mode === 'delete') {
    deletedReports = (await svc.softDeleteReports(userId, { folderId: folder._id })).count;
  }

  folder.deletedAt = new Date();
  await folder.save();
  res.json({ message: 'Folder deleted', movedReports, deletedReports });
});

/* ═══════════════════════════ Upload (sign → direct upload → finalize) ═══════════════════════════ */

/**
 * Step 1. Validates what the app intends to upload and returns signed
 * Cloudinary parameters per file. Nothing is stored in the vault yet.
 */
exports.signUploads = handle(async (req, res) => {
  const files = req.body.files;
  if (!Array.isArray(files) || files.length === 0) throw httpError(400, 'files is required');
  if (files.length > MAX_FILES_PER_UPLOAD) {
    throw httpError(400, `You can upload up to ${MAX_FILES_PER_UPLOAD} files at once`);
  }

  let total = 0;
  for (const [i, f] of files.entries()) {
    if (!ALLOWED_FILE_TYPES[f?.mime]) {
      throw httpError(400, `File ${i + 1}: only PDF, JPG, PNG or TXT files are allowed`);
    }
    const size = Number(f.size);
    if (!Number.isFinite(size) || size <= 0) throw httpError(400, `File ${i + 1}: size is required`);
    if (size > MAX_FILE_BYTES) {
      throw httpError(413, `File ${i + 1} is larger than ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB`, {
        code: 'FILE_TOO_LARGE',
        maxFileBytes: MAX_FILE_BYTES,
      });
    }
    total += size;
  }

  // Early, friendly quota check. The authoritative (atomic) check is in createReports.
  const usage = await svc.getUsage(req.user);
  if (usage.usedBytes + total > usage.quotaBytes) {
    throw httpError(413, 'Not enough vault storage left for these files', { code: 'QUOTA_EXCEEDED', usage });
  }

  const uploads = files.map((f, index) => ({ index, mime: f.mime, size: Number(f.size), ...storage.signUpload({ userId: req.user._id, mime: f.mime }) }));
  const expiresAt = new Date(Date.now() + UPLOAD_SESSION_TTL_SEC * 1000);

  const session = await VaultUploadSession.create({
    userId: req.user._id,
    files: uploads.map((u) => ({ publicId: u.publicId, resourceType: u.resourceType, mime: u.mime, declaredSize: u.size })),
    expiresAt,
  });

  res.status(201).json({
    sessionId: String(session._id),
    expiresAt,
    maxFileBytes: MAX_FILE_BYTES,
    uploads: uploads.map((u) => ({
      index: u.index,
      publicId: u.publicId,
      resourceType: u.resourceType,
      uploadUrl: u.uploadUrl,
      fields: u.fields,
    })),
  });
});

/**
 * Step 3. The app tells us which uploaded assets to turn into reports. Each
 * asset is verified with Cloudinary (it exists, real size and format match)
 * and must belong to this user's sign session.
 */
exports.createReports = handle(async (req, res) => {
  const userId = req.user._id;
  const { sessionId, reports } = req.body;
  if (!Array.isArray(reports) || reports.length === 0) throw httpError(400, 'reports is required');
  if (reports.length > MAX_FILES_PER_UPLOAD) throw httpError(400, `Too many reports in one request`);

  const session = await VaultUploadSession.findOne({ _id: requireId(sessionId, 'sessionId'), userId });
  if (!session) throw httpError(404, 'Upload session not found');

  let folder = null;
  if (req.body.folderId) folder = await loadFolder(userId, req.body.folderId);
  const source = req.body.source === 'camera' ? 'camera' : 'upload';

  const created = [];
  const failed = [];

  for (const item of reports) {
    const publicId = item?.publicId;
    const granted = session.files.find((f) => f.publicId === publicId);
    if (!granted) { failed.push({ publicId, reason: 'NOT_IN_SESSION' }); continue; }

    // Consume atomically so a retried/duplicated request cannot create the report twice.
    const claim = await VaultUploadSession.updateOne(
      { _id: session._id, files: { $elemMatch: { publicId, consumed: false } } },
      { $set: { 'files.$.consumed': true } }
    );
    if (claim.modifiedCount !== 1) { failed.push({ publicId, reason: 'ALREADY_USED' }); continue; }

    const cfg = ALLOWED_FILE_TYPES[granted.mime];
    const asset = await storage.getAssetInfo({ publicId, resourceType: granted.resourceType });
    if (!asset) { failed.push({ publicId, reason: 'NOT_UPLOADED' }); continue; }

    const reject = async (reason) => {
      await storage.destroyAsset({ publicId, resourceType: granted.resourceType }).catch(() => {});
      failed.push({ publicId, reason });
    };

    if (asset.bytes > MAX_FILE_BYTES) { await reject('FILE_TOO_LARGE'); continue; }
    // Raw (TXT) assets report no format; images must match what we allowed.
    if (granted.resourceType === 'image' && !cfg.formats.includes(asset.format)) { await reject('INVALID_FORMAT'); continue; }

    const reserved = await svc.reserveBytes(req.user, asset.bytes);
    if (!reserved) { await reject('QUOTA_EXCEEDED'); continue; }

    const originalName = trimString(item.originalName, 200);
    const fallbackTitle = originalName.replace(/\.[^.]+$/, '') || 'Untitled report';
    const reportDate = item.reportDate ? new Date(item.reportDate) : new Date();

    try {
      const report = await VaultReport.create({
        userId,
        folderId: folder ? folder._id : null,
        title: trimString(item.title, 160) || fallbackTitle,
        note: trimString(item.note, 1000),
        reportDate: Number.isNaN(reportDate.getTime()) ? new Date() : reportDate,
        source,
        file: {
          publicId,
          resourceType: granted.resourceType,
          format: granted.resourceType === 'raw' ? 'txt' : asset.format,
          mime: granted.mime,
          sizeBytes: asset.bytes,
          originalName,
          pageCount: asset.pages,
          encryption: 'none',
        },
      });
      created.push(svc.serializeReport(report));
    } catch (err) {
      // Roll back the quota claim and the stored asset if the record was not saved.
      await svc.releaseBytes(userId, asset.bytes);
      await storage.destroyAsset({ publicId, resourceType: granted.resourceType }).catch(() => {});
      console.error('[Vault] createReports record failed:', err.message);
      failed.push({ publicId, reason: 'SAVE_FAILED' });
    }
  }

  if (folder) await svc.refreshFolderStats(folder._id);

  if (created.length) {
    await logActivity(userId, 'UPLOAD_MEDICAL_DOCUMENT', 'medical', { count: created.length, folderId: folder ? String(folder._id) : null }, req);
  }

  res.status(created.length ? 201 : 400).json({ reports: created, failed, usage: await svc.getUsage(req.user) });
});

/* ═══════════════════════════ Reports ═══════════════════════════ */

const listReportsQuery = async (userId, query, base) => {
  const limit = svc.clampLimit(query.limit);
  const filter = { userId, status: 'active', ...base };

  const range = svc.dateRangeFilter(query.from, query.to);
  if (range) filter.reportDate = range;
  const q = trimString(query.q, 80);
  if (q) filter.title = { $regex: svc.escapeRegex(q), $options: 'i' };
  const after = svc.afterCursorFilter(query.cursor);
  if (after) filter.$and = [after];

  const rows = await VaultReport.find(filter).sort({ reportDate: -1, _id: -1 }).limit(limit + 1).lean();
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return { page, nextCursor: hasMore ? svc.encodeCursor(page[page.length - 1]) : null };
};

exports.listFolderReports = handle(async (req, res) => {
  const folder = await loadFolder(req.user._id, req.params.id);
  const { page, nextCursor } = await listReportsQuery(req.user._id, req.query, { folderId: folder._id });
  const reports = page.map((r) => svc.serializeReport(r));
  res.json({ folder: svc.serializeFolder(folder), reports, groups: groupByMonth(reports), nextCursor });
});

/** ?folderId=unfiled | <id>  (omit for every report) */
exports.listReports = handle(async (req, res) => {
  const base = {};
  if (req.query.folderId === 'unfiled') base.folderId = null;
  else if (req.query.folderId) base.folderId = requireId(req.query.folderId, 'folder id');

  const { page, nextCursor } = await listReportsQuery(req.user._id, req.query, base);
  const reports = page.map((r) => svc.serializeReport(r));
  res.json({ reports, groups: groupByMonth(reports), nextCursor });
});

/**
 * Global timeline (screen 08): reports newest-first, grouped by month. Within
 * a month, reports that live in a folder are nested under that folder entry;
 * unfiled reports appear as standalone entries.
 */
exports.getTimeline = handle(async (req, res) => {
  const userId = req.user._id;
  const { page, nextCursor } = await listReportsQuery(userId, req.query, {});

  const folderIds = [...new Set(page.filter((r) => r.folderId).map((r) => String(r.folderId)))];
  const folders = folderIds.length
    ? await VaultFolder.find({ _id: { $in: folderIds }, userId, deletedAt: null }).lean()
    : [];
  const folderById = new Map(folders.map((f) => [String(f._id), svc.serializeFolder(f)]));

  const groups = [];
  const monthIndex = new Map();
  for (const row of page) {
    const key = monthKey(row.reportDate);
    if (!monthIndex.has(key)) {
      monthIndex.set(key, { month: key, entries: [], folderEntries: new Map() });
      groups.push(monthIndex.get(key));
    }
    const g = monthIndex.get(key);
    const report = svc.serializeReport(row);
    const folder = row.folderId ? folderById.get(String(row.folderId)) : null;
    if (folder) {
      if (!g.folderEntries.has(folder.id)) {
        const entry = { type: 'folder', folder, reports: [] };
        g.folderEntries.set(folder.id, entry);
        g.entries.push(entry);
      }
      g.folderEntries.get(folder.id).reports.push(report);
    } else {
      g.entries.push({ type: 'report', report });
    }
  }

  const [folderCount, reportCount] = await Promise.all([
    VaultFolder.countDocuments({ userId, deletedAt: null }),
    VaultReport.countDocuments({ userId, status: 'active' }),
  ]);

  res.json({
    summary: { folderCount, reportCount },
    groups: groups.map(({ month, entries }) => ({ month, entries })),
    nextCursor,
  });
});

exports.getReport = handle(async (req, res) => {
  const report = await loadReport(req.user._id, req.params.id);
  const activeShareCount = await VaultShare.countDocuments({
    reportId: report._id,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  const base = `/api/v1/vault/reports/${report._id}`;
  res.json({
    report: svc.serializeReport(report, {
      // Both need the Authorization header; the file is streamed after an ownership check.
      viewPath: `${base}/file`,
      downloadPath: `${base}/download`,
      activeShareCount,
    }),
  });
});

exports.updateReport = handle(async (req, res) => {
  const userId = req.user._id;
  const report = await loadReport(userId, req.params.id);
  const previousFolderId = report.folderId;

  if (req.body.title !== undefined) {
    const title = trimString(req.body.title, 160);
    if (!title) throw httpError(400, 'Title cannot be empty');
    report.title = title;
  }
  if (req.body.note !== undefined) report.note = trimString(req.body.note, 1000);
  if (req.body.reportDate !== undefined) {
    const d = new Date(req.body.reportDate);
    if (Number.isNaN(d.getTime())) throw httpError(400, 'Invalid report date');
    report.reportDate = d;
  }
  if (req.body.folderId !== undefined) {
    report.folderId = req.body.folderId === null ? null : (await loadFolder(userId, req.body.folderId))._id;
  }

  await report.save();

  const touched = new Set([previousFolderId, report.folderId].filter(Boolean).map(String));
  await Promise.all([...touched].map((id) => svc.refreshFolderStats(id)));

  res.json({ report: svc.serializeReport(report) });
});

exports.deleteReport = handle(async (req, res) => {
  const id = requireId(req.params.id, 'report id');
  const { count } = await svc.softDeleteReports(req.user._id, { _id: id });
  if (!count) throw httpError(404, 'Report not found');
  await logActivity(req.user._id, 'DELETE_MEDICAL_DOCUMENT', 'medical', { reportId: String(id) }, req);
  res.json({ message: 'Report deleted. Its public links no longer work.' });
});

/** Stream the file to its owner (inline, or attachment with ?download=1). */
exports.getReportFile = handle(async (req, res) => {
  const report = await loadReport(req.user._id, req.params.id);
  const disposition = req.query.download === '1' ? 'attachment' : 'inline';
  await storage.sendFile(res, report.file, { disposition });
});

/**
 * Short-lived direct download URL (5 min, expiry enforced by Cloudinary's
 * signature). Legacy encrypted files must be decrypted by us, so they point
 * at the streaming endpoint instead.
 */
exports.getReportDownload = handle(async (req, res) => {
  const report = await loadReport(req.user._id, req.params.id);
  const filename = report.file.originalName || `${report.title}.${report.file.format || 'pdf'}`;

  if (storage.isLegacyFile(report.file)) {
    return res.json({ downloadPath: `/api/v1/vault/reports/${report._id}/file?download=1`, filename, requiresAuth: true });
  }
  res.json({ downloadUrl: storage.buildDownloadUrl(report.file, { expiresInSec: 300 }), expiresInSec: 300, filename });
});
