const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DRINK_TYPES = new Set(['beer', 'wine', 'spirits', 'cocktail', 'other']);
const CONTEXT_IDS = new Set(['social', 'stress', 'celebration', 'habit', 'meal', 'boredom', 'other']);
const BINGE_THRESHOLD = 4;

const getTodayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const toPlainAlcoholLog = (raw) => {
  if (!raw) return {};
  if (raw instanceof Map) return Object.fromEntries(raw);
  if (typeof raw.toObject === 'function') return raw.toObject();
  return typeof raw === 'object' ? { ...raw } : {};
};

const sanitizeAlcoholLog = (raw) => {
  const input = toPlainAlcoholLog(raw);
  const out = {};

  for (const [key, val] of Object.entries(input)) {
    if (!DATE_KEY_RE.test(key) || !val || typeof val !== 'object') continue;

    const sessions = Array.isArray(val.sessions)
      ? val.sessions.slice(0, 200).map((s) => ({
          time: String(s?.time || new Date().toISOString()),
          drinkType: DRINK_TYPES.has(s?.drinkType) ? s.drinkType : 'other',
          units: Math.max(0.5, Math.min(20, Number(s?.units) || 1)),
          context: s?.context && CONTEXT_IDS.has(s.context) ? s.context : null,
          mood: s?.mood ? String(s.mood).slice(0, 50) : null,
          notes: s?.notes ? String(s.notes).slice(0, 200) : null,
          id: s?.id ? String(s.id) : String(s?.time || Date.now())
        }))
      : [];

    const cravingEvents = Array.isArray(val.cravingEvents)
      ? val.cravingEvents.slice(0, 100).map((e) => ({
          time: String(e?.time || new Date().toISOString()),
          context: e?.context && CONTEXT_IDS.has(e.context) ? e.context : null,
          resisted: Boolean(e?.resisted)
        }))
      : [];

    const countFromSessions = sessions.reduce((sum, s) => sum + 1, 0);
    const unitsFromSessions = sessions.reduce((sum, s) => sum + (s.units || 1), 0);
    const count = Math.max(0, Number(val.count) || countFromSessions);
    const units = Math.max(0, Number(val.units) || unitsFromSessions || count);

    out[key] = {
      count,
      units,
      resistedCount: Math.max(0, Number(val.resistedCount) || 0),
      sessions,
      cravingEvents
    };
  }

  return out;
};

const getLastNDays = (log, n = 7) => {
  const plain = toPlainAlcoholLog(log);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const day = plain[k];
    return {
      date: k,
      count: day?.count || 0,
      units: day?.units || 0,
      resistedCount: day?.resistedCount || 0
    };
  });
};

const getAlcoholSummary = (log) => {
  const plain = sanitizeAlcoholLog(log);
  const todayKey = getTodayKey();
  const todayEntry = plain[todayKey] || { count: 0, units: 0, resistedCount: 0, sessions: [] };
  const last7 = getLastNDays(plain, 7);
  const past6 = last7.slice(0, 6).filter((d) => d.count > 0);
  const avg7 =
    past6.length > 0
      ? Math.round((past6.reduce((s, d) => s + d.count, 0) / past6.length) * 10) / 10
      : null;
  const avgUnits7 =
    past6.length > 0
      ? Math.round((past6.reduce((s, d) => s + d.units, 0) / past6.length) * 10) / 10
      : null;

  const triggerFreq = {};
  Object.values(plain).forEach((day) => {
    (day.sessions || []).forEach((s) => {
      if (s.context) triggerFreq[s.context] = (triggerFreq[s.context] || 0) + 1;
    });
  });
  const topTriggers = Object.entries(triggerFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);

  const hourBreakdown = {};
  Object.values(plain).forEach((day) => {
    (day.sessions || []).forEach((s) => {
      const h = new Date(s.time).getHours();
      const slot = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
      hourBreakdown[slot] = (hourBreakdown[slot] || 0) + 1;
    });
  });
  const highRiskWindow =
    Object.entries(hourBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const bingeDaysLast7 = last7.filter((d) => d.count >= BINGE_THRESHOLD).length;
  const totalResisted = Object.values(plain).reduce((s, d) => s + (d.resistedCount || 0), 0);

  return {
    today: todayEntry.count,
    todayUnits: todayEntry.units,
    todayResisted: todayEntry.resistedCount,
    avg7,
    avgUnits7,
    diff: avg7 !== null ? todayEntry.count - avg7 : null,
    bingePattern: bingeDaysLast7 >= 2,
    bingeDaysLast7,
    topTriggers,
    highRiskWindow,
    totalResisted,
    soberToday: todayEntry.count === 0,
    last7
  };
};

const buildAlcoholContextForAI = (log, lifestyle = {}) => {
  const summary = getAlcoholSummary(log);
  const profileLine = lifestyle.alcohol
    ? `Profile: drinks alcohol (${lifestyle.alcoholFrequency || 'frequency not set'})`
    : 'Profile: alcohol use not declared';

  if (!summary.today && !summary.avg7) {
    return `${profileLine}. No recent alcohol tracker logs.`;
  }

  const heaviest = summary.last7.reduce((m, d) => (d.count > m.count ? d : m), { count: 0 });
  return `${profileLine}. Today: ${summary.today} drinks. 7-day avg on drinking days: ${summary.avg7 ?? 'n/a'}. Week total: ${summary.last7.reduce((s, d) => s + d.count, 0)}. Heaviest day this week: ${heaviest.count}. Top tagged situations: ${summary.topTriggers.join(', ') || 'none'}. Common time: ${summary.highRiskWindow || 'unknown'}. Pattern awareness only — not medical advice.`;
};

const buildSmokeContextForAI = (smokeLog) => {
  const plain = smokeLog && typeof smokeLog === 'object' ? smokeLog : {};
  const todayKey = getTodayKey();
  const today = plain[todayKey]?.count || 0;
  const last7 = getLastNDays(
    Object.fromEntries(
      Object.entries(plain).map(([k, v]) => [k, { count: v?.count || 0, units: 0 }])
    ),
    7
  );
  const avg =
    last7.slice(0, 6).filter((d) => d.count > 0).length > 0
      ? Math.round(
          last7.slice(0, 6).reduce((s, d) => s + d.count, 0) /
            last7.slice(0, 6).filter((d) => d.count > 0).length
        )
      : null;
  return `Smoke tracker today: ${today} cigarettes. 7-day avg (excl. today): ${avg ?? 'n/a'}. Resisted urges (all time): ${Object.values(plain).reduce((s, d) => s + (d?.resistedCount || 0), 0)}.`;
};

module.exports = {
  DATE_KEY_RE,
  BINGE_THRESHOLD,
  getTodayKey,
  toPlainAlcoholLog,
  sanitizeAlcoholLog,
  getLastNDays,
  getAlcoholSummary,
  buildAlcoholContextForAI,
  buildSmokeContextForAI
};
