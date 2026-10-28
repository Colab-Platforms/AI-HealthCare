/**
 * Owner-side share management for vault reports.
 *
 * A share link is an opaque random token. We keep only its SHA-256 hash, so the
 * raw link is shown exactly once, in the create response. The recipient needs
 * no account. View-only is the default; downloading must be allowed by the
 * owner when the link is created and cannot be changed afterwards (create a
 * new link instead).
 */
const crypto = require('crypto');
const VaultShare = require('../models/VaultShare');
const VaultReport = require('../models/VaultReport');
const svc = require('../services/vaultService');
const { logActivity } = require('../utils/activityLogger');
const { SHARE_EXPIRY_DAYS } = require('../config/vault');

const MAX_ACTIVE_LINKS_PER_REPORT = 10;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('base64url'); // 43 chars

const shareBaseUrl = (req) =>
  (process.env.VAULT_SHARE_BASE_URL || process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');

const activeFilter = () => ({ revokedAt: null, expiresAt: { $gt: new Date() } });

const serializeShare = (s, extra = {}) => ({
  id: String(s._id),
  reportId: String(s.reportId),
  allowDownload: !!s.allowDownload,
  expiresAt: s.expiresAt,
  accessCount: s.accessCount || 0,
  lastAccessAt: s.lastAccessAt || null,
  createdAt: s.createdAt,
  ...extra,
});

const fail = (res, status, message, extra = {}) => res.status(status).json({ message, ...extra });

exports.createShare = async (req, res) => {
  try {
    if (!svc.isValidId(req.params.id)) return fail(res, 400, 'Invalid report id');
    const report = await VaultReport.findOne({ _id: req.params.id, userId: req.user._id, status: 'active' }).select('_id').lean();
    if (!report) return fail(res, 404, 'Report not found');

    const days = req.body.expiresInDays === undefined ? SHARE_EXPIRY_DAYS.default : Number(req.body.expiresInDays);
    if (!Number.isInteger(days) || days < SHARE_EXPIRY_DAYS.min || days > SHARE_EXPIRY_DAYS.max) {
      return fail(res, 400, `expiresInDays must be a whole number between ${SHARE_EXPIRY_DAYS.min} and ${SHARE_EXPIRY_DAYS.max}`);
    }
    // Strict: only a real boolean true enables downloads. Anything else stays view-only.
    const allowDownload = req.body.allowDownload === true;

    const activeCount = await VaultShare.countDocuments({ reportId: report._id, ...activeFilter() });
    if (activeCount >= MAX_ACTIVE_LINKS_PER_REPORT) {
      return fail(res, 400, `This report already has ${MAX_ACTIVE_LINKS_PER_REPORT} active links. Revoke one first.`);
    }

    const token = newToken();
    const share = await VaultShare.create({
      reportId: report._id,
      userId: req.user._id,
      tokenHash: hashToken(token),
      allowDownload,
      expiresAt: new Date(Date.now() + days * 24 * 3600 * 1000),
    });

    await logActivity(req.user._id, 'VAULT_SHARE_CREATED', 'medical', { reportId: String(report._id), days, allowDownload }, req);

    res.status(201).json({ share: serializeShare(share, { url: `${shareBaseUrl(req)}/r/${token}` }) });
  } catch (err) {
    console.error('[Vault] createShare failed:', err.message);
    fail(res, 500, 'Something went wrong. Please try again.');
  }
};

exports.listShares = async (req, res) => {
  try {
    if (!svc.isValidId(req.params.id)) return fail(res, 400, 'Invalid report id');
    const report = await VaultReport.exists({ _id: req.params.id, userId: req.user._id, status: 'active' });
    if (!report) return fail(res, 404, 'Report not found');

    const shares = await VaultShare.find({ reportId: req.params.id, ...activeFilter() }).sort({ createdAt: -1 }).lean();
    res.json({ shares: shares.map((s) => serializeShare(s)) });
  } catch (err) {
    console.error('[Vault] listShares failed:', err.message);
    fail(res, 500, 'Something went wrong. Please try again.');
  }
};

exports.revokeShare = async (req, res) => {
  try {
    if (!svc.isValidId(req.params.shareId)) return fail(res, 400, 'Invalid share id');
    const result = await VaultShare.updateOne(
      { _id: req.params.shareId, userId: req.user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    if (!result.matchedCount) return fail(res, 404, 'Share link not found');
    res.json({ message: 'Link revoked. It no longer works.' });
  } catch (err) {
    console.error('[Vault] revokeShare failed:', err.message);
    fail(res, 500, 'Something went wrong. Please try again.');
  }
};

exports.hashToken = hashToken;
exports.newToken = newToken;
