const WearableData = require('../models/WearableData');
const ExerciseLog = require('../models/ExerciseLog');

const RECENT_WINDOW_DAYS = 3;
const BASELINE_WINDOW_DAYS = 30;
const MIN_BASELINE_NIGHTS = 7; // need a real history before trusting a personal baseline

// Fact-based sleep-shortfall detection. No calorie/exercise number is changed
// here — this only decides whether to surface a notification, using two
// possible comparisons:
//
// 1. Personal rolling baseline (preferred): "are you sleeping less than YOUR
//    OWN recent normal?" — the pattern Whoop's "Sleep Need" conceptually uses
//    (a personalized baseline + recent deviation, not a fixed goal-percentage).
//    We don't have HRV so this isn't Whoop's exact algorithm, just the same
//    underlying idea applied to duration alone.
// 2. Fixed goal-percentage (fallback): used only when there isn't enough
//    history (<7 nights) to trust a personal baseline yet.
//
// The user's sleepGoalHours is NEVER modified by this — it stays exactly
// what they set. This function only decides whether to fire a notification.
async function getSleepInsight(userId, sleepGoalHours = 8) {
  const recentSince = new Date();
  recentSince.setUTCDate(recentSince.getUTCDate() - RECENT_WINDOW_DAYS);
  recentSince.setUTCHours(0, 0, 0, 0);

  const baselineSince = new Date();
  baselineSince.setUTCDate(baselineSince.getUTCDate() - BASELINE_WINDOW_DAYS);
  baselineSince.setUTCHours(0, 0, 0, 0);

  const wearables = await WearableData.find({ user: userId })
    .select('sleepData.date sleepData.totalSleepMinutes')
    .lean();

  const recentByDate = {};
  const baselineByDate = {}; // the window BEFORE recentSince, so a current dip can't drag down its own baseline
  for (const w of wearables) {
    w.sleepData?.forEach(s => {
      if (!s.date) return;
      const d = new Date(s.date);
      const hours = (s.totalSleepMinutes || 0) / 60;
      const key = d.toISOString().split('T')[0];
      if (d >= recentSince) {
        recentByDate[key] = hours;
      } else if (d >= baselineSince) {
        baselineByDate[key] = hours;
      }
    });
  }

  const recentNights = Object.values(recentByDate);
  if (recentNights.length < 2) {
    return { sleepAdherence: 'insufficient_data', message: null, exerciseSafetyNote: null };
  }
  const avgHours = recentNights.reduce((a, b) => a + b, 0) / recentNights.length;

  const baselineNights = Object.values(baselineByDate);
  let threshold, comparisonBasis, personalBaseline = null;
  if (baselineNights.length >= MIN_BASELINE_NIGHTS) {
    personalBaseline = baselineNights.reduce((a, b) => a + b, 0) / baselineNights.length;
    threshold = personalBaseline * 0.7;
    comparisonBasis = 'personal_baseline';
  } else {
    threshold = sleepGoalHours * 0.6;
    comparisonBasis = 'goal_fallback';
  }

  const isPoorSleep = avgHours < threshold;
  const roundedAvg = Math.round(avgHours * 10) / 10;

  const result = {
    sleepAdherence: isPoorSleep ? 'poor' : 'normal',
    avgHoursLast3Days: roundedAvg,
    sleepGoalHours,
    comparisonBasis,
    personalBaselineHours: personalBaseline ? Math.round(personalBaseline * 10) / 10 : null,
    message: isPoorSleep
      ? (comparisonBasis === 'personal_baseline'
          ? `Your average sleep recently (${roundedAvg}h) is well below your own usual pattern (${Math.round(personalBaseline * 10) / 10}h).`
          : `Your average sleep recently (${roundedAvg}h) is well below your ${sleepGoalHours}h goal.`)
      : null,
    exerciseSafetyNote: null,
  };

  if (isPoorSleep) {
    const recentExerciseCount = await ExerciseLog.countDocuments({ userId, timestamp: { $gte: recentSince } });
    if (recentExerciseCount > 0) {
      // Well-established sports-science consensus (not a numeric adjustment):
      // sleep deprivation + continued high training load raises injury/burnout
      // risk (Fullagar et al., "Sleep and Athletic Performance", Sports Medicine, 2015).
      result.exerciseSafetyNote = 'You have been training while under-slept — consider a lighter or recovery-focused session today to reduce injury/burnout risk.';
    }
  }

  return result;
}

module.exports = { getSleepInsight };
