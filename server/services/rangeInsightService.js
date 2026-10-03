// Weekly/monthly insight generation — the counterpart to dailyInsightService.js
// for the Unified Health Score breakdown page's non-daily views. Unlike the
// daily path (one night/day of raw facts), this collects AGGREGATE facts
// across the whole window (averages, days logged, first-half vs second-half
// trend) so the model can describe a genuine pattern instead of restating a
// single day, which is what the breakdown page was doing before this file
// existed (every range reused dailyInsightService's single-day insight).
const SleepSession = require('../models/SleepSession');
const NutritionSummary = require('../models/NutritionSummary');
const RecoveryDailySummary = require('../models/RecoveryDailySummary');
const DailyActivityMetric = require('../models/DailyActivityMetric');
const ExerciseLog = require('../models/ExerciseLog');
const RangeInsight = require('../models/RangeInsight');
const { chatCompletionWithFallback, parseJsonResponse } = require('./openrouterAI');
const { toPlainAlcoholLog } = require('../utils/alcoholLog');

const MAX_TOKENS = 1600;

// ---------------------------------------------------------------- date utils

const dateKeysBetween = (startStr, endStr) => {
  const keys = [];
  const d = new Date(`${startStr}T00:00:00.000Z`);
  const end = new Date(`${endStr}T00:00:00.000Z`);
  while (d <= end) {
    keys.push(d.toISOString().split('T')[0]);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return keys;
};

const utcMidnight = (dateKey) => new Date(`${dateKey}T00:00:00.000Z`);

function average(nums) {
  const valid = nums.filter((n) => typeof n === 'number' && Number.isFinite(n));
  if (!valid.length) return null;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
}

// Simple, honest trend signal: average of the first half of the window vs
// the second half. Not a statistical regression - just enough for the model
// to say "improving" / "declining" / "steady" without inventing a number.
function trendDirection(orderedValues) {
  const valid = orderedValues.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (valid.length < 4) return 'not_enough_data';
  const mid = Math.floor(valid.length / 2);
  const firstHalf = average(valid.slice(0, mid));
  const secondHalf = average(valid.slice(mid));
  if (firstHalf == null || secondHalf == null) return 'not_enough_data';
  const delta = secondHalf - firstHalf;
  if (Math.abs(delta) < firstHalf * 0.05) return 'steady';
  return delta > 0 ? 'improving' : 'declining';
}

// ------------------------------------------------------------ data gathering

/** Aggregate sleep facts across the window, from SleepSession directly (not DailyHealthScore's 0-100 score). */
async function collectSleepRange(userId, startDate, endDate) {
  const sessions = await SleepSession.find({
    user: userId,
    date: { $gte: utcMidnight(startDate), $lte: utcMidnight(endDate) },
  }).select('date totalSleepMinutes awakeMinutes bedTime').sort({ date: 1 }).lean();

  if (!sessions.length) return null;

  const hoursSeries = sessions.map((s) => (s.totalSleepMinutes || 0) / 60);
  const efficiencySeries = sessions.map((s) => {
    const inBed = (s.totalSleepMinutes || 0) + (s.awakeMinutes || 0);
    return inBed > 0 ? (s.totalSleepMinutes / inBed) * 100 : null;
  }).filter((v) => v != null);

  return {
    nightsLogged: sessions.length,
    avgHours: average(hoursSeries),
    minHours: Math.round(Math.min(...hoursSeries) * 10) / 10,
    maxHours: Math.round(Math.max(...hoursSeries) * 10) / 10,
    avgEfficiencyPct: average(efficiencySeries),
    trend: trendDirection(hoursSeries),
  };
}

/** Aggregate activity facts from DailyActivityMetric + workout count from ExerciseLog. */
async function collectActivityRange(userId, startDate, endDate) {
  const [metrics, workoutCount] = await Promise.all([
    DailyActivityMetric.find({
      user: userId,
      date: { $gte: utcMidnight(startDate), $lte: utcMidnight(endDate) },
    }).select('date steps activeMinutes caloriesBurned').sort({ date: 1 }).lean(),
    ExerciseLog.countDocuments({
      userId,
      timestamp: { $gte: utcMidnight(startDate), $lte: new Date(`${endDate}T23:59:59.999Z`) },
    }),
  ]);

  if (!metrics.length && !workoutCount) return null;

  const stepsSeries = metrics.map((m) => m.steps || 0);
  const activeMinSeries = metrics.map((m) => m.activeMinutes || 0);

  return {
    daysLogged: metrics.length,
    avgSteps: average(stepsSeries),
    totalSteps: stepsSeries.reduce((s, v) => s + v, 0),
    avgActiveMinutes: average(activeMinSeries),
    workoutsLogged: workoutCount,
    trend: trendDirection(stepsSeries),
  };
}

/** Aggregate nutrition + hydration facts from NutritionSummary (both pulled from the same rows). */
async function collectNutritionRange(userId, startDate, endDate) {
  const rows = await NutritionSummary.find({
    userId,
    date: { $gte: utcMidnight(startDate), $lte: utcMidnight(endDate) },
  }).select('date totalCalories calorieGoal totalProtein proteinGoal healthyFoodsCount junkFoodsCount waterIntake').lean();

  if (!rows.length) return { nutrition: null, hydration: null };

  const daysWithFood = rows.filter((r) => (r.totalCalories || 0) > 0);
  const nutrition = daysWithFood.length ? {
    daysLogged: daysWithFood.length,
    avgCalories: average(daysWithFood.map((r) => r.totalCalories)),
    avgCalorieGoal: average(daysWithFood.map((r) => r.calorieGoal).filter(Boolean)),
    avgProtein: average(daysWithFood.map((r) => r.totalProtein)),
    totalHealthyFoods: daysWithFood.reduce((s, r) => s + (r.healthyFoodsCount || 0), 0),
    totalJunkFoods: daysWithFood.reduce((s, r) => s + (r.junkFoodsCount || 0), 0),
    trend: trendDirection(daysWithFood.map((r) => r.totalCalories)),
  } : null;

  const daysWithWater = rows.filter((r) => (r.waterIntake || 0) > 0);
  const hydration = daysWithWater.length ? {
    daysLogged: daysWithWater.length,
    avgGlasses: average(daysWithWater.map((r) => r.waterIntake)),
    trend: trendDirection(daysWithWater.map((r) => r.waterIntake)),
  } : null;

  return { nutrition, hydration };
}

/** Aggregate recovery physiology facts (HRV/RHR/RR) from RecoveryDailySummary. */
async function collectRecoveryRange(userId, startDate, endDate) {
  const rows = await RecoveryDailySummary.find({
    user: userId,
    date: { $gte: startDate, $lte: endDate },
    'metricDetails.physiology.score': { $ne: null },
  }).select('date recoveryScore band metricDetails.physiology metricDetails.hrv metricDetails.rhr').sort({ date: 1 }).lean();

  if (!rows.length) return null;

  const physioSeries = rows.map((r) => r.metricDetails.physiology.score);
  const hrvSeries = rows.map((r) => r.metricDetails?.hrv?.today).filter((v) => v != null);
  const rhrSeries = rows.map((r) => r.metricDetails?.rhr?.today).filter((v) => v != null);

  return {
    daysLogged: rows.length,
    avgPhysiologyScore: average(physioSeries),
    avgHrv: average(hrvSeries),
    avgRhr: average(rhrSeries),
    trend: trendDirection(physioSeries),
    mostCommonBand: mostFrequent(rows.map((r) => r.band?.label).filter(Boolean)),
  };
}

function mostFrequent(items) {
  if (!items.length) return null;
  const counts = {};
  items.forEach((i) => { counts[i] = (counts[i] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/** Smoking/alcohol aggregates from User.smokeLog/alcoholLog across the window. */
function collectSmokeAlcoholRange(user, startDate, endDate) {
  const dateKeys = dateKeysBetween(startDate, endDate);
  const smokeLog = toPlainAlcoholLog(user?.smokeLog);
  const alcoholLog = toPlainAlcoholLog(user?.alcoholLog);

  const smokeDays = dateKeys.map((k) => smokeLog[k]).filter(Boolean);
  const alcoholDays = dateKeys.map((k) => alcoholLog[k]).filter(Boolean);

  const smoking = smokeDays.length ? {
    daysLogged: smokeDays.length,
    totalCigarettes: smokeDays.reduce((s, d) => s + (Number(d.count) || 0), 0),
    smokeFreeDays: smokeDays.filter((d) => !d.count).length,
    totalResisted: smokeDays.reduce((s, d) => s + (Number(d.resistedCount) || 0), 0),
    trend: trendDirection(smokeDays.map((d) => Number(d.count) || 0)),
  } : null;

  const alcohol = alcoholDays.length ? {
    daysLogged: alcoholDays.length,
    totalUnits: Math.round(alcoholDays.reduce((s, d) => s + (Number(d.units) || 0), 0) * 10) / 10,
    soberDays: alcoholDays.filter((d) => !d.count).length,
    trend: trendDirection(alcoholDays.map((d) => Number(d.units) || 0)),
  } : null;

  return { smoking, alcohol };
}

/**
 * Collects every component's range-aggregate data in as few queries as
 * possible. Returns a map keyed by component name (sleep/activity/nutrition/
 * hydration/recovery/smoking/alcohol) -> aggregate object or null.
 */
async function collectRangeData(userId, startDate, endDate, user) {
  const [sleep, activity, { nutrition, hydration }, recovery] = await Promise.all([
    collectSleepRange(userId, startDate, endDate),
    collectActivityRange(userId, startDate, endDate),
    collectNutritionRange(userId, startDate, endDate),
    collectRecoveryRange(userId, startDate, endDate),
  ]);
  const { smoking, alcohol } = collectSmokeAlcoholRange(user, startDate, endDate);

  return { sleep, activity, nutrition, hydration, recovery, smoking, alcohol };
}

// ------------------------------------------------------------------- prompts

const RANGE_LABEL = { weekly: 'the past 7 days', monthly: 'the past 30 days' };

const SHARED_RANGE_RULES = `
Rules you must follow:
- Warm, positive, encouraging. Never scold, shame, or use alarming language.
- Speak directly to the user as "you". This is a SUMMARY of a multi-day period, not a single day -
  describe the overall pattern (average, trend, consistency), not one specific day's number.
- Only use facts present in the data. Never invent numbers, foods, or symptoms. If "trend" is
  "not_enough_data", do not claim any improving/declining pattern.
- Plain everyday language, no medical jargon, no emojis.
- Never diagnose, never name a disease as confirmed, never mention medicine names or dosages.
- Respond with ONLY this JSON, nothing else:
{"title": "", "description": "", "summary": ""}
- title: max 6 words, upbeat headline.
- description: 200-300 characters, 3-5 sentences summarizing the pattern across the period and one thing to try next.
- summary: one line, max 15 words, the single takeaway.`;

const RANGE_INSIGHT_SYSTEMS = {
  overall: (rangeLabel) => `You are a friendly health coach inside the take.health app. Summarize the user's overall health pattern over ${rangeLabel}, using their daily health score trend and component averages.${SHARED_RANGE_RULES}`,
  sleep: (rangeLabel) => `You are a friendly sleep coach inside the take.health app. Summarize the user's sleep pattern over ${rangeLabel} — average duration, efficiency, and whether it's trending up or down.${SHARED_RANGE_RULES}`,
  nutrition: (rangeLabel) => `You are a friendly nutrition coach inside the take.health app. Summarize the user's eating pattern over ${rangeLabel} — average calories/protein vs goal, healthy vs less-healthy food balance.${SHARED_RANGE_RULES}`,
  fitness: (rangeLabel) => `You are a friendly fitness coach inside the take.health app. Summarize the user's movement pattern over ${rangeLabel} — average steps, active minutes, workouts logged.${SHARED_RANGE_RULES}`,
  recovery: (rangeLabel) => `You are a friendly recovery coach inside the take.health app, reasoning like a sports-science clinician. Summarize the user's physiological recovery pattern over ${rangeLabel} from their HRV/resting-heart-rate physiology scores.${SHARED_RANGE_RULES}`,
  smoking: (rangeLabel) => `You are a friendly, non-judgmental health coach inside the take.health app. Summarize the user's smoking pattern over ${rangeLabel}, including smoke-free days. Frame reductions and smoke-free days as genuine wins; never shame a logged count.${SHARED_RANGE_RULES}`,
  alcohol: (rangeLabel) => `You are a friendly, non-judgmental health coach inside the take.health app. Summarize the user's alcohol pattern over ${rangeLabel}, including sober days. Frame low totals and sober days as genuine wins; never shame a logged count.${SHARED_RANGE_RULES}`,
  hydration: (rangeLabel) => `You are a friendly health coach inside the take.health app. Summarize the user's water intake pattern over ${rangeLabel} vs their daily goal.${SHARED_RANGE_RULES}`,
};

const buildRangeUserPrompt = (label, rangeLabel, startDate, endDate, data) =>
  `${label} from ${startDate} to ${endDate} (${rangeLabel}):
${JSON.stringify(data)}

Write the summary insight for this period.`;

// ---------------------------------------------------------------- generation

async function generateRangeInsight({ userId, insightType, range, startDate, endDate, data, scoreTrendSummary }) {
  const rangeLabel = RANGE_LABEL[range];
  const payload = insightType === 'overall' ? { ...data, scoreTrendSummary } : data;

  const { text, model } = await chatCompletionWithFallback({
    system: RANGE_INSIGHT_SYSTEMS[insightType](rangeLabel),
    messages: [{
      role: 'user',
      content: buildRangeUserPrompt(`${insightType} data`, rangeLabel, startDate, endDate, payload),
    }],
    maxTokens: MAX_TOKENS,
    temperature: 0.7,
    feature: `range_insight_${insightType}`,
    userId,
  });

  const parsed = parseJsonResponse(text);
  if (!parsed?.title || !parsed?.description || parsed.description.length < 100) {
    throw new Error('Model returned no usable title/description');
  }

  return RangeInsight.findOneAndUpdate(
    { userId, range, endDate, insightType },
    {
      userId, range, endDate, startDate, insightType,
      title: String(parsed.title).slice(0, 120),
      description: String(parsed.description).slice(0, 300),
      summary: String(parsed.summary || parsed.title).slice(0, 200),
      dataSnapshot: payload,
      model,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/**
 * Fetches (or generates + caches) the range insight for ONE component type.
 * Mirrors dailyInsightService.ensureInsight's contract: returns the cached
 * doc, generates on cache-miss, returns null (never throws) when there's
 * simply no data for this type/window.
 */
async function ensureRangeInsightForType(userId, insightType, range, startDate, endDate, { data, scoreTrendSummary, force = false } = {}) {
  if (!force) {
    const existing = await RangeInsight.findOne({ userId, range, endDate, insightType }).select('-dataSnapshot').lean();
    if (existing) return existing;
  }
  if (insightType !== 'overall' && !data) return null;

  const doc = await generateRangeInsight({ userId, insightType, range, startDate, endDate, data, scoreTrendSummary });
  return doc.toObject ? doc.toObject() : doc;
}

module.exports = {
  collectRangeData,
  ensureRangeInsightForType,
};
