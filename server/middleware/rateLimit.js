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

module.exports = { authLimiter, aiLimiter };
