// Rule-based recommendation derived purely from the recovery band + activity
// modifier already computed by recoveryScoreService — NOT an AI/LLM call and
// not the (separately, explicitly deferred) AI workout-recommendation engine.
// This is a fixed lookup table, same spirit as healthScoreFormulas.js: given
// inputs we already trust, map them to a canned, reviewable recommendation
// object. Copy avoids medical claims — see recoveryScoreService's product-
// language guidance ("not medical advice", never "you are sick").

const { getRecoveryFriendlyActivities } = require('../config/activityCatalog');

const BAND_COPY = {
  optimal: {
    headline: 'Great day to push',
    summary: 'Your body is primed — a good day for a harder session if you have one planned.',
    movement: { title: 'Movement', durationRange: '30-45 min', intensity: 'moderate to high', description: 'Higher-intensity training is well supported today.' },
  },
  moderate: {
    headline: 'Moderate day',
    summary: 'Your body may benefit from keeping physical strain moderate today.',
    movement: { title: 'Movement', durationRange: '20-30 min', intensity: 'light or moderate', description: 'Light or moderate movement keeps things ticking without adding to the load you are already carrying.' },
  },
  low: {
    headline: 'Take it easier today',
    summary: 'Your signals suggest lighter activity would suit you better today.',
    movement: { title: 'Movement', durationRange: '10-20 min', intensity: 'light', description: 'Keep movement gentle — a walk or light mobility work rather than a hard session.' },
  },
  very_low: {
    headline: 'Prioritize rest today',
    summary: 'Your signals are well below your usual range — today favors recovery over training.',
    movement: { title: 'Movement', durationRange: '0-15 min', intensity: 'very light', description: 'Rest, or very light movement like stretching or a short easy walk.' },
  },
};

// Independent of the band-derived movement suggestion: if the Activity engine
// itself flagged an overload (loadRatio > 1.2 — see recoveryScoreService),
// the recommendation should say so even on an otherwise "optimal" day, since
// the band already partly reflects yesterday's load but the reason is worth
// surfacing explicitly.
function buildRecommendation({ band, activity, sleepAvailable }) {
  if (!band) return null;
  const copy = BAND_COPY[band.key] || BAND_COPY.moderate;

  const summary = (activity?.available && activity.loadRatio > 1.2)
    ? `Your recent activity has been higher than usual. ${copy.summary}`
    : copy.summary;

  return {
    headline: copy.headline,
    summary,
    primaryRecommendation: copy.movement,
    sleep: 'Maintain your usual sleep schedule — same window, same wake time.',
    nutrition: "Don't unnecessarily under-fuel. Eat close to your normal intake.",
    hydration: 'Stay close to your normal hydration target through the day.',
    recommendedActivities: getRecoveryFriendlyActivities(band.key),
    disclaimer: "Recommendations are based on your available signals and may benefit your day — they are not medical advice.",
  };
}

module.exports = { buildRecommendation };
