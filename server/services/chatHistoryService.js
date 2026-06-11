const Redis = require('ioredis');
const ChatHistory = require('../models/ChatHistory');
const { Client } = require('@upstash/qstash');

class ChatHistoryService {
  constructor() {
    try {
      this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
      this.redisAvailable = true;
      this.redis.on('error', (err) => {
        console.warn('Redis connection warning:', err.message);
        this.redisAvailable = false;
      });
      this.redis.on('connect', () => {
        console.log('✓ Redis connected');
        this.redisAvailable = true;
      });
    } catch (err) {
      console.warn('Redis unavailable, will use MongoDB only:', err.message);
      this.redisAvailable = false;
      this.redis = null;
    }
    
    try {
      this.qstash = new Client({ token: process.env.QSTASH_TOKEN });
      this.qstashAvailable = !!process.env.QSTASH_TOKEN;
    } catch (err) {
      console.warn('QStash unavailable:', err.message);
      this.qstashAvailable = false;
      this.qstash = null;
    }
  }

  /**
   * Get chat history from Redis cache or MongoDB
   */
  async getHistory(userId) {
    try {
      if (!userId) {
        return { userId, messages: [], version: 0 };
      }

      // Try Redis first if available
      if (this.redisAvailable && this.redis) {
        try {
          const cacheKey = `chat:${userId}`;
          // Add 5 second timeout for Redis
          const cached = await Promise.race([
            this.redis.get(cacheKey),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 5000))
          ]);
          if (cached) {
            console.log(`✓ Cache hit for user ${userId}`);
            return JSON.parse(cached);
          }
        } catch (redisErr) {
          console.warn(`Redis get failed, falling back to MongoDB:`, redisErr.message);
        }
      }

      console.log(`📚 Fetching from MongoDB for user ${userId}`);

      // Fall back to MongoDB with 10 second timeout
      let history = await Promise.race([
        ChatHistory.findOne({ userId }).lean(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('MongoDB timeout')), 10000))
      ]);
      
      if (!history) {
        history = { userId, messages: [], version: 0 };
      }

      // Cache for 1 hour if Redis is available
      if (this.redisAvailable && this.redis) {
        try {
          const cacheKey = `chat:${userId}`;
          await this.redis.setex(cacheKey, 3600, JSON.stringify(history));
        } catch (err) {
          console.warn('Redis cache set failed:', err.message);
        }
      }
      
      return history;
    } catch (error) {
      console.error('getHistory error:', error);
      // Return empty history on timeout instead of throwing
      if (error.message.includes('timeout')) {
        console.warn('Timeout fetching chat history, returning empty');
        return { userId, messages: [], version: 0 };
      }
      throw error;
    }
  }

  /**
   * Save chat immediately to Redis, persist to MongoDB async via QStash
   */
  async saveMessages(userId, messages) {
    try {
      if (!userId) {
        throw new Error('userId is required');
      }

      if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('messages must be a non-empty array');
      }

      const cacheKey = `chat:${userId}`;
      
      const data = {
        userId,
        messages,
        lastUpdated: new Date(),
        version: Date.now()
      };

      // 1. Save to Redis immediately if available
      if (this.redisAvailable && this.redis) {
        try {
          await this.redis.setex(cacheKey, 3600, JSON.stringify(data));
          console.log(`✓ Redis cached for user ${userId}`);
        } catch (err) {
          console.warn('Redis set failed, continuing without cache:', err.message);
        }
      }

      // 2. Save to MongoDB (sync fallback or async later)
      try {
        await this.saveToDB(userId, messages);
        console.log(`✅ MongoDB saved immediately for user ${userId}`);
      } catch (mongoErr) {
        console.error('MongoDB save failed:', mongoErr.message);
        throw mongoErr;
      }

      // 3. Try QStash async if available (optional, doesn't block response)
      if (this.qstashAvailable && this.qstash) {
        try {
          await this.qstash.publishJSON({
            url: `${process.env.APP_URL}/api/queue/save-chat-history`,
            body: { userId, messages, version: data.version },
            retries: 3
          });
          console.log(`📤 QStash task queued for user ${userId}`);
        } catch (error) {
          console.warn('QStash publish warning (non-critical):', error.message);
        }
      }

      return data;
    } catch (error) {
      console.error('saveMessages error:', error);
      throw error;
    }
  }

  /**
   * MongoDB persistence (called by QStash or fallback)
   */
  async saveToDB(userId, messages) {
    try {
      let history = await ChatHistory.findOne({ userId });

      if (!history) {
        // Create new history
        history = new ChatHistory({
          userId,
          messages,
          version: 1
        });
        console.log(`✨ Created new chat history for ${userId}`);
      } else {
        // Deduplicate and merge messages
        const newMessages = this.deduplicateMessages(history.messages, messages);
        history.messages = newMessages;
        history.version += 1;

        // Keep only last 500 messages (scalable limit)
        if (history.messages.length > 500) {
          const removed = history.messages.length - 500;
          history.messages = history.messages.slice(-500);
          console.log(`🗑️ Trimmed ${removed} old messages for ${userId}`);
        }
      }

      await history.save();
      console.log(`✅ MongoDB saved for ${userId} (v${history.version})`);
      
      // Update cache with server version (non-blocking, fire and forget)
      if (this.redisAvailable && this.redis) {
        const cacheKey = `chat:${userId}`;
        this.redis.setex(cacheKey, 3600, JSON.stringify(history))
          .catch(err => console.warn('Redis cache update failed (non-critical):', err.message));
      }

      return history;
    } catch (error) {
      console.error('saveToDB error:', error);
      throw error;
    }
  }

  /**
   * Deduplicate messages by ID first, then by role + content + timestamp as fallback
   */
  deduplicateMessages(existing, incoming) {
    if (!Array.isArray(existing)) existing = [];
    if (!Array.isArray(incoming)) incoming = [];

    const seen = new Map();

    // Add existing messages
    existing.forEach(msg => {
      if (!msg) return;
      const key = msg.id || `${msg.role}:${msg.content}:${new Date(msg.timestamp).getTime()}`;
      seen.set(key, msg);
    });

    // Add incoming messages if not duplicate
    incoming.forEach(msg => {
      if (!msg) return;
      const key = msg.id || `${msg.role}:${msg.content}:${new Date(msg.timestamp).getTime()}`;
      if (!seen.has(key)) {
        seen.set(key, msg);
      }
    });

    // Return as array in order
    return Array.from(seen.values());
  }

  /**
   * Clear cache for user
   */
  async invalidateCache(userId) {
    try {
      if (this.redisAvailable && this.redis) {
        const cacheKey = `chat:${userId}`;
        await this.redis.del(cacheKey);
        console.log(`🗑️ Cache cleared for ${userId}`);
      }
    } catch (error) {
      console.warn('invalidateCache warning (non-critical):', error.message);
    }
  }
}

module.exports = new ChatHistoryService();
