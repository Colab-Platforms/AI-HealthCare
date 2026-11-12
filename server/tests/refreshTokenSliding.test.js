/**
 * Refresh tokens used to expire a fixed 7 days after login with no renewal, so
 * even daily users were logged out exactly a week after signing in.
 * RefreshToken.consume now slides the expiry forward (30 days), writing at most
 * once a day per token.
 *
 * Run: node --test tests/refreshTokenSliding.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const RefreshToken = require('../models/RefreshToken');
const { REFRESH_TOKEN_TTL_MS, RENEW_INTERVAL_MS } = RefreshToken;

const NOW = Date.UTC(2026, 10, 11, 12, 0, 0);
const HOUR = 60 * 60 * 1000;

// Stubs the three model calls consume() makes and records what it did.
function stubModel(record) {
  const calls = { findOne: [], updateOne: [], deleteOne: [] };
  const orig = {
    findOne: RefreshToken.findOne,
    updateOne: RefreshToken.updateOne,
    deleteOne: RefreshToken.deleteOne,
  };
  RefreshToken.findOne = (filter) => {
    calls.findOne.push(filter);
    return { lean: async () => (record ? { ...record } : null) };
  };
  RefreshToken.updateOne = async (filter, update) => { calls.updateOne.push({ filter, update }); };
  RefreshToken.deleteOne = async (filter) => { calls.deleteOne.push(filter); };
  const restore = () => Object.assign(RefreshToken, orig);
  return { calls, restore };
}

test('unknown token returns null and writes nothing', async () => {
  const { calls, restore } = stubModel(null);
  try {
    assert.equal(await RefreshToken.consume('abc', NOW), null);
    assert.equal(calls.updateOne.length, 0);
    assert.equal(calls.deleteOne.length, 0);
  } finally { restore(); }
});

test('non-string token never reaches the query', async () => {
  const { calls, restore } = stubModel({ _id: 't1' });
  try {
    assert.equal(await RefreshToken.consume({ $ne: null }, NOW), null);
    assert.equal(await RefreshToken.consume('', NOW), null);
    assert.equal(await RefreshToken.consume(undefined, NOW), null);
    assert.equal(calls.findOne.length, 0);
  } finally { restore(); }
});

test('expired token (not yet swept by TTL monitor) is rejected and deleted', async () => {
  const { calls, restore } = stubModel({ _id: 't1', userId: 'u1', expiresAt: new Date(NOW - 1000) });
  try {
    assert.equal(await RefreshToken.consume('abc', NOW), null);
    assert.deepEqual(calls.deleteOne, [{ _id: 't1' }]);
    assert.equal(calls.updateOne.length, 0);
  } finally { restore(); }
});

test('token expiring exactly now is rejected', async () => {
  const { restore } = stubModel({ _id: 't1', userId: 'u1', expiresAt: new Date(NOW) });
  try {
    assert.equal(await RefreshToken.consume('abc', NOW), null);
  } finally { restore(); }
});

test('the 7-day bug: a token on its last day is extended to a full 30 days', async () => {
  const { calls, restore } = stubModel({ _id: 't1', userId: 'u1', expiresAt: new Date(NOW + HOUR) });
  try {
    const stored = await RefreshToken.consume('abc', NOW);
    assert.equal(stored.userId, 'u1');
    const expected = new Date(NOW + REFRESH_TOKEN_TTL_MS);
    assert.equal(stored.expiresAt.getTime(), expected.getTime());
    assert.equal(calls.updateOne.length, 1);
    // Conditional on still being alive, so a concurrent logout is never undone.
    assert.deepEqual(calls.updateOne[0].filter, { _id: 't1', expiresAt: { $gt: new Date(NOW) } });
    assert.deepEqual(calls.updateOne[0].update, { $set: { expiresAt: expected } });
  } finally { restore(); }
});

test('recently renewed token is accepted without a write (throttle)', async () => {
  const expiresAt = new Date(NOW + REFRESH_TOKEN_TTL_MS - HOUR);
  const { calls, restore } = stubModel({ _id: 't1', userId: 'u1', expiresAt });
  try {
    const stored = await RefreshToken.consume('abc', NOW);
    assert.equal(stored.userId, 'u1');
    assert.equal(new Date(stored.expiresAt).getTime(), expiresAt.getTime());
    assert.equal(calls.updateOne.length, 0);
  } finally { restore(); }
});

test('renews once the last extension is more than a day old', async () => {
  const expiresAt = new Date(NOW + REFRESH_TOKEN_TTL_MS - RENEW_INTERVAL_MS - 1);
  const { calls, restore } = stubModel({ _id: 't1', userId: 'u1', expiresAt });
  try {
    await RefreshToken.consume('abc', NOW);
    assert.equal(calls.updateOne.length, 1);
  } finally { restore(); }
});

test('legacy 7-day tokens issued before this change still slide', async () => {
  const issued = NOW - 2 * 24 * HOUR;
  const { calls, restore } = stubModel({ _id: 't1', userId: 'u1', expiresAt: new Date(issued + 7 * 24 * HOUR) });
  try {
    const stored = await RefreshToken.consume('abc', NOW);
    assert.equal(stored.expiresAt.getTime(), NOW + REFRESH_TOKEN_TTL_MS);
    assert.equal(calls.updateOne.length, 1);
  } finally { restore(); }
});

test('expiryFromNow gives a full TTL', () => {
  assert.equal(RefreshToken.expiryFromNow(NOW).getTime(), NOW + REFRESH_TOKEN_TTL_MS);
});
