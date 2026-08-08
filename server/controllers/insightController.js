const DailyInsight = require('../models/DailyInsight');
const {
  runDailyInsightCron,
  generateForUser,
  istDateKey,
  shiftDateKey,
} = require('../services/dailyInsightService');

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/insights/today
// The two insights written last night for today's IST date.
exports.getTodaysInsights = async (req, res) => {
  try {
    const insightDate = istDateKey();
    const insights = await DailyInsight.find({ userId: req.user._id, insightDate })
      .select('-dataSnapshot')
      .lean();

    res.json({
      success: true,
      date: insightDate,
      basedOn: shiftDateKey(insightDate, -1),
      insights,
      // Empty is a normal state, not an error: a user who logged nothing
      // yesterday (or joined today) simply has no insight to show yet.
      hasInsights: insights.length > 0,
    });
  } catch (error) {
    console.error('getTodaysInsights error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch insights' });
  }
};

// GET /api/insights?date=YYYY-MM-DD&limit=14&type=activity
exports.getInsights = async (req, res) => {
  try {
    const { date, type } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 14, 60);

    const query = { userId: req.user._id };
    if (date) {
      if (!DATE_KEY_RE.test(date)) {
        return res.status(400).json({ success: false, message: 'date must be YYYY-MM-DD' });
      }
      query.insightDate = date;
    }
    if (type) query.insightType = type;

    const insights = await DailyInsight.find(query)
      .sort({ insightDate: -1 })
      .limit(limit)
      .select('-dataSnapshot')
      .lean();

    res.json({ success: true, count: insights.length, insights });
  } catch (error) {
    console.error('getInsights error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch insights' });
  }
};

// PATCH /api/insights/:id/seen
exports.markInsightSeen = async (req, res) => {
  try {
    const insight = await DailyInsight.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { seen: true, seenAt: new Date() },
      { new: true }
    ).select('-dataSnapshot');

    if (!insight) return res.status(404).json({ success: false, message: 'Insight not found' });
    res.json({ success: true, insight });
  } catch (error) {
    console.error('markInsightSeen error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update insight' });
  }
};

// POST /api/insights/generate  (admin)
// Manual trigger for testing and backfills.
// Body: { sourceDate?: 'YYYY-MM-DD', userId?, force?: boolean }
// Omitting sourceDate uses today in IST — i.e. exactly what the 23:59 cron does.
exports.triggerGeneration = async (req, res) => {
  try {
    const { sourceDate, userId, force = false } = req.body || {};
    if (sourceDate && !DATE_KEY_RE.test(sourceDate)) {
      return res.status(400).json({ success: false, message: 'sourceDate must be YYYY-MM-DD' });
    }
    const day = sourceDate || istDateKey();

    // Single-user runs are fast enough to await; a full sweep can take minutes
    // over the free-model rate limits, so that one is fire-and-forget.
    if (userId) {
      const result = await generateForUser(userId, day, { force });
      return res.json({ success: true, sourceDate: day, insightDate: shiftDateKey(day, 1), result });
    }

    runDailyInsightCron(day, { force }).catch((e) =>
      console.error('[DailyInsight] manual run failed:', e.message)
    );
    res.json({
      success: true,
      message: 'Daily insight generation started — check server logs for progress.',
      sourceDate: day,
      insightDate: shiftDateKey(day, 1),
    });
  } catch (error) {
    console.error('triggerGeneration error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to trigger generation' });
  }
};
