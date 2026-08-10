/**
 * Environment detection.
 *
 * Several behaviours (index building, DNS overrides, verbose per-request
 * logging) must be off in a deployed environment. Keying those purely off
 * NODE_ENV is fragile: if the platform's env var is ever missing, the app
 * silently falls back to development behaviour in production — which is exactly
 * the failure mode that left autoIndex enabled on Render. So also treat any
 * recognised hosting platform as production.
 */
const isHosted = !!(
  process.env.RENDER ||
  process.env.VERCEL ||
  process.env.RAILWAY_ENVIRONMENT_ID ||
  process.env.FLY_APP_NAME ||
  process.env.DYNO // Heroku
);

const isProduction = process.env.NODE_ENV === 'production' || isHosted;
const isServerless = !!process.env.VERCEL;

module.exports = { isProduction, isHosted, isServerless };
