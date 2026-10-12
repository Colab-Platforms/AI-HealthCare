/**
 * Unit tests for the missing-metrics fix (WHOOP_MISSING_METRICS_DIAGNOSTIC.md):
 * - wearableTimeseriesSyncService now requests HRV/RHR/SpO2/skin-temp/
 *   respiratory_rate alongside steps.
 * - WearableMetricSample's isDailyTotal flag is passed through correctly.
 * - applyGenericMetric's existing dedup (unchanged — see design-check finding:
 *   time-series collections cannot upsert a single timestamped measurement,
 *   confirmed empirically against staging) correctly lets an evolving
 *   daily-total value accumulate as a new row rather than erroring or
 *   silently dropping it.
 *
 * Run: node --test tests/wearableMissingMetrics.test.js
 */
const { test, mock, afterEach } = require('node:test');
const assert = require('assert');

process.env.OPEN_WEARABLES_API_URL = process.env.OPEN_WEARABLES_API_URL || 'http://localhost:9999';
process.env.OPEN_WEARABLES_API_KEY = process.env.OPEN_WEARABLES_API_KEY || 'test-key';

const openWearablesClient = require('../config/openWearables');
const wearableIngest = require('../services/wearableIngestService');
const WearableMetricSample = require('../models/WearableMetricSample');

afterEach(() => {
  mock.restoreAll();
});

test('timeseriesSync: requests all 6 types, not just steps', async () => {
  delete require.cache[require.resolve('../services/wearableTimeseriesSyncService')];
  const getMock = mock.method(openWearablesClient, 'get', async () => ({
    data: { data: [], pagination: { has_more: false, next_cursor: null } },
  }));
  mock.method(wearableIngest, 'applyGenericMetric', async () => 0);
  const { syncTimeseriesForConnection } = require('../services/wearableTimeseriesSyncService');
  const WearableData = require('../models/WearableData');
  const wearable = { _id: 'w1', user: 'u1', deviceType: 'whoop', openWearablesUserId: 'ow-1', metrics: [], save: mock.fn(async () => {}) };
  mock.method(WearableData, 'findOne', async () => wearable);

  await syncTimeseriesForConnection('ow-1', 'whoop');

  const url = getMock.mock.calls[0].arguments[0];
  for (const type of ['steps', 'heart_rate_variability_rmssd', 'resting_heart_rate', 'oxygen_saturation', 'skin_temperature', 'respiratory_rate']) {
    assert.ok(url.includes(`types=${type}`), `expected types=${type} in request URL`);
  }
});

test('normalizeSample (via sync result): isDailyTotal is true only for is_daily_total:true samples', async () => {
  delete require.cache[require.resolve('../services/wearableTimeseriesSyncService')];
  mock.method(openWearablesClient, 'get', async () => ({
    data: {
      data: [
        { type: 'steps', value: 2000, unit: 'count', timestamp: new Date().toISOString(), is_daily_total: true, source: {} },
        { type: 'heart_rate_variability_rmssd', value: 55, unit: 'ms', timestamp: new Date().toISOString(), is_daily_total: null, source: {} },
      ],
      pagination: { has_more: false, next_cursor: null },
    },
  }));
  const applyMock = mock.method(wearableIngest, 'applyGenericMetric', async () => 2);
  const { syncTimeseriesForConnection } = require('../services/wearableTimeseriesSyncService');
  const WearableData = require('../models/WearableData');
  const wearable = { _id: 'w1', user: 'u1', deviceType: 'whoop', openWearablesUserId: 'ow-1', metrics: [], save: mock.fn(async () => {}) };
  mock.method(WearableData, 'findOne', async () => wearable);

  await syncTimeseriesForConnection('ow-1', 'whoop');

  const samplesArg = applyMock.mock.calls[0].arguments[3];
  const steps = samplesArg.find((s) => s.seriesType === 'steps');
  const hrv = samplesArg.find((s) => s.seriesType === 'heart_rate_variability_rmssd');
  assert.strictEqual(steps.isDailyTotal, true);
  assert.strictEqual(hrv.isDailyTotal, false);
});

test('applyGenericMetric: isDailyTotal is stored on the created document', async () => {
  const userId = new (require('mongoose').Types.ObjectId)();
  const existsMock = mock.method(WearableMetricSample, 'exists', async () => false);
  const createMock = mock.method(WearableMetricSample, 'create', async (doc) => doc);

  const saved = await wearableIngest.applyGenericMetric(userId, 'whoop', 'whoop', [
    { seriesType: 'steps', value: 2000, unit: 'count', timestamp: new Date(), isDailyTotal: true },
  ]);

  assert.strictEqual(saved, 1);
  assert.strictEqual(existsMock.mock.callCount(), 1);
  assert.strictEqual(createMock.mock.callCount(), 1);
  assert.strictEqual(createMock.mock.calls[0].arguments[0].isDailyTotal, true);
});

test('applyGenericMetric: a changed daily-total value on the same timestamp is NOT deduped away (new row, by design)', async () => {
  const userId = new (require('mongoose').Types.ObjectId)();
  const ts = new Date('2026-10-09T01:00:00.000Z');
  // First value: exists() says no (nothing saved yet for value=2000)
  let callNum = 0;
  mock.method(WearableMetricSample, 'exists', async (query) => {
    callNum += 1;
    // Only the exact (timestamp, value) pair already saved should report true.
    return callNum === 1 ? false : query.value === 2000;
  });
  const createMock = mock.method(WearableMetricSample, 'create', async (doc) => doc);

  const saved1 = await wearableIngest.applyGenericMetric(userId, 'whoop', 'whoop', [
    { seriesType: 'steps', value: 2000, unit: 'count', timestamp: ts, isDailyTotal: true },
  ]);
  const saved2 = await wearableIngest.applyGenericMetric(userId, 'whoop', 'whoop', [
    { seriesType: 'steps', value: 2500, unit: 'count', timestamp: ts, isDailyTotal: true }, // evolved value, same timestamp
  ]);

  assert.strictEqual(saved1, 1);
  assert.strictEqual(saved2, 1, 'an evolved value at the same timestamp must still be saved as a new row, not silently skipped');
  assert.strictEqual(createMock.mock.callCount(), 2);
});
