const Redis = require('ioredis');

/**
 * Shared ioredis connections.
 *
 * Previously utils/cache.js owned its own client and, on the first 'error'
 * event, set its reference to null — permanently. ioredis emits 'error' for any
 * transient blip and reconnects on its own, so one momentary error silently
 * downgraded the process to in-memory caching for the rest of its life. Here the
 * client is kept and a health flag tracks reachability, so caching resumes by
 * itself once Redis is back.
 *
 * Two connections, because the two consumers need opposite failure behaviour:
 *
 *  - cache    : fail fast. A cache read that hangs is worse than a cache miss,
 *               so commands give up quickly and callers fall back to memory.
 *  - limiter  : never give up on a queued command. rate-limit-redis issues a
 *               SCRIPT LOAD the moment its store is constructed (at import
 *               time, before Redis has connected). With bounded retries that
 *               command rejects, and an unhandled rejection takes the process
 *               down on boot. maxRetriesPerRequest:null makes ioredis hold
 *               queued commands until the connection is up instead.
 */

const URL = process.env.REDIS_URL;
const isUpstash = !!URL && URL.includes('upstash.io');
const tls = isUpstash ? { rejectUnauthorized: false } : undefined;

let cacheClient = null;
let limiterClient = null;
let healthy = false;

function attachLogging(client, label, trackHealth) {
  client.on('ready', () => {
    if (trackHealth) healthy = true;
    console.log(`✅ [Redis:${label}] Connected`);
  });
  client.on('end', () => { if (trackHealth) healthy = false; });
  client.on('close', () => { if (trackHealth) healthy = false; });
  client.on('error', (err) => {
    // Log on transition only — this fires repeatedly while the server is down.
    if (!trackHealth || healthy) console.error(`❌ [Redis:${label}]`, err.message);
    if (trackHealth) healthy = false;
  });
  // ioredis surfaces command failures as rejections on the command promise;
  // this listener stops a stray one from becoming an unhandledRejection.
  client.on('nodeError', () => {});
}

if (URL) {
  cacheClient = new Redis(URL, {
    maxRetriesPerRequest: 2,
    connectTimeout: 5000,
    enableOfflineQueue: false, // fail fast; callers fall back to memory
    tls,
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });
  attachLogging(cacheClient, 'cache', true);

  limiterClient = new Redis(URL, {
    maxRetriesPerRequest: null, // hold queued commands until connected
    connectTimeout: 5000,
    enableOfflineQueue: true,
    tls,
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });
  attachLogging(limiterClient, 'limiter', false);
} else {
  console.log('ℹ️ [Redis] No REDIS_URL — using in-memory cache and per-process rate limits');
}

/** Cache client, or null when unconfigured or currently unreachable. */
function getClient() {
  return healthy ? cacheClient : null;
}

/** Rate-limiter client, or null when unconfigured. Not health-gated by design. */
function getLimiterClient() {
  return limiterClient;
}

function isConfigured() {
  return cacheClient !== null;
}

module.exports = { getClient, getLimiterClient, isConfigured };
