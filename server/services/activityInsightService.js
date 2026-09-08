const WearableData = require('../models/WearableData');

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
async function getActivityInsight(userId, stepGoal = 10000) {
  const recentSince = new Date();
  recentSince.setUTCDate(recentSince.getUTCDate() - RECENT_WINDOW_DAYS);
  recentSince.setUTCHours(0, 0, 0, 0);

  const baselineSince = new Date();
  baselineSince.setUTCDate(baselineSince.getUTCDate() - BASELINE_WINDOW_DAYS);
  baselineSince.setUTCHours(0, 0, 0, 0);

  const wearables = await WearableData.find({ user: userId })
    .select('dailyMetrics.date dailyMetrics.steps')
    .lean();

  const recentByDate = {};
  const baselineByDate = {}; // window BEFORE recentSince, so a current dip can't drag down its own baseline
  for (const w of wearables) {
    w.dailyMetrics?.forEach(m => {
      if (!m.date) return;
      const d = new Date(m.date);
      const key = d.toISOString().split('T')[0];
      if (d >= recentSince) {
        recentByDate[key] = (recentByDate[key] || 0) + (m.steps || 0);
      } else if (d >= baselineSince) {
        baselineByDate[key] = (baselineByDate[key] || 0) + (m.steps || 0);
      }
    });
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
  let message = null;

  if (baselineDays.length >= MIN_BASELINE_DAYS) {
    personalBaselineSteps = Math.round(baselineDays.reduce((a, b) => a + b, 0) / baselineDays.length);
    const threshold = personalBaselineSteps * 0.7;
    activityBaseline = avgSteps < threshold ? 'declining' : 'normal';
    if (activityBaseline === 'declining') {
      message = `Your activity recently (${avgSteps} steps/day) is well below your own usual pattern (${personalBaselineSteps} steps/day).`;
    }
  }

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
