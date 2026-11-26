const { result, noData, isBrokenNight } = require('./common');

// "Am I improving?" / "Am I hitting my goals?": the last 4 weeks, week by
// week, against the app's own targets (context/targets.js):
//   steps   avg/day + days the step goal was met       (activity analytics: device rows merged per day)
//   sleep   avg/night + nights at or above the goal     (sleep analytics: one night per date)
//   food    avg kcal on logged days + days within ±10% of the calorie target
//   workout cardio / strength minutes vs the weekly target
// Weeks are rolling 7-day blocks of COMPLETE days ending yesterday: today is
// still in progress (staging 24 Nov: today's 1200 steps pulled "this week"
// down 25%). Sleep dated today is last night, already complete, so sleep
// weeks end today. Today's numbers so far are reported on their own.

const WEEKS = 4;
const DAY = 86400000;

const utcDay = (d) => Math.floor(new Date(d).getTime() / DAY);

// Calendar days (UTC) back from today: today = 0, yesterday = 1.
// Week 0 = days 1-7 (or 0-6 with includeToday). -1 = outside / today.
function weekIndex(date, now, { includeToday = false } = {}) {
    const days = utcDay(now) - utcDay(date) - (includeToday ? 0 : 1);
    return days < 0 ? -1 : Math.floor(days / 7);
}

const round = (n, d = 0) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

function trendWord(values, higherIsBetter = true) {
    // values[0] = this week, values[1] = last week
    const [now, prev] = values;
    if (now == null || prev == null || prev === 0) return null;
    const change = (now - prev) / prev;
    if (Math.abs(change) < 0.05) return 'about the same as last week';
    const up = change > 0;
    return `${up ? 'up' : 'down'} ${Math.abs(Math.round(change * 100))}% vs last week${higherIsBetter ? (up ? ' (better)' : ' (worse)') : ''}`;
}

async function progressSpecialist({ userId, now = new Date(), deps = {} }) {
    const startDate = new Date(now.getTime() - WEEKS * 7 * DAY).toISOString().slice(0, 10);
    const todayKey = now.toISOString().slice(0, 10);
    const endDate = now.toISOString().slice(0, 10);
    const getActivityAnalytics = deps.getActivityAnalytics || require('../../../services/activityAnalyticsService').getActivityAnalytics;
    const getSleepAnalytics = deps.getSleepAnalytics || require('../../../services/sleepAnalyticsService').getSleepAnalytics;
    const loadNutritionDays = deps.loadNutritionDays || defaultNutritionDays;
    const loadWorkouts = deps.loadWorkouts || defaultWorkouts;
    const getTargets = deps.getTargets || require('../context/targets').getTargets;

    const [activity, sleep, food, workouts, targetsCtx] = await Promise.all([
        getActivityAnalytics(userId, 'daily', { startDate, endDate }),
        getSleepAnalytics(userId, 'daily', { startDate, endDate }),
        loadNutritionDays(userId, startDate, endDate),
        loadWorkouts(userId, new Date(`${startDate}T00:00:00Z`)),
        getTargets(userId, { now }),
    ]);
    const t = targetsCtx?.targets || {};
    const weeks = Array.from({ length: WEEKS }, () => ({ steps: [], stepGoalDays: 0, sleep: [], sleepGoalNights: 0, kcal: [], kcalOnTarget: 0, cardio: 0, strength: 0 }));
    let brokenNights = 0;
    const today = { steps: null, kcal: null, cardio: 0, strength: 0 };
    const isToday = (date) => new Date(date).toISOString().slice(0, 10) === todayKey;

    for (const d of activity?.days || []) {
        const w = weekIndex(`${d.date}T12:00:00Z`, now);
        const steps = d.device?.steps;
        if (d.date === todayKey && steps > 0) today.steps = steps;
        if (w < 0 || w >= WEEKS || !(steps > 0)) continue;
        weeks[w].steps.push(steps);
        if (t.steps && steps >= t.steps) weeks[w].stepGoalDays++;
    }
    for (const n of sleep?.entries || []) {
        const w = weekIndex(`${n.date}T12:00:00Z`, now, { includeToday: true });
        if (w < 0 || w >= WEEKS || !(n.totalHours > 0)) continue;
        if (isBrokenNight(n)) { brokenNights++; continue; }
        weeks[w].sleep.push(n.totalHours);
        if (t.sleepHours && n.totalHours >= t.sleepHours) weeks[w].sleepGoalNights++;
    }
    for (const f of food || []) {
        const w = weekIndex(f.date, now);
        if (isToday(f.date) && f.calories > 0) today.kcal = f.calories;
        if (w < 0 || w >= WEEKS || !(f.calories > 0)) continue;
        weeks[w].kcal.push(f.calories);
        if (t.calories && Math.abs(f.calories - t.calories) <= t.calories * 0.1) weeks[w].kcalOnTarget++;
    }
    for (const x of workouts || []) {
        const w = weekIndex(x.timestamp, now);
        if (isToday(x.timestamp)) {
            if (x.category === 'cardio') today.cardio += x.duration || 0;
            if (x.category === 'strength') today.strength += x.duration || 0;
        }
        if (w < 0 || w >= WEEKS) continue;
        if (x.category === 'cardio') weeks[w].cardio += x.duration || 0;
        if (x.category === 'strength') weeks[w].strength += x.duration || 0;
    }

    const anyData = weeks.some((w) => w.steps.length || w.sleep.length || w.kcal.length || w.cardio || w.strength);
    if (!anyData) return noData('progress', ['activity', 'sleep', 'food_logs', 'workouts'], 'No activity, sleep, food or workout data in the last 4 weeks.');

    const label = (i) => (i === 0 ? 'this week' : i === 1 ? 'last week' : `${i} weeks ago`);
    const findings = ['Weeks below are the last 7 complete days (today not included; sleep includes last night), compared with the 7 days before, and so on.'];
    const stepAvgs = weeks.map((w) => round(mean(w.steps)));
    if (stepAvgs.some((v) => v != null)) {
        findings.push(`Steps (goal ${t.steps || '?'}/day): ${weeks.map((w, i) => (w.steps.length ? `${label(i)} avg ${stepAvgs[i]}, goal met ${w.stepGoalDays}/${w.steps.length} days` : `${label(i)} no data`)).join('; ')}.`
            + `${trendWord(stepAvgs) ? ` Steps ${trendWord(stepAvgs)}.` : ''}`);
    }
    const sleepAvgs = weeks.map((w) => round(mean(w.sleep), 1));
    if (sleepAvgs.some((v) => v != null)) {
        findings.push(`Sleep (goal ${t.sleepHours || '?'} h): ${weeks.map((w, i) => (w.sleep.length ? `${label(i)} avg ${sleepAvgs[i]} h, goal met ${w.sleepGoalNights}/${w.sleep.length} nights` : `${label(i)} no data`)).join('; ')}.`
            + `${trendWord(sleepAvgs) ? ` Sleep ${trendWord(sleepAvgs)}.` : ''}`
            + `${brokenNights ? ` ${brokenNights} night(s) with a broken device reading (14 h or more) left out.` : ''}`);
    }
    const kcalAvgs = weeks.map((w) => round(mean(w.kcal)));
    if (kcalAvgs.some((v) => v != null)) {
        findings.push(`Calories (target ${t.calories || '?'} kcal): ${weeks.map((w, i) => (w.kcal.length ? `${label(i)} avg ${kcalAvgs[i]} on ${w.kcal.length} logged days, within ±10% on ${w.kcalOnTarget}` : `${label(i)} nothing logged`)).join('; ')}.`);
    }
    if (weeks.some((w) => w.cardio || w.strength)) {
        findings.push(`Workouts (weekly target ${t.cardioMinPerWeek ?? '?'} min cardio + ${t.strengthMinPerWeek ?? '?'} min strength): ${weeks.map((w, i) => `${label(i)} ${Math.round(w.cardio)} cardio + ${Math.round(w.strength)} strength`).join('; ')}.`);
    }

    const todayParts = [
        today.steps != null && `${today.steps} steps`,
        today.kcal != null && `${Math.round(today.kcal)} kcal logged`,
        (today.cardio || today.strength) && `workouts ${Math.round(today.cardio)} min cardio + ${Math.round(today.strength)} min strength`,
    ].filter(Boolean);
    if (todayParts.length) findings.push(`Today so far (day not over, not in the weekly numbers): ${todayParts.join(', ')}.`);

    // Same numbers as structured data, for code that writes user-facing text
    // itself (the chat opener) instead of passing findings to the model.
    const week = (i) => ({
        stepsAvg: stepAvgs[i], stepDays: weeks[i].steps.length, stepGoalDays: weeks[i].stepGoalDays,
        sleepAvg: sleepAvgs[i], sleepNights: weeks[i].sleep.length, sleepGoalNights: weeks[i].sleepGoalNights,
        kcalAvg: kcalAvgs[i], kcalDays: weeks[i].kcal.length, kcalOnTarget: weeks[i].kcalOnTarget,
        cardioMin: Math.round(weeks[i].cardio), strengthMin: Math.round(weeks[i].strength),
    });
    return result('progress', {
        findings,
        data_used: ['weekly_steps', 'weekly_sleep', 'weekly_calories', 'weekly_workouts'],
        missing_data: weeks[0].kcal.length ? [] : ['food_logs_this_week'],
        confidence: 'high',
        summary: {
            targets: { steps: t.steps || null, sleepHours: t.sleepHours || null, calories: t.calories || null },
            thisWeek: week(0),
            lastWeek: week(1),
            today: { steps: today.steps, kcal: today.kcal },
        },
    });
}

async function defaultNutritionDays(userId, startDate, endDate) {
    const NutritionSummary = require('../../../models/NutritionSummary');
    const rows = await NutritionSummary.find({
        userId,
        date: { $gte: new Date(`${startDate}T00:00:00Z`), $lte: new Date(`${endDate}T23:59:59Z`) },
        totalCalories: { $gt: 0 },
    }).select('date totalCalories').lean();
    return rows.map((r) => ({ date: r.date, calories: r.totalCalories }));
}

async function defaultWorkouts(userId, since) {
    const ExerciseLog = require('../../../models/ExerciseLog');
    return ExerciseLog.find({ userId, timestamp: { $gte: since } }).select('category duration timestamp').lean();
}

module.exports = { progressSpecialist, weekIndex, trendWord };
