/**
 * Regression tests for applyScores' identity fix (WHOOP_SCORE_DUPLICATION):
 * dedup/replace is now (user, deviceType, category, timestamp), not
 * externalId — Open Wearables regenerates externalId on every sleep-score
 * recompute (confirmed from its own source: _recompute_sleep_scores deletes
 * and recreates with a fresh id, keyed internally on recorded_at), which let
 * the old externalId-based dedup insert the same logical score as a new
 * document every single sync.
 *
 * Run: node --test tests/wearableScoreDedup.test.js
 */
const { test, mock, afterEach } = require('node:test');
const assert = require('assert');

const WearableScoreSample = require('../models/WearableScoreSample');
const wearableIngest = require('../services/wearableIngestService');

function mongooseId() {
  return new (require('mongoose').Types.ObjectId)();
}

afterEach(() => mock.restoreAll());

test('applyScores: a changed upstream externalId with the SAME value is a no-op (the core bug fix)', async () => {
  const userId = mongooseId();
  const ts = new Date('2026-10-08T01:12:32.370Z');
  const existingDoc = { _id: mongooseId(), value: 96, components: { stages: { value: 100 } } };

  const findOneMock = mock.method(WearableScoreSample, 'findOne', () => ({ lean: async () => existingDoc }));
  const deleteMock = mock.method(WearableScoreSample, 'deleteOne', async () => ({ deletedCount: 1 }));
  const createMock = mock.method(WearableScoreSample, 'create', async (doc) => doc);

  const saved = await wearableIngest.applyScores(userId, 'whoop', 'whoop', [
    { externalId: 'brand-new-id-from-recompute', category: 'sleep', value: 96, timestamp: ts, components: { stages: { value: 100 } } },
  ]);

  assert.strictEqual(saved, 0, 'same value under a new externalId must not count as a change');
  assert.strictEqual(deleteMock.mock.callCount(), 0, 'must not delete when nothing actually changed');
  assert.strictEqual(createMock.mock.callCount(), 0, 'must not re-insert when nothing actually changed');
  assert.strictEqual(findOneMock.mock.calls[0].arguments[0]['meta.category'], 'sleep');
});

test('applyScores: a genuinely updated value (same identity) is replaced via delete+recreate', async () => {
  const userId = mongooseId();
  const ts = new Date('2026-10-08T01:12:32.370Z');
  const existingId = mongooseId();
  const existingDoc = { _id: existingId, value: 70, components: {} };

  mock.method(WearableScoreSample, 'findOne', () => ({ lean: async () => existingDoc }));
  const deleteMock = mock.method(WearableScoreSample, 'deleteOne', async () => ({ deletedCount: 1 }));
  const createMock = mock.method(WearableScoreSample, 'create', async (doc) => doc);

  const saved = await wearableIngest.applyScores(userId, 'whoop', 'whoop', [
    { externalId: 'new-id-2', category: 'sleep', value: 86, timestamp: ts, components: {} },
  ]);

  assert.strictEqual(saved, 1, 'a real value change must count as saved');
  assert.strictEqual(deleteMock.mock.callCount(), 1);
  assert.strictEqual(deleteMock.mock.calls[0].arguments[0]._id, existingId);
  assert.strictEqual(createMock.mock.callCount(), 1);
  assert.strictEqual(createMock.mock.calls[0].arguments[0].value, 86);
  assert.strictEqual(createMock.mock.calls[0].arguments[0].externalId, 'new-id-2', 'latest upstream externalId preserved as metadata');
});

test('applyScores: a changed components object (value same) also counts as a change', async () => {
  const userId = mongooseId();
  const ts = new Date('2026-10-08T01:12:32.370Z');
  const existingDoc = { _id: mongooseId(), value: 66, components: { hrv_rmssd_milli: { value: 50 } } };

  mock.method(WearableScoreSample, 'findOne', () => ({ lean: async () => existingDoc }));
  const deleteMock = mock.method(WearableScoreSample, 'deleteOne', async () => ({ deletedCount: 1 }));
  mock.method(WearableScoreSample, 'create', async (doc) => doc);

  const saved = await wearableIngest.applyScores(userId, 'whoop', 'whoop', [
    { externalId: 'id-3', category: 'recovery', value: 66, timestamp: ts, components: { hrv_rmssd_milli: { value: 63.48 } } },
  ]);

  assert.strictEqual(saved, 1);
  assert.strictEqual(deleteMock.mock.callCount(), 1);
});

test('applyScores: a genuinely new score (no existing identity match) is inserted normally', async () => {
  const userId = mongooseId();
  mock.method(WearableScoreSample, 'findOne', () => ({ lean: async () => null }));
  const deleteMock = mock.method(WearableScoreSample, 'deleteOne', async () => ({ deletedCount: 0 }));
  const createMock = mock.method(WearableScoreSample, 'create', async (doc) => doc);

  const saved = await wearableIngest.applyScores(userId, 'whoop', 'whoop', [
    { externalId: 'id-4', category: 'recovery', value: 75, timestamp: new Date('2026-10-09T01:36:01.379Z'), components: {} },
  ]);

  assert.strictEqual(saved, 1);
  assert.strictEqual(deleteMock.mock.callCount(), 0, 'nothing to delete for a brand-new identity');
  assert.strictEqual(createMock.mock.callCount(), 1);
});

test('applyScores: two different providers at the exact same timestamp+category do not collide', async () => {
  const userId = mongooseId();
  const ts = new Date('2026-10-09T01:36:01.379Z');
  const calls = [];
  mock.method(WearableScoreSample, 'findOne', (query) => {
    calls.push(query);
    return { lean: async () => null }; // neither exists yet
  });
  mock.method(WearableScoreSample, 'deleteOne', async () => ({ deletedCount: 0 }));
  const createMock = mock.method(WearableScoreSample, 'create', async (doc) => doc);

  await wearableIngest.applyScores(userId, 'whoop', 'whoop', [{ externalId: 'w1', category: 'recovery', value: 70, timestamp: ts, components: {} }]);
  await wearableIngest.applyScores(userId, 'garmin', 'garmin', [{ externalId: 'g1', category: 'recovery', value: 55, timestamp: ts, components: {} }]);

  assert.strictEqual(createMock.mock.callCount(), 2, 'both providers get their own row — deviceType scopes the identity');
  assert.strictEqual(calls[0]['meta.deviceType'], 'whoop');
  assert.strictEqual(calls[1]['meta.deviceType'], 'garmin');
});

test('applyScores: legitimate multiple same-day Strain entries (distinct timestamps) are all kept', async () => {
  const userId = mongooseId();
  mock.method(WearableScoreSample, 'findOne', () => ({ lean: async () => null }));
  mock.method(WearableScoreSample, 'deleteOne', async () => ({ deletedCount: 0 }));
  const createMock = mock.method(WearableScoreSample, 'create', async (doc) => doc);

  const saved = await wearableIngest.applyScores(userId, 'whoop', 'whoop', [
    { externalId: 's1', category: 'strain', value: 4.3, timestamp: new Date('2026-10-07T08:46:00.910Z'), components: {} },
    { externalId: 's2', category: 'strain', value: 5.0, timestamp: new Date('2026-10-07T14:06:00.520Z'), components: {} },
    { externalId: 's3', category: 'strain', value: 7.9, timestamp: new Date('2026-10-07T17:15:18.940Z'), components: {} },
  ]);

  assert.strictEqual(saved, 3, 'distinct timestamps are genuinely different scores, not duplicates');
  assert.strictEqual(createMock.mock.callCount(), 3);
});

test('applyScores: two different users with scores at the exact same timestamp+category+deviceType do not interfere', async () => {
  const userA = mongooseId();
  const userB = mongooseId();
  const ts = new Date('2026-10-09T01:36:01.379Z');
  const calls = [];
  mock.method(WearableScoreSample, 'findOne', (query) => {
    calls.push(query);
    return { lean: async () => null };
  });
  mock.method(WearableScoreSample, 'deleteOne', async () => ({ deletedCount: 0 }));
  const createMock = mock.method(WearableScoreSample, 'create', async (doc) => doc);

  await wearableIngest.applyScores(userA, 'whoop', 'whoop', [{ externalId: 'a1', category: 'recovery', value: 70, timestamp: ts, components: {} }]);
  await wearableIngest.applyScores(userB, 'whoop', 'whoop', [{ externalId: 'b1', category: 'recovery', value: 60, timestamp: ts, components: {} }]);

  assert.strictEqual(createMock.mock.callCount(), 2);
  assert.strictEqual(String(calls[0].user), String(userA));
  assert.strictEqual(String(calls[1].user), String(userB));
});
