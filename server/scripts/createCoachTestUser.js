/**
 * Creates STAGING test users for the AI Coach: a plan that includes
 * aiHealthCoach, a filled profile + HealthProfile, and 6 months of data across
 * everything the coach reads (sleep, recovery, steps, workouts, meals + daily
 * summaries, water, weight, sugar, BP, lab reports, a vault file, health goal).
 * Two personas in different age bands (scripts/lib/coachSeedPersonas.js):
 *
 *   a  Rahul, 24, muscle gain       coach-test@example.invalid    (default)
 *   b  Sushila, 67, type 2 diabetes coach-test-b@example.invalid
 *
 * Run from server/:
 *   node scripts/createCoachTestUser.js --persona=b            # create (prints email + password once)
 *   node scripts/createCoachTestUser.js --persona=b --reset    # new password, persona profile, fresh data
 *   node scripts/createCoachTestUser.js --persona=b --reset-coach  # clear coach memory + symptoms only
 *   node scripts/createCoachTestUser.js --persona=b --no-data  # user + profile only
 *   node scripts/createCoachTestUser.js --persona=b --delete   # remove the user and everything seeded
 *   --email=<address>                                          # override the persona's email
 *
 * Safety: refuses unless USE_STAGING_DB=true and the database name ends with
 * "staging". Seeded rows are tagged test_seed (deviceType / notes / file name);
 * --reset also clears this user's chat meal logs, daily summaries, coach state
 * and health profile. Real device rows (e.g. apple_watch) are never touched.
 * The password is random and printed once; it is never stored in plain text.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

if (process.env.USE_STAGING_DB !== 'true' || !process.env.MONGODB_URI_STAGING) {
    console.error('Refusing to run: needs USE_STAGING_DB=true and MONGODB_URI_STAGING (staging only).');
    process.exit(1);
}

const crypto = require('crypto');
const mongoose = require('mongoose');
const { PERSONAS, SEED, DAYS, dayUTC, at, generate } = require('./lib/coachSeedPersonas');

const args = process.argv.slice(2);
const has = (f) => args.includes(`--${f}`);
const PERSONA_KEY = (args.find((a) => a.startsWith('--persona=')) || '--persona=a').slice(10).trim().toLowerCase();
const PERSONA = PERSONAS[PERSONA_KEY];
if (!PERSONA) {
    console.error(`Unknown persona "${PERSONA_KEY}". Use --persona=a or --persona=b.`);
    process.exit(1);
}
const EMAIL = (args.find((a) => a.startsWith('--email=')) || `--email=${PERSONA.email}`).slice(8).trim().toLowerCase();

// Readable but strong: 16 chars from an unambiguous alphabet + fixed classes.
function newPassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes = crypto.randomBytes(12);
    const body = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
    return `Ct-${body}9!`;
}

async function main() {
    const connectDB = require('../config/db');
    await connectDB();
    const dbName = mongoose.connection.name;
    if (!/staging$/i.test(dbName)) {
        console.error(`Refusing to continue: connected database "${dbName}" is not a staging database.`);
        process.exit(1);
    }
    console.log(`\nDB: ${mongoose.connection.host} / ${dbName}   persona: ${PERSONA_KEY} (${PERSONA.name}, ${PERSONA.profile.age})\n`);

    // Cache deletes are a silent no-op until Redis is ready (getClient() is
    // null before that). 25 Nov: a stale diet-plan cache survived the deletes
    // and was served halfway through the seed once Redis connected.
    const { getClient, isConfigured } = require('../utils/redisClient');
    if (isConfigured()) {
        const until = Date.now() + 15000;
        while (!getClient() && Date.now() < until) await new Promise((r) => setTimeout(r, 200));
        if (!getClient()) throw new Error('Redis is configured but not reachable: cached goals / plans could not be cleared. Try again.');
    }

    const M = {
        User: require('../models/User'),
        Plan: require('../models/Plan'),
        SleepSession: require('../models/SleepSession'),
        RecoveryDailySummary: require('../models/RecoveryDailySummary'),
        DailyActivityMetric: require('../models/DailyActivityMetric'),
        ExerciseLog: require('../models/ExerciseLog'),
        FoodLog: require('../models/FoodLog'),
        NutritionSummary: require('../models/NutritionSummary'),
        HealthMetric: require('../models/HealthMetric'),
        HealthGoal: require('../models/HealthGoal'),
        HealthReport: require('../models/HealthReport'),
        VaultReport: require('../models/VaultReport'),
        HealthProfile: require('../modules/health-profile/models/HealthProfile'),
        ProfileHistory: require('../modules/health-profile/models/ProfileHistory'),
        CoachState: require('../modules/ai-coach/models/CoachState'),
        SymptomLog: require('../modules/ai-coach/models/SymptomLog'),
    };
    const existing = await M.User.findOne({ email: EMAIL });

    const clearCoach = (uid) => Promise.all([
        M.CoachState.deleteMany({ user: uid }),
        M.SymptomLog.deleteMany({ user: uid }),
    ]);
    // Everything this script (or chat testing) wrote for this test user.
    const removeSeed = (uid) => Promise.all([
        M.SleepSession.deleteMany({ user: uid, deviceType: SEED }),
        M.RecoveryDailySummary.deleteMany({ user: uid }),
        M.DailyActivityMetric.deleteMany({ user: uid, deviceType: SEED }),
        M.ExerciseLog.deleteMany({ userId: uid, $or: [{ notes: SEED }, { notes: { $regex: `\\[${SEED}\\]` } }] }),
        M.FoodLog.deleteMany({ userId: uid, $or: [{ notes: SEED }, { source: 'chat' }] }),
        M.NutritionSummary.deleteMany({ userId: uid }),
        // Weigh-ins carry no seed tag when the chat (or app) logged them: all of
        // this test user's weight readings go, or a chat 78 kg survives a reseed.
        M.HealthMetric.deleteMany({ userId: uid, $or: [{ notes: SEED }, { notes: /chat/i }, { type: 'weight' }] }),
        M.HealthGoal.deleteMany({ userId: uid }),
        M.HealthReport.deleteMany({ user: uid, 'originalFile.filename': SEED }),
        M.VaultReport.deleteMany({ userId: uid, note: SEED }),
    ]);

    if (has('reset-coach')) {
        if (!existing) return console.log(`No user ${EMAIL}.`);
        const [cs, sy] = await clearCoach(existing._id);
        // The opener's "once a day" marks live in CoachState too, so they go with it.
        return console.log(`Coach memory cleared for ${EMAIL}: ${cs.deletedCount} coach state, ${sy.deletedCount} symptom rows. Profile, health data and food logs kept.`);
    }

    if (has('delete')) {
        if (!existing) return console.log(`No user ${EMAIL}. Nothing to delete.`);
        await removeSeed(existing._id);
        await clearCoach(existing._id);
        await Promise.all([
            M.HealthProfile.deleteMany({ user: existing._id }),
            M.ProfileHistory.deleteMany({ user: existing._id }),
        ]);
        await M.User.deleteOne({ _id: existing._id });
        return console.log(`Deleted ${EMAIL} and its sample data, health profile and coach state.`);
    }

    if (existing && !has('reset')) {
        console.log(`${EMAIL} already exists (id ${existing._id}). Its password is not stored in plain text.`);
        console.log('Run with --reset for a new password and fresh sample data.');
        return;
    }

    // A plan that actually includes the coach, so /api/chat isn't 403.
    const plans = await M.Plan.find({ isActive: true, 'features.aiHealthCoach': true }).select('key billingCycle').lean();
    const plan = plans.find((p) => p.key === 'take_plus') || plans.find((p) => p.key === 'free_trial') || plans[0];
    if (!plan) {
        console.error('No active plan with features.aiHealthCoach = true on staging. Run the plan sync first.');
        process.exit(1);
    }

    const p = PERSONA.profile;

    const password = newPassword();
    const subscription = {
        plan: plan.key,
        status: 'active',
        billingCycle: plan.billingCycle || 'monthly',
        currentPeriodEnd: new Date(Date.now() + 90 * 86400000),
    };
    const fields = {
        name: PERSONA.name,
        profile: p,
        subscription,
        isEmailVerified: true,
        privacyPolicyAccepted: true,
        consent: { given: true, version: '1.0', givenAt: new Date(), withdrawn: false, withdrawnAt: null },
    };

    let user;
    if (existing) {
        existing.set(fields);
        existing.password = password; // hashed by the User pre-save hook
        await existing.save();
        // The removed User.nutritionGoal field (26 Nov) must not linger on the test user.
        await M.User.collection.updateOne({ _id: existing._id }, { $unset: { nutritionGoal: '' } });
        user = existing;
        await removeSeed(user._id);
        await clearCoach(user._id);
        await Promise.all([
            M.HealthProfile.deleteMany({ user: user._id }),
            M.ProfileHistory.deleteMany({ user: user._id }),
            // A diet plan generated for the old profile would set other calorie
            // targets than the persona's (daily summaries prefer the plan).
            // Deleted, not deactivated: on 25 Nov a deactivated plan was still
            // re-cached in the shared Redis by another process mid-seed.
            require('../models/PersonalizedDietPlan').deleteMany({ userId: user._id }),
        ]);
        await require('../utils/cache').delete(`active_diet_plan:${user._id}`);
        console.log('Existing user: password reset, persona profile re-applied, old seed / chat data / diet plan removed.');
    } else {
        user = await M.User.create({ ...fields, email: EMAIL, password, role: 'user' });
        console.log('User created.');
    }

    // HealthProfile from the persona's onboarding answers, as signup does,
    // plus what onboarding can't express (injuries) as a manual edit.
    const { createProfileWriteService } = require('../modules/health-profile/services/profileWriteService');
    const svc = createProfileWriteService({ afterCommit: async () => {} });
    // The onboarding goal input (not stored on User) carries the target weight.
    await svc.createFromOnboarding(user._id, { ...user.toObject(), nutritionGoal: { targetWeight: PERSONA.goal.targetWeight } }, { source: 'manual' });
    await svc.updateSection(user._id, 'fitness', { limitations: PERSONA.limitations.length ? PERSONA.limitations : ['none'] }, { source: 'manual' });

    // Active HealthGoal (the only stored goal + targets), created the way signup
    // creates it: healthGoalService.syncGoal with the onboarding goal input.
    const startWeight = PERSONA_KEY === 'a' ? 71 : 88;
    const goal = await require('../services/healthGoalService').syncGoal(user._id, { profile: p, input: PERSONA.goal, create: true });
    if (!goal) throw new Error('HealthGoal not created for the persona');
    goal.startWeight = startWeight;
    goal.startDate = dayUTC(DAYS - 1);
    await goal.save();

    if (!has('no-data')) await seedData(M, user._id);

    // Cached reads the coach would otherwise serve from the old persona / old
    // data: profile context (10 min) and long-range trends (6 h).
    const cache = require('../utils/cache');
    const { contextKey } = require('../modules/health-profile/services/profileContextService');
    await cache.delete(contextKey(user._id));
    await cache.delete(`health_goal:${user._id}`);
    await cache.deletePattern(`coach:lr:*${user._id}*`);

    console.log('\n──────────── STAGING TEST LOGIN ────────────');
    console.log(`  persona:  ${PERSONA_KEY} = ${PERSONA.name}, ${p.age}, ${p.gender}`);
    console.log(`  email:    ${EMAIL}`);
    console.log(`  password: ${password}`);
    console.log(`  user id:  ${user._id}`);
    console.log(`  plan:     ${plan.key} (${plan.billingCycle || 'monthly'}), active for 90 days`);
    console.log(`  targets:  ${goal.dailyCalorieTarget} kcal, protein ${goal.macroTargets?.protein} g (HealthGoal)`);
    console.log('─────────────────────────────────────────────');
    console.log('Shown once. Run with --reset to get a new one.\n');
}

async function seedData(M, uid) {
    const t0 = Date.now();
    const d = generate[PERSONA_KEY](uid);
    const { normaliseItems, totalsOf } = require('../services/foodLogService');

    await Promise.all([
        M.SleepSession.insertMany(d.sleep.map((s) => ({ ...s, user: uid, deviceType: SEED, source: SEED }))),
        M.RecoveryDailySummary.insertMany(d.recovery.map((r) => ({ ...r, user: uid, deviceType: SEED }))),
        M.DailyActivityMetric.insertMany(d.activity.map((a) => ({ ...a, user: uid, deviceType: SEED, source: SEED }))),
        M.ExerciseLog.insertMany(d.workouts.map((w) => ({ ...w, userId: uid, notes: w.notes ? `${w.notes} [${SEED}]` : SEED }))),
        M.HealthMetric.insertMany(d.metrics.map((m) => ({ ...m, userId: uid, notes: SEED }))),
    ]);

    // Meals the way the app stores them; then the app's own daily summary
    // (calories, macros, scores, meals-logged flags) for each day.
    const logs = d.meals.map((m) => {
        const items = normaliseItems(m.items);
        return { userId: uid, mealType: m.mealType, foodItems: items, totalNutrition: totalsOf(items), notes: SEED, source: 'manual', timestamp: m.timestamp };
    });
    await M.FoodLog.insertMany(logs);
    // The summary reads the active goal through a 15-min cache: drop the old
    // persona's goal so today's targets come from the goal created above.
    // Same for an old diet plan (deactivated on --reset). Done here, not at the
    // start: Redis connects lazily, and an early delete can silently miss.
    await require('../utils/cache').delete(`health_goal:${uid}`);
    await require('../utils/cache').delete(`active_diet_plan:${uid}`);
    const { updateDailySummaryInternal } = require('../controllers/nutritionController');
    const days = [...new Set(d.meals.map((m) => m.offset))];
    for (const off of days) await updateDailySummaryInternal(uid, dayUTC(off));
    // Each summary fires a background daily-score recompute; let those finish
    // before the script disconnects.
    await new Promise((r) => setTimeout(r, 5000));
    // Water on logged days (never today, so "no water yet" stays testable).
    await Promise.all(Object.entries(d.water).map(([off, ml]) => M.NutritionSummary.updateOne(
        { userId: uid, date: dayUTC(Number(off)) },
        { $set: { waterIntake: ml, waterLogs: [{ amountMl: ml, loggedAt: at(Number(off), 12, 0), label: SEED }] } },
    )));

    // Lab reports (analysed) with the app's metrics shape; createdAt = upload time.
    for (const rep of d.reports) {
        const uploaded = at(rep.offset, 6, 0);
        await M.HealthReport.collection.insertOne({
            user: uid, reportType: rep.reportType, category: 'lab_report', status: 'completed',
            patientName: PERSONA.name, patientAge: PERSONA.profile.age, patientGender: PERSONA.profile.gender,
            originalFile: { filename: SEED, mimetype: 'application/pdf' },
            reportDate: at(rep.offset + 1, 4, 0),
            aiAnalysis: { summary: rep.summary, healthScore: rep.healthScore, metrics: rep.metrics },
            createdAt: uploaded, updatedAt: uploaded,
        });
    }
    // Vault files (storage only, no real file behind them) uploaded after the last analysed report.
    for (const v of d.vault) {
        const uploaded = at(v.offset, 5, 0);
        await M.VaultReport.collection.insertOne({
            userId: uid, folderId: null, title: v.title, note: SEED, reportDate: uploaded, source: 'upload',
            file: { publicId: `${SEED}/none`, resourceType: 'raw', format: 'pdf', mime: 'application/pdf', sizeBytes: 0, originalName: v.originalName, pageCount: 1, encryption: 'none', legacyUrl: null },
            status: 'active', deletedAt: null, purgeAfter: null, purgedAt: null, createdAt: uploaded, updatedAt: uploaded,
        });
    }

    console.log(`Seeded in ${((Date.now() - t0) / 1000).toFixed(1)} s: ${d.sleep.length} nights, ${d.recovery.length} recovery days, `
        + `${d.activity.length} step days, ${d.workouts.length} workouts, ${d.meals.length} meals on ${days.length} days, `
        + `${d.metrics.length} readings (weight / sugar / BP / HbA1c), ${d.reports.length} lab report(s), ${d.vault.length} vault file(s).`);
}

main()
    .catch((err) => {
        console.error('\nFailed:', err.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect().catch(() => {});
        process.exit(process.exitCode || 0);
    });
