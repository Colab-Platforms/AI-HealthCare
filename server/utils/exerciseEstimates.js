// Average stride length in meters, by activity category — used to estimate
// step count from distance when no per-session step time-series exists
// (WearableData only has whole-day step totals, not a session-window series).
const STRIDE_LENGTH_M = {
  running: 1.0,
  cardio: 0.75, // walking/cycling-adjacent default
  default: 0.75,
};

/** @returns {number|undefined} estimated steps, or undefined when distance is unknown */
function estimateSteps(activityType, distanceKm) {
  const distance = Number(distanceKm);
  if (!(distance > 0)) return undefined;

  const strideLength = activityType === 'running'
    ? STRIDE_LENGTH_M.running
    : STRIDE_LENGTH_M.default;

  return Math.round((distance * 1000) / strideLength);
}

/** @returns {number|undefined} min/km pace, or undefined when duration/distance is unknown */
function estimateAvgPace(durationMin, distanceKm) {
  const duration = Number(durationMin);
  const distance = Number(distanceKm);
  if (!(duration > 0) || !(distance > 0)) return undefined;
  return Math.round((duration / distance) * 100) / 100;
}

/** @returns {number} total kg lifted across all sets (0 if no exercises) */
function computeSessionVolumeKg(exercises) {
  if (!Array.isArray(exercises)) return 0;
  let totalKg = 0;
  for (const exercise of exercises) {
    for (const set of exercise.sets || []) {
      totalKg += (Number(set.reps) || 0) * (Number(set.weight) || 0);
    }
  }
  return Math.round(totalKg);
}

module.exports = { estimateSteps, estimateAvgPace, computeSessionVolumeKg };
