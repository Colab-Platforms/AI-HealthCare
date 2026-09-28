// Unified Health Score "explain this score" breakdown — powers the page a
// user reaches by tapping the Unified Health Score ring. Combines three
// things that already exist independently rather than computing anything new:
//   1. DailyHealthScore rows (per-day finalScore + components, already persisted)
//   2. HealthScoreConfig weights AT THE TIME each row was computed (rows carry
//      their own configVersion specifically so historical breakdowns stay
//      accurate even after weights are retuned — see HealthScoreConfig.js)
//   3. DailyInsight AI insights (dailyInsightService.js), generated on-demand
//      via ensureInsight() when the nightly cron never covered a requested day
const DailyHealthScore = require('../models/DailyHealthScore');
const HealthScoreConfig = require('../models/HealthScoreConfig');
const { ensureInsight } = require('./dailyInsightService');

const RANGE_DAYS = { daily: 1, weekly: 7, monthly: 30 };

// insightType in DailyInsight uses 'fitness' (legacy name, predates the
// Unified Health Score's 'activity' component) — see DailyInsight.js's
// schema comment. Every other component name matches its insightType 1:1.
const COMPONENT_TO_INSIGHT_TYPE = {
  sleep: 'sleep',
  nutrition: 'nutrition',
  activity: 'fitness',
  smoking: 'smoking',
  alcohol: 'alcohol',
  hydration: 'hydration',
  recovery: 'recovery',
};

const offsetFrom = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split('T')[0];
};

const hasComponents = (row) => row && row.components && Object.keys(row.components).length > 0;

function formatInsight(doc) {
  if (!doc) return { status: 'pending' };
  return {
    title: doc.title,
    description: doc.description,
    summary: doc.summary,
    status: 'ready',
  };
}

/**
 * Builds the componentBreakdown array for one aggregation window.
 * `rows` are the DailyHealthScore documents in range (oldest -> newest),
 * `weightsByVersion` maps configVersion -> that version's dailyWeights.
 */
function buildComponentBreakdown(rows, weightsByVersion, currentWeights) {
  // Which components actually appeared at least once in the range — a
  // component absent every day (e.g. user never logs alcohol) is left out
  // entirely rather than shown as a flat 0, matching the "absent, not zero"
  // convention DailyHealthScore.components already uses.
  const seen = new Set();
  rows.forEach((r) => Object.keys(r.components || {}).forEach((k) => seen.add(k)));

  return Array.from(seen).map((component) => {
    const scoresOnDaysPresent = rows
      .filter((r) => typeof r.components?.[component] === 'number')
      .map((r) => r.components[component]);

    const avgScore = scoresOnDaysPresent.length
      ? scoresOnDaysPresent.reduce((s, v) => s + v, 0) / scoresOnDaysPresent.length
      : null;

    // Weight shown is the CURRENTLY active config's, not each historical
    // row's own — deliberate simplification for weekly/monthly averages, so
    // a week straddling a weight change (like the one that just added
    // 'recovery') doesn't show a blended/ambiguous percentage. The actual
    // finalScore each day was computed with ITS OWN row's weights
    // (unaffected by this — see the per-day trend, which reads finalScore
    // directly from the stored row, never recomputed here).
    const weight = currentWeights?.[component] ?? null;
    const avgContribution = avgScore != null && weight != null
      ? Math.round(avgScore * weight * 10) / 10
      : null;

    return {
      component,
      avgScore: avgScore != null ? Math.round(avgScore * 10) / 10 : null,
      weight,
      avgContribution,
      daysLogged: scoresOnDaysPresent.length,
    };
  });
}

/**
 * @param {string} userId
 * @param {'daily'|'weekly'|'monthly'} range
 * @param {string} dateStr - 'YYYY-MM-DD', the END of the window (defaults handled by caller)
 */
async function getScoreBreakdown(userId, range, dateStr) {
  const windowDays = RANGE_DAYS[range];
  const startDate = offsetFrom(dateStr, windowDays - 1);

  const [rows, activeConfig] = await Promise.all([
    DailyHealthScore.find({ userId, date: { $gte: startDate, $lte: dateStr } })
      .sort({ date: 1 })
      .lean(),
    HealthScoreConfig.findOne({ isActive: true }).lean(),
  ]);

  const loggedRows = rows.filter(hasComponents);

  // Historical weights, batched — one query for every distinct configVersion
  // in range, not one query per row.
  const versions = [...new Set(loggedRows.map((r) => r.configVersion))];
  const configDocs = versions.length
    ? await HealthScoreConfig.find({ version: { $in: versions } }).select('version dailyWeights').lean()
    : [];
  const weightsByVersion = new Map(configDocs.map((c) => [c.version, c.dailyWeights]));

  const currentWeights = activeConfig?.dailyWeights || {};

  const finalScoreTrend = loggedRows.map((r) => ({ date: r.date, score: r.finalScore }));

  const componentBreakdown = buildComponentBreakdown(loggedRows, weightsByVersion, currentWeights);

  // AI insights are only ever fetched/generated for the single END date of
  // the window (not once per day in range) - a weekly/monthly view shows
  // ONE current narrative, not up to 30 AI calls. ensureInsight() itself
  // returns the cached DailyInsight if the nightly cron already generated
  // it, and only calls the model when it's genuinely missing.
  const insightTypesPresent = componentBreakdown.map((c) => COMPONENT_TO_INSIGHT_TYPE[c.component]);
  const [overallInsightDoc, ...componentInsightDocs] = await Promise.all([
    ensureInsight(userId, 'overall', dateStr).catch(() => null),
    ...insightTypesPresent.map((t) => ensureInsight(userId, t, dateStr).catch(() => null)),
  ]);

  const insightByComponent = new Map(
    componentBreakdown.map((c, i) => [c.component, componentInsightDocs[i]]),
  );

  return {
    success: true,
    range,
    startDate,
    endDate: dateStr,
    overallInsight: formatInsight(overallInsightDoc),
    finalScoreTrend,
    componentBreakdown: componentBreakdown.map((c) => ({
      ...c,
      insight: formatInsight(insightByComponent.get(c.component)),
    })),
  };
}

module.exports = { getScoreBreakdown, RANGE_DAYS };
