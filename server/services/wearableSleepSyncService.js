// Periodic pull for sleep sessions — the same architectural gap steps/scores
// had before being fixed: applySleepSessions is only ever called from the
// 'sleep.created' webhook handler (wearableController.js), with no REST-pull
// safety net. Confirmed missing live for Abhiraj Patil's 7-8 Oct session —
// Open Wearables had the full stage breakdown, take.health had no record of
// that night at all (the webhook never created it). Same event + 30-min cron
// safety-net pattern as wearableScoreSyncService.js / wearableTimeseriesSyncService.js
// — see those files for the detailed rationale, not repeated here.

const openWearablesClient = require('../config/openWearables');
const WearableData = require('../models/WearableData');
const wearableIngest = require('./wearableIngestService');
const cache = require('../utils/cache');

// Same set as SCORE_CAPABLE_DEVICE_TYPES (wearableScoreSyncService.js) —
// providers whose Open Wearables integration computes sleep events
// server-side. Only Whoop tested end-to-end so far.
const SLEEP_CAPABLE_DEVICE_TYPES = ['whoop', 'garmin', 'oura', 'polar', 'sensorbio', 'suunto'];

const CONCURRENCY = 5;
const FIRST_RUN_LOOKBACK_MS = 24 * 60 * 60 * 1000;
// 48h trailing buffer on an EXISTING cursor only — see
// WHOOP_SAME_DAY_SYNC_DIAGNOSTIC.md / wearableScoreSyncService.js for why an
// unconditionally-advancing cursor permanently excludes a delayed record.
const SYNC_LOOKBACK_MS = 48 * 60 * 60 * 1000;
const PAGE_LIMIT = 100;

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

// Bucketed by wake-up day in IST, not bed-time's UTC date — mirrors the
// identical fix in wearableController.js's 'sleep.created' webhook handler
// (same reasoning, kept in sync so the webhook path and this REST-pull
// safety net never disagree on which day a session belongs to).
function dateOnlyIST(value) {
  const { istDateKey } = require('./dailyInsightService');
  const key = istDateKey(new Date(value));
  return new Date(`${key}T00:00:00.000Z`);
}

function normalizeSleepEvent(raw) {
  return {
    date: dateOnlyIST(raw.end_time),
    totalSleepMinutes: Math.round(raw.duration_seconds / 60),
    deepSleepMinutes: raw.stages?.deep_minutes,
    lightSleepMinutes: raw.stages?.light_minutes,
    remSleepMinutes: raw.stages?.rem_minutes,
    awakeMinutes: raw.stages?.awake_minutes,
    bedTime: raw.start_time,
    wakeTime: raw.end_time,
    sourceRecordId: raw.id ? String(raw.id) : undefined,
  };
}

// Fetches every page for the window — /events/sleep pagination is
// cursor-based (confirmed against Open Wearables' openapi schema), same
// shape as /timeseries. Throws on any page failure rather than returning a
// partial result — the caller must not advance the cursor on a partial fetch.
async function fetchAllSleepEvents(openWearablesUserId, since, until) {
  const all = [];
  let cursor;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const params = { start_date: since.toISOString(), end_date: until.toISOString(), limit: PAGE_LIMIT };
    if (cursor) params.cursor = cursor;
    const { data } = await openWearablesClient.get(`/users/${openWearablesUserId}/events/sleep`, { params });
    const page = data?.data || [];
    all.push(...page);
    if (!data?.pagination?.has_more || !data?.pagination?.next_cursor) break;
    cursor = data.pagination.next_cursor;
  }
  return all;
}

async function syncOneWearable(wearable) {
  const now = new Date();
  const since = wearable.lastSleepSyncAt
    ? new Date(wearable.lastSleepSyncAt.getTime() - SYNC_LOOKBACK_MS)
    : new Date(now.getTime() - FIRST_RUN_LOOKBACK_MS);

  const raw = await fetchAllSleepEvents(wearable.openWearablesUserId, since, now);
  const sessions = raw.map(normalizeSleepEvent);

  // applySleepSessions upserts by {user, deviceType, date} — a session
  // re-fetched in this window (e.g. one already ingested via webhook)
  // safely overwrites with the same/refreshed values, not a duplicate.
  await wearableIngest.applySleepSessions(wearable.user, wearable.deviceType, 'open_wearables', sessions, { wearable });

  wearable.lastSleepSyncAt = now;
  await wearable.save();

  if (sessions.length > 0) {
    cache.delete(`dashboard:${wearable.user}`);
    cache.deletePattern(`sleep_analytics:${wearable.user}:*`);
  }

  return { wearableId: wearable._id, fetched: sessions.length };
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
// alongside syncScoreForConnection/syncTimeseriesForConnection, same
// trigger, different data.
async function syncSleepForConnection(openWearablesUserId, provider) {
  if (!SLEEP_CAPABLE_DEVICE_TYPES.includes(provider)) {
    return { skipped: true, reason: 'provider_not_sleep_capable' };
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
      `[WearableSleepSync] event-triggered sync failed for wearable=${wearable._id} user=${wearable.user}: ${error.message}`
    );
    return { wearableId: wearable._id, error: error.message };
  }
}

async function runWearableSleepSync() {
  if (!openWearablesClient.isConfigured) {
    return { skipped: true, reason: 'not_configured' };
  }
  if (isRunning) {
    return { skipped: true, reason: 'already_running' };
  }

  isRunning = true;
  try {
    const wearables = await WearableData.find({
      deviceType: { $in: SLEEP_CAPABLE_DEVICE_TYPES },
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
          `[WearableSleepSync] failed for wearable=${wearable._id} user=${wearable.user}: ${error.message}`
        );
        return { wearableId: wearable._id, error: error.message };
      }
    });

    const fetched = results.reduce((sum, r) => sum + (r.fetched || 0), 0);
    const failed = results.filter((r) => r.error).length;
    if (fetched > 0 || failed > 0) {
      console.log(`[WearableSleepSync] processed=${wearables.length} fetched=${fetched} failed=${failed}`);
    }
    return { processed: wearables.length, fetched, failed };
  } finally {
    isRunning = false;
  }
}

module.exports = { runWearableSleepSync, syncSleepForConnection, SLEEP_CAPABLE_DEVICE_TYPES };
