const User = require('../models/User');
const DailyHealthScore = require('../models/DailyHealthScore');
const { calculateDailyScore } = require('../services/dailyHealthScoreService');
const { daysAgoStr } = require('../services/longTermHealthScoreService');

// GET /api/health/score — powers the Dashboard's Health Score ring + sub-cards.
// Ensures today's Daily Score is fresh (the user is actively waiting on this
// read, so we compute synchronously here rather than relying on the
// fire-and-forget trigger from the last log write, which may be stale by a
// few minutes or may not have fired yet if today's first log hasn't happened).
exports.getHealthScore = async (req, res) => {
  try {
    const userId = req.user._id;
    const todayStr = new Date().toISOString().split('T')[0];

    const [todayScore, user] = await Promise.all([
      calculateDailyScore(userId, todayStr).catch(() => null),
      User.findById(userId).select('compositeHealthScore').lean(),
    ]);

    // A day with no logged components still gets a persisted row (finalScore
    // 0) so the engine has a slot to fill as the day goes on — but 0 there
    // means "nothing logged yet", not "scored zero". Every comparison below
    // skips those rows: averaging them in would drag the week down, and
    // comparing against one would report a catastrophic drop every morning
    // before the user's first log of the day.
    const hasComponents = (s) => s && Object.keys(s.components || {}).length > 0;

    // Raw week-over-week delta for the UI's "+N this week" pill — separate
    // from the Long-Term Score's own clamped ±15 Trend component, which is
    // meant to be gentle, not a literal display number.
    const [recentWeek, priorWeek, yesterdayScore] = await Promise.all([
      DailyHealthScore.find({ userId, date: { $gte: daysAgoStr(6) } }).lean(),
      DailyHealthScore.find({ userId, date: { $gte: daysAgoStr(13), $lt: daysAgoStr(6) } }).lean(),
      DailyHealthScore.findOne({ userId, date: daysAgoStr(1) }).lean(),
    ]);
    const avg = (arr) => {
      const logged = arr.filter(hasComponents);
      return logged.length ? logged.reduce((s, d) => s + d.finalScore, 0) / logged.length : null;
    };
    const recentAvg = avg(recentWeek);
    const priorAvg = avg(priorWeek);
    const weeklyChange = recentAvg !== null && priorAvg !== null ? Math.round(recentAvg - priorAvg) : null;

    // Day-over-day view. A single day is noisy on its own — that's why the
    // Long-Term Trend component deliberately smooths over 7 days — but the
    // user still wants same-day feedback on what they did yesterday vs today,
    // so it's surfaced here as a plain delta rather than folded into any score.
    const dailyChange = hasComponents(todayScore) && hasComponents(yesterdayScore)
      ? Math.round((todayScore.finalScore - yesterdayScore.finalScore) * 10) / 10
      : null;

    // Per-component deltas — the "why did my score move" breakdown. Only
    // components present on BOTH days are comparable: a component missing
    // today isn't a drop to zero, it's un-logged, and pretending otherwise
    // would report a huge fake decline every time someone skips one habit.
    let componentChanges = null;
    if (hasComponents(todayScore) && hasComponents(yesterdayScore)) {
      const todayComponents = todayScore.components || {};
      const yesterdayComponents = yesterdayScore.components || {};
      componentChanges = {};
      for (const key of Object.keys(todayComponents)) {
        if (typeof yesterdayComponents[key] === 'number') {
          componentChanges[key] = Math.round((todayComponents[key] - yesterdayComponents[key]) * 10) / 10;
        }
      }
    }

    // Last 7 days for the trend chart, oldest → newest. Days the user logged
    // nothing have no DailyHealthScore row at all, and are returned with a
    // null value so the chart can render a gap instead of a misleading zero.
    const weekByDate = new Map(
      recentWeek.filter(hasComponents).map((d) => [d.date, d.finalScore]),
    );
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = daysAgoStr(6 - i);
      return { date, value: weekByDate.has(date) ? weekByDate.get(date) : null };
    });

    res.json({
      // Named explicitly (not `daily`/`longTerm`) so it's unambiguous to any
      // dev/app-team consumer reading the response cold, without needing to
      // cross-reference docs for what "daily" vs "longTerm" means here.
      // Only what the UI actually renders. `configVersion` and
      // `riskAdjustmentFactor` stay persisted on the User document for
      // traceability/support, but nothing displays them, so they don't
      // belong in the payload every client parses.
      longTermHealthScore: user?.compositeHealthScore?.value !== undefined ? {
        value: user.compositeHealthScore.value,
        components: user.compositeHealthScore.components,
        daysOfHistory: user.compositeHealthScore.daysOfHistory,
        computedAt: user.compositeHealthScore.computedAt,
      } : null,
      dailyHealthScore: todayScore ? {
        value: todayScore.finalScore,
        components: todayScore.components,
        raw: todayScore.raw,
        date: todayScore.date,
      } : null,
      weeklyChange,
      dailyChange,
      componentChanges,
      last7Days,
    });
  } catch (error) {
    console.error('getHealthScore error:', error.message);
    res.status(500).json({ message: 'Failed to load health score' });
  }
};
