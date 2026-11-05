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
const { buildCategories, sameCategories, isLiveDay } = require('./insightCategories');
const { findTextProblems, findLabelProblems, autoFix, NUMBER_PATTERN } = require('./insightTextRules');
const FinalDailyInsight = require('../models/FinalDailyInsight');
const RecoveryDailySummary = require('../models/RecoveryDailySummary');
const { getSleepGoal } = require('../utils/sleepGoal');
const { FINAL_INSIGHT_TYPES } = FinalDailyInsight;
const { getSleepClinicalAnalysis } = require('./sleepClinicalAnalysisService');
const { getNativeSleepScoresByDate, resolveSleepQualityScore } = require('./sleepScoreService');
const { getActivityInsight } = require('./activityInsightService');
const { getStepGoal } = require('../utils/stepGoal');
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

/** Hour of the day (0-23) in IST. */
const istHour = (date = new Date()) => Number(new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23',
}).format(date));

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
    // Why scoreComponents.activity can be 100 even when steps are far short
    // of the steps goal: activity is scored as the BETTER of steps-vs-goal
    // OR movement-minutes-vs-goal (cardio exercise time), not an average of
    // the two — someone who logged a real workout gets full credit even on
    // a low-step day. Exposed so the insight can explain that instead of
    // leaving "activity 100" looking wrong next to "3,430 of 7,500 steps".
    activityDetail: liveScore?.raw?.activity || null,
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
    // Unrounded, for the overall insight's sleep-vs-goal label.
    sleepMinutes: sleep?.totalSleepMinutes || null,
    // Pre-formatted so the model copies it verbatim instead of converting
    // decimal hours to "Xh Ym" itself — that conversion is exactly the kind
    // of arithmetic that produced a fabricated "100.91" score in production
    // (the model computing instead of stating a given value).
    sleepDurationLabel: sleep?.totalSleepMinutes
      ? `${Math.floor(sleep.totalSleepMinutes / 60)}h ${sleep.totalSleepMinutes % 60}m`
      : null,
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

  // `data.healthScore != null` used to be in this list — calculateDailyScore
  // returns finalScore: 0 (not null) for a day with ZERO real inputs, and
  // `0 != null` is true in JS, so a user who logged literally nothing still
  // passed this check and got an insight generated from an entirely empty
  // data object (confirmed live: ~1,000+ users/night with no real sleep,
  // steps, meals, or vitals on file still triggered generation). Checking
  // scoreComponents' key count instead of finalScore's nullness actually
  // reflects whether any real component was computed, not just whether the
  // final number happened to be non-null.
  const hasSomething = data.meals.length > 0
    || data.steps || data.sleepHours || data.waterGlasses
    || data.vitals.length > 0 || Object.keys(data.scoreComponents || {}).length > 0
    || data.completedTasks > 0 || data.workouts.length > 0;

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
    // The same number the Activity ring on the dashboard shows — this card
    // sits right under/near it, so the insight must cite THIS, not a
    // separate 3-day-average-vs-baseline figure the ring never displays
    // (confirmed live: insight said "4,486 steps/day, below your 6,769
    // average" while the ring showed "12" and "1,242 of 7,500 steps" — two
    // completely different, both-true-but-unrelated numbers on screen at once).
    activityScore: data.scoreComponents?.activity ?? null,
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

// "> 0", not "!= null": the nutrition-score GET creates a zero row for a day
// with nothing logged, and those zero rows used to produce "you didn't log
// any food" insights for users who simply hadn't used the app.
const hasInsightData = (type, data) => {
  if (!data) return false;
  if (type === 'nutrition') return data.meals.length > 0
    || data.calories > 0 || data.protein > 0 || data.waterGlasses > 0;
  if (type === 'fitness') return data.workouts.length > 0
    || data.steps > 0 || data.activeMinutes > 0 || data.completedTasks > 0;
  if (type === 'smoking') return data.cigarettes != null;
  if (type === 'alcohol') return data.alcoholUnits != null;
  if (type === 'hydration') return data.waterGlasses > 0;
  return true;
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
    recoveryScore: result.recoveryScore ?? null,
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

// The user's own last two weeks: on their short nights, was recovery (or
// movement) actually lower than on their full nights? Only then may the
// overall insight say "like it usually does for you"; otherwise it hedges.
const PATTERN_DAYS = 14;
const PATTERN_MIN_NIGHTS = 2;
const SHORT_NIGHT_MINUTES = 30; // short of the goal by more than this

async function getPersonalPatterns(userId, sourceDate, goalHours) {
  const startKey = shiftDateKey(sourceDate, -PATTERN_DAYS);
  const range = { $gte: utcMidnight(startKey), $lt: utcMidnight(sourceDate) };
  const [sleeps, recoveries, activity] = await Promise.all([
    SleepSession.find({ user: userId, date: range }).select('date totalSleepMinutes').lean(),
    RecoveryDailySummary.find({ user: userId, date: { $gte: startKey, $lt: sourceDate } }).select('date recoveryScore').lean(),
    DailyActivityMetric.find({ user: userId, date: range }).select('date steps').lean(),
  ]);

  // One value per day — several devices for the same day keep the highest.
  const byDay = (rows, dayOf, valueOf) => rows.reduce((map, row) => {
    const value = valueOf(row);
    if (value != null) map.set(dayOf(row), Math.max(map.get(dayOf(row)) ?? -Infinity, value));
    return map;
  }, new Map());
  const isoDay = (row) => new Date(row.date).toISOString().slice(0, 10);
  const sleepByDay = byDay(sleeps, isoDay, (r) => r.totalSleepMinutes);
  const shortLine = goalHours * 60 - SHORT_NIGHT_MINUTES;
  const avg = (list) => list.reduce((sum, v) => sum + v, 0) / list.length;

  const shortVsFull = (valueByDay) => {
    const short = [];
    const full = [];
    for (const [day, minutes] of sleepByDay) {
      const value = valueByDay.get(day);
      if (value != null) (minutes < shortLine ? short : full).push(value);
    }
    return short.length >= PATTERN_MIN_NIGHTS && full.length >= PATTERN_MIN_NIGHTS
      ? { short: avg(short), full: avg(full) }
      : null;
  };
  const recovery = shortVsFull(byDay(recoveries, (r) => r.date, (r) => r.recoveryScore));
  const steps = shortVsFull(byDay(activity, isoDay, (r) => r.steps));
  return {
    sleepRecovery: !!recovery && recovery.full - recovery.short >= 10,
    sleepActivity: !!steps && steps.full > 0 && (steps.full - steps.short) / steps.full >= 0.15,
  };
}

// Consecutive reward days just before sourceDate, from the stored finals.
async function countRewardStreak(userId, sourceDate) {
  const finals = await FinalDailyInsight.find({
    userId, insightType: 'overall', date: { $gte: shiftDateKey(sourceDate, -7), $lt: sourceDate },
  }).select('date categories.tier').lean();
  const tierByDate = new Map(finals.map((f) => [f.date, f.categories?.tier]));
  let days = 0;
  for (let d = shiftDateKey(sourceDate, -1); tierByDate.get(d) === 'reward'; d = shiftDateKey(d, -1)) days++;
  return days;
}

// ------------------------------------------------------------------- prompts

// Wording is deliberately date-anchored ("On {date}") rather than "yesterday" —
// this same insight object is read in two different contexts: the home
// screen's next-morning card (where "on {date}" still reads naturally, one
// day back) AND the Unified Health Score breakdown page's weekly/monthly
// trend (where a day could be up to ~30 days back, and "yesterday" would be
// flatly wrong). One wording serves both without needing two insight variants.
// The data the model receives is category labels only (see
// insightCategories.js) — never raw numbers. The app already shows every
// number on the screen around this card, so a number in the text adds
// nothing and can only contradict the ring next to it.
// The written-by-a-person voice, plus the hard rules insightTextRules.js
// enforces after generation (numbers, banned phrases, tense, an action).
const NO_NUMBERS_RULE = `
- ABSOLUTELY NO NUMBERS: never write a digit (0-9), a number word (two, three, ten, thirty, ...), a
  percentage, a score, hours, minutes, steps, or any other figure. The app already shows every number
  next to this card. Describe it in words only, e.g. "about halfway to your step goal", "a little short
  of your sleep goal". Say "a short walk after lunch", never "a ten-minute walk".
- The data is a set of category labels (e.g. stepsVsGoal: "about_half"). Base every claim strictly on
  those labels — never claim something stronger or weaker than the label says, and never mention a
  pillar whose label is "not_logged" or null except as "not logged".
- TENSE: only when dayStatus is "day_just_started" or "day_in_progress" is the day still going — then
  speak in "so far" terms and never give a final verdict. In EVERY other case the day being described is over: past
  tense, anything "not_logged" was simply not logged, and the action is for tonight or tomorrow —
  never "now", "right now" or "yet".
- VOICE: write like a real coach who knows this person, texting them — not a report. Short everyday
  sentences with contractions ("you're", "didn't"). Warm and calm, never hyped. Lead with how they
  probably feel, then what to do. Be specific to their labels — never a line that could fit anyone.
- MEMORY: if the previous day's labels are given, compare naturally ("better than the night before",
  "second day in a row water was light") — only when something actually changed or repeated, never
  forced. Never open the same way as the previous day's message, if one is given. Never use the words
  "today" or "yesterday" — say "the night before" / "the day before" instead.
- Use their first name at most once, and only when it reads naturally.
- BANNED, these read as AI: "great sign", "momentum", "crushed", "keep it up", "keep up the great
  work", "prioritize", "consistency is key", "journey", "it's important to", "remember to", "don't
  forget", "well done", "amazing", exclamation marks, em or en dashes, emojis.
- ACTION: the description must contain one small, concrete thing they can do, in a sentence that starts
  with a verb (Try, Aim, Get, Plan, Add, Give, Keep...), optionally after "Tonight," or "Tomorrow,".
- You are the take.health Coach. Never claim to be a doctor or a named person, never sign off.`;

const SHARED_RULES = `
Rules you must follow:${NO_NUMBERS_RULE}
- Open by acknowledging how they're actually doing in plain human words, THEN the action:
    - If the result is BELOW where it should be: what to do to make it better.
    - If the result is GOOD or on track: one concrete thing that keeps it that way.
- Warm, positive, encouraging. Never scold, shame, or use alarming language.
- Short: the description must be MAX 2-3 sentences.
- Never invent foods, symptoms, or facts not implied by the labels. Never name a specific health marker
  or system (blood sugar, cholesterol, metabolism, cardiovascular health, etc.).
- Plain everyday language, no medical jargon, no emojis.
- Never diagnose, never name a disease as confirmed, never mention medicine names or dosages.
- The title must match the SAME primary fact the description leads with — never a positive title over a
  description about falling short, or vice versa.
- Respond with ONLY this JSON, nothing else:
{"title": "", "description": "", "summary": ""}
- title: max 6 words.
- description: 2-3 sentences, 100-220 characters — acknowledgment, then the specific improve-or-maintain guidance.
- summary: one line, max 12 words, the single takeaway.`;

const SLEEP_SHARED_RULES = `
Rules you must follow:${NO_NUMBERS_RULE}
- Open by acknowledging how they're actually doing, THEN the action:
    - lastNightVsGoal "below": what to do about it, sized by shortBy (slightly_short -> "a little
      earlier to bed", well_short -> "a noticeably earlier bedtime").
    - lastNightVsGoal "within" or "above": one concrete thing that keeps it that way (a consistent
      bedtime, winding down the same way).
- The title must match lastNightVsGoal and how short it was, not a secondary trend:
    slightly_short -> a little short, moderately_short -> short, well_short -> well short.
  Never soften a well_short night into "a little", and never let a positive weeklyTrend set the title.
- If historyDepth is "insufficient_data" or "raw_comparison", do NOT claim any trend, debt, or regularity
  pattern — say there isn't enough history yet and encourage continued tracking.
- Warm, positive, encouraging. Never scold, shame, or use alarming language.
- Short: the description must be MAX 2-3 sentences.
- Never name a specific health marker or system (blood sugar, cholesterol, metabolism, etc.).
- Wellness guidance, not a diagnosis. Plain everyday language, no jargon, no emojis, no medicine/dosages.
- Respond with ONLY this JSON, nothing else:
{"title": "", "description": "", "summary": ""}
- title: max 6 words.
- description: 2-3 sentences, 100-220 characters.
- summary: one line, max 12 words, the single takeaway.`;

// 'overall' needs its own rules, not the generic SHARED_RULES — a 2-3
// sentence budget biased toward "cover the ONE most notable thing" let the
// model repeatedly write a pure nutrition (or pure whatever-scored-worst)
// summary while sleep/activity/recovery data sat right there unused
// (confirmed live: sleep=100, activity=100, recovery=Low/HRV-16 all present
// in the data, and the generated insight mentioned none of them — only
// nutrition). This mandates touching every pillar that has real data,
// briefly, instead of only the worst one.
// The connection (link) and the kind of day (tier) are picked in code from
// the user's data (insightCategories.buildOverall) — the model only puts
// them into words, and the text is checked against them afterwards.
const OVERALL_SHARED_RULES = `
Rules you must follow:${NO_NUMBERS_RULE}
- Very simple everyday words that anyone can understand. Plain and literal, never an idiom or
  figurative phrase ("running on empty", "in the red", "in the tank").
- EXACTLY 2 short sentences. Sentence 1 is how the day went; sentence 2 is the action and starts with a
  verb (Try, Aim, Get, Add, Keep...), optionally after "Tonight," or "Tomorrow,".
- tier decides the message:
  - "reward": everything came together. Sentence 1 celebrates the whole day; if rewardStreak is
    second_day, third_day or several_days, say so naturally ("second day in a row", "third day in a
    row", "another day in a row"). Sentence 2 is a small way to keep it going. Never call anything
    short, low, missing or needing work.
  - "incomplete_data": what was logged looked good, but some pillars were not logged. Say both, then
    ask them to log the missing ones. Never celebrate it as a complete day.
  - "improve" or "in_progress": follow link.
- link is the ONE connection the user's data supports. When it is not "none", sentence 1 explains it as
  simple cause and effect and sentence 2 acts on the cause. Never add any other connection. When link
  is "none", sentence 1 covers each logged pillar (sleep, activity, nutrition, recovery) in a few
  words, good or bad, and sentence 2 acts on the one that needs it most.
- linkEvidence "personal_pattern": you may say it is a pattern for them ("like it usually does for you
  after a short night"). linkEvidence "general": say "likely", "can" or "may", never as a certainty.
- If stepsVsGoal is short of the goal, never call the activity good or strong. A logged workout can be
  credited ("your workout counted"), but the steps still fell short.
- If sleepVsGoal is "below", never call the sleep excellent or great.
- A pillar labelled "not_logged" is only ever "not logged", never a failure.
- Never invent foods, symptoms, or facts the labels don't imply. Never name a specific health marker or
  system (blood sugar, cholesterol, metabolism, cardiovascular health, diabetes, etc.) — a profile
  condition is NOT license to reference it.
- Never diagnose, never mention medicine names or dosages. Warm, never scolding or alarming.
- Respond with ONLY this JSON, nothing else:
{"title": "", "description": "", "summary": ""}
- title: max 6 words, about the main point of sentence 1.
- description: exactly 2 short sentences, 100-240 characters.
- summary: one line, max 12 words, the single takeaway.`;

// One example per connection and per kind of day, sent only for the one
// that applies, so the text comes out in exactly this structure and these
// simple words.
const OVERALL_EXAMPLES = {
  alcohol_sleep: 'Drinks the evening before likely cut into your sleep, and your recovery shows it. Tonight, skip the drink and get to bed a little earlier.',
  sleep_recovery: 'Short sleep likely held back your recovery, which can leave you feeling more tired than usual. Tonight, get to bed a bit earlier so tomorrow starts with more energy.',
  sleep_activity: 'A short night may have left you low on energy, so moving less makes sense. Tonight, aim for an earlier bedtime and tomorrow will feel easier.',
  recovery_push: "Your body hadn't fully recovered, but you still pushed hard, which can leave you more tired. Tomorrow, keep it to an easy walk and let your body catch up.",
  underfuel_active: 'You slept well and moved a lot, but meals came in under what that much activity needs, which may be why recovery stayed only fair. Tomorrow, add a proper meal or snack around your workout to refuel.',
  underfuel_inactive: "Meals came in light, and with less fuel it's harder to stay active. Tomorrow, add a proper breakfast so you have the energy to move.",
  workout_protein: 'You got a workout in, but protein was low, and your muscles need it to recover. Tomorrow, add eggs, paneer or dal to one of your meals.',
  surplus_inactive: 'You ate more than your body used, since movement stayed low. Tomorrow, try a short walk after your biggest meal.',
  water_active: "You were very active but didn't drink enough water to keep up. Tomorrow, keep a bottle with you and sip through the day.",
  rested_inactive: "You were well rested and recovered, but that energy didn't turn into movement. Tomorrow, use it with a longer walk.",
  none: "Your sleep was fair, movement reached about half your goal, meals were on track and recovery wasn't logged. Tomorrow, add a short walk after lunch to get closer to your step goal.",
  // Only steps came through: nothing to connect, so the text says so and
  // asks for the rest instead of guessing.
  only_activity: "Only your steps came through, and they stayed low, so the rest of the day isn't visible. Tomorrow, add a short walk after a meal and log your meals so the full picture shows.",
  // The live card, while the day is still going.
  live_none: 'Last night was well short of your sleep goal, steps are still low and no meals are logged so far. Try a short walk in your next break and log your first meal.',
  live_only_activity: "Only your steps have come through so far, and they're still low. Try a short walk in your next break and log your first meal.",
  reward_first_day: 'Everything came together, with good sleep, strong recovery, balanced meals and your step goal reached. Days like this build on each other, so keep the same rhythm tomorrow.',
  reward_streak: "Third day in a row with good sleep, strong recovery, steady meals and your step goal met. That's becoming a real routine, so keep the same bedtime tomorrow and enjoy it.",
  incomplete_data: "Your sleep and movement looked great, but meals and recovery weren't logged, so the full picture is missing. Tomorrow, log your meals too so we can see how it all fits together.",
};

const overallExample = (c) => {
  if (!c) return null;
  if (c.tier === 'reward') return OVERALL_EXAMPLES[c.rewardStreak === 'first_day' ? 'reward_first_day' : 'reward_streak'];
  if (c.tier === 'incomplete_data') return OVERALL_EXAMPLES.incomplete_data;
  if (OVERALL_EXAMPLES[c.link] && c.link !== 'none') return OVERALL_EXAMPLES[c.link];
  const live = isLiveDay(c.dayStatus);
  const onlyActivity = c.sleepVsGoal === 'not_logged' && c.meals === 'none_logged' && c.recovery === 'not_logged';
  if (onlyActivity) return OVERALL_EXAMPLES[live ? 'live_only_activity' : 'only_activity'];
  return OVERALL_EXAMPLES[live ? 'live_none' : 'none'];
};

const INSIGHT_SYSTEMS = {
  overall: `You are a friendly health coach inside the take.health app giving a quick daily roundup of sleep, activity, nutrition, and recovery for the given date, explaining how they affected each other the way the labels say.${OVERALL_SHARED_RULES}`,
  sleep: `You are a friendly sleep coach inside the take.health app, reasoning like a clinician would: you are given pre-computed sleep categories (that night against the user's sleep goal, plus trend/goal/regularity context when enough history exists) and must turn them into a specific, connected insight rather than generic advice.${SLEEP_SHARED_RULES}`,
  nutrition: `You are a friendly nutrition coach inside the take.health app. Write a daily insight focused only on the user's food, nutrition, and hydration data for the given date.${SHARED_RULES}`,
  fitness: `You are a friendly fitness coach inside the take.health app, talking to someone about their movement — warm and empathetic, not a stats readout. Lead with where stepsVsGoal puts them against their step goal (not_started, just_started, low, about_half, close_to_goal, goal_met). Never compare against a historical average or "usual pattern" — only against the goal. Close with one doable action sized to the gap (a short walk, a stretch break) if under goal, or how to stay there if goal_met. If stepsVsGoal is short of the goal, never call the activity good, strong or going well: a logged workout can be credited ("your workout counted"), but the steps still fell short.${SHARED_RULES}`,
  recovery: `You are a friendly recovery coach inside the take.health app, reasoning like a sports-science clinician: you are given that day's recovery level plus how HRV and resting heart rate compare with the user's own usual, and must explain what they mean for physical readiness.${SHARED_RULES}`,
  smoking: `You are a friendly, non-judgmental health coach inside the take.health app. Write a daily insight focused only on the user's logged smoking (and cravings resisted, if any) for the given date. Frame none or few as a genuine win; never shame what was logged.${SHARED_RULES}`,
  alcohol: `You are a friendly, non-judgmental health coach inside the take.health app. Write a daily insight focused only on the user's logged alcohol for the given date. Frame none or moderate as a genuine win; never shame what was logged.${SHARED_RULES}`,
  hydration: `You are a friendly health coach inside the take.health app. Write a daily insight focused only on how the user's logged water intake compares with their water goal.${SHARED_RULES}`,
};

// Single source of truth for which types processUserDay loops over and how
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

const buildUserPrompt = (profile, label, date, categories, previous, example) => `User profile: ${JSON.stringify(profile)}
${label} for ${date} (category labels):
${JSON.stringify(categories)}
${previous ? `\nPrevious day's labels: ${JSON.stringify(previous.categories)}` : ''}${previous?.message ? `\nPrevious day's message (don't open the same way): "${previous.message}"` : ''}${example ? `\nWrite it in the same structure and the same simple words as this example, adapted to the labels above (never copy a fact the labels don't show): "${example}"` : ''}

Write the insight for this date.`;

// Age is the only numeric profile field — left out so nothing numeric
// reaches the model at all.
const toPromptProfile = ({ age, ...rest }) => rest;

// The day before's labels (and message) so the text can say "better than the
// night before" — the kind of continuity that reads as a person who has been
// following along. Final first (permanent), else that day's live card.
async function getPreviousDayContext(userId, insightType, sourceDate) {
  const prevDate = shiftDateKey(sourceDate, -1);
  const final = FINAL_INSIGHT_TYPES.includes(insightType)
    ? await FinalDailyInsight.findOne({ userId, date: prevDate, insightType }).select('categories description').lean()
    : null;
  const source = final
    ? { categories: final.categories, message: final.description }
    : await DailyInsight.findOne({ userId, sourceDate: prevDate, insightType })
      .select('dataSnapshot.categories description').lean()
      .then((d) => (d?.dataSnapshot?.categories ? { categories: d.dataSnapshot.categories, message: d.description } : null));
  if (!source) return null;
  // An older, number-quoting message would only invite the model to copy figures.
  return NUMBER_PATTERN.test(source.message || '') ? { categories: source.categories } : source;
}

// ---------------------------------------------------------------- generation

// Models overshoot the "120-220 characters" instruction, so a bare slice cuts
// mid-word. Cut to the limit, then back up to the last full sentence. If the
// only sentence end is too early (under minKeep), keep the hard cut rather
// than return a stub.
const trimToSentence = (text, max, minKeep = 80) => {
  const str = String(text).trim();
  if (str.length <= max) return str;
  const cut = str.slice(0, max);
  // A '.'/'!'/'?' only counts as a real sentence end if it's followed by
  // whitespace or end-of-string — otherwise it's punctuation mid-phrase (e.g.
  // "activity (100!)"), and treating it as the cut point used to chop the
  // sentence off right after the "!" with the closing ")." left dangling.
  let lastEnd = -1;
  for (let i = cut.length - 1; i >= 0; i--) {
    if ((cut[i] === '.' || cut[i] === '!' || cut[i] === '?') && (i + 1 === str.length || /\s/.test(str[i + 1]))) {
      lastEnd = i;
      break;
    }
  }
  return lastEnd >= minKeep ? cut.slice(0, lastEnd + 1) : cut.trimEnd();
};

// Over the limit: keep the first and the last sentence (the last one is the
// action) before a hard cut, which used to drop the action sentence and
// fail the check for no reason.
const fitToLength = (text, max) => {
  const str = String(text).trim();
  if (str.length <= max) return str;
  const parts = str.split(/(?<=[.?])\s+/);
  if (parts.length > 2) {
    const firstAndLast = `${parts[0]} ${parts[parts.length - 1]}`;
    if (firstAndLast.length <= max) return firstAndLast;
  }
  return trimToSentence(str, max);
};

const INSIGHT_LLM_TIMEOUT_MS = 15000;

// Bump whenever the prompts change meaningfully: a cached insight written
// under an older version is regenerated once, even if its labels are equal.
const INSIGHT_PROMPT_VERSION = 4;

// First try plus two corrective rewrites.
const INSIGHT_MAX_ATTEMPTS = 3;

// A rewrite only needs the draft and what's wrong with it — about a third of
// the tokens of sending the whole prompt again.
const REPAIR_SYSTEM = `You edit short health-coach messages. Fix ONLY the listed problems and keep everything else: the meaning, the facts, the warm and simple tone, and an action sentence that starts with a verb. A word or phrase listed as a problem must be removed from the title, the description AND the summary. No numbers or number words, no exclamation marks, no dashes, never the words "today" or "yesterday".
Respond with ONLY this JSON: {"title": "", "description": "", "summary": ""}`;

// The LLM call alone — returns the finished text without saving it, so one
// call can be stored both as the permanent final and as the next morning's
// live card.
async function composeInsight({ userId, profile, insightType, sourceDate, data }) {
  const categories = buildCategories(insightType, data);
  // Half a day's data against a whole previous day is not a fair comparison,
  // so the day before is left out once the live day is underway.
  const previous = categories?.dayStatus === 'day_in_progress'
    ? null
    : await getPreviousDayContext(userId, insightType, sourceDate).catch(() => null);
  const example = insightType === 'overall' ? overallExample(categories) : null;
  const firstTry = [{
    role: 'user',
    content: buildUserPrompt(toPromptProfile(profile), INSIGHT_LABELS[insightType], data.date || sourceDate, categories, previous, example),
  }];
  const dayIsOver = !isLiveDay(categories?.dayStatus);
  const maxDescription = insightType === 'overall' ? 250 : 220;

  // Checked exactly as it will be stored, after the free code fixes.
  const shape = (parsed) => {
    if (!parsed?.title || !parsed?.description) return null;
    const fixed = autoFix(parsed);
    return {
      title: fixed.title.slice(0, 120),
      description: fitToLength(fixed.description, maxDescription),
      summary: (fixed.summary || fixed.title).slice(0, 200),
    };
  };

  // The text is checked after every attempt; a failing draft goes back with
  // the exact problems listed. If it still fails after the last attempt
  // nothing is saved, so the previous insight stays rather than a bad one.
  let text = null;
  let model;
  let problems = [];
  for (let attempt = 1; attempt <= INSIGHT_MAX_ATTEMPTS; attempt++) {
    const repair = text != null;
    const result = await chatCompletionWithFallback({
      system: repair ? REPAIR_SYSTEM : INSIGHT_SYSTEMS[insightType],
      messages: repair ? [{
        role: 'user',
        content: `Message: ${JSON.stringify(text)}\nLabels it must stay true to: ${JSON.stringify(categories)}\nProblems to fix: ${problems.join('; ')}`,
      }] : firstTry,
      maxTokens: MAX_TOKENS,
      // Low so the same categories read the same on a re-generation instead
      // of a fresh rewrite each time.
      temperature: 0.3,
      feature: `daily_insight_${insightType}${repair ? '_repair' : ''}`,
      userId,
      // Avg call is ~2.7s; without a cap a stuck provider held one for 191s.
      // On timeout the fallback chain moves on to the next model.
      timeoutMs: INSIGHT_LLM_TIMEOUT_MS,
    });
    model = result.model;
    let draft = null;
    try { draft = shape(parseJsonResponse(result.text)); } catch { /* counted as a problem below */ }

    if (draft) {
      text = draft;
      problems = [...findTextProblems(draft, { dayIsOver }), ...findLabelProblems(draft, categories, insightType)];
      if (draft.description.length < 80) problems.push('description is too short — write two full sentences');
    } else if (!text) {
      problems = ['is not the requested JSON'];
    }
    if (draft && problems.length === 0) break;
    if (attempt === INSIGHT_MAX_ATTEMPTS) {
      throw new Error(`Insight text failed checks: ${problems.join('; ')}`);
    }
  }

  return { ...text, categories, model };
}

function saveDailyInsight({ userId, insightDate, sourceDate, insightType, data, composed }) {
  return DailyInsight.findOneAndUpdate(
    { userId, insightDate, insightType },
    {
      userId, insightDate, sourceDate, insightType,
      title: composed.title,
      description: composed.description,
      summary: composed.summary,
      // Raw numbers kept for support/debugging; `categories` is what the text
      // was written from and what staleness is judged against.
      dataSnapshot: { ...data, categories: composed.categories, promptVersion: INSIGHT_PROMPT_VERSION },
      model: composed.model,
      seen: false,
      seenAt: null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function generateOne({ userId, profile, insightType, sourceDate, insightDate, data }) {
  const composed = await composeInsight({ userId, profile, insightType, sourceDate, data });
  return saveDailyInsight({ userId, insightDate, sourceDate, insightType, data, composed });
}

// Write-once: a duplicate (retried job, double trigger) is ignored, never
// overwrites the stored final.
async function saveFinalInsight({ userId, date, insightType, data, composed, source }) {
  try {
    await FinalDailyInsight.create({
      userId, date, insightType,
      title: composed.title,
      description: composed.description,
      summary: composed.summary,
      categories: composed.categories,
      dataSnapshot: data,
      promptVersion: INSIGHT_PROMPT_VERSION,
      model: composed.model,
      source,
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
}

// Types with their OWN data source (not collectOverallData) — 'sleep' had
// this before 'recovery' was added. Each is fetched once, not gated on
// overallData existing, since a user can have wearable HRV/RHR data on a day
// they logged nothing else.
const OWN_SOURCE_TYPES = new Set(['sleep', 'recovery']);

async function buildProfile(userId) {
  const user = await User.findById(userId)
    .select('name profile.age profile.gender profile.goals profile.healthConditions profile.chronicConditions profile.activityLevel profile.lifestyle.sleepGoalHours profile.lifestyle.waterGoalMl profile.lifestyle.stepGoal nutritionGoal.goal')
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
// `isFinal`: the 23:59 job runs while it is still technically that day in
// IST, but describes the finished day — never "so far" wording.
async function collectDataForType(insightType, userId, sourceDate, { user, profile, overallData, isFinal = false }) {
  // Same default the lifestyle-goals API reports when the user never set one.
  const waterGoalMl = user?.profile?.lifestyle?.waterGoalMl || 2000;
  const isPartialDay = !isFinal && sourceDate === istDateKey();
  // With isPartialDay, decides whether the live card is in the "day just
  // started" window where comparing with the day before still makes sense.
  const beforeNoon = isPartialDay && istHour() < 12;
  if (insightType === 'sleep') {
    const sleepGoalHours = user?.profile?.lifestyle?.sleepGoalHours;
    const analysis = await getSleepClinicalAnalysis(userId, { age: profile.age, sleepGoalHours, asOfDate: sourceDate });
    // lastNight is the latest session in a 14-day window, not necessarily
    // this date's — without this check a user with no sleep that day got
    // an old night described as "last night" (121 users in one night's run).
    return analysis.lastNight?.date === sourceDate ? { date: sourceDate, ...analysis } : null;
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
    const baseline = await getActivityInsight(userId, getStepGoal(user).goalSteps);
    return {
      ...insightData.fitness(overallData),
      // Goal, not a historical trend average — "today vs your goal" is the
      // comparison the ring itself expresses (steps X of goal Y); the
      // avgStepsLast3Days/personalBaselineSteps trend used to be cited
      // instead, which put an unrelated number ("6,771/day vs your usual
      // 11,979/day") on screen next to the ring's actual "12, 1,242 of
      // 7,500 steps" with nothing connecting them. Dropped entirely, not
      // just deprioritized — a prompt instruction to prefer one number over
      // another still let the model reach for the trend anyway.
      stepGoal: baseline.stepGoal,
      beforeNoon,
      // true only for the on-demand same-day refresh (see
      // getLatestActivityDateKey in insightController.js) — unlike a
      // completed night's sleep, the day's steps are still accumulating, so
      // the model must hedge ("so far") instead of making a final verdict.
      isPartialDay,
    };
  }
  if (insightType === 'overall') {
    // The only type that should speak to all four pillars (sleep, activity,
    // nutrition, recovery) in one summary — collectOverallData already has
    // sleep/activity/nutrition, but recovery (HRV/RHR/respiratory rate) has
    // its own dedicated collector (same one the standalone 'recovery' type
    // uses), fetched here too so 'overall' isn't silently missing it.
    if (!overallData) return null;
    const sleepGoalHours = getSleepGoal(user).goalHours;
    const sleepShortfall = overallData.sleepMinutes ? sleepGoalHours * 60 - overallData.sleepMinutes : 0;
    const [recovery, patterns, rewardStreakBefore] = await Promise.all([
      collectRecoveryData(userId, sourceDate),
      // Only a meaningfully short night can become a sleep connection.
      sleepShortfall > SHORT_NIGHT_MINUTES
        ? getPersonalPatterns(userId, sourceDate, sleepGoalHours).catch(() => null)
        : null,
      isPartialDay ? 0 : countRewardStreak(userId, sourceDate).catch(() => 0),
    ]);
    return {
      ...overallData,
      sleepGoalHours,
      patterns,
      rewardStreakBefore,
      recovery: recovery ? {
        // The ring on the dashboard shows recoveryScore (the final 0-100 number),
        // not physiologyScore (an internal 70%-weighted sub-component of it) —
        // citing physiologyScore here used to make 'overall' disagree with the
        // Recovery card shown right above it.
        recoveryScore: recovery.recoveryScore,
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
      isPartialDay,
      beforeNoon,
      waterGoalMl,
    };
  }
  if (!overallData) return null;
  const typeData = insightData[insightType](overallData);
  return (insightType === 'nutrition' || insightType === 'hydration')
    ? { ...typeData, waterGoalMl, isPartialDay, beforeNoon }
    : typeData;
}

/**
 * The end-of-day job for one user: writes the permanent final for each final
 * type (overall/sleep/fitness/nutrition/recovery) and the next morning's live
 * card for every type, from ONE LLM call per type. Types with no data that
 * day are skipped. Safe to retry: an existing final is reused, never
 * regenerated, and a live card already written from this day is left alone.
 *
 * finalOnly: just fill in missing finals (the on-demand backfill for a past
 * date) without touching the live cards.
 */
async function processUserDay(userId, dateKey, { source = 'scheduled', finalOnly = false } = {}) {
  const insightDate = shiftDateKey(dateKey, 1);
  const { user, profile } = await buildProfile(userId);
  const overallData = await collectOverallData(userId, dateKey);
  const types = finalOnly ? FINAL_INSIGHT_TYPES : INSIGHT_TYPES;

  const [finals, liveCards] = await Promise.all([
    FinalDailyInsight.find({ userId, date: dateKey }).lean(),
    finalOnly ? [] : DailyInsight.find({ userId, insightDate, sourceDate: dateKey })
      .select('insightType dataSnapshot.promptVersion').lean(),
  ]);
  const finalByType = new Map(finals.map((f) => [f.insightType, f]));
  const liveDone = new Set(liveCards
    .filter((c) => c.dataSnapshot?.promptVersion === INSIGHT_PROMPT_VERSION)
    .map((c) => c.insightType));

  const result = {};
  for (const insightType of types) {
    try {
      const isFinalType = FINAL_INSIGHT_TYPES.includes(insightType);
      const existingFinal = finalByType.get(insightType);

      if (existingFinal) {
        if (!finalOnly && !liveDone.has(insightType)) {
          await saveDailyInsight({
            userId, insightDate, sourceDate: dateKey, insightType,
            data: existingFinal.dataSnapshot,
            composed: existingFinal,
          });
        }
        result[insightType] = 'final_exists';
        continue;
      }
      if (!isFinalType && liveDone.has(insightType)) {
        result[insightType] = 'already_exists';
        continue;
      }

      const data = await collectDataForType(insightType, userId, dateKey, { user, profile, overallData, isFinal: true });
      const hasData = OWN_SOURCE_TYPES.has(insightType) ? data != null : (data != null && hasInsightData(insightType, overallData));
      if (!hasData) {
        result[insightType] = 'skipped_no_data';
        continue;
      }

      const composed = await composeInsight({ userId, profile, insightType, sourceDate: dateKey, data });
      if (isFinalType) await saveFinalInsight({ userId, date: dateKey, insightType, data, composed, source });
      if (!finalOnly) await saveDailyInsight({ userId, insightDate, sourceDate: dateKey, insightType, data, composed });
      result[insightType] = 'generated';
    } catch (err) {
      console.error(`[DailyInsight] ${insightType} failed for user ${userId} on ${dateKey}:`, err.message);
      result[insightType] = `failed: ${err.message}`;
    }
  }

  return result;
}

const hasFailures = (result) => Object.values(result).some((o) => String(o).startsWith('failed'));

/**
 * Users who logged or synced ANY data on the given IST day — the only users
 * the end-of-day job runs for. Asks each data collection "who has rows on
 * this date" (one indexed distinct() each) instead of walking all users and
 * computing a score per user to find out (~4 lakh queries for ~88 users).
 * Pass `userId` to check a single user.
 */
async function getUsersWithDataOn(dateKey, { userId = null } = {}) {
  const dayKey = utcMidnight(dateKey);
  const { start, end } = istDayWindow(dateKey);
  const scope = (field) => (userId ? { [field]: userId } : {});

  const lists = await Promise.all([
    FoodLog.distinct('userId', { ...scope('userId'), timestamp: { $gte: start, $lte: end } }),
    // > 0, not "row exists": the nutrition-score GET creates empty rows.
    NutritionSummary.distinct('userId', { ...scope('userId'), date: dayKey, $or: [{ waterIntake: { $gt: 0 } }, { totalCalories: { $gt: 0 } }] }),
    DailyActivityMetric.distinct('user', { ...scope('user'), date: dayKey, steps: { $gt: 0 } }),
    SleepSession.distinct('user', { ...scope('user'), date: dayKey }),
    ExerciseLog.distinct('userId', { ...scope('userId'), timestamp: { $gte: start, $lte: end } }),
    HealthMetric.distinct('userId', { ...scope('userId'), recordedAt: { $gte: start, $lte: end } }),
    User.distinct('_id', {
      ...scope('_id'),
      $or: [{ [`smokeLog.${dateKey}`]: { $exists: true } }, { [`alcoholLog.${dateKey}`]: { $exists: true } }],
    }),
  ]);

  const ids = [...new Set(lists.flat().map(String))];
  if (ids.length === 0) return [];
  const active = await User.distinct('_id', { _id: { $in: ids }, isActive: true, role: { $ne: 'doctor' } });
  return active.map(String);
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
 * In-process sweep over every user with data on `sourceDate` — the manual
 * admin backfill path. Production's nightly run fans the same per-user work
 * out through QStash instead (see controllers/insightController.js).
 */
async function runDailyInsightCron(sourceDate = istDateKey()) {
  const insightDate = shiftDateKey(sourceDate, 1);
  console.log(`💡 [DailyInsight] Generating insights from ${sourceDate} for display on ${insightDate}...`);

  const users = await getUsersWithDataOn(sourceDate);
  const stats = { users: users.length, generated: 0, skipped: 0, failed: 0 };

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((id) => processUserDay(id, sourceDate))
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
 * Cached insights whose text no longer matches the user's CURRENT category
 * labels — the only within-day staleness rule. Regenerating on any data
 * write (or on a raw-number threshold) re-ran the LLM on nearly every app
 * open, since step syncs and the nutrition-score GET touch rows constantly;
 * a label change (steps "low" -> "about_half", a first meal) is the point
 * where the text would actually say something different. An insight with no
 * stored categories predates this and counts as stale once.
 */
async function findStaleInsights(userId, cachedInsights) {
  const { user, profile } = await buildProfile(userId);
  const overallBySourceDate = new Map();
  const stale = [];

  for (const cached of cachedInsights) {
    const { insightType, sourceDate } = cached;
    try {
      let overallData = null;
      if (!OWN_SOURCE_TYPES.has(insightType)) {
        if (!overallBySourceDate.has(sourceDate)) {
          overallBySourceDate.set(sourceDate, await collectOverallData(userId, sourceDate));
        }
        overallData = overallBySourceDate.get(sourceDate);
      }
      const data = await collectDataForType(insightType, userId, sourceDate, { user, profile, overallData });
      if (!data) continue;
      if (cached.dataSnapshot?.promptVersion !== INSIGHT_PROMPT_VERSION
        || !sameCategories(buildCategories(insightType, data), cached.dataSnapshot?.categories)) {
        stale.push({ insightType, sourceDate });
      }
    } catch (err) {
      console.error(`[DailyInsight] staleness check failed for ${insightType}:`, err.message);
    }
  }
  return stale;
}

module.exports = {
  runDailyInsightCron,
  processUserDay,
  getUsersWithDataOn,
  hasFailures,
  ensureInsight,
  collectOverallData,
  getLatestSleepNightDateKey,
  getLatestActivityDateKey,
  getLatestOverallDateKey,
  findStaleInsights,
  INSIGHT_TYPES,
  istDateKey,
  shiftDateKey,
};
