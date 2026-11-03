const DailyInsight = require('../models/DailyInsight');
const { getClient: getRedisClient } = require('../utils/redisClient');
const {
  runDailyInsightCron,
  generateForUser,
  ensureInsight,
  getLatestSleepNightDateKey,
  getLatestActivityDateKey,
  getLatestOverallDateKey,
  findStaleInsights,
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

// Same-day staleness refresh, run AFTER the response is sent. Each
// ensureInsight here is an LLM call (~2.7s avg); awaiting up to five of them
// in sequence inside the request is what made the dashboard hang 5-6s. The
// user now gets the cached insight instantly and the fresh one on next open.
async function refreshStaleInsights(userId, insightDate) {
  let insights = await DailyInsight.find({ userId, insightDate })
    .select('insightType sourceDate dataSnapshot.categories')
    .lean();

  insights = await refreshIfStale(insights, 'sleep', insightDate, userId, getLatestSleepNightDateKey);
  insights = await refreshIfStale(insights, 'fitness', insightDate, userId, getLatestActivityDateKey);
  insights = await refreshIfStale(insights, 'overall', insightDate, userId, getLatestOverallDateKey);

  // Within-day: regenerate only the types whose category labels changed.
  const stale = await findStaleInsights(userId, insights);
  for (const { insightType, sourceDate } of stale) {
    try {
      await ensureInsight(userId, insightType, sourceDate, { force: true, sameDay: sourceDate === insightDate });
    } catch (refreshError) {
      console.error(`getTodaysInsights ${insightType} category refresh error:`, refreshError.message);
    }
  }
}

// One refresh per user at a time, across Render/Vercel instances, and at
// most one per cooldown window — the staleness check itself recomputes the
// day's data, so it shouldn't rerun on every rapid reopen either. The lock
// TTL covers a worst-case run; on completion it shrinks to the cooldown.
const REFRESH_LOCK_TTL_MS = 5 * 60 * 1000;
const REFRESH_COOLDOWN_MS = 2 * 60 * 1000;
const localRefreshes = new Set();

function triggerBackgroundRefresh(userId, insightDate) {
  const key = `lock:insight-refresh:${userId}`;
  (async () => {
    const redis = getRedisClient();
    if (redis) {
      if (await redis.set(key, '1', 'NX', 'PX', REFRESH_LOCK_TTL_MS) !== 'OK') return;
    } else if (localRefreshes.has(key)) {
      return;
    }
    localRefreshes.add(key);
    try {
      await refreshStaleInsights(userId, insightDate);
    } finally {
      if (redis) {
        localRefreshes.delete(key);
        await redis.pexpire(key, REFRESH_COOLDOWN_MS).catch(() => {});
      } else {
        setTimeout(() => localRefreshes.delete(key), REFRESH_COOLDOWN_MS).unref();
      }
    }
  })().catch((err) => console.error('getTodaysInsights background refresh error:', err.message));
}

// GET /api/insights/today
// The four insight types written last night for today's IST date.
exports.getTodaysInsights = async (req, res) => {
  try {
    const insightDate = istDateKey();
    let insights = await DailyInsight.find({ userId: req.user._id, insightDate })
      .select('-dataSnapshot -model')
      .lean();

    // sourceDate/insightDate/isBasedOnToday are internal staleness-tracking
    // bookkeeping, not card content — the app was rendering them directly
    // onto the card, which reads as leaked debug info.
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

    triggerBackgroundRefresh(req.user._id, insightDate);
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
