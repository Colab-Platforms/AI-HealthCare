/**
 * End-to-end check on STAGING that HealthGoal is the only stored goal
 * (User.nutritionGoal removed 26 Nov): real HTTP calls against the real app
 * (server.js in-process, crons off) and the staging DB.
 *
 *   OLD users (the two coach test personas, migrated): login, profile,
 *   dashboard, goal screen read/write, profile edit, weight log, health-profile
 *   edit, calorie override, coach targets, diet targets.
 *   NEW users (created here, deleted at the end): signup with the full
 *   onboarding form, signup + later onboarding (PUT /auth/profile), a user with
 *   no goal at all.
 *
 * After every step: every place that shows a calorie target must show the
 * active HealthGoal's number, and no user document may carry a stored
 * nutritionGoal again.
 *
 * Run from server/ (staging only; it changes the test personas' data, so
 * re-seed them after):
 *   $env:USE_STAGING_DB="true"; node scripts/nutritionGoalStagingE2E.js
 *   node scripts/createCoachTestUser.js --persona=a --reset   (and b)
 */
process.env.VERCEL = '1'; // server.js: export the app, no crons, no listen
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

if (process.env.USE_STAGING_DB !== 'true') {
    console.error('Refusing to run: staging only (set USE_STAGING_DB=true).');
    process.exit(1);
}

const mongoose = require('mongoose');

const PERSONAS = ['coach-test@example.invalid', 'coach-test-b@example.invalid'];
const RUN = Date.now().toString(36);
const NEW_EMAILS = [`e2e-goal-full-${RUN}@example.invalid`, `e2e-goal-later-${RUN}@example.invalid`, `e2e-goal-none-${RUN}@example.invalid`];
const PASSWORD = `E2e-${RUN}-Pw9!`;

let base;
let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
    if (ok) passed++; else failed++;
    console.log(`${ok ? '  ✓' : '  ✗'} ${name}${!ok && detail ? `  -> ${detail}` : ''}`);
}

class RateLimited extends Error {}

async function api(method, url, { token, body } = {}) {
    const res = await fetch(`${base}${url}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch { /* empty */ }
    // The auth limiter (10 / 15 min, shared Redis) trips when runs are back to back:
    // stop instead of reporting dozens of false failures.
    if (res.status === 429) throw new RateLimited(`${method} ${url} rate limited (429)`);
    return { status: res.status, body: json };
}

// Every place a calorie target shows up must equal the active HealthGoal.
async function consistency(label, userId, token) {
    const HealthGoal = require('../models/HealthGoal');
    const User = require('../models/User');
    const { getTargets } = require('../modules/ai-coach/context/targets');
    const { resolveDietTargets } = require('../services/dietTargets');
    const goal = await HealthGoal.findOne({ userId, isActive: true }).sort({ createdAt: -1 }).lean();
    const kcal = goal?.dailyCalorieTarget ?? null;

    const profile = await api('GET', '/api/auth/profile', { token });
    const dash = await api('GET', '/api/health/dashboard', { token });
    const goals = await api('GET', '/api/nutrition/goals', { token });
    const coach = await getTargets(userId);
    const diet = await resolveDietTargets(await User.findById(userId).lean());
    const raw = await User.collection.findOne({ _id: new mongoose.Types.ObjectId(String(userId)) }, { projection: { nutritionGoal: 1 } });

    const seen = {
        goal: kcal,
        'GET /auth/profile': profile.body?.nutritionGoal?.calorieGoal ?? null,
        'dashboard goals.calories': dash.body?.goals?.calories ?? null,
        'dashboard user.nutritionGoal': dash.body?.user?.nutritionGoal?.calorieGoal ?? null,
        'GET /nutrition/goals': goals.body?.healthGoal?.dailyCalorieTarget ?? null,
        coach: coach?.targets?.calories ?? null,
        'diet generator': diet?.calorieGoal ?? null,
    };
    if (kcal == null) {
        check(`${label}: no goal -> app defaults, nutritionGoal still an object`,
            profile.body?.nutritionGoal?.goal === 'general_health' && seen['dashboard goals.calories'] === 2100 && goals.status === 404,
            JSON.stringify({ ng: profile.body?.nutritionGoal, dash: seen['dashboard goals.calories'], goalsStatus: goals.status }));
    } else {
        const wrong = Object.entries(seen).filter(([, v]) => v !== kcal);
        check(`${label}: every screen shows the goal's ${kcal} kcal`, wrong.length === 0, JSON.stringify(seen));
        check(`${label}: protein matches too`, profile.body?.nutritionGoal?.proteinGoal === goal.macroTargets?.protein && coach?.targets?.protein === goal.macroTargets?.protein,
            JSON.stringify({ goal: goal.macroTargets?.protein, profile: profile.body?.nutritionGoal?.proteinGoal, coach: coach?.targets?.protein }));
    }
    check(`${label}: no stored User.nutritionGoal`, !raw?.nutritionGoal, JSON.stringify(raw?.nutritionGoal));
    return goal;
}

async function hp(userId) {
    const HealthProfile = require('../modules/health-profile/models/HealthProfile');
    return HealthProfile.findOne({ user: userId }).lean();
}

async function setPassword(email) {
    const User = require('../models/User');
    const u = await User.findOne({ email });
    if (!u) return null;
    u.password = PASSWORD; // hashed by the pre-save hook
    await u.save();
    return u._id;
}

async function login(email) {
    const r = await api('POST', '/api/auth/login', { body: { email, password: PASSWORD } });
    return r;
}

async function oldUser(email) {
    console.log(`\n── OLD user ${email.split('@')[0]} ──`);
    const HealthGoal = require('../models/HealthGoal');
    const userId = await setPassword(email);
    if (!userId) return check(`${email}: exists`, false);

    const li = await login(email);
    check('login 200', li.status === 200, `${li.status} ${JSON.stringify(li.body)}`);
    const token = li.body?.token;
    const g0 = await HealthGoal.findOne({ userId, isActive: true }).lean();
    check('login response nutritionGoal = HealthGoal', li.body?.nutritionGoal?.calorieGoal === g0?.dailyCalorieTarget, `${li.body?.nutritionGoal?.calorieGoal} vs ${g0?.dailyCalorieTarget}`);
    await consistency('start', userId, token);

    // Profile edit (old app path): weight +1
    const w1 = (g0?.currentWeight || 70) + 1;
    const up = await api('PUT', '/api/auth/profile', { token, body: { profile: { weight: w1 } } });
    const g1 = await HealthGoal.findOne({ userId, isActive: true }).lean();
    check('PUT /auth/profile weight -> goal follows', up.status === 200 && g1.currentWeight === w1, `${up.status} goal ${g1?.currentWeight}`);
    check('...response nutritionGoal = new goal', up.body?.nutritionGoal?.calorieGoal === g1.dailyCalorieTarget, `${up.body?.nutritionGoal?.calorieGoal} vs ${g1.dailyCalorieTarget}`);
    check('...HealthProfile weight follows', (await hp(userId))?.body?.weightKg === w1);
    await consistency('after profile edit', userId, token);

    // Weight log
    const w2 = w1 - 0.5;
    const lw = await api('POST', '/api/nutrition/log-weight', { token, body: { weight: w2 } });
    const g2 = await HealthGoal.findOne({ userId, isActive: true }).lean();
    check('log-weight -> goal + profile follow', lw.status === 200 && g2.currentWeight === w2 && (await hp(userId))?.body?.weightKg === w2, `${lw.status} ${g2?.currentWeight}`);
    await consistency('after weight log', userId, token);

    // Health profile API: activity change -> goal activity follows (syncActivity)
    const prof = await api('GET', '/api/health-profile', { token });
    const newAct = g2.activityLevel === 'very_active' ? 'lightly_active' : 'very_active';
    const pa = await api('PATCH', '/api/health-profile/lifestyle', { token, body: { data: { activityLevel: newAct }, version: prof.body?.version } });
    const g3 = await HealthGoal.findOne({ userId, isActive: true }).lean();
    check('PATCH health-profile lifestyle.activityLevel -> goal activity + calories follow', pa.status === 200 && g3.activityLevel === newAct && g3.dailyCalorieTarget !== g2.dailyCalorieTarget,
        `${pa.status} ${g3?.activityLevel} ${g2.dailyCalorieTarget}->${g3?.dailyCalorieTarget}`);
    await consistency('after health-profile edit', userId, token);

    // Goal screen: new goal with a 20-week timeframe and activity
    const body = { goalType: g3.goalType, currentWeight: g3.currentWeight, targetWeight: g3.targetWeight, height: g3.height, age: g3.age, gender: g3.gender, activityLevel: 'moderately_active', targetWeeks: 20, acknowledgeUnsafe: true };
    const sg = await api('POST', '/api/nutrition/goals', { token, body });
    const g4 = await HealthGoal.findOne({ userId, isActive: true }).lean();
    check('goal screen save 200', sg.status === 200, `${sg.status} ${JSON.stringify(sg.body)?.slice(0, 200)}`);
    check('...goal has the date, profile gets the goal screen activity', Boolean(g4.targetDate) && (await hp(userId))?.lifestyle?.activityLevel === 'moderately_active',
        `${g4?.targetDate} ${(await hp(userId))?.lifestyle?.activityLevel}`);
    await consistency('after goal screen', userId, token);

    // Manual calorie target
    const mo = await api('PATCH', '/api/nutrition/goals/calorie-override', { token, body: { dailyCalorieTarget: 2000, acknowledgeUnsafe: true } });
    const pr = await api('GET', '/api/auth/profile', { token });
    check('calorie override -> 2000 everywhere, autoCalculated false', mo.status === 200 && pr.body?.nutritionGoal?.calorieGoal === 2000 && pr.body?.nutritionGoal?.autoCalculated === false,
        `${mo.status} ${JSON.stringify(pr.body?.nutritionGoal)}`);
    await consistency('after manual target', userId, token);
    // A profile edit keeps the manual target
    await api('PUT', '/api/auth/profile', { token, body: { profile: { weight: w2 + 0.3 } } });
    const g5 = await HealthGoal.findOne({ userId, isActive: true }).lean();
    check('...profile edit keeps the manual 2000', g5.dailyCalorieTarget === 2000 && g5.calorieSource === 'manual', `${g5.dailyCalorieTarget} ${g5.calorieSource}`);
}

async function newUsers() {
    const Otp = require('../models/Otp');
    const HealthGoal = require('../models/HealthGoal');
    const User = require('../models/User');
    const otp = () => String(100000 + Math.floor(Math.random() * 899999));

    // N1. Signup with the whole onboarding form (diabetic, picked pace 0.25)
    console.log('\n── NEW user: signup with the onboarding form ──');
    let code = otp();
    await Otp.create({ email: NEW_EMAILS[0], code });
    const reg = await api('POST', '/api/auth/register', { body: {
        name: 'E2E Goal Full', email: NEW_EMAILS[0], password: PASSWORD, otp: code, privacyPolicyAccepted: true,
        profile: { age: 52, gender: 'female', height: 160, weight: 82, activityLevel: 'lightly_active', isDiabetic: 'yes' },
        nutritionGoal: { goal: 'weight_loss', targetWeight: 72, weeklyGoal: 0.25 },
    } });
    check('register 201', reg.status === 201, `${reg.status} ${JSON.stringify(reg.body)?.slice(0, 200)}`);
    const u1 = await User.findOne({ email: NEW_EMAILS[0] }).lean();
    const g1 = u1 && await HealthGoal.findOne({ userId: u1._id, isActive: true }).lean();
    const expected = HealthGoal.computeDraft({ userId: u1?._id, goalType: 'weight_loss', currentWeight: 82, targetWeight: 72, height: 160, age: 52, gender: 'female', activityLevel: 'lightly_active', isDiabetic: true, weeklyGoal: 0.25 });
    check('...HealthGoal created with the picked pace + diabetes flag', g1 && g1.weeklyGoal === 0.25 && g1.isDiabetic === true && g1.dailyCalorieTarget === expected.dailyCalorieTarget,
        JSON.stringify({ pace: g1?.weeklyGoal, diab: g1?.isDiabetic, kcal: g1?.dailyCalorieTarget, expected: expected.dailyCalorieTarget }));
    check('...register response nutritionGoal = HealthGoal', reg.body?.nutritionGoal?.calorieGoal === g1?.dailyCalorieTarget, `${reg.body?.nutritionGoal?.calorieGoal}`);
    check('...HealthProfile target weight 72', (await hp(u1._id))?.goals?.targetWeightKg === 72);
    await consistency('new user (full form)', u1._id, reg.body?.token);
    // later weight log keeps everything in step
    await api('POST', '/api/nutrition/log-weight', { token: reg.body?.token, body: { weight: 81 } });
    await consistency('new user after weight log', u1._id, reg.body?.token);

    // N2. Bare signup, onboarding later through PUT /auth/profile (social-login path)
    console.log('\n── NEW user: bare signup, onboarding later ──');
    code = otp();
    await Otp.create({ email: NEW_EMAILS[1], code });
    const reg2 = await api('POST', '/api/auth/register', { body: { name: 'E2E Goal Later', email: NEW_EMAILS[1], password: PASSWORD, otp: code, privacyPolicyAccepted: true } });
    check('bare register 201', reg2.status === 201, `${reg2.status}`);
    const u2 = await User.findOne({ email: NEW_EMAILS[1] }).lean();
    await consistency('bare user before onboarding', u2._id, reg2.body?.token);
    const onb = await api('PUT', '/api/auth/profile', { token: reg2.body?.token, body: {
        profile: { age: 28, gender: 'male', height: 172, weight: 64, activityLevel: 'moderately_active' },
        nutritionGoal: { goal: 'muscle_gain', targetWeight: 70 },
    } });
    const g2 = await HealthGoal.findOne({ userId: u2._id, isActive: true }).lean();
    check('onboarding PUT -> HealthGoal created (default pace 0.5)', onb.status === 200 && g2?.goalType === 'muscle_gain' && g2?.weeklyGoal === 0.5, `${onb.status} ${g2?.goalType} ${g2?.weeklyGoal}`);
    check('...response nutritionGoal = HealthGoal', onb.body?.nutritionGoal?.calorieGoal === g2?.dailyCalorieTarget);
    check('...HealthProfile target weight 70', (await hp(u2._id))?.goals?.targetWeightKg === 70);
    await consistency('onboarded later', u2._id, reg2.body?.token);
    // change the goal from the profile form
    const chg = await api('PUT', '/api/auth/profile', { token: reg2.body?.token, body: { nutritionGoal: { goal: 'weight_gain', targetWeight: 74, weeklyGoal: 0.25 } } });
    const g2b = await HealthGoal.findOne({ userId: u2._id, isActive: true }).lean();
    check('profile form goal change -> same goal updated (not a second one)', chg.status === 200 && g2b.goalType === 'weight_gain' && g2b.targetWeight === 74 && String(g2b._id) === String(g2._id)
        && (await HealthGoal.countDocuments({ userId: u2._id })) === 1, `${g2b?.goalType} ${g2b?.targetWeight}`);
    await consistency('after goal change', u2._id, reg2.body?.token);

    // N3. A user with no goal at all
    console.log('\n── NEW user: no goal ──');
    code = otp();
    await Otp.create({ email: NEW_EMAILS[2], code });
    const reg3 = await api('POST', '/api/auth/register', { body: { name: 'E2E Goal None', email: NEW_EMAILS[2], password: PASSWORD, otp: code, privacyPolicyAccepted: true, profile: { age: 40, gender: 'male' } } });
    if (reg3.status === 429) {
        // authLimiter (10 / window, shared Redis): two runs back to back hit it. Not a goal bug.
        failed++;
        console.log('  ✗ rate limited (429) by the auth limiter: wait ~15 min and run again');
        return;
    }
    const u3 = await User.findOne({ email: NEW_EMAILS[2] }).lean();
    check('register without body data 201, no goal', reg3.status === 201 && !(await HealthGoal.exists({ userId: u3._id })), `${reg3.status}`);
    await consistency('no-goal user', u3._id, reg3.body?.token);
    const li = await login(NEW_EMAILS[2]);
    check('login works, nutritionGoal is the default object', li.status === 200 && li.body?.nutritionGoal?.goal === 'general_health', JSON.stringify(li.body?.nutritionGoal));
}

async function cleanupNewUsers() {
    const User = require('../models/User');
    const users = await User.find({ email: { $in: NEW_EMAILS } }).select('_id').lean();
    const ids = users.map((u) => u._id);
    if (!ids.length) return;
    const db = mongoose.connection.db;
    await Promise.all([
        db.collection('healthgoals').deleteMany({ userId: { $in: ids } }),
        db.collection('health_profiles').deleteMany({ user: { $in: ids } }),
        db.collection('profile_history').deleteMany({ user: { $in: ids } }),
        db.collection('healthmetrics').deleteMany({ userId: { $in: ids } }),
        db.collection('nutritionsummaries').deleteMany({ userId: { $in: ids } }),
        db.collection('notificationpreferences').deleteMany({ $or: [{ user: { $in: ids } }, { userId: { $in: ids } }] }),
        db.collection('consentlogs').deleteMany({ userId: { $in: ids } }),
        db.collection('refreshtokens').deleteMany({ userId: { $in: ids } }),
        db.collection('otps').deleteMany({ email: { $in: NEW_EMAILS } }),
    ]);
    await User.deleteMany({ _id: { $in: ids } });
    console.log(`\nCleanup: removed ${ids.length} e2e user(s) and their rows.`);
}

async function main() {
    const app = require('../server');
    for (let i = 0; i < 60 && mongoose.connection.readyState !== 1; i++) await new Promise((r) => setTimeout(r, 500));
    if (!/staging$/i.test(mongoose.connection.name)) {
        console.error(`Refusing: connected DB "${mongoose.connection.name}" is not staging.`);
        process.exit(1);
    }
    const server = app.listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
    console.log(`App on ${base}, DB ${mongoose.connection.name}`);

    try {
        for (const email of PERSONAS) await oldUser(email);
        await newUsers();
    } catch (err) {
        failed++;
        if (err instanceof RateLimited) console.error(`
STOPPED: ${err.message}. Not a goal bug: wait 15 min and run again.`);
        else console.error('CRASH:', err);
    } finally {
        await cleanupNewUsers().catch((e) => console.error('cleanup failed:', e.message));
        server.close();
    }
    console.log(`\n${passed} passed, ${failed} failed`);
    console.log('Now re-seed the personas: node scripts/createCoachTestUser.js --persona=a --reset (and b)');
    await mongoose.disconnect().catch(() => {});
    process.exit(failed ? 1 : 0);
}

main();
