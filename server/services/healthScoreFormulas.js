// Pure math functions for the Health Score engine — no DB access here.
// See docs/health-score-formulas.md for the full derivation and rationale.

const sigmoid = (x) => 1 / (1 + Math.exp(-x));

// "More is better" markers (steps, VO2max) — saturates past `mid`, doesn't reward indefinitely.
const sigmoidIncreasing = (value, mid, width) => 100 * sigmoid((value - mid) / width);

// "Less is better" markers (RHR, LDL, HbA1c) — mirror of the above.
const sigmoidDecreasing = (value, mid, width) => 100 * sigmoid(-(value - mid) / width);

// "Optimal-range" markers (sleep duration, weight-ratio) — penalizes both directions.
const gaussian = (value, target, width) => 100 * Math.exp(-((value - target) ** 2) / (2 * width ** 2));

// "Hit the goal, then plateau" markers (hydration) — an S-curve that reaches
// exactly 100 at `goal` and stays there beyond it.
//
// A Gaussian is wrong for these: it's symmetric, so it punished 10 glasses of
// water exactly as hard as 6, and 12 as hard as 4 — but drinking past the goal
// isn't unhealthy the way sleeping 4 hours past it is. This keeps the useful
// half of that shape (diminishing returns approaching the goal, real cost for
// falling well short) and drops the penalty for exceeding it.
//
// Shape is derived from `goal` alone — midpoint at half the goal, width a
// sixth of it — so the curve lands near-flat at 0 and saturates right at the
// goal. Normalizing by the value AT the goal is what pins it to exactly 100
// there, rather than the ~95 a raw sigmoid would give.
const saturatingToGoal = (value, goal) => {
  const mid = goal / 2;
  const width = goal / 6;
  const ratio = sigmoid((value - mid) / width) / sigmoid((goal - mid) / width);
  return 100 * Math.min(1, ratio);
};

// Blood pressure: AHA clinical categories, not an invented Gaussian width —
// systolic and diastolic are scored independently against the category table,
// and the WORSE (lower-scoring) of the two wins. A high reading on either
// number is real risk; averaging them away would hide it.
function scoreBloodPressure(systolic, diastolic, categories) {
  const categoryFor = (sys, dia) =>
    categories.find((c) => sys <= c.maxSystolic && dia <= c.maxDiastolic) || categories[categories.length - 1];

  const bySystolic = categories.find((c) => systolic <= c.maxSystolic) || categories[categories.length - 1];
  const byDiastolic = categories.find((c) => diastolic <= c.maxDiastolic) || categories[categories.length - 1];
  void categoryFor; // kept for readability of intent above

  return Math.min(bySystolic.score, byDiastolic.score);
}

// Welford's online algorithm — updates running mean/variance with O(1) work
// per new data point, no need to replay history. `baseline` is the current
// { count, mean, m2 } (m2 = sum of squared deviations); returns the updated one.
function updateRunningBaseline(baseline, newValue) {
  const count = (baseline?.count || 0) + 1;
  const prevMean = baseline?.mean || 0;
  const mean = prevMean + (newValue - prevMean) / count;
  const m2 = (baseline?.m2 || 0) + (newValue - prevMean) * (newValue - mean);
  return { count, mean, m2, lastValue: newValue, lastUpdated: new Date() };
}

function stdDev(baseline) {
  if (!baseline || baseline.count < 2) return null; // not enough points for a meaningful spread
  return Math.sqrt(baseline.m2 / (baseline.count - 1));
}

// Population-to-personal blend: a brand-new user (n=0) is judged almost
// entirely against `populationNorm`; as n grows, their own running mean
// (`baseline.mean`) takes over. No dead zone — a usable number from day one.
function blendedBaseline(baseline, populationNorm, tau) {
  const n = baseline?.count || 0;
  const alpha = Math.exp(-n / tau);
  const personalMean = n > 0 ? baseline.mean : populationNorm;
  return alpha * populationNorm + (1 - alpha) * personalMean;
}

module.exports = {
  sigmoidIncreasing,
  sigmoidDecreasing,
  gaussian,
  saturatingToGoal,
  scoreBloodPressure,
  updateRunningBaseline,
  stdDev,
  blendedBaseline,
};
