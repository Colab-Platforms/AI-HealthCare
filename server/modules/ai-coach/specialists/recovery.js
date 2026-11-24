const { avg, daysBetween, whenLabel, result, noData } = require('./common');

// Readiness: today's recovery score vs the user's own usual range, recent
// trend, safety warnings and personal patterns (e.g. "short nights are
// followed by low mornings").
async function recoverySpecialist({ userId, now = new Date(), deps = {} }) {
    const getRecoveryAnalytics = deps.getRecoveryAnalytics || require('../../../services/recoveryAnalyticsService').getRecoveryAnalytics;
    const data = await getRecoveryAnalytics(userId, 'daily');
    const entries = (data?.entries || []).filter((e) => typeof e.recoveryScore === 'number');
    if (!entries.length) {
        return noData('recovery', ['recovery_score'], 'No recovery score available (needs a wearable with heart rate / HRV data).');
    }

    const latest = entries[entries.length - 1];
    const findings = [];
    const band = latest.band?.label || latest.band?.key || (typeof latest.band === 'string' ? latest.band : null);
    findings.push(`Recovery score ${whenLabel(latest.date, now)}: ${Math.round(latest.recoveryScore)}/100${band ? ` (${band})` : ''}.`);

    const range = data.personalBaselineRange;
    if (range && Number.isFinite(range.low) && Number.isFinite(range.high)) {
        const where = latest.recoveryScore < range.low ? 'below' : latest.recoveryScore > range.high ? 'above' : 'within';
        findings.push(`That is ${where} the user's usual range (${range.low}-${range.high}).`);
    }

    const prior7 = entries.filter((e) => e !== latest && daysBetween(latest.date, e.date) <= 7);
    const avg7 = avg(prior7.map((e) => e.recoveryScore));
    if (avg7 !== null) findings.push(`Average of the previous 7 days: ${Math.round(avg7)}.`);

    for (const w of latest.warnings || []) {
        const msg = typeof w === 'string' ? w : w?.message;
        if (msg) findings.push(`Warning: ${msg}`);
    }
    for (const p of data.patterns || []) {
        if (p?.text) findings.push(`Pattern: ${p.text}${p.basis ? ` (${p.basis})` : ''}`);
    }

    const stale = daysBetween(now, latest.date) > 1;
    return result('recovery', {
        findings,
        data_used: ['recovery_score', ...(range ? ['personal_baseline'] : []), ...(prior7.length ? ['recovery_7d'] : [])],
        missing_data: stale ? ['recovery_score_today'] : [],
        confidence: stale ? 'low' : (latest.confidence?.level || (typeof latest.confidence === 'string' ? latest.confidence : 'moderate')),
    });
}

module.exports = { recoverySpecialist };
