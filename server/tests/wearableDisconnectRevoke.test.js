/**
 * Two halves of the same bug: a take.health disconnect never reached Open
 * Wearables, and an Open Wearables revoke never reached take.health.
 *
 * 1. disconnectDevice used to flip only the local isConnected flag. The
 *    connection stayed active upstream, so the reconcile paths saw "active"
 *    and flipped it straight back to true — disconnect silently undid itself.
 *    It now revokes on Open Wearables first.
 * 2. reconcileOneConnection only ever flipped false->true. When the provider
 *    revoked our access (confirmed live: Whoop rejected the refresh token,
 *    Open Wearables marked the connection "revoked"), the connection.revoked
 *    webhook never arrived and the app kept showing "connected" with no data.
 *    It now also flips true->false — but only on an explicit non-active
 *    record, never on a missing one (Health Connect 'google' docs have no
 *    Open Wearables connection at all).
 *
 * Run: node --test tests/wearableDisconnectRevoke.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const openWearablesClient = require('../config/openWearables');
const WearableData = require('../models/WearableData');

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

function makeWearable(overrides = {}) {
  const w = {
    _id: 'w1',
    user: 'u1',
    deviceType: 'whoop',
    openWearablesUserId: 'ow1',
    isConnected: true,
    saved: false,
    async save() { this.saved = true; },
    ...overrides,
  };
  return w;
}

function makeReq(deviceType = 'whoop') {
  return { user: { _id: 'u1' }, params: { deviceType }, ip: '127.0.0.1', headers: {} };
}

// --- disconnectDevice ------------------------------------------------------

test('disconnectDevice: revokes on Open Wearables before flipping the local flag', async (t) => {
  const wearable = makeWearable();
  t.mock.method(WearableData, 'findOne', async () => wearable);
  const deleteMock = t.mock.method(openWearablesClient, 'delete', async () => ({ status: 204 }));
  openWearablesClient.isConfigured = true;

  const { disconnectDevice } = require('../controllers/wearableController');
  const res = makeRes();
  await disconnectDevice(makeReq(), res);

  assert.equal(deleteMock.mock.callCount(), 1);
  assert.equal(deleteMock.mock.calls[0].arguments[0], '/users/ow1/connections/whoop');
  assert.equal(wearable.isConnected, false);
  assert.ok(wearable.saved);
  assert.equal(res.statusCode, 200);
});

test('disconnectDevice: Open Wearables unreachable -> 503, local state left untouched', async (t) => {
  const wearable = makeWearable();
  t.mock.method(WearableData, 'findOne', async () => wearable);
  t.mock.method(openWearablesClient, 'delete', async () => { throw new Error('ECONNREFUSED'); });
  openWearablesClient.isConfigured = true;

  const { disconnectDevice } = require('../controllers/wearableController');
  const res = makeRes();
  await disconnectDevice(makeReq(), res);

  assert.equal(res.statusCode, 503);
  assert.equal(wearable.isConnected, true, 'must not show disconnected when the upstream revoke never happened');
  assert.equal(wearable.saved, false);
});

test('disconnectDevice: Open Wearables 404 (connection already gone) still disconnects locally', async (t) => {
  const wearable = makeWearable();
  t.mock.method(WearableData, 'findOne', async () => wearable);
  t.mock.method(openWearablesClient, 'delete', async () => {
    const err = new Error('not found');
    err.response = { status: 404 };
    throw err;
  });
  openWearablesClient.isConfigured = true;

  const { disconnectDevice } = require('../controllers/wearableController');
  const res = makeRes();
  await disconnectDevice(makeReq(), res);

  assert.equal(res.statusCode, 200);
  assert.equal(wearable.isConnected, false);
});

test('disconnectDevice: non-OAuth device (manual) never calls Open Wearables', async (t) => {
  const wearable = makeWearable({ deviceType: 'manual', openWearablesUserId: undefined });
  t.mock.method(WearableData, 'findOne', async () => wearable);
  const deleteMock = t.mock.method(openWearablesClient, 'delete', async () => ({ status: 204 }));

  const { disconnectDevice } = require('../controllers/wearableController');
  const res = makeRes();
  await disconnectDevice(makeReq('manual'), res);

  assert.equal(deleteMock.mock.callCount(), 0);
  assert.equal(wearable.isConnected, false);
});

// --- reconcileOneConnection (true -> false direction) ----------------------

test('reconcileOneConnection: connected locally but revoked upstream -> flips to false', async (t) => {
  t.mock.method(openWearablesClient, 'get', async () => ({ data: [{ provider: 'whoop', status: 'revoked' }] }));

  const { reconcileOneConnection } = require('../services/wearableScoreSyncService');
  const wearable = makeWearable({ isConnected: true });
  const result = await reconcileOneConnection(wearable);

  assert.equal(result.reconciled, true);
  assert.equal(result.direction, 'disconnected');
  assert.equal(wearable.isConnected, false);
  assert.ok(wearable.saved);
});

test('reconcileOneConnection: no upstream record at all (e.g. Health Connect) -> left connected', async (t) => {
  t.mock.method(openWearablesClient, 'get', async () => ({ data: [] }));

  const { reconcileOneConnection } = require('../services/wearableScoreSyncService');
  const wearable = makeWearable({ deviceType: 'google', isConnected: true });
  const result = await reconcileOneConnection(wearable);

  assert.equal(result.reconciled, false);
  assert.equal(wearable.isConnected, true, 'a missing record is not proof of revocation');
  assert.equal(wearable.saved, false);
});

test('reconcileOneConnection: connected locally and active upstream -> no-op, no write', async (t) => {
  t.mock.method(openWearablesClient, 'get', async () => ({ data: [{ provider: 'whoop', status: 'active' }] }));

  const { reconcileOneConnection } = require('../services/wearableScoreSyncService');
  const wearable = makeWearable({ isConnected: true });
  const result = await reconcileOneConnection(wearable);

  assert.equal(result.reconciled, false);
  assert.equal(wearable.saved, false);
});
