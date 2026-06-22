import React, { useState, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  Plus,
  RotateCcw,
  Wine,
  TrendingDown,
  TrendingUp,
  Minus,
  Users,
  Zap,
  Coffee,
  Smile,
  Sparkles,
  RefreshCw,
  BarChart3,
  Clock,
  Lightbulb,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import SEO from '../hooks/useSEO';
import useAlcoholLog from '../hooks/useAlcoholLog';
import {
  getTodayKey,
  getLast7Days,
  getAlcoholSummary,
  getPatternInsights,
  formatSessionTime,
  buildLocalReflection,
  CONTEXT_LABELS,
  DRINK_LABELS,
} from '../utils/alcoholLog';
import { formatAiPlainText } from '../utils/formatAiText';
import { features } from '../config/features';

const AI_INSIGHT_KEY = 'takehealth_alcohol_ai_insight';

const DRINK_TYPES = [
  { id: 'beer', label: 'Beer' },
  { id: 'wine', label: 'Wine' },
  { id: 'spirits', label: 'Spirits' },
  { id: 'cocktail', label: 'Cocktail' },
  { id: 'other', label: 'Other' },
];

const CONTEXTS = [
  { id: 'social', label: 'Social', icon: Users },
  { id: 'stress', label: 'Stress', icon: Zap },
  { id: 'celebration', label: 'Celebrate', icon: Sparkles },
  { id: 'habit', label: 'Routine', icon: Coffee },
  { id: 'meal', label: 'With meal', icon: Coffee },
  { id: 'boredom', label: 'Boredom', icon: Smile },
];

const ChartTooltip = ({ active, payload }) =>
  active && payload?.length ? (
    <div className="bg-slate-900 border border-slate-800 text-white text-[11px] font-bold px-3 py-2 rounded-xl shadow-xl">
      <p>
        {payload[0].payload.count} drink{payload[0].payload.count !== 1 ? 's' : ''}
      </p>
      <p className="text-slate-400 font-semibold">{payload[0].payload.label}</p>
    </div>
  ) : null;

const DEFAULT_INSIGHT =
  'Log what you drink and optionally tag the situation. After a few entries, you will see your own weekly patterns here.';

function barFill(entry, weekMax) {
  if (entry.isToday) return '#f59e0b';
  if (entry.count === 0) return '#e2e8f0';
  if (weekMax <= 0) return '#cbd5e1';
  const intensity = entry.count / weekMax;
  if (intensity >= 0.75) return '#fdba74';
  if (intensity >= 0.4) return '#fde68a';
  return '#e2e8f0';
}

export default function AlcoholTracker() {
  const navigate = useNavigate();
  const { log, persistLog, loading: logLoading } = useAlcoholLog();
  const [showContextRow, setShowContextRow] = useState(false);
  const [lastSessionId, setLastSessionId] = useState(null);
  const [selectedDrinkType, setSelectedDrinkType] = useState('beer');
  const [aiInsight, setAiInsight] = useState(() =>
    formatAiPlainText(localStorage.getItem(AI_INSIGHT_KEY) || DEFAULT_INSIGHT)
  );
  const [loadingAI, setLoadingAI] = useState(false);
  const contextHideTimeout = useRef(null);

  const today = getTodayKey();
  const todayEntry = log[today] || { count: 0, units: 0, sessions: [] };
  const todayCount = todayEntry.count;
  const todaySessions = [...(todayEntry.sessions || [])].reverse();

  const days7 = useMemo(() => getLast7Days(log), [log]);
  const summary = useMemo(() => getAlcoholSummary(log), [log]);
  const patterns = useMemo(() => getPatternInsights(log), [log]);
  const { avg, diff, hasRecentAvg } = summary;

  const buildPatternPayload = useCallback(() => {
    const lines = [
      `Today: ${todayCount} drinks logged`,
      `Last 7 days — total: ${patterns.weekTotal}, sober days: ${patterns.soberDays}, days with drinking: ${patterns.drinkingDays}`,
      patterns.heaviestDay
        ? `Heaviest day this week: ${patterns.heaviestDay.count} on ${patterns.heaviestDay.label}`
        : 'No drinking days this week yet',
      patterns.typicalOnDrinkingDays !== null
        ? `Typical amount on drinking days: ${patterns.typicalOnDrinkingDays} drinks`
        : 'Not enough drinking days for a typical amount',
      `Recent avg (last 6 days excl. today, drinking days only): ${avg ?? 'not enough data'}`,
      patterns.topContext
        ? `Most tagged situation: ${patterns.topContext.label} (${patterns.topContext.count}x)`
        : 'No situations tagged yet',
      patterns.topDrink
        ? `Most logged type: ${patterns.topDrink.label}`
        : 'No drink types logged yet',
      patterns.topTime
        ? `Most common time of day: ${patterns.topTime.slot}`
        : 'No time pattern yet',
    ];
    if (todaySessions.length > 0) {
      lines.push(
        `Today: ${todaySessions
          .map(
            (s) =>
              `${formatSessionTime(s.time)} ${DRINK_LABELS[s.drinkType] || s.drinkType}${s.context ? ` (${CONTEXT_LABELS[s.context]})` : ''}`
          )
          .join('; ')}`
      );
    }
    return lines.join('\n');
  }, [todayCount, patterns, avg, todaySessions]);

  const applyReflection = useCallback((text) => {
    const trimmed = formatAiPlainText(String(text).trim());
    if (!trimmed) return false;
    setAiInsight(trimmed);
    localStorage.setItem(AI_INSIGHT_KEY, trimmed);
    return true;
  }, []);

  const fetchAI = useCallback(
    async (force = false) => {
      if (loadingAI) return;

      if (!patterns.hasEnoughData) {
        setAiInsight(
          'Log a few drinks (and tag the situation if you can) to get a reflection based on your own week.'
        );
        return;
      }

      setLoadingAI(true);
      try {
        const prompt = `Reflective drink-awareness assistant. Use ONLY this user's logged data:

${buildPatternPayload()}

Rules: plain text only, no markdown, no medical advice, no goals or limits, no "should/must". Name one pattern from their numbers and ask one reflection question. 2-3 short sentences.`;

        const res = await api.post('health/ai-chat', { message: prompt, chatHistory: [] });
        const text = res.data?.response || res.data?.message;
        if (text && applyReflection(text)) {
          return;
        }
        throw new Error(res.data?.message || 'No response from coach');
      } catch (err) {
        const local = buildLocalReflection(summary, patterns, todayCount);
        if (applyReflection(local)) {
          const isAuth = err?.response?.status === 401;
          const isAiConfig = err?.response?.data?.code === 'AI_NOT_CONFIGURED';
          if (isAuth) {
            toast.error('Please sign in again to use coach reflection.');
          } else if (!isAiConfig) {
            toast('Reflection from your log (coach unavailable right now)', { icon: 'ℹ️' });
          }
        } else {
          toast.error(err?.response?.data?.message || 'Could not refresh. Try again.');
        }
      } finally {
        setLoadingAI(false);
      }
    },
    [loadingAI, patterns, summary, todayCount, buildPatternPayload, applyReflection]
  );

  const logDrink = useCallback(() => {
    const now = new Date().toISOString();
    const sessionId = now;
    persistLog((prev) => {
      const u = { ...prev };
      const t = u[today] || { count: 0, units: 0, sessions: [] };
      u[today] = {
        count: t.count + 1,
        units: (t.units || t.count || 0) + 1,
        sessions: [
          ...(t.sessions || []),
          {
            time: now,
            drinkType: selectedDrinkType,
            units: 1,
            context: null,
            id: sessionId,
          },
        ],
      };
      return u;
    });
    setLastSessionId(sessionId);
    setShowContextRow(true);
    clearTimeout(contextHideTimeout.current);
    contextHideTimeout.current = setTimeout(() => setShowContextRow(false), 12000);
    toast('Logged — tag the situation if you want', { icon: '🍷' });
  }, [today, persistLog, selectedDrinkType]);

  const undo = useCallback(() => {
    persistLog((prev) => {
      const u = { ...prev };
      const t = u[today];
      if (!t || t.count === 0) return prev;
      const sessions = [...(t.sessions || [])];
      const last = sessions.pop();
      const removedUnits = last?.units || 1;
      u[today] = {
        count: Math.max(0, t.count - 1),
        units: Math.max(0, (t.units || t.count) - removedUnits),
        sessions,
      };
      return u;
    });
    setShowContextRow(false);
    toast('Removed last entry', { icon: '↩' });
  }, [today, persistLog]);

  const tagContext = useCallback(
    (contextId) => {
      persistLog((prev) => {
        const u = { ...prev };
        const t = u[today];
        if (!t) return prev;
        const sessions = (t.sessions || []).map((s) =>
          s.id === lastSessionId || String(s.id).startsWith(String(lastSessionId))
            ? { ...s, context: contextId }
            : s
        );
        u[today] = { ...t, sessions };
        return u;
      });
      setShowContextRow(false);
      toast(`Tagged: ${CONTEXTS.find((c) => c.id === contextId)?.label}`, { icon: '✓' });
    },
    [today, lastSessionId, persistLog]
  );

  if (!features.alcoholTracker) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-slate-500 text-sm">Alcohol tracker is not enabled.</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col w-full max-w-md mx-auto overflow-hidden border-x border-white/40"
      style={{ background: "linear-gradient(160deg, #fef9ed 0%, #fffdf7 50%, #fdf6e3 100%)" }}
    >
      <SEO pageName="alcoholTracker" />

      <header className="px-6 py-4 flex items-center justify-between sticky top-0 z-20"
        style={{
          background: "rgba(255,253,245,0.75)",
          backdropFilter: "blur(28px) saturate(180%)",
          borderBottom: "1px solid rgba(245,158,11,0.15)",
          boxShadow: "0 2px 16px rgba(245,158,11,0.06)",
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="liquid-glass-btn w-10 h-10 rounded-xl flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="text-center">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-600">Awareness</span>
          <h1 className="text-sm font-black text-slate-900 uppercase tracking-wider mt-0.5">Drink log</h1>
        </div>
        <div className="w-10 h-10" />
      </header>

      <div className="flex-1 overflow-y-auto pb-24 p-5 space-y-5">
        <p className="text-xs text-slate-500 text-center px-2 leading-relaxed">
          A honest record of when and why you drink — so you can spot your own patterns over time.
        </p>

        {/* Log */}
        <div className="liquid-glass-strong rounded-[2.5rem] p-6 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>

          <p className="text-[10px] font-bold text-slate-500 mb-3">What are you having?</p>
          <div className="flex flex-wrap justify-center gap-2 mb-5">
            {DRINK_TYPES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedDrinkType(d.id)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${
                  selectedDrinkType === d.id
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-slate-50 text-slate-500 border-slate-100'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-center gap-6">
            <button
              type="button"
              onClick={undo}
              disabled={todayCount === 0}
              className="liquid-glass-inner w-12 h-12 rounded-2xl flex items-center justify-center disabled:opacity-20"
              aria-label="Undo last drink"
            >
              <RotateCcw className="w-4 h-4 text-slate-500" />
            </button>
            <div>
              <motion.span
                key={todayCount}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-7xl font-black text-slate-900 tabular-nums block"
              >
                {todayCount}
              </motion.span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                {todayCount === 1 ? 'drink today' : 'drinks today'}
              </span>
            </div>
            <button
              type="button"
              onClick={logDrink}
              className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-200/50"
              aria-label="Log one drink"
            >
              <Plus className="w-5 h-5" strokeWidth={3} />
            </button>
          </div>

          {hasRecentAvg && todayCount > 0 && diff !== null && (
            <p
              className={`mt-4 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${diff < 0 ? 'text-emerald-600' : diff > 0 ? 'text-amber-700' : 'text-slate-500'}`}
            >
              {diff < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : diff > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
              {diff === 0
                ? `Same as your recent days (avg ${avg})`
                : diff < 0
                  ? `${Math.abs(diff)} fewer than your recent avg (${avg})`
                  : `${diff} more than your recent avg (${avg})`}
            </p>
          )}
          {todayCount === 0 && patterns.soberDays > 0 && (
            <p className="mt-4 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
              No drinks logged today · {patterns.soberDays} clear day{patterns.soberDays !== 1 ? 's' : ''} this week
            </p>
          )}
        </div>

        {showContextRow && (
          <div className="liquid-glass rounded-3xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">What was going on?</p>
            <p className="text-[11px] text-slate-500 mb-3">Optional — helps you see which situations come up most.</p>
            <div className="flex flex-wrap gap-2">
              {CONTEXTS.map((c) => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => tagContext(c.id)}
                    className="liquid-glass-inner flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold"
                  >
                    <Icon className="w-3.5 h-3.5 text-amber-600" />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Week — practical stats */}
        <div className="liquid-glass rounded-[2rem] p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-slate-500" />
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">This week</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="liquid-glass-inner rounded-2xl p-3 text-center">
              <p className="text-2xl font-black text-slate-900">{patterns.weekTotal}</p>
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Total logged</p>
            </div>
            <div className="liquid-glass-inner rounded-2xl p-3 text-center">
              <p className="text-2xl font-black text-emerald-600">{patterns.soberDays}</p>
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Clear days</p>
            </div>
            {patterns.typicalOnDrinkingDays !== null && (
              <div className="liquid-glass-inner rounded-2xl p-3 text-center">
                <p className="text-2xl font-black text-slate-900">{patterns.typicalOnDrinkingDays}</p>
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Typical on drinking days</p>
              </div>
            )}
            {patterns.heaviestDay && (
              <div className="liquid-glass-inner rounded-2xl p-3 text-center">
                <p className="text-2xl font-black text-amber-700">{patterns.heaviestDay.count}</p>
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                  Busiest day ({patterns.heaviestDay.label})
                </p>
              </div>
            )}
          </div>
        </div>

        {patterns.hasEnoughData && (patterns.topContext || patterns.topDrink || patterns.topTime) && (
          <div className="liquid-glass rounded-[2rem] p-5" style={{ background: "rgba(251,191,36,0.08)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-amber-700" />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-amber-900">What your log shows</h2>
            </div>
            <ul className="space-y-2 text-sm text-slate-700">
              {patterns.topContext && (
                <li>
                  <span className="font-semibold">Often when:</span> {patterns.topContext.label}
                </li>
              )}
              {patterns.topDrink && (
                <li>
                  <span className="font-semibold">Usually:</span> {patterns.topDrink.label}
                </li>
              )}
              {patterns.topTime && (
                <li className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>
                    <span className="font-semibold">Most often:</span> {patterns.topTime.slot}
                  </span>
                </li>
              )}
            </ul>
            {patterns.contextCoverage < 50 && patterns.weekTotal > 0 && (
              <p className="text-[11px] text-amber-800/80 mt-3">
                Tip: tag the situation when you log — your patterns get much clearer.
              </p>
            )}
          </div>
        )}

        {todaySessions.length > 0 && (
          <div className="liquid-glass rounded-[2rem] p-5">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Today</h2>
            <ul className="space-y-2">
              {todaySessions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between text-sm py-2 border-b border-slate-50 last:border-0"
                >
                  <span className="font-semibold text-slate-800">{DRINK_LABELS[s.drinkType] || 'Drink'}</span>
                  <span className="text-slate-400 text-xs">
                    {formatSessionTime(s.time)}
                    {s.context ? ` · ${CONTEXT_LABELS[s.context]}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="liquid-glass rounded-[2rem] p-5">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Last 7 days</h2>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days7}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {days7.map((entry) => (
                    <Cell key={entry.k} fill={barFill(entry, patterns.weekMax)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="liquid-glass rounded-[2rem] p-5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Wine className="w-4 h-4 text-amber-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-800">Reflection</span>
            </div>
            <button
              type="button"
              onClick={() => fetchAI(true)}
              disabled={loadingAI}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-amber-200 text-[10px] font-black uppercase tracking-wider text-amber-800 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAI ? 'animate-spin' : ''}`} />
              {loadingAI ? 'Loading' : 'Reload'}
            </button>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-line">{aiInsight}</p>
          <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
            Observations from your log only — not medical advice.
          </p>
        </div>
      </div>

      {logLoading && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-4 py-2 rounded-full">
          Syncing…
        </div>
      )}
    </div>
  );
}
