// Single source of truth for a user's daily step goal. Every place that
// needs "how many steps should this user walk" reads it from here, instead
// of some reading the age-based goal and others a hardcoded 10,000.
const { getExerciseGuidance } = require('../services/exerciseGuidanceService');

// Accepts a User doc (or any object shaped like one). An explicit
// profile.lifestyle.stepGoal always wins; otherwise the age-banded goal from
// exerciseGuidanceService (WHO-based, e.g. 7,500 for adults). `age` lets a
// caller pass the age it already uses for the rest of its guidance (an
// active HealthGoal's age, for instance).
function getStepGoal(user, age = user?.profile?.age) {
  const explicitGoal = user?.profile?.lifestyle?.stepGoal;
  const isCustom = typeof explicitGoal === 'number' && explicitGoal > 0;
  return {
    goalSteps: isCustom ? explicitGoal : getExerciseGuidance(age, null).stepsGoal,
    isCustom,
  };
}

module.exports = { getStepGoal };
