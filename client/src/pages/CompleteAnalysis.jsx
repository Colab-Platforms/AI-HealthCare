import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Flame,
  Droplets,
  Footprints,
  Moon,
  Scale,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Calculator,
  Calendar,
  Target,
  Info,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Brain,
  Clipboard,
  CheckCircle,
  ChevronDown,
  Filter,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  ReferenceLine,
  Legend,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import api from "../services/api";
import toast from "react-hot-toast";
import SEO from "../hooks/useSEO";

const glassCard =
  "bg-white border border-slate-100/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300";

export default function CompleteAnalysis() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    dashboardData,
    wearableData,
    nutritionData,
    fetchDashboard,
    loading: contextLoading,
  } = useData();

  const [loading, setLoading] = useState(!dashboardData);
  const [glucoseLogs, setGlucoseLogs] = useState([]);
  const [hba1cLogs, setHba1cLogs] = useState([]);
  const [diabetesAnalysis, setDiabetesAnalysis] = useState(null);
  const [activeRange, setActiveRange] = useState("7d"); // 7d, 30d, 90d
  const [vitalsMode, setVitalsMode] = useState("glucose"); // glucose, hba1c
  const [showRangeDropdown, setShowRangeDropdown] = useState(false);

  const isDiabetic =
    user?.profile?.isDiabetic === "yes" ||
    (user?.profile?.medicalHistory?.conditions || []).includes("diabetes");

  const isFirstLoad = useRef(!dashboardData);

  const fetchData = useCallback(async () => {
    try {
      // Only show full-page spinner on first load — silent refresh if data exists
      if (isFirstLoad.current) setLoading(true);

      const metricsPromise = user?._id
        ? Promise.all([
            api.get("metrics/blood_sugar", { params: { limit: 100 } }).catch(() => ({ data: [] })),
            api.get("metrics/hba1c", { params: { limit: 20 } }).catch(() => ({ data: [] })),
            api.get("metrics/analysis/glucose").catch(() => null),
          ])
        : Promise.resolve(null);

      // Run dashboard refresh and metrics in parallel — was sequential
      const [, metricsResult] = await Promise.all([
        fetchDashboard(true),
        metricsPromise,
      ]);

      if (metricsResult) {
        const [glucoseRes, hba1cRes, analysisRes] = metricsResult;
        setGlucoseLogs(Array.isArray(glucoseRes.data) ? glucoseRes.data : []);
        setHba1cLogs(Array.isArray(hba1cRes.data) ? hba1cRes.data : []);
        if (analysisRes?.data?.success) {
          setDiabetesAnalysis(analysisRes.data.data);
        }
      }
      isFirstLoad.current = false;
    } catch (error) {
      console.error("Failed to fetch analysis data:", error);
      toast.error("Could not load complete analysis");
    } finally {
      setLoading(false);
    }
  }, [fetchDashboard, user?._id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  const handleRefresh = () => {
    fetchData();
    toast.success("Refreshing analytical core...");
  };

  const trendData = useMemo(() => {
    if (!dashboardData?.history) return [];
    const days = activeRange === "7d" ? 7 : activeRange === "30d" ? 30 : 90;
    return dashboardData.history.slice(-days);
  }, [dashboardData, activeRange]);

  const processedGlucoseData = useMemo(() => {
    if (!glucoseLogs || glucoseLogs.length === 0) return [];

    const dayMap = {};
    glucoseLogs.forEach((r) => {
      const date = new Date(r.recordedAt);
      if (isNaN(date.getTime())) return;

      const key = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (!dayMap[key]) {
        dayMap[key] = {
          name: key,
          fasting: null,
          preMeal: null,
          postMeal: null,
          random: null,
          date: date,
        };
      }

      const val = Number(r.value);
      const ctx = (r.readingContext || "").toLowerCase();

      if (ctx === "fasting") dayMap[key].fasting = val;
      else if (ctx.includes("pre")) dayMap[key].preMeal = val;
      else if (ctx.includes("post")) dayMap[key].postMeal = val;
      else dayMap[key].random = val;
    });

    const days = activeRange === "7d" ? 7 : activeRange === "30d" ? 30 : 90;
    return Object.values(dayMap)
      .sort((a, b) => a.date - b.date)
      .slice(-days);
  }, [glucoseLogs, activeRange]);

  const processedHbA1cData = useMemo(() => {
    if (!hba1cLogs || hba1cLogs.length === 0) return [];
    return hba1cLogs
      .slice(0, 8)
      .reverse()
      .map((r) => {
        const date = new Date(r.recordedAt);
        return {
          month: isNaN(date.getTime())
            ? "Unknown"
            : date.toLocaleDateString("en-US", { month: "short" }),
          value: Number(r.value),
        };
      });
  }, [hba1cLogs]);

  // Transform trendData into dynamic multi-day format
  const multiDayData = useMemo(() => {
    if (!dashboardData?.history) return [];
    const days = ["S", "M", "T", "W", "T", "F", "S"];
    const limit = activeRange === "7d" ? 7 : activeRange === "30d" ? 30 : 90;

    // Get historical data
    let history = [...dashboardData.history.slice(-limit)];

    // Ensure today's data is merged for real-time updates
    const todayStr = new Date().toISOString().split("T")[0];
    const hasToday = history.some((d) => d.date.startsWith(todayStr));

    if (!hasToday && activeRange === "7d") {
      const vitals = dashboardData.vitals || {};
      history.push({
        date: new Date().toISOString(),
        steps: wearableData?.todayMetrics?.steps || vitals.steps?.value || 0,
        sleep: wearableData?.todayMetrics?.sleep
          ? wearableData.todayMetrics.sleep / 60
          : vitals.sleep?.value || 0,
        water:
          nutritionData?.totalWater ||
          nutritionData?.waterIntake ||
          vitals.water?.value ||
          0,
        calories: nutritionData?.totalCalories || vitals.calories?.value || 0,
        weight:
          vitals.weight?.value || history[history.length - 1]?.weight || 0,
      });
      // Keep only last limit
      history = history.slice(-limit);
    } else if (hasToday) {
      // Update today's entry in history with live vitals if it exists
      history = history.map((d) => {
        if (d.date.startsWith(todayStr)) {
          const vitals = dashboardData.vitals || {};

          // Get today's sleep from wearable data if available
          let wearableSleepToday = 0;
          if (wearableData?.recentSleep?.length > 0) {
            const latestSleep = wearableData.recentSleep[0];
            const sleepDate = new Date(latestSleep.date)
              .toISOString()
              .split("T")[0];
            if (sleepDate === todayStr) {
              wearableSleepToday = (latestSleep.totalSleepMinutes || 0) / 60;
            }
          }

          return {
            ...d,
            steps:
              wearableData?.todayMetrics?.steps ||
              vitals.steps?.value ||
              d.steps,
            sleep: wearableSleepToday || vitals.sleep?.value || d.sleep,
            water:
              nutritionData?.totalWater ||
              nutritionData?.waterIntake ||
              vitals.water?.value ||
              d.water,
            calories:
              nutritionData?.totalCalories ||
              vitals.calories?.value ||
              d.calories,
            weight: vitals.weight?.value || d.weight,
          };
        }
        return d;
      });
    }

    return history.map((day) => {
      const d = new Date(day.date);
      return {
        ...day,
        steps: Math.round(day.steps || 0),
        sleep: parseFloat(Number(day.sleep || 0).toFixed(1)),
        water: Math.round(day.water || 0),
        alcohol: Math.round(day.alcohol || 0),
        calories: Math.round(day.calories || 0),
        weight: day.weight ? parseFloat(Number(day.weight).toFixed(1)) : 0,
        dayLabel: days[d.getDay()],
        fullLabel: d.toLocaleDateString("en-US", { weekday: "short" }),
        dateNum: d.getDate(),
      };
    });
  }, [dashboardData, activeRange]);

  // Hydration data now uses multiDayData for daily trends instead of hourly distribution

  if (loading || contextLoading.dashboard) {
    return (
      <div className="min-h-screen bg-[#F9FCF3] flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin mb-6" />
        <div className="text-center space-y-2">
          <p className="text-[#064e3b] font-black uppercase tracking-widest text-sm animate-pulse">
            Checking latest data...
          </p>
          <p className="text-emerald-800/40 font-bold uppercase tracking-[0.2em] text-[10px]">
            Calibrating Analysis Hub
          </p>
        </div>
      </div>
    );
  }

  const cardStyle =
    "bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow transition-all duration-300";

  return (
    <div className="min-h-screen bg-[#FAFBF8] pt-6 pb-24 px-4 md:px-8 max-w-[1400px] mx-auto space-y-6 font-sans">
      <SEO pageName="completeAnalysis" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full border-b border-slate-200/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#011B1D] tracking-tight">
            Daily Breakdown
          </h1>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            Holistic Performance Metrics
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Custom Range Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowRangeDropdown(!showRangeDropdown)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:shadow-sm transition-all"
            >
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              Range: {activeRange}
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showRangeDropdown ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {showRangeDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute top-full right-0 mt-2 w-36 bg-white border border-slate-100 rounded-xl shadow-lg z-[100] overflow-hidden p-1"
                >
                  {["7d", "30d", "90d"].map((range) => (
                    <button
                      key={range}
                      onClick={() => {
                        setActiveRange(range);
                        setShowRangeDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                        activeRange === range
                          ? "bg-slate-900 text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {range} Duration
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={handleRefresh}
            className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-50 hover:shadow-sm transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* --- CONDITIONAL DIABETES HERO --- */}
      {isDiabetic && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${glassCard} p-5 bg-gradient-to-br from-white to-emerald-50/10 space-y-5`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center shadow-md shadow-emerald-800/10">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Diabetes Care
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                    Clinical Priority Monitoring
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="px-3.5 py-2 bg-slate-50/60 rounded-xl border border-slate-100 min-w-[110px]">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Glucose
                </span>
                <span className="text-lg font-bold text-slate-800">
                  {dashboardData?.vitals?.glucose?.value || "--"}{" "}
                  <small className="text-xs font-normal text-slate-400">mg/dL</small>
                </span>
              </div>
              <div className="px-3.5 py-2 bg-slate-50/60 rounded-xl border border-slate-100 min-w-[110px]">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                  HbA1c
                </span>
                <span className="text-lg font-bold text-slate-800">
                  {dashboardData?.vitals?.hba1c?.value || "--"}{" "}
                  <small className="text-xs font-normal text-slate-400">%</small>
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Glycemic Stability Map
              </h4>
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-start sm:self-auto">
                <button
                  onClick={() => setVitalsMode("glucose")}
                  className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition-all ${vitalsMode === "glucose" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  GLUCOSE
                </button>
                <button
                  onClick={() => setVitalsMode("hba1c")}
                  className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition-all ${vitalsMode === "hba1c" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  HBA1C
                </button>
              </div>
            </div>

            <div className="h-[260px] w-full bg-slate-50/30 rounded-xl border border-slate-100 p-4">
              {vitalsMode === "glucose" ? (
                processedGlucoseData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-30 italic">
                    <Activity className="w-10 h-10 mb-2 text-slate-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      No Glucose history detected
                    </span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={processedGlucoseData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                      barGap={2}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 9,
                          fill: "#64748b",
                          fontWeight: 500,
                        }}
                        dy={5}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 9,
                          fill: "#64748b",
                          fontWeight: 500,
                        }}
                        width={30}
                        domain={[0, "auto"]}
                      />
                      <Tooltip
                        cursor={{ fill: "#f8fafc", radius: 8 }}
                        contentStyle={{
                          borderRadius: "12px",
                          border: "1px solid #f1f5f9",
                          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)",
                          padding: "8px 12px",
                          fontSize: "11px",
                        }}
                      />
                      <Bar
                        dataKey="fasting"
                        name="Fasting"
                        fill="#9333ea"
                        radius={[3, 3, 0, 0]}
                        barSize={8}
                        style={{ cursor: "pointer" }}
                      />
                      <Bar
                        dataKey="preMeal"
                        name="Pre-Meal"
                        fill="#2563eb"
                        radius={[3, 3, 0, 0]}
                        barSize={8}
                        style={{ cursor: "pointer" }}
                      />
                      <Bar
                        dataKey="postMeal"
                        name="Post-Meal"
                        fill="#ea580c"
                        radius={[3, 3, 0, 0]}
                        barSize={8}
                        style={{ cursor: "pointer" }}
                      />
                      <Bar
                        dataKey="random"
                        name="Random"
                        fill="#059669"
                        radius={[3, 3, 0, 0]}
                        barSize={8}
                        style={{ cursor: "pointer" }}
                      />
                      <Legend
                        wrapperStyle={{
                          fontSize: "9px",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          paddingTop: "10px",
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )
              ) : processedHbA1cData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-30 italic">
                  <Activity className="w-10 h-10 mb-2 text-slate-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    No HbA1c history detected
                  </span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={processedHbA1cData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                    barGap={2}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f1f5f9"
                    />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fontSize: 9,
                        fill: "#64748b",
                        fontWeight: 500,
                      }}
                      dy={5}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fontSize: 9,
                        fill: "#64748b",
                        fontWeight: 500,
                      }}
                      width={30}
                      domain={[0, "auto"]}
                    />
                    <Tooltip
                      cursor={{ fill: "#f8fafc", radius: 8 }}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #f1f5f9",
                        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)",
                        padding: "8px 12px",
                        fontSize: "11px",
                      }}
                    />
                    <Bar
                      dataKey="value"
                      name="HbA1c Level"
                      radius={[3, 3, 0, 0]}
                      barSize={8}
                      style={{ cursor: "pointer" }}
                    >
                      {processedHbA1cData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.value < 6.5 ? "#10b981" : "#f43f5e"}
                        />
                      ))}
                    </Bar>
                    <Legend
                      wrapperStyle={{
                        fontSize: "9px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        paddingTop: "10px",
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {diabetesAnalysis && (
            <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-100/50 flex items-start gap-3 mt-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-100/80 flex items-center justify-center flex-shrink-0 text-emerald-700 shadow-sm">
                <Sparkles className="w-4 h-4 text-emerald-700" />
              </div>
              <div>
                <h4 className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-0.5">
                  AI Clinical Insight
                </h4>
                <p className="text-xs font-medium text-slate-700 leading-relaxed italic">
                  "{diabetesAnalysis.analysis}"
                </p>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* --- PREMIUM BREAKDOWN GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 1. STEPS CARD */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`${glassCard} p-5 relative group overflow-hidden bg-white hover:scale-[1.01]`}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FFF5EF] text-[#FF7A2F] flex items-center justify-center shadow-sm">
                <Footprints className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Steps</h4>
                <p className="text-lg font-bold text-slate-900 mt-0.5">
                  {Math.round(
                    wearableData?.todayMetrics?.steps ||
                      dashboardData?.vitals?.steps?.value ||
                      0,
                  ).toLocaleString()}{" "}
                  <span className="text-slate-400 font-normal text-xs">
                    / {dashboardData?.goals?.steps || 10000}
                  </span>
                </p>
              </div>
            </div>
            {(wearableData?.todayMetrics?.steps ||
              dashboardData?.vitals?.steps?.value) && (
              <div className="px-2 py-1 bg-[#FFF5EF] text-[#FF7A2F] text-[10px] font-bold rounded-lg border border-[#FF7A2F]/10">
                {Math.round(
                  ((wearableData?.todayMetrics?.steps ||
                    dashboardData?.vitals?.steps?.value ||
                    0) /
                    (dashboardData?.goals?.steps || 10000)) *
                    100,
                )}
                %
              </div>
            )}
          </div>

          <div className="h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={multiDayData}
                margin={{ top: 10, right: 5, left: -25, bottom: 5 }}
                barGap={2}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#F1F5F9"
                />
                <XAxis
                  dataKey="dayLabel"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 500 }}
                  dy={5}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 500 }}
                  width={25}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  cursor={{ fill: "#f8fafc", radius: 8 }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #f1f5f9",
                    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)",
                    padding: "8px 12px",
                    fontSize: "11px",
                  }}
                />
                <Bar
                  dataKey="steps"
                  fill="#FF7A2F"
                  radius={[3, 3, 0, 0]}
                  barSize={8}
                  style={{ cursor: "pointer" }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* 2. SLEEP CARD */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className={`${glassCard} p-5 relative group overflow-hidden bg-white hover:scale-[1.01]`}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#F5F3FF] text-[#8B5CF6] flex items-center justify-center shadow-sm">
                <Moon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sleep</h4>
                <p className="text-lg font-bold text-slate-900 mt-0.5">
                  {(() => {
                    const todayStr = new Date().toISOString().split("T")[0];
                    let wearableHours = 0;

                    if (wearableData?.recentSleep?.length > 0) {
                      const latest = wearableData.recentSleep[0];
                      const latestDate = new Date(latest.date)
                        .toISOString()
                        .split("T")[0];
                      if (latestDate === todayStr) {
                        wearableHours = (latest.totalSleepMinutes || 0) / 60;
                      }
                    }

                    if (wearableHours > 0) return wearableHours.toFixed(1);

                    const h =
                      dashboardData?.vitals?.sleep?.value ||
                      dashboardData?.vitals?.sleepDuration?.value;
                    if (h && h > 0)
                      return h > 24
                        ? (h / 60).toFixed(1)
                        : Number(h).toFixed(1);

                    return "0.0";
                  })()}{" "}
                  <span className="text-slate-400 font-normal text-xs">
                    / {dashboardData?.goals?.sleep || 8.0} hrs
                  </span>
                </p>
              </div>
            </div>
            <div className="px-2 py-1 bg-[#F5F3FF] text-[#8B5CF6] text-[10px] font-bold rounded-lg border border-[#8B5CF6]/10">
              Avg. Flow
            </div>
          </div>

          <div className="h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={multiDayData}
                margin={{ top: 10, right: 5, left: -25, bottom: 5 }}
                barGap={2}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="dayLabel"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 500 }}
                  dy={5}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 500 }}
                  width={25}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  cursor={{ fill: "#f8fafc", radius: 8 }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #f1f5f9",
                    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)",
                    padding: "8px 12px",
                    fontSize: "11px",
                  }}
                />
                <Bar
                  dataKey="sleep"
                  fill="#8B5CF6"
                  radius={[3, 3, 0, 0]}
                  barSize={8}
                  style={{ cursor: "pointer" }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* 3. CALORIES CARD */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className={`${glassCard} p-5 relative group overflow-hidden bg-white hover:scale-[1.01]`}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#ECFDF5] text-[#10B981] flex items-center justify-center shadow-sm">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Calories</h4>
                <p className="text-lg font-bold text-slate-900 mt-0.5">
                  {Math.round(
                    nutritionData?.totalCalories ||
                      dashboardData?.vitals?.calories?.value ||
                      0,
                  ).toLocaleString()}{" "}
                  <span className="text-slate-400 font-normal text-xs">
                    / {dashboardData?.goals?.calories || 2000}
                  </span>
                </p>
              </div>
            </div>
            {(nutritionData?.totalCalories ||
              dashboardData?.vitals?.calories?.value) && (
              <div className="px-2 py-1 bg-[#ECFDF5] text-[#10B981] text-[10px] font-bold rounded-lg border border-[#10B981]/10">
                {Math.round(
                  ((nutritionData?.totalCalories ||
                    dashboardData?.vitals?.calories?.value ||
                    0) /
                    (dashboardData?.goals?.calories || 2000)) *
                    100,
                )}
                %
              </div>
            )}
          </div>

          <div className="h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={multiDayData}
                margin={{ top: 10, right: 5, left: -25, bottom: 5 }}
                barGap={2}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="fullLabel"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 500 }}
                  dy={5}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 500 }}
                  width={25}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  cursor={{ fill: "#f8fafc", radius: 8 }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #f1f5f9",
                    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)",
                    padding: "8px 12px",
                    fontSize: "11px",
                  }}
                />
                <Bar
                  dataKey="calories"
                  fill="#10B981"
                  radius={[3, 3, 0, 0]}
                  barSize={8}
                  style={{ cursor: "pointer" }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* 4. HYDRATION CARD */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className={`${glassCard} p-5 relative group overflow-hidden bg-white hover:scale-[1.01]`}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] text-[#3B82F6] flex items-center justify-center shadow-sm">
                <Droplets className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-sans">
                  Hydration
                </h4>
                <p className="text-lg font-bold text-slate-900 mt-0.5">
                  {(() => {
                    const todayData = multiDayData.find((d) =>
                      d.date?.startsWith(
                        new Date().toISOString().split("T")[0],
                      ),
                    );
                    if (todayData) return Math.round(todayData.water);

                    return Math.round(
                      nutritionData?.totalWater ||
                        nutritionData?.waterIntake ||
                        dashboardData?.vitals?.water?.value ||
                        0,
                    );
                  })()}{" "}
                  <span className="text-slate-400 font-normal text-xs">
                    / {dashboardData?.goals?.water || 8} glasses
                  </span>
                </p>
              </div>
            </div>
            <div className="px-2 py-1 bg-[#EFF6FF] text-[#3B82F6] text-[10px] font-bold rounded-lg border border-[#3B82F6]/10">
              On Pace
            </div>
          </div>

          <div className="h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={multiDayData}
                margin={{ top: 10, right: 5, left: -25, bottom: 5 }}
                barGap={2}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="dayLabel"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 500 }}
                  dy={5}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 500 }}
                  width={25}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  cursor={{ fill: "#f8fafc", radius: 8 }}
                  formatter={(value) => [`${value} glasses`, "Total Intake"]}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #f1f5f9",
                    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)",
                    padding: "8px 12px",
                    fontSize: "11px",
                  }}
                />
                <Bar
                  dataKey="water"
                  fill="#3B82F6"
                  radius={[3, 3, 0, 0]}
                  barSize={8}
                  style={{ cursor: "pointer" }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* 5. WEIGHT JOURNEY CARD */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className={`${glassCard} p-5 relative group overflow-hidden md:col-span-2 bg-white hover:scale-[1.01]`}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#F8FAFC] text-[#475569] flex items-center justify-center shadow-sm">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Weight Journey
                </h4>
                <p className="text-lg font-bold text-slate-900 mt-0.5">
                  {dashboardData?.vitals?.weight?.value || "--"}{" "}
                  <span className="text-slate-400 font-normal text-xs">lbs</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-lg border border-emerald-100 flex items-center gap-1">
                <TrendingDown className="w-3 h-3" /> -3.0 lbs
              </div>
            </div>
          </div>

          <div className="h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={multiDayData}
                margin={{ top: 10, right: 5, left: -25, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="dateNum"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: "#94A3B8", fontWeight: 500 }}
                  ticks={
                    activeRange === "7d"
                      ? undefined
                      : [1, 5, 10, 15, 20, 25, 30]
                  }
                />
                <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #f1f5f9",
                    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)",
                    padding: "8px 12px",
                    fontSize: "11px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="#4F46E5"
                  strokeWidth={3}
                  fill="url(#weightGrad)"
                  dot={
                    activeRange === "7d"
                      ? {
                          r: 4,
                          fill: "#4F46E5",
                          strokeWidth: 2,
                          stroke: "#fff",
                        }
                      : false
                  }
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
