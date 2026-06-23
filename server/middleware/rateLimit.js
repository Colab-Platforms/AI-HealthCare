const rateLimit = require('express-rate-limit');

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
  keyGenerator: (req) => req.user?._id?.toString() || req.ip, // per-user, not per-IP
  message: { success: false, message: 'Too many requests. Please slow down.' },
  skip: (req) => req.method !== 'GET', // only apply to GET requests
});

// Stricter limiter for expensive DB-read endpoints (dashboard, reports listing)
const heavyReadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

module.exports = { authLimiter, aiLimiter, apiLimiter, heavyReadLimiter };
