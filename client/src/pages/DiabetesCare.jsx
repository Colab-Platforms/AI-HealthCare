import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Target, Calendar, Clock, Droplet, Loader2, TrendingUp, AlertCircle, 
  ChevronRight, Activity, Beaker, History, Info, Sparkles, LayoutDashboard, RefreshCw
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ReferenceLine, BarChart, Bar, Cell, AreaChart, Area
} from 'recharts';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

export default function DiabetesCare() {
  const { user } = useAuth();
  const [activeChart, setActiveChart] = useState('glucose');
  const [category, setCategory] = useState('Glucose');
  const [glucoseContext, setGlucoseContext] = useState('Fasting');
  const [value, setValue] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logTime, setLogTime] = useState(new Date().toTimeString().slice(0, 5));
  const [saving, setSaving] = useState(false);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [loading, setLoading] = useState(true);

  // Refs for picker interaction
  const dateInputRef = useRef(null);
  const timeInputRef = useRef(null);

  // Real-time data from API
  const [recentLogs, setRecentLogs] = useState([]);
  const [glucoseChartData, setGlucoseChartData] = useState([]);
  const [hba1cChartData, setHba1cChartData] = useState([]);
  const [avgFasting, setAvgFasting] = useState('--');
  const [latestHba1c, setLatestHba1c] = useState('--');
  const [aiInsight, setAiInsight] = useState('');
  const [aiFullData, setAiFullData] = useState(null);

  const theme = {
    background: 'bg-[#F2F5EC]',
    darkBackground: 'dark:bg-[#111815]',
    card: 'bg-white/70 backdrop-blur-xl border border-white dark:bg-[#1A221E]/90 dark:border-white/10 rounded-[32px] shadow-sm',
    accent: '#6FAF95',
    text: '#1a2138',
    secondaryText: '#64748b'
  };

  const fetchAiAnalysis = useCallback(async () => {
    setAnalyzingAi(true);
    setAiInsight('');
    setAiFullData(null);
    try {
      const resp = await api.get('metrics/analysis/glucose');
      const data = resp.data?.data;
      if (data) {
        setAiFullData(data);
        setAiInsight(data.analysis || data.insight || '');
      } else {
        setAiInsight('Your metabolic data is being processed. Complete more logs for a deep-dive analysis.');
      }
    } catch (error) {
      setAiInsight('Logging fresh data will allow AI to generate a detailed analysis of your metabolic spikes.');
    } finally {
      setAnalyzingAi(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [glucoseRes, hba1cRes] = await Promise.all([
        api.get('metrics/blood_sugar', { params: { limit: 50 } }),
        api.get('metrics/hba1c', { params: { limit: 20 } })
      ]);

      const glucoseReadings = glucoseRes.data?.data || glucoseRes.data || [];
      const hba1cReadings = hba1cRes.data?.data || hba1cRes.data || [];

      const allReadings = [
        ...glucoseReadings.map(r => ({ ...r, type: 'Glucose' })),
        ...hba1cReadings.map(r => ({ ...r, type: 'HbA1c' }))
      ].sort((a, b) => new Date(b.recordedAt || b.createdAt) - new Date(a.recordedAt || a.createdAt));

      setRecentLogs(allReadings);

      const fastingReadings = glucoseReadings.filter(r => (r.readingContext || '').toLowerCase() === 'fasting');
      if (fastingReadings.length > 0) {
        const avg = Math.round(fastingReadings.reduce((sum, r) => sum + (r.value || 0), 0) / fastingReadings.length);
        setAvgFasting(avg);
      }

      if (hba1cReadings.length > 0) {
        setLatestHba1c(hba1cReadings[0].value);
      }

      const dayMap = {};
      glucoseReadings.slice(0, 30).reverse().forEach(r => {
        const date = new Date(r.recordedAt || r.createdAt);
        const dayKey = date.toLocaleDateString('en-US', { weekday: 'short' });
        if (!dayMap[dayKey]) dayMap[dayKey] = { date: dayKey, fasting: null, preMeal: null, postMeal: null, random: null };
        const ctx = (r.readingContext || '').toLowerCase().replace(/-/g, '');
        if (ctx === 'fasting') dayMap[dayKey].fasting = r.value;
        else if (ctx === 'premeal' || ctx === 'pre meal') dayMap[dayKey].preMeal = r.value;
        else if (ctx === 'postmeal' || ctx === 'post meal') dayMap[dayKey].postMeal = r.value;
        else if (ctx === 'random') dayMap[dayKey].random = r.value;
      });
      setGlucoseChartData(Object.values(dayMap).slice(-7));

      const hba1cChart = hba1cReadings.slice(0, 6).reverse().map(r => ({
        month: new Date(r.recordedAt || r.createdAt).toLocaleDateString('en-US', { month: 'short' }),
        value: r.value
      }));
      setHba1cChartData(hba1cChart);

    } catch (error) {
      console.error('Failed to fetch diabetes data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { invalidateCache } = useData();

  const handleSave = async () => {
    if (!value) return toast.error('Please enter a value');
    setSaving(true);
    try {
      const recordedAt = new Date(`${logDate}T${logTime}:00`).toISOString();
      await api.post('metrics', {
        type: category === 'HbA1c' ? 'hba1c' : 'blood_sugar',
        value: parseFloat(value),
        unit: category === 'HbA1c' ? '%' : 'mg/dL',
        readingContext: category === 'HbA1c' ? 'lab' : glucoseContext.toLowerCase(),
        recordedAt
      });

      // Synchronize changes to main dashboard
      if (invalidateCache) {
        await invalidateCache(['dashboard']);
      }

      toast.success(`${category} reading saved!`);
      setValue('');
      
      // Auto-refresh data and AI insights after logging
      await fetchData();
      fetchAiAnalysis();
    } catch (error) {
      toast.error('Failed to save reading');
    } finally {
      setSaving(false);
    }
  };

  const getLogStatus = (reading) => {
    if (reading.type === 'HbA1c') {
      return reading.value <= 5.7 ? 'excellent' : reading.value <= 6.4 ? 'warning' : 'high';
    }
    const ctx = (reading.readingContext || '').toLowerCase();
    if (ctx === 'fasting') return reading.value <= 99 ? 'good' : reading.value <= 125 ? 'warning' : 'high';
    if (ctx.includes('post')) return reading.value <= 140 ? 'good' : reading.value <= 199 ? 'warning' : 'high';
    return reading.value <= 140 ? 'good' : 'warning';
  };

  const statusColors = {
    excellent: 'bg-[#F0FDF4] text-[#16A34A] border-[#DCFCE7]',
    good: 'bg-[#F0FDF4] text-[#16A34A] border-[#DCFCE7]',
    warning: 'bg-[#FFF8F5] text-[#E88F4A] border-[#F5D6C1]',
    high: 'bg-[#FFF0F0] text-[#EF4444] border-[#FECACA]'
  };

  return (
    <div className={`min-h-screen ${theme.background} ${theme.darkBackground} transition-colors pb-32`}>
      <div className="max-w-[1200px] mx-auto px-4 pt-6 select-none">
        
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.9fr] gap-8">
          
          {/* Left Column: Form and Stats */}
          <div className="flex flex-col gap-6">
            
            {/* Header Titles & Top Stats */}
            <div className="flex flex-col gap-4 mb-2">
              <div className="flex flex-col gap-1">
                <h2 className="text-[32px] font-semibold text-slate-900 dark:text-white tracking-tight leading-none">Diabetes Log</h2>
                <p className="text-[13px] font-semibold text-slate-500 leading-relaxed">Comprehensive tracking for Glucose and HbA1c metrics.</p>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-1 bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-[20px] p-4 flex flex-col justify-center shadow-none">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Avg Fasting</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[24px] font-semibold text-[#69A38D] leading-none">{avgFasting}</span>
                    <span className="text-[12px] font-semibold text-slate-500">mg/dL</span>
                  </div>
                </div>
                <div className="flex-1 bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-[20px] p-4 flex flex-col justify-center shadow-none">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Latest HbA1c</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[24px] font-semibold text-slate-900 dark:text-white leading-none">
                      {latestHba1c}
                    </span>
                    <span className="text-[12px] font-semibold text-slate-500">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Log New Reading Card */}
            <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-[24px] p-4 shadow-none flex flex-col gap-4">
              <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus size={18} className="text-[#69A38D]" strokeWidth={2.5} /> Log New Reading
              </h3>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Category</label>
                  <div className="flex bg-slate-100/50 dark:bg-black/20 p-1 rounded-[16px] shadow-none">
                    {['Glucose', 'HbA1c'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={`flex-1 py-2.5 text-[13px] font-semibold rounded-[12px] transition-all ${
                          category === cat 
                            ? 'bg-white dark:bg-[#2D3A33] text-[#69A38D] dark:text-[#8CC2AB] shadow-none' 
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {category === 'Glucose' && (
                    <div className="grid grid-cols-4 lg:grid-cols-2 gap-2 mt-3">
                      {['Fasting', 'Pre-Meal', 'Post-Meal', 'Random'].map(ctx => (
                        <button
                          key={ctx}
                          onClick={() => setGlucoseContext(ctx)}
                          className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border ${glucoseContext === ctx ? 'bg-[#69A38D] border-[#69A38D] text-white' : 'bg-white/50 border-slate-100 text-slate-400'}`}
                        >
                          {ctx.replace('-Meal', '')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                    Value ({category === 'HbA1c' ? '%' : 'mg/dL'})
                  </label>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    placeholder={`e.g. ${category === 'HbA1c' ? '5.8' : '105'}`}
                    className="w-full bg-white dark:bg-[#111815] border border-white/80 dark:border-white/10 rounded-[16px] px-4 py-3.5 text-[15px] font-semibold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 outline-none focus:border-[#69A38D] transition-all shadow-none"
                  />
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Date</label>
                    <div 
                      onClick={() => dateInputRef.current?.showPicker()}
                      className="w-full bg-white dark:bg-[#111815] border border-white/80 dark:border-white/10 rounded-[16px] px-4 py-3 flex items-center gap-2 shadow-none cursor-pointer group"
                    >
                      <Calendar size={16} className="text-slate-400 group-hover:text-[#69A38D] transition-colors shrink-0" />
                      <input 
                        ref={dateInputRef}
                        type="date" 
                        value={logDate}
                        onChange={(e) => setLogDate(e.target.value)}
                        className="bg-transparent border-none outline-none text-[14px] font-semibold text-slate-700 dark:text-slate-300 w-full cursor-pointer focus:ring-0 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Time</label>
                    <div 
                      onClick={() => timeInputRef.current?.showPicker()}
                      className="w-full bg-white dark:bg-[#111815] border border-white/80 dark:border-white/10 rounded-[16px] px-4 py-3 flex items-center gap-2 shadow-none cursor-pointer group"
                    >
                      <Clock size={16} className="text-slate-400 group-hover:text-[#69A38D] transition-colors shrink-0" />
                      <input 
                        ref={timeInputRef}
                        type="time" 
                        value={logTime}
                        onChange={(e) => setLogTime(e.target.value)}
                        className="bg-transparent border-none outline-none text-[14px] font-semibold text-slate-700 dark:text-slate-300 w-full cursor-pointer focus:ring-0 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute"
                      />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-[#69A38D] hover:bg-[#528270] text-white py-3.5 rounded-[16px] text-[15px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-none mt-1 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} strokeWidth={2.5} />}
                  {saving ? 'Saving...' : 'Save to Log'}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Analytics & History */}
          <div className="flex flex-col gap-6">
            
            {/* Analytics Dashboard Card */}
            <div className={theme.card + " p-6 md:p-8"}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                  <h3 className="text-[18px] font-black text-[#1a2138] dark:text-white uppercase tracking-tight mb-1">Health Trends</h3>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Statistical performance analysis</p>
                </div>
                
                <div className="flex bg-slate-100/50 dark:bg-black/20 p-1 rounded-2xl border border-white/50">
                  <button onClick={() => setActiveChart('glucose')} className={`px-5 py-2 text-[11px] font-black uppercase rounded-xl transition-all ${activeChart === 'glucose' ? 'bg-white dark:bg-[#2D2D2D] text-[#6FAF95] shadow-xs' : 'text-slate-400 hover:text-slate-600'}`}>Daily</button>
                  <button onClick={() => setActiveChart('hba1c')} className={`px-5 py-2 text-[11px] font-black uppercase rounded-xl transition-all ${activeChart === 'hba1c' ? 'bg-white dark:bg-[#2D2D2D] text-[#6FAF95] shadow-xs' : 'text-slate-400 hover:text-slate-600'}`}>HbA1c</button>
                </div>
              </div>

              <div className="h-[300px] w-full">
                {loading ? (
                  <div className="h-full flex items-center justify-center"><Loader2 size={30} className="animate-spin text-slate-100" /></div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    {activeChart === 'glucose' ? (
                      <AreaChart data={glucoseChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorGlucose" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#69A38D" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#69A38D" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.4} />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} 
                          dy={15} 
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} 
                          domain={[60, 185]}
                          ticks={[60, 90, 120, 150, 180]}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', padding: '16px' }}
                          cursor={{ stroke: '#69A38D', strokeWidth: 2, strokeDasharray: '5 5' }}
                        />
                        
                        {/* Reference Lines from Image */}
                        <ReferenceLine 
                          y={140} 
                          stroke="#EF4444" 
                          strokeDasharray="4 4" 
                          opacity={0.3}
                        />
                        <ReferenceLine 
                          y={90} 
                          stroke="#3B82F6" 
                          strokeDasharray="4 4" 
                          opacity={0.3}
                        />

                        <Area 
                          type="monotone" 
                          dataKey="fasting" 
                          stroke="#69A38D" 
                          strokeWidth={3} 
                          fillOpacity={0.1} 
                          fill="#69A38D" 
                          name="Fasting"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="preMeal" 
                          stroke="#3B82F6" 
                          strokeWidth={2.5} 
                          fillOpacity={0.05} 
                          fill="#3B82F6" 
                          name="Pre-Meal"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="postMeal" 
                          stroke="#F59E0B" 
                          strokeWidth={2.5} 
                          fillOpacity={0.05} 
                          fill="#F59E0B" 
                          name="Post-Meal"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="random" 
                          stroke="#8B5CF6" 
                          strokeWidth={2.5} 
                          fillOpacity={0.05} 
                          fill="#8B5CF6" 
                          name="Random"
                        />
                      </AreaChart>
                    ) : (
                      <AreaChart data={hba1cChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorHbA1c" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#69A38D" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#69A38D" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.4} />
                        <XAxis 
                          dataKey="month" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} 
                          dy={15} 
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} 
                          domain={[4, 9.5]}
                          ticks={[4, 5, 6, 7, 8, 9]}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', padding: '16px' }}
                          cursor={{ stroke: '#69A38D', strokeWidth: 2, strokeDasharray: '5 5' }}
                        />
                        
                        {/* Reference Lines for HbA1c */}
                        <ReferenceLine 
                          y={6.5} 
                          stroke="#EF4444" 
                          strokeDasharray="4 4" 
                          opacity={0.3}
                        />
                        <ReferenceLine 
                          y={5.7} 
                          stroke="#3B82F6" 
                          strokeDasharray="4 4" 
                          opacity={0.3}
                        />

                        <Area 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#69A38D" 
                          strokeWidth={3} 
                          fillOpacity={1} 
                          fill="url(#colorHbA1c)" 
                          name="HbA1c %"
                        />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                )}
              </div>

              {/* Chart Legend */}
              <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 mt-12 pt-6 border-t border-slate-100">
                {activeChart === 'glucose' ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#69A38D]" />
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fasting</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#3B82F6]" />
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pre-Meal</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Post-Meal</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#8B5CF6]" />
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Random</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#69A38D]" />
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Latest HbA1c</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="w-3 h-1 bg-[#EF4444]/30 rounded-full" />
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {activeChart === 'glucose' ? 'High (140)' : 'High (6.5%)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Logs Section */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[16px] font-black text-[#1a2138] dark:text-white uppercase tracking-tight flex items-center gap-2">
                  <History size={18} className="text-[#69A38D]" /> Recent Logs
                </h3>
              </div>
              
              <div className="flex flex-col gap-3 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#69A38D]/20">
                {loading ? (
                  <div className="py-12 flex flex-col items-center gap-3">
                    <Loader2 size={24} className="animate-spin text-[#69A38D]" />
                    <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">Loading logs...</p>
                  </div>
                ) : recentLogs.length === 0 ? (
                  <div className={theme.card + " p-8 text-center"}>
                    <p className="text-[13px] font-bold text-slate-400">No logs found yet.</p>
                  </div>
                ) : (
                  recentLogs.map((log, i) => {
                    const status = getLogStatus(log);
                    return (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={log._id || i}
                        className="bg-white/70 dark:bg-[#1A221E]/90 backdrop-blur-md p-4 rounded-3xl border border-white dark:border-white/5 flex items-center justify-between group hover:shadow-md transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-2xl border-2 flex flex-col items-center justify-center ${statusColors[status]}`}>
                            <span className="text-[18px] font-black leading-none">{log.value}</span>
                            <span className="text-[9px] font-black uppercase mt-0.5">{log.type === 'HbA1c' ? '%' : 'mg/dL'}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-black text-[#1a2138] dark:text-white uppercase tracking-tight">{log.type}</span>
                              <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase border ${statusColors[status]}`}>
                                {status === 'good' || status === 'excellent' ? 'Optimal' : status}
                              </span>
                            </div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                              {log.readingContext} • {new Date(log.recordedAt || log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-black/20 p-2 rounded-xl text-slate-300 group-hover:text-[#6FAF95] transition-colors">
                          <ChevronRight size={18} />
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Redesigned AI Insight Card - Teal Background, White text */}
            <div 
              className="mt-2 bg-[#69A38D] dark:bg-[#5B8D7A]/90 rounded-[32px] p-6 md:p-8 border border-white/10 relative transition-all group shadow-lg"
            >
              <div className="relative z-10">
                <div className="flex justify-end mb-4">
                  <button 
                    onClick={fetchAiAnalysis}
                    disabled={analyzingAi}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={analyzingAi ? 'animate-spin' : ''} />
                  </button>
                </div>

                <div className="flex flex-col gap-5">
                  <div className="rounded-2xl">
                    <p className="text-[15px] font-medium text-white/95 leading-relaxed mb-4 border-l-2 border-white/40 pl-4">
                      {analyzingAi ? (
                        <span className="flex items-center gap-2">
                          <Loader2 size={16} className="animate-spin text-white" /> Analyzing your metabolic patterns...
                        </span>
                      ) : (aiInsight || "Syncing your metabolic data...")}
                    </p>
                    
                    {aiFullData?.recommendations?.length > 0 && (
                      <div className="flex flex-col gap-3.5 mt-4">
                        {aiFullData.recommendations.map((rec, idx) => (
                          <div key={idx} className="flex items-start gap-3 w-full">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/60 shrink-0 mt-2" />
                            <span className="text-[14px] font-medium text-white/90 leading-tight w-full">{rec}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {aiFullData?.immediateAction && (
                    <div className="mt-2 pt-5 border-t border-white/10 flex flex-col gap-1 w-full">
                      <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] block">Immediate Step</span>
                      <p className="text-[15px] font-bold text-white leading-tight w-full flex items-center gap-2">
                        <AlertCircle size={14} className="text-white/80" /> {aiFullData.immediateAction}
                      </p>
                    </div>
                  )}
                </div>
                
                {!aiInsight && !analyzingAi && (
                  <button 
                    onClick={fetchAiAnalysis}
                    className="mt-6 px-6 py-3 bg-white text-[#69A38D] rounded-xl text-[13px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors shadow-md"
                  >
                    Generate Analysis
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
