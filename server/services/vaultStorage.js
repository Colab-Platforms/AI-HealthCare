/**
 * Cloudinary access for the Medical Vault.
 *
 * Every vault asset is stored with type "authenticated" (never publicly
 * reachable). The phone uploads straight to Cloudinary with parameters we sign
 * here; we then verify the stored asset before trusting it.
 *
 * Reads never hand out a long-lived URL: downloads use Cloudinary's
 * private_download_url, whose expiry is part of the signed request, and viewing
 * is streamed through our API so access is checked on every request.
 */
const crypto = require('crypto');
const axios = require('axios');
const { cloudinary } = require('./cloudinary');
const { ALLOWED_FILE_TYPES, CLOUDINARY_ROOT } = require('../config/vault');

const DELIVERY_TYPE = 'authenticated';

const assertConfigured = () => {
  const { cloud_name, api_key, api_secret } = cloudinary.config();
  if (!cloud_name || !api_key || !api_secret) {
    const err = new Error('File storage is not configured');
    err.status = 503;
    throw err;
  }
  return { cloud_name, api_key, api_secret };
};

/** Build a public ID the client may upload to. Raw assets keep their extension. */
const buildPublicId = (userId, mime) => {
  const cfg = ALLOWED_FILE_TYPES[mime];
  const id = crypto.randomUUID();
  const base = `${CLOUDINARY_ROOT}/${userId}/${id}`;
  return cfg.resourceType === 'raw' ? `${base}.${cfg.ext}` : base;
};

/**
 * Signed parameters for one direct upload. The client POSTs `fields` plus the
 * file to `uploadUrl`. Only signed fields are honoured by Cloudinary, so the
 * client cannot change the destination, delivery type or allowed formats.
 */
const signUpload = ({ userId, mime }) => {
  const { cloud_name, api_key, api_secret } = assertConfigured();
  const cfg = ALLOWED_FILE_TYPES[mime];
  const publicId = buildPublicId(userId, mime);
  const timestamp = Math.floor(Date.now() / 1000);

  const params = { public_id: publicId, timestamp, type: DELIVERY_TYPE };
  if (cfg.resourceType === 'image') params.allowed_formats = cfg.formats.join(',');

  const signature = cloudinary.utils.api_sign_request(params, api_secret);

  return {
    publicId,
    resourceType: cfg.resourceType,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloud_name}/${cfg.resourceType}/upload`,
    fields: { ...params, api_key, signature },
  };
};

/**
 * Ask Cloudinary what was actually stored. Returns null when the asset does
 * not exist (never uploaded, or already deleted).
 */
const getAssetInfo = async ({ publicId, resourceType }) => {
  assertConfigured();
  try {
    const r = await cloudinary.api.resource(publicId, {
      resource_type: resourceType,
      type: DELIVERY_TYPE,
      pages: resourceType === 'image',
    });
    return { bytes: r.bytes, format: (r.format || '').toLowerCase(), pages: r.pages || null };
  } catch (err) {
    if (err?.error?.http_code === 404 || err?.http_code === 404) return null;
    throw err;
  }
};

const destroyAsset = async ({ publicId, resourceType }) => {
  assertConfigured();
  const r = await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    type: DELIVERY_TYPE,
    invalidate: true,
  });
  return r.result === 'ok' || r.result === 'not found';
};

/** Time-limited download URL (expiry is enforced by Cloudinary's signature). */
const buildDownloadUrl = (file, { expiresInSec = 300, attachment = true } = {}) => {
  assertConfigured();
  return cloudinary.utils.private_download_url(file.publicId, file.format || '', {
    resource_type: file.resourceType,
    type: DELIVERY_TYPE,
    attachment,
    expires_at: Math.floor(Date.now() / 1000) + expiresInSec,
  });
};

/** Files migrated from the old MedicalDocument collection keep their original URL. */
const isLegacyFile = (file) => file.encryption !== 'none' || !!file.legacyUrl;

/**
 * Fetch a report file's bytes as a stream (or a decrypted buffer for legacy
 * blobs). The caller pipes it to the response.
 */
const openFile = async (file) => {
  if (file.encryption === 'aes-cbc-legacy') {
    const resp = await axios.get(file.legacyUrl, { responseType: 'arraybuffer', timeout: 30000 });
    // Lazy: utils/encryption reads VAULT_ENCRYPTION_KEY at import time and
    // throws without it; only legacy blobs need it.
    const { decrypt } = require('../utils/encryption');
    return { buffer: decrypt(Buffer.from(resp.data)) };
  }
  if (file.legacyUrl) {
    // Migrated, unencrypted old document: its stored URL already carries Cloudinary's signature.
    const resp = await axios.get(file.legacyUrl, { responseType: 'stream', timeout: 30000 });
    return { stream: resp.data, contentLength: resp.headers['content-length'] };
  }
  const resp = await axios.get(buildDownloadUrl(file, { expiresInSec: 60 }), {
    responseType: 'stream',
    timeout: 30000,
  });
  return { stream: resp.data, contentLength: resp.headers['content-length'] };
};

/** Send a file to an Express response, inline (view) or as an attachment. */
const sendFile = async (res, file, { disposition = 'inline', filename } = {}) => {
  const { stream, buffer, contentLength } = await openFile(file);
  const safeName = encodeURIComponent(filename || file.originalName || 'report');
  res.setHeader('Content-Type', file.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${safeName}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  if (buffer) {
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  }
  if (contentLength) res.setHeader('Content-Length', contentLength);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
};

module.exports = {
  signUpload,
  getAssetInfo,
  destroyAsset,
  buildDownloadUrl,
  isLegacyFile,
  openFile,
  sendFile,
};
