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

module.exports = { dayStr, daysBetween, avg, whenLabel, result, noData };
