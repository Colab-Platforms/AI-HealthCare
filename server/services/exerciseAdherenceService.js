const ExerciseLog = require('../models/ExerciseLog');

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SPAN_DAYS = 365 * 5;

class ExerciseAdherenceInputError extends Error {}

function parseDateOnlyUTC(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

function currentWeekStartUTC() {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - diffToMonday);
  return monday;
}

// Same date/range contract as sleepAnalyticsService.js / activityAnalyticsService.js —
// range picks a sensible default window, date/startDate/endDate override it.
function resolveWindow(range, { date, startDate: customStart, endDate: customEnd }) {
  for (const [label, val] of [['date', date], ['startDate', customStart], ['endDate', customEnd]]) {
    if (val !== undefined && !DATE_ONLY_RE.test(val)) {
      throw new ExerciseAdherenceInputError(`${label} must be in YYYY-MM-DD format`);
    }
  }
  if (date && range !== 'daily') {
    throw new ExerciseAdherenceInputError('date is only valid with range=daily — use startDate/endDate for weekly/monthly/yearly');
  }

  let matchStart;
  let matchEnd;

  if (date) {
    matchStart = parseDateOnlyUTC(date);
    matchEnd = parseDateOnlyUTC(date);
    matchEnd.setUTCHours(23, 59, 59, 999);
  } else if (customStart || customEnd) {
    matchStart = customStart ? parseDateOnlyUTC(customStart) : new Date(0);
    matchEnd = customEnd ? parseDateOnlyUTC(customEnd) : new Date();
    matchEnd.setUTCHours(23, 59, 59, 999);

    if (matchEnd < matchStart) {
      throw new ExerciseAdherenceInputError('endDate must not be before startDate');
    }
    const spanDays = (matchEnd - matchStart) / 86400000;
    if (spanDays > MAX_SPAN_DAYS) {
      throw new ExerciseAdherenceInputError(`Date range too large — max ${MAX_SPAN_DAYS} days`);
    }
  } else if (range === 'weekly') {
    matchStart = currentWeekStartUTC();
    matchEnd = new Date();
    matchEnd.setUTCHours(23, 59, 59, 999);
  } else if (range === 'monthly') {
    const now = new Date();
    matchStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    matchEnd = new Date();
    matchEnd.setUTCHours(23, 59, 59, 999);
  } else if (range === 'yearly') {
    const now = new Date();
    matchStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    matchEnd = new Date();
    matchEnd.setUTCHours(23, 59, 59, 999);
  } else {
    // daily, no date given — today only
    matchStart = new Date();
    matchStart.setUTCHours(0, 0, 0, 0);
    matchEnd = new Date();
    matchEnd.setUTCHours(23, 59, 59, 999);
  }

  return { matchStart, matchEnd };
}

// weeklyTargets = { cardioMinutesPerWeek, strengthSessionsPerWeek } — the
// user's exerciseGuidance numbers. Targets scale linearly with the window's
// length in days (a 30-day month gets ~4.3x the weekly target, a single day
// gets 1/7th) so "adherence %" stays meaningful at any granularity.
async function getExerciseAdherence(userId, range = 'weekly', options = {}, weeklyTargets) {
  const { matchStart, matchEnd } = resolveWindow(range, options);
  const windowDays = Math.max(1, (matchEnd - matchStart) / 86400000);
  const scale = windowDays / 7;

  const logs = await ExerciseLog.find({
    userId,
    timestamp: { $gte: matchStart, $lte: matchEnd }
  }).select('category duration timestamp').lean();

  const cardioMinutes = logs
    .filter(l => l.category === 'cardio')
    .reduce((sum, l) => sum + (l.duration || 0), 0);
  const strengthSessions = logs.filter(l => l.category === 'strength').length;

  const cardioTarget = Math.round(weeklyTargets.cardioMinutesPerWeek * scale);
  const strengthTarget = Math.max(1, Math.round(weeklyTargets.strengthSessionsPerWeek * scale));

  const pct = (actual, target) => (target > 0 ? Math.round(Math.min(100, (actual / target) * 100)) : null);

  return {
    range,
    cardioMinutesPerWeek: { target: cardioTarget, actual: cardioMinutes, adherencePercent: pct(cardioMinutes, cardioTarget) },
    strengthSessionsPerWeek: { target: strengthTarget, actual: strengthSessions, adherencePercent: pct(strengthSessions, strengthTarget) },
  };
}

module.exports = { getExerciseAdherence, ExerciseAdherenceInputError };
