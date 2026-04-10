import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Flame, Droplets, Footprints, Moon, Scale, Sparkles, 
  TrendingUp, TrendingDown, ChevronRight, Calculator, Calendar,
  Target, Info, AlertCircle, RefreshCw, ArrowLeft, Brain, Clipboard, CheckCircle,
  ChevronDown, Filter
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, 
  CartesianGrid, BarChart, Bar, Cell, LineChart, Line, ReferenceLine, Legend
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import api from '../services/api';
import toast from 'react-hot-toast';

const glassCard = "bg-white/80 backdrop-blur-2xl border border-white/50 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)]";

export default function CompleteAnalysis() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { dashboardData, wearableData, nutritionData, fetchDashboard, loading: contextLoading } = useData();
  
  const [loading, setLoading] = useState(!dashboardData);
  const [glucoseLogs, setGlucoseLogs] = useState([]);
  const [hba1cLogs, setHba1cLogs] = useState([]);
  const [diabetesAnalysis, setDiabetesAnalysis] = useState(null);
  const [activeRange, setActiveRange] = useState('7d'); // 7d, 30d, 90d
  const [vitalsMode, setVitalsMode] = useState('glucose'); // glucose, hba1c
  const [showRangeDropdown, setShowRangeDropdown] = useState(false);

  const isDiabetic = user?.profile?.isDiabetic === 'yes' || (user?.profile?.medicalHistory?.conditions || []).includes('diabetes');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Force refresh (bypass cache) to show real-time daily data
      await fetchDashboard(true);
      
      // Fetch metrics regardless of isDiabetic flag to be safe, but only if user exists
      if (user?._id) {
        const [glucoseRes, hba1cRes, analysisRes] = await Promise.all([
          api.get('metrics/blood_sugar', { params: { limit: 100 } }).catch(() => ({ data: [] })),
          api.get('metrics/hba1c', { params: { limit: 20 } }).catch(() => ({ data: [] })),
          api.get('metrics/analysis/glucose').catch(() => null)
        ]);
        
        console.log('Fetched Vitals:', { 
          glucose: glucoseRes.data.length, 
          hba1c: hba1cRes.data.length 
        });

        setGlucoseLogs(Array.isArray(glucoseRes.data) ? glucoseRes.data : []);
        setHba1cLogs(Array.isArray(hba1cRes.data) ? hba1cRes.data : []);
        if (analysisRes?.data?.success) {
          setDiabetesAnalysis(analysisRes.data.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch analysis data:', error);
      toast.error('Could not load complete analysis');
    } finally {
      setLoading(false);
    }
  }, [fetchDashboard, user?._id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time synchronization when dashboard data updates in context
  useEffect(() => {
    if (isDiabetic && dashboardData) {
      // Re-fetch diabetic specific logs to match the context update
      const syncDiabeticLogs = async () => {
        try {
          const [glucoseRes, hba1cRes] = await Promise.all([
            api.get('metrics/blood_sugar', { params: { limit: 100 } }).catch(() => ({ data: [] })),
            api.get('metrics/hba1c', { params: { limit: 20 } }).catch(() => ({ data: [] }))
          ]);
          setGlucoseLogs(Array.isArray(glucoseRes.data) ? glucoseRes.data : []);
          setHba1cLogs(Array.isArray(hba1cRes.data) ? hba1cRes.data : []);
        } catch (e) {
          console.error("Sync error:", e);
        }
      };
      syncDiabeticLogs();
    }
  }, [dashboardData, isDiabetic]);

  const handleRefresh = () => {
    fetchData();
    toast.success('Refreshing analytical core...');
  };

  const trendData = useMemo(() => {
    if (!dashboardData?.history) return [];
    const days = activeRange === '7d' ? 7 : activeRange === '30d' ? 30 : 90;
    return dashboardData.history.slice(-days);
  }, [dashboardData, activeRange]);

  const processedGlucoseData = useMemo(() => {
    if (!glucoseLogs || glucoseLogs.length === 0) return [];
    
    const dayMap = {};
    glucoseLogs.forEach(r => {
      const date = new Date(r.recordedAt);
      if (isNaN(date.getTime())) return;
      
      const key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!dayMap[key]) {
        dayMap[key] = { name: key, fasting: null, preMeal: null, postMeal: null, random: null, date: date };
      }
      
      const val = Number(r.value);
      const ctx = (r.readingContext || '').toLowerCase();
      
      if (ctx === 'fasting') dayMap[key].fasting = val;
      else if (ctx.includes('pre')) dayMap[key].preMeal = val;
      else if (ctx.includes('post')) dayMap[key].postMeal = val;
      else dayMap[key].random = val;
    });

    const days = activeRange === '7d' ? 7 : activeRange === '30d' ? 30 : 90;
    return Object.values(dayMap)
      .sort((a, b) => a.date - b.date)
      .slice(-days);
  }, [glucoseLogs, activeRange]);

  const processedHbA1cData = useMemo(() => {
    if (!hba1cLogs || hba1cLogs.length === 0) return [];
    return hba1cLogs.slice(0, 8).reverse().map(r => {
      const date = new Date(r.recordedAt);
      return {
        month: isNaN(date.getTime()) ? 'Unknown' : date.toLocaleDateString('en-US', { month: 'short' }),
        value: Number(r.value)
      };
    });
  }, [hba1cLogs]);

  // Transform trendData into dynamic multi-day format
  const multiDayData = useMemo(() => {
    if (!dashboardData?.history) return [];
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const limit = activeRange === '7d' ? 7 : activeRange === '30d' ? 30 : 90;
    
    // Get historical data
    let history = [...dashboardData.history.slice(-limit)];
    
    // Ensure today's data is merged for real-time updates
    const todayStr = new Date().toISOString().split('T')[0];
    const hasToday = history.some(d => d.date.startsWith(todayStr));
    
    if (!hasToday && activeRange === '7d') {
      const vitals = dashboardData.vitals || {};
      history.push({
         date: new Date().toISOString(),
         steps: wearableData?.todayMetrics?.steps || vitals.steps?.value || 0,
         sleep: wearableData?.todayMetrics?.sleep ? (wearableData.todayMetrics.sleep / 60) : (vitals.sleep?.value || 0),
         water: nutritionData?.totalWater || nutritionData?.waterIntake || vitals.water?.value || 0,
         calories: nutritionData?.totalCalories || vitals.calories?.value || 0,
         weight: vitals.weight?.value || history[history.length - 1]?.weight || 0
      });
      // Keep only last limit
      history = history.slice(-limit);
    } else if (hasToday) {
       // Update today's entry in history with live vitals if it exists
       history = history.map(d => {
         if (d.date.startsWith(todayStr)) {
            const vitals = dashboardData.vitals || {};
            
            // Get today's sleep from wearable data if available
            let wearableSleepToday = 0;
            if (wearableData?.recentSleep?.length > 0) {
              const latestSleep = wearableData.recentSleep[0];
              const sleepDate = new Date(latestSleep.date).toISOString().split('T')[0];
              if (sleepDate === todayStr) {
                wearableSleepToday = (latestSleep.totalSleepMinutes || 0) / 60;
              }
            }

            return {
               ...d,
               steps: wearableData?.todayMetrics?.steps || vitals.steps?.value || d.steps,
               sleep: wearableSleepToday || vitals.sleep?.value || d.sleep,
               water: nutritionData?.totalWater || nutritionData?.waterIntake || vitals.water?.value || d.water,
               calories: nutritionData?.totalCalories || vitals.calories?.value || d.calories,
               weight: vitals.weight?.value || d.weight
            };
         }
         return d;
       });
    }
    
    return history.map(day => {
      const d = new Date(day.date);
      return {
        ...day,
        steps: Math.round(day.steps || 0),
        sleep: parseFloat(Number(day.sleep || 0).toFixed(1)),
        water: Math.round(day.water || 0),
        calories: Math.round(day.calories || 0),
        weight: day.weight ? parseFloat(Number(day.weight).toFixed(1)) : 0,
        dayLabel: days[d.getDay()],
        fullLabel: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dateNum: d.getDate()
      };
    });
  }, [dashboardData, activeRange]);

  // Hydration data now uses multiDayData for daily trends instead of hourly distribution

  if (loading || contextLoading.dashboard) {
    return (
      <div className="min-h-screen bg-[#F9FCF3] flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin mb-6" />
        <div className="text-center space-y-2">
          <p className="text-[#064e3b] font-black uppercase tracking-widest text-sm animate-pulse">Checking latest data...</p>
          <p className="text-emerald-800/40 font-bold uppercase tracking-[0.2em] text-[10px]">Calibrating Analysis Hub</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FCF3] pt-6 pb-24 px-4 md:px-8 max-w-[1400px] mx-auto space-y-8 font-sans">
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 w-full">
        <div>
           <h1 className="text-3xl md:text-5xl font-black text-[#011B1D] tracking-tight mb-2">Daily Breakdown</h1>
           <p className="text-emerald-800/40 font-bold uppercase tracking-[0.2em] text-[10px]">Holistic Performance Metrics</p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Custom Range Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowRangeDropdown(!showRangeDropdown)}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[#011B1D] hover:shadow-lg transition-all"
            >
              <Filter className="w-3 h-3 text-emerald-500" />
              Range: {activeRange}
              <ChevronDown className={`w-3 h-3 transition-transform ${showRangeDropdown ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showRangeDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full right-0 mt-3 w-40 bg-white/95 backdrop-blur-md border border-slate-100 rounded-2xl shadow-2xl z-[100] overflow-hidden p-2"
                >
                  {['7d', '30d', '90d'].map((range) => (
                    <button
                      key={range}
                      onClick={() => {
                        setActiveRange(range);
                        setShowRangeDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-[10px] font-black rounded-xl uppercase tracking-widest transition-colors ${
                        activeRange === range ? 'bg-[#064e3b] text-white shadow-md' : 'text-emerald-800/60 hover:bg-emerald-50'
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
            className="p-3 bg-white border border-slate-100 rounded-2xl text-emerald-800/40 hover:text-emerald-600 hover:shadow-lg transition-all shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* --- CONDITIONAL DIABETES HERO --- */}
      {isDiabetic && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${glassCard} p-6 md:p-8 overflow-hidden bg-gradient-to-br from-white to-emerald-50/30`}>
          <div className="flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-[24px] bg-[#064e3b] text-white flex items-center justify-center shadow-2xl shadow-emerald-200">
                  <Brain className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-[#011B1D] tracking-tight">Diabetes Care</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[11px] font-black text-emerald-800/40 uppercase tracking-[0.2em]">Clinical Priority Monitoring</span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="px-6 py-4 bg-white rounded-[24px] border border-emerald-100 shadow-sm min-w-[140px]">
                  <span className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest block mb-1">Glucose</span>
                  <span className="text-3xl font-black text-[#011B1D]">{dashboardData?.vitals?.glucose?.value || '--'} <small className="text-xs opacity-30">mg/dL</small></span>
                </div>
                <div className="px-6 py-4 bg-white rounded-[24px] border border-emerald-100 shadow-sm min-w-[140px]">
                  <span className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest block mb-1">HbA1c</span>
                  <span className="text-3xl font-black text-[#011B1D]">{dashboardData?.vitals?.hba1c?.value || '--'} <small className="text-xs opacity-30">%</small></span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-black text-[#011B1D] uppercase tracking-widest">Glycemic Stability Map</h4>
                <div className="flex bg-[#F1F5F9] p-1.5 rounded-2xl border border-slate-200">
                  <button onClick={() => setVitalsMode('glucose')} className={`px-6 py-2 text-[10px] font-black rounded-xl transition-all ${vitalsMode === 'glucose' ? 'bg-white text-[#064e3b] shadow-lg shadow-emerald-100' : 'text-slate-400 hover:text-slate-600'}`}>GLUCOSE</button>
                  <button onClick={() => setVitalsMode('hba1c')} className={`px-6 py-2 text-[10px] font-black rounded-xl transition-all ${vitalsMode === 'hba1c' ? 'bg-white text-[#064e3b] shadow-lg shadow-emerald-100' : 'text-slate-400 hover:text-slate-600'}`}>HBA1C</button>
                </div>
              </div>

              <div className="h-[350px] w-full bg-white/40 rounded-[32px] border border-emerald-100 p-6">
                {vitalsMode === 'glucose' ? (
                  processedGlucoseData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 italic">
                      <Activity className="w-12 h-12 mb-2" />
                      <span className="text-sm font-black uppercase tracking-widest">No Glucose history detected</span>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={processedGlucoseData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.3} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 800 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 800 }} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', fontWeight: 900 }} />
                        <ReferenceLine y={100} stroke="#10b981" strokeDasharray="5 5" opacity={0.5} />
                        <Line type="stepAfter" name="Fasting" dataKey="fasting" stroke="#9333ea" strokeWidth={5} dot={{ r: 5, fill: '#9333ea', strokeWidth: 3, stroke: '#fff' }} connectNulls />
                        <Line type="stepAfter" name="Pre-Meal" dataKey="preMeal" stroke="#2563eb" strokeWidth={5} dot={{ r: 5, fill: '#2563eb', strokeWidth: 3, stroke: '#fff' }} connectNulls />
                        <Line type="stepAfter" name="Post-Meal" dataKey="postMeal" stroke="#ea580c" strokeWidth={5} dot={{ r: 5, fill: '#ea580c', strokeWidth: 3, stroke: '#fff' }} connectNulls />
                        <Line type="stepAfter" name="Random" dataKey="random" stroke="#059669" strokeWidth={5} dot={{ r: 5, fill: '#059669', strokeWidth: 3, stroke: '#fff' }} connectNulls />
                        <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', paddingTop: '30px' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )
                ) : (
                  processedHbA1cData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 italic">
                      <Activity className="w-12 h-12 mb-2" />
                      <span className="text-sm font-black uppercase tracking-widest">No HbA1c history detected</span>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={processedHbA1cData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.3} />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 800 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 800 }} />
                        <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', fontWeight: 900 }} />
                        <Bar dataKey="value" name="HbA1c Level" radius={[15, 15, 0, 0]} barSize={40}>
                          {processedHbA1cData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.value < 6.5 ? '#10b981' : '#f43f5e'} />
                          ))}
                        </Bar>
                        <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', paddingTop: '30px' }} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                )}
              </div>
            </div>

            {diabetesAnalysis && (
              <div className="p-8 bg-[#064e3b]/5 rounded-[32px] border border-emerald-100 flex items-start gap-4">
                 <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                   <Sparkles className="w-5 h-5 text-amber-600" />
                 </div>
                 <div>
                    <h4 className="text-[12px] font-black text-[#011B1D] uppercase tracking-[0.2em] mb-2">AI Clinical Insight</h4>
                    <p className="text-base font-bold text-[#011B1D]/70 leading-relaxed italic">
                      "{diabetesAnalysis.analysis}"
                    </p>
                 </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* --- PREMIUM BREAKDOWN GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          
          {/* 1. STEPS CARD */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`${glassCard} p-8 relative group overflow-hidden bg-white hover:shadow-2xl transition-all duration-500`}>
             <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-5">
                   <div className="w-16 h-16 rounded-[24px] bg-[#FFF5EF] flex items-center justify-center text-[#FF7A2F] shadow-sm group-hover:scale-110 transition-transform">
                      <Footprints className="w-9 h-9" />
                   </div>
                   <div>
                      <h4 className="text-2xl font-black text-[#011B1D]">Steps</h4>
                      <p className="text-lg font-black text-[#011B1D]/60 mt-1">
                         {Math.round(wearableData?.todayMetrics?.steps || dashboardData?.vitals?.steps?.value || 0).toLocaleString()} <span className="text-[#011B1D]/20 font-bold tracking-tight">/ {dashboardData?.goals?.steps || 10000}</span>
                      </p>
                   </div>
                </div>
                { (wearableData?.todayMetrics?.steps || dashboardData?.vitals?.steps?.value) && (
                  <div className="px-4 py-2 bg-[#FFF5EF] text-[#FF7A2F] text-[12px] font-black rounded-xl border border-[#FF7A2F]/10">
                    {Math.round(((wearableData?.todayMetrics?.steps || dashboardData?.vitals?.steps?.value || 0) / (dashboardData?.goals?.steps || 10000)) * 100)}% Target
                  </div>
                )}
             </div>
             
             <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={multiDayData} margin={{ top: 0, right: 0, left: -40, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis 
                        dataKey="dayLabel" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 13, fill: '#64748B', fontWeight: 900 }} 
                      />
                      <YAxis hide domain={[0, 'dataMax + 2000']} />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255, 122, 47, 0.05)' }} 
                        contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', fontWeight: 900 }} 
                      />
                      <Bar dataKey="steps" fill="#FF7A2F" radius={[10, 10, 0, 0]} barSize={36} />
                   </BarChart>
                </ResponsiveContainer>
             </div>
          </motion.div>

          {/* 2. SLEEP CARD */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className={`${glassCard} p-8 relative overflow-hidden bg-white hover:shadow-2xl transition-all duration-500`}>
             <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-5">
                   <div className="w-16 h-16 rounded-[24px] bg-[#F5F3FF] flex items-center justify-center text-[#8B5CF6] shadow-sm">
                      <Moon className="w-9 h-9" />
                   </div>
                   <div>
                      <h4 className="text-2xl font-black text-[#011B1D]">Sleep</h4>
                      <p className="text-lg font-black text-[#011B1D]/60 mt-1">
                          {(() => {
                             const todayStr = new Date().toISOString().split('T')[0];
                             let wearableHours = 0;
                             
                             if (wearableData?.recentSleep?.length > 0) {
                               const latest = wearableData.recentSleep[0];
                               const latestDate = new Date(latest.date).toISOString().split('T')[0];
                               if (latestDate === todayStr) {
                                 wearableHours = (latest.totalSleepMinutes || 0) / 60;
                               }
                             }
                             
                             if (wearableHours > 0) return wearableHours.toFixed(1);
                             
                             const h = dashboardData?.vitals?.sleep?.value || dashboardData?.vitals?.sleepDuration?.value;
                             if (h && h > 0) return h > 24 ? (h / 60).toFixed(1) : Number(h).toFixed(1);
                             
                             return "0.0";
                          })()} <span className="text-[#011B1D]/20 font-bold">/ {dashboardData?.goals?.sleep || 8.0} hrs</span>
                      </p>
                   </div>
                </div>
                <div className="px-4 py-2 bg-[#F5F3FF] text-[#8B5CF6] text-[12px] font-black rounded-xl border border-[#8B5CF6]/10">
                   Avg. Flow
                </div>
             </div>
             
             <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={multiDayData} margin={{ top: 0, right: 0, left: -40, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis 
                        dataKey="dayLabel" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 13, fill: '#64748B', fontWeight: 900 }} 
                      />
                      <YAxis hide domain={[0, 10]} />
                      <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', fontWeight: 900 }} />
                      <Bar dataKey="sleep" fill="#8B5CF6" radius={[10, 10, 0, 0]} barSize={36} />
                   </BarChart>
                </ResponsiveContainer>
             </div>
          </motion.div>

          {/* 3. CALORIES CARD */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className={`${glassCard} p-8 relative overflow-hidden bg-white hover:shadow-2xl transition-all duration-500`}>
             <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-5">
                   <div className="w-16 h-16 rounded-[24px] bg-[#ECFDF5] flex items-center justify-center text-[#10B981] shadow-sm">
                      <Flame className="w-9 h-9" />
                   </div>
                   <div>
                      <h4 className="text-2xl font-black text-[#011B1D]">Calories</h4>
                      <p className="text-lg font-black text-[#011B1D]/60 mt-1">
                         {Math.round(nutritionData?.totalCalories || dashboardData?.vitals?.calories?.value || 0).toLocaleString()} <span className="text-[#011B1D]/20 font-bold">/ {dashboardData?.goals?.calories || 2000}</span>
                      </p>
                   </div>
                </div>
                {(nutritionData?.totalCalories || dashboardData?.vitals?.calories?.value) && (
                  <div className="px-4 py-2 bg-[#ECFDF5] text-[#10B981] text-[12px] font-black rounded-xl border border-[#10B981]/10">
                    {Math.round(((nutritionData?.totalCalories || dashboardData?.vitals?.calories?.value || 0) / (dashboardData?.goals?.calories || 2000)) * 100)}% Target
                  </div>
                )}
             </div>
             
             <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={multiDayData} margin={{ top: 0, right: 0, left: -40, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis 
                        dataKey="fullLabel" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 11, fill: '#64748B', fontWeight: 900 }} 
                      />
                      <YAxis hide domain={[0, 'dataMax + 500']} />
                      <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', fontWeight: 900 }} />
                      <Bar dataKey="calories" fill="#10B981" radius={[10, 10, 0, 0]} barSize={30} />
                   </BarChart>
                </ResponsiveContainer>
             </div>
          </motion.div>

          {/* 4. HYDRATION CARD */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className={`${glassCard} p-8 relative overflow-hidden bg-white hover:shadow-2xl transition-all duration-500`}>
             <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-5">
                   <div className="w-16 h-16 rounded-[24px] bg-[#EFF6FF] flex items-center justify-center text-[#3B82F6] shadow-sm">
                      <Droplets className="w-9 h-9" />
                   </div>
                   <div>
                      <h4 className="text-2xl font-black text-[#011B1D]">Hydration</h4>
                      <p className="text-lg font-black text-[#011B1D]/60 mt-1">
                         {(() => {
                            // Use the same consolidated logic as the graph for consistency
                            const todayData = multiDayData.find(d => d.date?.startsWith(new Date().toISOString().split('T')[0]));
                            if (todayData) return Math.round(todayData.water);
                            
                            return Math.round(nutritionData?.totalWater || nutritionData?.waterIntake || dashboardData?.vitals?.water?.value || 0);
                         })()} <span className="text-[#011B1D]/20 font-bold">/ {dashboardData?.goals?.water || 8} glasses</span>
                      </p>
                   </div>
                </div>
                <div className="px-4 py-2 bg-[#EFF6FF] text-[#3B82F6] text-[12px] font-black rounded-xl border border-[#3B82F6]/10">
                   On Pace
                </div>
             </div>
             
             <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={multiDayData} margin={{ top: 0, right: 0, left: -40, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis 
                        dataKey="dayLabel" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 13, fill: '#64748B', fontWeight: 900 }} 
                      />
                      <YAxis hide />
                      <Tooltip 
                        formatter={(value) => [`${value} glasses`, 'Total Intake']}
                        contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', fontWeight: 900 }} 
                      />
                      <Bar dataKey="water" fill="#3B82F6" radius={[10, 10, 0, 0]} barSize={36} />
                   </BarChart>
                </ResponsiveContainer>
             </div>
          </motion.div>

          {/* 5. WEIGHT JOURNEY CARD */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className={`${glassCard} p-8 relative overflow-hidden xl:col-span-2 bg-white hover:shadow-2xl transition-all duration-500`}>
             <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-5">
                   <div className="w-16 h-16 rounded-[24px] bg-[#F8FAFC] flex items-center justify-center text-[#475569] shadow-sm">
                      <Scale className="w-9 h-9" />
                   </div>
                   <div>
                      <h4 className="text-2xl font-black text-[#011B1D]">Weight Journey</h4>
                      <p className="text-lg font-black text-[#011B1D]/60 mt-1">
                         {dashboardData?.vitals?.weight?.value || '--'} <span className="text-[#011B1D]/20 font-bold">lbs</span>
                      </p>
                   </div>
                </div>
                <div className="flex items-center gap-2">
                   <div className="px-4 py-2 bg-emerald-50 text-emerald-600 text-[12px] font-black rounded-xl border border-emerald-100 flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5" /> -3.0 lbs
                   </div>
                </div>
             </div>
             
             <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={multiDayData} margin={{ top: 10, right: 0, left: -40, bottom: 0 }}>
                      <defs>
                        <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="dateNum" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 13, fill: '#94A3B8', fontWeight: 900 }} 
                        ticks={activeRange === '7d' ? undefined : [1, 5, 10, 15, 20, 25, 30]}
                      />
                      <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                      <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', fontWeight: 900 }} />
                      <Area type="monotone" dataKey="weight" stroke="#4F46E5" strokeWidth={5} fill="url(#weightGrad)" dot={activeRange === '7d' ? { r: 6, fill: '#4F46E5', strokeWidth: 4, stroke: '#fff' } : false} />
                   </AreaChart>
                </ResponsiveContainer>
             </div>
          </motion.div>
      </div>
    </div>
  );
}
