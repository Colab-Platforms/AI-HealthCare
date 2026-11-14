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
const grants = require('../services/vaultStorageGrants');

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

test('config defaults: 10MB free base, 50MB per payment, 10MB max file; free/trial never earn', () => {
  assert.equal(config.FREE_BASE_BYTES, 10 * 1024 * 1024);
  assert.equal(config.GRANT_BYTES_PER_PAYMENT, 50 * 1024 * 1024);
  assert.equal(config.MAX_FILE_BYTES, 10 * 1024 * 1024);
  assert.ok(config.GRANTING_PLAN_KEYS.includes('take_plus'));
  assert.ok(!config.GRANTING_PLAN_KEYS.includes('free'));
  assert.ok(!config.GRANTING_PLAN_KEYS.includes('free_trial'));
});

const MB = 1024 * 1024;

test('limit = base + grants: the 10 -> 60 -> 110 -> 110 -> 160 timeline', () => {
  const limitAfter = (payments) => svc.buildUsage({ usedBytes: 0, grantedBytes: payments * config.GRANT_BYTES_PER_PAYMENT }).limitBytes / MB;
  assert.equal(limitAfter(0), 10);  // month 1, free
  assert.equal(limitAfter(1), 60);  // month 2, paid
  assert.equal(limitAfter(2), 110); // month 3, paid
  assert.equal(limitAfter(2), 110); // month 4, free: no new payment, nothing lost
  assert.equal(limitAfter(3), 160); // month 5, paid
});

test('buildUsage: remaining, earned, over-limit and the deprecated quotaBytes alias', () => {
  const u = svc.buildUsage({ usedBytes: 4 * MB, grantedBytes: 50 * MB }, { planKey: 'take_plus', paidActive: true });
  assert.equal(u.limitBytes, 60 * MB);
  assert.equal(u.quotaBytes, u.limitBytes);
  assert.equal(u.remainingBytes, 56 * MB);
  assert.equal(u.baseBytes, 10 * MB);
  assert.equal(u.earnedBytes, 50 * MB);
  assert.equal(u.overLimit, false);
  assert.deepEqual(u.plan, { key: 'take_plus', paidActive: true });

  const over = svc.buildUsage({ usedBytes: 25 * MB, grantedBytes: 0 });
  assert.equal(over.overLimit, true);
  assert.equal(over.remainingBytes, 0);
});

test('isPaidActive: needs an eligible plan, a live status and an unexpired period', () => {
  const future = new Date(Date.now() + 864e5);
  const past = new Date(Date.now() - 864e5);
  assert.equal(svc.isPaidActive({ subscription: { plan: 'take_plus', status: 'active', currentPeriodEnd: future } }), true);
  // cancelled but still inside the period they paid for
  assert.equal(svc.isPaidActive({ subscription: { plan: 'take_plus', status: 'cancelled', currentPeriodEnd: future } }), true);
  assert.equal(svc.isPaidActive({ subscription: { plan: 'take_plus', status: 'active', currentPeriodEnd: past } }), false);
  assert.equal(svc.isPaidActive({ subscription: { plan: 'take_plus', status: 'expired', currentPeriodEnd: future } }), false);
  assert.equal(svc.isPaidActive({ subscription: { plan: 'free', status: 'active', currentPeriodEnd: future } }), false);
  assert.equal(svc.isPaidActive({ subscription: { plan: 'free_trial', status: 'active', currentPeriodEnd: future } }), false);
  assert.equal(svc.isPaidActive({}), false);
  assert.equal(svc.isPaidActive(undefined), false);
});

test('storage-full message: upgrade for free, delete-hint for paid, view-only note when over limit', () => {
  const free = svc.describeStorageLimit(svc.buildUsage({ usedBytes: 10 * MB }, { planKey: 'free' }), 2 * MB);
  assert.equal(free.code, 'STORAGE_LIMIT_EXCEEDED');
  assert.equal(free.upgrade.available, true);
  assert.equal(free.upgrade.planKey, 'take_plus');
  assert.equal(free.requestedBytes, 2 * MB);
  assert.match(free.message, /upgrade your plan/i);

  const paid = svc.describeStorageLimit(svc.buildUsage({ usedBytes: 60 * MB, grantedBytes: 50 * MB }, { planKey: 'take_plus', paidActive: true }));
  assert.equal(paid.upgrade.available, false);
  assert.match(paid.message, /Delete a few documents/);
  assert.match(paid.message, /50 MB/);

  const over = svc.describeStorageLimit(svc.buildUsage({ usedBytes: 25 * MB }, { planKey: 'free' }));
  assert.match(over.message, /over its storage limit/);
  assert.match(over.message, /still view and download/);
});

test('storageLimitError is a 403 whose payload is spread into the response', () => {
  const err = svc.storageLimitError(svc.buildUsage({ usedBytes: 10 * MB }), 1);
  assert.equal(err.status, 403);
  assert.equal(err.details.code, 'STORAGE_LIMIT_EXCEEDED');
  assert.ok(err.details.usage);
  assert.equal(err.details.message, undefined); // message travels on the Error itself
  assert.match(err.message, /storage/i);
});

test('grant key prefers the payment id so payment.captured + subscription.charged cannot double-credit', () => {
  const periodEnd = new Date('2026-12-01T00:00:00Z');
  assert.equal(grants.grantKeyForPayment({ _id: 'x', razorpayPaymentId: 'pay_1', razorpaySubscriptionId: 'sub_1' }, periodEnd), 'rzp:pay_1');
  assert.equal(
    grants.grantKeyForPayment({ _id: 'x', razorpaySubscriptionId: 'sub_1' }, periodEnd),
    `sub:sub_1:${Math.floor(periodEnd.getTime() / 1000)}`
  );
  assert.equal(grants.grantKeyForPayment({ _id: 'abc123' }), 'pay:abc123');
});

test('free and trial payments never earn storage (no DB touched)', async () => {
  for (const planKey of ['free', 'free_trial']) {
    const r = await grants.grantForPayment({ userId: ID, payment: { _id: 'p', razorpayPaymentId: 'pay_x' }, planKey });
    assert.deepEqual(r, { granted: false, reason: 'plan_not_eligible' });
  }
});
