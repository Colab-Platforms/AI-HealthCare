// Periodic pull for timeseries types whose webhook delivery is unreliable.
//
// Discovered via 'steps': Open Wearables emits timeseries webhooks from a
// daemon thread started in an `after_commit` hook inside the same DB
// transaction as several other writes in one sync pass. In practice that
// thread doesn't always survive to deliver — it's silent, no error on
// either side, the data lands fine in Open Wearables' own Postgres but
// never reaches us. Scores had the same symptom for a different reason
// (no webhook at all); this is the equivalent fix for series types whose
// webhook fires but doesn't reliably arrive.
//
// Mirrors wearableScoreSyncService's shape on purpose (incremental cursor,
// concurrency-limited, overlap-guarded, event-triggered primary path + cron
// safety net) — see that file for the detailed rationale, not repeated here.

const openWearablesClient = require('../config/openWearables');
const WearableData = require('../models/WearableData');
const wearableIngest = require('./wearableIngestService');
const cache = require('../utils/cache');

// series_types to pull this way. Keep this list to the ones actually proven
// unreliable over the webhook path — everything else (energy, heart_rate,
// body composition, ...) has been observed arriving fine via webhook, and
// pulling it too would just be redundant load for no benefit.
const TIMESERIES_PULL_TYPES = ['steps'];

// deviceTypes whose provider integration can report the above via Open
// Wearables' generic /timeseries endpoint. Whoop confirmed (cycle.step_count,
// patched in on Open Wearables' side — see data_247.py normalize_cycle).
const TIMESERIES_CAPABLE_DEVICE_TYPES = ['whoop'];

const CONCURRENCY = 5;
const FIRST_RUN_LOOKBACK_MS = 24 * 60 * 60 * 1000;

let isRunning = false;
const inFlightWearableIds = new Set();

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

function normalizeSample(raw) {
  return {
    seriesType: raw.type,
    value: raw.value,
    unit: raw.unit,
    timestamp: raw.timestamp,
    device: raw.source?.device
  };
}

async function syncOneWearable(wearable) {
  const since = wearable.lastTimeseriesSyncAt || new Date(Date.now() - FIRST_RUN_LOOKBACK_MS);
  const now = new Date();

  // Built manually, not passed via axios `params` — axios's default array
  // serialization (types[]=steps) silently doesn't match what FastAPI's
  // list[SeriesType] query param expects (repeated types=steps&types=x),
  // so the filter was being ignored outright and the endpoint returned
  // every series type instead of just the ones in TIMESERIES_PULL_TYPES.
  const query = new URLSearchParams();
  query.append('start_time', since.toISOString());
  query.append('end_time', now.toISOString());
  for (const type of TIMESERIES_PULL_TYPES) query.append('types', type);

  const { data } = await openWearablesClient.get(
    `/users/${wearable.openWearablesUserId}/timeseries?${query.toString()}`
  );

  const samples = (data?.data || []).map(normalizeSample);
  const savedCount = await wearableIngest.applyGenericMetric(
    wearable.user,
    wearable.deviceType,
    wearable.deviceType,
    samples,
    { wearable }
  );

  wearable.lastTimeseriesSyncAt = now;
  await wearable.save();

  if (samples.length > 0) {
    cache.delete(`dashboard:${wearable.user}`);
  }

  return { wearableId: wearable._id, fetched: samples.length, saved: savedCount };
}

async function syncOneWearableGuarded(wearable) {
  const key = String(wearable._id);
  if (inFlightWearableIds.has(key)) {
    return { wearableId: wearable._id, skipped: true, reason: 'already_in_flight' };
  }
  inFlightWearableIds.add(key);
  try {
    return await syncOneWearable(wearable);
  } finally {
    inFlightWearableIds.delete(key);
  }
}

// Event-triggered path — call from handleWebhook's 'sync.completed' case
// alongside syncScoreForConnection, same trigger, different data.
async function syncTimeseriesForConnection(openWearablesUserId, provider) {
  if (!TIMESERIES_CAPABLE_DEVICE_TYPES.includes(provider)) {
    return { skipped: true, reason: 'provider_not_timeseries_capable' };
  }
  if (!openWearablesClient.isConfigured) {
    return { skipped: true, reason: 'not_configured' };
  }

  const wearable = await WearableData.findOne({ openWearablesUserId, deviceType: provider });
  if (!wearable) {
    return { skipped: true, reason: 'wearable_not_found' };
  }

  try {
    return await syncOneWearableGuarded(wearable);
  } catch (error) {
    console.error(
      `[WearableTimeseriesSync] event-triggered sync failed for wearable=${wearable._id} user=${wearable.user}: ${error.message}`
    );
    return { wearableId: wearable._id, error: error.message };
  }
}

async function runTimeseriesSync() {
  if (!openWearablesClient.isConfigured) {
    return { skipped: true, reason: 'not_configured' };
  }
  if (isRunning) {
    return { skipped: true, reason: 'already_running' };
  }

  isRunning = true;
  try {
    const wearables = await WearableData.find({
      deviceType: { $in: TIMESERIES_CAPABLE_DEVICE_TYPES },
      isConnected: true,
      openWearablesUserId: { $exists: true, $ne: null }
    });

    if (wearables.length === 0) {
      return { skipped: true, reason: 'no_eligible_connections' };
    }

    const results = await mapWithConcurrency(wearables, CONCURRENCY, async (wearable) => {
      try {
        return await syncOneWearableGuarded(wearable);
      } catch (error) {
        console.error(
          `[WearableTimeseriesSync] failed for wearable=${wearable._id} user=${wearable.user}: ${error.message}`
        );
        return { wearableId: wearable._id, error: error.message };
      }
    });

    const saved = results.reduce((sum, r) => sum + (r.saved || 0), 0);
    const failed = results.filter((r) => r.error).length;
    if (saved > 0 || failed > 0) {
      console.log(`[WearableTimeseriesSync] processed=${wearables.length} saved=${saved} failed=${failed}`);
    }
    return { processed: wearables.length, saved, failed };
  } finally {
    isRunning = false;
  }
}

module.exports = { runTimeseriesSync, syncTimeseriesForConnection, TIMESERIES_CAPABLE_DEVICE_TYPES };
