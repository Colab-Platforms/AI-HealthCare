const HealthScoreConfig = require('../models/HealthScoreConfig');

// The active scoring config was being read from Mongo twice on every score
// request — once by the daily engine and once by the long-term one — for a
// document that only changes when a new version is deliberately activated.
// That is hours or days apart, not milliseconds, so it is held in memory here.
//
// The TTL is short enough that activating a new version takes effect on its own
// without a deploy or restart, and `invalidateScoreConfig()` makes it immediate
// for code that activates a version itself.
const TTL_MS = 60 * 1000;

let cached = null;
let cachedAt = 0;
let inFlight = null;

async function getActiveScoreConfig() {
  const fresh = cached && Date.now() - cachedAt < TTL_MS;
  if (fresh) return cached;

  // Share one query between concurrent callers rather than letting every
  // request that arrives during a cache miss issue its own.
  if (!inFlight) {
    inFlight = HealthScoreConfig.findOne({ isActive: true }).lean()
      .then((doc) => {
        if (doc) {
          cached = doc;
          cachedAt = Date.now();
        }
        return doc;
      })
      .finally(() => { inFlight = null; });
  }

  return inFlight;
}

function invalidateScoreConfig() {
  cached = null;
  cachedAt = 0;
}

module.exports = { getActiveScoreConfig, invalidateScoreConfig };
