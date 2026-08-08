const HealthScoreConfig = require('../models/HealthScoreConfig');
const UserMetricBaseline = require('../models/UserMetricBaseline');
const DailyHealthScore = require('../models/DailyHealthScore');
const NutritionSummary = require('../models/NutritionSummary');
const WearableData = require('../models/WearableData');
const User = require('../models/User');
const { gaussian, plateauRange, saturatingToGoal, scoreSmoking, scoreAlcohol, updateRunningBaseline, blendedBaseline } = require('./healthScoreFormulas');
const { toPlainAlcoholLog } = require('../utils/alcoholLog');

// Sleep genuinely varies person-to-person (real physiological variation), so
// it uses the population-to-personal baseline blend below. Steps and
// hydration are different: this app already shows the user a single fixed
// goal for both elsewhere (Nutrition.jsx target: 8 glasses, Dashboard
// goals.steps: 10000) — using a *self-learning* baseline for those would let
// the score quietly adapt to match the user's actual (possibly poor) habit
// and reward it with 100, instead of measuring against the goal they
// actually see in the app. Fixed goals here, matching those exactly.
const POPULATION_NORMS = { sleepHours: 7.5 };
const FIXED_GOALS = { steps: 10000, waterGlasses: 8 };

const getActiveConfig = () => HealthScoreConfig.findOne({ isActive: true }).lean();

// Reads (and lazily creates) the user's per-metric running baseline doc,
// updates the given metric with today's value, and returns the personalized
// (population-blended) target for that metric.
//
// IMPORTANT: calculateDailyScore can be triggered many times in one day
// (a meal log, a water log, a sleep log all fire independent recomputes),
// and each recompute re-reads today's already-logged value for every
// metric — not just the one that changed. Without a same-day guard, the
// SAME day's value gets folded into the running baseline once per trigger
// instead of once per day, artificially inflating `n` and yanking the
// personal baseline toward that value far faster than real usage warrants
// (e.g. hydration jumping from a 26 to a 98 score with zero new water
// logged, purely from unrelated same-day triggers re-running this).
// Guard: only fold a metric into the baseline once per calendar date.
async function updateAndBlend(userId, metricKey, todayValue, populationNorm, tau, dateStr) {
  let doc = await UserMetricBaseline.findOne({ userId });
  if (!doc) doc = new UserMetricBaseline({ userId, metrics: {} });

  const existing = doc.metrics.get(metricKey);
  const alreadyUpdatedToday = existing?.lastUpdated
    && new Date(existing.lastUpdated).toISOString().split('T')[0] === dateStr;

  if (!alreadyUpdatedToday) {
    const updated = updateRunningBaseline(existing, todayValue);
    doc.metrics.set(metricKey, updated);
    await doc.save();
    return blendedBaseline(updated, populationNorm, tau);
  }

  return blendedBaseline(existing, populationNorm, tau);
}

async function calculateDailyScore(userId, dateStr) {
  const config = await getActiveConfig();
  if (!config) throw new Error('No active HealthScoreConfig found — run the seed script first');

  const dayStart = new Date(`${dateStr}T00:00:00.000Z`);

  // Fallbacks so an older config version (one predating these fields) that
  // gets reactivated degrades to the previous behaviour instead of throwing
  // or producing NaN part-way through the score.
  const sleepBounds = config.sleepTargetBounds || { min: 0, max: Infinity };
  const nw = config.nutritionWeights || { logging: 0.6, quality: 0.4, calories: 0 };

  const [nutritionSummary, wearables, user] = await Promise.all([
    NutritionSummary.findOne({ userId, date: dayStart }).lean(),
    WearableData.find({ user: userId }).lean(),
    User.findById(userId)
      .select('smokeLog alcoholLog profile.gender profile.chronicConditions profile.lifestyle nutritionGoal.calorieGoal')
      .lean(),
  ]);

  const components = {};
  // Raw inputs behind each component — not part of the scoring math, just
  // surfaced back to the API/app so the UI (and support/debugging) can show
  // "8000 steps" next to "activity: 87" instead of the number alone.
  const raw = {};

  // --- Sleep ---
  const sleepEntry = findDailyEntry(wearables, 'sleepData', dateStr);
  if (sleepEntry?.totalSleepMinutes) {
    const hours = sleepEntry.totalSleepMinutes / 60;
    raw.sleepHours = Math.round(hours * 10) / 10;
    const blended = await updateAndBlend(userId, 'sleepHours', hours, POPULATION_NORMS.sleepHours, config.personalBaselineTau.sleep, dateStr);
    // Clamp the personalised target into the clinically endorsed range.
    // Unbounded, someone habitually sleeping 5 hours drifts their own target
    // down to 5 (tau is 10 nights, so it's ~95% personal within a month) and
    // then scores ~100 for chronic sleep deprivation. Personalising within a
    // healthy range is useful; personalising all the way to a harmful habit
    // just tells the user their deprivation is fine.
    // Sleep guidance is a range (7–9 hours for adults), not a point, so every
    // duration inside it scores 100 and the falloff starts at the edges. The
    // personal baseline still matters: it decides WHERE inside that band this
    // user's ideal sits, which is what's reported back as their target.
    const target = Math.min(sleepBounds.max, Math.max(sleepBounds.min, blended));
    raw.sleepTargetHours = Math.round(target * 10) / 10;
    raw.sleepHealthyRange = [sleepBounds.min, sleepBounds.max];
    // Width 2 (not 1.5) outside the band: at 1.5 the curve was punishing —
    // 5 hours scored 19, reading as "you did nothing" for a night that was
    // short but not catastrophic.
    components.sleep = plateauRange(hours, sleepBounds.min, sleepBounds.max, 2);
  }

  // --- Activity (steps) — scored against the app's fixed step goal, not a
  // self-learning baseline (see FIXED_GOALS comment above).
  //
  // Same "hit the goal, then plateau" curve as hydration. A plain sigmoid was
  // wrong in both directions here: hitting the 10,000-step goal the app shows
  // scored only 84 (you needed ~20,000 to approach 100, so the goal the user
  // was given didn't line up with the score they got), while 0 steps still
  // paid out 16 points for not walking at all. ---
  // Goals are always the FULL day's goal, including for a day still in
  // progress. An earlier version pro-rated them by how much of the day had
  // elapsed, to avoid showing a demoralising "5/100" at 6am. That created a
  // worse problem: the score could fall without the user doing anything wrong.
  // 3,000 steps against a pro-rated 1,500 goal scored 100 at 9am, and the same
  // 3,000 steps scored 26 by midnight — the number promised something in the
  // morning and took it back at night, which is exactly how a score stops being
  // believed.
  //
  // Against the full goal the score is monotonic: it only ever climbs as the
  // user does more, and never claims a goal was met when it wasn't. The morning
  // problem is a presentation one, not a maths one — `isFinalScoreForToday` and
  // `dayProgressPercent` let the client label an in-progress day as "so far"
  // instead of a verdict.
  const isToday = dateStr === new Date().toISOString().split('T')[0];
  const dayProgress = isToday
    ? Math.min(1, (Date.now() - dayStart.getTime()) / 86400000)
    : 1;

  // Conditions drive two safety exclusions below (fluid restriction, mobility).
  const conditions = (user?.profile?.chronicConditions || []).map((c) => String(c).toLowerCase());

  // Activity blends step count with active minutes where the device reports
  // them. Steps alone can't distinguish a brisk walk from shuffling around the
  // house, and it's intensity that carries most of the cardiovascular benefit
  // (WHO: 150–300 moderate minutes a week).
  //
  // For users with a mobility-limiting condition the step half is dropped
  // entirely — counting steps there scores their disability, not their effort.
  // Same principle as hydration for fluid-restricted users.
  const mobilityLimited = conditions.some((c) =>
    (config.mobilityLimitedConditions || []).some((mc) => c.includes(mc)),
  );
  const activityCfg = config.activity || { activeMinutesGoal: 30, stepsShare: 0.6 };

  const stepsEntry = findDailyEntry(wearables, 'dailyMetrics', dateStr);
  if (stepsEntry) {
    const parts = [];

    if (stepsEntry.steps && !mobilityLimited) {
      raw.steps = stepsEntry.steps;
      raw.stepsGoal = FIXED_GOALS.steps;
      parts.push({ weight: activityCfg.stepsShare, score: saturatingToGoal(stepsEntry.steps, FIXED_GOALS.steps) });
    }

    if (stepsEntry.activeMinutes) {
      raw.activeMinutes = stepsEntry.activeMinutes;
      raw.activeMinutesGoal = activityCfg.activeMinutesGoal;
      parts.push({ weight: 1 - activityCfg.stepsShare, score: saturatingToGoal(stepsEntry.activeMinutes, activityCfg.activeMinutesGoal) });
    }

    if (parts.length > 0) {
      const total = parts.reduce((s, p) => s + p.weight, 0);
      components.activity = parts.reduce((s, p) => s + p.score * (p.weight / total), 0);
    }
  }

  // --- Hydration — scored against the app's fixed water goal (glasses, not
  // ml — the NutritionSummary field is mislabeled, not the data).
  //
  // Skipped entirely for users whose conditions normally come with a fluid
  // RESTRICTION (heart failure, CKD/dialysis, cirrhosis, hyponatremia).
  // Scoring them against an 8-glass target would penalise them for following
  // their doctor's instructions, and nudge them toward genuinely unsafe
  // intake. This is the one component that can cause harm rather than just
  // report a wrong number, so it is dropped rather than softened. ---
  const fluidRestricted = conditions.some((c) =>
    (config.fluidRestrictedConditions || []).some((f) => c.includes(f)),
  );

  if (!fluidRestricted && nutritionSummary && nutritionSummary.waterIntake > 0) {
    raw.waterGlasses = nutritionSummary.waterIntake;
    raw.waterGoalGlasses = FIXED_GOALS.waterGlasses;
    components.hydration = saturatingToGoal(nutritionSummary.waterIntake, FIXED_GOALS.waterGlasses);
  }

  // --- Nutrition ---
  // Logging used to be 60% of this score and quality only 40%, which meant
  // three junk meals (60 + 0) scored the same as one genuinely healthy meal
  // (20 + 40). That measures app compliance, not diet. Quality now leads.
  //
  // Calories are also scored rather than merely reported: the old formula
  // ignored quantity entirely, so 5,000 kcal of "healthy" food scored 100.
  // Both under- and over-eating count against it, hence the bell curve, with
  // a width of 20% of the user's goal.
  if (nutritionSummary && nutritionSummary.totalFoodsCount > 0) {
    const mealsLogged = ['breakfast', 'lunch', 'dinner'].filter((m) => nutritionSummary.mealsLogged?.[m]).length;
    const loggingCompleteness = mealsLogged / 3;
    // Quality comes from `averageHealthScore` — the calorie-weighted average of
    // the analyser's own 0-100 rating for each meal.
    //
    // It used to be healthyFoodsCount / totalFoodsCount, which was wrong twice
    // over. Those counters increment once per MEAL, not per food item (see
    // nutritionController.updateDailySummary), so the "share of foods rated
    // healthy" this claimed to measure was never that. And healthyFoodsCount
    // only counts meals scoring 7/10 or better, so it collapsed a continuous
    // rating into a pass/fail: a day of 6.9-out-of-10 meals scored 0% quality
    // while 7.0 scored 100%, and the real number sitting right beside it in the
    // same document was thrown away. Falls back to the old ratio if an older
    // summary has no averageHealthScore.
    const mealQuality = typeof nutritionSummary.averageHealthScore === 'number' && nutritionSummary.averageHealthScore > 0
      ? Math.min(1, nutritionSummary.averageHealthScore / 100)
      : Math.min(1, (nutritionSummary.healthyFoodsCount || 0) / nutritionSummary.totalFoodsCount);

    raw.mealsLogged = mealsLogged;
    raw.mealsGoal = 3;
    raw.dietQuality = Math.round(mealQuality * 100); // average quality rating of today's meals, 0-100
    raw.mealsRated = nutritionSummary.totalFoodsCount; // meals that carried a rating
    raw.calories = nutritionSummary.totalCalories;

    const calorieGoal = user?.nutritionGoal?.calorieGoal;
    if (calorieGoal > 0 && nutritionSummary.totalCalories > 0) {
      raw.calorieGoal = calorieGoal;
      const calorieAdherence = gaussian(nutritionSummary.totalCalories, calorieGoal, calorieGoal * 0.2) / 100;
      components.nutrition = 100 * (
        nw.logging * loggingCompleteness + nw.quality * mealQuality + nw.calories * calorieAdherence
      );
    } else {
      // No calorie goal set (or nothing with calories logged) — rescale the
      // remaining two the same way missing components are handled elsewhere.
      const available = nw.logging + nw.quality;
      components.nutrition = 100 * (
        (nw.logging / available) * loggingCompleteness + (nw.quality / available) * mealQuality
      );
    }
  }

  // --- Smoking and Alcohol (scored separately) ---
  // These were previously averaged into one "Clean Habits" component sharing a
  // single 15% weight — so smoking, the largest modifiable mortality risk
  // there is, effectively carried 7.5%, less than hydration. They're split so
  // each carries its own evidence-weighted share, and so a user who drinks but
  // doesn't smoke isn't scored as though they half-smoke.
  //
  // Scored ONLY when the user actually logged a cigarette or a drink that day.
  //
  // "0 cigarettes, 0 drinks" scores 100, so counting this component for
  // everyone meant its 15% weight sat permanently at 100 for the (vast)
  // majority who never log either — a constant that inflated every daily
  // score and never moved, telling the user nothing. Worse, on a day where
  // it was the only component, the missing-data rescale handed it 100% of
  // the weight and a totally inactive day scored a perfect 100.
  //
  // Gated on an explicit log instead: non-users of both simply don't get the
  // component (its weight rescales across what they did log), while users who
  // track it get scored honestly on real behaviour — so smoking and drinking
  // still move the score, which for a health app they must.
  // Both logs are date-keyed maps. Normalising them the same way matters:
  // depending on how the document was loaded they arrive as a Mongoose Map, a
  // subdocument, or a plain object, and `key in map` silently returns false on
  // a Map — which would drop the component entirely.
  //
  // The counts are read from the requested date's own entry rather than from a
  // "today" summary. Reading a today-only summary meant every historical
  // recompute scored alcohol as 0 drinks — a free 100 on days the user had
  // actually logged drinking, which then fed the 30-day windows behind the
  // Overall Score.
  const smokeLog = toPlainAlcoholLog(user?.smokeLog);
  const alcoholLog = toPlainAlcoholLog(user?.alcoholLog);

  const smokeEntry = lookupTrackerEntry(smokeLog, dateStr);
  const alcoholEntry = lookupTrackerEntry(alcoholLog, dateStr);

  // Declared non-users are excluded rather than given a standing 100.
  // Smoking carries 20% of the Daily Score; handing that to someone who has
  // never smoked, every day, for tapping "0", inflates every score they ever
  // see and makes the number less able to move on anything they actually do.
  // It's a fixed trait for them, not a daily behaviour — so it sits out, and
  // its weight rescales onto the things they can change. A declared smoker
  // logging a genuine zero still earns the 100; that's a real daily win.
  const lifestyle = user?.profile?.lifestyle || {};

  if (smokeEntry && lifestyle.smoker !== false) {
    const cigarettes = Number(smokeEntry.count) || 0;
    raw.cigarettes = cigarettes;
    components.smoking = scoreSmoking(cigarettes);
  }

  if (alcoholEntry && lifestyle.alcohol !== false) {
    // Scored on standard units, not the number of entries. The guidelines are
    // written in standard drinks, and the tracker already converts serving
    // sizes into units — three large measures is `count: 3` but six units, and
    // scoring the count would read that as within a man's daily limit.
    const drinks = Number(alcoholEntry.count) || 0;
    const units = Number(alcoholEntry.units) || drinks;
    raw.drinks = drinks;
    raw.alcoholUnits = units;
    components.alcohol = scoreAlcohol(units, user?.profile?.gender);
  }

  // Consistency deliberately does NOT live in the Daily Score.
  //
  // It answers "how regularly does this person log?", which is a property of
  // their history, not of today. Including it here meant a day where the user
  // did almost nothing still inherited a high number from past behaviour — on
  // a day with 52 steps logged and nothing else, consistency contributed most
  // of the score. The Daily Score should reflect only what was actually done
  // today; regularity is scored once, in the Overall Score.

  // --- Weighted combine, rescaling for any missing components ---
  // Only components the active config actually assigns a weight to are
  // combined. Weights get renamed across config versions (substanceFree →
  // cleanHabits → smoking + alcohol), and a component with no matching weight
  // would otherwise contribute `undefined` and turn the whole score into NaN.
  const availableKeys = Object.keys(components).filter(
    (k) => typeof config.dailyWeights[k] === 'number',
  );
  const totalAvailableWeight = availableKeys.reduce((sum, k) => sum + config.dailyWeights[k], 0);

  let finalScore = 0;
  if (totalAvailableWeight > 0) {
    finalScore = availableKeys.reduce(
      (sum, k) => sum + components[k] * (config.dailyWeights[k] / totalAvailableWeight),
      0,
    );
  }

  // A day with nothing logged is not persisted. The engine runs whenever the
  // user merely opens the app, and storing a finalScore-0 row for those days
  // created a whole class of bugs — empty days dragging averages down, padding
  // the "based on N days" hint, and standing in as real history in the
  // consistency denominator. Every consumer had to remember to filter them
  // out; not writing them removes the need to remember.
  // Tells the caller whether this number is settled. A day still in progress
  // will keep climbing as the user logs more, so the client must present it as
  // "so far today" rather than as the day's verdict.
  const progressMeta = {
    isFinalScoreForToday: !isToday,
    dayProgressPercent: Math.round(dayProgress * 100),
  };

  if (availableKeys.length === 0) {
    await DailyHealthScore.deleteOne({ userId, date: dateStr }); // clears rows written before this rule
    return { userId, date: dateStr, finalScore: 0, components: {}, raw: {}, configVersion: config.version, ...progressMeta };
  }

  const saved = await DailyHealthScore.findOneAndUpdate(
    { userId, date: dateStr },
    { finalScore: Math.round(finalScore * 10) / 10, components, configVersion: config.version },
    { upsert: true, new: true },
  );

  // `raw` isn't persisted (it's cheaply re-derivable from source data every
  // call) — attached here only so callers needing it for a single request
  // don't have to duplicate this same NutritionSummary/WearableData reads.
  return Object.assign(saved.toObject(), { raw }, progressMeta);
}

// The smoke and alcohol trackers are the only date-keyed stores written by the
// CLIENT, using the device's local calendar day. Everything else in the app —
// nutrition summaries, wearable metrics, these scores — keys off UTC. For most
// of the day the two agree, but east of UTC they diverge after local midnight:
// at 02:00 IST a cigarette is filed under tomorrow's UTC date, so scoring
// "today" would miss it entirely and the component would silently vanish.
//
// Rather than change a convention half the codebase depends on, the lookup
// tolerates the one-day skew: exact key first, then the next day's key, and
// only when the requested day is the current UTC day. That bounds the fallback
// to exactly the window where the divergence is possible — a past date can
// never pull a later day's data, and a normal daytime log matches on the first
// try because both conventions produce the same key.
function lookupTrackerEntry(log, dateStr) {
  if (log[dateStr]) return log[dateStr];

  const utcToday = new Date().toISOString().split('T')[0];
  if (dateStr !== utcToday) return null;

  const nextDay = new Date(`${dateStr}T00:00:00.000Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return log[nextDay.toISOString().split('T')[0]] || null;
}

function findDailyEntry(wearables, arrayField, dateStr) {
  for (const w of wearables) {
    const match = (w[arrayField] || []).find((entry) => {
      const d = new Date(entry.date);
      return d.toISOString().split('T')[0] === dateStr;
    });
    if (match) return match;
  }
  return null;
}

module.exports = { calculateDailyScore };
