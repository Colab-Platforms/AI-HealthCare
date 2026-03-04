import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Droplet, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LogGlucoseModal from "../components/LogGlucoseModal";
import LogHba1cModal from "../components/LogHba1cModal";
import LogWeightModal from "../components/LogWeightModal";
import api from "../services/api";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const GlucoseLog = () => {
  const navigate = useNavigate();
  const [showLogModal, setShowLogModal] = useState(false);
  const [showHba1cModal, setShowHba1cModal] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);

  const [recentReadings, setRecentReadings] = useState([]);
  const [glucoseHistory, setGlucoseHistory] = useState([]);
  const [hba1cHistory, setHba1cHistory] = useState([]);
  const [weightHistory, setWeightHistory] = useState([]);

  const [currentReading, setCurrentReading] = useState(108);
  const [status, setStatus] = useState("stable");
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("108");
  const [loading, setLoading] = useState(true);

  // Trend Chart State
  const [trendType, setTrendType] = useState("blood_sugar"); // blood_sugar, hba1c, weight
  const [timeRange, setTimeRange] = useState("Week"); // Week, Month, 3 Months
  const [showTrendDropdown, setShowTrendDropdown] = useState(false);
  const [glucoseFilterContext, setGlucoseFilterContext] = useState("all");
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const inputRef = useRef(null);
  const gaugeRef = useRef(null);

  useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);

      // Fetch recent readings for the list (blood sugar)
      const logRes = await api.get("metrics/blood_sugar?limit=10");
      setRecentReadings(logRes.data);

      // Fetch history for all 3 for the graphs
      const [glucoseRes, hba1cRes, weightRes] = await Promise.all([
        api.get("metrics/blood_sugar?limit=50"),
        api.get("metrics/hba1c?limit=50"),
        api.get("metrics/weight?limit=50")
      ]);

      setGlucoseHistory(glucoseRes.data);
      setHba1cHistory(hba1cRes.data);
      setWeightHistory(weightRes.data);

      if (logRes.data && logRes.data.length > 0) {
        const latest = logRes.data[0].value;
        setCurrentReading(latest);
        setEditValue(String(latest));
        updateStatus(latest);
      }

      // Fetch AI Analysis
      fetchAiAnalysis();
    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAiAnalysis = async () => {
    try {
      setAiLoading(true);
      const res = await api.get("metrics/analysis/glucose");
      if (res.data && res.data.success) {
        setAiAnalysis(res.data.data);
      }
    } catch (error) {
      console.error("Error fetching AI analysis:", error);
    } finally {
      setAiLoading(false);
    }
  };

  const updateStatus = (val) => {
    if (val >= 70 && val <= 130) setStatus("stable");
    else if (val > 130) setStatus("high");
    else setStatus("low");
  };

  const saveReadingToApi = async (type, value, unit, context, timestamp) => {
    try {
      const payload = {
        type,
        value,
        unit,
        readingContext: context,
        recordedAt: timestamp,
        notes: "",
      };
      await api.post("metrics", payload);
      fetchMetrics();
    } catch (error) {
      console.error("Error saving reading:", error);
    }
  };

  const handleLogGlucose = async (newReading) => {
    setAiLoading(true);
    await saveReadingToApi(
      "blood_sugar",
      newReading.value,
      "mg/dL",
      newReading.type,
      newReading.timestamp,
    );
    // Refresh analysis immediately
    fetchAiAnalysis();
  };

  const handleLogHba1c = async (newReading) => {
    setAiLoading(true);
    await saveReadingToApi(
      "hba1c",
      newReading.value,
      "%",
      "fasting",
      newReading.timestamp,
    );
    setTrendType("hba1c");
    fetchAiAnalysis();
  };

  const handleLogWeight = async (newReading) => {
    await saveReadingToApi(
      "weight",
      newReading.value,
      "kg",
      "general",
      newReading.timestamp,
    );
    setTrendType("weight");
    fetchAiAnalysis();
  };

  // Direct edit functions
  const handleEditStart = () => {
    setIsEditing(true);
    setEditValue(String(currentReading));
    setTimeout(() => inputRef.current?.select(), 50);
  };

  const handleEditChange = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    if (val.length <= 3) {
      setEditValue(val);
      const num = parseInt(val) || 0;
      if (num >= 40 && num <= 400) {
        setCurrentReading(num);
        updateStatus(num);
      }
    }
  };

  const handleEditBlur = () => {
    setIsEditing(false);
    const num = parseInt(editValue) || 108;
    const clamped = Math.min(Math.max(num, 40), 400);
    setCurrentReading(clamped);
    setEditValue(String(clamped));
    updateStatus(clamped);
  };

  const handleEditKeyDown = (e) => {
    if (e.key === "Enter") handleEditBlur();
  };

  // Gauge interaction
  const handleGaugeInteraction = (e) => {
    if (!gaugeRef.current) return;
    const rect = gaugeRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height * 0.85;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const dx = clientX - centerX;
    const dy = centerY - clientY;
    let angle = Math.atan2(dx, dy) * (180 / Math.PI);

    angle = Math.max(-135, Math.min(135, angle));
    const min = 40;
    const max = 400;
    const value = Math.round(min + ((angle + 135) / 270) * (max - min));
    const clamped = Math.min(Math.max(value, min), max);

    setCurrentReading(clamped);
    setEditValue(String(clamped));
    updateStatus(clamped);
  };

  const getGaugeAngle = () => {
    const min = 40;
    const max = 400;
    const clamped = Math.min(Math.max(currentReading, min), max);
    return -135 + ((clamped - min) / (max - min)) * 270;
  };

  // Dynamic Graph Data from History
  const getGraphData = () => {
    let rawData = [];
    if (trendType === "blood_sugar") rawData = glucoseHistory;
    else if (trendType === "hba1c") rawData = hba1cHistory;
    else if (trendType === "weight") rawData = weightHistory;

    if (!rawData || rawData.length === 0) {
      // Return minimal dummy data if none exists
      return [{ day: "N/A", value: 0 }];
    }

    // Sort by date ascending for the chart
    const sorted = [...rawData].sort(
      (a, b) => new Date(a.recordedAt) - new Date(b.recordedAt),
    );

    // Filter by timeRange
    const now = new Date();
    let cutoff = new Date();
    if (timeRange === "Week") cutoff.setDate(now.getDate() - 7);
    else if (timeRange === "Month") cutoff.setMonth(now.getMonth() - 1);
    else if (timeRange === "3 Months") cutoff.setMonth(now.getMonth() - 3);

    let filtered = sorted.filter(
      (item) => new Date(item.recordedAt) >= cutoff,
    );

    // Filter by context if applicable
    // Filter by context if applicable
    if (trendType === "blood_sugar" && glucoseFilterContext !== "all") {
      filtered = filtered.filter(item => {
        if (!item.readingContext) return false;
        // Handle both hyphen and underscore versions (before-meal vs before_meal)
        const normalizedItemContext = item.readingContext.replace('_', '-');
        const normalizedFilterContext = glucoseFilterContext.replace('_', '-');
        return normalizedItemContext === normalizedFilterContext;
      });
    }

    // Map to recharts format
    const displayData = filtered.length > 0 ? filtered : sorted.slice(-7);
    return displayData.map((item) => {
      const date = new Date(item.recordedAt);
      return {
        day: date.toLocaleDateString("en-US", { weekday: "short" }),
        value: item.value,
        fullDate: date.toLocaleDateString(),
      };
    });
  };

  const getAxisTicks = () => {
    if (trendType === "hba1c") return [4, 6, 8, 10];
    if (trendType === "weight") return [50, 70, 90, 110];
    return [1, 48, 95, 142, 190];
  };

  // Calculate customized dot colors based on values for Glucose
  const renderCustomDot = (props) => {
    const { cx, cy, value } = props;
    let fill = "#10b981"; // normal green

    if (trendType === "blood_sugar") {
      if (value > 150) fill = "#f59e0b"; // high yellow
      if (value < 50) fill = "#ef4444"; // critical red
    }

    return (
      <circle cx={cx} cy={cy} r={4} strokeWidth={2} stroke="#fff" fill={fill} />
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-28 pt-4 md:pt-0">

      <div className="px-3 md:px-4 py-4 space-y-6 max-w-7xl mx-auto">
        <p className="text-center text-gray-500 text-sm">
          {status === "stable"
            ? "Your current status is stable"
            : `Your glucose is ${status}`}
        </p>

        {/* Interactive Gauge */}
        <div
          ref={gaugeRef}
          className="relative w-64 h-40 mx-auto cursor-pointer select-none"
          onClick={handleGaugeInteraction}
          onMouseDown={(e) => {
            const onMove = (ev) => handleGaugeInteraction(ev);
            const onUp = () => {
              document.removeEventListener("mousemove", onMove);
              document.removeEventListener("mouseup", onUp);
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          }}
          onTouchStart={(e) => {
            handleGaugeInteraction(e);
            const onMove = (ev) => handleGaugeInteraction(ev);
            const onEnd = () => {
              document.removeEventListener("touchmove", onMove);
              document.removeEventListener("touchend", onEnd);
            };
            document.addEventListener("touchmove", onMove);
            document.addEventListener("touchend", onEnd);
          }}
        >
          <svg viewBox="0 0 200 130" className="w-full h-full">
            <path
              d="M 20 120 A 80 80 0 0 1 180 120"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="18"
              strokeLinecap="round"
            />
            <path
              d="M 20 120 A 80 80 0 0 1 55 45"
              fill="none"
              stroke="#22c55e"
              strokeWidth="18"
              strokeLinecap="round"
            />
            <path
              d="M 55 45 A 80 80 0 0 1 100 30"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="18"
              strokeLinecap="round"
            />
            <path
              d="M 100 30 A 80 80 0 0 1 145 45"
              fill="none"
              stroke="#ef4444"
              strokeWidth="18"
              strokeLinecap="round"
            />
            <path
              d="M 145 45 A 80 80 0 0 1 180 120"
              fill="none"
              stroke="#f3f4f6"
              strokeWidth="18"
              strokeLinecap="round"
            />
            <g
              transform={`rotate(${getGaugeAngle()}, 100, 120)`}
              className="transition-transform duration-200"
            >
              <line
                x1="100"
                y1="120"
                x2="100"
                y2="48"
                stroke="#1e293b"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle cx="100" cy="120" r="6" fill="#1e293b" />
              <circle cx="100" cy="120" r="3" fill="white" />
            </g>
          </svg>

          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-center">
            {isEditing ? (
              <div className="flex items-baseline justify-center gap-1">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  value={editValue}
                  onChange={handleEditChange}
                  onBlur={handleEditBlur}
                  onKeyDown={handleEditKeyDown}
                  className="w-24 text-5xl font-extrabold text-center bg-transparent outline-none border-b-2 border-[#2FC8B9] text-slate-800"
                  autoFocus
                />
                <span className="text-sm text-gray-400 font-semibold tracking-wider">
                  MG/DL
                </span>
              </div>
            ) : (
              <button onClick={handleEditStart} className="group">
                <div className="text-5xl font-extrabold text-slate-800 leading-none group-hover:text-[#2FC8B9] transition-colors">
                  {currentReading}
                </div>
                <div className="text-sm text-gray-400 font-semibold tracking-wider mt-1">
                  MG/DL
                </div>
                <div className="text-[10px] text-[#2FC8B9] opacity-0 group-hover:opacity-100 transition-opacity">
                  tap to edit
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Restore Logging UI Buttons */}
        <div className="flex justify-center gap-2 px-2 mt-8">
          <button
            onClick={() => setShowHba1cModal(true)}
            className="flex-1 bg-white border border-slate-100 shadow-sm text-slate-600 py-3 rounded-2xl font-bold text-[13px] hover:bg-slate-50 transition-colors"
          >
            Log HbA1c
          </button>
          <button
            onClick={() => setShowLogModal(true)}
            className="flex-[1.5] bg-[#2FC8B9] text-white shadow-lg shadow-[#2FC8B9]/20 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#1db7a6] transition-all focus:scale-95 flex items-center justify-center gap-2"
          >
            <Droplet className="w-4 h-4" />
            Log Glucose
          </button>
          <button
            onClick={() => setShowWeightModal(true)}
            className="flex-1 bg-white border border-slate-100 shadow-sm text-slate-600 py-3 rounded-2xl font-bold text-[13px] hover:bg-slate-50 transition-colors"
          >
            Log Weight
          </button>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-lg font-bold text-slate-800">Trend</h2>
            <div className="relative">
              <button
                onClick={() => setShowTrendDropdown(!showTrendDropdown)}
                className="flex items-center gap-1.5 text-sm font-semibold text-[#2FC8B9] bg-[#2FC8B9]/10 px-3 py-1.5 rounded-full"
              >
                {trendType === "blood_sugar"
                  ? "Glucose"
                  : trendType === "hba1c"
                    ? "HbA1c"
                    : "Weight"}
                <ChevronDown className="w-4 h-4" />
              </button>
              {showTrendDropdown && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-20 w-36">
                  <button
                    onClick={() => {
                      setTrendType("blood_sugar");
                      setShowTrendDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-blue-50 ${trendType === "blood_sugar" ? "text-blue-600 bg-blue-50/50" : "text-slate-700"}`}
                  >
                    Glucose
                  </button>
                  <button
                    onClick={() => {
                      setTrendType("hba1c");
                      setShowTrendDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-blue-50 ${trendType === "hba1c" ? "text-blue-600 bg-blue-50/50" : "text-slate-700"}`}
                  >
                    HbA1c
                  </button>
                  <button
                    onClick={() => {
                      setTrendType("weight");
                      setShowTrendDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-blue-50 ${trendType === "weight" ? "text-blue-600 bg-blue-50/50" : "text-slate-700"}`}
                  >
                    Weight
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-md rounded-3xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-white">
            {/* Time Toggle */}
            <div className="bg-gray-100/80 rounded-full p-1 flex items-center justify-between mb-4">
              {["Week", "Month", "3 Months"].map((type) => (
                <button
                  key={type}
                  onClick={() => setTimeRange(type)}
                  className={`flex-1 py-2 text-[13px] font-bold rounded-full transition-all ${timeRange === type ? "bg-[#1e293b] text-white shadow-md" : "text-slate-500 hover:text-slate-700"}`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Stats Header */}
            <div className="flex justify-between items-end mb-4">
              <div>
                <div className="text-2xl font-extrabold text-[#112340] leading-none flex items-baseline gap-1">
                  {(() => {
                    const data = getGraphData();
                    const filtered = data.filter((d) => d.day !== "N/A");
                    if (filtered.length === 0) return "0%";
                    const normal = filtered.filter((d) =>
                      trendType === "blood_sugar"
                        ? d.value >= 70 && d.value <= 130
                        : trendType === "hba1c"
                          ? d.value < 7
                          : true, // weight doesn't have a simple 'normal'
                    ).length;
                    return Math.round((normal / filtered.length) * 100) + "%";
                  })()}{" "}
                  <span className="text-sm font-bold text-slate-800">
                    {trendType === "blood_sugar" ? "normal" : trendType === "hba1c" ? "goal" : "recorded"}
                  </span>
                </div>
              </div>
              <div className="text-xs font-semibold text-slate-400">
                {timeRange === "Week" ? "Last 7 days" : timeRange === "Month" ? "Last 30 days" : "Last 90 days"}
              </div>
            </div>

            {/* Legend Map */}
            {trendType === "blood_sugar" && (
              <div className="flex items-center gap-4 mb-6 flex-wrap">
                <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-slate-700">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />{" "}
                  Normal
                </div>
                <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-slate-700">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" /> High
                </div>
                <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-slate-700">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />{" "}
                  Critical
                </div>
                <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-slate-700">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#d97706]" /> Low
                </div>
              </div>
            )}

            {/* Graph wrapper */}
            <div className="h-56 w-full -ml-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={getGraphData()}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={true}
                    horizontal={true}
                    stroke="#f1f5f9"
                  />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                    ticks={getAxisTicks()}
                    domain={["dataMin - 10", "dataMax + 10"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    dot={renderCustomDot}
                    isAnimationActive={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Read Type Pills (Glucose only) */}
            {trendType === "blood_sugar" && (
              <div className="flex overflow-x-auto scrollbar-hide gap-2 mt-6 pb-1">
                <button
                  onClick={() => setGlucoseFilterContext("all")}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${glucoseFilterContext === "all" ? "bg-[#1e293b] text-white" : "bg-gray-100 text-gray-500"}`}
                >
                  All
                </button>
                <button
                  onClick={() => setGlucoseFilterContext("fasting")}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-all ${glucoseFilterContext === "fasting" ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-blue-50/50 text-blue-400"}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-sm rotate-45 ${glucoseFilterContext === "fasting" ? "bg-blue-600" : "bg-blue-300"}`} />{" "}
                  Fasting
                </button>
                <button
                  onClick={() => setGlucoseFilterContext("before-meal")}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-all ${glucoseFilterContext === "before-meal" ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-blue-50/50 text-blue-400"}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-sm ${glucoseFilterContext === "before-meal" ? "bg-blue-600" : "bg-blue-300"}`} />{" "}
                  Pre-meal
                </button>
                <button
                  onClick={() => setGlucoseFilterContext("after-meal")}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-all ${glucoseFilterContext === "after-meal" ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-blue-50/50 text-blue-400"}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-sm rotate-45 ${glucoseFilterContext === "after-meal" ? "bg-blue-600" : "bg-blue-300"}`} />{" "}
                  Post-meal
                </button>
                <button
                  onClick={() => setGlucoseFilterContext("bedtime")}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-all ${glucoseFilterContext === "bedtime" ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-blue-50/50 text-blue-400"}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${glucoseFilterContext === "bedtime" ? "bg-blue-600" : "bg-blue-300"}`} />{" "}
                  Bedtime
                </button>
                <button
                  onClick={() => setGlucoseFilterContext("random")}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-all ${glucoseFilterContext === "random" ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-blue-50/50 text-blue-400"}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${glucoseFilterContext === "random" ? "bg-blue-600" : "bg-blue-300"}`} />{" "}
                  Random
                </button>
              </div>
            )}

            {/* Quick Status Info below graph */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              {recentReadings.length > 0 ? (
                <div className={`p-4 rounded-2xl flex items-center gap-3 ${recentReadings[0].value >= 70 && recentReadings[0].value <= 130
                  ? "bg-emerald-50 text-emerald-700"
                  : recentReadings[0].value > 130
                    ? "bg-red-50 text-red-700"
                    : "bg-orange-50 text-orange-700"
                  }`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${recentReadings[0].value >= 70 && recentReadings[0].value <= 130
                    ? "bg-emerald-100"
                    : recentReadings[0].value > 130
                      ? "bg-red-100"
                      : "bg-orange-100"
                    }`}>
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-tight">Your Last Reading is {recentReadings[0].value >= 70 && recentReadings[0].value <= 130 ? 'Good' : recentReadings[0].value > 130 ? 'High' : 'Low'}</h4>
                    <p className="text-xs opacity-80 font-medium">
                      {recentReadings[0].value >= 70 && recentReadings[0].value <= 130
                        ? "You're doing great! Keep following your current routine."
                        : recentReadings[0].value > 130
                          ? "This is above your target range. Check your AI analysis for details."
                          : "This is below your target range. Consider a snack if needed."}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-center text-slate-400 font-medium italic">Log your first reading to see status analysis</p>
              )}
            </div>
          </div>
        </div>

        {/* AI Analysis Section */}
        {trendType === "blood_sugar" && (
          <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-white mt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <span className="text-purple-600 font-bold text-xs">AI</span>
                </div>
                <h3 className="font-bold text-slate-800">Glucose Analysis</h3>
              </div>
              {aiLoading && (
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce delay-100" />
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce delay-200" />
                </div>
              )}
            </div>

            {aiAnalysis ? (
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 ${aiAnalysis.statusColor === 'green' ? 'bg-green-500 text-green-500' : aiAnalysis.statusColor === 'yellow' ? 'bg-yellow-500 text-yellow-500' : aiAnalysis.statusColor === 'orange' ? 'bg-orange-500 text-orange-500' : 'bg-red-500 text-red-500'}`} />
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 mb-1">
                      Status: <span className={aiAnalysis.statusColor === 'green' ? 'text-green-600' : aiAnalysis.statusColor === 'red' ? 'text-red-600' : 'text-orange-600'}>{aiAnalysis.status}</span>
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {aiAnalysis.analysis}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl border border-blue-50 bg-blue-50/30">
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">Potential Cause</p>
                    <p className="text-sm font-semibold text-slate-800">{aiAnalysis.spikeCause}</p>
                  </div>
                  <div className="p-4 rounded-2xl border border-purple-50 bg-purple-50/30">
                    <p className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-1">Immediate Action</p>
                    <p className="text-sm font-semibold text-slate-800">{aiAnalysis.immediateAction}</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-emerald-50 bg-emerald-50/20">
                  <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-2">AI Insights & Tips</p>
                  <ul className="space-y-2">
                    {aiAnalysis.recommendations?.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                        <span className="text-emerald-500 mt-0.5">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-[11px] italic text-slate-400 text-center pb-2">
                  Generated by AI based on your overall data and daily food logs.
                </p>
                <div className="flex justify-center pt-2">
                  <button onClick={fetchAiAnalysis} className="text-[10px] font-bold text-purple-600 hover:text-purple-800 uppercase tracking-widest flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                    <Activity className="w-3 h-3" /> Re-analyze Trends
                  </button>
                </div>
              </div>
            ) : (
              !aiLoading && (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-500 mb-4 font-medium italic">No recent analysis found. Log readings for automatic analysis.</p>
                  <button
                    onClick={fetchAiAnalysis}
                    className="px-8 py-3 bg-[#2FC8B9] text-white rounded-full text-xs font-black uppercase tracking-widest shadow-xl shadow-[#2FC8B9]/20 hover:scale-105 transition-all"
                  >
                    Generate First Analysis
                  </button>
                </div>
              )
            )}

            {aiLoading && !aiAnalysis && (
              <div className="py-12 flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin mb-4" />
                <p className="text-sm font-medium text-slate-500">AI is analyzing your readings and food logs...</p>
              </div>
            )}
          </div>
        )}

        {/* Recent Readings List Context */}
        {(() => {
          const currentLogs =
            trendType === "blood_sugar"
              ? glucoseHistory
              : trendType === "hba1c"
                ? hba1cHistory
                : weightHistory;

          if (!currentLogs || currentLogs.length === 0) return null;

          return (
            <div className="bg-white/70 backdrop-blur-sm rounded-3xl border border-white/60 shadow-sm p-4 sm:p-6 !mt-6">
              <h3 className="text-sm font-bold text-slate-800 mb-3">
                Recent {trendType === "blood_sugar" ? "Glucose" : trendType === "hba1c" ? "HbA1c" : "Weight"} Logs
              </h3>
              <div className="space-y-2">
                {currentLogs.slice(0, 5).map((reading, index) => {
                  const readingDate = new Date(
                    reading.recordedAt || reading.timestamp,
                  );
                  const timeStr = readingDate.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-white/60 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center ${reading.value >= 70 && reading.value <= 130 ? "bg-green-100" : reading.value > 130 ? "bg-red-100" : "bg-yellow-100"}`}
                        >
                          <Droplet
                            className={`w-4 h-4 ${reading.value >= 70 && reading.value <= 130 ? "text-green-600" : reading.value > 130 ? "text-red-600" : "text-yellow-600"}`}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">
                            {reading.value}{" "}
                            {reading.type === "hba1c"
                              ? "%"
                              : reading.type === "weight"
                                ? "kg"
                                : "mg/dL"}
                          </p>
                          <p className="text-xs text-gray-400 capitalize">
                            {reading.readingContext?.replace("-", " ") ||
                              reading.type?.replace("_", " ")}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400">{timeStr}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      <LogGlucoseModal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        onSave={handleLogGlucose}
      />
      <LogHba1cModal
        isOpen={showHba1cModal}
        onClose={() => setShowHba1cModal(false)}
        onSave={handleLogHba1c}
      />
      <LogWeightModal
        isOpen={showWeightModal}
        onClose={() => setShowWeightModal(false)}
        onSave={handleLogWeight}
      />
    </div >
  );
};

export default GlucoseLog;
