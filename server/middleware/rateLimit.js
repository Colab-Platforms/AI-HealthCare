const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getLimiterClient } = require('../utils/redisClient');

const { ipKeyGenerator } = rateLimit;

/**
 * Build a store for a limiter.
 *
 * The default MemoryStore keeps counters per process, so with more than one
 * instance each replica enforces its own separate quota (an N-instance deploy
 * effectively multiplies every limit by N), and every deploy resets all
 * counters. Backing them with Redis makes the limits global and durable.
 *
 * Falls back to MemoryStore when Redis isn't configured, so local development
 * and a Redis outage both keep working — degraded to per-process limits rather
 * than no limits at all.
 */
function buildStore(prefix) {
  if (!process.env.REDIS_URL) return undefined; // express-rate-limit uses MemoryStore

  const client = getLimiterClient();
  if (!client) return undefined;

  return new RedisStore({
    prefix: `rl:${prefix}:`,
    // Use the raw client, not the health-gated one: RedisStore issues a
    // SCRIPT LOAD as soon as it is constructed (at import time), so rejecting
    // while the connection is still coming up would crash the process on boot.
    // ioredis queues the command and replays it once connected.
    sendCommand: (...args) => client.call(...args),
  });
}

// Brute-force protection for login/signup/OTP/password-reset endpoints
const authLimiter = rateLimit({
  store: buildStore('auth'),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again in a few minutes.' },
});

// Looser limit for expensive AI-backed endpoints (protects Anthropic credit usage from abuse)
const aiLimiter = rateLimit({
  store: buildStore('ai'),
  windowMs: 60 * 1000, // 1 minute
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many AI requests. Please slow down and try again shortly.' },
});

// General API limiter for authenticated GET endpoints — prevents scraping/abuse
// 200 requests per minute per user is generous for normal use but blocks bots
const apiLimiter = rateLimit({
  store: buildStore('api'),
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => req.user?._id?.toString() || ipKeyGenerator(req.ip), // per-user, not per-IP
  message: { success: false, message: 'Too many requests. Please slow down.' },
  skip: (req) => req.method !== 'GET', // only apply to GET requests
});

// Stricter limiter for expensive DB-read endpoints (dashboard, reports listing)
const heavyReadLimiter = rateLimit({
  store: buildStore('heavy'),
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => req.user?._id?.toString() || ipKeyGenerator(req.ip),
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

// Sensitive account actions (change password, etc.) — an attacker who steals
// an access token could otherwise brute-force the current password with
// unlimited attempts. Keyed per-user (not per-IP) since the request is
// already authenticated, so switching IPs doesn't reset the counter.
const sensitiveActionLimiter = rateLimit({
  store: buildStore('sensitive'),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => req.user?._id?.toString() || ipKeyGenerator(req.ip),
  message: { success: false, message: 'Too many attempts. Please try again in a few minutes.' },
});

module.exports = { authLimiter, aiLimiter, apiLimiter, heavyReadLimiter, sensitiveActionLimiter };
