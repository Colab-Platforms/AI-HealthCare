/**
 * READ-ONLY look at what the coach reads for one staging user: recovery rows
 * (with who/when wrote them), sleep, activity, workouts, food today, targets,
 * HealthProfile and coach memory. Answers "where did this number come from?"
 * without guessing. Writes nothing. Run from server/:
 *
 *   node scripts/inspectCoachTestUser.js
 *   node scripts/inspectCoachTestUser.js --email=<address>     default coach-test@example.invalid
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

if (process.env.USE_STAGING_DB !== 'true' || !process.env.MONGODB_URI_STAGING) {
    console.error('Refusing to run: needs USE_STAGING_DB=true and MONGODB_URI_STAGING (staging only).');
    process.exit(1);
}

const mongoose = require('mongoose');

const EMAIL = (process.argv.find((a) => a.startsWith('--email=')) || '--email=coach-test@example.invalid').slice(8).trim().toLowerCase();
const d = (v) => (v ? new Date(v).toISOString().replace('T', ' ').slice(0, 16) : '-');

async function main() {
    const connectDB = require('../config/db');
    await connectDB();
    if (!/staging$/i.test(mongoose.connection.name)) {
        console.error(`Refusing: "${mongoose.connection.name}" is not a staging database.`);
        process.exit(1);
    }
    const User = require('../models/User');
    const RecoveryDailySummary = require('../models/RecoveryDailySummary');
    const SleepSession = require('../models/SleepSession');
    const DailyActivityMetric = require('../models/DailyActivityMetric');
    const ExerciseLog = require('../models/ExerciseLog');
    const HealthProfile = require('../modules/health-profile/models/HealthProfile');
    const CoachState = require('../modules/ai-coach/models/CoachState');
    const { getTargets, formatTargets } = require('../modules/ai-coach/context/targets');

    const user = await User.findOne({ email: EMAIL }).select('_id name createdAt profile subscription').lean();
    if (!user) {
        console.error(`No user ${EMAIL}.`);
        process.exit(1);
    }
    const uid = user._id;
    console.log(`\nUser ${EMAIL} (${uid}), created ${d(user.createdAt)} UTC, plan ${user.subscription?.plan}/${user.subscription?.status}`);
    console.log(`Now (UTC): ${d(new Date())}\n`);

    const [recovery, sleep, activity, workouts, hp, coach, targets] = await Promise.all([
        RecoveryDailySummary.find({ user: uid }).sort({ date: -1 }).limit(16)
            .select('date recoveryScore band scoreSource deviceType createdAt updatedAt metricDetails.hrv.available metricDetails.rhr.available').lean(),
        SleepSession.find({ user: uid }).sort({ date: -1 }).limit(5).select('date totalSleepMinutes deviceType createdAt').lean(),
        DailyActivityMetric.find({ user: uid }).sort({ date: -1 }).limit(5).select('date steps activeMinutes deviceType').lean(),
        ExerciseLog.find({ userId: uid }).sort({ timestamp: -1 }).limit(5).select('activityType category duration intensity timestamp notes').lean(),
        HealthProfile.findOne({ user: uid }).lean(),
        CoachState.findOne({ user: uid }).lean(),
        getTargets(uid),
    ]);

    console.log('RecoveryDailySummary (newest first): date | score | band | source | device | created | updated | hrv/rhr data');
    for (const r of recovery) {
        const rewritten = r.updatedAt && r.createdAt && new Date(r.updatedAt) - new Date(r.createdAt) > 1000 ? '  <- rewritten after insert' : '';
        console.log(`  ${r.date} | ${r.recoveryScore ?? 'null'} | ${r.band?.key || '-'} | ${r.scoreSource || '-'} | ${r.deviceType || '-'} | ${d(r.createdAt)} | ${d(r.updatedAt)} | ${r.metricDetails?.hrv?.available ?? '-'}/${r.metricDetails?.rhr?.available ?? '-'}${rewritten}`);
    }
    console.log('\nSleepSession (newest 5): date | minutes | device | created');
    for (const s of sleep) console.log(`  ${d(s.date).slice(0, 10)} | ${s.totalSleepMinutes} | ${s.deviceType} | ${d(s.createdAt)}`);
    // Progress showed "2 weeks ago avg 14 h": list odd nights (over 12 h, under
    // 1 h, or several sessions on one date) in the last 35 days.
    const since = new Date(Date.now() - 35 * 86400000);
    const recentSleep = await SleepSession.find({ user: uid, date: { $gte: since } }).sort({ date: 1 })
        .select('date totalSleepMinutes deviceType bedTime wakeTime createdAt').lean();
    const byDate = new Map();
    for (const s of recentSleep) {
        const k = d(s.date).slice(0, 10);
        byDate.set(k, [...(byDate.get(k) || []), s]);
    }
    const odd = [...byDate].filter(([, rows]) => rows.length > 1 || rows.some((r) => r.totalSleepMinutes > 720 || r.totalSleepMinutes < 60));
    console.log(`\nSleepSession odd nights, last 35 days (${recentSleep.length} rows): ${odd.length ? '' : 'none'}`);
    for (const [k, rows] of odd) {
        console.log(`  ${k}: ${rows.map((r) => `${r.totalSleepMinutes} min (${r.deviceType}, bed ${r.bedTime ? d(r.bedTime) : '-'}, wake ${r.wakeTime ? d(r.wakeTime) : '-'}, created ${d(r.createdAt)})`).join(' + ')}`);
    }
    console.log('\nDailyActivityMetric (newest 5): date | steps | active min | device');
    for (const a of activity) console.log(`  ${d(a.date).slice(0, 10)} | ${a.steps} | ${a.activeMinutes} | ${a.deviceType}`);
    console.log('\nExerciseLog (newest 5): when | activity | category | min | intensity | notes');
    for (const w of workouts) console.log(`  ${d(w.timestamp)} | ${w.activityType} | ${w.category} | ${w.duration} | ${w.intensity} | ${w.notes || '-'}`);

    console.log('\nApp targets the coach will use:');
    console.log(formatTargets(targets).split('\n').map((l) => `  ${l}`).join('\n'));

    console.log(`\nHealthProfile: ${hp ? `version ${hp.version}, allergies ${hp.allergies?.state} [${(hp.allergies?.items || []).map((i) => i.allergen).join(', ')}], `
        + `medications ${hp.medications?.state}, conditions ${hp.conditions?.state}, fitness.limitations [${(hp.fitness?.limitations || []).join(', ')}]` : 'none'}`);
    console.log(`CoachState: ${coach ? JSON.stringify({ pendingQuestion: coach.pendingQuestion, askedLog: coach.askedLog, pendingConfirm: coach.pendingConfirm, lastSaved: coach.lastSaved }) : 'none'}\n`);
}

main()
    .catch((err) => { console.error('Failed:', err.message); process.exitCode = 1; })
    .finally(async () => { await mongoose.disconnect().catch(() => {}); process.exit(process.exitCode || 0); });
