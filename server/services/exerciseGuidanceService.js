// Age + goal based cardio/strength targets — a static lookup, not AI-generated.
// Grounded in the WHO 2020 Physical Activity Guidelines, cross-checked against
// ACSM's position stand (Garber et al., 2011) and the CDC Physical Activity
// Guidelines for Americans (2018), which converge on the same numbers.
//
// Deliberately NOT age-inverted the way popular assumption goes ("older = less
// exercise") — current exercise science treats strength/balance training as
// MORE important with age (sarcopenia and fall-risk prevention), not less.
function getExerciseGuidance(age, goalType) {
  const ageBucket = age <= 17 ? 'youth' : age <= 64 ? 'adult' : 'older_adult';

  const base = {
    youth: {
      cardio: '60 min/day, mostly aerobic play or sport',
      strength: '3x/week, bodyweight/bone-building focus',
      note: 'Avoid heavy weight-loading — growth plates still developing',
    },
    adult: {
      cardio: '150-300 min/week moderate (or 75-150 min vigorous)',
      strength: '2x/week minimum, major muscle groups',
      note: null,
    },
    older_adult: {
      cardio: '150 min/week moderate, low-impact preferred',
      strength: '3x/week — more important at this age, not less',
      note: 'Include balance training for fall prevention',
    },
  }[ageBucket];

  const guidance = { ...base, ageBucket };

  if (goalType === 'muscle_gain') {
    guidance.strength = '3-4x/week resistance training (primary focus)';
    guidance.cardio = 'Minimal, recovery-focused';
  } else if (goalType === 'weight_loss') {
    guidance.strength = `${base.strength} (preserve muscle while losing fat)`;
  }

  return guidance;
}

module.exports = { getExerciseGuidance };
