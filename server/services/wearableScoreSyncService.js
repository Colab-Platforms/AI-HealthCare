// Periodic pull for Recovery/Strain/Sleep-performance scores.
//
// Every other wearable data type reaches us via Open Wearables' outgoing
// webhook (push). Health scores are the one exception — Open Wearables
// computes them server-side but never emits a webhook event for them — so
// this is a REST poll instead, wired into server.js on a cron schedule.
//
// Design notes:
// - Incremental: each WearableData doc tracks lastScoreSyncAt, so a run only
//   asks for what's new since the previous one instead of the full history.
// - Concurrency-limited: many users are fetched in parallel, but capped, so
//   a large user base doesn't fire an unbounded burst of requests at Open
//   Wearables (or saturate our own event loop).
// - Overlap-guarded: if one run is still in flight (slow network) when the
//   next cron tick fires, the tick is skipped rather than starting a second
//   pass over the same users.
// - Per-user isolation: one user's fetch failing (expired token, timeout)
//   never stops the rest of the batch.

const openWearablesClient = require('../config/openWearables');
const WearableData = require('../models/WearableData');
const wearableIngest = require('./wearableIngestService');
const cache = require('../utils/cache');

// deviceTypes whose Open Wearables provider integration computes health
// scores server-side. Add a provider here once its strategy maps
// HealthScoreCategory (recovery/strain/sleep/...) — see coverage.py on the
// Open Wearables side for a given provider.
const SCORE_CAPABLE_DEVICE_TYPES = ['whoop'];

const CONCURRENCY = 5;
const FIRST_RUN_LOOKBACK_MS = 24 * 60 * 60 * 1000; // 24h — bounds the very first poll for a newly-connected user

let isRunning = false;

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runNext() {
    while (cursor < items.length) {
      const current = cursor++;
      results[current] = await worker(items[current], current);
    }
  }

  const lane = Math.min(limit, items.length) || 1;
  await Promise.all(Array.from({ length: lane }, runNext));
  return results;
}

function normalizeScore(raw) {
  return {
    externalId: raw.id,
    category: raw.category,
    value: raw.value,
    qualifier: raw.qualifier,
    components: raw.components,
    timestamp: raw.recorded_at
  };
}

async function syncOneWearable(wearable) {
  const since = wearable.lastScoreSyncAt || new Date(Date.now() - FIRST_RUN_LOOKBACK_MS);
  const now = new Date();

  const { data } = await openWearablesClient.get(
    `/users/${wearable.openWearablesUserId}/health-scores`,
    { params: { start_date: since.toISOString(), end_date: now.toISOString() } }
  );

  const scores = (data?.data || []).map(normalizeScore);
  const savedCount = await wearableIngest.applyScores(wearable.user, wearable.deviceType, wearable.deviceType, scores);

  // Advance the cursor even when nothing new was found — "checked up to now,
  // found nothing" still means the next run shouldn't re-ask for this window.
  wearable.lastScoreSyncAt = now;
  await wearable.save();

  if (savedCount > 0) {
    cache.delete(`dashboard:${wearable.user}`);
  }

  return { wearableId: wearable._id, fetched: scores.length, saved: savedCount };
}

async function runWearableScoreSync() {
  if (!openWearablesClient.isConfigured) {
    return { skipped: true, reason: 'not_configured' };
  }
  if (isRunning) {
    return { skipped: true, reason: 'already_running' };
  }

  isRunning = true;
  try {
    const wearables = await WearableData.find({
      deviceType: { $in: SCORE_CAPABLE_DEVICE_TYPES },
      isConnected: true,
      openWearablesUserId: { $exists: true, $ne: null }
    });

    if (wearables.length === 0) {
      return { skipped: true, reason: 'no_eligible_connections' };
    }

    const results = await mapWithConcurrency(wearables, CONCURRENCY, async (wearable) => {
      try {
        return await syncOneWearable(wearable);
      } catch (error) {
        console.error(
          `[WearableScoreSync] failed for wearable=${wearable._id} user=${wearable.user}: ${error.message}`
        );
        return { wearableId: wearable._id, error: error.message };
      }
    });

    const saved = results.reduce((sum, r) => sum + (r.saved || 0), 0);
    const failed = results.filter((r) => r.error).length;
    if (saved > 0 || failed > 0) {
      console.log(`[WearableScoreSync] processed=${wearables.length} saved=${saved} failed=${failed}`);
    }
    return { processed: wearables.length, saved, failed };
  } finally {
    isRunning = false;
  }
}

module.exports = { runWearableScoreSync };
