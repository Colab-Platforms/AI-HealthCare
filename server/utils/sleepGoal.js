// Single source of truth for a user's sleep goal and the scoring band built
// on it. Every place that needs "how many hours should this user sleep" reads
// it from here, instead of each one falling back to its own hardcoded 8.

// NSF-consensus sleep-duration bands by age. Unknown age falls back to the
// general adult band rather than guessing.
function getIdealSleepRange(age) {
  if (age == null) return { min: 7, max: 9 };
  if (age < 18) return { min: 8, max: 10 };
  if (age <= 64) return { min: 7, max: 9 };
  return { min: 7, max: 8 };
}

// Accepts a User doc (or any object shaped like one). An explicit
// profile.lifestyle.sleepGoalHours always wins; otherwise the goal is the
// midpoint of the age band. `targetRange` is what scoring and "within/below"
// checks use: full credit from the goal up to the band's top, so sleeping
// short of the goal is never scored as if it met it.
function getSleepGoal(user) {
  const age = user?.profile?.age ?? null;
  const healthyRange = getIdealSleepRange(age);
  const explicitGoal = user?.profile?.lifestyle?.sleepGoalHours;
  const isCustom = typeof explicitGoal === 'number' && explicitGoal > 0;
  const goalHours = isCustom ? explicitGoal : (healthyRange.min + healthyRange.max) / 2;

  return {
    goalHours,
    isCustom,
    healthyRange,
    targetRange: { min: goalHours, max: Math.max(goalHours, healthyRange.max) },
  };
}

module.exports = { getSleepGoal, getIdealSleepRange };
