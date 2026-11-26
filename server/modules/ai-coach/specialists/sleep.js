const { avg, daysBetween, whenLabel, result, noData } = require('./common');

const hm = (hours) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${String(m).padStart(2, '0')}m`;
};

// Last night vs the user's own recent nights: duration, score, stages, efficiency.
async function sleepSpecialist({ userId, now = new Date(), deps = {} }) {
    const getSleepAnalytics = deps.getSleepAnalytics || require('../../../services/sleepAnalyticsService').getSleepAnalytics;
    const data = await getSleepAnalytics(userId, 'daily');
    const nights = (data?.entries || []).filter((e) => typeof e.totalHours === 'number' && e.totalHours > 0);
    if (!nights.length) {
        return noData('sleep', ['sleep_sessions'], 'No sleep logged in the last 30 days.');
    }

    const last = nights[nights.length - 1];
    const findings = [];
    findings.push(`Most recent sleep (night ending ${whenLabel(last.date, now)}): ${hm(last.totalHours)}`
        + `${typeof last.sleepScore === 'number' ? `, sleep score ${Math.round(last.sleepScore)}/100 (${last.scoreType === 'device' ? 'from device' : 'estimated'})` : ''}.`);

    const prior = nights.filter((e) => e !== last && daysBetween(last.date, e.date) <= 7);
    const avg7 = avg(prior.map((e) => e.totalHours));
    if (avg7 !== null) {
        const diffMin = Math.round((last.totalHours - avg7) * 60);
        findings.push(`Previous 7 nights average ${hm(avg7)} (last night ${diffMin >= 0 ? `${diffMin} min more` : `${-diffMin} min less`}).`);
    }
    const avg30 = avg(nights.map((e) => e.totalHours));
    if (nights.length >= 10) findings.push(`30-night average ${hm(avg30)} over ${nights.length} logged nights.`);

    if (last.stages) {
        findings.push(`Stages: deep ${last.stages.deepPct}%, REM ${last.stages.remPct}%, light ${last.stages.lightPct}%.`);
    }
    if (typeof last.efficiency === 'number') findings.push(`Sleep efficiency ${last.efficiency}%.`);

    const stale = daysBetween(now, last.date) > 1;
    return result('sleep', {
        findings,
        data_used: ['sleep_last_night', ...(prior.length ? ['sleep_7d'] : []), ...(last.stages ? ['sleep_stages'] : [])],
        missing_data: [...(stale ? ['sleep_last_night'] : []), ...(last.stages ? [] : ['sleep_stages'])],
        confidence: stale ? 'low' : last.source === 'wearable' ? 'high' : 'moderate',
    });
}

module.exports = { sleepSpecialist, hm };
