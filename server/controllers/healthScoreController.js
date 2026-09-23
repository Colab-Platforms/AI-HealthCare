const DailyHealthScore = require('../models/DailyHealthScore');
const { calculateDailyScore } = require('../services/dailyHealthScoreService');
const { calculateLongTermScore, daysAgoStr } = require('../services/longTermHealthScoreService');
const { getActiveScoreConfig } = require('../utils/scoreConfig');
const { classifyCalendarBand } = require('../utils/calendarBand');

const HEALTH_SCORE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HEALTH_SCORE_MAX_SPAN_DAYS = 100; // generous headroom over a single calendar month

// GET /api/health/score?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// Lightweight per-day { date, score, band } array for the mobile Score
// Calendar — one call for a whole month instead of one request per day.
// Reads only PERSISTED DailyHealthScore rows (no live recompute, unlike the
// single-date path below) — a day with no row, or a row with no logged
// components, is "not logged" on the calendar, not a live-computed value.
async function getHealthScoreRange(req, res) {
  const { startDate, endDate } = req.query;
  if (!HEALTH_SCORE_DATE_RE.test(startDate) || !HEALTH_SCORE_DATE_RE.test(endDate)) {
    return res.status(400).json({ success: false, message: 'startDate and endDate must be in YYYY-MM-DD format' });
  }
  if (endDate < startDate) {
    return res.status(400).json({ success: false, message: 'endDate must not be before startDate' });
  }
  const spanDays = (new Date(endDate) - new Date(startDate)) / 86400000;
  if (spanDays > HEALTH_SCORE_MAX_SPAN_DAYS) {
    return res.status(400).json({ success: false, message: `Date range too large — max ${HEALTH_SCORE_MAX_SPAN_DAYS} days` });
  }

  const rows = await DailyHealthScore.find({
    userId: req.user._id,
    date: { $gte: startDate, $lte: endDate },
  }).select('date finalScore components').lean();

  const days = rows
    .filter((r) => r.components && Object.keys(r.components).length > 0)
    .map((r) => ({
      date: r.date,
      score: r.finalScore,
      band: classifyCalendarBand(r.finalScore),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  res.json({ success: true, startDate, endDate, days });
}

// GET /api/health/score — powers the Dashboard's Health Score ring + sub-cards.
// Ensures today's Daily Score is fresh (the user is actively waiting on this
// read, so we compute synchronously here rather than relying on the
// fire-and-forget trigger from the last log write, which may be stale by a
// few minutes or may not have fired yet if today's first log hasn't happened).
exports.getHealthScore = async (req, res) => {
  try {
    if (req.query.startDate || req.query.endDate) {
      return await getHealthScoreRange(req, res);
    }

    const userId = req.user._id;
    const todayStr = new Date().toISOString().split('T')[0];

    // Optional historical view — the Dashboard's date navigator passes this to
    // show a previous day's score. Validated strictly (format, not-in-future,
    // within the 90-day DailyHealthScore retention window the query below
    // already reads) so a bad/typo'd value falls back to today instead of
    // silently computing something wrong.
    const requestedDate = typeof req.query.date === 'string' ? req.query.date : null;
    const isValidDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
      && requestedDate <= todayStr
      && requestedDate >= daysAgoStr(89);
    const targetDateStr = isValidDate ? requestedDate : todayStr;
    const isViewingToday = targetDateStr === todayStr;

    // The active config is loaded once here and handed to both engines. They
    // each used to fetch it themselves, which meant two reads per request for a
    // document that changes only when a new version is deliberately activated.
    const config = await getActiveScoreConfig();

    // The requested day's Daily Score first — the Overall Score now includes
    // today's as a component, so it has to exist and be current before
    // Overall is computed.
    const todayScore = await calculateDailyScore(userId, targetDateStr, { config }).catch(() => null);

    // One read of the 90-day score window (anchored to TODAY, not the
    // requested date, so week-over-week/last7Days comparisons around an older
    // requested date still have enough trailing history available), reused by
    // everything below. Overall needs it for Today/Consistency/Trend/history,
    // and this endpoint needs it again for the week-over-week and day-over-day
    // comparisons — previously eight separate queries over overlapping ranges
    // of the same collection. It is read AFTER the daily score above so it
    // includes today's new row.
    const dailyRows = await DailyHealthScore.find({
      userId,
      date: { $gte: daysAgoStr(89) },
    }).sort({ date: 1 }).lean();

    // Overall (the 90-day compound score) and the critical-lab-value alert
    // both represent the user's CURRENT standing, not a snapshot of a past
    // day — there is no meaningful "Overall Score as of 12 days ago" the way
    // there is for a Daily Score. Only computed/shown when viewing today;
    // for a past date they're left null so the client doesn't misattribute
    // today's overall figure to the day being viewed.
    const overall = isViewingToday
      ? await calculateLongTermScore(userId, { config, dailyRows }).catch(() => null)
      : null;

    // A day with no logged components still gets a persisted row (finalScore
    // 0) so the engine has a slot to fill as the day goes on — but 0 there
    // means "nothing logged yet", not "scored zero". Every comparison below
    // skips those rows: averaging them in would drag the week down, and
    // comparing against one would report a catastrophic drop every morning
    // before the user's first log of the day.
    const hasComponents = (s) => s && Object.keys(s.components || {}).length > 0;

    // All "N days before" comparisons below are anchored to the DAY BEING
    // VIEWED, not to today — so navigating to a past date shows that day's
    // own week-over-week/yesterday context, not today's. Local to this
    // request only; the exported daysAgoStr (today-anchored) is unaffected
    // since it's still used elsewhere (validation, the 90-day DB window).
    const offsetFrom = (dateStr, n) => {
      const d = new Date(`${dateStr}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - n);
      return d.toISOString().split('T')[0];
    };

    // Raw week-over-week delta for the UI's "+N this week" pill — separate
    // from the Long-Term Score's own clamped ±15 Trend component, which is
    // meant to be gentle, not a literal display number.
    const weekStart = offsetFrom(targetDateStr, 6);
    const priorStart = offsetFrom(targetDateStr, 13);
    const recentWeek = dailyRows.filter((d) => d.date >= weekStart && d.date <= targetDateStr);
    const priorWeek = dailyRows.filter((d) => d.date >= priorStart && d.date < weekStart);
    const yesterdayScore = dailyRows.find((d) => d.date === offsetFrom(targetDateStr, 1)) || null;
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
      const date = offsetFrom(targetDateStr, 6 - i);
      return { date, value: weekByDate.has(date) ? weekByDate.get(date) : null };
    });

    res.json({
      // Echoes back which date this payload is actually for — the client
      // sent a `date` query param that may have been invalid/out-of-range and
      // silently fell back to today, so it reads this instead of assuming.
      requestedDate: targetDateStr,
      isViewingToday,

      // Named explicitly (not `daily`/`longTerm`) so it's unambiguous to any
      // dev/app-team consumer reading the response cold, without needing to
      // cross-reference docs for what "daily" vs "longTerm" means here.
      // Only what the UI actually renders. `configVersion` and
      // `riskAdjustmentFactor` stay persisted on the User document for
      // traceability/support, but nothing displays them, so they don't
      // belong in the payload every client parses.
      overallHealthScore: overall?.value !== undefined ? {
        value: overall.value,
        components: overall.components,
        daysOfHistory: overall.daysOfHistory,
        computedAt: overall.computedAt,
      } : null,

      // Safety netting. A score is a wellness indicator, and a user who reads
      // a number as "I'm fine" may put off care they need — so anything in
      // critical range is surfaced explicitly rather than left to be inferred
      // from a low number. The client must render this above the score.
      criticalAlert: overall?.criticalFindings?.length ? {
        message: 'One or more of your recent results is outside the safe range. Please consult a doctor.',
        findings: overall.criticalFindings,
      } : null,

      disclaimer: 'This score is a wellness indicator, not a medical assessment or diagnosis. It cannot replace advice from a qualified doctor.',
      dailyHealthScore: todayScore ? {
        value: todayScore.finalScore,
        components: todayScore.components,
        raw: todayScore.raw,
        date: todayScore.date,
        // False while the day is still being lived — the score keeps climbing
        // as more is logged, so the client must label it "so far today" rather
        // than presenting it as the day's verdict.
        isFinalScoreForToday: todayScore.isFinalScoreForToday,
        dayProgressPercent: todayScore.dayProgressPercent,
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
