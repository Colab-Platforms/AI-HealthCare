// Frontend caching utility using localStorage
const CACHE_PREFIX = 'healthai_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export const cache = {
  set(key, value, ttl = DEFAULT_TTL) {
    try {
      const item = {
        value,
        expiry: Date.now() + ttl
      };
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  },

  get(key) {
    try {
      const itemStr = localStorage.getItem(CACHE_PREFIX + key);
      if (!itemStr) return null;

      const item = JSON.parse(itemStr);
      if (Date.now() > item.expiry) {
        this.delete(key);
        return null;
      }

      return item.value;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  },

  delete(key) {
    try {
      localStorage.removeItem(CACHE_PREFIX + key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  },

  clear() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  },

  // Clean expired entries
  cleanup() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(CACHE_PREFIX)) {
          const itemStr = localStorage.getItem(key);
          if (itemStr) {
            const item = JSON.parse(itemStr);
            if (Date.now() > item.expiry) {
              localStorage.removeItem(key);
            }
          }
        }
      });
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }
};

// Cleanup on page load
cache.cleanup();

// Cleanup every 5 minutes
setInterval(() => cache.cleanup(), 5 * 60 * 1000);

export default cache;
