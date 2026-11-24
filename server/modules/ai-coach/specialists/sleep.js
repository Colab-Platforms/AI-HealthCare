const { avg, isBrokenNight, daysBetween, whenLabel, result, noData, cachedLongRange, monthLabel } = require('./common');
const { windowFor, LONG_RANGE_DAYS } = require('../context/lookback');

const hm = (hours) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${String(m).padStart(2, '0')}m`;
};

// Last night vs the user's own recent nights: duration, score, stages, efficiency.
async function sleepSpecialist({ userId, now = new Date(), deps = {}, lookbackDays = 0 }) {
    const getSleepAnalytics = deps.getSleepAnalytics || require('../../../services/sleepAnalyticsService').getSleepAnalytics;
    const long = lookbackDays > LONG_RANGE_DAYS;
    const win = long ? windowFor(lookbackDays, now) : null;
    // Recent nights and (if asked) monthly trend, in parallel.
    const [data, monthly] = await Promise.all([
        getSleepAnalytics(userId, 'daily'),
        long ? cachedLongRange(deps, `sleep:${userId}:${win.startDate}:${win.endDate}`,
            () => getSleepAnalytics(userId, 'monthly', win)) : null,
    ]);
    const trend = (monthly?.summary || []).filter((m) => m.avgHours);
    const trendLine = trend.length
        ? `Monthly sleep averages (${win.startDate} to ${win.endDate}): ${trend.map((m) => `${monthLabel(m.period)} ${hm(m.avgHours)}${m.avgScore ? ` score ${Math.round(m.avgScore)}` : ''} (${m.daysLogged} nights)`).join('; ')}.`
        : null;

    const logged = (data?.entries || []).filter((e) => typeof e.totalHours === 'number' && e.totalHours > 0);
    const nights = logged.filter((e) => !isBrokenNight(e));
    const broken = logged.length - nights.length;
    const brokenLine = broken ? `${broken} night(s) had a broken device reading (14 h or more) and are left out.` : null;
    if (!nights.length) {
        if (trendLine) return result('sleep', { findings: ['No sleep logged in the last 30 days.', ...(brokenLine ? [brokenLine] : []), trendLine], data_used: ['sleep_monthly'], missing_data: ['sleep_recent'], confidence: 'low' });
        return noData('sleep', ['sleep_sessions'], long ? `No sleep logged since ${win.startDate}.` : 'No sleep logged in the last 30 days.');
    }

    const last = nights[nights.length - 1];
    const findings = [];
    if (trendLine) findings.push(trendLine);
    else if (long) findings.push(`No sleep data before the last 30 days in the asked period (since ${win.startDate}).`);
    // Sleep rows are dated by the morning they end: "today" = LAST night.
    const ago = daysBetween(now, last.date);
    const nightLabel = ago === 0 ? 'last night (woke up today)' : ago === 1 ? 'the night before last' : `the night ending ${whenLabel(last.date, now)}`;
    findings.push(`Most recent sleep, ${nightLabel}: ${hm(last.totalHours)}`
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
    if (brokenLine) findings.push(brokenLine);

    const stale = daysBetween(now, last.date) > 1;
    return result('sleep', {
        findings,
        data_used: ['sleep_last_night', ...(prior.length ? ['sleep_7d'] : []), ...(last.stages ? ['sleep_stages'] : []), ...(trend.length ? ['sleep_monthly'] : [])],
        missing_data: [...(stale ? ['sleep_last_night'] : []), ...(last.stages ? [] : ['sleep_stages'])],
        confidence: stale ? 'low' : last.source === 'wearable' ? 'high' : 'moderate',
    });
}

module.exports = { sleepSpecialist, hm };
