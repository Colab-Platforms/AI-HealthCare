export const LOG_KEY = "takehealth_smoke_log";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const getTodayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const loadLog = () => {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || "{}");
  } catch {
    return {};
  }
};

export const saveLog = (log) => {
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
  window.dispatchEvent(new Event("storage"));
};

const dayScore = (day) => {
  if (!day || typeof day !== "object") return 0;
  const sessions = Array.isArray(day.sessions) ? day.sessions.length : 0;
  return (Number(day.count) || 0) + sessions * 10 + (Number(day.resistedCount) || 0);
};

/** Merge local cache with Mongo — keep the richer record per day. */
export const mergeSmokeLogs = (local = {}, remote = {}) => {
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
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return {
      k,
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      count: log[k]?.count || 0,
      resistedCount: log[k]?.resistedCount || 0,
      isToday: i === 6,
    };
  });

export const getSmokeSummary = (log) => {
  const todayKey = getTodayKey();
  const today = log[todayKey]?.count || 0;
  const past = Object.entries(log)
    .filter(([k]) => k !== todayKey && DATE_KEY_RE.test(k))
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6)
    .filter(([, v]) => (v?.count || 0) > 0);
  const avg =
    past.length > 0
      ? Math.round(past.reduce((s, [, v]) => s + (v?.count || 0), 0) / past.length)
      : null;
  return { today, avg, diff: avg !== null ? today - avg : null };
};
