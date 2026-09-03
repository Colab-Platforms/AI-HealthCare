// Nightly generation of the user's two daily insights — one from the day's
// activity (food, steps, sleep, water, vitals) and one from their medical
// reports read against that same day.
//
// Timing: the cron fires at 23:59 IST on day D, so both insights are already
// written and waiting when the user opens the app on D+1. The row is therefore
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
const HealthReport = require('../models/HealthReport');
const FoodLog = require('../models/FoodLog');
const ExerciseLog = require('../models/ExerciseLog');
const { chatCompletionWithFallback, parseJsonResponse } = require('./openrouterAI');

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
 * Everything the activity insight is allowed to talk about, for one user/day.
 * Returns null when the user logged nothing at all — we skip those users rather
 * than have a model invent a day that didn't happen.
 */
async function collectActivityData(userId, dateKey) {
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

/**
 * Medical context: the user's analysed reports plus any vitals logged that day
 * that those reports give meaning to. Returns null when the user has never
 * uploaded a report — there is nothing honest to say in that case.
 */
async function collectMedicalData(userId, dateKey) {
  const { start, end } = istDayWindow(dateKey);

  const [reports, todaysMetrics, recentMetrics] = await Promise.all([
    HealthReport.find({ user: userId, 'aiAnalysis.summary': { $exists: true, $ne: null } })
      .sort({ reportDate: -1, createdAt: -1 })
      .limit(3)
      .select('reportType category reportDate createdAt aiAnalysis.summary aiAnalysis.keyFindings aiAnalysis.riskFactors aiAnalysis.deficiencies aiAnalysis.healthScore')
      .lean(),
    HealthMetric.find({ userId, recordedAt: { $gte: start, $lte: end } })
      .select('type value unit readingContext systolic diastolic').lean(),
    HealthMetric.find({ userId, recordedAt: { $lt: start } })
      .sort({ recordedAt: -1 }).limit(10)
      .select('type value unit recordedAt').lean(),
  ]);

  if (!reports.length) return null;

  return {
    date: dateKey,
    reports: reports.map((r) => ({
      type: r.reportType,
      category: r.category,
      date: (r.reportDate || r.createdAt)?.toISOString().split('T')[0],
      uploadedYesterday: istDateKey(new Date(r.createdAt)) === dateKey,
      summary: r.aiAnalysis?.summary?.slice(0, 800) || null,
      keyFindings: (r.aiAnalysis?.keyFindings || []).slice(0, 6),
      riskFactors: (r.aiAnalysis?.riskFactors || []).slice(0, 5),
      deficiencies: (r.aiAnalysis?.deficiencies || []).slice(0, 5).map((d) => ({
        name: d.name, severity: d.severity, currentValue: d.currentValue, normalRange: d.normalRange,
      })),
      healthScore: r.aiAnalysis?.healthScore ?? null,
    })),
    vitalsLoggedYesterday: todaysMetrics.map((m) => ({
      type: m.type,
      value: m.type === 'blood_pressure' ? `${m.systolic}/${m.diastolic}` : m.value,
      unit: m.unit,
      context: m.readingContext || null,
    })),
    recentVitalHistory: recentMetrics.map((m) => ({
      type: m.type, value: m.value, unit: m.unit, on: m.recordedAt?.toISOString().split('T')[0],
    })),
  };
}

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
- description: 2-3 short sentences — what you did yesterday, and one specific thing to try today.
- summary: one line, max 15 words, the single takeaway.`;

const ACTIVITY_SYSTEM = `You are a friendly health coach inside the take.health app. You write one short daily insight from the user's logged activity of the previous day.${SHARED_RULES}`;

const MEDICAL_SYSTEM = `You are a friendly health guide inside the take.health app. You write one short daily insight connecting the user's medical report findings to what they can do today. You are not a doctor: for anything concerning, gently suggest discussing it with their doctor rather than giving medical instructions.${SHARED_RULES}`;

const buildUserPrompt = (profile, label, data) => `User profile: ${JSON.stringify(profile)}
${label} for ${data.date} (yesterday, from the user's point of view today):
${JSON.stringify(data)}

Write today's insight.`;

// ---------------------------------------------------------------- generation

async function generateOne({ userId, profile, insightType, sourceDate, insightDate, data }) {
  const isActivity = insightType === 'activity';

  const { text, model } = await chatCompletionWithFallback({
    system: isActivity ? ACTIVITY_SYSTEM : MEDICAL_SYSTEM,
    messages: [{
      role: 'user',
      content: buildUserPrompt(
        profile,
        isActivity ? "Yesterday's logged activity" : "Medical reports and vitals",
        data
      ),
    }],
    maxTokens: MAX_TOKENS,
    temperature: 0.7, // a little variety so consecutive days don't read identically
    feature: isActivity ? 'daily_insight_activity' : 'daily_insight_medical',
    userId,
  });

  const parsed = parseJsonResponse(text);
  if (!parsed?.title || !parsed?.description) {
    throw new Error('Model returned no usable title/description');
  }

  return DailyInsight.findOneAndUpdate(
    { userId, insightDate, insightType },
    {
      userId, insightDate, sourceDate, insightType,
      title: String(parsed.title).slice(0, 120),
      description: String(parsed.description).slice(0, 1200),
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
 * Generates both insights for one user. Each type is independent — a user with
 * no reports still gets their activity insight, and vice versa.
 * @returns {Promise<{activity: string, medical: string}>} per-type outcome
 */
async function generateForUser(userId, sourceDate, { force = false } = {}) {
  const insightDate = shiftDateKey(sourceDate, 1);

  const user = await User.findById(userId)
    .select('name profile.age profile.gender profile.goals profile.healthConditions profile.chronicConditions profile.activityLevel nutritionGoal.goal')
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

  for (const insightType of ['activity', 'medical_report']) {
    const key = insightType === 'activity' ? 'activity' : 'medical';
    try {
      if (!force) {
        const existing = await DailyInsight.exists({ userId, insightDate, insightType });
        if (existing) { result[key] = 'already_exists'; continue; }
      }

      const data = insightType === 'activity'
        ? await collectActivityData(userId, sourceDate)
        : await collectMedicalData(userId, sourceDate);

      if (!data) { result[key] = 'skipped_no_data'; continue; }

      await generateOne({ userId, profile, insightType, sourceDate, insightDate, data });
      result[key] = 'generated';
    } catch (err) {
      console.error(`[DailyInsight] ${insightType} failed for user ${userId}:`, err.message);
      result[key] = `failed: ${err.message}`;
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
      if (r.status !== 'fulfilled') { stats.failed += 2; return; }
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
  collectActivityData,
  collectMedicalData,
  istDateKey,
  shiftDateKey,
};
