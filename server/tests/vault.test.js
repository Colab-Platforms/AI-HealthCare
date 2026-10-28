/**
 * Medical Vault: logic that can be verified without a database or Cloudinary
 * account — pagination cursors, regex escaping, category resolution, upload
 * signing, share-token hashing, and the legacy migration mapping.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
process.env.CLOUDINARY_API_KEY = '123456';
process.env.CLOUDINARY_API_SECRET = 'test-secret';

const svc = require('../services/vaultService');
const storage = require('../services/vaultStorage');
const { hashToken, newToken } = require('../controllers/vaultShareController');
const { toVaultReport } = require('../scripts/migrateLegacyVaultDocs');
const config = require('../config/vault');

const ID = '64b7f0c2a1b2c3d4e5f60718';

test('cursor round-trips and rejects garbage', () => {
  const row = { reportDate: new Date('2026-03-10T00:00:00Z'), _id: ID };
  const decoded = svc.decodeCursor(svc.encodeCursor(row));
  assert.equal(decoded.date.toISOString(), '2026-03-10T00:00:00.000Z');
  assert.equal(String(decoded.id), ID);

  assert.equal(svc.decodeCursor('not-a-cursor'), null);
  assert.equal(svc.decodeCursor(undefined), null);
  assert.equal(svc.afterCursorFilter('%%%'), null);
});

test('cursor filter continues strictly after (date desc, id desc)', () => {
  const f = svc.afterCursorFilter(svc.encodeCursor({ reportDate: new Date('2026-03-10T00:00:00Z'), _id: ID }));
  assert.equal(f.$or.length, 2);
  assert.ok(f.$or[0].reportDate.$lt instanceof Date);
  assert.ok(f.$or[1]._id.$lt);
});

test('escapeRegex neutralises user input (no ReDoS / injection)', () => {
  const evil = '(a+)+$.*[x]';
  const re = new RegExp(svc.escapeRegex(evil));
  assert.ok(re.test(evil));
  assert.ok(!re.test('aaaa'));
});

test('dateRangeFilter covers the whole end day and validates input', () => {
  const r = svc.dateRangeFilter('2026-02-01', '2026-02-28');
  assert.equal(r.$lte.getUTCHours(), 23);
  assert.throws(() => svc.dateRangeFilter('nope'), /Invalid/);
  assert.equal(svc.dateRangeFilter(undefined, undefined), null);
});

test('clampLimit stays within bounds', () => {
  assert.equal(svc.clampLimit('9999'), 50);
  assert.equal(svc.clampLimit('0'), 20);
  assert.equal(svc.clampLimit(undefined), 20);
  assert.equal(svc.clampLimit('5'), 5);
});

test('resolveCategory: preset, custom, and empty', () => {
  const preset = svc.resolveCategory({ key: 'illness' });
  assert.equal(preset.category.type, 'preset');
  assert.equal(preset.category.label, 'Illness');

  const custom = svc.resolveCategory({ label: '  Diabetes  ' });
  assert.equal(custom.category.type, 'custom');
  assert.equal(custom.category.label, 'Diabetes');

  // An unknown preset key falls back to the label, and fails if there is none.
  assert.throws(() => svc.resolveCategory({ key: 'made_up' }), /category/i);
  assert.throws(() => svc.resolveCategory(undefined), /category/i);
});

test('signUpload: private, per-user path, signed, and image-only format lock', () => {
  const pdf = storage.signUpload({ userId: ID, mime: 'application/pdf' });
  assert.equal(pdf.resourceType, 'image');
  assert.equal(pdf.fields.type, 'authenticated');
  assert.equal(pdf.fields.allowed_formats, 'pdf');
  assert.ok(pdf.publicId.startsWith(`takehealth/vault/${ID}/`));
  assert.match(pdf.uploadUrl, /demo-cloud\/image\/upload$/);
  assert.ok(pdf.fields.signature);
  assert.equal(pdf.fields.api_key, '123456');

  const txt = storage.signUpload({ userId: ID, mime: 'text/plain' });
  assert.equal(txt.resourceType, 'raw');
  assert.ok(txt.publicId.endsWith('.txt'));
  assert.equal(txt.fields.allowed_formats, undefined);

  // Two calls never reuse a destination.
  assert.notEqual(pdf.publicId, storage.signUpload({ userId: ID, mime: 'application/pdf' }).publicId);
});

test('download URL is time-limited and attachment-flagged', () => {
  const url = storage.buildDownloadUrl(
    { publicId: 'takehealth/vault/u/x', resourceType: 'image', format: 'pdf' },
    { expiresInSec: 300 }
  );
  assert.match(url, /expires_at=\d+/);
  assert.match(url, /signature=/);
  const exp = Number(url.match(/expires_at=(\d+)/)[1]);
  assert.ok(exp > Date.now() / 1000 && exp <= Date.now() / 1000 + 301);
});

test('share tokens are 43-char url-safe, unique, and hashed deterministically', () => {
  const a = newToken();
  const b = newToken();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, b);
  assert.equal(hashToken(a), hashToken(a));
  assert.notEqual(hashToken(a), a);
  assert.equal(hashToken(a).length, 64);
});

test('isLegacyFile distinguishes migrated files from new uploads', () => {
  assert.equal(storage.isLegacyFile({ encryption: 'none' }), false);
  assert.equal(storage.isLegacyFile({ encryption: 'aes-cbc-legacy' }), true);
  assert.equal(storage.isLegacyFile({ encryption: 'none', legacyUrl: 'https://x/y' }), true);
});

test('migration maps a legacy document to an unfiled legacy report', () => {
  const doc = {
    _id: ID,
    userId: ID,
    title: 'CBC',
    notes: 'fasting',
    hospital: 'City Lab',
    doctorName: 'Dr Mehta',
    documentDate: new Date('2025-01-05'),
    fileUrl: 'https://res.cloudinary.com/c/raw/authenticated/v1/takehealth/medical_documents/abc',
    originalName: 'cbc.pdf',
    mimetype: 'application/pdf',
    size: 1234,
    isEncrypted: true,
  };
  const r = toVaultReport(doc, (u) => 'takehealth/medical_documents/abc');
  assert.equal(r.folderId, null);
  assert.equal(r.source, 'legacy');
  assert.equal(r.file.encryption, 'aes-cbc-legacy');
  assert.equal(r.file.legacyUrl, doc.fileUrl);
  assert.equal(r.file.format, 'pdf');
  assert.match(r.note, /fasting/);
  assert.match(r.note, /City Lab/);
  assert.match(r.note, /Dr Mehta/);
});

test('free-tier limits default to 10MB per file, 1GB quota, and are env-overridable', () => {
  assert.equal(config.MAX_FILE_BYTES, 10 * 1024 * 1024);
  assert.equal(config.DEFAULT_QUOTA_BYTES, 1024 * 1024 * 1024);
  assert.equal(config.quotaForPlan('premium'), config.DEFAULT_QUOTA_BYTES);
});
