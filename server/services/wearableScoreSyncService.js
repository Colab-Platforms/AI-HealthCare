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
// scores server-side — confirmed by HealthScoreCategory entries in that
// provider's coverage.py on the Open Wearables side. Only Whoop has actually
// been connected/tested end-to-end so far; the rest are wired in ahead of
// time since this code path needs no per-provider changes, just an entry
// here once that provider is connected.
//   whoop:      sleep, recovery, strain
//   garmin:     sleep, stress, body_battery
//   oura:       activity, readiness, sleep
//   polar:      sleep, strain, recovery, readiness
//   sensorbio:  recovery, activity, sleep
//   suunto:     recovery
// Apple and Google have no health-score concept in Open Wearables at all —
// never add them here, their health-scores call would just 0-result forever.
const SCORE_CAPABLE_DEVICE_TYPES = ['whoop', 'garmin', 'oura', 'polar', 'sensorbio', 'suunto'];

// deviceTypes that go through Open Wearables' OAuth connect flow (as opposed
// to the SDK-based flow for Apple, or our own os-sync bridge for
// noise/boat/manual). Used only for the isConnected reconciliation below —
// unrelated to which of these also compute health scores.
const OAUTH_PROVIDERS = ['google', 'whoop', 'garmin', 'oura', 'polar', 'suunto', 'strava', 'sensorbio', 'ultrahuman'];

const CONCURRENCY = 5;
const FIRST_RUN_LOOKBACK_MS = 24 * 60 * 60 * 1000; // 24h — bounds the very first poll for a newly-connected user

let isRunning = false;
// Per-wearable guard — separate from isRunning (the batch run's overlap
// guard) because an event-triggered single-user sync can legitimately land
// while a batch run is mid-flight. Without this, both paths could read the
// same wearable doc's lastScoreSyncAt concurrently and race on the save.
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

// Event-triggered path: called from the webhook handler right when Open
// Wearables tells us a sync finished for a score-capable provider, so scores
// typically land within seconds instead of waiting for the next cron tick.
// The cron (runWearableScoreSync) stays on as a safety net for whatever this
// misses — a dropped webhook, a delivery retry that never came, a server
// restart mid-flight — on a wider interval since it's now a backstop, not
// the primary path.
async function syncScoreForConnection(openWearablesUserId, provider) {
  if (!SCORE_CAPABLE_DEVICE_TYPES.includes(provider)) {
    return { skipped: true, reason: 'provider_not_score_capable' };
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
      `[WearableScoreSync] event-triggered sync failed for wearable=${wearable._id} user=${wearable.user}: ${error.message}`
    );
    return { wearableId: wearable._id, error: error.message };
  }
}

// Open Wearables only fires 'connection.created' on an inactive->active
// transition (see _save_connection/was_inactive on its side). Reconnecting
// an account that Open Wearables still considers active — e.g. the same
// Whoop account already linked to a different internal Open Wearables user,
// or a reconnect run twice in testing — updates the token successfully but
// emits *no* webhook at all, so our isConnected:false never gets corrected
// by the webhook path. This periodically asks Open Wearables for the truth
// and self-heals the mismatch, independent of whether any event ever arrives.
async function reconcileOneConnection(wearable) {
  const { data } = await openWearablesClient.get(`/users/${wearable.openWearablesUserId}/connections`);
  const match = Array.isArray(data) ? data.find((c) => c.provider === wearable.deviceType) : null;

  if (match?.status === 'active') {
    wearable.isConnected = true;
    wearable.lastSyncedAt = new Date();
    await wearable.save();
    cache.delete(`dashboard:${wearable.user}`);
    console.log(
      `[WearableScoreSync] reconciled isConnected=true for wearable=${wearable._id} ` +
      `(Open Wearables reports active; the connecting webhook was never sent)`
    );
    return { wearableId: wearable._id, reconciled: true };
  }
  return { wearableId: wearable._id, reconciled: false };
}

async function reconcileConnectionStatuses() {
  if (!openWearablesClient.isConfigured) {
    return { skipped: true, reason: 'not_configured' };
  }

  const candidates = await WearableData.find({
    deviceType: { $in: OAUTH_PROVIDERS },
    isConnected: false,
    openWearablesUserId: { $exists: true, $ne: null }
  });

  if (candidates.length === 0) {
    return { skipped: true, reason: 'no_candidates' };
  }

  const results = await mapWithConcurrency(candidates, CONCURRENCY, async (wearable) => {
    try {
      return await reconcileOneConnection(wearable);
    } catch (error) {
      console.error(`[WearableScoreSync] reconcile failed for wearable=${wearable._id}: ${error.message}`);
      return { wearableId: wearable._id, error: error.message };
    }
  });

  const reconciled = results.filter((r) => r.reconciled).length;
  const failed = results.filter((r) => r.error).length;
  if (reconciled > 0 || failed > 0) {
    console.log(`[WearableScoreSync] connection reconcile: checked=${candidates.length} reconciled=${reconciled} failed=${failed}`);
  }
  return { checked: candidates.length, reconciled, failed };
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
        return await syncOneWearableGuarded(wearable);
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

module.exports = { runWearableScoreSync, syncScoreForConnection, reconcileConnectionStatuses, SCORE_CAPABLE_DEVICE_TYPES };
