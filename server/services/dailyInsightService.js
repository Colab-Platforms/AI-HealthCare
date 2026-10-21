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
const { calculateRecoveryScore } = require('./recoveryScoreService');
const { calculateDailyScore } = require('./dailyHealthScoreService');
const { getActiveScoreConfig } = require('../utils/scoreConfig');
const { chatCompletionWithFallback, parseJsonResponse } = require('./openrouterAI');
const { getSleepClinicalAnalysis } = require('./sleepClinicalAnalysisService');
const { getNativeSleepScoresByDate, resolveSleepQualityScore } = require('./sleepScoreService');
const { getActivityInsight } = require('./activityInsightService');
const { getExerciseGuidance } = require('./exerciseGuidanceService');
const { mergeDeviceRows, filterPlausibleSleep, collapseToOnePerDay } = require('../utils/wearableMerge');

// Free tiers cap requests per minute, and each user costs 2 calls — keep the
// fan-out small and pause between batches rather than burning the quota in
// the first 30 seconds and failing everyone else.
const BATCH_SIZE = 5;
const BATCH_PAUSE_MS = 1500;
// Some models (e.g. nemotron-3-super-120b-a12b, claude-haiku-4.5 on Bedrock) narrate
// chain-of-thought straight into message.content/reasoning instead of honoring
// reasoning.max_tokens:0 — so the budget has to cover that narration plus the JSON.
const MAX_TOKENS = 3000;

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

  // Computed live, same as collectRecoveryData now does — not a passive
  // DailyHealthScore.findOne(). That read-only version can be null or
  // missing components (calculateDailyScore deletes its own persisted row
  // whenever a given call finds zero available components, a transient
  // per-call state) even on a day with real data — confirmed live: this
  // insight once said "Sleep was strong at 100" while scoreComponents in
  // its own stored data snapshot was null, because the model had no real
  // number and invented one. Computing live here guarantees a real number
  // (or a real "not available"), never a gap for the model to fill in.
  const config = await getActiveScoreConfig();
  const liveScore = await calculateDailyScore(userId, dateKey, { config }).catch(() => null);

  const [nutrition, progress, activityRows, sleepRows, metrics, foodLogs, user, exerciseLogs] = await Promise.all([
    NutritionSummary.findOne({ userId, date: utcMidnight(dateKey) }).lean(),
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
      .select('date deviceType totalSleepMinutes sleepScore bedTime wakeTime').lean(),
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
  // the SAME night, not two sequential sessions. Collapsed to the whole
  // winning row (not just merged fields) so bedTime/wakeTime/deviceType
  // survive for the native-score lookup just below. See wearableMerge.js.
  const sleepWinner = sleepRows.length
    ? collapseToOnePerDay(filterPlausibleSleep(sleepRows))[0]
    : null;
  const sleep = sleepWinner ? { ...sleepWinner, sleepScore: sleepWinner.sleepScore || null } : null;
  // Same single source the Sleep screen itself uses (native WHOOP score when
  // available, else the computed fallback) — not scoreComponents.sleep
  // below, which is a different, duration-only formula the Unified Health
  // Score ring uses and can show 100 on a night the Sleep screen scores 86.
  const nativeSleepScoreMap = sleepWinner ? await getNativeSleepScoresByDate(userId, [sleepWinner]) : new Map();
  const sleepQuality = sleepWinner ? resolveSleepQualityScore(sleepWinner, nativeSleepScoreMap) : null;
  const smoke = user?.smokeLog?.[dateKey] || null;
  const alcohol = user?.alcoholLog?.[dateKey] || null;

  const data = {
    date: dateKey,
    healthScore: liveScore?.finalScore ?? null,
    scoreComponents: liveScore?.components || null,
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
    // The same 0-100 number the Nutrition screen's own card shows (average
    // healthScore10 across today's logged meals, *10) — NOT the same thing
    // as scoreComponents.nutrition below, which measures adequacy against
    // daily targets (MAR/AMDR/moderation), a different and legitimately
    // different-looking number. Named distinctly so 'overall' cites THIS
    // one for nutrition instead of the targets-based one, matching what the
    // user actually sees on the Nutrition screen.
    nutritionQualityScore: nutrition?.averageHealthScore ?? null,
    healthyFoodsCount: nutrition?.healthyFoodsCount ?? null,
    junkFoodsCount: nutrition?.junkFoodsCount ?? null,
    waterGlasses: nutrition?.waterIntake ?? progress?.waterIntake ?? null,
    steps: steps?.steps ?? null,
    activeMinutes: steps?.activeMinutes ?? null,
    caloriesBurned: steps?.caloriesBurned ?? nutrition?.caloriesBurned ?? null,
    sleepHours: sleep?.totalSleepMinutes ? Math.round((sleep.totalSleepMinutes / 60) * 10) / 10 : null,
    sleepQualityScore: sleepQuality?.value ?? null,
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
  // Computed live, same as calculateDailyScore is for the Daily Health
  // Score — not a passive RecoveryDailySummary.findOne(). That read-only
  // version only ever sees whatever the LAST background recompute trigger
  // (fired after a sync event) happened to persist, which can lag behind
  // what the Recovery screen itself shows: confirmed live, an insight
  // generated moments before that trigger finished said "recovery data not
  // available" while the dashboard's own Recovery card already read 79 from
  // the exact same collection once the trigger caught up. calculateRecoveryScore
  // recomputes and upserts RecoveryDailySummary on every call, so this is
  // guaranteed to be at least as fresh as what the user is looking at.
  const result = await calculateRecoveryScore(userId, dateKey);
  if (!result || result.recoveryScore == null) return null;

  const { hrv, rhr, rr } = result;

  return {
    date: dateKey,
    recoveryBand: result.band?.label ?? null,
    physiologyScore: result.physiology?.score ?? null,
    hrvToday: hrv?.today ?? null,
    hrvBaseline14: hrv?.baseline14 ?? null,
    rhrToday: rhr?.today ?? null,
    rhrBaseline14: rhr?.baseline14 ?? null,
    respiratoryRateToday: rr?.today ?? null,
    confidence: result.confidence ?? null,
    warnings: (result.warnings || []).map((w) => w.message),
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
- Sound like a real coach talking to them, not a data readout. Don't just restate the number and tack
  on a tip at the end — open by acknowledging how they're actually doing, in plain human words, THEN
  bring in the number as support for that, THEN close with guidance that fits the result:
    - If the result is BELOW where it should be: say, specifically, what to do to make it better —
      framed as something to do, not just a fact to know.
    - If the result is GOOD or on track: say specifically what to do to KEEP it that way — never a
      bare "keep it up" with nothing concrete attached to it.
  Bad (robotic, data-first): "You logged 3,784 steps, below your usual 6,200. Try taking a short walk."
  Good (human, feeling-first): "You're moving a lot less than usual — about 3,784 steps against your
  typical 6,200. A 20-minute walk would go a long way toward closing that gap."
- Warm, positive, encouraging. Never scold, shame, or use alarming language.
- NEVER use the words "today" or "yesterday" — this exact text can be shown to the user a day or
  weeks after the date it describes, so "today"/"yesterday" would be factually wrong by the time they
  read it. Speak directly to the user as "you" and describe what happened without a day-word.
- Short: the description must be MAX 2-3 sentences. Not 4, not 5 — cut anything extra.
- Personalized: ground it in THIS user's actual number for the date given, compared against their own
  recent average/baseline/goal when that comparison is present in the data — not a generic statement that
  could apply to any user.
- Only use facts present in the data. Never invent numbers, foods, or symptoms. Never name a specific
  health marker, system, or goal (blood sugar, cholesterol, metabolism, cardiovascular health, etc.)
  unless that exact term appears in the data below — "support your energy" is fine, "support your blood
  sugar goals" is not, if no blood sugar field exists in the data.
- Plain everyday language, no medical jargon, no emojis.
- Never diagnose, never name a disease as confirmed, never mention medicine names or dosages.
- The title must match the SAME primary fact the description leads with — never a positive-sounding
  title paired with a description about falling short, or vice versa. If the description's main point
  is "you came up short," the title must signal that too (e.g. "Short on Sleep Tonight"), not an
  unrelated positive ("You're on an upward trend") that contradicts it.
- Respond with ONLY this JSON, nothing else:
{"title": "", "description": "", "summary": ""}
- title: max 6 words, matching the description's primary point — upbeat in TONE, never in CONTENT
  that contradicts a shortfall the description reports.
- description: 2-3 sentences, 120-220 characters — acknowledgment, number, then the specific improve-or-maintain guidance.
- summary: one line, max 12 words, the single takeaway.`;

const SLEEP_SHARED_RULES = `
Rules you must follow:
- ALWAYS state qualityScore as "X/100" somewhere in the first sentence (e.g. "73/100") — this is the
  exact same score shown on the Sleep screen's own ring, so it must always be present, not just hours.
  Never compute this yourself; only state the value already given in the data.
- Sound like a real sleep coach talking to them, not a data readout. Don't just restate the number and
  tack on a tip — open by acknowledging how they're actually doing, in plain human words, THEN bring in
  the number as support for that, THEN close with guidance that fits the result:
    - If vsIdeal is "below": name specifically what to do about it — use the data's
      shortfallMinutesToMin value directly (e.g. "get into bed {shortfallMinutesToMin} minutes earlier
      tonight to close that gap"). Never compute or guess this number yourself — only state the value
      already given in the data.
    - If vsIdeal is "within" or "above": name specifically what to do to KEEP it that way (a consistent
      bedtime, winding down the same way) — never a bare "keep it up" with nothing concrete attached.
  Bad (robotic, data-first): "You slept 5.8 hours, which is 75 minutes short of your 7-9 hour range.
  Try getting into bed 75 minutes earlier tonight."
  Good (human, feeling-first): "You're running short on rest — about 75 minutes under what your body
  needs. Get into bed 75 minutes earlier and you'll close that gap."
- Warm, positive, encouraging. Never scold, shame, or use alarming language.
- NEVER use the words "today" or "yesterday" — this exact text can be shown to the user a day or
  weeks after the date it describes, so "today"/"yesterday" would be factually wrong by the time they
  read it. Describe the night without a day-word.
- Short: the description must be MAX 2-3 sentences. Not 4, not 5 — cut anything extra.
- Personalized: lead with how they're doing, then that night's actual number, then compare it against
  the user's OWN trend/goal/regularity fields when present in the data — not a generic statement.
- Only reference numbers and statuses present in the data below. Never invent a number, a trend, or a
  pattern that isn't explicitly in the data. Never name a specific health marker or system (blood sugar,
  cholesterol, metabolism, cardiovascular health, etc.) unless that exact term appears in the data.
- The title must match vsIdeal, not a secondary trend field — if vsIdeal is "below", the title must
  signal that (e.g. "Short on Sleep Tonight"), even if a weekly trend elsewhere in the data is positive.
  Save the positive trend for inside the description as encouragement, never as a title that contradicts
  the night's own shortfall.
- If tier is "insufficient_data" or "raw_comparison", do NOT claim any trend, debt, or regularity pattern —
  explicitly acknowledge that there isn't enough history yet and encourage continued tracking instead.
- This is wellness guidance, not a medical diagnosis. Plain everyday language, no medical jargon, no emojis,
  never name a disease or mention medicine/dosages.
- Respond with ONLY this JSON, nothing else:
{"title": "", "description": "", "summary": ""}
- title: max 6 words, upbeat headline.
- description: 2-3 sentences, 120-220 characters. State the specific number/comparison, then the one action.
- summary: one line, max 12 words, the single takeaway.`;

// 'overall' needs its own rules, not the generic SHARED_RULES — a 2-3
// sentence budget biased toward "cover the ONE most notable thing" let the
// model repeatedly write a pure nutrition (or pure whatever-scored-worst)
// summary while sleep/activity/recovery data sat right there unused
// (confirmed live: sleep=100, activity=100, recovery=Low/HRV-16 all present
// in the data, and the generated insight mentioned none of them — only
// nutrition). This mandates touching every pillar that has real data,
// briefly, instead of only the worst one.
const OVERALL_SHARED_RULES = `
Rules you must follow:
- Sound like a real coach giving a quick daily roundup, not a single-topic report.
- Structure (3-4 sentences):
  1. One sentence briefly naming how the GOOD or ON-TRACK pillars went, by name, for every one of
     sleep/activity/nutrition that has data AND is good/on-track (e.g. "Sleep and activity were both
     strong"). For activity use scoreComponents.activity. For sleep ALWAYS use sleepQualityScore
     instead of scoreComponents.sleep, and for nutrition ALWAYS use nutritionQualityScore instead of
     scoreComponents.nutrition — those are the exact numbers the Sleep and Nutrition screens show the
     user (sleepQualityScore is the device's own native score when available); scoreComponents.sleep/
     nutrition are different internal figures (a duration-only plateau for sleep, targets-adequacy for
     nutrition) the user never sees directly, and citing them instead makes the insight contradict the
     screen right next to it.
     Always include its real number too (e.g. "Sleep was strong at 89" not just "Sleep was strong") —
     naming a pillar without its number is exactly the "invented-sounding" phrasing this must avoid.
     If only one is good, name just that one; if none are good, skip this sentence and start with the
     attention-needing one.
  2. One sentence naming the ONE pillar (sleep/activity/nutrition) that most needs attention (the
     lowest score or clearest gap), with its real number — same sleepQualityScore/nutritionQualityScore
     rule applies if sleep or nutrition is the one needing attention.
  3. If the data's recovery object is present, ALWAYS add one short sentence or clause for it — its
     band and, if present, the HRV-vs-baseline comparison — regardless of whether it's good or needs
     attention. Recovery is never skipped just because sleep/activity/nutrition already filled the
     "good" and "attention" slots above.
  4. One short sentence: a single concrete action tied to whichever pillar (from 2 or 3) most needs it —
     this sentence is MANDATORY, never drop it to save space. If the first three sentences are running
     long, trim THEM down (shorter clauses, fewer words) rather than cutting the action — a roundup
     with no action defeats the point of the insight.
- Keep every sentence short and plain — telegraphic is fine (e.g. "Nutrition was lowest at 41." not a
  longer explanation of why). Brevity across all 4 sentences matters more than any one being thorough.
- Never limit yourself to only the pillar that needs attention — if sleep/activity data exists and was
  good, SAY SO by name, even briefly, before moving to what needs work.
- If isPartialDay is true, the day is still in progress — a pillar with nothing logged yet (e.g. no
  meals, no sleep synced) is "not logged so far," not a failure. Don't call it a shortfall; just skip
  it from sentence 1/2 and, if nothing at all qualifies as "needing attention" yet, lead with whatever
  IS available (e.g. activity-so-far or recovery) instead.
- NEVER use the words "today" or "yesterday" — this exact text can be shown to the user a day or
  weeks after the date it describes. Speak directly to the user as "you" and describe what happened
  without a day-word.
- Personalized: ground every claim in THIS user's actual numbers from the data — never a generic
  statement that could apply to any user.
- Only use facts present in the data. Never invent numbers, foods, or symptoms. Never name a specific
  health marker or system (blood sugar, cholesterol, metabolism, cardiovascular health, etc.) unless
  that exact term appears in the data.
- Plain everyday language, no medical jargon, no emojis.
- Never diagnose, never name a disease as confirmed, never mention medicine names or dosages.
- Warm, positive, encouraging. Never scold, shame, or use alarming language.
- Respond with ONLY this JSON, nothing else:
{"title": "", "description": "", "summary": ""}
- title: max 6 words, naming the pillar that most needs attention (not a generic "Great Day" when one
  pillar clearly needs work).
- description: 3-4 sentences per the structure above, 150-320 characters.
- summary: one line, max 12 words, the single takeaway.`;

const INSIGHT_SYSTEMS = {
  overall: `You are a friendly health coach inside the take.health app giving a quick daily roundup across sleep, activity, nutrition, and recovery for the given date — every pillar that has data, not just one.${OVERALL_SHARED_RULES}`,
  sleep: `You are a friendly sleep coach inside the take.health app, reasoning like a clinician would: you are given pre-computed sleep facts (that night's numbers, plus trend/goal/regularity context when enough history exists) and must turn them into a specific, connected insight rather than generic advice.${SLEEP_SHARED_RULES}`,
  nutrition: `You are a friendly nutrition coach inside the take.health app. Write a daily insight focused only on the user's food, nutrition, and hydration data for the given date.${SHARED_RULES}`,
  fitness: `You are a friendly fitness coach inside the take.health app. Write a daily insight focused only on the user's exercise, movement, steps, and completed activity for the given date. If the data includes avgStepsLast3Days or personalBaselineSteps, compare the day's steps against those real numbers when you call it "above" or "below usual" — if both are null, do not claim "above/below usual" at all, just state the day's number plainly. If isPartialDay is true, the day is still in progress — never issue a final verdict on the whole day (no "you only did X" or "great job today"); instead speak in "so far" terms (e.g. "so far you've logged X steps — on pace to..." or "X steps so far, below your usual pace at this point").${SHARED_RULES}`,
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
      // 'overall' covers up to 4 pillars in 3 sentences and needs more room
      // than the single-topic types' 220-char cap.
      description: trimToSentence(parsed.description, insightType === 'overall' ? 320 : 220),
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
  if (insightType === 'fitness') {
    // Without a real baseline, the model had no number to compare the day's
    // steps against and started inventing "below your usual activity level"
    // out of nowhere (confirmed live: a 10,332-step day — above the user's
    // own 10,054 personal baseline, and a perfect Activity Score — got
    // called "below usual" because nothing here gave it a real number to
    // check that claim against). Same baseline math activityScoreInsightService
    // already uses for its own goal/baseline notification logic.
    if (!overallData) return null;
    const guidance = getExerciseGuidance(profile.age, null);
    const baseline = await getActivityInsight(userId, guidance.stepsGoal);
    return {
      ...insightData.fitness(overallData),
      stepGoal: baseline.stepGoal,
      avgStepsLast3Days: baseline.avgStepsLast3Days ?? null,
      personalBaselineSteps: baseline.personalBaselineSteps ?? null,
      activityAdherence: baseline.activityAdherence,
      activityBaseline: baseline.activityBaseline,
      // true only for the on-demand same-day refresh (see
      // getLatestActivityDateKey in insightController.js) — unlike a
      // completed night's sleep, the day's steps are still accumulating, so
      // the model must hedge ("so far") instead of making a final verdict.
      isPartialDay: sourceDate === istDateKey(),
    };
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
      // true only for the on-demand same-day refresh (see
      // getLatestOverallDateKey in insightController.js) — the day is still
      // in progress, so nutrition/activity being thin isn't necessarily a
      // shortfall yet, just "not logged so far."
      isPartialDay: sourceDate === istDateKey(),
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
async function ensureInsight(userId, insightType, sourceDate, { force = false, sameDay = false } = {}) {
  if (!INSIGHT_TYPES.includes(insightType)) {
    throw new Error(`Unknown insightType: ${insightType}`);
  }
  // sameDay: used only for the sleep-staleness refresh below — the normal
  // sourceDate -> insightDate+1 lag means a cron-generated 'sleep' insight
  // for today describes YESTERDAY's night. When the Sleep screen's "last
  // night" ring already has data for TODAY's date (the user woke up and
  // synced), that stale insight visibly contradicts the ring showing above
  // it. sameDay stores the regenerated insight under insightDate ===
  // sourceDate instead, so it describes the same night the ring does.
  const insightDate = sameDay ? sourceDate : shiftDateKey(sourceDate, 1);

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

/**
 * The IST date key of the user's most recent SleepSession row, or null if
 * they have none. Used to detect whether a cached 'sleep' insight (which
 * describes sourceDate = insightDate - 1) is now a full night stale against
 * the Sleep screen's "last night" ring, which always shows this latest row.
 */
async function getLatestSleepNightDateKey(userId) {
  const latest = await SleepSession.findOne({ user: userId }).sort({ date: -1 }).select('date').lean();
  return latest ? istDateKey(latest.date) : null;
}

/**
 * The IST date key of the user's most recent DailyActivityMetric row, or
 * null if they have none. Used to detect whether a cached 'fitness' insight
 * (which describes sourceDate = insightDate - 1) is now stale against the
 * Activity screen's ring, which always shows live data for the current day.
 */
async function getLatestActivityDateKey(userId) {
  const latest = await DailyActivityMetric.findOne({ user: userId }).sort({ date: -1 }).select('date').lean();
  return latest ? istDateKey(latest.date) : null;
}

/**
 * 'today' if there's ANY real sign of today's data yet (activity, sleep, or
 * a persisted score), else null. Used to detect whether a cached 'overall'
 * insight (which describes sourceDate = insightDate - 1) is now stale
 * against today's live ring and sub-cards — confirmed live: a cached
 * "Recovery data not available" (yesterday's truth) shown right next to a
 * card displaying today's actual Recovery score of 79.
 *
 * Checks DailyActivityMetric/SleepSession directly rather than only the
 * persisted DailyHealthScore — that record can be briefly absent even with
 * real same-day data (calculateDailyScore deletes it when a given call finds
 * zero available components, which is a transient per-call state, not a
 * reliable "nothing exists yet" signal).
 */
async function getLatestOverallDateKey(userId) {
  const today = istDateKey();
  const todayStart = new Date(`${today}T00:00:00.000Z`);
  const [score, activity, sleep] = await Promise.all([
    DailyHealthScore.findOne({ userId, date: today }).select('components').lean(),
    DailyActivityMetric.exists({ user: userId, date: todayStart }),
    SleepSession.exists({ user: userId, date: todayStart }),
  ]);
  const hasScore = score && Object.keys(score.components || {}).length > 0;
  return hasScore || activity || sleep ? today : null;
}

/**
 * True if any of today's underlying data (nutrition, activity, sleep) was
 * updated AFTER the given insight was last generated — catches staleness
 * WITHIN the same day, which getLatestOverallDateKey's date-only check
 * can't: confirmed live, a user logging a meal 8 minutes after their
 * 'overall' insight generated left it citing a stale nutrition score
 * (55) against the live one (79) from the newly-logged food, even though
 * both insight and data were already dated "today."
 */
async function hasNewerDataThanInsight(userId, insight) {
  if (!insight?.updatedAt) return false;
  const today = istDateKey();
  const todayStart = new Date(`${today}T00:00:00.000Z`);
  const [nutrition, activity, sleep] = await Promise.all([
    NutritionSummary.findOne({ userId, date: todayStart }).select('updatedAt').lean(),
    DailyActivityMetric.find({ user: userId, date: todayStart }).select('updatedAt').sort({ updatedAt: -1 }).limit(1).lean(),
    SleepSession.find({ user: userId, date: todayStart }).select('updatedAt').sort({ updatedAt: -1 }).limit(1).lean(),
  ]);
  const candidates = [nutrition?.updatedAt, activity[0]?.updatedAt, sleep[0]?.updatedAt].filter(Boolean);
  if (candidates.length === 0) return false;
  const latestDataUpdate = new Date(Math.max(...candidates.map((d) => new Date(d).getTime())));
  return latestDataUpdate > new Date(insight.updatedAt);
}

module.exports = {
  runDailyInsightCron,
  generateForUser,
  ensureInsight,
  collectOverallData,
  getLatestSleepNightDateKey,
  getLatestActivityDateKey,
  getLatestOverallDateKey,
  hasNewerDataThanInsight,
  INSIGHT_TYPES,
  istDateKey,
  shiftDateKey,
};
