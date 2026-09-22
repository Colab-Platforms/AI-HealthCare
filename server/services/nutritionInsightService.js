// Rule-based insight/recommendation layer for the Nutrition Score — same
// spirit as recoveryRecommendationService.js: NOT an AI/LLM call, a fixed
// lookup derived purely from the already-computed score breakdown
// (dietQualityScoreService's NAR/componentScore per nutrient), so every
// sentence traces back to a real logged number, never a canned generic tip
// unrelated to what the user actually ate.

// Food sources per nutrient — standard, well-established lists matching how
// NIH ODS's own fact sheets describe "food sources" for each nutrient. Not
// exhaustive, just the most commonly recognized sources, for actionable copy.
const FOOD_SOURCES = {
  fiber: 'whole grains, dal/legumes, fruits, and vegetables',
  vitaminA: 'carrots, sweet potato, spinach, and other leafy greens',
  vitaminC: 'citrus fruits, amla, bell peppers, and broccoli',
  vitaminD: 'fatty fish, egg yolk, fortified milk, and sunlight exposure',
  vitaminB12: 'eggs, dairy, fish, and fortified cereals',
  iron: 'spinach, lentils, beans, and lean red meat',
  calcium: 'dairy (milk, yogurt, paneer), tofu, and leafy greens',
  potassium: 'banana, potato, spinach, and beans',
  magnesium: 'nuts, seeds, whole grains, and spinach',
  omega3: 'fatty fish, walnuts, flaxseed, and chia seeds',
};

const MODERATION_ADVICE = {
  saturatedFat: 'fried foods, ghee/butter, and fatty cuts of meat — swap toward olive oil, nuts, or fish',
  sugar: 'sweets, sugary drinks, and desserts',
  sodium: 'processed/packaged food, pickles, and extra added salt',
};

const AMDR_LABEL = { protein: 'protein', carbs: 'carbohydrate', fat: 'fat' };

const SCORE_BANDS = [
  { min: 85, key: 'excellent', headline: 'Excellent nutrition today' },
  { min: 70, key: 'good', headline: 'Good nutrition today' },
  { min: 55, key: 'fair', headline: 'Fair — room to improve' },
  { min: 0, key: 'needs_attention', headline: 'Needs attention today' },
];

function getBand(score) {
  return SCORE_BANDS.find((b) => score >= b.min);
}

function nutrientLabel(key) {
  const labels = {
    fiber: 'Fiber', vitaminA: 'Vitamin A', vitaminC: 'Vitamin C', vitaminD: 'Vitamin D',
    vitaminB12: 'Vitamin B12', iron: 'Iron', calcium: 'Calcium', potassium: 'Potassium',
    magnesium: 'Magnesium', omega3: 'Omega-3',
    saturatedFat: 'Saturated Fat', sugar: 'Added Sugar', sodium: 'Sodium',
  };
  return labels[key] || key;
}

/**
 * @param {Object} scoreResult - output of calculateDietQualityScore()
 * @returns {Object} { headline, summary, topGaps, topExcesses, recommendations }
 */
function buildNutritionInsight(scoreResult) {
  const { score, breakdown } = scoreResult;
  const band = getBand(score);

  // Weakest nutrients — real NARs sorted ascending, worst first. Only ones
  // genuinely short (nar < 1) are gaps; a nutrient already at/above target
  // isn't something to flag as "add more of".
  const gaps = breakdown.healthyNutrients
    .filter((n) => n.nar < 1)
    .sort((a, b) => a.nar - b.nar);

  // Nutrients breaching the moderation caps — real componentScore sorted
  // ascending, worst breach first.
  const excesses = breakdown.junkControl
    .filter((n) => n.componentScore < 1)
    .sort((a, b) => a.componentScore - b.componentScore);

  const topGaps = gaps.slice(0, 3).map((g) => {
    const isAmdr = g.nutrient.endsWith('Amdr');
    if (isAmdr) {
      const macro = g.nutrient.replace('Amdr', '').toLowerCase();
      const [min, max] = g.target;
      const direction = g.actual < min ? 'low' : 'high';
      return {
        nutrient: g.nutrient,
        label: `${AMDR_LABEL[macro]} balance`,
        message: direction === 'low'
          ? `Your ${AMDR_LABEL[macro]} was ${g.actual}% of today's calories, below the ${min}-${max}% balanced range.`
          : `Your ${AMDR_LABEL[macro]} was ${g.actual}% of today's calories, above the ${min}-${max}% balanced range.`,
      };
    }
    const percentOfTarget = g.target > 0 ? Math.round((g.actual / g.target) * 100) : 0;
    return {
      nutrient: g.nutrient,
      label: nutrientLabel(g.nutrient),
      message: `${nutrientLabel(g.nutrient)} was ${percentOfTarget}% of your target today. Good sources: ${FOOD_SOURCES[g.nutrient] || 'a variety of whole foods'}.`,
    };
  });

  const topExcesses = excesses.slice(0, 3).map((e) => {
    const percentOverCap = e.cap > 0 ? Math.round((e.actual / e.cap) * 100) : 0;
    const label = nutrientLabel(e.nutrient);
    return {
      nutrient: e.nutrient,
      label,
      message: `You were at ${percentOverCap}% of today's ${label} limit. Watch out for: ${MODERATION_ADVICE[e.nutrient] || 'high-processed items'}.`,
    };
  });

  // "Things that would help" — same idea as the reference design's point-
  // delta list, but the point value is COMPUTED from the real formula (how
  // many points the score would gain if this one component hit nar/score=1),
  // not an invented number.
  const totalAdequacyComponents = breakdown.healthyNutrients.length;
  const totalModerationComponents = breakdown.junkControl.length;

  const recommendations = [
    ...gaps.slice(0, 2).map((g) => {
      const pointGain = Math.round(((1 - g.nar) / totalAdequacyComponents) * 60 * 10) / 10;
      const isAmdr = g.nutrient.endsWith('Amdr');
      const action = isAmdr
        ? `Adjust your ${AMDR_LABEL[g.nutrient.replace('Amdr', '').toLowerCase()]} intake toward a more balanced share of calories`
        : `Add more ${nutrientLabel(g.nutrient)}-rich foods — ${FOOD_SOURCES[g.nutrient] || 'a variety of whole foods'}`;
      return { action, estimatedPointGain: pointGain };
    }),
    ...excesses.slice(0, 2).map((e) => {
      const pointGain = Math.round(((1 - e.componentScore) / totalModerationComponents) * 40 * 10) / 10;
      return {
        action: `Cut back on ${MODERATION_ADVICE[e.nutrient] || e.nutrient}`,
        estimatedPointGain: pointGain,
      };
    }),
  ].sort((a, b) => b.estimatedPointGain - a.estimatedPointGain);

  const summary = gaps.length === 0 && excesses.length === 0
    ? 'Your nutrient intake and moderation were both well balanced today.'
    : [
      gaps.length > 0 ? `Short on ${gaps.slice(0, 2).map((g) => (g.nutrient.endsWith('Amdr') ? `${AMDR_LABEL[g.nutrient.replace('Amdr', '').toLowerCase()]} balance` : nutrientLabel(g.nutrient))).join(' and ')}.` : null,
      excesses.length > 0 ? `Over the limit on ${excesses.slice(0, 2).map((e) => nutrientLabel(e.nutrient) || e.nutrient).join(' and ')}.` : null,
    ].filter(Boolean).join(' ');

  // One paragraph that stands on its own — the headline + score + the
  // gap/excess summary combined, so a client that only wants ONE string to
  // show (a card subtitle, a notification body) doesn't have to stitch
  // pieces together itself.
  const overallSummary = `${band.headline} — your Nutrition Score is ${score}/100. ${summary}`;

  return {
    band: band.key,
    headline: band.headline,
    overallSummary,
    summary,
    topGaps,
    topExcesses,
    recommendations,
    disclaimer: 'This is a wellness insight based on your logged food, not medical or dietetic advice.',
  };
}

module.exports = { buildNutritionInsight };
