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
const DailyActivityMetric = require('../models/DailyActivityMetric');
const SleepSession = require('../models/SleepSession');
const HealthMetric = require('../models/HealthMetric');
const FoodLog = require('../models/FoodLog');
const ExerciseLog = require('../models/ExerciseLog');
const RecoveryDailySummary = require('../models/RecoveryDailySummary');
const { chatCompletionWithFallback, parseJsonResponse } = require('./openrouterAI');
const { getSleepClinicalAnalysis } = require('./sleepClinicalAnalysisService');
const { mergeDeviceRows, maxAcrossRows, filterPlausibleSleep } = require('../utils/wearableMerge');

// Free tiers cap requests per minute, and each user costs 2 calls — keep the
// fan-out small and pause between batches rather than burning the quota in
// the first 30 seconds and failing everyone else.
const BATCH_SIZE = 5;
const BATCH_PAUSE_MS = 1500;
// Some free-tier models (e.g. nemotron-3-super-120b-a12b) narrate chain-of-thought
// straight into message.content instead of a separate reasoning field, ignoring
// reasoning.max_tokens:0 — so the budget has to cover that narration plus the JSON.
const MAX_TOKENS = 1600;

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

// ------------------------------------------------------------ data gathering

/**
 * Everything the overall insight is allowed to talk about, for one user/day.
 * Returns null when the user logged nothing at all — we skip those users rather
 * than have a model invent a day that didn't happen.
 */
async function collectOverallData(userId, dateKey) {
  const { start, end } = istDayWindow(dateKey);

  const [nutrition, score, progress, activityRows, sleepRows, metrics, foodLogs, user, exerciseLogs] = await Promise.all([
    NutritionSummary.findOne({ userId, date: utcMidnight(dateKey) }).lean(),
    DailyHealthScore.findOne({ userId, date: dateKey }).lean(),
    DailyProgress.findOne({ userId, date: dateKey }).lean(),
    // One row per connected device for this date — merged below by MAX, not
    // "whichever device happened to be first", same merge
    // dailyHealthScoreService.js uses. The old WearableData.dailyMetrics[]/
    // sleepData[] lookup here used to just grab the first device's entry,
    // which could be a stale/disconnected device's number instead of the
    // real one (confirmed live: a disconnected Apple Watch's 28 steps got
    // quoted in an insight instead of the actual day's 9534 from Google Fit).
    DailyActivityMetric.find({ user: userId, date: utcMidnight(dateKey) })
      .select('deviceType steps activeMinutes caloriesBurned').lean(),
    SleepSession.find({ user: userId, date: utcMidnight(dateKey) })
      .select('deviceType totalSleepMinutes sleepScore').lean(),
    HealthMetric.find({ userId, recordedAt: { $gte: start, $lte: end } })
      .select('type value unit readingContext systolic diastolic').lean(),
    FoodLog.find({ userId, timestamp: { $gte: start, $lte: end } })
      .select('mealType healthScore10 foodItems.name').lean(),
    User.findById(userId).select('smokeLog alcoholLog').lean(),
    ExerciseLog.find({ userId, timestamp: { $gte: start, $lte: end } })
      .select('activityType duration avgHeartRate maxHeartRate caloriesBurned distance').lean(),
  ]);

  // Real devices on the same date are summed (a clean mid-day switch); a
  // manual entry is maxed against the device total. See utils/wearableMerge.js.
  const steps = activityRows.length
    ? mergeDeviceRows(activityRows, ['steps', 'activeMinutes', 'caloriesBurned'])
    : null;
  // Always max for sleep, never sum — two devices for the same date measure
  // the SAME night, not two sequential sessions. See utils/wearableMerge.js.
  const sleepMerged = sleepRows.length
    ? maxAcrossRows(filterPlausibleSleep(sleepRows), ['totalSleepMinutes', 'sleepScore'])
    : null;
  const sleep = sleepMerged ? { ...sleepMerged, sleepScore: sleepMerged.sleepScore || null } : null;
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
  // smoking/alcohol/hydration all pull from the fields collectOverallData
  // already gathers (User.smokeLog/alcoholLog, NutritionSummary.waterIntake)
  // — no separate query needed.
  smoking: (data) => ({
    date: data.date,
    cigarettes: data.cigarettes,
    cigarettesResisted: data.cigarettesResisted,
  }),
  alcohol: (data) => ({
    date: data.date,
    alcoholUnits: data.alcoholUnits,
  }),
  hydration: (data) => ({
    date: data.date,
    waterGlasses: data.waterGlasses,
  }),
};

const hasInsightData = (type, data) => {
  if (type === 'nutrition') return data.meals.length > 0
    || data.calories != null || data.protein != null || data.waterGlasses != null;
  if (type === 'fitness') return data.workouts.length > 0
    || data.steps != null || data.activeMinutes != null || data.completedTasks > 0;
  if (type === 'smoking') return data.cigarettes != null;
  if (type === 'alcohol') return data.alcoholUnits != null;
  if (type === 'hydration') return data.waterGlasses != null;
  return data != null;
};

// Recovery pulls from RecoveryDailySummary, not the shared overallData
// collector — separate query, mirroring how sleep already has its own
// dedicated collector (getSleepClinicalAnalysis) rather than reusing
// collectOverallData. Only the physiology sub-scores are exposed here
// (matching what components.recovery in the Unified Health Score uses;
// Sleep/Activity contributions are deliberately excluded to avoid the insight
// text overlapping with the separately-generated sleep/fitness insights).
async function collectRecoveryData(userId, dateKey) {
  const doc = await RecoveryDailySummary.findOne({ user: userId, date: dateKey }).lean();
  if (!doc || doc.recoveryScore == null) return null;

  const hrv = doc.metricDetails?.hrv;
  const rhr = doc.metricDetails?.rhr;
  const rr = doc.metricDetails?.rr;

  return {
    date: dateKey,
    recoveryBand: doc.band?.label ?? null,
    physiologyScore: doc.metricDetails?.physiology?.score ?? null,
    hrvToday: hrv?.today ?? null,
    hrvBaseline14: hrv?.baseline14 ?? null,
    rhrToday: rhr?.today ?? null,
    rhrBaseline14: rhr?.baseline14 ?? null,
    respiratoryRateToday: rr?.today ?? null,
    confidence: doc.confidence ?? null,
    warnings: (doc.warnings || []).map((w) => w.message),
  };
}

// ------------------------------------------------------------------- prompts

// Wording is deliberately date-anchored ("On {date}") rather than "yesterday" —
// this same insight object is read in two different contexts: the home
// screen's next-morning card (where "on {date}" still reads naturally, one
// day back) AND the Unified Health Score breakdown page's weekly/monthly
// trend (where a day could be up to ~30 days back, and "yesterday" would be
// flatly wrong). One wording serves both without needing two insight variants.
const SHARED_RULES = `
Rules you must follow:
- Warm, positive, encouraging. Never scold, shame, or use alarming language.
- NEVER use the words "today" or "yesterday" — this exact text can be shown to the user a day or
  weeks after the date it describes, so "today"/"yesterday" would be factually wrong by the time they
  read it. Speak directly to the user as "you" and describe what happened without a day-word (e.g.
  "You logged 16,460 steps, well above your usual." not "You logged 16,460 steps today.").
- Short: the description must be MAX 2-3 sentences. Not 4, not 5 — cut anything extra.
- Personalized: ground it in THIS user's actual number for the date given, compared against their own
  recent average/baseline/goal when that comparison is present in the data — not a generic statement that
  could apply to any user.
- Meaningful: state the one specific thing the data actually shows, not a vague platitude. If nothing
  notable stands out in the data, say the plain specific fact (the number itself) rather than padding with
  generic encouragement.
- Actionable: end with exactly ONE concrete, specific next step that follows from this data point — never a
  generic "keep it up" unless the data genuinely supports no change being needed.
- Only use facts present in the data. Never invent numbers, foods, or symptoms.
- Plain everyday language, no medical jargon, no emojis.
- Never diagnose, never name a disease as confirmed, never mention medicine names or dosages.
- Respond with ONLY this JSON, nothing else:
{"title": "", "description": "", "summary": ""}
- title: max 6 words, upbeat headline.
- description: 2-3 sentences, 120-220 characters. State the specific number/comparison, then the one action.
- summary: one line, max 12 words, the single takeaway.`;

const SLEEP_SHARED_RULES = `
Rules you must follow:
- Warm, positive, encouraging. Never scold, shame, or use alarming language.
- NEVER use the words "today" or "yesterday" — this exact text can be shown to the user a day or
  weeks after the date it describes, so "today"/"yesterday" would be factually wrong by the time they
  read it. Describe the night without a day-word (e.g. "You slept 8 hours, right in your ideal range."
  not "You slept 8 hours last night.").
- Short: the description must be MAX 2-3 sentences. Not 4, not 5 — cut anything extra.
- Personalized: lead with that night's actual number, then compare it against the user's OWN
  trend/goal/regularity fields when present in the data — not a generic statement.
- Meaningful: state the one specific thing the data shows (the number, and how it compares to their own
  pattern), not a vague platitude.
- Actionable: end with exactly ONE concrete, specific next step that follows from this data point.
- Only reference numbers and statuses present in the data below. Never invent a number, a trend, or a
  pattern that isn't explicitly in the data.
- If tier is "insufficient_data" or "raw_comparison", do NOT claim any trend, debt, or regularity pattern —
  explicitly acknowledge that there isn't enough history yet and encourage continued tracking instead.
- This is wellness guidance, not a medical diagnosis. Plain everyday language, no medical jargon, no emojis,
  never name a disease or mention medicine/dosages.
- Respond with ONLY this JSON, nothing else:
{"title": "", "description": "", "summary": ""}
- title: max 6 words, upbeat headline.
- description: 2-3 sentences, 120-220 characters. State the specific number/comparison, then the one action.
- summary: one line, max 12 words, the single takeaway.`;

const INSIGHT_SYSTEMS = {
  overall: `You are a friendly health coach inside the take.health app. Write an overall daily insight from the user's logged health activity for the given date, drawing on whichever of sleep, activity, nutrition, and recovery actually have data for that date — don't default to only one or two pillars when more are available.${SHARED_RULES}`,
  sleep: `You are a friendly sleep coach inside the take.health app, reasoning like a clinician would: you are given pre-computed sleep facts (that night's numbers, plus trend/goal/regularity context when enough history exists) and must turn them into a specific, connected insight rather than generic advice.${SLEEP_SHARED_RULES}`,
  nutrition: `You are a friendly nutrition coach inside the take.health app. Write a daily insight focused only on the user's food, nutrition, and hydration data for the given date.${SHARED_RULES}`,
  fitness: `You are a friendly fitness coach inside the take.health app. Write a daily insight focused only on the user's exercise, movement, steps, and completed activity for the given date.${SHARED_RULES}`,
  recovery: `You are a friendly recovery coach inside the take.health app, reasoning like a sports-science clinician: you are given that day's HRV, resting heart rate, and respiratory-rate readings (each as a T-score, 0-100, compared against the user's own personal baseline where available) and must explain what they mean for the user's physical readiness that day.${SHARED_RULES}`,
  smoking: `You are a friendly, non-judgmental health coach inside the take.health app. Write a daily insight focused only on the user's logged cigarette count (and cigarettes resisted, if present) for the given date. Frame any zero or reduced count as a genuine win; never shame a logged count.${SHARED_RULES}`,
  alcohol: `You are a friendly, non-judgmental health coach inside the take.health app. Write a daily insight focused only on the user's logged alcohol units for the given date. Frame any zero or moderate count as a genuine win; never shame a logged count.${SHARED_RULES}`,
  hydration: `You are a friendly health coach inside the take.health app. Write a daily insight focused only on the user's logged water intake for the given date, compared against their goal when known.${SHARED_RULES}`,
};

// Single source of truth for which types generateForUser loops over and how
// many a failed-user counts as in runDailyInsightCron's stats — was
// hardcoded as 4 in two places before recovery/smoking/alcohol/hydration
// were added, which silently under-counted failures once the list grew.
const INSIGHT_TYPES = ['overall', 'sleep', 'nutrition', 'fitness', 'recovery', 'smoking', 'alcohol', 'hydration'];

const INSIGHT_LABELS = {
  overall: "Overall sleep, activity, nutrition, and recovery for the given date",
  sleep: "Sleep analysis (that night plus recent context)",
  nutrition: "Nutrition and hydration data for the given date",
  fitness: "Fitness and movement data for the given date",
  recovery: "Recovery physiology data (HRV, resting heart rate, respiratory rate) for the given date",
  smoking: "Smoking log for the given date",
  alcohol: "Alcohol log for the given date",
  hydration: "Water intake for the given date",
};

const buildUserPrompt = (profile, label, data) => `User profile: ${JSON.stringify(profile)}
${label} for ${data.date}:
${JSON.stringify(data)}

Write the insight for this date.`;

// ---------------------------------------------------------------- generation

// Models overshoot the "120-220 characters" instruction, so a bare slice cuts
// mid-word. Cut to the limit, then back up to the last full sentence. If the
// only sentence end is too early (under minKeep), keep the hard cut rather
// than return a stub.
const trimToSentence = (text, max, minKeep = 80) => {
  const str = String(text).trim();
  if (str.length <= max) return str;
  const cut = str.slice(0, max);
  const lastEnd = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
  return lastEnd >= minKeep ? cut.slice(0, lastEnd + 1) : cut.trimEnd();
};

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
  if (!parsed?.title || !parsed?.description || parsed.description.length < 80) {
    throw new Error('Model returned no usable title/description');
  }

  return DailyInsight.findOneAndUpdate(
    { userId, insightDate, insightType },
    {
      userId, insightDate, sourceDate, insightType,
      title: String(parsed.title).slice(0, 120),
      description: trimToSentence(parsed.description, 220),
      summary: String(parsed.summary || parsed.title).slice(0, 200),
      dataSnapshot: data,
      model,
      seen: false,
      seenAt: null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

// Types with their OWN data source (not collectOverallData) — 'sleep' had
// this before 'recovery' was added. Each is fetched once, not gated on
// overallData existing, since a user can have wearable HRV/RHR data on a day
// they logged nothing else.
const OWN_SOURCE_TYPES = new Set(['sleep', 'recovery']);

async function buildProfile(userId) {
  const user = await User.findById(userId)
    .select('name profile.age profile.gender profile.goals profile.healthConditions profile.chronicConditions profile.activityLevel profile.lifestyle.sleepGoalHours nutritionGoal.goal')
    .lean();

  return {
    user,
    profile: {
      name: user?.name?.split(' ')[0] || null,
      age: user?.profile?.age ?? null,
      gender: user?.profile?.gender ?? null,
      goals: user?.profile?.goals || [],
      conditions: [...(user?.profile?.healthConditions || []), ...(user?.profile?.chronicConditions || [])],
      activityLevel: user?.profile?.activityLevel ?? null,
      nutritionGoal: user?.nutritionGoal?.goal ?? null,
    },
  };
}

/** Fetches (or null) the type-specific data payload a given insightType needs. */
async function collectDataForType(insightType, userId, sourceDate, { user, profile, overallData }) {
  if (insightType === 'sleep') {
    const sleepGoalHours = user?.profile?.lifestyle?.sleepGoalHours || 8;
    const analysis = await getSleepClinicalAnalysis(userId, { age: profile.age, sleepGoalHours });
    return analysis.lastNight ? { date: sourceDate, ...analysis } : null;
  }
  if (insightType === 'recovery') {
    return collectRecoveryData(userId, sourceDate);
  }
  if (insightType === 'overall') {
    // The only type that should speak to all four pillars (sleep, activity,
    // nutrition, recovery) in one summary — collectOverallData already has
    // sleep/activity/nutrition, but recovery (HRV/RHR/respiratory rate) has
    // its own dedicated collector (same one the standalone 'recovery' type
    // uses), fetched here too so 'overall' isn't silently missing it.
    if (!overallData) return null;
    const recovery = await collectRecoveryData(userId, sourceDate);
    return {
      ...overallData,
      recovery: recovery ? {
        recoveryScore: recovery.physiologyScore,
        recoveryBand: recovery.recoveryBand,
        hrvToday: recovery.hrvToday,
        hrvBaseline14: recovery.hrvBaseline14,
        rhrToday: recovery.rhrToday,
        rhrBaseline14: recovery.rhrBaseline14,
        respiratoryRateToday: recovery.respiratoryRateToday,
      } : null,
    };
  }
  return overallData && insightData[insightType](overallData);
}

/**
 * Generates all eight independent insight types for one user. Missing
 * category data only skips that category; it does not prevent the other
 * insights from generating.
 */
async function generateForUser(userId, sourceDate, { force = false } = {}) {
  const insightDate = shiftDateKey(sourceDate, 1);
  const { user, profile } = await buildProfile(userId);
  const overallData = await collectOverallData(userId, sourceDate);

  const result = {};

  for (const insightType of INSIGHT_TYPES) {
    try {
      if (!force) {
        const existing = await DailyInsight.exists({ userId, insightDate, insightType });
        if (existing) { result[insightType] = 'already_exists'; continue; }
      }

      const data = await collectDataForType(insightType, userId, sourceDate, { user, profile, overallData });
      const hasData = OWN_SOURCE_TYPES.has(insightType) ? data != null : hasInsightData(insightType, overallData);
      if (!data || !hasData) {
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
 * On-demand, single-type generation — used by the Unified Health Score
 * breakdown page when it asks for a day the nightly cron never covered (a
 * historical day from before this feature existed, or a day the cron failed
 * on). Returns the existing DailyInsight if one is already cached (or
 * `force` is off and one exists), otherwise generates just this one type
 * synchronously and returns it. Returns null (never throws) when there's
 * simply no data for this user/type/date — that's a normal, expected state,
 * not a failure.
 */
async function ensureInsight(userId, insightType, sourceDate, { force = false } = {}) {
  if (!INSIGHT_TYPES.includes(insightType)) {
    throw new Error(`Unknown insightType: ${insightType}`);
  }
  const insightDate = shiftDateKey(sourceDate, 1);

  if (!force) {
    const existing = await DailyInsight.findOne({ userId, insightDate, insightType }).select('-dataSnapshot').lean();
    if (existing) return existing;
  }

  const { user, profile } = await buildProfile(userId);
  const overallData = insightType === 'sleep' || insightType === 'recovery'
    ? null // these two never read overallData - skip the query entirely
    : await collectOverallData(userId, sourceDate);

  const data = await collectDataForType(insightType, userId, sourceDate, { user, profile, overallData });
  const hasData = OWN_SOURCE_TYPES.has(insightType) ? data != null : hasInsightData(insightType, overallData);
  if (!data || !hasData) return null;

  const doc = await generateOne({ userId, profile, insightType, sourceDate, insightDate, data });
  return doc.toObject ? doc.toObject() : doc;
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
      if (r.status !== 'fulfilled') { stats.failed += INSIGHT_TYPES.length; return; }
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
  ensureInsight,
  collectOverallData,
  INSIGHT_TYPES,
  istDateKey,
  shiftDateKey,
};
