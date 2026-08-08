/**
 * Short-lived cache for the user document loaded by `protect` on every request.
 *
 * Why in-process and not Redis:
 * this cache stores the *live object*, never a serialised copy. Round-tripping
 * a user through JSON turns Date fields into strings, and
 * middleware/subscriptionAccess.js compares `sub.currentPeriodEnd > new Date()`
 * — a string/Date comparison there comes out false and silently denies paid
 * users their features. Keeping the object in memory preserves Dates and
 * ObjectIds exactly, and is also faster than a Redis round trip.
 *
 * Trade-off: the cache is per-instance. On more than one instance each has its
 * own view for up to TTL_MS, and invalidation (below) is local. That is fine for
 * a single-instance deployment; if you scale out and need strict cross-instance
 * freshness, publish invalidations over Redis pub/sub and subscribe here.
 *
 * Entries are invalidated automatically by Mongoose hooks in models/User.js, so
 * writes anywhere in the codebase stay correct without remembering to call this.
 *
 * Safety: callers must treat the returned object as read-only — it is shared by
 * reference across concurrent requests. Nothing assigns to req.user today.
 */

const TTL_MS = 30 * 1000;
const MAX_ENTRIES = 5000;

const store = new Map(); // key -> { user, expiresAt }

function get(userId) {
  const key = String(userId);
  const hit = store.get(key);
  if (!hit) return null;

  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }

  // Re-insert to mark as most-recently-used (Map preserves insertion order).
  store.delete(key);
  store.set(key, hit);
  return hit.user;
}

function set(userId, user) {
  if (!user) return;
  const key = String(userId);
  store.delete(key);
  store.set(key, { user, expiresAt: Date.now() + TTL_MS });

  // Bounded so a large user base can't grow this without limit on a small box.
  while (store.size > MAX_ENTRIES) {
    store.delete(store.keys().next().value);
  }
}

function invalidate(userId) {
  if (userId) store.delete(String(userId));
}

function clear() {
  store.clear();
}

function stats() {
  return { size: store.size, maxEntries: MAX_ENTRIES, ttlMs: TTL_MS };
}

module.exports = { get, set, invalidate, clear, stats, TTL_MS };
