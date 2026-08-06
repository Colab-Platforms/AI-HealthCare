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

    // Raw week-over-week delta for the UI's "+N this week" pill — separate
    // from the Long-Term Score's own clamped ±15 Trend component, which is
    // meant to be gentle, not a literal display number.
    const [recentWeek, priorWeek] = await Promise.all([
      DailyHealthScore.find({ userId, date: { $gte: daysAgoStr(6) } }).lean(),
      DailyHealthScore.find({ userId, date: { $gte: daysAgoStr(13), $lt: daysAgoStr(6) } }).lean(),
    ]);
    const avg = (arr) => (arr.length ? arr.reduce((s, d) => s + d.finalScore, 0) / arr.length : null);
    const recentAvg = avg(recentWeek);
    const priorAvg = avg(priorWeek);
    const weeklyChange = recentAvg !== null && priorAvg !== null ? Math.round(recentAvg - priorAvg) : null;

    res.json({
      // Named explicitly (not `daily`/`longTerm`) so it's unambiguous to any
      // dev/app-team consumer reading the response cold, without needing to
      // cross-reference docs for what "daily" vs "longTerm" means here.
      longTermHealthScore: user?.compositeHealthScore?.value !== undefined ? user.compositeHealthScore : null,
      dailyHealthScore: todayScore ? {
        value: todayScore.finalScore,
        components: todayScore.components,
        raw: todayScore.raw,
        date: todayScore.date,
      } : null,
      weeklyChange,
    });
  } catch (error) {
    console.error('getHealthScore error:', error.message);
    res.status(500).json({ message: 'Failed to load health score' });
  }
};
