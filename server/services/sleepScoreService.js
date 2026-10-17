// Single source of truth for "what is this night's sleep quality score" —
// used by BOTH the Sleep screen (sleepAnalyticsService.js) and sleep
// insights (sleepClinicalAnalysisService.js). Before this existed, each
// computed its own number independently (one checked a native score, the
// other didn't), so the insight could show one value while the screen right
// next to it showed another for the exact same night.
const WearableScoreSample = require('../models/WearableScoreSample');
const { SCORE_CAPABLE_DEVICE_TYPES } = require('./wearableScoreSyncService');

// Fallback score for devices with no native sleep score (or none synced
// yet) — NSF guideline: 8hrs ideal, deviation penalized linearly.
function estimateQualityScore(totalSleepMinutes) {
  if (!totalSleepMinutes) return null;
  const hours = totalSleepMinutes / 60;
  const deviation = Math.abs(hours - 8);
  const score = 100 - deviation * 15;
  return Math.max(0, Math.min(100, Math.round(score)));
}

// Batch-fetches native sleep scores for a list of SleepSession docs in ONE
// query (keyed by session date), instead of one query per session — which
// would N+1 a multi-week range view.
//
// Matched by [bedTime, wakeTime] window, not calendar day — a sleep score's
// timestamp is anchored to the session's bed time, usually the previous UTC
// day for an IST user, so a same-UTC-day match misses it entirely (same
// issue recoveryScoreService.js's native lookup doesn't have, since
// recovery scores land within the day they're FOR, not the day before).
//
// Earliest-in-window wins when Open Wearables sends more than one 'sleep'
// entry for the same night — confirmed live: one real session had two,
// timestamped at bedTime (realistic, varied component values; user
// confirmed this one matches WHOOP's own app) and at wakeTime (suspiciously
// uniform near-100 values, a provisional score sent before the night's data
// fully processed). The earlier one is deliberately preferred.
async function getNativeSleepScoresByDate(userId, sessions) {
  const scoreCapable = sessions.filter(
    (s) => SCORE_CAPABLE_DEVICE_TYPES.includes(s.deviceType) && s.bedTime && s.wakeTime
  );
  if (scoreCapable.length === 0) return new Map();

  const minBed = new Date(Math.min(...scoreCapable.map((s) => new Date(s.bedTime).getTime())));
  const maxWake = new Date(Math.max(...scoreCapable.map((s) => new Date(s.wakeTime).getTime())));

  const samples = await WearableScoreSample.find({
    user: userId,
    'meta.category': 'sleep',
    'meta.deviceType': { $in: SCORE_CAPABLE_DEVICE_TYPES },
    timestamp: { $gte: minBed, $lte: maxWake },
  }).sort({ timestamp: 1 }).lean();

  const map = new Map();
  for (const session of scoreCapable) {
    const bedTime = new Date(session.bedTime).getTime();
    const wakeTime = new Date(session.wakeTime).getTime();
    const match = samples.find((s) => {
      const t = new Date(s.timestamp).getTime();
      return t >= bedTime && t <= wakeTime && s.meta.deviceType === session.deviceType;
    });
    if (match && Number.isFinite(match.value)) {
      const dateKey = session.date.toISOString().split('T')[0];
      map.set(dateKey, Math.round(Math.max(0, Math.min(100, match.value))));
    }
  }
  return map;
}

// Native score wins outright when available (the exact number the
// provider's own app shows); otherwise falls back to estimateQualityScore.
// `nativeScoreMap` comes from getNativeSleepScoresByDate — pass an empty Map
// to always get the computed fallback (e.g. for a device never in
// SCORE_CAPABLE_DEVICE_TYPES).
function resolveSleepQualityScore(session, nativeScoreMap) {
  const dateKey = session.date.toISOString().split('T')[0];
  const native = nativeScoreMap.get(dateKey);
  if (native != null) return { value: native, source: 'native' };
  return { value: estimateQualityScore(session.totalSleepMinutes), source: 'computed' };
}

module.exports = { estimateQualityScore, getNativeSleepScoresByDate, resolveSleepQualityScore };
