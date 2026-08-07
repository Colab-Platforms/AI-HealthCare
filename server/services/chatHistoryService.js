// Uses the app's single shared Redis connection (utils/cache.js) instead of
// opening a second one — a separate `new Redis(...)` here had no TLS/retry
// tuning (unlike cache.js's Upstash-aware config) and was reconnecting
// constantly in production, flooding logs and adding load on every request.
const cache = require('../utils/cache');
const ChatHistory = require('../models/ChatHistory');
const { Client } = require('@upstash/qstash')

class ChatHistoryService {
  constructor() {
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

      // Try cache first (Redis if configured, in-memory fallback otherwise — see utils/cache.js)
      try {
        const cacheKey = `chat:${userId}`;
        const cached = await Promise.race([
          cache.get(cacheKey),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Cache timeout')), 5000))
        ]);
        if (cached) {
          console.log(`✓ Cache hit for user ${userId}`);
          return cached;
        }
      } catch (cacheErr) {
        console.warn(`Cache get failed, falling back to MongoDB:`, cacheErr.message);
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

      // Cache for 1 hour
      try {
        await cache.set(`chat:${userId}`, history, 3600);
      } catch (err) {
        console.warn('Cache set failed:', err.message);
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

      // 1. Cache immediately
      try {
        await cache.set(cacheKey, data, 3600);
        console.log(`✓ Cached for user ${userId}`);
      } catch (err) {
        console.warn('Cache set failed, continuing without cache:', err.message);
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
      cache.set(`chat:${userId}`, history, 3600)
        .catch(err => console.warn('Cache update failed (non-critical):', err.message));

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
      await cache.delete(`chat:${userId}`);
      console.log(`🗑️ Cache cleared for ${userId}`);
    } catch (error) {
      console.warn('invalidateCache warning (non-critical):', error.message);
    }
  }
}

module.exports = new ChatHistoryService();
