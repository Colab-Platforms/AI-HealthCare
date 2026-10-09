/**
 * Unit tests for the 48h trailing-lookback cursor fix in
 * wearableScoreSyncService.js and wearableTimeseriesSyncService.js.
 *
 * Covers: no previous cursor, existing advanced cursor, a delayed record
 * within 48h, repeated empty syncs (window must not shrink), records older
 * than 48h (asserted via the exact query params sent, since filtering itself
 * is the provider's job), and a mid-pagination API failure (cursor must not
 * advance on a partial fetch).
 *
 * Network (openWearablesClient) and the ingest layer (wearableIngestService)
 * are mocked via node:test's built-in `mock` — no real HTTP call, no Mongo
 * write. `wearable` is a plain object, not a Mongoose doc, with `.save()`
 * stubbed to record whether the cursor was persisted.
 *
 * Run: node --test tests/wearableSyncLookback.test.js
 */
const { test, mock, afterEach } = require('node:test');
const assert = require('assert');

// The sync services early-return `{skipped: true}` when openWearablesClient
// isn't configured (OPEN_WEARABLES_API_URL/KEY) — set just enough env to pass
// that guard, deliberately NOT loading the full .env (which also carries real
// MONGODB_URI/REDIS_URL and would make this "unit" test reach out over the
// network via utils/cache.js on any savedCount>0 path).
process.env.OPEN_WEARABLES_API_URL = process.env.OPEN_WEARABLES_API_URL || 'http://localhost:9999';
process.env.OPEN_WEARABLES_API_KEY = process.env.OPEN_WEARABLES_API_KEY || 'test-key';

const openWearablesClient = require('../config/openWearables');
const wearableIngest = require('../services/wearableIngestService');

const SYNC_LOOKBACK_MS = 48 * 60 * 60 * 1000;
const FIRST_RUN_LOOKBACK_MS = 24 * 60 * 60 * 1000;

function makeWearable(overrides = {}) {
  const wearable = {
    _id: 'w1',
    user: 'u1',
    deviceType: 'whoop',
    openWearablesUserId: 'ow-1',
    metrics: [],
    ...overrides,
  };
  wearable.save = mock.fn(async () => wearable);
  return wearable;
}

function emptyPage() {
  return { data: { data: [], pagination: { has_more: false, next_cursor: null } } };
}

afterEach(() => {
  mock.restoreAll();
});

// ---------------------------------------------------------------------------
// wearableScoreSyncService
// ---------------------------------------------------------------------------

test('scoreSync: no previous cursor uses FIRST_RUN_LOOKBACK_MS, not an extra 48h', async () => {
  delete require.cache[require.resolve('../services/wearableScoreSyncService')];
  const getMock = mock.method(openWearablesClient, 'get', async () => emptyPage());
  mock.method(wearableIngest, 'applyScores', async () => 0);
  const { syncScoreForConnection } = require('../services/wearableScoreSyncService');

  const WearableData = require('../models/WearableData');
  mock.method(WearableData, 'findOne', async () => makeWearable({ lastScoreSyncAt: undefined }));

  const before = Date.now();
  await syncScoreForConnection('ow-1', 'whoop');

  assert.strictEqual(getMock.mock.callCount(), 1);
  const params = getMock.mock.calls[0].arguments[1].params;
  const sinceMs = new Date(params.start_date).getTime();
  // Should be ~24h back, not ~(24h + 48h) back.
  assert.ok(Math.abs((before - sinceMs) - FIRST_RUN_LOOKBACK_MS) < 5000, 'window should be ~24h, not wider');
});

test('scoreSync: existing cursor subtracts 48h trailing buffer', async () => {
  delete require.cache[require.resolve('../services/wearableScoreSyncService')];
  const cursor = new Date(Date.now() - 10 * 60 * 1000); // cursor from 10 min ago
  const getMock = mock.method(openWearablesClient, 'get', async () => emptyPage());
  mock.method(wearableIngest, 'applyScores', async () => 0);
  const { syncScoreForConnection } = require('../services/wearableScoreSyncService');

  const WearableData = require('../models/WearableData');
  mock.method(WearableData, 'findOne', async () => makeWearable({ lastScoreSyncAt: cursor }));

  await syncScoreForConnection('ow-1', 'whoop');

  const params = getMock.mock.calls[0].arguments[1].params;
  const sinceMs = new Date(params.start_date).getTime();
  const expected = cursor.getTime() - SYNC_LOOKBACK_MS;
  assert.ok(Math.abs(sinceMs - expected) < 1000, 'since should be cursor - 48h');
});

test('scoreSync: a record timestamped within the 48h window is ingested', async () => {
  delete require.cache[require.resolve('../services/wearableScoreSyncService')];
  const cursor = new Date(Date.now() - 20 * 60 * 60 * 1000); // 20h ago cursor
  const delayedRecordedAt = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(); // 30h ago — inside the 48h lookback, outside the raw 20h-old cursor
  mock.method(openWearablesClient, 'get', async () => ({
    data: { data: [{ id: 'score-1', category: 'recovery', value: 75, recorded_at: delayedRecordedAt }], pagination: { has_more: false, next_cursor: null } },
  }));
  const applyScoresMock = mock.method(wearableIngest, 'applyScores', async () => 1);
  const { syncScoreForConnection } = require('../services/wearableScoreSyncService');

  const WearableData = require('../models/WearableData');
  mock.method(WearableData, 'findOne', async () => makeWearable({ lastScoreSyncAt: cursor }));

  const result = await syncScoreForConnection('ow-1', 'whoop');

  assert.strictEqual(applyScoresMock.mock.callCount(), 1);
  const scoresArg = applyScoresMock.mock.calls[0].arguments[3];
  assert.strictEqual(scoresArg.length, 1);
  assert.strictEqual(scoresArg[0].externalId, 'score-1');
  assert.strictEqual(result.saved, 1);
});

test('scoreSync: repeated empty syncs keep a constant 48h window width (no shrinking)', async () => {
  delete require.cache[require.resolve('../services/wearableScoreSyncService')];
  const getMock = mock.method(openWearablesClient, 'get', async () => emptyPage());
  mock.method(wearableIngest, 'applyScores', async () => 0);
  const { syncScoreForConnection } = require('../services/wearableScoreSyncService');
  const WearableData = require('../models/WearableData');

  // Run 1: cursor starts null (first run).
  const wearable = makeWearable({ lastScoreSyncAt: undefined });
  mock.method(WearableData, 'findOne', async () => wearable);
  await syncScoreForConnection('ow-1', 'whoop');
  const cursorAfterRun1 = wearable.lastScoreSyncAt;
  assert.ok(cursorAfterRun1 instanceof Date, 'cursor should be saved after a successful empty run');

  // Run 2: cursor now exists (from run 1) — window must be cursorAfterRun1 - 48h,
  // not some narrower slice from "run1 end" to "run2 start".
  await syncScoreForConnection('ow-1', 'whoop');
  const params = getMock.mock.calls[1].arguments[1].params;
  const sinceMs = new Date(params.start_date).getTime();
  const expected = cursorAfterRun1.getTime() - SYNC_LOOKBACK_MS;
  assert.ok(Math.abs(sinceMs - expected) < 1000, 'second run should still use a full 48h buffer off the saved cursor');
});

test('scoreSync: the query window explicitly excludes anything before cursor-48h (params assertion)', async () => {
  delete require.cache[require.resolve('../services/wearableScoreSyncService')];
  const cursor = new Date('2026-10-09T07:00:00.000Z');
  const getMock = mock.method(openWearablesClient, 'get', async () => emptyPage());
  mock.method(wearableIngest, 'applyScores', async () => 0);
  const { syncScoreForConnection } = require('../services/wearableScoreSyncService');
  const WearableData = require('../models/WearableData');
  mock.method(WearableData, 'findOne', async () => makeWearable({ lastScoreSyncAt: cursor }));

  await syncScoreForConnection('ow-1', 'whoop');

  const params = getMock.mock.calls[0].arguments[1].params;
  assert.strictEqual(params.start_date, '2026-10-07T07:00:00.000Z', 'exactly cursor - 48h, matching the diagnostic scenario');
});

test('scoreSync: a page failure does not advance the cursor (no partial-fetch-treated-as-done)', async () => {
  delete require.cache[require.resolve('../services/wearableScoreSyncService')];
  let call = 0;
  mock.method(openWearablesClient, 'get', async () => {
    call += 1;
    if (call === 1) {
      return { data: { data: [{ id: 's1', category: 'recovery', value: 50, recorded_at: new Date().toISOString() }], pagination: { has_more: true, next_cursor: null } } };
    }
    throw new Error('simulated network failure on page 2');
  });
  const applyScoresMock = mock.method(wearableIngest, 'applyScores', async () => 1);
  const { syncScoreForConnection } = require('../services/wearableScoreSyncService');
  const WearableData = require('../models/WearableData');
  const wearable = makeWearable({ lastScoreSyncAt: new Date() });
  mock.method(WearableData, 'findOne', async () => wearable);

  const result = await syncScoreForConnection('ow-1', 'whoop');

  // syncScoreForConnection catches the error and reports it — but the cursor
  // (wearable.save) must never have been called, and ingestion of the
  // already-fetched page-1 data must not have happened either, since we
  // don't yet know if page 2 would have duplicated/revised it.
  assert.ok(result.error, 'should report an error, not a silent success');
  assert.strictEqual(wearable.save.mock.callCount(), 0, 'cursor must not be persisted on a partial failure');
  assert.strictEqual(applyScoresMock.mock.callCount(), 0, 'must not ingest a partial page set before failing');
});

// ---------------------------------------------------------------------------
// wearableTimeseriesSyncService (same fix, same shape — lighter coverage,
// the window-math and failure-handling logic is identical to the score
// service above; this just confirms it was applied here too).
// ---------------------------------------------------------------------------

test('timeseriesSync: existing cursor subtracts 48h trailing buffer', async () => {
  delete require.cache[require.resolve('../services/wearableTimeseriesSyncService')];
  const cursor = new Date(Date.now() - 5 * 60 * 1000);
  const getMock = mock.method(openWearablesClient, 'get', async () => ({
    data: { data: [], pagination: { has_more: false, next_cursor: null } },
  }));
  mock.method(wearableIngest, 'applyGenericMetric', async () => 0);
  const { syncTimeseriesForConnection } = require('../services/wearableTimeseriesSyncService');
  const WearableData = require('../models/WearableData');
  mock.method(WearableData, 'findOne', async () => makeWearable({ lastTimeseriesSyncAt: cursor }));

  await syncTimeseriesForConnection('ow-1', 'whoop');

  const url = getMock.mock.calls[0].arguments[0];
  const qs = new URLSearchParams(url.split('?')[1]);
  const sinceMs = new Date(qs.get('start_time')).getTime();
  const expected = cursor.getTime() - SYNC_LOOKBACK_MS;
  assert.ok(Math.abs(sinceMs - expected) < 1000, 'since should be cursor - 48h');
});

test('timeseriesSync: a page failure does not advance the cursor', async () => {
  delete require.cache[require.resolve('../services/wearableTimeseriesSyncService')];
  let call = 0;
  mock.method(openWearablesClient, 'get', async () => {
    call += 1;
    if (call === 1) {
      return { data: { data: [{ type: 'steps', value: 100, timestamp: new Date().toISOString() }], pagination: { has_more: true, next_cursor: 'abc' } } };
    }
    throw new Error('simulated failure on page 2');
  });
  const applyMock = mock.method(wearableIngest, 'applyGenericMetric', async () => 1);
  const { syncTimeseriesForConnection } = require('../services/wearableTimeseriesSyncService');
  const WearableData = require('../models/WearableData');
  const wearable = makeWearable({ lastTimeseriesSyncAt: new Date() });
  mock.method(WearableData, 'findOne', async () => wearable);

  const result = await syncTimeseriesForConnection('ow-1', 'whoop');

  assert.ok(result.error);
  assert.strictEqual(wearable.save.mock.callCount(), 0);
  assert.strictEqual(applyMock.mock.callCount(), 0);
});
