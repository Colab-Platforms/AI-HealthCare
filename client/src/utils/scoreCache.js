import { cache } from './cache';

export const HEALTH_SCORE_CACHE_KEY = 'health_score';

// Every request path that changes the Health Score. The server recomputes the
// score on read, so the only thing that can show a stale number is the client
// cache — and the only way it goes stale is one of these writes succeeding.
//
// Keeping the list here, rather than sprinkling invalidate() calls through the
// pages that log things, means a new tracker only has to add its path in one
// place. Relying on each page to remember would guarantee that one eventually
// doesn't, and the bug it causes — a score that silently lags reality — is
// exactly the kind that goes unnoticed.
const SCORE_AFFECTING_PATHS = [
  'nutrition/log-water',
  'nutrition/log-meal',
  'nutrition/quick-check/save',
  'wearables/sync',
  'wearables/sleep',
  'health/smoke-log',
  'health/alcohol-log',
  'health/daily-progress',
  'health/metrics',   // vitals, including blood pressure
  'health/upload',    // a new report changes the Clinical component
  'health/reports/',  // deleting one changes it too
];

export const affectsHealthScore = (url = '') =>
  SCORE_AFFECTING_PATHS.some((path) => url.includes(path));

// Subscribers are notified so a card already on screen refreshes immediately.
// Dropping the cache alone would only help the *next* read, which for a user
// staring at the score means it appears not to have registered their log at all.
const listeners = new Set();

export const onHealthScoreStale = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const invalidateHealthScore = () => {
  cache.delete(HEALTH_SCORE_CACHE_KEY);
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      // One bad subscriber must not stop the others from being told.
      console.error('Health score listener failed:', error);
    }
  });
};
