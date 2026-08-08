const cache = require('./cache');

/**
 * Per-user cache key namespace, in one place.
 *
 * Invalidation used to be hand-written lists of literal keys at each call site,
 * e.g. deleteReport cleared `trends:<id>:all`, `trends:<id>:Blood Test` and
 * `trends:<id>:undefined` — a guess at which report types had been cached. Any
 * other type stayed stale, and every new cached key had to be remembered at
 * every site that invalidates. Adding a key here updates all of them.
 */
const userKeys = (userId) => {
  const id = String(userId);
  return {
    dashboard: `dashboard:${id}`,
    reports: `reports:${id}`,
    chat: `chat:${id}`,
    dietPlan: `diet_plan:${id}`,
    healthGoal: `health_goal:${id}`,
    healthDna: `health_dna:${id}`,
    trendsPattern: `trends:${id}:*`, // one entry per reportType — must be a pattern
  };
};

/**
 * Drop every cached entry derived from a user's health data.
 *
 * Call after anything that changes what those views would show (uploading,
 * deleting or re-analysing a report; logging food, weight or vitals).
 * Safe to await — cache operations swallow their own backend errors.
 */
async function invalidateUserHealthCache(userId) {
  const k = userKeys(userId);
  await Promise.all([
    cache.delete(k.dashboard),
    cache.delete(k.reports),
    cache.delete(k.healthDna),
    cache.delete(k.healthGoal),
    cache.delete(k.dietPlan),
    cache.deletePattern(k.trendsPattern),
  ]);
}

module.exports = { userKeys, invalidateUserHealthCache };
