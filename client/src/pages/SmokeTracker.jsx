import React, { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Plus, RotateCcw, X, Wind,
  TrendingDown, TrendingUp, Minus, Brain,
  Zap, Coffee, Users, Smile, Clock
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine
} from "recharts";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../services/api";

const KEY = "takehealth_smoke_log";

const getTodayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

const loadLog = () => { try { return JSON.parse(localStorage.getItem(KEY)||"{}"); } catch { return {}; } };
const saveLog = l => { localStorage.setItem(KEY, JSON.stringify(l)); window.dispatchEvent(new Event("storage")); };

const TRIGGERS = [
  { id:"stress",     label:"Stress",     icon: Zap,   color:"text-rose-500",   bg:"bg-rose-50"   },
  { id:"habit",      label:"Habit",      icon: Clock,  color:"text-orange-500", bg:"bg-orange-50" },
  { id:"boredom",    label:"Boredom",    icon: Smile,  color:"text-yellow-500", bg:"bg-yellow-50" },
  { id:"social",     label:"Social",     icon: Users,  color:"text-blue-500",   bg:"bg-blue-50"   },
  { id:"after_meal", label:"After meal", icon: Coffee, color:"text-purple-500", bg:"bg-purple-50" },
];

// Warm, non-judgmental messages shown after logging — awareness not guilt
const AWARENESS_MESSAGES = [
  "Logged. Awareness is the foundation of change.",
  "Noted. You're building a picture of your pattern.",
  "Recorded. Every data point helps.",
  "Logged. Knowing when you smoke is the first step.",
  "Added. Understanding your habit takes time — you're doing that.",
];

const ChartTooltip = ({ active, payload }) =>
  active && payload?.length ? (
    <div className="bg-slate-800 text-white text-[10px] font-black px-3 py-2 rounded-xl shadow-xl">
      <p>{payload[0].payload.count} cigarette{payload[0].payload.count !== 1 ? "s" : ""}</p>
      <p className="text-slate-400">{payload[0].payload.label}</p>
    </div>
  ) : null;

export default function SmokeTracker() {
  const navigate = useNavigate();
  const [log, setLog] = useState(loadLog);
  const [showTriggerRow, setShowTriggerRow] = useState(false);
  const [lastSessionId, setLastSessionId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const triggerHideTimeout = useRef(null);

  const today = getTodayKey();
  const todayEntry = log[today] || { count: 0, sessions: [] };
  const todayCount = todayEntry.count;

  // 7-day data
  const days7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    return { k, label: d.toLocaleDateString("en-US", { weekday: "short" }), count: log[k]?.count || 0, isToday: i === 6 };
  });

  const past6 = days7.slice(0, 6).filter(d => d.count > 0);
  const avg = past6.length > 0 ? Math.round(past6.reduce((s, d) => s + d.count, 0) / past6.length) : null;
  const diff = avg !== null ? todayCount - avg : null;
  const weekTotal = days7.reduce((s, d) => s + d.count, 0);

  // Trigger frequency across all history
  const triggerFreq = Object.values(log)
    .flatMap(e => e.sessions || [])
    .reduce((acc, s) => { if (s.trigger) acc[s.trigger] = (acc[s.trigger] || 0) + 1; return acc; }, {});
  const topTrigger = Object.entries(triggerFreq).sort((a, b) => b[1] - a[1])[0]?.[0];

  // Time-of-day breakdown for today
  const timeBreakdown = todayEntry.sessions.reduce((acc, s) => {
    const h = new Date(s.time).getHours();
    const slot = h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
    acc[slot] = (acc[slot] || 0) + s.count;
    return acc;
  }, {});

  // Log one cigarette immediately — no modal, no friction
  const logOne = useCallback(() => {
    const now = new Date().toISOString();
    const sessionId = now;
    setLog(prev => {
      const u = { ...prev };
      const t = u[today] || { count: 0, sessions: [] };
      u[today] = { count: t.count + 1, sessions: [...t.sessions, { time: now, count: 1, trigger: null, id: sessionId }] };
      saveLog(u);
      return u;
    });
    setLastSessionId(sessionId);
    // Show trigger chips briefly
    setShowTriggerRow(true);
    clearTimeout(triggerHideTimeout.current);
    triggerHideTimeout.current = setTimeout(() => setShowTriggerRow(false), 8000);
    // Warm message — not guilt
    const msg = AWARENESS_MESSAGES[Math.floor(Math.random() * AWARENESS_MESSAGES.length)];
    toast(msg, { icon: "○", style: { fontSize: "12px", fontWeight: "600" } });
  }, [today]);

  // Tag trigger on the last session
  const tagTrigger = useCallback((triggerId) => {
    setLog(prev => {
      const u = { ...prev };
      const t = u[today];
      if (!t) return prev;
      const sessions = t.sessions.map(s =>
        s.id === lastSessionId ? { ...s, trigger: triggerId } : s
      );
      u[today] = { ...t, sessions };
      saveLog(u);
      return u;
    });
    setShowTriggerRow(false);
    const label = TRIGGERS.find(t => t.id === triggerId)?.label || "";
    toast(`Tagged: ${label}`, { icon: "✓" });
  }, [today, lastSessionId]);

  const undo = useCallback(() => {
    setLog(prev => {
      const u = { ...prev }, t = u[today];
      if (!t || t.count === 0) return prev;
      const sessions = [...t.sessions];
      const last = sessions.pop();
      u[today] = { count: Math.max(0, t.count - (last?.count || 1)), sessions };
      saveLog(u);
      return u;
    });
    setShowTriggerRow(false);
    toast("Removed last entry");
  }, [today]);

  const fetchAI = useCallback(async () => {
    if (loadingAI) return;
    setLoadingAI(true);
    try {
      const prompt = `You are a compassionate, non-judgmental smoking awareness coach. User data: today=${todayCount} cigarettes, 6-day avg=${avg ?? "no data"}, topTrigger=${topTrigger ?? "unknown"}, weekTotal=${weekTotal}, timePattern=${JSON.stringify(timeBreakdown)}. Write 2-3 warm sentences focused on pattern awareness and ONE specific micro-action based on their actual data. Never shame them. Never celebrate any amount of smoking.`;
      const res = await api.post("health/ai-chat", { message: prompt, chatHistory: [] });
      const text = res.data?.response || res.data?.message || res.data?.content;
      if (text) setAiInsight(text.slice(0, 350));
    } catch {
      setAiInsight("Keep logging daily — patterns become visible over time, and that visibility is what drives change.");
    } finally { setLoadingAI(false); }
  }, [todayCount, avg, topTrigger, weekTotal]);

  // Fetch AI on first mount
  React.useEffect(() => { fetchAI(); }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col w-full max-w-md mx-auto shadow-2xl overflow-hidden">
      {/* Header */}
      <header className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 sticky top-0 z-10">
        <button onClick={() => navigate(-1)}><ChevronLeft className="w-6 h-6 text-slate-700" /></button>
        <h1 className="text-lg font-black text-black">Smoke Log</h1>
        <button onClick={() => setShowHistory(true)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-black transition">History</button>
      </header>

      <div className="flex-1 overflow-y-auto pb-24">

        {/* Counter */}
        <div className="bg-white px-6 py-8 border-b border-slate-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center mb-6">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>

          <div className="flex items-center justify-center gap-10">
            {/* Undo */}
            <button onClick={undo} disabled={todayCount === 0}
              className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center disabled:opacity-25 active:scale-95 transition-all">
              <RotateCcw className="w-4 h-4 text-slate-500" />
            </button>

            {/* Big count */}
            <div className="text-center">
              <motion.span key={todayCount} initial={{ scale: 1.25, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }}
                className="text-8xl font-black text-black leading-none block tabular-nums">
                {todayCount}
              </motion.span>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-3 block">
                {todayCount === 0 ? "None logged today" : `smoked today`}
              </span>
            </div>

            {/* Log one */}
            <button onClick={logOne}
              className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center text-white active:scale-90 transition-all shadow-xl shadow-black/20">
              <Plus className="w-5 h-5" strokeWidth={3} />
            </button>
          </div>

          {/* Personal avg comparison */}
          {diff !== null && (
            <div className={`mt-5 mx-auto max-w-[280px] py-2 px-4 rounded-2xl flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest ${diff < 0 ? "bg-emerald-50 text-emerald-600" : diff > 0 ? "bg-rose-50 text-rose-500" : "bg-slate-50 text-slate-500"}`}>
              {diff < 0 ? <TrendingDown className="w-4 h-4 shrink-0" /> : diff > 0 ? <TrendingUp className="w-4 h-4 shrink-0" /> : <Minus className="w-4 h-4 shrink-0" />}
              <span>
                {diff === 0
                  ? `Same as your avg · ${avg}/day`
                  : diff < 0
                    ? `${Math.abs(diff)} below your avg · ${avg}/day`
                    : `${diff} above your avg · ${avg}/day`}
              </span>
            </div>
          )}

          {/* Optional trigger chips — shown for 8s after logging */}
          <AnimatePresence>
            {showTriggerRow && (
              <motion.div initial={{ opacity: 0, y: 8, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: 8, height: 0 }} transition={{ duration: 0.25 }}
                className="mt-4 overflow-hidden">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center mb-3">
                  What triggered it? <span className="font-medium normal-case">(optional)</span>
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {TRIGGERS.map(t => {
                    const Icon = t.icon;
                    return (
                      <button key={t.id} onClick={() => tagTrigger(t.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 ${t.bg} hover:border-slate-400 active:scale-95 transition-all`}>
                        <Icon className={`w-3 h-3 ${t.color}`} />
                        <span className="text-[11px] font-black text-slate-700">{t.label}</span>
                      </button>
                    );
                  })}
                  <button onClick={() => setShowTriggerRow(false)}
                    className="flex items-center px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all">
                    <span className="text-[11px] font-black text-slate-400">Skip</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-px bg-slate-100 border-b border-slate-100">
          {[
            { label: "Daily Avg", val: avg ?? "—", sub: "past 6 days" },
            { label: "This Week", val: weekTotal, sub: "total" },
            { label: "Top Trigger", val: topTrigger ? TRIGGERS.find(t => t.id === topTrigger)?.label ?? "—" : "—", sub: "most common" },
          ].map(s => (
            <div key={s.label} className="bg-white p-4 text-center">
              <p className="text-lg font-black text-black leading-none">{s.val}</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{s.label}</p>
              <p className="text-[9px] text-slate-300 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* 7-Day chart */}
        <div className="bg-white px-6 py-5 mt-3">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-base font-black text-slate-800">7-Day Pattern</h3>
            {avg && <span className="text-[10px] font-bold text-slate-400">avg {avg}/day</span>}
          </div>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days7} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: "bold" }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 9 }} width={28} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "transparent" }} />
                {avg && <ReferenceLine y={avg} stroke="#cbd5e1" strokeDasharray="4 3" strokeWidth={1.5} />}
                <Bar dataKey="count" radius={[8, 8, 8, 8]} maxBarSize={22}>
                  {days7.map((d, i) => (
                    <Cell key={i} fill={
                      d.count === 0 ? "#e2e8f0"
                        : d.isToday ? (avg && d.count < avg ? "#10b981" : "#000")
                          : "#64748b"
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-5 mt-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-black" />Today</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" />Below avg</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-500" />Past</span>
          </div>
        </div>

        {/* Time of day */}
        {Object.keys(timeBreakdown).length > 0 && (
          <div className="bg-white px-6 py-5 mt-3">
            <h3 className="text-base font-black text-slate-800 mb-4">When you smoke</h3>
            <div className="space-y-3">
              {["Morning", "Afternoon", "Evening"].filter(s => timeBreakdown[s]).map(slot => (
                <div key={slot} className="flex items-center gap-3">
                  <span className="text-[11px] font-black text-slate-500 w-20">{slot}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-black rounded-full" style={{ width: `${Math.min((timeBreakdown[slot] / todayCount) * 100, 100)}%` }} />
                  </div>
                  <span className="text-[11px] font-black text-black w-4 text-right">{timeBreakdown[slot]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Insight */}
        <div className="px-6 mt-3 pb-6">
          <div className="bg-black rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Brain className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-black uppercase tracking-widest">AI Pattern Insight</h4>
                  <p className="text-[9px] text-white/40 uppercase tracking-widest">Based on your real data</p>
                </div>
                <button onClick={fetchAI} disabled={loadingAI}
                  className="text-white/40 hover:text-white/80 transition shrink-0">
                  <RotateCcw className={`w-4 h-4 ${loadingAI ? "animate-spin" : ""}`} />
                </button>
              </div>
              {loadingAI
                ? <div className="space-y-2"><div className="h-2 bg-white/10 rounded animate-pulse w-full" /><div className="h-2 bg-white/10 rounded animate-pulse w-4/5" /><div className="h-2 bg-white/10 rounded animate-pulse w-3/5" /></div>
                : <p className="text-sm font-medium leading-relaxed opacity-90">"{aiInsight || "Log a few days to unlock personalized pattern insights."}"</p>
              }
            </div>
          </div>
        </div>
      </div>

      {/* History Drawer */}
      <AnimatePresence>
        {showHistory && (
          <div className="fixed inset-0 z-[100] flex items-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              className="relative bg-white w-full max-w-md mx-auto rounded-t-[2.5rem] p-6 z-10 max-h-[80vh] flex flex-col shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-black text-black">History</h3>
                <button onClick={() => setShowHistory(false)}
                  className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition">
                  <X className="w-4 h-4 text-slate-600" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {Object.entries(log).sort((a, b) => b[0].localeCompare(a[0])).map(([date, entry]) => {
                  const d = new Date(date);
                  const isToday = date === today;
                  const belowAvg = avg !== null && entry.count < avg;
                  const triggers = [...new Set((entry.sessions || []).filter(s => s.trigger).map(s => s.trigger))];
                  return (
                    <div key={date} className="p-4 bg-slate-50 rounded-2xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-black text-black">
                            {isToday ? "Today" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          </p>
                          {triggers.length > 0 && (
                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                              {triggers.map(t => TRIGGERS.find(tr => tr.id === t)?.label || t).join(" · ")}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {belowAvg && <TrendingDown className="w-4 h-4 text-emerald-500" />}
                          <p className={`text-2xl font-black ${belowAvg ? "text-emerald-600" : "text-black"}`}>{entry.count}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!Object.keys(log).length && (
                  <div className="text-center py-12 text-slate-400">
                    <Wind className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-bold">No history yet</p>
                    <p className="text-xs mt-1">Start logging to see your pattern</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
