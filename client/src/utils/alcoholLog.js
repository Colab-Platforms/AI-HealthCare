export const LOG_KEY = 'takehealth_alcohol_log';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const CONTEXT_LABELS = {
  social: 'Social',
  stress: 'Stress',
  celebration: 'Celebration',
  habit: 'Routine',
  meal: 'With meal',
  boredom: 'Boredom',
  other: 'Other',
};

const DRINK_LABELS = {
  beer: 'Beer',
  wine: 'Wine',
  spirits: 'Spirits',
  cocktail: 'Cocktail',
  other: 'Other',
};

export const getTodayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const loadLog = () => {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || '{}');
  } catch {
    return {};
  }
};

export const saveLog = (log) => {
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
  window.dispatchEvent(new Event('storage'));
};

const dayScore = (day) => {
  if (!day || typeof day !== 'object') return 0;
  const sessions = Array.isArray(day.sessions) ? day.sessions.length : 0;
  const units = Number(day.units) || Number(day.count) || 0;
  return units * 10 + sessions * 5;
};

export const mergeAlcoholLogs = (local = {}, remote = {}) => {
  const keys = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);
  const merged = {};
  for (const key of keys) {
    if (!DATE_KEY_RE.test(key)) continue;
    const l = local[key];
    const r = remote[key];
    if (!l) merged[key] = r;
    else if (!r) merged[key] = l;
    else merged[key] = dayScore(r) >= dayScore(l) ? r : l;
  }
  return merged;
};

export const getLast7Days = (log) =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      k,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      count: log[k]?.count || 0,
      units: log[k]?.units || 0,
      isToday: i === 6,
    };
  });

export const getAlcoholSummary = (log) => {
  const todayKey = getTodayKey();
  const today = log[todayKey]?.count || 0;
  const todayUnits = log[todayKey]?.units || 0;
  const past = Object.entries(log)
    .filter(([k]) => k !== todayKey && DATE_KEY_RE.test(k))
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6)
    .filter(([, v]) => (v?.count || 0) > 0);
  const avg =
    past.length > 0
      ? Math.round((past.reduce((s, [, v]) => s + (v?.count || 0), 0) / past.length) * 10) / 10
      : null;
  return {
    today,
    todayUnits,
    avg,
    diff: avg !== null ? today - avg : null,
    soberToday: today === 0,
    hasRecentAvg: avg !== null,
  };
};

/** Pattern stats from the user's own log — descriptive only. */
export const getPatternInsights = (log) => {
  const last7 = getLast7Days(log);
  const soberDays = last7.filter((d) => d.count === 0).length;
  const drinkingDays = last7.filter((d) => d.count > 0).length;
  const weekTotal = last7.reduce((s, d) => s + d.count, 0);

  const drinkingOnly = last7.filter((d) => d.count > 0);
  const heaviestDay = last7.reduce(
    (max, d) => (d.count > max.count ? d : max),
    { count: 0, label: '' }
  );
  const typicalOnDrinkingDays =
    drinkingOnly.length > 0
      ? Math.round((drinkingOnly.reduce((s, d) => s + d.count, 0) / drinkingOnly.length) * 10) / 10
      : null;

  const contextFreq = {};
  const drinkFreq = {};
  const timeSlots = { Morning: 0, Afternoon: 0, Evening: 0 };

  Object.values(log).forEach((day) => {
    (day?.sessions || []).forEach((s) => {
      if (s.context) contextFreq[s.context] = (contextFreq[s.context] || 0) + 1;
      if (s.drinkType) drinkFreq[s.drinkType] = (drinkFreq[s.drinkType] || 0) + 1;
      const h = new Date(s.time).getHours();
      const slot = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
      timeSlots[slot] += 1;
    });
  });

  const topContext = Object.entries(contextFreq).sort((a, b) => b[1] - a[1])[0];
  const topDrink = Object.entries(drinkFreq).sort((a, b) => b[1] - a[1])[0];
  const topTime = Object.entries(timeSlots).sort((a, b) => b[1] - a[1])[0];

  const taggedSessions = Object.values(contextFreq).reduce((a, b) => a + b, 0);
  const totalSessions = Object.values(log).reduce(
    (s, d) => s + (d?.sessions?.length || d?.count || 0),
    0
  );

  const weekMax = Math.max(...last7.map((d) => d.count), 0);

  return {
    soberDays,
    drinkingDays,
    weekTotal,
    heaviestDay: heaviestDay.count > 0 ? heaviestDay : null,
    typicalOnDrinkingDays,
    topContext: topContext
      ? { id: topContext[0], label: CONTEXT_LABELS[topContext[0]] || topContext[0], count: topContext[1] }
      : null,
    topDrink: topDrink
      ? { id: topDrink[0], label: DRINK_LABELS[topDrink[0]] || topDrink[0], count: topDrink[1] }
      : null,
    topTime: topTime && topTime[1] > 0 ? { slot: topTime[0], count: topTime[1] } : null,
    contextCoverage:
      totalSessions > 0 ? Math.round((taggedSessions / totalSessions) * 100) : 0,
    hasEnoughData: weekTotal > 0 || totalSessions >= 2,
    weekMax,
  };
};

export const formatSessionTime = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
};

/** Offline reflection from logged data when coach API is unavailable. */
export const buildLocalReflection = (summary, patterns, todayCount) => {
  const parts = [];

  if (todayCount === 0) {
    parts.push(
      patterns.soberDays > 0
        ? `Nothing logged today. This week you have ${patterns.soberDays} clear day${patterns.soberDays !== 1 ? 's' : ''} on your record.`
        : 'Nothing logged today yet.'
    );
  } else if (summary.hasRecentAvg && summary.diff !== null) {
    if (summary.diff > 0) {
      parts.push(
        `Today you logged ${todayCount} drink${todayCount !== 1 ? 's' : ''}, which is more than your recent average of ${summary.avg} on days you drank.`
      );
    } else if (summary.diff < 0) {
      parts.push(
        `Today you logged ${todayCount} drink${todayCount !== 1 ? 's' : ''}, which is less than your recent average of ${summary.avg}.`
      );
    } else {
      parts.push(`Today (${todayCount}) matches your recent average of ${summary.avg}.`);
    }
  } else if (todayCount > 0) {
    parts.push(`You logged ${todayCount} drink${todayCount !== 1 ? 's' : ''} today.`);
  }

  if (patterns.heaviestDay && patterns.heaviestDay.count > 0) {
    parts.push(
      `Your busiest day this week was ${patterns.heaviestDay.label} with ${patterns.heaviestDay.count} logged.`
    );
  }

  if (patterns.topContext) {
    parts.push(`Situation tags often show up as "${patterns.topContext.label}".`);
  } else if (patterns.weekTotal > 0) {
    parts.push('Tagging the situation when you log will make your patterns clearer.');
  }

  if (patterns.topTime) {
    parts.push(`Most entries tend to be in the ${patterns.topTime.slot.toLowerCase()}.`);
  }

  parts.push('What feels different on the days that look lighter compared to the heavier ones?');

  return parts.join(' ');
};

export { CONTEXT_LABELS, DRINK_LABELS };
