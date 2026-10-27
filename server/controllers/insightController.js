const DailyInsight = require('../models/DailyInsight');
const {
  runDailyInsightCron,
  generateForUser,
  ensureInsight,
  getLatestSleepNightDateKey,
  getLatestActivityDateKey,
  getLatestOverallDateKey,
  hasNewerDataThanInsight,
  hasMeaningfulStepChange,
  istDateKey,
  shiftDateKey,
} = require('../services/dailyInsightService');

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Both 'sleep' and 'fitness' normally describe sourceDate = insightDate - 1
// (last night's cron run), but their matching screen (the Sleep ring, the
// Activity ring) always shows the user's LATEST actual data — which can
// already be dated `insightDate` itself (a completed night once they wake
// and sync; today's steps-so-far for activity). Left alone, the insight
// card then contradicts the ring shown right above it. This detects that
// and refreshes on the spot instead of waiting for tonight's cron.
async function refreshIfStale(insights, insightType, insightDate, userId, getLatestDateKey) {
  try {
    const latestDate = await getLatestDateKey(userId);
    const cached = insights.find((i) => i.insightType === insightType);
    const isStale = latestDate === insightDate && (!cached || cached.sourceDate !== insightDate);
    if (!isStale) return insights;
    const fresh = await ensureInsight(userId, insightType, insightDate, { force: true, sameDay: true });
    if (!fresh) return insights;
    return [...insights.filter((i) => i.insightType !== insightType), fresh];
  } catch (refreshError) {
    // Never let the staleness refresh break the whole response — the user
    // still gets whatever was already cached.
    console.error(`getTodaysInsights ${insightType} refresh error:`, refreshError.message);
    return insights;
  }
}

// GET /api/insights/today
// The four insight types written last night for today's IST date.
exports.getTodaysInsights = async (req, res) => {
  try {
    const insightDate = istDateKey();
    let insights = await DailyInsight.find({ userId: req.user._id, insightDate })
      .select('-dataSnapshot -model')
      .lean();

    insights = await refreshIfStale(insights, 'sleep', insightDate, req.user._id, getLatestSleepNightDateKey);
    insights = await refreshIfStale(insights, 'fitness', insightDate, req.user._id, getLatestActivityDateKey);
    insights = await refreshIfStale(insights, 'overall', insightDate, req.user._id, getLatestOverallDateKey);

    // Second-opinion check for 'overall': the date-based refresh above only
    // catches "today has no insight yet." It won't catch a same-day insight
    // that's gone stale WITHIN today — e.g. the user logs a meal minutes
    // after generation, and the cached nutrition number is now behind the
    // live one. Re-generate whenever any of today's core data is newer than
    // the insight itself.
    try {
      const cachedOverall = insights.find((i) => i.insightType === 'overall');
      if (cachedOverall && (await hasNewerDataThanInsight(req.user._id, cachedOverall))) {
        const fresh = await ensureInsight(req.user._id, 'overall', insightDate, { force: true, sameDay: true });
        if (fresh) insights = [...insights.filter((i) => i.insightType !== 'overall'), fresh];
      }
    } catch (refreshError) {
      console.error('getTodaysInsights overall freshness refresh error:', refreshError.message);
    }

    // Same idea for 'fitness', but keyed on step count moving meaningfully
    // rather than any write happening — background step syncs land every few
    // minutes, so a plain "newer write exists" check (fine above for
    // 'overall') would regenerate on almost every app open.
    try {
      const cachedFitness = insights.find((i) => i.insightType === 'fitness');
      if (cachedFitness) {
        const withSnapshot = await DailyInsight.findById(cachedFitness._id).select('dataSnapshot updatedAt').lean();
        if (await hasMeaningfulStepChange(req.user._id, withSnapshot)) {
          const fresh = await ensureInsight(req.user._id, 'fitness', insightDate, { force: true, sameDay: true });
          if (fresh) insights = [...insights.filter((i) => i.insightType !== 'fitness'), fresh];
        }
      }
    } catch (refreshError) {
      console.error('getTodaysInsights fitness freshness refresh error:', refreshError.message);
    }

    // sourceDate/insightDate/isBasedOnToday are internal staleness-tracking
    // bookkeeping (used above by refreshIfStale/hasNewerDataThanInsight), not
    // card content — the app was rendering sourceDate/isBasedOnToday directly
    // onto the card ("today" / a bare ISO date under the description), which
    // reads as leaked debug info. Stripped here the same way `model` already
    // is. Freshly-refreshed entries above come straight from ensureInsight's
    // saved doc (full object, not the '-model' projection the initial find
    // used), so model/dataSnapshot need stripping here too, not just there.
    insights = insights.map((i) => {
      const { model, dataSnapshot, sourceDate, insightDate: _insightDate, ...rest } = i;
      return rest;
    });

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
      .select('-dataSnapshot -model')
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
