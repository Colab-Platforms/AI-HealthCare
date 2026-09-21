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

// Redis-backed limiters fail open on a store error (e.g. Upstash quota
// exceeded, transient outage): express-rate-limit calls next() and lets the
// request through, unprotected, rather than 500ing every request. Brute-force
// or cost-abuse protection is degraded while Redis is unreachable, but that's
// a better trade than the endpoint being completely unusable — see login
// returning 500 on every attempt when this wasn't set.
const REDIS_STORE_OPTIONS = { passOnStoreError: true };

// Brute-force protection for login/signup/OTP/password-reset endpoints
const authLimiter = rateLimit({
  store: buildStore('auth'),
  ...REDIS_STORE_OPTIONS,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again in a few minutes.' },
});

// Looser limit for expensive AI-backed endpoints (protects Anthropic credit usage from abuse)
const aiLimiter = rateLimit({
  store: buildStore('ai'),
  ...REDIS_STORE_OPTIONS,
  windowMs: 60 * 1000, // 1 minute
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many AI requests. Please slow down and try again shortly.' },
});

// General API limiter for authenticated GET endpoints — prevents scraping/abuse
// 200 requests per minute per user is generous for normal use but blocks bots
//
// Memory-backed on purpose (not Redis): this fires on nearly every read in the
// app, so it was the single biggest source of Redis command volume and pushed
// us over Upstash's monthly quota. Anti-scraping on reads doesn't need
// cross-instance accuracy the way login brute-force or AI-cost protection do,
// so a per-process counter is an acceptable tradeoff (limit effectively
// becomes max × instance count on a multi-instance deploy).
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => req.user?._id?.toString() || ipKeyGenerator(req.ip), // per-user, not per-IP
  message: { success: false, message: 'Too many requests. Please slow down.' },
  skip: (req) => req.method !== 'GET', // only apply to GET requests
});

// Stricter limiter for expensive DB-read endpoints (dashboard, reports listing)
// Memory-backed for the same reason as apiLimiter above — see that comment.
const heavyReadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => req.user?._id?.toString() || ipKeyGenerator(req.ip),
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

// Mobile health uploads are batched, but can be retried by several background
// workers. Keep a separate authenticated limit and tell the client when to retry.
const wearableSyncLimiter = rateLimit({
  store: buildStore('wearable-sync'),
  ...REDIS_STORE_OPTIONS,
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => req.user?._id?.toString() || ipKeyGenerator(req.ip),
  handler: (req, res) => {
    res.set('Retry-After', '900');
    res.status(429).json({ message: 'Too many wearable sync requests. Retry later.' });
  }
});

// Sensitive account actions (change password, etc.) — an attacker who steals
// an access token could otherwise brute-force the current password with
// unlimited attempts. Keyed per-user (not per-IP) since the request is
// already authenticated, so switching IPs doesn't reset the counter.
const sensitiveActionLimiter = rateLimit({
  store: buildStore('sensitive'),
  ...REDIS_STORE_OPTIONS,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => req.user?._id?.toString() || ipKeyGenerator(req.ip),
  message: { success: false, message: 'Too many attempts. Please try again in a few minutes.' },
});

module.exports = { authLimiter, aiLimiter, apiLimiter, heavyReadLimiter, wearableSyncLimiter, sensitiveActionLimiter };
