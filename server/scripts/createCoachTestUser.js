/**
 * Creates a STAGING test user for the AI Coach, with a filled profile, a plan
 * that includes aiHealthCoach, a HealthProfile, and 14 days of sample data
 * shaped for the "I'm tired and have to go to the gym" test (short last night,
 * low recovery today, heavy leg day yesterday). Run from server/:
 *
 *   node scripts/createCoachTestUser.js             # create (prints email + password once)
 *   node scripts/createCoachTestUser.js --reset     # new password + fresh sample data
 *   node scripts/createCoachTestUser.js --no-data   # user + profile only
 *   node scripts/createCoachTestUser.js --delete    # remove the user and everything seeded
 *   --email=<address>                               # default coach-test@example.invalid
 *
 * Safety: refuses unless USE_STAGING_DB=true and the database name ends with
 * "staging". Sample rows use deviceType "test_seed" so they are easy to find.
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

const args = process.argv.slice(2);
const has = (f) => args.includes(`--${f}`);
const EMAIL = (args.find((a) => a.startsWith('--email=')) || '--email=coach-test@example.invalid').slice(8).trim().toLowerCase();
const SEED_DEVICE = 'test_seed';
const DAYS = 14;

// Readable but strong: 16 chars from an unambiguous alphabet + fixed classes.
function newPassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes = crypto.randomBytes(12);
    const body = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
    return `Ct-${body}9!`;
}

const dayUTC = (offset) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - offset);
    return d;
};
const dayStr = (d) => d.toISOString().slice(0, 10);
const band = (s) => (s >= 85 ? { key: 'optimal', label: 'Optimal' } : s >= 70 ? { key: 'moderate', label: 'Moderate' } : s >= 50 ? { key: 'low', label: 'Low' } : { key: 'very_low', label: 'Very low' });

async function main() {
    const connectDB = require('../config/db');
    await connectDB();
    const dbName = mongoose.connection.name;
    if (!/staging$/i.test(dbName)) {
        console.error(`Refusing to continue: connected database "${dbName}" is not a staging database.`);
        process.exit(1);
    }
    console.log(`\nDB: ${mongoose.connection.host} / ${dbName}\n`);

    const User = require('../models/User');
    const Plan = require('../models/Plan');
    const SleepSession = require('../models/SleepSession');
    const RecoveryDailySummary = require('../models/RecoveryDailySummary');
    const DailyActivityMetric = require('../models/DailyActivityMetric');
    const ExerciseLog = require('../models/ExerciseLog');
    const HealthProfile = require('../modules/health-profile/models/HealthProfile');
    const ProfileHistory = require('../modules/health-profile/models/ProfileHistory');
    const CoachState = require('../modules/ai-coach/models/CoachState');
    const { createProfileWriteService } = require('../modules/health-profile/services/profileWriteService');

    const existing = await User.findOne({ email: EMAIL });

    const removeSeed = async (uid) => {
        await Promise.all([
            SleepSession.deleteMany({ user: uid, deviceType: SEED_DEVICE }),
            RecoveryDailySummary.deleteMany({ user: uid }),
            DailyActivityMetric.deleteMany({ user: uid, deviceType: SEED_DEVICE }),
            ExerciseLog.deleteMany({ userId: uid, notes: 'test_seed' }),
        ]);
    };

    if (has('delete')) {
        if (!existing) return console.log(`No user ${EMAIL}. Nothing to delete.`);
        await removeSeed(existing._id);
        await Promise.all([
            HealthProfile.deleteMany({ user: existing._id }),
            ProfileHistory.deleteMany({ user: existing._id }),
            CoachState.deleteMany({ user: existing._id }),
        ]);
        await User.deleteOne({ _id: existing._id });
        return console.log(`Deleted ${EMAIL} and its sample data, health profile and coach state.`);
    }

    if (existing && !has('reset')) {
        console.log(`${EMAIL} already exists (id ${existing._id}). Its password is not stored in plain text.`);
        console.log('Run with --reset for a new password and fresh sample data.');
        return;
    }

    // A plan that actually includes the coach, so /api/chat isn't 403.
    const plans = await Plan.find({ isActive: true, 'features.aiHealthCoach': true }).select('key billingCycle').lean();
    const plan = plans.find((p) => p.key === 'take_plus') || plans.find((p) => p.key === 'free_trial') || plans[0];
    if (!plan) {
        console.error('No active plan with features.aiHealthCoach = true on staging. Run the plan sync first.');
        process.exit(1);
    }

    const password = newPassword();
    const subscription = {
        plan: plan.key,
        status: 'active',
        billingCycle: plan.billingCycle || 'monthly',
        currentPeriodEnd: new Date(Date.now() + 90 * 86400000),
    };
    const profile = {
        age: 29, gender: 'male', height: 175, weight: 74,
        dietaryPreference: 'vegetarian',
        allergies: ['Peanut'],
        healthConditions: ['None of these'],
        medicalHistory: { currentMedications: [], surgeries: [], familyHistory: [] },
        activityLevel: 'moderately_active',
        profession: 'desk_job',
        goals: ['Build Muscle', 'Better Sleep'],
        lifestyle: { smoker: false, alcohol: false, sleepHours: 7, stressLevel: 'moderate', waterGoalMl: 2500, stepGoal: 9000 },
    };
    const nutritionGoal = { goal: 'muscle_gain', targetWeight: 76, calorieGoal: 2400, proteinGoal: 140, carbsGoal: 280, fatGoal: 70, autoCalculated: true };

    let user;
    if (existing) {
        existing.password = password; // hashed by the User pre-save hook
        existing.subscription = subscription;
        await existing.save();
        user = existing;
        await removeSeed(user._id);
        console.log('Existing user: password reset, plan refreshed.');
    } else {
        user = await User.create({
            name: 'Coach Test',
            email: EMAIL,
            password,
            role: 'user',
            isEmailVerified: true,
            privacyPolicyAccepted: true,
            consent: { given: true, version: '1.0', givenAt: new Date(), withdrawn: false, withdrawnAt: null },
            profile,
            nutritionGoal,
            subscription,
        });
        const svc = createProfileWriteService({ afterCommit: async () => {} });
        await svc.createFromOnboarding(user._id, user.toObject(), { source: 'manual' });
        console.log('User created with a HealthProfile.');
    }

    if (!has('no-data')) {
        const sleepRows = [];
        const recoveryRows = [];
        const activityRows = [];
        for (let i = DAYS - 1; i >= 0; i--) {
            const date = dayUTC(i);
            const lastNight = i === 0;
            const total = lastNight ? 310 : 400 + ((i * 37) % 50);      // 5h10m last night, ~6h40-7h30 before
            sleepRows.push({
                user: user._id, deviceType: SEED_DEVICE, date, source: SEED_DEVICE,
                totalSleepMinutes: total,
                deepSleepMinutes: Math.round(total * (lastNight ? 0.10 : 0.18)),
                remSleepMinutes: Math.round(total * (lastNight ? 0.15 : 0.22)),
                lightSleepMinutes: Math.round(total * (lastNight ? 0.75 : 0.60)),
                awakeMinutes: lastNight ? 45 : 20,
            });
            const score = lastNight ? 38 : 60 + ((i * 7) % 13);       // 38 today, 60-72 before
            recoveryRows.push({ user: user._id, date: dayStr(date), recoveryScore: score, band: band(score), deviceType: SEED_DEVICE });
            activityRows.push({
                user: user._id, deviceType: SEED_DEVICE, date, source: SEED_DEVICE,
                steps: lastNight ? 1200 : 8000 + ((i * 613) % 3500),
                activeMinutes: lastNight ? 5 : 35 + ((i * 11) % 30),
                caloriesBurned: lastNight ? 60 : 350 + ((i * 29) % 150),
            });
        }
        const at = (daysAgo, hourUTC) => { const d = dayUTC(daysAgo); d.setUTCHours(hourUTC); return d; };
        await Promise.all([
            SleepSession.insertMany(sleepRows),
            RecoveryDailySummary.insertMany(recoveryRows),
            DailyActivityMetric.insertMany(activityRows),
            ExerciseLog.insertMany([
                { userId: user._id, activityType: 'weight_training', category: 'strength', duration: 60, intensity: 'high', caloriesBurned: 380, timestamp: at(1, 13), notes: 'test_seed' },
                { userId: user._id, activityType: 'running', category: 'cardio', duration: 30, intensity: 'medium', caloriesBurned: 300, timestamp: at(3, 1), notes: 'test_seed' },
                { userId: user._id, activityType: 'weight_training', category: 'strength', duration: 50, intensity: 'medium', caloriesBurned: 320, timestamp: at(4, 13), notes: 'test_seed' },
            ]),
        ]);
        console.log(`Sample data: ${DAYS} days of sleep / recovery / steps, 3 workouts (leg day yesterday). No meals or lab reports.`);
    }

    console.log('\n──────────── STAGING TEST LOGIN ────────────');
    console.log(`  email:    ${EMAIL}`);
    console.log(`  password: ${password}`);
    console.log(`  user id:  ${user._id}`);
    console.log(`  plan:     ${plan.key} (${plan.billingCycle || 'monthly'}), active for 90 days`);
    console.log('─────────────────────────────────────────────');
    console.log('Shown once. Run with --reset to get a new one.\n');
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
