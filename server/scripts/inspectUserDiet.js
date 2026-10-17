/**
 * READ-ONLY audit of one user's diet setup and active meal plan. Writes nothing.
 *
 *   node scripts/inspectUserDiet.js user@example.com
 *
 * Answers, for that user:
 *   - which diet type, goal and calorie target is the app really using, and from where
 *   - is a stale "Jain" tag still lying in their preferences
 *   - does the ACTIVE plan match their current diet type and goal (staleness)
 *   - for every meal of the plan: does it break the diet / Jain / an exclusion,
 *     is it a wrong dish for the time of day, does it carry a place name
 *   - does each day land on the calorie target, and on which side
 *
 * Uses the same functions the generator validates with (dietRecommendationAI,
 * utils/mealGuard, utils/mealPlanCalories), so what it reports is what the
 * generator would reject.
 */
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const PersonalizedDietPlan = require('../models/PersonalizedDietPlan');
const HealthGoal = require('../models/HealthGoal');
const dietRecommendationAI = require('../services/dietRecommendationAI');
const { resolveDietTargets, normalizeGoal } = require('../services/dietTargets');
const { resolveDietaryPreference } = require('../utils/dietaryPreference');
const { reconcileFoodPreferences, isJainTag } = require('../utils/dietConstraints');
const { dayTotals } = require('../utils/mealPlanCalories');
const { MEAL_TYPES } = require('../config/indianMealSlots');

const line = (c = '-') => console.log(c.repeat(78));

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    console.error('Usage: node scripts/inspectUserDiet.js <email>');
    process.exit(1);
  }

  // Same switch as config/db.js and the other scripts: USE_STAGING_DB=true in
  // .env means STAGING. This used to read MONGODB_URI unconditionally, so the
  // script hit production even with the flag on. The target is printed so it
  // is never a guess which database a run touched.
  const useStaging = process.env.USE_STAGING_DB === 'true';
  const uri = useStaging ? process.env.MONGODB_URI_STAGING : process.env.MONGODB_URI;
  if (!uri) throw new Error('No Mongo URI resolved — check MONGODB_URI / MONGODB_URI_STAGING / USE_STAGING_DB in .env');
  await mongoose.connect(uri);
  console.log(`>>> Connected to ${useStaging ? 'STAGING' : 'PRODUCTION'} database\n`);
  const user = await User.findOne({ email }).lean();
  if (!user) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }

  line('=');
  console.log(`USER  ${user.name || '-'}  <${user.email}>  id=${user._id}`);
  line('=');

  // ---- diet type + Jain -------------------------------------------------
  const diet = resolveDietaryPreference(user).value;
  const fp = user.foodPreferences || {};
  console.log(`Diet type (profile): ${user.profile?.dietaryPreference || '(not set)'}  -> resolved: ${diet || 'NONE'}`);
  console.log(`Location: state=${fp.state || '-'}  city=${fp.city || '-'}  region=${fp.region || '-'}`);

  const jainWhere = [];
  for (const k of ['dietaryRestrictions', 'dietaryDo', 'dietaryDont', 'preferredFoods', 'foodsToAvoid']) {
    (fp[k] || []).filter(isJainTag).forEach((v) => jainWhere.push(`${k}: "${v}"`));
  }
  for (const s of ['breakfast', 'lunch', 'snacks', 'dinner']) {
    (fp.mealPreferences?.[s] || []).filter(isJainTag).forEach((v) => jainWhere.push(`mealPreferences.${s}: "${v}"`));
  }
  const reconciled = reconcileFoodPreferences(diet, fp);
  console.log(`Jain tags stored: ${jainWhere.length ? jainWhere.join(' | ') : 'none'}`);
  console.log(
    `Jain enforced for generation: ${reconciled.jain ? 'YES (diet is veg/vegan + Jain tag)' : 'no'}` +
      (reconciled.dropped.length ? `   [stale tags ignored: ${reconciled.dropped.join(', ')}]` : '')
  );
  console.log(`Restrictions: ${(fp.dietaryRestrictions || []).join(', ') || '-'}`);
  console.log(`Must do: ${(fp.dietaryDo || []).join(', ') || '-'}`);
  console.log(`Must not: ${(fp.dietaryDont || []).join(', ') || '-'}`);
  console.log(`Foods to avoid: ${(fp.foodsToAvoid || []).join(', ') || '-'}`);
  console.log(`Allergies: ${(user.profile?.allergies || []).join(', ') || '-'}`);

  // ---- goal ------------------------------------------------------------
  line();
  const hg = await HealthGoal.findOne({ userId: user._id, isActive: true }).sort({ createdAt: -1 }).lean();
  const targets = await resolveDietTargets(user);
  console.log(`HealthGoal (source of truth): ${hg ? `${hg.goalType}, ${hg.dailyCalorieTarget} kcal, tdee ${hg.tdee || '-'}` : 'none'}`);
  console.log(`User.nutritionGoal (mirror):  ${user.nutritionGoal ? `${user.nutritionGoal.goal}, ${user.nutritionGoal.calorieGoal || '-'} kcal` : 'none'}`);
  if (hg && user.nutritionGoal?.calorieGoal && Math.abs(hg.dailyCalorieTarget - user.nutritionGoal.calorieGoal) > 50) {
    console.log('  !! mirror and HealthGoal DISAGREE — the old generator read the mirror');
  }
  console.log(`Generator will use: goal=${targets.goal}  ${targets.calorieGoal} kcal  (source: ${targets.source})`);

  // ---- active plan -----------------------------------------------------
  line();
  const plan = await PersonalizedDietPlan.findOne({ userId: user._id, isActive: true }).sort({ generatedAt: -1 }).lean();
  if (!plan) {
    console.log('No active diet plan.');
    process.exit(0);
  }
  console.log(`Active plan ${plan._id}  status=${plan.status}  generated=${plan.generatedAt?.toISOString?.() || plan.generatedAt}`);
  console.log(`Built for: diet=${plan.inputData?.dietaryPreference || '?'}  goal=${plan.inputData?.bmiGoal || '?'}  target=${plan.nutritionGoals?.dailyCalorieTarget || plan.dailyCalorieTarget || '?'} kcal`);

  const staleReasons = [];
  if (diet && plan.inputData?.dietaryPreference && diet !== plan.inputData.dietaryPreference) {
    staleReasons.push(`diet type changed ${plan.inputData.dietaryPreference} -> ${diet}`);
  }
  if (plan.inputData?.bmiGoal && normalizeGoal(plan.inputData.bmiGoal) !== targets.goal) {
    staleReasons.push(`goal changed ${normalizeGoal(plan.inputData.bmiGoal)} -> ${targets.goal}`);
  }
  const planKcal = plan.nutritionGoals?.dailyCalorieTarget || plan.dailyCalorieTarget;
  if (planKcal && Math.abs(planKcal - targets.calorieGoal) / targets.calorieGoal > 0.05) {
    staleReasons.push(`calorie target changed ${planKcal} -> ${targets.calorieGoal}`);
  }
  console.log(staleReasons.length ? `STALE PLAN: ${staleReasons.join('; ')}  -> user must regenerate` : 'Plan matches current diet type, goal and target.');

  // ---- meal audit ------------------------------------------------------
  line();
  const target = planKcal || targets.calorieGoal;
  const constraints = dietRecommendationAI.deriveConstraints({
    dietaryPreference: diet,
    foodPreferences: fp,
    allergies: user.profile?.allergies || [],
    city: fp.city,
    state: fp.state,
  });
  const issues = dietRecommendationAI.auditMealPlan(plan.mealPlan, constraints, target);

  const totals = dayTotals(plan.mealPlan);
  for (const d of totals) {
    const names = MEAL_TYPES.map((m) => {
      const meal = plan.mealPlan?.[m]?.[d.index];
      return `${m[0].toUpperCase()}: ${meal?.name || '-'} (${Math.round(meal?.calories || 0)})`;
    });
    const pct = target ? Math.round(((d.total - target) / target) * 100) : 0;
    const side = Math.abs(pct) <= 5 ? 'ok' : pct > 0 ? `OVER by ${pct}%` : `UNDER by ${-pct}%`;
    console.log(`Day ${d.index + 1}  total ${Math.round(d.total)} / ${target} kcal  [${side}]`);
    names.forEach((n) => console.log(`   ${n}`));
  }

  line();
  if (!issues.length) {
    console.log('Audit: no rule violations in any meal.');
  } else {
    console.log(`Audit: ${issues.length} meal(s) flagged  (HARD = unsafe/excluded, soft = wrong for routine)`);
    issues.forEach((i) => {
      console.log(` - day ${i.index + 1} ${i.slot} "${i.meal?.name}"`);
      i.hard.forEach((r) => console.log(`     HARD: ${r}`));
      i.soft.forEach((r) => console.log(`     soft: ${r}`));
    });
  }
  line('=');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
