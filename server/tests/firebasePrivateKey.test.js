/**
 * Guards against the exact failure seen in production: a FIREBASE_PRIVATE_KEY
 * env var pasted with wrapping quotes (copied straight from the JSON
 * service-account file's own quoted field) broke PEM parsing with
 * "Failed to parse private key" even after the literal \n -> real newline
 * fix was already in place. Uses a fake PEM shape, never a real key.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizePrivateKey } = require('../config/firebase');

const CLEAN = '-----BEGIN PRIVATE KEY-----\nFAKEKEYLINE1\nFAKEKEYLINE2\n-----END PRIVATE KEY-----\n';
const ESCAPED = '-----BEGIN PRIVATE KEY-----\\nFAKEKEYLINE1\\nFAKEKEYLINE2\\n-----END PRIVATE KEY-----\\n';

test('escaped \\n sequences become real newlines', () => {
  assert.equal(normalizePrivateKey(ESCAPED), CLEAN);
});

test('wrapping double quotes (JSON field copy-paste) are stripped', () => {
  assert.equal(normalizePrivateKey(`"${ESCAPED}"`), CLEAN);
});

test('wrapping single quotes are stripped', () => {
  assert.equal(normalizePrivateKey(`'${ESCAPED}'`), CLEAN);
});

test('real Windows CRLF line endings are normalized', () => {
  const crlf = '-----BEGIN PRIVATE KEY-----\r\nFAKEKEYLINE1\r\nFAKEKEYLINE2\r\n-----END PRIVATE KEY-----\r\n';
  assert.equal(normalizePrivateKey(crlf), CLEAN);
});

test('leading/trailing whitespace from a stray paste is trimmed', () => {
  assert.equal(normalizePrivateKey(`  ${ESCAPED}  \n`), CLEAN);
});

test('an already-clean key is left untouched', () => {
  assert.equal(normalizePrivateKey(CLEAN), CLEAN);
});

test('missing value stays falsy, never throws', () => {
  assert.equal(normalizePrivateKey(undefined), undefined);
  assert.equal(normalizePrivateKey(''), '');
});
