const HealthScoreConfig = require('../models/HealthScoreConfig');
const UserMetricBaseline = require('../models/UserMetricBaseline');
const DailyHealthScore = require('../models/DailyHealthScore');
const NutritionSummary = require('../models/NutritionSummary');
const WearableData = require('../models/WearableData');
const User = require('../models/User');
const { sigmoidIncreasing, gaussian, updateRunningBaseline, blendedBaseline } = require('./healthScoreFormulas');
const { getAlcoholSummary } = require('../utils/alcoholLog');

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
  const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

  const [nutritionSummary, wearables, user] = await Promise.all([
    NutritionSummary.findOne({ userId, date: dayStart }).lean(),
    WearableData.find({ user: userId }).lean(),
    User.findById(userId).select('smokeLog alcoholLog').lean(),
  ]);

  const components = {};

  // --- Sleep ---
  const sleepEntry = findDailyEntry(wearables, 'sleepData', dateStr);
  if (sleepEntry?.totalSleepMinutes) {
    const hours = sleepEntry.totalSleepMinutes / 60;
    const target = await updateAndBlend(userId, 'sleepHours', hours, POPULATION_NORMS.sleepHours, config.personalBaselineTau.sleep, dateStr);
    components.sleep = gaussian(hours, target, 1.5);
  }

  // --- Activity (steps) — scored against the app's fixed step goal, not a
  // self-learning baseline (see FIXED_GOALS comment above) ---
  const stepsEntry = findDailyEntry(wearables, 'dailyMetrics', dateStr);
  if (stepsEntry?.steps) {
    components.activity = sigmoidIncreasing(stepsEntry.steps, FIXED_GOALS.steps / 2, 3000);
  }

  // --- Hydration — scored against the app's fixed water goal (glasses, not
  // ml — the NutritionSummary field is mislabeled, not the data) ---
  if (nutritionSummary && nutritionSummary.waterIntake > 0) {
    components.hydration = gaussian(nutritionSummary.waterIntake, FIXED_GOALS.waterGlasses, 2);
  }

  // --- Nutrition ---
  if (nutritionSummary && nutritionSummary.totalFoodsCount > 0) {
    const mealsLogged = ['breakfast', 'lunch', 'dinner'].filter((m) => nutritionSummary.mealsLogged?.[m]).length;
    const loggingCompleteness = mealsLogged / 3;
    const mealQuality = nutritionSummary.healthyFoodsCount / nutritionSummary.totalFoodsCount;
    components.nutrition = 100 * (0.6 * loggingCompleteness + 0.4 * mealQuality);
  }

  // --- Substance-Free Living (always computable — 0 logged = perfect score) ---
  // Only score Substance-Free Living if the user engaged with *something*
  // today (logged a cigarette/drink, or has at least one other component
  // already computed above). Otherwise "0 cigarettes, 0 drinks" defaults to
  // 100 for a day the user did nothing on, and — being the only available
  // component — the missing-data rescale would hand it 100% of the weight,
  // making a totally inactive day score a perfect 100. That's a free win,
  // not a signal.
  const todayKey = dateStr;
  const hasSmokeLog = todayKey in (user?.smokeLog || {});
  const alcoholSummary = getAlcoholSummary(user?.alcoholLog);
  const hasAlcoholLog = todayKey in (user?.alcoholLog instanceof Map ? Object.fromEntries(user.alcoholLog) : (user?.alcoholLog || {}));
  const cigsToday = user?.smokeLog?.[todayKey]?.count || 0;
  const drinksToday = dateStr === new Date().toISOString().split('T')[0] ? alcoholSummary.today : 0;

  if (hasSmokeLog || hasAlcoholLog || Object.keys(components).length > 0) {
    const smokeScore = cigsToday === 0 ? 100 : Math.max(0, 100 - cigsToday * 12);
    const alcoholScore = drinksToday === 0 ? 100 : Math.max(0, 100 - drinksToday * 15);
    components.substanceFree = 0.5 * smokeScore + 0.5 * alcoholScore;
  }

  // --- Consistency (needs a minimum trailing history to be meaningful) ---
  const trailingDays = await DailyHealthScore.find({
    userId,
    date: { $lt: dateStr },
  }).sort({ date: -1 }).limit(13).lean();

  if (trailingDays.length + 1 >= config.minHistoryDays.consistency) {
    const daysWithData = trailingDays.filter((d) => Object.keys(d.components || {}).length >= 3).length + 1; // +1 for today
    components.consistency = 100 * (daysWithData / (trailingDays.length + 1));
  }

  // --- Weighted combine, rescaling for any missing components ---
  const availableKeys = Object.keys(components);
  const totalAvailableWeight = availableKeys.reduce((sum, k) => sum + config.dailyWeights[k], 0);

  let finalScore = 0;
  if (totalAvailableWeight > 0) {
    finalScore = availableKeys.reduce(
      (sum, k) => sum + components[k] * (config.dailyWeights[k] / totalAvailableWeight),
      0,
    );
  }

  const saved = await DailyHealthScore.findOneAndUpdate(
    { userId, date: dateStr },
    { finalScore: Math.round(finalScore * 10) / 10, components, configVersion: config.version },
    { upsert: true, new: true },
  );

  return saved;
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
