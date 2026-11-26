// Shared helpers for specialists. A specialist is plain code: it reads the
// user's data through the existing analytics services and returns facts in a
// fixed shape. It never calls an LLM and never invents a number: missing data
// is reported as missing.
//
// Result contract:
//   { specialist, status: 'completed' | 'no_data' | 'error' | 'timeout',
//     findings: [string], data_used: [string], missing_data: [string],
//     confidence: 'high' | 'moderate' | 'low' }

const dayStr = (d) => new Date(d).toISOString().split('T')[0];

const daysBetween = (a, b) => Math.round((new Date(dayStr(a)) - new Date(dayStr(b))) / 86400000);

function avg(nums) {
    const v = nums.filter((n) => typeof n === 'number' && Number.isFinite(n));
    return v.length ? Math.round((v.reduce((s, n) => s + n, 0) / v.length) * 10) / 10 : null;
}

// "today", "yesterday" or the date, relative to `now`.
function whenLabel(date, now) {
    const diff = daysBetween(now, date);
    if (diff === 0) return 'today';
    if (diff === 1) return 'yesterday';
    return `on ${dayStr(date)} (${diff} days ago)`;
}

const result = (specialist, over) => ({
    specialist, status: 'completed', findings: [], data_used: [], missing_data: [], confidence: 'moderate', ...over,
});

const noData = (specialist, missing, note) => result(specialist, {
    status: 'no_data', findings: note ? [note] : [], missing_data: missing, confidence: 'low',
});

// Long-range trends (months back) change slowly: cached per user + window for
// 6 h so a follow-up question doesn't re-read months of rows.
const LONG_RANGE_TTL_SECONDS = 6 * 60 * 60;

// The app caps an impossible sleep reading at its ceiling (14 h) instead of
// dropping it (utils/wearableMerge.js filterPlausibleSleep). For the coach
// that night is unknown, not 14 h (staging 24 Nov: a 20.5 h Apple Watch row
// showed up as "avg 14 h").
const { MAX_PLAUSIBLE_SLEEP_MINUTES } = require('../../../utils/wearableMerge');
const isBrokenNight = (e) => typeof e?.totalHours === 'number' && e.totalHours * 60 >= MAX_PLAUSIBLE_SLEEP_MINUTES;

async function cachedLongRange(deps, key, fn) {
    const cache = deps.cache || require('../../../utils/cache');
    return cache.getOrSet(`coach:lr:${key}`, async () => ({ value: await fn() }), LONG_RANGE_TTL_SECONDS)
        .then((wrapped) => wrapped?.value);
}

const monthLabel = (period) => {
    const [y, m] = String(period).split('-').map(Number);
    if (!y || !m) return String(period);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
};

module.exports = { isBrokenNight, dayStr, daysBetween, avg, whenLabel, result, noData, cachedLongRange, monthLabel, LONG_RANGE_TTL_SECONDS };
