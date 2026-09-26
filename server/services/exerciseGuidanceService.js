// Age + goal based cardio/strength targets — a static lookup, not AI-generated.
// Grounded in the WHO 2020 Physical Activity Guidelines, cross-checked against
// ACSM's position stand (Garber et al., 2011) and the CDC Physical Activity
// Guidelines for Americans (2018), which converge on the same numbers.
//
// Deliberately NOT age-inverted the way popular assumption goes ("older = less
// exercise") — current exercise science treats strength/balance training as
// MORE important with age (sarcopenia and fall-risk prevention), not less.
//
// Numeric, not text ("150-300 min/week moderate") — a UI needs a target it can
// build a progress bar against ("87/150 min"), not a range with a conditional
// clause it has to parse. Deliberately activity-agnostic: cardioMinutesPerWeek
// counts ANY activity tagged category:'cardio' in activityCatalog.js (badminton,
// swimming, dancing, running, ...), strengthSessionsPerWeek counts ANY activity
// tagged category:'strength' — never a specific sport. See exerciseAdherenceService.js
// for how actual logged minutes are compared against these targets.
//
// `profession` is optional — when absent, output is byte-identical to before
// this parameter existed (age+goal only). When present, it only adds an
// informational `professionNote`, never changes the numeric targets themselves
// — those stay grounded in the WHO/ACSM/CDC guidance above, not a profession-based guess.
function getExerciseGuidance(age, goalType, profession = null) {
  const ageBucket = age <= 17 ? 'youth' : age <= 64 ? 'adult' : 'older_adult';

  // stepsGoal: age-banded, from a 2025 peer-reviewed translation of WHO's
  // MVPA guideline into steps/day (Frontiers in Public Health, "Goal setting
  // for WHO guideline adherence: accelerometer steps/day translation of MVPA
  // in older adults") plus the CDC/WHO youth 60-min/day MVPA equivalent and
  // the widely-cited 7,500-10,000/day adult range for overall health and
  // longevity. NOT goal-type-adjusted — no published source varies a step
  // target by weight_loss/muscle_gain the way cardio-minutes/strength-sessions
  // do, so goalType intentionally has no effect on this one field.
  const base = {
    youth: {
      cardioMinutesPerWeek: 420, // 60 min/day, mostly aerobic play or sport
      strengthSessionsPerWeek: 3, // bodyweight/bone-building focus
      stepsGoal: 7000, // CDC/WHO 60-min/day MVPA equivalent (6,000-8,000 range, midpoint)
      note: 'Avoid heavy weight-loading — growth plates still developing',
    },
    adult: {
      cardioMinutesPerWeek: 150, // WHO's lower bound for moderate-intensity — the safe baseline target
      strengthSessionsPerWeek: 2, // major muscle groups
      stepsGoal: 7500, // lower bound of the 7,500-10,000/day range for overall health/longevity
      note: null,
    },
    older_adult: {
      cardioMinutesPerWeek: 150, // low-impact preferred
      strengthSessionsPerWeek: 3, // more important at this age, not less
      stepsGoal: 8602, // exact steps/day translation of WHO's 30-min/day MVPA for older adults
      note: 'Include balance training for fall prevention',
    },
  }[ageBucket];

  const guidance = { ...base, ageBucket };

  if (goalType === 'muscle_gain') {
    guidance.strengthSessionsPerWeek = 4; // resistance training becomes the primary focus
    guidance.cardioMinutesPerWeek = 60; // minimal, recovery-focused only
  } else if (goalType === 'weight_loss') {
    guidance.note = [guidance.note, 'Keep strength sessions up while cutting calories — preserves muscle while losing fat.']
      .filter(Boolean).join(' ');
  }

  if (profession === 'desk_job') {
    guidance.professionNote = 'Desk-based work means low incidental daily movement — short movement breaks every hour are worth adding on top of the above.';
  } else if (profession === 'physically_active_job') {
    guidance.professionNote = 'Your job already involves substantial physical activity — the targets above are on top of that, so lighter/shorter sessions may be enough to hit them.';
  }

  return guidance;
}

module.exports = { getExerciseGuidance };
