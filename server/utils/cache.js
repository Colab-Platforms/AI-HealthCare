const { getClient, isConfigured } = require('./redisClient');

/**
 * 🚀 PERFORMANCE & SCALING LAYER
 *
 * Uses Redis when REDIS_URL is set and reachable, otherwise a bounded in-memory
 * store. Redis health is re-checked on every call (see utils/redisClient), so a
 * transient outage degrades to memory and then recovers by itself.
 *
 * NOTE: values go through JSON, so Date objects come back as ISO strings. Do not
 * cache anything whose Dates are later compared as Dates — see utils/userCache
 * for why that matters.
 */

const MAX_MEMORY_ENTRIES = 2000;

// key -> { value, expiresAt }. Insertion-ordered, so the oldest key is first.
const memoryStore = new Map();

function memoryGet(key) {
  const hit = memoryStore.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  // Mark most-recently-used.
  memoryStore.delete(key);
  memoryStore.set(key, hit);
  return hit.value;
}

function memorySet(key, value, ttlSeconds) {
  memoryStore.delete(key);
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  // Hard cap: the old implementation only swept on a 10-minute timer, so a
  // burst of distinct keys could grow this without bound on a small instance.
  while (memoryStore.size > MAX_MEMORY_ENTRIES) {
    memoryStore.delete(memoryStore.keys().next().value);
  }
}

const cache = {
  async get(key) {
    const redis = getClient();
    if (redis) {
      try {
        const val = await redis.get(key);
        if (val !== null) return JSON.parse(val);
        return null;
      } catch (err) {
        console.error('[Cache] Redis GET failed, falling back to memory:', err.message);
      }
    }
    return memoryGet(key);
  },

  async set(key, value, ttlSeconds = 300) {
    const cleanValue = typeof value === 'object' && value !== null ? value : { data: value };

    const redis = getClient();
    if (redis) {
      try {
        await redis.set(key, JSON.stringify(cleanValue), 'EX', ttlSeconds);
        return;
      } catch (err) {
        console.error('[Cache] Redis SET failed, falling back to memory:', err.message);
      }
    }
    memorySet(key, cleanValue, ttlSeconds);
  },

  async delete(key) {
    const redis = getClient();
    if (redis) {
      try {
        await redis.del(key);
      } catch (err) {
        console.error('[Cache] Redis DEL failed:', err.message);
      }
    }
    memoryStore.delete(key);
  },

  /**
   * Delete every key matching a glob pattern, e.g. `trends:<userId>:*`.
   * Uses SCAN (cursor-based, non-blocking) rather than KEYS, which blocks the
   * Redis server for the duration of a full keyspace walk.
   */
  async deletePattern(pattern) {
    const redis = getClient();
    if (redis) {
      try {
        let cursor = '0';
        do {
          const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
          cursor = next;
          if (keys.length) await redis.del(...keys);
        } while (cursor !== '0');
      } catch (err) {
        console.error('[Cache] Redis SCAN/DEL failed:', err.message);
      }
    }

    // Mirror the deletion in the memory store.
    const re = new RegExp('^' + pattern.split('*').map(s =>
      s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
    for (const key of memoryStore.keys()) {
      if (re.test(key)) memoryStore.delete(key);
    }
  },

  /**
   * Clear this application's cached entries.
   *
   * Deliberately NOT redis.flushall(): that wipes the entire Redis database,
   * including rate-limit counters and anything else sharing the instance.
   */
  async clear(pattern = '*') {
    await this.deletePattern(pattern);
    memoryStore.clear();
  },

  async getOrSet(key, fetchFn, ttl = 120) {
    const cached = await this.get(key);
    if (cached !== null && cached !== undefined) return cached;

    const freshData = await fetchFn();
    if (freshData) await this.set(key, freshData, ttl);
    return freshData;
  },

  stats() {
    return {
      redisConfigured: isConfigured(),
      redisHealthy: getClient() !== null,
      memoryEntries: memoryStore.size,
      memoryMaxEntries: MAX_MEMORY_ENTRIES,
    };
  },
};

// Periodic sweep of expired memory entries. The LRU cap above is the real bound;
// this just releases memory sooner for keys nobody reads again.
setInterval(() => {
  const now = Date.now();
  for (const [key, hit] of memoryStore.entries()) {
    if (now > hit.expiresAt) memoryStore.delete(key);
  }
}, 10 * 60 * 1000).unref();

module.exports = cache;
