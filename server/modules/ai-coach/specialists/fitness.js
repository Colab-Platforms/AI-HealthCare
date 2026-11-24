const { avg, dayStr, daysBetween, whenLabel, result, noData } = require('./common');

// Activity today vs the user's usual week, plus the last few workouts (what
// was trained and how hard): the answer to "should I train today?" depends on both.
async function fitnessSpecialist({ userId, now = new Date(), deps = {} }) {
    const getActivityAnalytics = deps.getActivityAnalytics || require('../../../services/activityAnalyticsService').getActivityAnalytics;
    const recentWorkouts = deps.recentWorkouts || defaultRecentWorkouts;

    const [activity, workouts] = await Promise.all([
        getActivityAnalytics(userId, 'daily'),
        recentWorkouts(userId, 4),
    ]);
    const days = activity?.days || [];
    const today = days.find((d) => d.date === dayStr(now));
    const findings = [];
    const dataUsed = [];
    const missing = [];

    if (today && (today.device?.steps > 0 || today.manual?.sessionsCount > 0)) {
        const stepGoal = today.goals?.steps;
        findings.push(`Today so far: ${today.device?.steps || 0} steps${stepGoal ? ` (goal ${stepGoal})` : ''}`
            + `${today.device?.activeMinutes ? `, ${today.device.activeMinutes} active minutes` : ''}`
            + `${today.manual?.sessionsCount ? `, ${today.manual.sessionsCount} workout(s) logged` : ''}.`);
        dataUsed.push('activity_today');
    } else {
        missing.push('activity_today');
    }

    const prior = days.filter((d) => d.date !== dayStr(now) && daysBetween(now, d.date) <= 7);
    const avgSteps = avg(prior.map((d) => d.device?.steps).filter((s) => s > 0));
    if (avgSteps !== null) {
        findings.push(`Average steps over the previous 7 days: ${Math.round(avgSteps)}.`);
        dataUsed.push('steps_7d');
    }
    const strength7 = today?.manual?.strengthMinutesLast7Days ?? days[days.length - 1]?.manual?.strengthMinutesLast7Days;
    if (typeof strength7 === 'number') findings.push(`Strength training in the last 7 days: ${strength7} min.`);

    if (workouts.length) {
        dataUsed.push('recent_workouts');
        const list = workouts.map((w) => `${w.activityType || w.category || 'workout'}`
            + `${w.category && w.category !== w.activityType ? ` (${w.category})` : ''}`
            + ` ${Math.round(w.duration || 0)} min${w.intensity ? `, ${w.intensity} intensity` : ''} ${whenLabel(w.timestamp, now)}`);
        findings.push(`Recent workouts: ${list.join('; ')}.`);
    } else {
        missing.push('recent_workouts');
    }

    if (!findings.length) {
        return noData('fitness', missing, 'No activity or workouts logged recently.');
    }
    return result('fitness', {
        findings,
        data_used: dataUsed,
        missing_data: missing,
        confidence: activity?.hasWearableConnected ? 'high' : 'moderate',
    });
}

async function defaultRecentWorkouts(userId, limit) {
    const ExerciseLog = require('../../../models/ExerciseLog');
    return ExerciseLog.find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .select('activityType category duration intensity timestamp')
        .lean();
}

module.exports = { fitnessSpecialist };
