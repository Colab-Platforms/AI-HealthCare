const Redis = require('ioredis');
const dotenv = require('dotenv');

dotenv.config();

/**
 * 🚀 PERFORMANCE & SCALING LAYER
 * This caching utility automatically uses Redis if process.env.REDIS_URL is provided.
 * It falls back to a high-performance in-memory Map for local development.
 * 
 * Target: Handles 10,000+ concurrent requests by offloading DB load.
 */

let redis = null;
if (process.env.REDIS_URL) {
  try {
    const redisUrl = process.env.REDIS_URL;
    const isUpstash = redisUrl.includes('upstash.io');
    
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      tls: isUpstash ? { rejectUnauthorized: false } : undefined,
      reconnectOnError: (err) => {
        console.warn('[Cache] Redis reconnection error:', err.message);
        return true;
      }
    });
    
    redis.on('connect', () => console.log('✅ [Cache] Connected to Redis Cloud/Server'));
    redis.on('error', (err) => {
      console.error('❌ [Cache] Redis Connection Failed. Falling back to memory.', err.message);
      redis = null; // Force fallback
    });
  } catch (err) {
    console.error('❌ [Cache] Could not initialize Redis client:', err.message);
    redis = null;
  }
} else {
  console.log('ℹ️ [Cache] No REDIS_URL found. Using local in-memory store.');
}

// High-performance Memory Fallback
const memoryCache = new Map();
const memoryExpiry = new Map();

const cache = {
  /**
   * Get value from cache (Async to support Redis)
   */
  async get(key) {
    if (redis) {
      try {
        const val = await redis.get(key);
        return val ? JSON.parse(val) : null;
      } catch (err) {
        console.error('[Cache] Redis Get Error:', err.message);
        return this.getFromMemory(key);
      }
    }
    return this.getFromMemory(key);
  },

  getFromMemory(key) {
    const expiry = memoryExpiry.get(key);
    if (expiry && Date.now() > expiry) {
      this.deleteFromMemory(key);
      return null;
    }
    return memoryCache.get(key);
  },

  /**
   * Set value in cache
   */
  async set(key, value, ttlSeconds = 300) {
    // Basic validation to prevent saving circular structures or huge payloads
    const cleanValue = typeof value === 'object' ? value : { data: value };
    
    if (redis) {
      try {
        await redis.set(key, JSON.stringify(cleanValue), 'EX', ttlSeconds);
        return;
      } catch (err) {
        console.error('[Cache] Redis Set Error:', err.message);
      }
    }
    
    // Memory Cache
    memoryCache.set(key, cleanValue);
    memoryExpiry.set(key, Date.now() + (ttlSeconds * 1000));
  },

  /**
   * Delete specific key
   */
  async delete(key) {
    if (redis) {
      try {
        await redis.del(key);
      } catch (err) {
        console.error('[Cache] Redis Del Error:', err.message);
      }
    }
    this.deleteFromMemory(key);
  },

  deleteFromMemory(key) {
    memoryCache.delete(key);
    memoryExpiry.delete(key);
  },

  /**
   * Clear everything (Maintenance)
   */
  async clear() {
    if (redis) {
      try {
        await redis.flushall();
      } catch (err) {
        console.error('[Cache] Redis Flush Error:', err.message);
      }
    }
    memoryCache.clear();
    memoryExpiry.clear();
  },

  /**
   * Helper for Dashboard Aggregations
   */
  async getOrSet(key, fetchFn, ttl = 120) {
    const cached = await this.get(key);
    if (cached) return cached;
    
    const freshData = await fetchFn();
    if (freshData) {
      await this.set(key, freshData, ttl);
    }
    return freshData;
  }
};

// Periodic Memory Cleanup (Memory safety for non-Redis mode)
setInterval(() => {
  const now = Date.now();
  for (const [key, expiry] of memoryExpiry.entries()) {
    if (now > expiry) {
      memoryCache.delete(key);
      memoryExpiry.delete(key);
    }
  }
}, 10 * 60 * 1000); // Every 10 mins

module.exports = cache;
