import React, { useState, useEffect, useRef } from "react";
import { Droplet, ChevronDown, Activity, RefreshCw, Trash2, X, ListFilter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LogGlucoseModal from "../components/LogGlucoseModal";
import LogHba1cModal from "../components/LogHba1cModal";
import LogWeightModal from "../components/LogWeightModal";
import api from "../services/api";
import SEO from "../hooks/useSEO";
import { useAuth } from "../context/AuthContext";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
} from "recharts";

const getTargetRange = (diabetesProfile) => {
  const dp = diabetesProfile || {};
  const parsePair = (val, defaultLow, defaultHigh) => {
    if (!val) return [defaultLow, defaultHigh];
    const str = String(val);
    const parts = str.split(/[-–]/);
    if (parts.length === 2) {
      const lo = parseInt(parts[0]), hi = parseInt(parts[1]);
      if (!isNaN(lo) && !isNaN(hi)) return [lo, hi];
    }
    const num = parseInt(str);
    if (!isNaN(num)) return [70, num];
    return [defaultLow, defaultHigh];
  };
  const [lo, hi] = parsePair(dp.fastingGlucose, 70, 130);
  return { low: lo, high: hi };
};

const STATUS_CFG = {
  stable: { label: "In Range",     color: "#10b981", bg: "rgba(16,185,129,0.12)", text: "#059669" },
  high:   { label: "Above Range",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)", text: "#d97706" },
  low:    { label: "Below Range",  color: "#ef4444", bg: "rgba(239,68,68,0.12)",  text: "#dc2626" },
};

const GLASS = {
  background: "rgba(255,255,255,0.42)",
  backdropFilter: "blur(28px) saturate(180%)",
  border: "1px solid rgba(255,255,255,0.75)",
  boxShadow: "0 4px 24px rgba(16,185,129,0.07), inset 0 1px 0 rgba(255,255,255,0.9)",
};
const GLASS_SM = {
  background: "rgba(255,255,255,0.36)",
  backdropFilter: "blur(20px) saturate(160%)",
  border: "1px solid rgba(255,255,255,0.68)",
};

const FullHistoryModal = ({ isOpen, onClose, logs, onDelete }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-[9998] flex justify-center items-end md:items-center p-0 md:p-4 transition-opacity">
       <div className="bg-white/95 backdrop-blur-2xl w-full md:w-full md:max-w-md rounded-t-[32px] md:rounded-[32px] max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-slide-up md:animate-none">
         <div className="p-4 flex items-center justify-between border-b border-gray-100">
           <h3 className="font-black text-slate-800 text-lg">All Readings</h3>
           <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:text-black transition-colors">
             <X className="w-5 h-5"/>
           </button>
         </div>
         <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
           {logs.length === 0 && (
             <p className="text-center text-sm text-slate-400 py-10 font-medium">No readings found.</p>
           )}
           {logs.map((log) => (
             <div key={log._id} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div>
                   <div className="flex items-baseline gap-1.5">
                     <span className="font-black text-xl text-slate-800">{log.value}</span>
                     <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{log.type === "hba1c" ? "%" : log.type === "weight" ? "kg" : "mg/dL"}</span>
                   </div>
                   <div className="text-[12px] text-slate-500 font-bold mt-1 capitalize">{log.readingContext?.replace("-", " ") || log.type?.replace("_", " ")}</div>
                   <div className="text-[10px] text-gray-400 font-semibold mt-0.5">{new Date(log.recordedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</div>
                </div>
                <button onClick={() => onDelete(log._id)} className="w-9 h-9 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors active:scale-95">
                  <Trash2 className="w-4 h-4"/>
                </button>
             </div>
           ))}
         </div>
       </div>
       <style>{`
         @keyframes slide-up {
           from { transform: translateY(100%); }
           to { transform: translateY(0); }
         }
         .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
         .scrollbar-hide::-webkit-scrollbar { display: none; }
         .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
       `}</style>
    </div>
  );
};

export default function GlucoseLog() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const targetRange = getTargetRange(user?.profile?.diabetesProfile);

  const [showLogModal,    setShowLogModal]    = useState(false);
  const [showHba1cModal,  setShowHba1cModal]  = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showHistoryModal,setShowHistoryModal]= useState(false);

  const [recentReadings,  setRecentReadings]  = useState([]);
  const [glucoseHistory,  setGlucoseHistory]  = useState([]);
  const [hba1cHistory,    setHba1cHistory]    = useState([]);
  const [weightHistory,   setWeightHistory]   = useState([]);

  const [currentReading, setCurrentReading] = useState(108);
  const [status,         setStatus]         = useState("stable");
  const [isEditing,      setIsEditing]      = useState(false);
  const [editValue,      setEditValue]      = useState("108");

  const [trendType,            setTrendType]            = useState("blood_sugar");
  const [timeRange,            setTimeRange]            = useState("Week");
  const [showTrendDropdown,    setShowTrendDropdown]    = useState(false);
  const [compareMode,          setCompareMode]          = useState(false);
  const [glucoseFilterContext, setGlucoseFilterContext] = useState("all");
  const [aiAnalysis,           setAiAnalysis]           = useState(null);
  const [aiLoading,            setAiLoading]            = useState(false);

  const inputRef = useRef(null);
  const gaugeRef = useRef(null);

  /* ─── Data fetching ─── */
  useEffect(() => { fetchMetrics(); }, []); // eslint-disable-line

  const fetchMetrics = async () => {
    try {
      const [glucoseRes, hba1cRes, weightRes] = await Promise.all([
        api.get("metrics/blood_sugar?limit=50"),
        api.get("metrics/hba1c?limit=50"),
        api.get("metrics/weight?limit=50"),
      ]);
      const glucoseData = glucoseRes.data || [];
      setGlucoseHistory(glucoseData);
      setRecentReadings(glucoseData.slice(0, 10));
      setHba1cHistory(hba1cRes.data || []);
      setWeightHistory(weightRes.data || []);

      if (glucoseData.length > 0) {
        const latest = glucoseData[0].value;
        setCurrentReading(latest);
        setEditValue(String(latest));
        updateStatus(latest);
      }
    } catch (e) {
      console.error("Error fetching metrics:", e);
    }
    fetchAiAnalysis();
  };

  const fetchAiAnalysis = async () => {
    try {
      setAiLoading(true);
      const res = await api.get("metrics/analysis/glucose");
      if (res.data?.success) setAiAnalysis(res.data.data);
    } catch (e) {
      console.error("Error fetching AI analysis:", e);
    } finally {
      setAiLoading(false);
    }
  };

  const updateStatus = (val) => {
    if      (val >= targetRange.low && val <= targetRange.high) setStatus("stable");
    else if (val > targetRange.high)                            setStatus("high");
    else                                                         setStatus("low");
  };

  const saveReading = async (type, value, unit, context, timestamp) => {
    await api.post("metrics", { type, value, unit, readingContext: context, recordedAt: timestamp, notes: "" });
    fetchMetrics();
  };
  
  const deleteReading = async (id) => {
    try {
      await api.delete(`metrics/${id}`);
      fetchMetrics();
    } catch (e) {
      console.error("Failed to delete reading", e);
    }
  };

  const handleLogGlucose = async (r) => { await saveReading("blood_sugar", r.value, "mg/dL", r.type, r.timestamp); };
  const handleLogHba1c   = async (r) => { await saveReading("hba1c", r.value, "%", "fasting", r.timestamp); setTrendType("hba1c"); };
  const handleLogWeight  = async (r) => { await saveReading("weight", r.value, "kg", "general", r.timestamp); setTrendType("weight"); };

  /* ─── Gauge editing ─── */
  const handleEditStart  = () => { setIsEditing(true); setEditValue(String(currentReading)); setTimeout(() => inputRef.current?.select(), 50); };
  const handleEditChange = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    if (val.length <= 3) { setEditValue(val); const n = parseInt(val) || 0; if (n >= 40 && n <= 400) { setCurrentReading(n); updateStatus(n); } }
  };
  const handleEditBlur   = () => { setIsEditing(false); const n = Math.min(Math.max(parseInt(editValue) || 108, 40), 400); setCurrentReading(n); setEditValue(String(n)); updateStatus(n); };
  const handleEditKeyDown = (e) => { if (e.key === "Enter") handleEditBlur(); };

  /* ─── Gauge drag ─── */
  const handleGaugeInteraction = (e) => {
    if (!gaugeRef.current) return;
    const rect = gaugeRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * 0.90;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    let angle = Math.atan2(clientX - cx, cy - clientY) * (180 / Math.PI);
    angle = Math.max(-135, Math.min(135, angle));
    const val = Math.round(40 + ((angle + 135) / 270) * 360);
    const clamped = Math.min(Math.max(val, 40), 400);
    setCurrentReading(clamped); setEditValue(String(clamped)); updateStatus(clamped);
  };

  const bindGaugeDrag = {
    onClick: handleGaugeInteraction,
    onMouseDown: (e) => {
      const onMove = (ev) => handleGaugeInteraction(ev);
      const onUp   = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup",   onUp);
    },
    onTouchStart: (e) => {
      handleGaugeInteraction(e);
      const onMove = (ev) => handleGaugeInteraction(ev);
      const onEnd  = () => { window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onEnd); };
      window.addEventListener("touchmove", onMove);
      window.addEventListener("touchend",  onEnd);
    },
  };

  const getGaugeAngle = () => -135 + ((Math.min(Math.max(currentReading, 40), 400) - 40) / 360) * 270;

  /* ─── Chart data ─── */
  const getGraphData = () => {
    const rawData = trendType === "blood_sugar" ? glucoseHistory : trendType === "hba1c" ? hba1cHistory : weightHistory;
    if (!rawData?.length) return [{ day: "–", value: 0 }];
    const sorted = [...rawData].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
    const now = new Date(), cutoff = new Date();
    if (timeRange === "Week") cutoff.setDate(now.getDate() - 7);
    else if (timeRange === "Month") cutoff.setMonth(now.getMonth() - 1);
    else cutoff.setMonth(now.getMonth() - 3);
    let filtered = sorted.filter(i => new Date(i.recordedAt) >= cutoff);
    if (trendType === "blood_sugar" && glucoseFilterContext !== "all")
      filtered = filtered.filter(i => i.readingContext?.replace("_", "-") === glucoseFilterContext.replace("_", "-"));
    const display = filtered.length > 0 ? filtered : sorted.slice(-7);
    return display.map(i => ({ day: new Date(i.recordedAt).toLocaleDateString("en-US", { weekday: "short" }), value: i.value }));
  };

  const getCompareGraphData = () => {
    if (trendType !== "blood_sugar") return getGraphData();
    const dayMap = {};
    const now = new Date(), cutoff = new Date();
    if (timeRange === "Week") cutoff.setDate(now.getDate() - 7);
    else if (timeRange === "Month") cutoff.setMonth(now.getMonth() - 1);
    else cutoff.setMonth(now.getMonth() - 3);

    const filtered = glucoseHistory.filter(i => new Date(i.recordedAt) >= cutoff);
    const display = filtered.length > 0 ? filtered : glucoseHistory.slice(-14);

    display.forEach(r => {
      const d = new Date(r.recordedAt);
      const dayKey = d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
      if (!dayMap[dayKey]) {
        dayMap[dayKey] = { day: dayKey, fasting: null, preMeal: null, postMeal: null, random: null, timestamp: d.getTime() };
      }
      const ctx = (r.readingContext || "").toLowerCase().replace(/-/g, "");
      if (ctx === "fasting") dayMap[dayKey].fasting = r.value;
      else if (ctx === "premeal" || ctx === "pre meal" || ctx === "beforemeal") dayMap[dayKey].preMeal = r.value;
      else if (ctx === "postmeal" || ctx === "post meal" || ctx === "aftermeal") dayMap[dayKey].postMeal = r.value;
      else if (ctx === "random" || ctx === "bedtime") dayMap[dayKey].random = r.value;
    });
    
    return Object.values(dayMap).sort((a,b) => a.timestamp - b.timestamp);
  };

  const renderDot = ({ cx, cy, value }) => {
    let fill = "#10b981";
    if (trendType === "blood_sugar") { if (value > targetRange.high) fill = "#f59e0b"; if (value < targetRange.low) fill = "#ef4444"; }
    return <circle cx={cx} cy={cy} r={3} strokeWidth={1.5} stroke="#fff" fill={fill} />;
  };

  /* ─── Derived values ─── */
  const sc = STATUS_CFG[status];
  const currentLogs = trendType === "blood_sugar" ? glucoseHistory : trendType === "hba1c" ? hba1cHistory : weightHistory;
  const trendLabel  = trendType === "blood_sugar" ? "Glucose" : trendType === "hba1c" ? "HbA1c" : "Weight";
  const normalPct   = (() => {
    const d = getGraphData().filter(d => d.day !== "–");
    if (!d.length) return 0;
    const n = d.filter(d => trendType === "blood_sugar" ? d.value >= targetRange.low && d.value <= targetRange.high : trendType === "hba1c" ? d.value < 7 : true).length;
    return Math.round((n / d.length) * 100);
  })();
  const avg7d = recentReadings.length > 0
    ? Math.round(recentReadings.slice(0, 7).reduce((s, r) => s + r.value, 0) / Math.min(recentReadings.length, 7))
    : null;

  const fastingReadings = glucoseHistory.filter(r => (r.readingContext || "").toLowerCase() === "fasting");
  const avgFasting = fastingReadings.length > 0 ? Math.round(fastingReadings.reduce((s, r) => s + r.value, 0) / fastingReadings.length) : "–";
  const latestHba1cVal = hba1cHistory.length > 0 ? hba1cHistory[0].value : "–";

  // Combine all logs for history modal
  const allLogs = [...glucoseHistory, ...hba1cHistory, ...weightHistory].sort((a,b) => new Date(b.recordedAt) - new Date(a.recordedAt));

  /* ─── Render ─── */
  return (
    <div
      className="min-h-screen flex flex-col select-none pb-24 md:pb-6"
      style={{ background: "linear-gradient(135deg, #e6f5ef 0%, #f2faf6 55%, #e8f2ff 100%)" }}
    >
      <SEO pageName="glucoseLog" />

      {/* ── Header ── */}
      <header
        className="flex-none flex items-center justify-between px-4 md:px-6 py-3"
        style={{ background: "rgba(232,245,240,0.72)", backdropFilter: "blur(24px) saturate(180%)", borderBottom: "1px solid rgba(16,185,129,0.12)" }}
      >
        <div>
          <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-emerald-600">Diabetes Monitor</p>
          <h1 className="text-base md:text-lg font-black text-slate-800 leading-tight">Glucose Log</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] md:text-xs font-bold" style={{ background: sc.bg, color: sc.text }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.color }} />
            {sc.label}
          </span>
          <span className="hidden sm:block text-[11px] md:text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: "rgba(16,185,129,0.08)", color: "#059669", border: "1px solid rgba(16,185,129,0.18)" }}>
            Target {targetRange.low}–{targetRange.high}
          </span>
          {aiLoading && <div className="flex gap-0.5">{[0,1,2].map(i=><div key={i} className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay:`${i*120}ms`}}/>)}</div>}
          <button onClick={fetchMetrics} className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-colors" style={{ background: "rgba(255,255,255,0.45)" }}>
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </header>

      {/* ── Body: Left + Right ── */}
      <div className="flex flex-col md:flex-row gap-4 p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">

        {/* ──── LEFT ──── */}
        <div className="flex-none flex flex-col gap-4 w-full md:w-80 lg:w-96">

          {/* Gauge card */}
          <div className="flex-none rounded-2xl p-4 md:p-5" style={GLASS}>

            {/* Gauge + value row */}
            <div className="flex items-center gap-3">
              {/* SVG gauge */}
              <div
                ref={gaugeRef}
                className="relative flex-none cursor-pointer"
                style={{ width: 140, height: 84 }}
                {...bindGaugeDrag}
              >
                <svg viewBox="0 0 160 100" width="140" height="84">
                  {/* Track */}
                  <path d="M 16 90 A 64 64 0 0 1 144 90" fill="none" stroke="#e5e7eb" strokeWidth="14" strokeLinecap="round"/>
                  {/* Green — low zone */}
                  <path d="M 16 90 A 64 64 0 0 1 44 34" fill="none" stroke="#22c55e" strokeWidth="14" strokeLinecap="round"/>
                  {/* Yellow — normal zone */}
                  <path d="M 44 34 A 64 64 0 0 1 80 22"  fill="none" stroke="#f59e0b" strokeWidth="14" strokeLinecap="round"/>
                  {/* Red — high zone */}
                  <path d="M 80 22 A 64 64 0 0 1 116 34" fill="none" stroke="#ef4444" strokeWidth="14" strokeLinecap="round"/>
                  {/* Gray — max zone */}
                  <path d="M 116 34 A 64 64 0 0 1 144 90" fill="none" stroke="#f3f4f6" strokeWidth="14" strokeLinecap="round"/>
                  {/* Needle */}
                  <g transform={`rotate(${getGaugeAngle()}, 80, 90)`} style={{ transition: "transform 0.2s ease" }}>
                    <line x1="80" y1="90" x2="80" y2="36" stroke={sc.color} strokeWidth="2.5" strokeLinecap="round"/>
                    <circle cx="80" cy="90" r="5" fill={sc.color}/>
                    <circle cx="80" cy="90" r="2.5" fill="white"/>
                  </g>
                  {/* Zone labels */}
                  <text x="10"  y="100" fontSize="7" fill="#22c55e" fontWeight="700">Low</text>
                  <text x="80"  y="13"  fontSize="7" fill="#ef4444" fontWeight="700" textAnchor="middle">High</text>
                  <text x="148" y="100" fontSize="7" fill="#94a3b8" fontWeight="700" textAnchor="end">Max</text>
                </svg>
              </div>

              {/* Reading value */}
              <div className="flex-1">
                {isEditing ? (
                  <div className="flex items-baseline gap-0.5">
                    <input
                      ref={inputRef}
                      type="text"
                      inputMode="numeric"
                      value={editValue}
                      onChange={handleEditChange}
                      onBlur={handleEditBlur}
                      onKeyDown={handleEditKeyDown}
                      className="w-20 text-3xl font-black text-center bg-transparent outline-none border-b-2 border-emerald-500 text-slate-800"
                      autoFocus
                    />
                    <span className="text-[9px] text-gray-400 font-bold">MG/DL</span>
                  </div>
                ) : (
                  <button onClick={handleEditStart} className="text-left group">
                    <div className="text-4xl md:text-5xl font-black text-slate-800 leading-none group-hover:text-emerald-700 transition-colors">{currentReading}</div>
                    <div className="text-[10px] md:text-xs text-gray-400 font-bold tracking-wider mt-0.5">MG/DL · tap to edit</div>
                  </button>
                )}
                <div className="mt-2 flex items-center gap-2 text-xs md:text-sm">
                  <span className="font-black text-slate-600">{avg7d ?? "–"} <span className="font-normal text-slate-400">avg</span></span>
                  <span className="w-px h-3 bg-slate-200"/>
                  <span className="font-black" style={{ color: sc.color }}>{normalPct}% <span className="text-slate-400 font-normal">range</span></span>
                </div>
              </div>
            </div>
          </div>

          {/* Log buttons */}
          <div className="flex-none grid grid-cols-3 gap-2">
            <button onClick={() => setShowHba1cModal(true)}
              className="rounded-xl py-3 text-xs font-bold text-slate-600 transition-all hover:scale-[1.02] active:scale-95 flex flex-col items-center gap-1"
              style={GLASS_SM}>
              <span className="text-lg">🩸</span>HbA1c
            </button>
            <button onClick={() => setShowLogModal(true)}
              className="rounded-xl py-3 text-xs font-black text-white transition-all hover:scale-[1.03] active:scale-95 flex flex-col items-center gap-1"
              style={{ background: "linear-gradient(135deg,#10b981,#059669)", boxShadow: "0 5px 18px rgba(16,185,129,0.38)" }}>
              <Droplet className="w-4 h-4"/>Glucose
            </button>
            <button onClick={() => setShowWeightModal(true)}
              className="rounded-xl py-3 text-xs font-bold text-slate-600 transition-all hover:scale-[1.02] active:scale-95 flex flex-col items-center gap-1"
              style={GLASS_SM}>
              <span className="text-lg">⚖️</span>Weight
            </button>
          </div>

          {/* Key Metrics Highlight Widgets */}
          <div className="flex gap-2.5">
            <div className="flex-1 rounded-xl p-3.5 flex flex-col justify-center" style={GLASS_SM}>
              <span className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">Avg Fasting</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl md:text-3xl font-black text-emerald-600 leading-none">{avgFasting}</span>
                <span className="text-[10px] md:text-xs font-bold text-slate-400">mg/dL</span>
              </div>
            </div>
            <div className="flex-1 rounded-xl p-3.5 flex flex-col justify-center" style={GLASS_SM}>
              <span className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">Latest HbA1c</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl md:text-3xl font-black text-slate-800 leading-none">{latestHba1cVal}</span>
                <span className="text-[10px] md:text-xs font-bold text-slate-400">%</span>
              </div>
            </div>
          </div>

          {/* AI Analysis */}
          <div className="rounded-2xl p-4 md:p-5 flex flex-col" style={GLASS}>
            <div className="flex-none flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
                  <span className="text-white font-black text-[9px]">AI</span>
                </div>
                <span className="text-xs md:text-sm font-black text-slate-700 uppercase tracking-wider">Analysis</span>
              </div>
              <button onClick={fetchAiAnalysis} className="text-slate-300 hover:text-emerald-500 transition-colors">
                <RefreshCw className="w-3 h-3"/>
              </button>
            </div>

            {aiAnalysis ? (
              <div className="space-y-2">
                {/* Status row */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: aiAnalysis.statusColor === "green" ? "rgba(16,185,129,0.10)" : aiAnalysis.statusColor === "yellow" ? "rgba(245,158,11,0.10)" : "rgba(239,68,68,0.10)" }}>
                  <div className={`w-2 h-2 rounded-full flex-none ${aiAnalysis.statusColor === "green" ? "bg-emerald-500" : aiAnalysis.statusColor === "yellow" ? "bg-yellow-500" : "bg-red-500"}`}/>
                  <span className="text-xs md:text-sm font-bold text-slate-700 truncate">{aiAnalysis.status}</span>
                </div>
                {/* Analysis line */}
                <p className="text-xs md:text-sm text-slate-500 leading-relaxed">{aiAnalysis.analysis}</p>
                {/* Action */}
                <div className="px-3 py-2 rounded-lg text-white" style={{ background: "linear-gradient(135deg,#10b981,#047857)" }}>
                  <div className="text-[9px] font-bold text-white/60 uppercase tracking-wider mb-0.5">Immediate Action</div>
                  <div className="text-xs md:text-sm font-semibold">{aiAnalysis.immediateAction}</div>
                </div>
                {/* Tips */}
                {aiAnalysis.recommendations?.slice(0, 2).map((tip, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs md:text-sm text-slate-500">
                    <span className="text-emerald-500 flex-none">•</span>
                    <span className="line-clamp-1">{tip}</span>
                  </div>
                ))}
              </div>
            ) : aiLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-emerald-100 border-t-emerald-500 rounded-full animate-spin"/>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-2">
                <p className="text-[10px] text-slate-400 text-center">Log readings for AI analysis</p>
                <button onClick={fetchAiAnalysis} className="px-3 py-1 rounded-full text-[10px] font-black text-white" style={{ background: "linear-gradient(135deg,#10b981,#047857)" }}>
                  Analyze Now
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ──── RIGHT ──── */}
        <div className="flex-1 flex flex-col gap-3">

          {/* Chart card — fixed height */}
          <div className="rounded-2xl p-3 md:p-4 flex flex-col" style={GLASS}>

            {/* Chart controls row */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-slate-800">{normalPct}%</span>
                <span className="text-[10px] text-slate-400 font-medium">{trendType === "blood_sugar" ? "in range" : "goal"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Time range */}
                <div className="flex items-center rounded-full p-0.5 gap-0.5" style={{ background: "rgba(241,245,249,0.80)" }}>
                  {[["W","Week"],["M","Month"],["3M","3 Months"]].map(([label, val]) => (
                    <button key={val} onClick={() => setTimeRange(val)}
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-all ${timeRange === val ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-600"}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {/* Trend type */}
                <div className="relative">
                  <button onClick={() => setShowTrendDropdown(!showTrendDropdown)}
                    className="flex items-center gap-0.5 px-2 py-1 rounded-full text-[9px] font-bold text-slate-600"
                    style={{ background: "rgba(255,255,255,0.60)", border: "1px solid rgba(255,255,255,0.80)" }}>
                    {trendLabel} <ChevronDown className="w-2.5 h-2.5"/>
                  </button>
                  {showTrendDropdown && (
                    <div className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden z-30 w-24"
                      style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.80)", boxShadow: "0 8px 20px rgba(0,0,0,0.10)" }}>
                      {[["blood_sugar","Glucose"],["hba1c","HbA1c"],["weight","Weight"]].map(([v,l]) => (
                        <button key={v} onClick={() => { setTrendType(v); setShowTrendDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-[11px] font-semibold hover:bg-emerald-50 transition-colors ${trendType===v ? "text-emerald-700" : "text-slate-600"}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Compare Toggle for Glucose */}
            {trendType === "blood_sugar" && (
              <div className="flex justify-end mb-2">
                <button 
                  onClick={() => setCompareMode(!compareMode)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold transition-colors border ${compareMode ? "bg-emerald-500 text-white border-emerald-500" : "bg-white/50 text-slate-500 border-slate-200"}`}
                >
                  <ListFilter className="w-3 h-3" />
                  Compare Contexts
                </button>
              </div>
            )}

            {/* Chart */}
            <div className="flex-1 min-h-[160px] -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                {compareMode && trendType === "blood_sugar" ? (
                  <AreaChart data={getCompareGraphData()} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false}/>
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 600 }} dy={5}/>
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 600 }} domain={[40, "dataMax + 10"]} width={34}/>
                    <Tooltip
                      contentStyle={{ background: "rgba(255,255,255,0.96)", border: "1px solid rgba(16,185,129,0.20)", borderRadius: "10px", fontSize: "11px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", padding: "5px 10px" }}
                      labelStyle={{ fontWeight: 700, color: "#334155", marginBottom: "1px" }}
                    />
                    <ReferenceLine y={targetRange.high} stroke="rgba(245,158,11,0.45)" strokeDasharray="4 3" strokeWidth={1}/>
                    <ReferenceLine y={targetRange.low}  stroke="rgba(239,68,68,0.35)"  strokeDasharray="4 3" strokeWidth={1}/>
                    <Area type="monotone" dataKey="fasting" stroke="#10b981" fill="rgba(16,185,129,0.08)" strokeWidth={2.5} name="Fasting" connectNulls />
                    <Area type="monotone" dataKey="preMeal" stroke="#3b82f6" fill="rgba(59,130,246,0.08)" strokeWidth={2} name="Pre-Meal" connectNulls />
                    <Area type="monotone" dataKey="postMeal" stroke="#f59e0b" fill="rgba(245,158,11,0.08)" strokeWidth={2} name="Post-Meal" connectNulls />
                    <Area type="monotone" dataKey="random" stroke="#8b5cf6" fill="rgba(139,92,246,0.08)" strokeWidth={2} name="Random" connectNulls />
                  </AreaChart>
                ) : (
                  <LineChart data={getGraphData()} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false}/>
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 600 }} dy={5}/>
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 600 }} domain={["dataMin - 10","dataMax + 10"]} width={34}/>
                    <Tooltip
                      contentStyle={{ background: "rgba(255,255,255,0.96)", border: "1px solid rgba(16,185,129,0.20)", borderRadius: "10px", fontSize: "11px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", padding: "5px 10px" }}
                      labelStyle={{ fontWeight: 700, color: "#334155", marginBottom: "1px" }}
                      itemStyle={{ color: "#10b981", fontWeight: 600 }}
                    />
                    {trendType === "blood_sugar" && <>
                      <ReferenceLine y={targetRange.high} stroke="rgba(245,158,11,0.45)" strokeDasharray="4 3" strokeWidth={1}/>
                      <ReferenceLine y={targetRange.low}  stroke="rgba(239,68,68,0.35)"  strokeDasharray="4 3" strokeWidth={1}/>
                    </>}
                    <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={renderDot} isAnimationActive activeDot={{ r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}/>
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Filter pills */}
            {trendType === "blood_sugar" && !compareMode && (
              <div className="flex overflow-x-auto scrollbar-hide gap-1 mt-2">
                {[["all","All"],["fasting","Fasting"],["before-meal","Pre-meal"],["after-meal","Post-meal"],["bedtime","Bedtime"],["random","Random"]].map(([v,l]) => (
                  <button key={v} onClick={() => setGlucoseFilterContext(v)}
                    className="flex-shrink-0 px-2.5 py-0.5 rounded-full text-[9px] font-bold transition-all"
                    style={glucoseFilterContext===v ? { background: "#1e293b", color: "#fff" } : { background: "rgba(241,245,249,0.80)", color: "#94a3b8" }}>
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recent Readings */}
          <div className="rounded-2xl px-3 py-2.5" style={GLASS_SM}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Recent {trendLabel}</span>
              <button onClick={() => setShowHistoryModal(true)} className="text-[9px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors bg-emerald-50 px-2 py-0.5 rounded-full">
                View All History
              </button>
            </div>
            {currentLogs.length > 0 ? (
              <div className="flex gap-2">
                {currentLogs.slice(0, 4).map((r, i) => {
                  const inRange = r.value >= targetRange.low && r.value <= targetRange.high;
                  const isHigh  = r.value > targetRange.high;
                  const dot     = inRange ? "#10b981" : isHigh ? "#f59e0b" : "#ef4444";
                  const t = new Date(r.recordedAt || r.timestamp);
                  return (
                    <div key={i} className="flex-1 rounded-xl px-2 py-1.5 min-w-0" style={{ background: "rgba(255,255,255,0.45)" }}>
                      <div className="flex items-center gap-1 mb-0.5">
                        <div className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: dot }}/>
                        <span className="text-[11px] font-black text-slate-700">{r.value}</span>
                        <span className="text-[8px] text-slate-400">{r.type === "hba1c" ? "%" : r.type === "weight" ? "kg" : "mg"}</span>
                      </div>
                      <div className="text-[8px] text-slate-400 truncate capitalize">{r.readingContext?.replace("-"," ") || "—"}</div>
                      <div className="text-[8px] text-slate-300">{t.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[9px] text-slate-400 italic text-center py-1">No readings yet — log your first</p>
            )}
          </div>
        </div>
      </div>

      <LogGlucoseModal isOpen={showLogModal}    onClose={() => setShowLogModal(false)}    onSave={handleLogGlucose}/>
      <LogHba1cModal   isOpen={showHba1cModal}  onClose={() => setShowHba1cModal(false)}  onSave={handleLogHba1c}/>
      <LogWeightModal  isOpen={showWeightModal} onClose={() => setShowWeightModal(false)} onSave={handleLogWeight}/>
      <FullHistoryModal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} logs={allLogs} onDelete={deleteReading} />
    </div>
  );
}
