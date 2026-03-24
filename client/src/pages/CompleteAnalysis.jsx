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
  const { dashboardData, fetchDashboard, loading: contextLoading } = useData();
  
  const [loading, setLoading] = useState(true);
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
      await fetchDashboard();
      
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
      
      <div className="flex flex-row items-center justify-between gap-3 w-full">
        <h1 className="text-xl md:text-5xl font-black text-[#064e3b] tracking-tight">Trends</h1>
        
        <div className="flex items-center gap-2">
          {/* Custom Dropdown Filter */}
          <div className="relative">
            <button 
              onClick={() => setShowRangeDropdown(!showRangeDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-white/60 border border-emerald-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[#064e3b] hover:bg-white transition-all shadow-sm"
            >
              <Filter className="w-3 h-3" />
              {activeRange}
              <ChevronDown className={`w-3 h-3 transition-transform ${showRangeDropdown ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showRangeDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 mt-2 w-28 bg-white/95 backdrop-blur-md border border-emerald-50 rounded-2xl shadow-2xl z-50 overflow-hidden"
                >
                  {['7d', '30d', '90d'].map((range) => (
                    <button
                      key={range}
                      onClick={() => {
                        setActiveRange(range);
                        setShowRangeDropdown(false);
                      }}
                      className={`w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${
                        activeRange === range ? 'bg-[#064e3b] text-white' : 'text-emerald-800/60 hover:bg-emerald-50'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button 
            onClick={handleRefresh} 
            className="p-2.5 bg-white/60 border border-emerald-100 rounded-2xl text-emerald-800/40 hover:text-emerald-600 hover:bg-white transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left/Main Column */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* 1. Vitals Card (Diabetic Priority) */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${glassCard} p-6 md:p-8 overflow-hidden`}>
            <div className="flex flex-col gap-8">
              
              {/* Header section with Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#064e3b] text-white flex items-center justify-center shadow-xl">
                    <Brain className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[#064e3b] uppercase tracking-tight">Diabetes Care</h3>
                    <div className="flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                       <span className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest">Real-time Biometrics</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-1 p-4 bg-white/40 rounded-2xl border border-emerald-100/30">
                    <span className="text-[9px] font-black text-emerald-800/40 uppercase block mb-1">Curent Glucose</span>
                    <span className="text-xl font-black text-[#064e3b]">{dashboardData?.vitals?.glucose?.value || '--'} <small className="text-[10px] opacity-40">mg/dL</small></span>
                  </div>
                  <div className="flex-1 p-4 bg-white/40 rounded-2xl border border-emerald-100/30">
                    <span className="text-[9px] font-black text-emerald-800/40 uppercase block mb-1">Active HbA1c</span>
                    <span className="text-xl font-black text-[#064e3b]">{dashboardData?.vitals?.hba1c?.value || '--'} <small className="text-[10px] opacity-40">%</small></span>
                  </div>
                </div>
              </div>

              {/* Chart Section */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-[#064e3b] uppercase tracking-widest">Performance History</h4>
                  <div className="flex bg-white/60 p-1.5 rounded-xl border border-emerald-200/50 shadow-sm">
                    <button onClick={() => setVitalsMode('glucose')} className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all ${vitalsMode === 'glucose' ? 'bg-[#064e3b] text-white shadow-md' : 'text-emerald-800/40'}`}>GLUCOSE</button>
                    <button onClick={() => setVitalsMode('hba1c')} className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all ${vitalsMode === 'hba1c' ? 'bg-[#064e3b] text-white shadow-md' : 'text-emerald-800/40'}`}>HBA1C</button>
                  </div>
                </div>

                <div className="h-[300px] w-full bg-white/20 rounded-3xl border border-emerald-100/20 p-4">
                  {vitalsMode === 'glucose' ? (
                    processedGlucoseData.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center opacity-30">
                        <Activity className="w-10 h-10 mb-2" />
                        <span className="text-[10px] font-black uppercase tracking-widest">No Glucose records found</span>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={processedGlucoseData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.3} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} domain={['auto', 'auto']} />
                          <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', fontWeight: 800 }} />
                          <ReferenceLine y={100} stroke="#10b981" strokeDasharray="3 3" opacity={0.4} />
                          <Line type="monotone" name="Fasting" dataKey="fasting" stroke="#9333ea" strokeWidth={4} dot={{ r: 4, fill: '#fff' }} connectNulls />
                          <Line type="monotone" name="Pre-Meal" dataKey="preMeal" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4, fill: '#fff' }} connectNulls />
                          <Line type="monotone" name="Post-Meal" dataKey="postMeal" stroke="#f97316" strokeWidth={4} dot={{ r: 4, fill: '#fff' }} connectNulls />
                          <Line type="monotone" name="Random" dataKey="random" stroke="#10b981" strokeWidth={4} dot={{ r: 4, fill: '#fff' }} connectNulls />
                          <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', paddingTop: '20px' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )
                  ) : (
                    processedHbA1cData.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center opacity-30">
                        <Activity className="w-10 h-10 mb-2" />
                        <span className="text-[10px] font-black uppercase tracking-widest">No HbA1c records found</span>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={processedHbA1cData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.3} />
                          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
                          <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', fontWeight: 800 }} />
                          <Bar dataKey="value" name="HbA1c %" radius={[12, 12, 0, 0]}>
                            {processedHbA1cData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.value < 6.5 ? '#10b981' : '#f43f5e'} />
                            ))}
                          </Bar>
                          <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', paddingTop: '20px' }} />
                        </BarChart>
                      </ResponsiveContainer>
                    )
                  )}
                </div>
              </div>

              {/* AI Analysis Summary if available */}
              {isDiabetic && diabetesAnalysis && (
                <div className="p-6 bg-[#064e3b]/5 rounded-[24px] border border-emerald-100">
                  <div className="flex items-center gap-3 mb-3">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <h4 className="text-[10px] font-black text-[#064e3b] uppercase tracking-widest">AI Clinical Insight</h4>
                  </div>
                  <p className="text-sm font-bold text-[#064e3b]/80 leading-relaxed italic">
                    "{diabetesAnalysis.analysis}"
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {/* 2. Calories Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${glassCard} p-6 md:p-8`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center">
                  <Flame className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-[#064e3b] uppercase tracking-tight">Calorie Intake Flow</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Macro Efficiency vs Target</p>
                </div>
              </div>
              <div className="bg-orange-500/10 px-6 py-3 rounded-2xl border border-orange-200/50">
                <span className="text-sm font-black text-orange-600 uppercase tracking-widest mr-3">Daily Goal</span>
                <span className="text-2xl font-black text-orange-600">{dashboardData?.goals?.calories || 2000} <small className="text-xs uppercase opacity-60">kcal</small></span>
              </div>
            </div>

            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorCal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} 
                      tickFormatter={(val) => {
                        const d = new Date(val);
                        return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                      }} 
                    />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
                  <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.05)', fontWeight: 800 }} />
                  <ReferenceLine y={dashboardData?.goals?.calories || 2000} stroke="#f97316" strokeWidth={3} strokeDasharray="8 8" label={{ value: 'TARGET', position: 'center', fill: '#f97316', fontSize: 12, fontWeight: 900 }} />
                  <Area type="monotone" dataKey="calories" stroke="#f97316" strokeWidth={4} fillOpacity={1} fill="url(#colorCal)" dot={{ r: 4, fill: '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* 3. Steps & Sleep Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${glassCard} p-6`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Footprints className="w-5 h-5 text-blue-500" />
                  </div>
                  <h4 className="text-sm font-black text-[#064e3b] uppercase tracking-tight">Step Dynamics</h4>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-blue-600">{Math.round(trendData[trendData.length-1]?.steps || 0)}</span>
                </div>
              </div>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.3} />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 700 }} 
                      tickFormatter={(val) => {
                        const d = new Date(val);
                        return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                      }} 
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} width={30} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontWeight: 700 }} />
                    <ReferenceLine y={dashboardData?.goals?.steps || 10000} stroke="#3b82f6" strokeDasharray="3 3" opacity={0.5} label={{ value: 'GOAL', position: 'right', fill: '#3b82f6', fontSize: 8, fontWeight: 800 }} />
                    <Line type="monotone" dataKey="steps" stroke="#3b82f6" strokeWidth={4} dot={{ r: 3, fill: '#3b82f6' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${glassCard} p-6`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Moon className="w-5 h-5 text-indigo-500" />
                  </div>
                  <h4 className="text-sm font-black text-[#064e3b] uppercase tracking-tight">Sleep Hygiene</h4>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-indigo-600">{(trendData[trendData.length-1]?.sleep || 0).toFixed(1)}h</span>
                </div>
              </div>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.3} />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 700 }} 
                      tickFormatter={(val) => {
                        const d = new Date(val);
                        return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                      }} 
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} width={30} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontWeight: 700 }} />
                    <ReferenceLine y={dashboardData?.goals?.sleep || 8} stroke="#6366f1" strokeDasharray="3 3" opacity={0.5} label={{ value: 'AIM', position: 'right', fill: '#6366f1', fontSize: 8, fontWeight: 800 }} />
                    <Bar dataKey="sleep" radius={[6, 6, 0, 0]}>
                        {trendData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.sleep >= (dashboardData?.goals?.sleep || 7) ? '#6366f1' : '#c7d2fe'} />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Right Column - Weight & Water */}
        <div className="space-y-8">
          
          {/* Weight Card */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className={`${glassCard} p-6 md:p-8`}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <Scale className="w-6 h-6 text-emerald-500" />
                </div>
                <h3 className="text-xl font-black text-[#064e3b] uppercase tracking-tight">Weight Flow</h3>
              </div>
            </div>
            
            <div className="h-[250px]">
              {trendData.filter(d => d.weight).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-30 italic">
                  <Scale className="w-8 h-8 mb-2" />
                  <span className="text-[10px] font-black uppercase tracking-widest">No weight history</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 700 }} 
                      tickFormatter={(val) => {
                        const d = new Date(val);
                        return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                      }} 
                    />
                    <YAxis axisLine={false} tickLine={false} hide domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontWeight: 700 }} />
                    <Area type="monotone" dataKey="weight" stroke="#10b981" strokeWidth={3} fill="#10b98120" dot={{ r: 5, fill: '#10b981' }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            
            <div className="mt-6 text-center">
              <span className="text-3xl font-black text-[#064e3b]">{trendData[trendData.length-1]?.weight || '--'}</span>
              <span className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">kg Current</span>
            </div>
          </motion.div>

          {/* Water Card */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className={`${glassCard} p-6 md:p-8`}>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center">
                <Droplets className="w-5 h-5 text-cyan-500" />
              </div>
              <h3 className="text-lg font-black text-[#064e3b] uppercase tracking-tight">Hydration Wave</h3>
            </div>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.3} />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 700 }} 
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                    }} 
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} width={25} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontWeight: 700 }} />
                  <ReferenceLine y={dashboardData?.goals?.water || 8} stroke="#06b6d4" strokeDasharray="3 3" opacity={0.5} label={{ value: 'DRINK', position: 'right', fill: '#06b6d4', fontSize: 8, fontWeight: 800 }} />
                  <Bar dataKey="water" radius={[10, 10, 0, 0]}>
                    {trendData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.water >= (dashboardData?.goals?.water || 8) ? '#06b6d4' : '#bae6fd'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* AI Tip Section */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className={`${glassCard} p-6 bg-gradient-to-br from-[#064e3b] to-[#042f2e] text-white relative overflow-hidden`}>
             <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
                <Sparkles className="w-40 h-40 transform translate-x-10 translate-y-10" />
             </div>
             <div className="relative z-10 space-y-4">
                <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                   <Sparkles className="w-5 h-5 text-amber-400" /> Executive Tip
                </h3>
                <div className="p-4 bg-white/10 rounded-2xl border border-white/5 backdrop-blur-sm">
                   <p className="text-xs font-bold leading-relaxed">
                     {isDiabetic 
                       ? "Prioritize low-GI fibers today to offset the mild glucose volatility observed." 
                       : "Your metabolic rate is peaking between 10 AM - 2 PM. Best time for high-intensity activity."}
                   </p>
                </div>
             </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
