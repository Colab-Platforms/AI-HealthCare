/**
 * One stored goal (26 Nov): move every user from the removed User.nutritionGoal
 * to HealthGoal, which is now the only place the goal and daily targets live.
 *
 * Per user (old stored field read from the raw collection; the schema no
 * longer has it):
 *   - active HealthGoal, manual calorie target      -> left alone
 *   - active HealthGoal (auto)                      -> gets the pace the user picked
 *       at signup (old nutritionGoal.weeklyGoal, else 0.5) when it has no target
 *       date and no pace yet, and the diabetes flag from the profile; recalculated
 *   - no HealthGoal, complete profile + old goal     -> HealthGoal created from it
 *   - no HealthGoal and no old targets               -> nothing (the app showed defaults)
 *   - no HealthGoal, incomplete profile              -> skipped (nothing to calculate
 *       from; the app shows its defaults, as before)
 * Then, only with --unset: the old field is removed from every user document.
 *
 * Run from server/:
 *   node scripts/migrateNutritionGoal.js                   # DRY RUN: prints old -> new kcal, writes nothing
 *   node scripts/migrateNutritionGoal.js --apply           # write HealthGoals
 *   node scripts/migrateNutritionGoal.js --apply --unset   # ... and remove User.nutritionGoal
 *   node scripts/migrateNutritionGoal.js --user=<userId>   # one user
 *   node scripts/migrateNutritionGoal.js --limit=50        # first 50 users
 *
 * Target DB: USE_STAGING_DB=true -> staging (db name must end with "staging");
 * otherwise production, refused unless --prod is passed. Idempotent: safe to re-run.
 * Output has user ids only, never names or emails.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
    const a = args.find((x) => x.startsWith(`--${name}=`));
    return a ? a.slice(name.length + 3) : undefined;
};

const APPLY = flag('apply');
const UNSET = flag('unset');
const PROD = flag('prod');
const LIMIT = value('limit') ? Number(value('limit')) : 0;
const ONE_USER = value('user');
const useStaging = process.env.USE_STAGING_DB === 'true';

function refuse(msg) {
    console.error(`Refusing to run: ${msg}`);
    process.exit(1);
}

if (!useStaging && !PROD) refuse('this targets PRODUCTION (USE_STAGING_DB is not true). Pass --prod if you mean it.');
if (UNSET && !APPLY) refuse('--unset needs --apply.');
if (LIMIT && (!Number.isInteger(LIMIT) || LIMIT < 1)) refuse('--limit must be a positive integer.');
if (ONE_USER && !mongoose.isValidObjectId(ONE_USER)) refuse('--user must be a valid user id.');

const positive = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : undefined);

// What this user's goal should be. Returns { action, before, after, goal? }.
async function planUser(raw, { HealthGoal, svc }) {
    const userId = raw._id;
    const legacy = raw.nutritionGoal || null;
    const profile = raw.profile || {};
    const body = svc.bodyFrom(profile);
    const complete = Boolean(body.age && body.gender && body.height && body.currentWeight);
    const before = { legacyKcal: legacy?.calorieGoal ?? null, goalKcal: null };

    const goal = await HealthGoal.findOne({ userId, isActive: true }).sort({ createdAt: -1 });
    if (goal) {
        before.goalKcal = goal.dailyCalorieTarget ?? null;
        if (goal.calorieSource === 'manual') return { action: 'manual_kept', before, after: before.goalKcal };
        if (!complete) return { action: 'unchanged', before, after: before.goalKcal };
        // The picked pace is added only where the two numbers disagreed (the
        // dashboard showed the signup number, the goal used 12 weeks). Where they
        // agreed, the user has only ever seen the goal's number: keep it.
        const disagreed = positive(legacy?.calorieGoal) && legacy.calorieGoal !== goal.dailyCalorieTarget;
        const pace = disagreed && !goal.targetDate && !positive(goal.weeklyGoal)
            ? (positive(legacy?.weeklyGoal) || svc.DEFAULT_WEEKLY_GOAL)
            : undefined;
        const draft = HealthGoal.computeDraft({
            ...goal.toObject(),
            _id: undefined,
            age: body.age, gender: body.gender, height: body.height, currentWeight: body.currentWeight,
            // activity: the goal's own (picked on the goal screen) is kept
            isDiabetic: body.isDiabetic,
            ...(pace ? { weeklyGoal: pace } : {}),
        });
        const after = draft.dailyCalorieTarget;
        const changed = after !== before.goalKcal || Boolean(pace) || goal.isDiabetic !== body.isDiabetic;
        return { action: changed ? 'recalculated' : 'unchanged', before, after, apply: changed ? () => svc.syncGoal(userId, { profile, input: pace ? { weeklyGoal: pace } : null }) : null };
    }

    // No goal before (the old field held only its schema default, no targets):
    // the app showed default numbers; creating a goal now would change them.
    if (!positive(legacy?.calorieGoal)) return { action: 'no_goal_before', before, after: null };
    if (!complete) return { action: 'skipped_incomplete', before, after: null };
    const input = { goal: legacy.goal, targetWeight: legacy.targetWeight, weeklyGoal: positive(legacy.weeklyGoal) || svc.DEFAULT_WEEKLY_GOAL };
    const draft = HealthGoal.computeDraft({
        userId,
        goalType: HealthGoal.schema.path('goalType').enumValues.includes(input.goal) ? input.goal : 'general_health',
        targetWeight: positive(input.targetWeight) || body.currentWeight,
        weeklyGoal: input.weeklyGoal,
        age: body.age, gender: body.gender, height: body.height, currentWeight: body.currentWeight,
        activityLevel: body.activityLevel || 'sedentary',
        isDiabetic: body.isDiabetic,
    });
    return { action: 'created', before, after: draft.dailyCalorieTarget, apply: () => svc.syncGoal(userId, { profile, input, create: true }) };
}

async function main() {
    const connectDB = require('../config/db');
    await connectDB();
    const dbName = mongoose.connection.name;
    if (useStaging && !/staging$/i.test(dbName)) refuse(`connected database "${dbName}" is not a staging database.`);
    console.log(`\nDB: ${mongoose.connection.host} / ${dbName} [${useStaging ? 'STAGING' : 'PRODUCTION'}]`);
    console.log(`MODE: ${APPLY ? `APPLY${UNSET ? ' + UNSET User.nutritionGoal' : ''}` : 'DRY RUN (writes nothing)'}\n`);

    const User = require('../models/User');
    const HealthGoal = require('../models/HealthGoal');
    const svc = require('../services/healthGoalService');

    const filter = ONE_USER ? { _id: new mongoose.Types.ObjectId(ONE_USER) } : {};
    let cursor = User.collection.find(filter, { projection: { profile: 1, nutritionGoal: 1 } });
    if (LIMIT) cursor = cursor.limit(LIMIT);

    const counts = {};
    const rows = [];
    for await (const raw of cursor) {
        let plan;
        try {
            plan = await planUser(raw, { HealthGoal, svc });
        } catch (err) {
            plan = { action: 'error', before: {}, after: null, error: err.message };
        }
        if (APPLY && plan.apply) {
            const saved = await plan.apply();
            if (!saved) plan = { ...plan, action: `${plan.action}_failed` };
            else plan.after = saved.dailyCalorieTarget;
        }
        counts[plan.action] = (counts[plan.action] || 0) + 1;
        rows.push({ id: String(raw._id), ...plan });
    }

    console.log('user                      action               old field  old goal  -> new');
    for (const r of rows) {
        if (r.action === 'unchanged' || r.action === 'skipped_incomplete' || r.action === 'no_goal_before') continue;
        console.log(`${r.id}  ${r.action.padEnd(20)} ${String(r.before.legacyKcal ?? '-').padStart(9)}  ${String(r.before.goalKcal ?? '-').padStart(8)}  -> ${r.after ?? '-'}${r.error ? `  (${r.error})` : ''}`);
    }
    console.log('\nSummary:', JSON.stringify(counts));

    // Users whose screens showed one number and the goal another before this:
    const mismatched = rows.filter((r) => r.before.legacyKcal && r.before.goalKcal && r.before.legacyKcal !== r.before.goalKcal).length;
    console.log(`Users whose old field and HealthGoal disagreed: ${mismatched}`);

    if (APPLY && UNSET) {
        const res = await User.collection.updateMany({ ...filter, nutritionGoal: { $exists: true } }, { $unset: { nutritionGoal: '' } });
        console.log(`Removed User.nutritionGoal from ${res.modifiedCount} user(s).`);
    }
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
