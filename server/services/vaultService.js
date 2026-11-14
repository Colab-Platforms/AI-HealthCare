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
const {
  MB,
  FREE_BASE_BYTES,
  GRANT_BYTES_PER_PAYMENT,
  GRANTING_PLAN_KEYS,
  PRESET_CATEGORIES,
  FOLDER_COLORS,
  PURGE_GRACE_HOURS,
} = require('../config/vault');

/* ───────────────────────── helpers ───────────────────────── */

const toObjectId = (v) => (v instanceof mongoose.Types.ObjectId ? v : new mongoose.Types.ObjectId(v));
const isValidId = (v) => mongoose.isValidObjectId(v) && String(new mongoose.Types.ObjectId(v)) === String(v);

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const badRequest = (message, extra = {}) => Object.assign(new Error(message), { status: 400, ...extra });

/* ───────────────────────── quota ─────────────────────────
 * limit = FREE_BASE_BYTES + grantedBytes (see config/vault.js for the rules).
 * Pipeline updates run with { timestamps: false } because Mongoose cannot
 * merge its updatedAt $set into an aggregation-pipeline update.
 */

/** Is this user currently on a paid plan whose period has not ended? */
const isPaidActive = (user) => {
  const sub = user?.subscription;
  if (!sub || !GRANTING_PLAN_KEYS.includes(sub.plan)) return false;
  if (sub.status === 'expired' || sub.status === 'inactive') return false;
  const end = sub.currentPeriodEnd || sub.endDate;
  return !!end && new Date(end) > new Date();
};

/** Pure: shape the usage block returned to the app. */
const buildUsage = ({ usedBytes = 0, grantedBytes = 0 }, { planKey = 'free', paidActive = false } = {}) => {
  const limitBytes = FREE_BASE_BYTES + grantedBytes;
  return {
    usedBytes,
    limitBytes,
    remainingBytes: Math.max(0, limitBytes - usedBytes),
    baseBytes: FREE_BASE_BYTES,
    earnedBytes: grantedBytes,
    overLimit: usedBytes > limitBytes,
    plan: { key: planKey, paidActive },
    quotaBytes: limitBytes, // deprecated alias of limitBytes, kept so older app builds keep working
  };
};

const ensureUsage = (userId) =>
  VaultUsage.updateOne(
    { userId },
    { $setOnInsert: { usedBytes: 0, grantedBytes: 0, quotaBytes: FREE_BASE_BYTES } },
    { upsert: true }
  );

/**
 * Recompute the stored quota from the current config and the user's grants,
 * and return the usage document. Safe to call on every request.
 */
const refreshQuota = (userId) =>
  VaultUsage.findOneAndUpdate(
    { userId },
    [
      {
        $set: {
          usedBytes: { $ifNull: ['$usedBytes', 0] },
          grantedBytes: { $ifNull: ['$grantedBytes', 0] },
          quotaBytes: { $add: [FREE_BASE_BYTES, { $ifNull: ['$grantedBytes', 0] }] },
        },
      },
    ],
    { new: true, timestamps: false }
  ).lean();

const getUsage = async (user) => {
  await ensureUsage(user._id);
  const doc = await refreshQuota(user._id);
  return buildUsage(doc, { planKey: user.subscription?.plan || 'free', paidActive: isPaidActive(user) });
};

/** Pure: the humble "storage full" payload for the app. */
const describeStorageLimit = (usage, requestedBytes = 0) => {
  const grantMb = Math.round(GRANT_BYTES_PER_PAYMENT / MB);
  const upgradeAvailable = !usage.plan.paidActive;

  let message;
  if (usage.overLimit) {
    message = upgradeAvailable
      ? 'Your vault is over its storage limit. You can still view and download your documents. Delete some or upgrade your plan to add new ones.'
      : 'Your vault is over its storage limit. You can still view and download your documents. Delete a few to add new ones.';
  } else if (upgradeAvailable) {
    message = 'Your vault storage is full. Please upgrade your plan to add more documents.';
  } else {
    message = `Your vault storage is full. Your storage grows by ${grantMb} MB with every monthly payment.`;
  }

  return {
    code: 'STORAGE_LIMIT_EXCEEDED',
    message,
    usage,
    requestedBytes,
    upgrade: { available: upgradeAvailable, planKey: 'take_plus', grantBytesPerPayment: GRANT_BYTES_PER_PAYMENT },
  };
};

/** Error (HTTP 403) carrying describeStorageLimit's payload; controllers spread `details` into the response. */
const storageLimitError = (usage, requestedBytes = 0) => {
  const { message, ...details } = describeStorageLimit(usage, requestedBytes);
  return Object.assign(new Error(message), { status: 403, details });
};

/** Throws STORAGE_LIMIT_EXCEEDED unless `bytes` more still fit. Returns the usage block. */
const assertCanStore = async (user, bytes) => {
  const usage = await getUsage(user);
  if (usage.overLimit || usage.usedBytes + bytes > usage.limitBytes) throw storageLimitError(usage, bytes);
  return usage;
};

/**
 * Atomically claim `bytes` of the user's quota. The conditional filter makes
 * concurrent uploads unable to exceed the limit. Returns false when full.
 */
const reserveBytes = async (user, bytes) => {
  await getUsage(user); // ensure the doc exists and quotaBytes is current
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
    [{ $set: { usedBytes: { $max: [0, { $subtract: [{ $ifNull: ['$usedBytes', 0] }, bytes] }] } } }],
    { timestamps: false }
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
  isPaidActive,
  buildUsage,
  ensureUsage,
  refreshQuota,
  getUsage,
  describeStorageLimit,
  storageLimitError,
  assertCanStore,
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
