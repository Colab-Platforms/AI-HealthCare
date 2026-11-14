// The Activity Score formula, in one place. dailyHealthScoreService (the
// persisted score) and activityScoreInsightService (the Activity tab's
// explanation) both call this, so the number and its explanation can't drift.
//
// Activity = equal average of two pillars:
//   Cardio   = the BETTER of steps and movement minutes. Either one alone can
//              hit the goal: a walker has no movement minutes, a swimmer has
//              almost no steps, and the same walk must not count twice.
//   Strength = minutes only, shown per day: the last 7 days' average daily
//              strength minutes vs the weekly target / 7. Averaging over the
//              week means a correctly-spaced rest day doesn't drop to 0.
//              Counted as 0 (not skipped) whenever cardio is scored, so a user
//              who never trains strength can't outscore one who trains a bit.
const { saturatingToGoal } = require('./healthScoreFormulas');

/**
 * @param {Object} p
 * @param {number} [p.steps]                 device steps today
 * @param {number} [p.stepGoal]
 * @param {Object|null} [p.movementMinutes]  { actual, goal, source } or null
 * @param {number} [p.strengthMinutes7d]     strength minutes in the 7-day window
 * @param {number} [p.strengthGoalMinutesPerWeek] scored exactly; shown to the user per day
 * @param {boolean} [p.mobilityLimited]      steps are not scored for these users
 * @returns {{score: number|null, cardio: Object|null, strength: Object|null}}
 */
function scoreActivity({
  steps = 0,
  stepGoal,
  movementMinutes = null,
  strengthMinutes7d = 0,
  strengthGoalMinutesPerWeek,
  mobilityLimited = false,
} = {}) {
  const stepsScore = steps > 0 && stepGoal > 0 && !mobilityLimited ? saturatingToGoal(steps, stepGoal) : null;
  const movementScore = movementMinutes?.actual > 0 && movementMinutes.goal > 0
    ? saturatingToGoal(movementMinutes.actual, movementMinutes.goal)
    : null;

  let cardio = null;
  if (stepsScore != null || movementScore != null) {
    // Ties go to steps: it's the signal the user sees on the dashboard.
    const usedFrom = movementScore == null || (stepsScore != null && stepsScore >= movementScore) ? 'steps' : 'movement';
    cardio = {
      score: round1(Math.max(stepsScore ?? 0, movementScore ?? 0)),
      usedFrom,
      stepsScore: stepsScore == null ? null : round1(stepsScore),
      movementScore: movementScore == null ? null : round1(movementScore),
    };
  }

  const minutes = Math.max(0, Number(strengthMinutes7d) || 0);
  let strength = null;
  // No day with nothing at all gets a strength 0 that becomes the whole score.
  if (strengthGoalMinutesPerWeek > 0 && (cardio || minutes > 0)) {
    // avg/day vs goal/day == 7-day total vs weekly goal; scored on the exact
    // ratio so hitting the target is exactly 100, not 99.7 from rounding.
    strength = {
      score: round1(Math.min(100, (minutes / strengthGoalMinutesPerWeek) * 100)),
      actualMinutesPerDay: round1(minutes / 7),
      goalMinutesPerDay: strengthGoalPerDay(strengthGoalMinutesPerWeek),
      last7DaysMinutes: round1(minutes),
    };
  }

  // Strength without any cardio data counts cardio as 0, so a strength-only
  // day caps at 50 instead of a full 100. Mobility-limited users are exempt:
  // their steps are never scored, so a missing cardio is not their shortfall.
  if (!cardio && strength && !mobilityLimited) {
    cardio = { score: 0, usedFrom: null, stepsScore: null, movementScore: null };
  }

  const parts = [cardio?.score, strength?.score].filter((s) => s != null);
  const score = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
  return { score, cardio, strength };
}

const round1 = (n) => Math.round(n * 10) / 10;

// The per-day strength goal everyone (score, insight, app) sees: 60/week -> 8.6.
const strengthGoalPerDay = (minutesPerWeek) => round1(minutesPerWeek / 7);

module.exports = { scoreActivity, strengthGoalPerDay };
