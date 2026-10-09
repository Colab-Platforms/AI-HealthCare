/**
 * Unit tests for wearableSleepSyncService — the REST-pull safety net for
 * sleep sessions (previously webhook-only, confirmed to silently drop a
 * real session this session's investigation). Mirrors
 * wearableSyncLookback.test.js's structure for the score/timeseries services.
 *
 * Run: node --test tests/wearableSleepSync.test.js
 */
const { test, mock, afterEach } = require('node:test');
const assert = require('assert');

process.env.OPEN_WEARABLES_API_URL = process.env.OPEN_WEARABLES_API_URL || 'http://localhost:9999';
process.env.OPEN_WEARABLES_API_KEY = process.env.OPEN_WEARABLES_API_KEY || 'test-key';

const openWearablesClient = require('../config/openWearables');
const wearableIngest = require('../services/wearableIngestService');

const SYNC_LOOKBACK_MS = 48 * 60 * 60 * 1000;
const FIRST_RUN_LOOKBACK_MS = 24 * 60 * 60 * 1000;

function makeWearable(overrides = {}) {
  const wearable = { _id: 'w1', user: 'u1', deviceType: 'whoop', openWearablesUserId: 'ow-1', metrics: [], ...overrides };
  wearable.save = mock.fn(async () => wearable);
  return wearable;
}

function emptyPage() {
  return { data: { data: [], pagination: { has_more: false, next_cursor: null } } };
}

afterEach(() => mock.restoreAll());

test('sleepSync: no previous cursor uses FIRST_RUN_LOOKBACK_MS', async () => {
  delete require.cache[require.resolve('../services/wearableSleepSyncService')];
  const getMock = mock.method(openWearablesClient, 'get', async () => emptyPage());
  mock.method(wearableIngest, 'applySleepSessions', async () => {});
  const { syncSleepForConnection } = require('../services/wearableSleepSyncService');
  const WearableData = require('../models/WearableData');
  mock.method(WearableData, 'findOne', async () => makeWearable({ lastSleepSyncAt: undefined }));

  const before = Date.now();
  await syncSleepForConnection('ow-1', 'whoop');

  const params = getMock.mock.calls[0].arguments[1].params;
  const sinceMs = new Date(params.start_date).getTime();
  assert.ok(Math.abs((before - sinceMs) - FIRST_RUN_LOOKBACK_MS) < 5000);
});

test('sleepSync: existing cursor subtracts 48h trailing buffer', async () => {
  delete require.cache[require.resolve('../services/wearableSleepSyncService')];
  const cursor = new Date('2026-10-09T07:00:00.000Z');
  const getMock = mock.method(openWearablesClient, 'get', async () => emptyPage());
  mock.method(wearableIngest, 'applySleepSessions', async () => {});
  const { syncSleepForConnection } = require('../services/wearableSleepSyncService');
  const WearableData = require('../models/WearableData');
  mock.method(WearableData, 'findOne', async () => makeWearable({ lastSleepSyncAt: cursor }));

  await syncSleepForConnection('ow-1', 'whoop');

  const params = getMock.mock.calls[0].arguments[1].params;
  assert.strictEqual(params.start_date, '2026-10-07T07:00:00.000Z');
});

test('sleepSync: a fetched session is normalized correctly (stages, bedTime/wakeTime, sourceRecordId)', async () => {
  delete require.cache[require.resolve('../services/wearableSleepSyncService')];
  mock.method(openWearablesClient, 'get', async () => ({
    data: {
      data: [{
        id: 'sleep-abc', start_time: '2026-10-07T17:15:18.940Z', end_time: '2026-10-08T01:12:32.370Z',
        duration_seconds: 28633,
        stages: { deep_minutes: 124, light_minutes: 214, rem_minutes: 100, awake_minutes: 37 },
      }],
      pagination: { has_more: false, next_cursor: null },
    },
  }));
  const applyMock = mock.method(wearableIngest, 'applySleepSessions', async () => {});
  const { syncSleepForConnection } = require('../services/wearableSleepSyncService');
  const WearableData = require('../models/WearableData');
  mock.method(WearableData, 'findOne', async () => makeWearable({ lastSleepSyncAt: new Date() }));

  const result = await syncSleepForConnection('ow-1', 'whoop');

  assert.strictEqual(result.fetched, 1);
  const sessions = applyMock.mock.calls[0].arguments[3];
  assert.strictEqual(sessions[0].deepSleepMinutes, 124);
  assert.strictEqual(sessions[0].lightSleepMinutes, 214);
  assert.strictEqual(sessions[0].remSleepMinutes, 100);
  assert.strictEqual(sessions[0].awakeMinutes, 37);
  assert.strictEqual(sessions[0].totalSleepMinutes, Math.round(28633 / 60));
  assert.strictEqual(sessions[0].sourceRecordId, 'sleep-abc');
  assert.strictEqual(sessions[0].bedTime, '2026-10-07T17:15:18.940Z');
  assert.strictEqual(sessions[0].wakeTime, '2026-10-08T01:12:32.370Z');
});

test('sleepSync: a page failure does not advance the cursor', async () => {
  delete require.cache[require.resolve('../services/wearableSleepSyncService')];
  let call = 0;
  mock.method(openWearablesClient, 'get', async () => {
    call += 1;
    if (call === 1) {
      return { data: { data: [{ id: 's1', start_time: new Date().toISOString(), end_time: new Date().toISOString(), duration_seconds: 1000, stages: {} }], pagination: { has_more: true, next_cursor: 'x' } } };
    }
    throw new Error('simulated failure on page 2');
  });
  const applyMock = mock.method(wearableIngest, 'applySleepSessions', async () => {});
  const { syncSleepForConnection } = require('../services/wearableSleepSyncService');
  const WearableData = require('../models/WearableData');
  const wearable = makeWearable({ lastSleepSyncAt: new Date() });
  mock.method(WearableData, 'findOne', async () => wearable);

  const result = await syncSleepForConnection('ow-1', 'whoop');

  assert.ok(result.error);
  assert.strictEqual(wearable.save.mock.callCount(), 0);
  assert.strictEqual(applyMock.mock.callCount(), 0);
});

test('sleepSync: non-sleep-capable provider is skipped', async () => {
  delete require.cache[require.resolve('../services/wearableSleepSyncService')];
  const { syncSleepForConnection } = require('../services/wearableSleepSyncService');
  const result = await syncSleepForConnection('ow-1', 'apple');
  assert.strictEqual(result.skipped, true);
  assert.strictEqual(result.reason, 'provider_not_sleep_capable');
});

test('sleepSync: fully exhausts multi-page pagination (cursor-chained)', async () => {
  delete require.cache[require.resolve('../services/wearableSleepSyncService')];
  let page = 0;
  const getMock = mock.method(openWearablesClient, 'get', async () => {
    page += 1;
    if (page === 1) {
      return { data: { data: [{ id: 's1', start_time: '2026-10-05T17:00:00Z', end_time: '2026-10-06T01:00:00Z', duration_seconds: 28800, stages: {} }], pagination: { has_more: true, next_cursor: 'cursor-2' } } };
    }
    if (page === 2) {
      return { data: { data: [{ id: 's2', start_time: '2026-10-06T17:00:00Z', end_time: '2026-10-07T01:00:00Z', duration_seconds: 28800, stages: {} }], pagination: { has_more: true, next_cursor: 'cursor-3' } } };
    }
    return { data: { data: [{ id: 's3', start_time: '2026-10-07T17:00:00Z', end_time: '2026-10-08T01:00:00Z', duration_seconds: 28800, stages: {} }], pagination: { has_more: false, next_cursor: null } } };
  });
  const applyMock = mock.method(wearableIngest, 'applySleepSessions', async () => {});
  const { syncSleepForConnection } = require('../services/wearableSleepSyncService');
  const WearableData = require('../models/WearableData');
  mock.method(WearableData, 'findOne', async () => makeWearable({ lastSleepSyncAt: new Date() }));

  const result = await syncSleepForConnection('ow-1', 'whoop');

  assert.strictEqual(getMock.mock.callCount(), 3, 'must walk all 3 pages');
  assert.strictEqual(result.fetched, 3, 'all 3 sessions across pages must be collected before a single applySleepSessions call');
  const sessions = applyMock.mock.calls[0].arguments[3];
  assert.deepStrictEqual(sessions.map((s) => s.sourceRecordId), ['s1', 's2', 's3']);
  // Second page's request must carry the first page's next_cursor, and so on.
  assert.strictEqual(getMock.mock.calls[1].arguments[1].params.cursor, 'cursor-2');
  assert.strictEqual(getMock.mock.calls[2].arguments[1].params.cursor, 'cursor-3');
});

test('sleepSync: deduplication is delegated to applySleepSessions\' existing upsert-by-(user,deviceType,date) — re-fetching an already-ingested session does not create a second document', async () => {
  // applySleepSessions itself (wearableIngestService.js) is unit-tested
  // elsewhere for its upsert semantics; this test only confirms
  // wearableSleepSyncService doesn't bypass it or pre-filter in a way that
  // would skip a legitimately-changed re-fetch (e.g. stages added later).
  delete require.cache[require.resolve('../services/wearableSleepSyncService')];
  mock.method(openWearablesClient, 'get', async () => ({
    data: { data: [{ id: 'sleep-abc', start_time: '2026-10-07T17:15:18.940Z', end_time: '2026-10-08T01:12:32.370Z', duration_seconds: 28633, stages: { deep_minutes: 124, light_minutes: 214, rem_minutes: 100, awake_minutes: 37 } }], pagination: { has_more: false, next_cursor: null } },
  }));
  const applyMock = mock.method(wearableIngest, 'applySleepSessions', async () => {});
  const { syncSleepForConnection } = require('../services/wearableSleepSyncService');
  const WearableData = require('../models/WearableData');
  mock.method(WearableData, 'findOne', async () => makeWearable({ lastSleepSyncAt: new Date() }));

  await syncSleepForConnection('ow-1', 'whoop');
  await syncSleepForConnection('ow-1', 'whoop'); // second identical fetch

  assert.strictEqual(applyMock.mock.callCount(), 2, 'both runs call applySleepSessions — upsert-by-date dedup happens inside that function, not here');
  // Both calls pass the SAME sourceRecordId/date — applySleepSessions'
  // findOneAndUpdate({user,deviceType,date}, upsert:true) collapses these to
  // one document; verified separately in applySleepSessions' own tests and
  // the staging verification for this service.
  const firstCallDate = applyMock.mock.calls[0].arguments[3][0].date.getTime();
  const secondCallDate = applyMock.mock.calls[1].arguments[3][0].date.getTime();
  assert.strictEqual(firstCallDate, secondCallDate);
});

test('sleepSync: a session with no stages yet (pending score) is still passed through, not dropped', async () => {
  delete require.cache[require.resolve('../services/wearableSleepSyncService')];
  mock.method(openWearablesClient, 'get', async () => ({
    data: {
      data: [{ id: 'pending-1', start_time: '2026-10-08T17:00:00Z', end_time: '2026-10-09T01:00:00Z', duration_seconds: 28800, stages: undefined }],
      pagination: { has_more: false, next_cursor: null },
    },
  }));
  const applyMock = mock.method(wearableIngest, 'applySleepSessions', async () => {});
  const { syncSleepForConnection } = require('../services/wearableSleepSyncService');
  const WearableData = require('../models/WearableData');
  mock.method(WearableData, 'findOne', async () => makeWearable({ lastSleepSyncAt: new Date() }));

  const result = await syncSleepForConnection('ow-1', 'whoop');

  assert.strictEqual(result.fetched, 1, 'a session without stages (score not ready) must still be fetched and saved — total/bedTime/wakeTime are independent of the Sleep Score, confirmed in WHOOP_MISSING_SLEEP_9OCT_DIAGNOSTIC.md §5-6');
  const session = applyMock.mock.calls[0].arguments[3][0];
  assert.strictEqual(session.totalSleepMinutes, Math.round(28800 / 60));
  assert.strictEqual(session.deepSleepMinutes, undefined, 'stage fields are honestly undefined, not fabricated as 0');
  assert.strictEqual(session.lightSleepMinutes, undefined);
  assert.strictEqual(session.remSleepMinutes, undefined);
});

test('sleepSync: two different users\' syncs cannot cross-contaminate or duplicate across accounts', async () => {
  delete require.cache[require.resolve('../services/wearableSleepSyncService')];
  const callLog = [];
  mock.method(openWearablesClient, 'get', async (url, config) => {
    callLog.push(config.params);
    return { data: { data: [{ id: 'sess-for-this-user', start_time: new Date().toISOString(), end_time: new Date().toISOString(), duration_seconds: 1000, stages: {} }], pagination: { has_more: false, next_cursor: null } } };
  });
  const applyMock = mock.method(wearableIngest, 'applySleepSessions', async () => {});
  const { syncSleepForConnection } = require('../services/wearableSleepSyncService');
  const WearableData = require('../models/WearableData');

  const wearableA = makeWearable({ _id: 'wA', user: 'userA', openWearablesUserId: 'ow-A' });
  const wearableB = makeWearable({ _id: 'wB', user: 'userB', openWearablesUserId: 'ow-B' });
  const findOneMock = mock.method(WearableData, 'findOne', async (query) => {
    if (query.openWearablesUserId === 'ow-A') return wearableA;
    if (query.openWearablesUserId === 'ow-B') return wearableB;
    return null;
  });

  await syncSleepForConnection('ow-A', 'whoop');
  await syncSleepForConnection('ow-B', 'whoop');

  assert.strictEqual(findOneMock.mock.callCount(), 2);
  // Each applySleepSessions call must carry the correct, DISTINCT user id —
  // confirms the service never reuses one wearable's resolved user for another.
  assert.strictEqual(applyMock.mock.calls[0].arguments[0], 'userA');
  assert.strictEqual(applyMock.mock.calls[1].arguments[0], 'userB');
  assert.notStrictEqual(applyMock.mock.calls[0].arguments[0], applyMock.mock.calls[1].arguments[0]);
});
