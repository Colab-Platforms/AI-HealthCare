// Shared helper for recoveryScoreService's baseline math: pull N days of a
// metric, merge same-day multi-device readings, and compute mean/SD. Kept
// separate from recoveryScoreService so each metric engine (HRV, RHR, ...)
// calls the same tested primitive instead of re-deriving mean/SD inline.

function dateOnlyUTC(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

function dateKeyUTC(d) {
  return new Date(d).toISOString().split('T')[0];
}

// A user can have more than one HeartRateDailySummary/StressDailySummary doc
// for the same date (one per deviceType — see those models' unique index).
// Same-day multi-device readings are averaged, not summed — these are point
// measurements (bpm, ms), not accumulating counts like steps/calories.
function mergeSameDayByAverage(docs, valuePath) {
  const byDate = new Map();
  for (const doc of docs) {
    const value = valuePath(doc);
    if (!Number.isFinite(value)) continue;
    const key = dateKeyUTC(doc.date);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(value);
  }
  const merged = new Map();
  for (const [key, values] of byDate) {
    merged.set(key, values.reduce((a, b) => a + b, 0) / values.length);
  }
  return merged;
}

/** Sample mean + sample standard deviation (n-1 denominator) over a plain number array. */
function computeStats(values) {
  const n = values.length;
  if (n === 0) return { mean: null, sd: null, n: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  if (n === 1) return { mean, sd: null, n };
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1);
  return { mean, sd: Math.sqrt(variance), n };
}

/**
 * Fetches `windowDays` of a metric ending the day before `dateStr` (baselines
 * must never include today's own value — that would compare today against
 * itself), merges multi-device same-day readings, and returns both the
 * mean/SD and the raw per-date values map for reuse (e.g. today's value if
 * the caller also wants it from the same collection).
 */
async function getWindowStats(Model, userId, valuePath, dateStr, windowDays) {
  const endExclusive = dateOnlyUTC(dateStr); // today excluded
  const start = new Date(endExclusive);
  start.setUTCDate(start.getUTCDate() - windowDays);

  // No field-list .select() here on purpose — this helper now backs HRV
  // (avgHrvMs), RHR (restingBpm), and RR (avgRespiratoryRate) engines, each
  // reading a different summary collection's own field via valuePath; these
  // are small per-day rollup docs, so fetching whole documents costs nothing
  // meaningful and avoids a select-list that silently excludes a new metric.
  const docs = await Model.find({
    user: userId,
    date: { $gte: start, $lt: endExclusive }
  }).lean();

  const byDate = mergeSameDayByAverage(docs, valuePath);
  const stats = computeStats([...byDate.values()]);
  return { ...stats, byDate };
}

module.exports = { computeStats, getWindowStats, dateOnlyUTC, dateKeyUTC, mergeSameDayByAverage };
