/**
 * Public (no login) access to a shared vault report.
 *
 * Every response for a bad, revoked, expired or deleted link is the same 404,
 * so a caller cannot tell which links exist. Files are streamed through this
 * server rather than redirected to Cloudinary, which lets a view-only link
 * never expose a download URL.
 */
const VaultShare = require('../models/VaultShare');
const VaultReport = require('../models/VaultReport');
const storage = require('../services/vaultStorage');
const { hashToken } = require('./vaultShareController');

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const GONE = { message: 'This link is invalid or has expired.' };

const noIndexHeaders = (res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'private, no-store');
};

/** Returns { share, report } for a live link, otherwise null. */
const resolve = async (token) => {
  if (!TOKEN_RE.test(token || '')) return null;
  const share = await VaultShare.findOne({
    tokenHash: hashToken(token),
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!share) return null;
  const report = await VaultReport.findOne({ _id: share.reportId, status: 'active' });
  if (!report) return null;
  return { share, report };
};

const touch = (share) =>
  VaultShare.updateOne({ _id: share._id }, { $inc: { accessCount: 1 }, $set: { lastAccessAt: new Date() } }).catch(() => {});

const shape = (token, { share, report }) => {
  const base = `/api/public/shares/${token}`;
  return {
    title: report.title,
    reportDate: report.reportDate,
    file: {
      mime: report.file.mime,
      format: report.file.format,
      sizeBytes: report.file.sizeBytes,
      pageCount: report.file.pageCount,
    },
    allowDownload: share.allowDownload,
    expiresAt: share.expiresAt,
    filePath: `${base}/file`,
    downloadPath: share.allowDownload ? `${base}/file?download=1` : null,
  };
};

exports.getShare = async (req, res) => {
  noIndexHeaders(res);
  try {
    const hit = await resolve(req.params.token);
    if (!hit) return res.status(404).json(GONE);
    touch(hit.share);
    res.json(shape(req.params.token, hit));
  } catch (err) {
    console.error('[Vault] public getShare failed:', err.message);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

exports.getShareFile = async (req, res) => {
  noIndexHeaders(res);
  try {
    const hit = await resolve(req.params.token);
    if (!hit) return res.status(404).json(GONE);

    const wantsDownload = req.query.download === '1';
    if (wantsDownload && !hit.share.allowDownload) {
      return res.status(403).json({ message: 'The owner of this report has not allowed downloads.' });
    }
    await storage.sendFile(res, hit.report.file, { disposition: wantsDownload ? 'attachment' : 'inline' });
  } catch (err) {
    console.error('[Vault] public getShareFile failed:', err.message);
    if (!res.headersSent) res.status(500).json({ message: 'Could not load this report.' });
  }
};

/* ───────────────────────── HTML viewer (/r/:token) ───────────────────────── */

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const page = (body, title = 'Shared report') => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="referrer" content="no-referrer">
<title>${esc(title)}</title>
<style>
  :root{color-scheme:light dark;--bg:#f1f5f7;--fg:#14212b;--muted:#5b6b78;--bar:#14212b;--barfg:#fff;--card:#fff;--accent:#2b3f86}
  @media (prefers-color-scheme:dark){:root{--bg:#0f1519;--fg:#e8eef2;--muted:#93a3b0;--bar:#0a0f12;--card:#182026;--accent:#8fa6ff}}
  *{box-sizing:border-box}html,body{height:100%}
  body{margin:0;font:16px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--fg);display:flex;flex-direction:column}
  .bar{background:var(--bar);color:var(--barfg);padding:12px 16px;font-size:13px}
  .bar b{font-weight:600}
  .meta{padding:14px 16px;background:var(--card)}
  .meta h1{font-size:18px;margin:0 0 2px}.meta p{margin:0;color:var(--muted);font-size:13px}
  .view{flex:1;min-height:0;padding:12px;display:flex;justify-content:center;align-items:flex-start;overflow:auto}
  .view img{max-width:100%;height:auto;border-radius:8px;background:var(--card)}
  .view iframe{width:100%;height:100%;min-height:70vh;border:0;border-radius:8px;background:var(--card)}
  .foot{padding:12px 16px}
  .btn{display:block;text-align:center;padding:14px;border-radius:12px;background:var(--accent);color:#fff;text-decoration:none;font-weight:600}
  .gone{margin:auto;padding:32px 24px;text-align:center;max-width:360px}.gone h1{font-size:20px}.gone p{color:var(--muted)}
</style></head><body>${body}</body></html>`;

exports.renderViewer = async (req, res) => {
  noIndexHeaders(res);
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; frame-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
  res.type('html');
  try {
    const hit = await resolve(req.params.token);
    if (!hit) {
      return res.status(404).send(page(
        `<div class="gone"><h1>Link unavailable</h1><p>This link is invalid or has expired. Ask the sender for a new one.</p></div>`,
        'Link unavailable'
      ));
    }
    touch(hit.share);
    const d = shape(req.params.token, hit);
    const isImage = d.file.mime.startsWith('image/');
    const viewer = isImage
      ? `<img src="${esc(d.filePath)}" alt="${esc(d.title)}">`
      : `<iframe src="${esc(d.filePath)}" title="${esc(d.title)}"></iframe>`;
    const expires = new Date(d.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    const reportDate = new Date(d.reportDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    const access = d.allowDownload ? 'download allowed' : 'view only';

    res.send(page(`
      <div class="bar"><b>Shared with you via HealthVault</b><br>${esc(access)} · link works until ${esc(expires)}</div>
      <div class="meta"><h1>${esc(d.title)}</h1><p>Report date ${esc(reportDate)}</p></div>
      <div class="view">${viewer}</div>
      ${d.allowDownload ? `<div class="foot"><a class="btn" href="${esc(d.downloadPath)}">Download report</a></div>` : ''}
    `, d.title));
  } catch (err) {
    console.error('[Vault] viewer failed:', err.message);
    res.status(500).send(page(`<div class="gone"><h1>Something went wrong</h1><p>Please try again.</p></div>`));
  }
};
