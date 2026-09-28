// Rule-based insight for the Activity Score — same spirit as
// nutritionInsightService.js and recoveryRecommendationService.js: NOT an
// AI/LLM call, derived purely from the already-computed actual/goal pairs
// activityAnalyticsService.js produces, so every sentence traces back to a
// real logged number. Kept in its own file — not merged into
// activityInsightService.js — because that file already answers a different
// question (personal-baseline drop-detection vs a goal); this one explains
// the Activity Score itself.
const { saturatingToGoal } = require('./healthScoreFormulas');
const { classifyCalendarBand } = require('../utils/calendarBand');

const SIGNAL_LABELS = {
  steps: 'Steps',
  movementMinutes: 'Cardio/Movement',
  strengthSessions: 'Strength',
};

const SIGNAL_ADVICE = {
  steps: 'a short walk, taking stairs, or a few extra errands on foot',
  movementMinutes: 'any sustained moderate movement — a brisk walk, cycling, sports, or a logged cardio session',
  strengthSessions: 'a logged strength/resistance session — gym, bodyweight training, or resistance bands',
};

/**
 * @param {Object} day - one entry from activityAnalyticsService (device, manual, movementMinutes, goals, activityScore)
 * @returns {Object} { band, headline, overallSummary, topGaps, recommendations, disclaimer }
 */
function buildActivityInsight(day) {
  const { device, manual, movementMinutes, goals, activityScore } = day;

  // Recompute each signal's own NAR-style score (0-100) — same formula and
  // same 3 signals dailyHealthScoreService.js uses (steps, movementMinutes,
  // strengthSessions), so a recommendation's estimated point-gain is
  // arithmetically consistent with how the real score would move.
  // movementMinutes is device-priority/manual-fallback (never both at once —
  // see dailyHealthScoreService.js's comment on why), so this never double-
  // counts the same workout the way separately scoring device.activeMinutes
  // AND manual.cardioMinutes used to.
  const signals = [];
  if (device.steps > 0 || goals.steps) {
    signals.push({ key: 'steps', actual: device.steps, goal: goals.steps, score: saturatingToGoal(device.steps, goals.steps) });
  }
  if (movementMinutes) {
    signals.push({
      key: 'movementMinutes',
      actual: movementMinutes.actual,
      goal: movementMinutes.goal,
      source: movementMinutes.source,
      score: saturatingToGoal(movementMinutes.actual, movementMinutes.goal),
    });
  }
  if (manual?.strengthSessionsLast7Days !== undefined && goals.strengthSessionsPerWeek) {
    const strengthScore = Math.min(100, (manual.strengthSessionsLast7Days / goals.strengthSessionsPerWeek) * 100);
    signals.push({ key: 'strengthSessions', actual: manual.strengthSessionsLast7Days, goal: goals.strengthSessionsPerWeek, source: 'manual', score: strengthScore });
  }

  const band = classifyCalendarBand(activityScore) || 'low';
  const bandHeadline = { optimal: 'Great activity day', good: 'Good activity day', low: 'Needs more movement today' }[band];

  const gaps = signals.filter((s) => s.score < 100).sort((a, b) => a.score - b.score);
  const nSignals = signals.length || 1;

  const topGaps = gaps.slice(0, 3).map((g) => {
    const pct = g.goal > 0 ? Math.round((g.actual / g.goal) * 100) : 0;
    // Source is only meaningful for movementMinutes (device-priority/manual-
    // fallback) — steps is always device, strength is always manual, so it'd
    // be redundant noise on those two.
    const sourceNote = g.key === 'movementMinutes' ? ` (from your ${g.source === 'device' ? 'wearable' : 'logged workout'})` : '';
    return {
      signal: g.key,
      label: SIGNAL_LABELS[g.key],
      source: g.source || (g.key === 'steps' ? 'device' : 'manual'),
      message: `${SIGNAL_LABELS[g.key]} was ${pct}% of your target (${g.actual} vs ${g.goal})${sourceNote}.`,
    };
  });

  // estimatedPointGain: how much the activityScore (equal-average of nSignals)
  // would rise if this ONE signal reached 100 — (100 - current) / nSignals.
  // Computed from the same equal-weight formula that produces the real score,
  // not an invented number.
  const recommendations = gaps.slice(0, 3).map((g) => ({
    action: `Get in ${SIGNAL_ADVICE[g.key]}`,
    estimatedPointGain: Math.round(((100 - g.score) / nSignals) * 10) / 10,
  })).sort((a, b) => b.estimatedPointGain - a.estimatedPointGain);

  const summary = gaps.length === 0
    ? 'You hit every activity target today — steps, cardio, and strength all on track.'
    : `Short on ${gaps.slice(0, 2).map((g) => SIGNAL_LABELS[g.key]).join(' and ')}.`;

  return {
    band,
    headline: bandHeadline,
    overallSummary: `${bandHeadline} — your Activity Score is ${Math.round(activityScore)}/100. ${summary}`,
    topGaps,
    recommendations,
    disclaimer: 'This is a wellness insight based on your logged activity, not medical or fitness-coaching advice.',
  };
}

module.exports = { buildActivityInsight };
