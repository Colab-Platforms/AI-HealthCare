/**
 * Unit tests for wearableRawDataService's date-window validation — the
 * part most likely to have an off-by-one or input-handling bug. The Mongo
 * query itself is exercised in the staging verification script, not here.
 *
 * Run: node --test tests/wearableRawDataService.test.js
 */
const { test } = require('node:test');
const assert = require('assert');

process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/unused';

const { getRawMetrics, WearableRawDataInputError } = require('../services/wearableRawDataService');
const WearableMetricSample = require('../models/WearableMetricSample');
const { mock } = require('node:test');

test('rejects a malformed startDate', async () => {
  await assert.rejects(
    () => getRawMetrics('u1', { startDate: '09-10-2026' }),
    WearableRawDataInputError
  );
});

test('rejects endDate before startDate', async () => {
  await assert.rejects(
    () => getRawMetrics('u1', { startDate: '2026-10-09', endDate: '2026-10-01' }),
    WearableRawDataInputError
  );
});

test('rejects a span wider than 90 days', async () => {
  await assert.rejects(
    () => getRawMetrics('u1', { startDate: '2026-01-01', endDate: '2026-10-09' }),
    WearableRawDataInputError
  );
});

test('default window (no dates given) queries the last 30 days ending today, end-inclusive', async () => {
  const findMock = mock.method(WearableMetricSample, 'find', () => ({
    select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }),
  }));

  await getRawMetrics('u1', {});

  const query = findMock.mock.calls[0].arguments[0];
  const spanDays = (query.timestamp.$lt - query.timestamp.$gte) / 86400000;
  assert.strictEqual(spanDays, 31, 'should span 30 days + 1 (end-exclusive-of-next-day correctly includes the whole end date)');
  mock.restoreAll();
});

test('explicit startDate/endDate produce an end-exclusive-of-next-day window', async () => {
  const findMock = mock.method(WearableMetricSample, 'find', () => ({
    select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }),
  }));

  await getRawMetrics('u1', { startDate: '2026-10-07', endDate: '2026-10-09' });

  const query = findMock.mock.calls[0].arguments[0];
  assert.strictEqual(query.timestamp.$gte.toISOString(), '2026-10-07T00:00:00.000Z');
  assert.strictEqual(query.timestamp.$lt.toISOString(), '2026-10-10T00:00:00.000Z', 'end date must be inclusive — $lt is the day AFTER endDate');
  mock.restoreAll();
});

test('types=a,b,c is parsed into an $in filter', async () => {
  const findMock = mock.method(WearableMetricSample, 'find', () => ({
    select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }),
  }));

  await getRawMetrics('u1', { types: 'steps, heart_rate_variability_rmssd ,resting_heart_rate' });

  const query = findMock.mock.calls[0].arguments[0];
  assert.deepStrictEqual(query['meta.seriesType'].$in, ['steps', 'heart_rate_variability_rmssd', 'resting_heart_rate']);
  mock.restoreAll();
});

test('no types param omits the seriesType filter entirely', async () => {
  const findMock = mock.method(WearableMetricSample, 'find', () => ({
    select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }),
  }));

  await getRawMetrics('u1', {});

  const query = findMock.mock.calls[0].arguments[0];
  assert.strictEqual(query['meta.seriesType'], undefined);
  mock.restoreAll();
});
