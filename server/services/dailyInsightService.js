// Nightly generation of the user's four daily insights — one overall insight
// plus focused sleep, nutrition, and fitness insights from the same day.
//
// Timing: the cron fires at 23:59 IST on day D, so both insights are already
// written and waiting when the user opens the app on D+1. Each row is therefore
// stamped sourceDate = D, insightDate = D+1, and the copy speaks in that voice:
// "yesterday you did X — today, try Y."
//
// Cost: runs on OpenRouter's free model chain only (see openrouterAI.FREE_MODELS).
// Those tiers rate-limit aggressively, hence the small batch size and the
// fall-through chain rather than a single model.

const DailyInsight = require('../models/DailyInsight');
const User = require('../models/User');
const NutritionSummary = require('../models/NutritionSummary');
const DailyHealthScore = require('../models/DailyHealthScore');
const DailyProgress = require('../models/DailyProgress');
const WearableData = require('../models/WearableData');
const HealthMetric = require('../models/HealthMetric');
const FoodLog = require('../models/FoodLog');
const ExerciseLog = require('../models/ExerciseLog');
const { chatCompletionWithFallback, parseJsonResponse } = require('./openrouterAI');
const { getSleepClinicalAnalysis } = require('./sleepClinicalAnalysisService');

// Free tiers cap requests per minute, and each user costs 2 calls — keep the
// fan-out small and pause between batches rather than burning the quota in
// the first 30 seconds and failing everyone else.
const BATCH_SIZE = 5;
const BATCH_PAUSE_MS = 1500;
const MAX_TOKENS = 700;

const IST_OFFSET = '+05:30'; // Asia/Kolkata has no DST — a fixed offset is safe here

// ---------------------------------------------------------------- date utils

/** 'YYYY-MM-DD' for the given instant in IST (defaults to now). */
const istDateKey = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);

/** Shifts a 'YYYY-MM-DD' key by n days, staying in IST. */
const shiftDateKey = (dateKey, days) => {
  const d = new Date(`${dateKey}T12:00:00.000${IST_OFFSET}`); // midday avoids any edge rounding
  d.setUTCDate(d.getUTCDate() + days);
  return istDateKey(d);
};

/** The UTC instants bounding an IST calendar day — for timestamp-based queries. */
const istDayWindow = (dateKey) => ({
  start: new Date(`${dateKey}T00:00:00.000${IST_OFFSET}`),
  end: new Date(`${dateKey}T23:59:59.999${IST_OFFSET}`),
});

// NutritionSummary and DailyHealthScore key their day by UTC midnight
// ('YYYY-MM-DD' UTC), a convention set by the dashboard long before this
// service existed. We look them up with the IST key, which agrees with UTC
// for everything logged between 05:30 IST and midnight — i.e. all normal
// waking hours. Only a 00:00–05:30 IST log lands on the previous UTC key.
const utcMidnight = (dateKey) => new Date(`${dateKey}T00:00:00.000Z`);

const findDailyEntry = (wearables, arrayField, dateKey) => {
  for (const w of wearables) {
    const match = (w[arrayField] || []).find(
      (entry) => entry.date && istDateKey(new Date(entry.date)) === dateKey
    );
    if (match) return match;
  }
  return null;
};

// ------------------------------------------------------------ data gathering

/**
 * Everything the overall insight is allowed to talk about, for one user/day.
 * Returns null when the user logged nothing at all — we skip those users rather
 * than have a model invent a day that didn't happen.
 */
async function collectOverallData(userId, dateKey) {
  const { start, end } = istDayWindow(dateKey);

  const [nutrition, score, progress, wearables, metrics, foodLogs, user, exerciseLogs] = await Promise.all([
    NutritionSummary.findOne({ userId, date: utcMidnight(dateKey) }).lean(),
    DailyHealthScore.findOne({ userId, date: dateKey }).lean(),
    DailyProgress.findOne({ userId, date: dateKey }).lean(),
    WearableData.find({ user: userId }).select('dailyMetrics sleepData').lean(),
    HealthMetric.find({ userId, recordedAt: { $gte: start, $lte: end } })
      .select('type value unit readingContext systolic diastolic').lean(),
    FoodLog.find({ userId, timestamp: { $gte: start, $lte: end } })
      .select('mealType healthScore10 foodItems.name').lean(),
    User.findById(userId).select('smokeLog alcoholLog').lean(),
    ExerciseLog.find({ userId, timestamp: { $gte: start, $lte: end } })
      .select('activityType duration avgHeartRate maxHeartRate caloriesBurned distance').lean(),
  ]);

  const steps = findDailyEntry(wearables, 'dailyMetrics', dateKey);
  const sleep = findDailyEntry(wearables, 'sleepData', dateKey);
  const smoke = user?.smokeLog?.[dateKey] || null;
  const alcohol = user?.alcoholLog?.[dateKey] || null;

  const data = {
    date: dateKey,
    healthScore: score?.finalScore ?? null,
    scoreComponents: score?.components || null,
    meals: foodLogs.map((f) => ({
      type: f.mealType,
      items: (f.foodItems || []).map((i) => i.name).slice(0, 6),
      healthScore10: f.healthScore10 ?? null,
    })),
    workouts: exerciseLogs.map((e) => ({
      activityType: e.activityType,
      durationMin: e.duration,
      avgHeartRate: e.avgHeartRate ?? null,
      maxHeartRate: e.maxHeartRate ?? null,
      caloriesBurned: e.caloriesBurned ?? null,
      distanceKm: e.distance ?? null,
    })),
    calories: nutrition?.totalCalories ?? null,
    calorieGoal: nutrition?.calorieGoal ?? null,
    protein: nutrition?.totalProtein ?? null,
    proteinGoal: nutrition?.proteinGoal ?? null,
    healthyFoodsCount: nutrition?.healthyFoodsCount ?? null,
    junkFoodsCount: nutrition?.junkFoodsCount ?? null,
    waterGlasses: nutrition?.waterIntake ?? progress?.waterIntake ?? null,
    steps: steps?.steps ?? null,
    activeMinutes: steps?.activeMinutes ?? null,
    caloriesBurned: steps?.caloriesBurned ?? nutrition?.caloriesBurned ?? null,
    sleepHours: sleep?.totalSleepMinutes ? Math.round((sleep.totalSleepMinutes / 60) * 10) / 10 : null,
    sleepScore: sleep?.sleepScore ?? null,
    vitals: metrics.map((m) => ({
      type: m.type,
      value: m.type === 'blood_pressure' ? `${m.systolic}/${m.diastolic}` : m.value,
      unit: m.unit,
      context: m.readingContext || null,
    })),
    cigarettes: smoke?.count ?? null,
    cigarettesResisted: smoke?.resistedCount ?? null,
    alcoholUnits: alcohol?.units ?? null,
    completedTasks: progress?.completedTasks?.length || 0,
  };

  const hasSomething = data.meals.length > 0
    || data.steps || data.sleepHours || data.waterGlasses
    || data.vitals.length > 0 || data.healthScore != null || data.completedTasks > 0
    || data.workouts.length > 0;

  return hasSomething ? data : null;
}

const insightData = {
  overall: (data) => data,
  nutrition: (data) => ({
    date: data.date,
    meals: data.meals,
    calories: data.calories,
    calorieGoal: data.calorieGoal,
    protein: data.protein,
    proteinGoal: data.proteinGoal,
    healthyFoodsCount: data.healthyFoodsCount,
    junkFoodsCount: data.junkFoodsCount,
    waterGlasses: data.waterGlasses,
  }),
  fitness: (data) => ({
    date: data.date,
    workouts: data.workouts,
    steps: data.steps,
    activeMinutes: data.activeMinutes,
    caloriesBurned: data.caloriesBurned,
    completedTasks: data.completedTasks,
  }),
};

const hasInsightData = (type, data) => {
  if (type === 'nutrition') return data.meals.length > 0
    || data.calories != null || data.protein != null || data.waterGlasses != null;
  if (type === 'fitness') return data.workouts.length > 0
    || data.steps != null || data.activeMinutes != null || data.completedTasks > 0;
  return data != null;
};

// ------------------------------------------------------------------- prompts

const SHARED_RULES = `
Rules you must follow:
- Warm, positive, encouraging. Never scold, shame, or use alarming language.
- Speak directly to the user as "you". Reference YESTERDAY's actual numbers, then suggest ONE simple thing for TODAY.
- Only use facts present in the data. Never invent numbers, foods, or symptoms.
- Plain everyday language, no medical jargon, no emojis.
- Never diagnose, never name a disease as confirmed, never mention medicine names or dosages.
- Respond with ONLY this JSON, nothing else:
{"title": "", "description": "", "summary": ""}
- title: max 6 words, upbeat headline.
- description: 200-300 characters, written as 3-5 clear sentences — explain what the data says about yesterday and give one specific thing to try today. Stay within this character range.
- summary: one line, max 15 words, the single takeaway.`;

const SLEEP_SHARED_RULES = `
Rules you must follow:
- Warm, positive, encouraging. Never scold, shame, or use alarming language.
- Speak directly to the user as "you". Lead with lastNight's actual numbers, then use the
  trend/goal/regularity fields (when present) to explain WHY, and suggest ONE simple thing for TODAY.
- Only reference numbers and statuses present in the data below. Never invent a number, a trend, or a
  pattern that isn't explicitly in the data.
- If tier is "insufficient_data" or "raw_comparison", do NOT claim any trend, debt, or regularity pattern —
  explicitly acknowledge that there isn't enough history yet and encourage continued tracking instead.
- This is wellness guidance, not a medical diagnosis. Plain everyday language, no medical jargon, no emojis,
  never name a disease or mention medicine/dosages.
- Respond with ONLY this JSON, nothing else:
{"title": "", "description": "", "summary": ""}
- title: max 6 words, upbeat headline.
- description: 200-300 characters, written as 3-5 clear sentences. Stay within this character range.
- summary: one line, max 15 words, the single takeaway.`;

const INSIGHT_SYSTEMS = {
  overall: `You are a friendly health coach inside the take.health app. Write an overall daily insight from the user's logged health activity from yesterday.${SHARED_RULES}`,
  sleep: `You are a friendly sleep coach inside the take.health app, reasoning like a clinician would: you are given pre-computed sleep facts (last night's numbers, plus trend/goal/regularity context when enough history exists) and must turn them into a specific, connected insight rather than generic advice.${SLEEP_SHARED_RULES}`,
  nutrition: `You are a friendly nutrition coach inside the take.health app. Write a daily insight focused only on the user's food, nutrition, and hydration data from yesterday.${SHARED_RULES}`,
  fitness: `You are a friendly fitness coach inside the take.health app. Write a daily insight focused only on the user's exercise, movement, steps, and completed activity from yesterday.${SHARED_RULES}`,
};

const INSIGHT_LABELS = {
  overall: "Yesterday's overall health activity",
  sleep: "Sleep analysis (last night plus recent context)",
  nutrition: "Yesterday's nutrition and hydration data",
  fitness: "Yesterday's fitness and movement data",
};

const buildUserPrompt = (profile, label, data) => `User profile: ${JSON.stringify(profile)}
${label} for ${data.date} (yesterday, from the user's point of view today):
${JSON.stringify(data)}

Write today's insight.`;

// ---------------------------------------------------------------- generation

async function generateOne({ userId, profile, insightType, sourceDate, insightDate, data }) {
  const { text, model } = await chatCompletionWithFallback({
    system: INSIGHT_SYSTEMS[insightType],
    messages: [{
      role: 'user',
      content: buildUserPrompt(
        profile,
        INSIGHT_LABELS[insightType],
        data
      ),
    }],
    maxTokens: MAX_TOKENS,
    temperature: 0.7, // a little variety so consecutive days don't read identically
    feature: `daily_insight_${insightType}`,
    userId,
  });

  const parsed = parseJsonResponse(text);
  if (!parsed?.title || !parsed?.description || parsed.description.length < 200) {
    throw new Error('Model returned no usable title/description');
  }

  return DailyInsight.findOneAndUpdate(
    { userId, insightDate, insightType },
    {
      userId, insightDate, sourceDate, insightType,
      title: String(parsed.title).slice(0, 120),
      description: String(parsed.description).slice(0, 300),
      summary: String(parsed.summary || parsed.title).slice(0, 200),
      dataSnapshot: data,
      model,
      seen: false,
      seenAt: null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/**
 * Generates four independent insights for one user. Missing category data only
 * skips that category; it does not prevent the other insights from generating.
 */
async function generateForUser(userId, sourceDate, { force = false } = {}) {
  const insightDate = shiftDateKey(sourceDate, 1);

  const user = await User.findById(userId)
    .select('name profile.age profile.gender profile.goals profile.healthConditions profile.chronicConditions profile.activityLevel profile.lifestyle.sleepGoalHours nutritionGoal.goal')
    .lean();

  const profile = {
    name: user?.name?.split(' ')[0] || null,
    age: user?.profile?.age ?? null,
    gender: user?.profile?.gender ?? null,
    goals: user?.profile?.goals || [],
    conditions: [...(user?.profile?.healthConditions || []), ...(user?.profile?.chronicConditions || [])],
    activityLevel: user?.profile?.activityLevel ?? null,
    nutritionGoal: user?.nutritionGoal?.goal ?? null,
  };

  const result = {};

  const overallData = await collectOverallData(userId, sourceDate);

  for (const insightType of ['overall', 'sleep', 'nutrition', 'fitness']) {
    try {
      if (!force) {
        const existing = await DailyInsight.exists({ userId, insightDate, insightType });
        if (existing) { result[insightType] = 'already_exists'; continue; }
      }

      let data;
      if (insightType === 'sleep') {
        const sleepGoalHours = user?.profile?.lifestyle?.sleepGoalHours || 8;
        const analysis = await getSleepClinicalAnalysis(userId, { age: profile.age, sleepGoalHours });
        data = analysis.lastNight ? { date: sourceDate, ...analysis } : null;
      } else {
        data = overallData && insightData[insightType](overallData);
      }

      if (!data || (insightType !== 'sleep' && !hasInsightData(insightType, overallData))) {
        result[insightType] = 'skipped_no_data';
        continue;
      }

      await generateOne({ userId, profile, insightType, sourceDate, insightDate, data });
      result[insightType] = 'generated';
    } catch (err) {
      console.error(`[DailyInsight] ${insightType} failed for user ${userId}:`, err.message);
      result[insightType] = `failed: ${err.message}`;
    }
  }

  return result;
}

/**
 * The nightly sweep. Defaults to "today in IST" as the source date, which is
 * correct when invoked by the 23:59 IST cron; pass an explicit key to backfill.
 */
async function runDailyInsightCron(sourceDate = istDateKey(), { force = false } = {}) {
  const insightDate = shiftDateKey(sourceDate, 1);
  console.log(`💡 [DailyInsight] Generating insights from ${sourceDate} for display on ${insightDate}...`);

  const users = await User.find({ isActive: true, role: { $ne: 'doctor' } }).select('_id').lean();
  const stats = { users: users.length, generated: 0, skipped: 0, failed: 0 };

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((u) => generateForUser(u._id, sourceDate, { force }))
    );

    results.forEach((r) => {
      if (r.status !== 'fulfilled') { stats.failed += 4; return; }
      Object.values(r.value).forEach((outcome) => {
        if (outcome === 'generated') stats.generated++;
        else if (outcome.startsWith('failed')) stats.failed++;
        else stats.skipped++;
      }); 
    });

    if (i + BATCH_SIZE < users.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS));
    }
  }

  console.log(`💡 [DailyInsight] Done — ${stats.generated} generated, ${stats.skipped} skipped, ${stats.failed} failed across ${stats.users} users.`);
  return stats;
}

module.exports = {
  runDailyInsightCron,
  generateForUser,
  collectOverallData,
  istDateKey,
  shiftDateKey,
};
