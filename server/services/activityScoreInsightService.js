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
  cardio: 'Cardio',
  strengthSessions: 'Strength',
};

const SIGNAL_ADVICE = {
  cardio: 'more steps (a walk, stairs, extra errands on foot) or a logged cardio session (cycling, swimming, sports)',
  strengthSessions: 'a logged strength/resistance session — gym, bodyweight training, or resistance bands',
};

/**
 * @param {Object} day - one entry from activityAnalyticsService (device, manual, movementMinutes, goals, activityScore)
 * @returns {Object} { band, headline, overallSummary, topGaps, recommendations, disclaimer }
 */
function buildActivityInsight(day) {
  const { device, manual, movementMinutes, goals, activityScore } = day;

  // Steps and Movement Minutes both describe the same underlying behavior
  // (walking moves both together) — same merge dailyHealthScoreService.js's
  // actual score now uses: take the BETTER of the two as one Cardio signal,
  // not two separate ones. Showing both as separate gaps here would have
  // recommended "walk more" on a day the real score already maxed out from a
  // logged swim, and the estimated point-gain for improving the LOSING
  // sub-signal would be arithmetically wrong (only the winning one feeds the
  // real score). This keeps the insight consistent with how the score
  // actually moves.
  const stepsScore = (device.steps > 0 || goals.steps) ? saturatingToGoal(device.steps, goals.steps) : null;
  const movementScore = movementMinutes ? saturatingToGoal(movementMinutes.actual, movementMinutes.goal) : null;

  const signals = [];
  if (stepsScore != null || movementScore != null) {
    const useSteps = movementScore == null || (stepsScore != null && stepsScore >= movementScore);
    signals.push({
      key: 'cardio',
      actual: useSteps ? device.steps : movementMinutes.actual,
      goal: useSteps ? goals.steps : movementMinutes.goal,
      source: useSteps ? 'device' : (movementMinutes?.source || 'device'),
      via: useSteps ? 'steps' : 'movement minutes',
      score: Math.max(stepsScore ?? -Infinity, movementScore ?? -Infinity),
    });
  }
  // Same gate dailyHealthScoreService.js's real score uses: only shown once
  // the user has actually done a strength session in the last 7 days (which
  // already includes today, the moment one is logged) — not merely because
  // the field exists on the day object. Showing a 0/100 strength gap here for
  // someone who has simply never trained with weights would not match what
  // the real score does (it omits the signal entirely in that case).
  if (goals.strengthSessionsPerWeek && manual?.strengthSessionsLast7Days > 0) {
    const strengthScore = Math.min(100, (manual.strengthSessionsLast7Days / goals.strengthSessionsPerWeek) * 100);
    signals.push({ key: 'strengthSessions', actual: manual.strengthSessionsLast7Days, goal: goals.strengthSessionsPerWeek, source: 'manual', score: strengthScore });
  }

  const band = classifyCalendarBand(activityScore) || 'low';
  const bandHeadline = { optimal: 'Great activity day', good: 'Good activity day', low: 'Needs more movement today' }[band];

  const gaps = signals.filter((s) => s.score < 100).sort((a, b) => a.score - b.score);
  const nSignals = signals.length || 1;

  const topGaps = gaps.slice(0, 3).map((g) => {
    const pct = g.goal > 0 ? Math.round((g.actual / g.goal) * 100) : 0;
    // `via` says which sub-signal is actually the better (winning) one today
    // — the only one that affects the real score — so the message never
    // tells a user their steps are short when it was movement minutes that
    // actually set the Cardio score, or the reverse.
    const viaNote = g.key === 'cardio' ? ` (best signal today: ${g.via})` : '';
    return {
      signal: g.key,
      label: SIGNAL_LABELS[g.key],
      source: g.source || 'manual',
      ...(g.key === 'cardio' ? { via: g.via } : {}),
      message: `${SIGNAL_LABELS[g.key]} was ${pct}% of your target (${g.actual} vs ${g.goal})${viaNote}.`,
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
    ? 'You hit every activity target today — cardio and strength both on track.'
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
