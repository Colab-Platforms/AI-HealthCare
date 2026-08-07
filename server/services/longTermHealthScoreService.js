const HealthScoreConfig = require('../models/HealthScoreConfig');
const DailyHealthScore = require('../models/DailyHealthScore');
const HealthReport = require('../models/HealthReport');
const HealthMetric = require('../models/HealthMetric');
const User = require('../models/User');
const { scoreBloodPressure } = require('./healthScoreFormulas');

const STATUS_SCORE_MAP = { normal: 90, high: 45, low: 45 };

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function daysAgoStr(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split('T')[0];
}

// Clinical Score: mean of per-marker normalized scores on the latest report.
// Blood pressure is scored via clinical AHA categories (see
// healthScoreFormulas.scoreBloodPressure) using the dedicated HealthMetric
// log — not the report's free-text value — since it's already structured
// (systolic/diastolic) there. Every other marker uses the AI's own
// normal/high/low classification, since that's the only reliably-structured
// signal the report analysis currently emits per marker.
async function calculateClinicalScore(userId, config) {
  const latestReport = await HealthReport.findOne({ user: userId, status: 'completed' })
    .sort({ createdAt: -1 })
    .lean();
  if (!latestReport?.aiAnalysis?.metrics) return null;

  const scores = [];
  for (const marker of Object.values(latestReport.aiAnalysis.metrics)) {
    if (marker?.status && STATUS_SCORE_MAP[marker.status] !== undefined) {
      scores.push(STATUS_SCORE_MAP[marker.status]);
    }
  }

  const latestBP = await HealthMetric.findOne({ userId, type: 'blood_pressure' }).sort({ recordedAt: -1 }).lean();
  if (latestBP?.systolic && latestBP?.diastolic) {
    scores.push(scoreBloodPressure(latestBP.systolic, latestBP.diastolic, config.bloodPressureCategories));
  }

  if (scores.length === 0) return null;
  return { score: scores.reduce((a, b) => a + b, 0) / scores.length, report: latestReport };
}

// Risk Adjustment: a severe marker multiplicatively derates the WHOLE score
// (floored, never averaged away) — see docs/health-score-formulas.md Sec 6.2.
function calculateRiskAdjustmentFactor(report, config) {
  const weights = config.riskAdjustment.severityWeights || { mild: 0.05, moderate: 0.15, severe: 0.3 };
  const deficiencies = report?.aiAnalysis?.deficiencies || [];
  const totalSeverity = deficiencies.reduce((sum, d) => sum + (weights[d.severity] || 0), 0);
  return Math.max(config.riskAdjustment.floor, 1 - totalSeverity);
}

async function calculateLifestyleScore(userId) {
  const since = daysAgoStr(29); // last 30 days inclusive of today
  const days = await DailyHealthScore.find({ userId, date: { $gte: since } }).lean();
  if (days.length === 0) return null;
  return days.reduce((sum, d) => sum + d.finalScore, 0) / days.length;
}

async function calculateConsistencyScore(userId, config) {
  const since = daysAgoStr(29);
  const days = await DailyHealthScore.find({ userId, date: { $gte: since } }).lean();
  if (days.length < config.minHistoryDays.consistency) return null; // too little history to be meaningful

  const withConsistencyComponent = days.filter((d) => typeof d.components?.consistency === 'number');
  if (withConsistencyComponent.length === 0) return null;
  return withConsistencyComponent.reduce((sum, d) => sum + d.components.consistency, 0) / withConsistencyComponent.length;
}

// Trend: recent 7-day average vs the preceding period average, mapped to a
// ±15-point bonus/malus (not a raw percentage — a modest nudge, not a swing
// large enough to dominate the composite).
async function calculateTrendScore(userId, config) {
  const days = await DailyHealthScore.find({ userId, date: { $gte: daysAgoStr(29) } }).sort({ date: 1 }).lean();
  if (days.length < config.minHistoryDays.trend) return null;

  const recentWindow = days.slice(-7);
  const priorWindow = days.slice(0, -7);
  if (priorWindow.length === 0) return null; // need a "before" period to compare against

  const avg = (arr) => arr.reduce((s, d) => s + d.finalScore, 0) / arr.length;
  const recentAvg = avg(recentWindow);
  const priorAvg = avg(priorWindow);
  const delta = recentAvg - priorAvg; // in score points, roughly -100..100

  const bonus = Math.max(-15, Math.min(15, delta)); // clamp to ±15
  return 50 + bonus; // expressed on the same 0-100 scale as other components (50 = flat/no change)
}

async function calculateLongTermScore(userId) {
  const config = await HealthScoreConfig.findOne({ isActive: true }).lean();
  if (!config) throw new Error('No active HealthScoreConfig found');

  const [clinical, lifestyle, consistency, trend] = await Promise.all([
    calculateClinicalScore(userId, config),
    calculateLifestyleScore(userId),
    calculateConsistencyScore(userId, config),
    calculateTrendScore(userId, config),
  ]);

  const values = {
    clinical: clinical?.score ?? null,
    lifestyle,
    consistency,
    trend,
  };

  const availableKeys = Object.keys(values).filter((k) => values[k] !== null);
  const totalAvailableWeight = availableKeys.reduce((sum, k) => sum + config.longTermWeights[k], 0);

  let rawScore = 0;
  if (totalAvailableWeight > 0) {
    rawScore = availableKeys.reduce(
      (sum, k) => sum + values[k] * (config.longTermWeights[k] / totalAvailableWeight),
      0,
    );
  }

  const riskAdjustmentFactor = clinical?.report ? calculateRiskAdjustmentFactor(clinical.report, config) : 1;
  const finalScore = rawScore * riskAdjustmentFactor;

  const daysOfHistory = await DailyHealthScore.countDocuments({ userId, date: { $gte: daysAgoStr(89) } });

  const snapshot = {
    value: Math.round(finalScore * 10) / 10,
    components: {
      clinical: values.clinical !== null ? Math.round(values.clinical * 10) / 10 : undefined,
      lifestyle: values.lifestyle !== null ? Math.round(values.lifestyle * 10) / 10 : undefined,
      consistency: values.consistency !== null ? Math.round(values.consistency * 10) / 10 : undefined,
      trend: values.trend !== null ? Math.round(values.trend * 10) / 10 : undefined,
    },
    riskAdjustmentFactor: Math.round(riskAdjustmentFactor * 100) / 100,
    daysOfHistory,
    configVersion: config.version,
    computedAt: new Date(),
  };

  await User.findByIdAndUpdate(userId, { compositeHealthScore: snapshot });
  return snapshot;
}

module.exports = { calculateLongTermScore, todayStr, daysAgoStr };
