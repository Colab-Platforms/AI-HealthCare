/**
 * A user may have at most one WearableData doc with isConnected:true at a
 * time. Enforced by auto-switching, not blocking: connecting a second
 * (different) device while one is already active disconnects the old one
 * and connects the new one — multiple simultaneously connected devices used
 * to cause steps/sleep double-counting across the app (see
 * DailyActivityMetric max-merge fixes), which this still prevents, just by
 * switching instead of rejecting.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const WearableData = require('../models/WearableData');
const wearableController = require('../controllers/wearableController');

function chainable(value) {
  const p = Promise.resolve(value);
  p.select = () => chainable(value);
  p.session = () => Promise.resolve(value);
  return p;
}

function fakeRes() {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

test('connectDevice: connecting a second different device switches — disconnects the old one, connects the new one', async (t) => {
  let updateManyCall = null;
  t.mock.method(WearableData, 'updateMany', async (filter, update) => {
    updateManyCall = { filter, update };
    return { modifiedCount: 1 };
  });
  t.mock.method(WearableData, 'findOne', () => chainable(null)); // no existing doc for the device being connected
  let created = null;
  t.mock.method(WearableData, 'create', async (doc) => {
    created = doc;
    return doc;
  });

  const req = { user: { _id: 'u1' }, body: { deviceType: 'garmin', deviceName: 'Garmin Venu' } };
  const res = fakeRes();

  await wearableController.connectDevice(req, res);

  // disconnectOtherDevices must run against every OTHER connected device for this user
  assert.equal(updateManyCall.filter.isConnected, true);
  assert.equal(updateManyCall.filter.deviceType.$ne, 'garmin');
  assert.equal(updateManyCall.update.$set.isConnected, false);

  assert.equal(res.statusCode, 201);
  assert.ok(created);
  assert.equal(created.isConnected, true);
});

test('connectDevice: connecting the SAME already-connected device still works and does not disturb itself', async (t) => {
  const saved = { isConnected: true, deviceName: null, lastSyncedAt: null, save: async function () { saved.saveCalled = true; } };

  t.mock.method(WearableData, 'updateMany', async () => ({ modifiedCount: 0 }));
  t.mock.method(WearableData, 'findOne', () => chainable(saved)); // existing doc for this same deviceType

  const req = { user: { _id: 'u1' }, body: { deviceType: 'whoop', deviceName: 'WHOOP 4.0' } };
  const res = fakeRes();

  await wearableController.connectDevice(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(saved.isConnected, true);
  assert.ok(saved.saveCalled);
});

test('connectDevice: first-ever connect (nothing connected yet) succeeds', async (t) => {
  let created = null;
  t.mock.method(WearableData, 'updateMany', async () => ({ modifiedCount: 0 }));
  t.mock.method(WearableData, 'findOne', () => chainable(null));
  t.mock.method(WearableData, 'create', async (doc) => {
    created = doc;
    return doc;
  });

  const req = { user: { _id: 'u1' }, body: { deviceType: 'oura', deviceName: 'Oura Ring' } };
  const res = fakeRes();

  await wearableController.connectDevice(req, res);

  assert.equal(res.statusCode, 201);
  assert.ok(created);
  assert.equal(created.isConnected, true);
});
