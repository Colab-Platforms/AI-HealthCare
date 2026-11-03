/**
 * Medical Vault business logic shared by the controllers and jobs:
 * quota accounting, folder stats, cursor pagination and response shaping.
 */
const mongoose = require('mongoose');
const VaultFolder = require('../models/VaultFolder');
const VaultReport = require('../models/VaultReport');
const VaultUsage = require('../models/VaultUsage');
const VaultShare = require('../models/VaultShare');
const storage = require('./vaultStorage');
const { quotaForPlan, PRESET_CATEGORIES, FOLDER_COLORS, PURGE_GRACE_HOURS } = require('../config/vault');

/* ───────────────────────── helpers ───────────────────────── */

const toObjectId = (v) => (v instanceof mongoose.Types.ObjectId ? v : new mongoose.Types.ObjectId(v));
const isValidId = (v) => mongoose.isValidObjectId(v) && String(new mongoose.Types.ObjectId(v)) === String(v);

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const badRequest = (message, extra = {}) => Object.assign(new Error(message), { status: 400, ...extra });

/* ───────────────────────── quota ───────────────────────── */

const getUsage = async (user) => {
  const quotaBytes = quotaForPlan(user.subscription?.plan);
  // $setOnInsert keeps an existing counter; quotaBytes is refreshed below so a
  // plan change takes effect without a migration.
  await VaultUsage.updateOne(
    { userId: user._id },
    { $setOnInsert: { usedBytes: 0 } },
    { upsert: true }
  );
  const usage = await VaultUsage.findOneAndUpdate(
    { userId: user._id },
    { $set: { quotaBytes } },
    { new: true }
  ).lean();
  return { usedBytes: usage.usedBytes, quotaBytes: usage.quotaBytes };
};

/**
 * Atomically claim `bytes` of the user's quota. The conditional filter makes
 * concurrent uploads unable to exceed the quota. Returns false when full.
 */
const reserveBytes = async (user, bytes) => {
  await getUsage(user); // ensure the doc exists and quota is current
  const res = await VaultUsage.updateOne(
    {
      userId: user._id,
      $expr: { $lte: [{ $add: ['$usedBytes', bytes] }, '$quotaBytes'] },
    },
    { $inc: { usedBytes: bytes } }
  );
  return res.modifiedCount === 1;
};

const releaseBytes = async (userId, bytes) => {
  if (!bytes) return;
  // Pipeline update clamps at zero so a double release can never go negative.
  await VaultUsage.updateOne(
    { userId },
    [{ $set: { usedBytes: { $max: [0, { $subtract: ['$usedBytes', bytes] }] } } }]
  );
};

/* ───────────────────────── folder stats ───────────────────────── */

const refreshFolderStats = async (folderId) => {
  if (!folderId) return;
  const [agg] = await VaultReport.aggregate([
    { $match: { folderId: toObjectId(folderId), status: 'active' } },
    {
      $group: {
        _id: null,
        reportCount: { $sum: 1 },
        totalBytes: { $sum: '$file.sizeBytes' },
        firstReportDate: { $min: '$reportDate' },
        latestReportDate: { $max: '$reportDate' },
      },
    },
  ]);
  await VaultFolder.updateOne(
    { _id: folderId },
    {
      $set: {
        'stats.reportCount': agg?.reportCount || 0,
        'stats.totalBytes': agg?.totalBytes || 0,
        'stats.firstReportDate': agg?.firstReportDate || null,
        'stats.latestReportDate': agg?.latestReportDate || null,
      },
    }
  );
};

/* ───────────────────────── category ───────────────────────── */

/** Accepts {key} for a preset or {label} for a custom category. */
const resolveCategory = (input) => {
  if (input && typeof input === 'object' && input.key && PRESET_CATEGORIES[input.key]) {
    return {
      category: { type: 'preset', key: input.key, label: PRESET_CATEGORIES[input.key] },
      color: FOLDER_COLORS[input.key],
    };
  }
  const label = String(input?.label || '').trim().slice(0, 40);
  if (!label) throw badRequest('Choose a category or type your own');
  return { category: { type: 'custom', key: 'custom', label }, color: FOLDER_COLORS.custom };
};

/* ───────────────────────── cursor pagination ───────────────────────── */

const encodeCursor = (r) => Buffer.from(`${new Date(r.reportDate).getTime()}_${r._id}`).toString('base64url');

const decodeCursor = (cursor) => {
  if (!cursor) return null;
  try {
    const [ms, id] = Buffer.from(String(cursor), 'base64url').toString().split('_');
    const date = new Date(Number(ms));
    if (Number.isNaN(date.getTime()) || !isValidId(id)) return null;
    return { date, id: toObjectId(id) };
  } catch {
    return null;
  }
};

/** Mongo filter that continues strictly after the cursor (reportDate desc, _id desc). */
const afterCursorFilter = (cursor) => {
  const c = decodeCursor(cursor);
  if (!c) return null;
  return {
    $or: [
      { reportDate: { $lt: c.date } },
      { reportDate: c.date, _id: { $lt: c.id } },
    ],
  };
};

const dateRangeFilter = (from, to) => {
  const range = {};
  if (from) {
    const d = new Date(from);
    if (Number.isNaN(d.getTime())) throw badRequest('Invalid "from" date');
    range.$gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (Number.isNaN(d.getTime())) throw badRequest('Invalid "to" date');
    d.setUTCHours(23, 59, 59, 999);
    range.$lte = d;
  }
  return Object.keys(range).length ? range : null;
};

const clampLimit = (raw, def = 20, max = 50) => Math.min(max, Math.max(1, parseInt(raw, 10) || def));

/* ───────────────────────── serializers ───────────────────────── */

const serializeFolder = (f) => ({
  id: String(f._id),
  name: f.name,
  category: f.category,
  isAdmitted: !!f.isAdmitted,
  color: f.color,
  stats: {
    reportCount: f.stats?.reportCount || 0,
    totalBytes: f.stats?.totalBytes || 0,
    firstReportDate: f.stats?.firstReportDate || null,
    latestReportDate: f.stats?.latestReportDate || null,
  },
  createdAt: f.createdAt,
  updatedAt: f.updatedAt,
});

const serializeReport = (r, extra = {}) => ({
  id: String(r._id),
  folderId: r.folderId ? String(r.folderId) : null,
  title: r.title,
  note: r.note || '',
  reportDate: r.reportDate,
  source: r.source,
  file: {
    mime: r.file.mime,
    format: r.file.format,
    sizeBytes: r.file.sizeBytes,
    originalName: r.file.originalName,
    pageCount: r.file.pageCount,
  },
  createdAt: r.createdAt,
  ...extra,
});

/* ───────────────────────── deletion ───────────────────────── */

/**
 * Soft-delete reports: they vanish immediately, their share links stop
 * working, quota is released, and the purge job destroys the Cloudinary
 * assets after a grace period.
 */
const softDeleteReports = async (userId, filter) => {
  const reports = await VaultReport.find({ ...filter, userId, status: 'active' })
    .select('_id folderId file.sizeBytes')
    .lean();
  if (!reports.length) return { count: 0, folderIds: [] };

  const ids = reports.map((r) => r._id);
  const now = new Date();
  await VaultReport.updateMany(
    { _id: { $in: ids } },
    { $set: { status: 'deleted', deletedAt: now, purgeAfter: new Date(now.getTime() + PURGE_GRACE_HOURS * 3600 * 1000) } }
  );
  await VaultShare.updateMany({ reportId: { $in: ids }, revokedAt: null }, { $set: { revokedAt: now } });
  await releaseBytes(userId, reports.reduce((sum, r) => sum + (r.file?.sizeBytes || 0), 0));

  const folderIds = [...new Set(reports.filter((r) => r.folderId).map((r) => String(r.folderId)))];
  await Promise.all(folderIds.map(refreshFolderStats));
  return { count: reports.length, folderIds };
};

module.exports = {
  isValidId,
  toObjectId,
  escapeRegex,
  badRequest,
  getUsage,
  reserveBytes,
  releaseBytes,
  refreshFolderStats,
  resolveCategory,
  encodeCursor,
  decodeCursor,
  afterCursorFilter,
  dateRangeFilter,
  clampLimit,
  serializeFolder,
  serializeReport,
  softDeleteReports,
  storage,
};
