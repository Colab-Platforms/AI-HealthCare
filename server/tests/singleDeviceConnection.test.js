/**
 * A user may have at most one WearableData doc with isConnected:true at a
 * time. Connecting a second (different) device while one is already active
 * must be rejected with 409, not silently allowed to coexist — multiple
 * connected devices used to cause steps/sleep double-counting across the
 * app (see DailyActivityMetric max-merge fixes).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const WearableData = require('../models/WearableData');
const wearableController = require('../controllers/wearableController');

// findBlockingConnection() chains .select().session() off findOne() — the
// plain controller's own WearableData.findOne() calls don't. Wrap a resolved
// value so both call styles work against the same mock.
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

test('connectDevice: second different device is blocked with 409 while one is already connected', async (t) => {
  t.mock.method(WearableData, 'findOne', (query) => {
    if (query.isConnected === true) {
      // findBlockingConnection — pretend 'whoop' is already connected
      return chainable({ deviceType: 'whoop', deviceName: 'WHOOP 4.0' });
    }
    return chainable(null); // no existing doc for the device being connected
  });
  t.mock.method(WearableData, 'create', async () => {
    throw new Error('create should never be called once blocked');
  });

  const req = { user: { _id: 'u1' }, body: { deviceType: 'garmin', deviceName: 'Garmin Venu' } };
  const res = fakeRes();

  await wearableController.connectDevice(req, res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, 'DEVICE_ALREADY_CONNECTED');
  assert.equal(res.body.connectedDevice.deviceType, 'whoop');
});

test('connectDevice: connecting the SAME already-connected device is not blocked', async (t) => {
  const saved = { isConnected: false, deviceName: null, lastSyncedAt: null, save: async function () { saved.saveCalled = true; } };

  t.mock.method(WearableData, 'findOne', (query) => {
    if (query.isConnected === true) return chainable(null); // no OTHER device connected
    return chainable(saved); // existing doc for this same deviceType
  });

  const req = { user: { _id: 'u1' }, body: { deviceType: 'whoop', deviceName: 'WHOOP 4.0' } };
  const res = fakeRes();

  await wearableController.connectDevice(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(saved.isConnected, true);
  assert.ok(saved.saveCalled);
});

test('connectDevice: first-ever connect (nothing connected yet) succeeds', async (t) => {
  let created = null;
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
