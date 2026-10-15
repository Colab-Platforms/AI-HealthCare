/**
 * wearableScoreSyncService.js's reconcileOneConnection() periodically flips
 * a device back to isConnected:true whenever Open Wearables still reports it
 * "active" on their side (a local disconnect never revokes the connection
 * there). It used to do this with no awareness of the single-active-device
 * rule, silently undoing a disconnect whenever another device already held
 * the connected slot — confirmed live via Render logs showing
 * "[WearableScoreSync] reconciled isConnected=true" moments after a device
 * had been deliberately disconnected. This verifies the fix: the reconcile
 * now checks findBlockingConnection before writing isConnected=true.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const openWearablesClient = require('../config/openWearables');
const WearableData = require('../models/WearableData');

// findBlockingConnection ultimately calls WearableData.findOne() — mocked at
// that level (not the function itself) since wearableScoreSyncService.js
// destructures the import at require-time, so mocking the exported function
// reference afterward would not be seen by its already-bound local copy.
function chainable(value) {
  const p = Promise.resolve(value);
  p.select = () => chainable(value);
  p.session = () => Promise.resolve(value);
  return p;
}

test('reconcileOneConnection: does NOT reconnect a device while another is already connected', async (t) => {
  t.mock.method(openWearablesClient, 'get', async () => ({
    data: [{ provider: 'whoop', status: 'active' }],
  }));
  t.mock.method(WearableData, 'findOne', () => chainable({ deviceType: 'google', deviceName: 'Health Connect' }));

  const { reconcileOneConnection } = require('../services/wearableScoreSyncService');

  const saveCalls = [];
  const wearable = {
    _id: 'w1',
    user: 'u1',
    deviceType: 'whoop',
    openWearablesUserId: 'ow1',
    isConnected: false,
    save: async function () { saveCalls.push(this.isConnected); },
  };

  const result = await reconcileOneConnection(wearable);

  assert.equal(result.reconciled, false);
  assert.equal(result.blocked, true);
  assert.equal(wearable.isConnected, false, 'must stay disconnected — another device holds the slot');
  assert.equal(saveCalls.length, 0, 'must never save when blocked');
});

test('reconcileOneConnection: reconnects normally when nothing else is connected', async (t) => {
  t.mock.method(openWearablesClient, 'get', async () => ({
    data: [{ provider: 'whoop', status: 'active' }],
  }));
  t.mock.method(WearableData, 'findOne', () => chainable(null));

  const { reconcileOneConnection } = require('../services/wearableScoreSyncService');

  let saved = false;
  const wearable = {
    _id: 'w1',
    user: 'u1',
    deviceType: 'whoop',
    openWearablesUserId: 'ow1',
    isConnected: false,
    save: async function () { saved = true; },
  };

  const result = await reconcileOneConnection(wearable);

  assert.equal(result.reconciled, true);
  assert.equal(wearable.isConnected, true);
  assert.ok(saved);
});
