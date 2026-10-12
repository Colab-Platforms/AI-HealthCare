/**
 * Real cross-connection concurrency regression for applyScores' Redis lock
 * (WHOOP_SCORE_DUPLICATION follow-up). The mocked unit tests in
 * wearableScoreDedup.test.js prove the dedup logic; they can't prove the
 * race is actually closed, because mocks never truly run two calls in
 * parallel against the same backing store. This hits real staging MongoDB
 * + real staging Redis with two genuinely concurrent applyScores calls
 * against the same identity, using changed externalIds and a changed value
 * — the exact shape that produced a duplicate document before the lock
 * (SET NX PX in wearableIngestService.js) was added.
 *
 * Skipped unless USE_STAGING_DB=true and REDIS_URL_STAGING are both set,
 * so a normal `node --test` run doesn't require staging credentials.
 *
 * Run: USE_STAGING_DB=true node --test tests/wearableScoreDedup.staging.test.js
 */
const { test } = require('node:test');
const assert = require('assert');

require('dotenv').config();
const shouldRun = process.env.USE_STAGING_DB === 'true' && !!process.env.REDIS_URL_STAGING;

test('applyScores: two genuinely concurrent calls (changed externalIds + changed value) against staging produce exactly one document', { skip: !shouldRun }, async () => {
  const mongoose = require('mongoose');
  await require('../config/db')();
  assert.strictEqual(mongoose.connection.name, 'healthcare-ai-staging', 'refusing to run outside staging');

  const WearableScoreSample = require('../models/WearableScoreSample');
  const { applyScores } = require('../services/wearableIngestService');

  const userId = new mongoose.Types.ObjectId();
  const ts = new Date('2026-10-08T01:12:32.370Z');

  try {
    await WearableScoreSample.create({
      user: userId,
      meta: { deviceType: 'whoop', category: 'sleep', provider: 'whoop' },
      externalId: 'old-external-id',
      timestamp: ts,
      value: 70,
      components: { stages: { value: 100 } }
    });

    const results = await Promise.all([
      applyScores(userId, 'whoop', 'whoop', [
        { externalId: 'race-id-A', category: 'sleep', value: 85, timestamp: ts, components: { stages: { value: 100 } } }
      ]),
      applyScores(userId, 'whoop', 'whoop', [
        { externalId: 'race-id-B', category: 'sleep', value: 85, timestamp: ts, components: { stages: { value: 100 } } }
      ])
    ]);

    const docs = await WearableScoreSample.find({ user: userId }).lean();

    assert.strictEqual(docs.length, 1, `expected exactly one doc, got ${docs.length}`);
    assert.strictEqual(docs[0].value, 85);
    assert.strictEqual(results.reduce((a, b) => a + b, 0), 1, 'exactly one of the two racing calls should report a real change');
  } finally {
    await WearableScoreSample.deleteMany({ user: userId });
  }
});
