const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit

// Brute-force protection for login/signup/OTP/password-reset endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again in a few minutes.' },
});

// Looser limit for expensive AI-backed endpoints (protects Anthropic credit usage from abuse)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many AI requests. Please slow down and try again shortly.' },
});

// General API limiter for authenticated GET endpoints — prevents scraping/abuse
// 200 requests per minute per user is generous for normal use but blocks bots
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
const heavyReadLimiter = rateLimit({
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => req.user?._id?.toString() || ipKeyGenerator(req.ip),
  message: { success: false, message: 'Too many attempts. Please try again in a few minutes.' },
});

module.exports = { authLimiter, aiLimiter, apiLimiter, heavyReadLimiter, sensitiveActionLimiter };
