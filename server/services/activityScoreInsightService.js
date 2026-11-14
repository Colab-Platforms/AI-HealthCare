// Rule-based insight for the Activity Score — same spirit as
// nutritionInsightService.js and recoveryRecommendationService.js: NOT an
// AI/LLM call, derived purely from the already-computed actual/goal pairs
// activityAnalyticsService.js produces, so every sentence traces back to a
// real logged number. Kept in its own file — not merged into
// activityInsightService.js — because that file already answers a different
// question (personal-baseline drop-detection vs a goal); this one explains
// the Activity Score itself.
const { scoreActivity } = require('./activityScoreFormula');
const { classifyCalendarBand } = require('../utils/calendarBand');

const SIGNAL_LABELS = {
  cardio: 'Cardio',
  strength: 'Strength',
};

const SIGNAL_ADVICE = {
  cardio: 'more steps (a walk, stairs, extra errands on foot) or a logged cardio session (cycling, swimming, sports)',
  strength: 'a logged strength/resistance session — gym, bodyweight training, or resistance bands',
};

/**
 * The same cardio/strength breakdown the persisted score uses, from one
 * activityAnalyticsService day (or period-average) entry. The exact weekly
 * strength target is passed separately; the response only carries it per day.
 */
function activityBreakdown({ device, manual, movementMinutes, goals }, strengthMinutesPerWeek = (goals?.strength?.minutesPerDay || 0) * 7) {
  const { cardio, strength } = scoreActivity({
    steps: device?.steps || 0,
    stepGoal: goals?.cardio?.steps,
    movementMinutes,
    strengthMinutes7d: manual?.strengthMinutesLast7Days || 0,
    strengthGoalMinutesPerWeek: strengthMinutesPerWeek,
  });
  return { cardio, strength };
}

/**
 * @param {Object} day - one entry from activityAnalyticsService (device, manual, movementMinutes, goals, activityScore)
 * @returns {Object} { band, headline, overallSummary, topGaps, recommendations, disclaimer }
 */
function buildActivityInsight(day, strengthMinutesPerWeek) {
  const { device, movementMinutes, goals, activityScore } = day;

  // Built from the shared formula so gaps and point-gains match the real score.
  const { cardio, strength } = activityBreakdown(day, strengthMinutesPerWeek);
  const signals = [];
  if (cardio) {
    // usedFrom is null when there was no cardio data at all (scored as 0):
    // report it against the step goal.
    const useSteps = cardio.usedFrom !== 'movement';
    signals.push({
      key: 'cardio',
      actual: useSteps ? (device?.steps || 0) : movementMinutes.actual,
      goal: useSteps ? goals.cardio.steps : movementMinutes.goal,
      source: useSteps ? 'device' : (movementMinutes?.source || 'device'),
      via: useSteps ? 'steps' : 'movement minutes',
      score: cardio.score,
    });
  }
  if (strength) {
    signals.push({ key: 'strength', actual: strength.actualMinutesPerDay, goal: strength.goalMinutesPerDay, unit: 'min/day', source: 'manual', score: strength.score });
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
      message: `${SIGNAL_LABELS[g.key]} was ${pct}% of your target (${g.actual} vs ${g.goal}${g.unit ? ` ${g.unit}` : ''})${viaNote}.`,
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

module.exports = { buildActivityInsight, activityBreakdown };
