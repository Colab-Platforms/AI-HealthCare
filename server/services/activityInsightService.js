const DailyActivityMetric = require('../models/DailyActivityMetric');
const { mergeDeviceRows } = require('../utils/wearableMerge');
const { progressBand } = require('./insightCategories');

const STEP_MESSAGES = {
  not_started: "You haven't started moving yet — a short walk is an easy way to get going.",
  just_started: "You're just getting started on your step goal. A short walk would help build momentum.",
  low: "You're still well short of your step goal. A short walk after your next meal would help close the gap.",
  about_half: "You're about halfway to your step goal. One more walk would get you much closer.",
  close_to_goal: "You're close to your step goal — a short walk should get you there.",
  goal_met: "You've hit your step goal. Keep this pace up.",
};

const RECENT_WINDOW_DAYS = 3;
const BASELINE_WINDOW_DAYS = 30;
const MIN_BASELINE_DAYS = 7; // need real history before trusting a personal baseline

// Two independent signals, same pattern as sleepInsightService.js:
//
// 1. Goal-based ("activityAdherence"): are you hitting the step target you set?
// 2. Baseline-based ("activityBaseline"): are you moving less than YOUR OWN
//    recent normal, regardless of whether you're still technically hitting
//    the goal? A goal can be met while a real, personal drop-off is happening
//    (e.g. goal 8,000 but usual is 14,000, recent is 9,000 — goal met, but a
//    ~36% drop from normal that's worth surfacing).
//
// stepGoal is never modified by this — it stays exactly what the user set.
// stepGoal: from utils/stepGoal.js — callers always pass it.
async function getActivityInsight(userId, stepGoal) {
  const recentSince = new Date();
  recentSince.setUTCDate(recentSince.getUTCDate() - RECENT_WINDOW_DAYS);
  recentSince.setUTCHours(0, 0, 0, 0);

  const baselineSince = new Date();
  baselineSince.setUTCDate(baselineSince.getUTCDate() - BASELINE_WINDOW_DAYS);
  baselineSince.setUTCHours(0, 0, 0, 0);

  const activityMetrics = await DailyActivityMetric.find({ user: userId, date: { $gte: baselineSince } })
    .select('date deviceType steps')
    .lean();

  // One row per connected device per day — real devices on the same date are
  // summed (a clean mid-day switch), a manual entry is maxed against the
  // device total. See utils/wearableMerge.js.
  const rowsByDate = {};
  for (const m of activityMetrics) {
    if (!m.date) continue;
    const key = new Date(m.date).toISOString().split('T')[0];
    if (!rowsByDate[key]) rowsByDate[key] = [];
    rowsByDate[key].push(m);
  }
  const recentByDate = {};
  const baselineByDate = {}; // window BEFORE recentSince, so a current dip can't drag down its own baseline
  for (const [key, rows] of Object.entries(rowsByDate)) {
    const d = new Date(`${key}T00:00:00.000Z`);
    const steps = mergeDeviceRows(rows, ['steps']).steps;
    if (d >= recentSince) {
      recentByDate[key] = steps;
    } else if (d >= baselineSince) {
      baselineByDate[key] = steps;
    }
  }

  const recentDays = Object.values(recentByDate);
  if (recentDays.length < 2) {
    return { activityAdherence: 'insufficient_data', activityBaseline: 'insufficient_data', message: null };
  }
  const avgSteps = Math.round(recentDays.reduce((a, b) => a + b, 0) / recentDays.length);

  const activityAdherence = avgSteps < stepGoal * 0.6 ? 'below_goal' : 'meeting_goal';

  const baselineDays = Object.values(baselineByDate);
  let activityBaseline = 'insufficient_data';
  let personalBaselineSteps = null;

  if (baselineDays.length >= MIN_BASELINE_DAYS) {
    personalBaselineSteps = Math.round(baselineDays.reduce((a, b) => a + b, 0) / baselineDays.length);
    const threshold = personalBaselineSteps * 0.7;
    activityBaseline = avgSteps < threshold ? 'declining' : 'normal';
  }

  // The Fitness card's headline message — today's actual steps against the
  // user's own goal, not a recent-average-vs-30-day-baseline comparison.
  // The old "Your activity recently (X steps/day) is well below your own
  // usual pattern (Y steps/day)" wording cited numbers that don't match
  // anything else shown on screen (not today's step count, not the Activity
  // ring's score) and read as a disconnected, confusing stat next to them.
  // Worded, not numbered — the step count and goal are already on screen
  // right above this card.
  const todayKey = new Date().toISOString().split('T')[0];
  const todaySteps = rowsByDate[todayKey] ? mergeDeviceRows(rowsByDate[todayKey], ['steps']).steps : 0;
  const message = STEP_MESSAGES[progressBand(todaySteps, stepGoal)] || STEP_MESSAGES.not_started;

  return {
    activityAdherence,
    activityBaseline,
    avgStepsLast3Days: avgSteps,
    stepGoal,
    personalBaselineSteps,
    message,
  };
}

module.exports = { getActivityInsight };
