import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Plus, RotateCcw, X, Wind,
  TrendingDown, TrendingUp, Minus, Brain,
  Zap, Coffee, Users, Smile, Clock, Sparkles,
  Check, Info, ArrowRight, Gamepad2, Heart
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine
} from "recharts";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../services/api";
import SEO from "../hooks/useSEO";

const LOG_KEY = "takehealth_smoke_log";
const AI_INSIGHT_KEY = "takehealth_smoke_ai_insight";

const loadAiInsight = () => {
  return localStorage.getItem(AI_INSIGHT_KEY) || "Shining the light of awareness on your habits is the prerequisite to freedom. By logging, you gain choice.";
};

const saveAiInsight = (val) => {
  localStorage.setItem(AI_INSIGHT_KEY, val);
};

const getTodayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const loadLog = () => {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || "{}");
  } catch {
    return {};
  }
};

const saveLog = (l) => {
  localStorage.setItem(LOG_KEY, JSON.stringify(l));
  window.dispatchEvent(new Event("storage"));
};

const TRIGGERS = [
  { id: "stress", label: "Stress", icon: Zap, color: "text-rose-500", bg: "bg-rose-50", border: "border-rose-100" },
  { id: "habit", label: "Habit", icon: Clock, color: "text-orange-500", bg: "bg-orange-50", border: "border-orange-100" },
  { id: "boredom", label: "Boredom", icon: Smile, color: "text-yellow-500", bg: "bg-yellow-50", border: "border-yellow-100" },
  { id: "social", label: "Social", icon: Users, color: "text-blue-500", bg: "bg-blue-50", border: "border-blue-100" },
  { id: "after_meal", label: "After meal", icon: Coffee, color: "text-purple-500", bg: "bg-purple-50", border: "border-purple-100" },
];

const AWARENESS_MESSAGES = [
  "Logged. Awareness is the first step toward lasting change.",
  "Noted. Recognizing your triggers is a victory in itself.",
  "Recorded. Every entry builds a clearer picture of your habits.",
  "Logged. You are gaining awareness. That is where freedom starts.",
  "Added. Understanding takes time, and you're investing that today.",
];

const PERSONAL_MOTIVATIONS = {
  stress: [
    "Your body is asking for deep breathing, not nicotine. Close your eyes, drop your shoulders, and let this stress pass naturally. You have the power to stay calm.",
    "Stress triggers the fight-or-flight response, but smoking only raises your heart rate further. Inhale peaceful, clean air right now. You are stronger than this craving.",
    "This moment is tough, but you are tougher. Let's surf this wave of stress. A deep breath will wash it away, no smoke required."
  ],
  habit: [
    "This is just an automated reflex your brain is running out of familiarity. By pausing and playing a game instead, you are actively rewriting your mental pathways!",
    "Automatic habits feel powerful, but awareness breaks them instantly. You are in the driver's seat today. Let's disrupt this loop.",
    "A habit is just a path you've walked before. Today, you are choosing a fresh, healthy trail. Keep guiding your mind forward!"
  ],
  boredom: [
    "Boredom is simply a signal that your brain wants engagement. Let's channel that energy into a high-score game or a fresh focus instead of smoke!",
    "Your mind is searching for a spark. A cigarette is temporary; building a healthy distraction lasts. Let's play a round to reboot your focus.",
    "Boredom is a blank canvas. Let's color it with quick gameplay and clear logic. You're keeping your hands and mind beautifully active."
  ],
  social: [
    "You don't need a cigarette to be part of the group. Your conversations, laughter, and authentic self are more than enough. Stand tall in your health choices.",
    "Peer cues are powerful, but choosing your health is a massive personal victory. Be the inspiring example of clean breathing in your circle.",
    "Social connections are about presence, not shared habits. Breathe deep, smile, and connect cleanly. You've got this!"
  ],
  after_meal: [
    "A wonderful meal is meant to nourish and energize you. Savor the taste of food, take a sip of refreshing water, and let your body digest cleanly.",
    "Smoking after eating chemically overrides the relaxation of your digestion. Let your body rest, heal, and absorb nutrients peacefully.",
    "Celebrate a great meal by giving your lungs clean air. Savor the lingering flavors and celebrate this clean choice!"
  ]
};

const WEB_GAMES = [
  { id: "2048", name: "2048 Puzzle", url: "https://gabrielecirulli.github.io/2048/", description: "Slide tiles to merge matching numbers and reach the 2048 block!" },
  { id: "trex", name: "T-Rex Runner", url: "https://wayou.github.io/t-rex-runner/", description: "Jump obstacles as the running dinosaur!" },
  { id: "hextris", name: "Hextris Spinner", url: "https://hextris.github.io/hextris/", description: "Spin the hexagon to match colored blocks!" }
];

const ChartTooltip = ({ active, payload }) =>
  active && payload?.length ? (
    <div className="bg-slate-900 border border-slate-800 text-white text-[11px] font-bold px-3 py-2 rounded-xl shadow-xl">
      <p>{payload[0].payload.count} cigarette{payload[0].payload.count !== 1 ? "s" : ""}</p>
      <p className="text-slate-400 font-semibold">{payload[0].payload.label}</p>
    </div>
  ) : null;

export default function SmokeTracker() {
  const navigate = useNavigate();
  const [log, setLog] = useState(loadLog);
  
  // Interactive UI States
  const [showTriggerRow, setShowTriggerRow] = useState(false);
  const [lastSessionId, setLastSessionId] = useState(null);
  
  // Rescue Center Modal States
  const [showRescueModal, setShowRescueModal] = useState(false);
  const [rescueTrigger, setRescueTrigger] = useState(null); // trigger reason
  const [rescueMode, setRescueMode] = useState(null); // 'message' or 'game'
  const [activeGameIndex, setActiveGameIndex] = useState(0);
  const [activeMessage, setActiveMessage] = useState("");
  
  const [aiInsight, setAiInsight] = useState(loadAiInsight);
  const [loadingAI, setLoadingAI] = useState(false);
  const triggerHideTimeout = useRef(null);

  const today = getTodayKey();
  const todayEntry = log[today] || { count: 0, sessions: [], resistedCount: 0 };
  const todayCount = todayEntry.count;
  const todayResisted = todayEntry.resistedCount || 0;

  // 1. Sync & Hydration with Database
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await api.get("health/smoke-log");
        if (response.data && response.data.smokeLog) {
          setLog(response.data.smokeLog);
          saveLog(response.data.smokeLog);
        }
      } catch (err) {
        console.error("Failed to load smoke logs from DB:", err);
      }
    };
    fetchLogs();
  }, []);

  const syncWithServer = async (updatedLog) => {
    try {
      await api.post("health/smoke-log", { smokeLog: updatedLog });
    } catch (err) {
      console.error("Failed to sync smoke logs to DB:", err);
    }
  };

  // Compute 7-day logs
  const days7 = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return {
        k,
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        count: log[k]?.count || 0,
        resistedCount: log[k]?.resistedCount || 0,
        isToday: i === 6
      };
    });
  }, [log]);

  const past6 = useMemo(() => days7.slice(0, 6).filter((d) => d.count > 0), [days7]);
  const avg = useMemo(() => {
    return past6.length > 0
      ? Math.round(past6.reduce((s, d) => s + d.count, 0) / past6.length)
      : null;
  }, [past6]);

  const diff = avg !== null ? todayCount - avg : null;

  // Calculate historical aggregates
  const historyStats = useMemo(() => {
    const allDays = Object.values(log);
    const weekTotal = days7.reduce((s, d) => s + d.count, 0);
    const totalCigsLogged = allDays.reduce((s, e) => s + (e.count || 0), 0);
    const totalResistedLogged = allDays.reduce((s, e) => s + (e.resistedCount || 0), 0);

    const triggerFreq = allDays
      .flatMap((e) => e.sessions || [])
      .reduce((acc, s) => {
        if (s.trigger) acc[s.trigger] = (acc[s.trigger] || 0) + 1;
        return acc;
      }, {});

    const topTrigger = Object.entries(triggerFreq).sort((a, b) => b[1] - a[1])[0]?.[0];

    const allSessions = allDays.flatMap((e) => e.sessions || []);
    const hourBreakdown = allSessions.reduce((acc, s) => {
      const h = new Date(s.time).getHours();
      const slot = h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
      acc[slot] = (acc[slot] || 0) + 1;
      return acc;
    }, {});
    const topTimeSlot = Object.entries(hourBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] || "Evening";

    return { weekTotal, totalCigsLogged, totalResistedLogged, topTrigger, topTimeSlot };
  }, [log, days7]);

  const timeBreakdown = useMemo(() => {
    return todayEntry.sessions.reduce((acc, s) => {
      const h = new Date(s.time).getHours();
      const slot = h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
      acc[slot] = (acc[slot] || 0) + s.count;
      return acc;
    }, {});
  }, [todayEntry]);

  // Fetch AI Coaching Insight on mount (fast fallback if slow)
  const fetchAI = useCallback(async () => {
    if (loadingAI) return;
    setLoadingAI(true);
    try {
      const prompt = `You are a compassionate, non-judgmental smoking awareness coach. User data: today=${todayCount} cigarettes, 6-day avg=${avg ?? "no data"}, topTrigger=${historyStats.topTrigger ?? "unknown"}, resistedCount=${historyStats.totalResistedLogged}. Write exactly 2 warm sentences focused on pattern awareness and one quick alternative. Never shame.`;
      const res = await api.post("health/ai-chat", { message: prompt, chatHistory: [] });
      const text = res.data?.response || res.data?.message || res.data?.content;
      if (text) {
        const trimmed = text.trim();
        setAiInsight(trimmed);
        saveAiInsight(trimmed);
      }
    } catch {
      // Catch error silently, keeps existing cached insight in place
    } finally {
      setLoadingAI(false);
    }
  }, [todayCount, avg, historyStats]);

  useEffect(() => {
    fetchAI();
  }, []);

  // Log a cigarette instantly
  const logOne = useCallback(() => {
    const now = new Date().toISOString();
    const sessionId = now;
    setLog((prev) => {
      const u = { ...prev };
      const t = u[today] || { count: 0, sessions: [], resistedCount: 0 };
      u[today] = {
        count: t.count + 1,
        resistedCount: t.resistedCount || 0,
        sessions: [...t.sessions, { time: now, count: 1, trigger: null, id: sessionId }]
      };
      saveLog(u);
      syncWithServer(u);
      return u;
    });
    setLastSessionId(sessionId);
    setShowTriggerRow(true);
    clearTimeout(triggerHideTimeout.current);
    triggerHideTimeout.current = setTimeout(() => setShowTriggerRow(false), 12000);

    const msg = AWARENESS_MESSAGES[Math.floor(Math.random() * AWARENESS_MESSAGES.length)];
    toast(msg, { icon: "○", style: { fontSize: "12px", fontWeight: "600" } });
  }, [today]);

  // Undo the last logged cigarette
  const undo = useCallback(() => {
    setLog((prev) => {
      const u = { ...prev };
      const t = u[today];
      if (!t || t.count === 0) return prev;
      const sessions = [...t.sessions];
      const last = sessions.pop();
      u[today] = {
        count: Math.max(0, t.count - (last?.count || 1)),
        resistedCount: t.resistedCount || 0,
        sessions
      };
      saveLog(u);
      syncWithServer(u);
      return u;
    });
    setShowTriggerRow(false);
    toast("Removed last cigarette log", { icon: "↩" });
  }, [today]);

  // Tag a trigger to the last logged cigarette
  const tagTrigger = useCallback((triggerId) => {
    setLog((prev) => {
      const u = { ...prev };
      const t = u[today];
      if (!t) return prev;
      const sessions = t.sessions.map((s) =>
        s.id === lastSessionId ? { ...s, trigger: triggerId } : s
      );
      u[today] = { ...t, sessions };
      saveLog(u);
      syncWithServer(u);
      return u;
    });
    setShowTriggerRow(false);
    const label = TRIGGERS.find((t) => t.id === triggerId)?.label || "";
    toast(`Tagged as: ${label}`, { icon: "✓" });
  }, [today, lastSessionId]);

  // Log a successfully resisted craving victory
  const logVictory = useCallback(() => {
    setLog((prev) => {
      const u = { ...prev };
      const t = u[today] || { count: 0, sessions: [], resistedCount: 0 };
      u[today] = {
        ...t,
        resistedCount: (t.resistedCount || 0) + 1
      };
      saveLog(u);
      syncWithServer(u);
      return u;
    });
    toast.success("Urge Surfed successfully! 🏆", {
      style: {
        background: '#10b981',
        color: '#fff',
        fontWeight: 'bold'
      }
    });
  }, [today]);

  // Handle trigger reason selection & route instantly to message or game
  const handleSelectReason = (triggerId) => {
    setRescueTrigger(triggerId);
    
    // Select motivation message list for this reason
    const msgs = PERSONAL_MOTIVATIONS[triggerId] || PERSONAL_MOTIVATIONS.stress;
    setActiveMessage(msgs[Math.floor(Math.random() * msgs.length)]);
    
    // Choose mode (60% chance Game, 40% chance Message)
    const isGame = Math.random() < 0.6;
    setRescueMode(isGame ? "game" : "message");
    
    // Pick random initial game index
    setActiveGameIndex(Math.floor(Math.random() * WEB_GAMES.length));
  };

  const handleCloseRescue = () => {
    setShowRescueModal(false);
    setRescueTrigger(null);
    setRescueMode(null);
  };

  const handleUrgeSurfed = () => {
    logVictory();
    handleCloseRescue();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-850 flex flex-col w-full max-w-md mx-auto shadow-2xl overflow-hidden font-roboto border-x border-slate-100 relative">
      <SEO pageName="smokeTracker" />
      
      {/* Streamlined Header */}
      <header className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 sticky top-0 z-20">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl hover:bg-slate-50 active:scale-90 transition-all flex items-center justify-center border border-slate-100 text-slate-700 bg-white">
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="text-center">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600">Habit Tracker</span>
          <h1 className="text-sm font-black text-slate-900 uppercase tracking-wider mt-0.5">Smoke Log & Rescue</h1>
        </div>
        <div className="w-10 h-10" /> {/* Spacer */}
      </header>

      {/* Main Streamlined Dashboard Content */}
      <div className="flex-1 overflow-y-auto pb-24 p-5 space-y-6">
        
        {/* Main Logging Panel */}
        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 text-center relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>

          <div className="flex items-center justify-center gap-8 mb-5">
            {/* Undo Button */}
            <button
              onClick={undo}
              disabled={todayCount === 0}
              className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 flex items-center justify-center disabled:opacity-20 active:scale-95 transition-all text-slate-500 hover:text-black"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Big Counter */}
            <div>
              <motion.span
                key={todayCount}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-8xl font-black text-slate-900 leading-none block tabular-nums drop-shadow-sm"
              >
                {todayCount}
              </motion.span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-3 block">
                {todayCount === 0 ? "Perfectly Clear 🌿" : "Cigarettes Smoked"}
              </span>
            </div>

            {/* Plus Button */}
            <button
              onClick={logOne}
              className="w-12 h-12 rounded-2xl bg-rose-500 flex items-center justify-center text-white active:scale-90 hover:bg-rose-600 transition-all shadow-xl shadow-rose-200/50"
            >
              <Plus className="w-5 h-5" strokeWidth={3} />
            </button>
          </div>

          {/* Victory & Rescue Shortcut */}
          <div className="border-t border-slate-100 pt-5 mt-4 flex flex-col items-center gap-3">
            <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-black uppercase tracking-wider bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span>{todayResisted} urg{todayResisted === 1 ? "e" : "es"} surfed today</span>
            </div>
            
            <button
              onClick={() => {
                setRescueTrigger(null);
                setRescueMode(null);
                setShowRescueModal(true);
              }}
              className="flex items-center gap-2 text-xs font-black uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-6 py-3.5 rounded-2xl shadow-xl shadow-emerald-100/50 transition-all active:scale-95 animate-pulse"
            >
              ⚡ Resist an Urge / Craving
            </button>
          </div>

          {/* Averages diff */}
          {diff !== null && (
            <div className={`mt-5 mx-auto max-w-[280px] py-2.5 px-4 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest border ${diff < 0 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : diff > 0 ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-slate-50 text-slate-500 border-slate-100"}`}>
              {diff < 0 ? <TrendingDown className="w-4 h-4 shrink-0" /> : diff > 0 ? <TrendingUp className="w-4 h-4 shrink-0" /> : <Minus className="w-4 h-4 shrink-0" />}
              <span>
                {diff === 0
                  ? `Matches Daily Average · ${avg}/day`
                  : diff < 0
                    ? `${Math.abs(diff)} below average (${avg}/day) 🌿`
                    : `${diff} above average (${avg}/day)`}
              </span>
            </div>
          )}

          {/* Trigger Chips */}
          <AnimatePresence>
            {showTriggerRow && (
              <motion.div
                initial={{ opacity: 0, y: 8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: 8, height: 0 }}
                transition={{ duration: 0.25 }}
                className="mt-6 pt-5 border-t border-slate-100 overflow-hidden"
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center mb-3">
                  What triggered this smoke? <span className="font-semibold text-slate-400 lowercase">(optional)</span>
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {TRIGGERS.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        onClick={() => tagTrigger(t.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 active:scale-95 transition-all"
                      >
                        <Icon className={`w-3.5 h-3.5 ${t.color}`} />
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">{t.label}</span>
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setShowTriggerRow(false)}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-wide"
                  >
                    Skip
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* AI Pattern Predictor */}
        {historyStats.topTrigger && (
          <div className="bg-white border border-slate-100 rounded-3xl p-5 flex items-start gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
              <Brain className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-amber-700 font-bold">AI Pattern Predictor</span>
              <h4 className="text-xs font-black text-slate-800">High Risk Zone Detected</h4>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                You are most vulnerable in the <span className="text-amber-600 font-extrabold">{historyStats.topTimeSlot}</span> due to <span className="text-amber-600 font-extrabold">{TRIGGERS.find(t => t.id === historyStats.topTrigger)?.label || historyStats.topTrigger}</span>. Prepare a cold glass of ice water!
              </p>
            </div>
          </div>
        )}

        {/* Recharts Bar Chart */}
        <div className="bg-white border border-slate-100 rounded-[2rem] p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">7-Day Logging History</h3>
            {avg && <span className="text-[10px] font-bold text-slate-400">Average: {avg}/day</span>}
          </div>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days7} margin={{ top: 10, right: 5, left: -30, bottom: 0 }}>
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: "bold" }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 9 }} width={28} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,0,0,0.02)", radius: 8 }} />
                {avg && <ReferenceLine y={avg} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1} />}
                <Bar dataKey="count" radius={[6, 6, 6, 6]} maxBarSize={22}>
                  {days7.map((d, i) => (
                    <Cell key={i} fill={
                      d.count === 0 ? "#f1f5f9"
                        : d.isToday ? (avg && d.count < avg ? "#10b981" : "#f43f5e")
                          : "#94a3b8"
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-5 mt-4 text-[9px] font-black uppercase tracking-wider text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />Today</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />Below Avg</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-300" />Past logs</span>
          </div>
        </div>

        {/* Dynamic Coach Insight Card */}
        <div className="bg-white border border-slate-100 rounded-[2rem] p-6 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">AI Quit Coach Insight</h4>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Real-time analytical advice</p>
              </div>
            </div>
            <button onClick={fetchAI} disabled={loadingAI} className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center border border-slate-100 active:scale-95 transition-all text-slate-500">
              <RotateCcw className={`w-3.5 h-3.5 ${loadingAI ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loadingAI ? (
            <div className="space-y-2 py-2">
              <div className="h-2 bg-slate-100 rounded animate-pulse w-full" />
              <div className="h-2 bg-slate-100 rounded animate-pulse w-4/5" />
            </div>
          ) : (
            <p className="text-xs font-bold leading-relaxed text-slate-600">
              "{aiInsight || "Your custom quit plan is generating. Keep recording your logs to unlock customized patterns."}"
            </p>
          )}
        </div>
      </div>

      {/* FULL-SCREEN RESCUE MODAL OVERLAY */}
      <AnimatePresence>
        {showRescueModal && (
          <div className="fixed inset-0 z-[9999] flex flex-col justify-end bg-black/60 backdrop-blur-sm max-w-md mx-auto">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="bg-white rounded-t-[2.5rem] border-t border-slate-100 p-6 flex flex-col max-h-[90vh] shadow-2xl"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-600" />
                    <span>AI Craving Rescue Center</span>
                  </h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Let's surf this crave together</p>
                </div>
                <button
                  onClick={handleCloseRescue}
                  className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center border border-slate-200 transition-all"
                >
                  <X className="w-4 h-4 text-slate-600" />
                </button>
              </div>

              {/* Step 1: Select Urge Reason */}
              {!rescueTrigger ? (
                <div className="space-y-4 py-4">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500 text-center">What is triggering your urge?</p>
                  <div className="grid grid-cols-2 gap-3">
                    {TRIGGERS.map((t) => {
                      const Icon = t.icon;
                      return (
                        <button
                          key={t.id}
                          onClick={() => handleSelectReason(t.id)}
                          className="bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-2xl p-4 flex flex-col items-center gap-2 transition-all active:scale-95 group shadow-sm"
                        >
                          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-slate-100 group-hover:scale-105 transition-all shadow-sm">
                            <Icon className={`w-5 h-5 ${t.color}`} />
                          </div>
                          <span className="text-xs font-black text-slate-700 uppercase tracking-wider">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Step 2: Render Distraction Content (Message or Game Chosen Randomly) */
                <div className="flex-1 flex flex-col space-y-4 pb-4 overflow-y-auto">
                  
                  {/* Info Badge */}
                  <div className="flex items-center justify-between bg-slate-50 py-2.5 px-4 rounded-xl border border-slate-100 shrink-0">
                    <span className="text-[10px] font-black uppercase text-slate-500">
                      Trigger Cued: <span className="text-rose-500 font-extrabold">{TRIGGERS.find(t => t.id === rescueTrigger)?.label}</span>
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                      {rescueMode === "game" ? "🎮 Interactive Distraction" : "💬 Mindful Intermission"}
                    </span>
                  </div>

                  {rescueMode === "message" ? (
                    /* Motivation Message View */
                    <div className="flex-1 flex flex-col justify-center items-center py-6 space-y-6">
                      <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 animate-pulse">
                        <Heart className="w-7 h-7 text-emerald-500 fill-emerald-500" />
                      </div>
                      <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl relative overflow-hidden shadow-inner text-center w-full">
                        <p className="text-sm font-bold text-slate-700 leading-relaxed italic">
                          "{activeMessage}"
                        </p>
                      </div>
                      
                      <div className="text-center max-w-xs space-y-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Take 3 deep, slow diaphragmatic breaths.</span>
                        <p className="text-[9px] font-semibold text-slate-400 leading-relaxed">Breathing stimulates the vagus nerve to chemically calm stress pathways.</p>
                      </div>
                    </div>
                  ) : (
                    /* Web Arcade Games View */
                    <div className="flex-1 flex flex-col space-y-3">
                      {/* Game Description */}
                      <p className="text-[10px] text-slate-400 font-bold leading-normal text-center bg-slate-50/50 py-2 rounded-lg px-2 shrink-0">
                        🎯 <span className="font-extrabold text-slate-600 uppercase tracking-wide">{WEB_GAMES[activeGameIndex].name}: </span>
                        {WEB_GAMES[activeGameIndex].description}
                      </p>

                      {/* Responsive Arcade Frame */}
                      <div className="flex-1 bg-slate-100 border border-slate-200 rounded-[2rem] overflow-hidden relative min-h-[380px] shadow-sm">
                        <iframe
                          src={WEB_GAMES[activeGameIndex].url}
                          className="w-full h-full border-none rounded-[2rem]"
                          title={WEB_GAMES[activeGameIndex].name}
                        />
                      </div>
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div className="flex flex-col gap-2.5 pt-3 shrink-0">
                    <button
                      onClick={handleUrgeSurfed}
                      className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white py-4 rounded-2xl shadow-xl shadow-emerald-100 transition-all active:scale-95 w-full font-roboto"
                    >
                      🏆 Urge Surfed! Log Victory
                    </button>
                    
                    <button
                      onClick={() => setRescueTrigger(null)}
                      className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 text-center py-1"
                    >
                      Change Trigger Reason
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
