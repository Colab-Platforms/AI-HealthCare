import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Target, Calendar, Clock, Droplet, Loader2
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell
} from 'recharts';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function DiabetesCare() {
  const { user } = useAuth();
  const [activeChart, setActiveChart] = useState('glucose');
  const [readingCategory, setReadingCategory] = useState('Glucose');
  const [glucoseContext, setGlucoseContext] = useState('Fasting');
  const [readingValue, setReadingValue] = useState('');
  const [readingDate, setReadingDate] = useState(new Date().toISOString().split('T')[0]);
  const [readingTime, setReadingTime] = useState(new Date().toTimeString().slice(0, 5));
  const [saving, setSaving] = useState(false);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [loading, setLoading] = useState(true);

  // Real-time data from API
  const [recentLogs, setRecentLogs] = useState([]);
  const [glucoseChartData, setGlucoseChartData] = useState([]);
  const [hba1cChartData, setHba1cChartData] = useState([]);
  const [avgFasting, setAvgFasting] = useState('--');
  const [latestHba1c, setLatestHba1c] = useState('--');
  const [aiInsight, setAiInsight] = useState('');

  const glassCard = "bg-white/80 backdrop-blur-2xl border border-white/50 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)]";

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch glucose readings
      const glucoseRes = await api.get('metrics/blood_sugar', { params: { limit: 50 } });
      const glucoseReadings = glucoseRes.data?.data || glucoseRes.data || [];

      // Fetch HbA1c readings
      const hba1cRes = await api.get('metrics/hba1c', { params: { limit: 20 } });
      const hba1cReadings = hba1cRes.data?.data || hba1cRes.data || [];

      // Build recent logs (last 6 readings combined)
      const allReadings = [
        ...glucoseReadings.map(r => ({ ...r, type: 'Glucose' })),
        ...hba1cReadings.map(r => ({ ...r, type: 'HbA1c' }))
      ].sort((a, b) => new Date(b.recordedAt || b.createdAt) - new Date(a.recordedAt || a.createdAt))
        .slice(0, 6);

      setRecentLogs(allReadings);

      // Average fasting glucose
      const fastingReadings = glucoseReadings.filter(r => (r.readingContext || '').toLowerCase() === 'fasting');
      if (fastingReadings.length > 0) {
        const avg = Math.round(fastingReadings.reduce((sum, r) => sum + (r.value || 0), 0) / fastingReadings.length);
        setAvgFasting(avg);
      }

      // Latest HbA1c
      if (hba1cReadings.length > 0) {
        setLatestHba1c(hba1cReadings[0].value);
      }

      // Build glucose chart data — group by day
      const dayMap = {};
      glucoseReadings.forEach(r => {
        const date = new Date(r.recordedAt || r.createdAt);
        const dayKey = date.toLocaleDateString('en-US', { weekday: 'short' });
        if (!dayMap[dayKey]) dayMap[dayKey] = { date: dayKey, fasting: null, preMeal: null, postMeal: null, random: null };
        const ctx = (r.readingContext || '').toLowerCase().replace(/-/g, '');
        if (ctx === 'fasting') dayMap[dayKey].fasting = r.value;
        else if (ctx === 'premeal' || ctx === 'pre meal') dayMap[dayKey].preMeal = r.value;
        else if (ctx === 'postmeal' || ctx === 'post meal') dayMap[dayKey].postMeal = r.value;
        else if (ctx === 'random') dayMap[dayKey].random = r.value;
      });
      setGlucoseChartData(Object.values(dayMap).slice(0, 7));

      // Build HbA1c chart data
      const hba1cChart = hba1cReadings.slice(0, 6).reverse().map(r => ({
        month: new Date(r.recordedAt || r.createdAt).toLocaleDateString('en-US', { month: 'short' }),
        value: r.value
      }));
      setHba1cChartData(hba1cChart);

      // AI insight is fetched on-demand only (user clicks Analyze button)

    } catch (error) {
      console.error('Failed to fetch diabetes data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchAiAnalysis = async () => {
    setAnalyzingAi(true);
    setAiInsight('');
    try {
      const analysisRes = await api.get('metrics/analysis/glucose');
      const data = analysisRes.data?.data;
      if (data?.insight) {
        setAiInsight(data.insight);
      } else if (data?.recommendations) {
        const recs = data.recommendations;
        if (typeof recs === 'string') setAiInsight(recs);
        else if (recs.immediate || recs.shortTerm || recs.lifestyle) {
          const parts = [];
          if (recs.immediate?.length) parts.push('Immediate: ' + recs.immediate.join('. '));
          if (recs.shortTerm?.length) parts.push('Short-term: ' + recs.shortTerm.join('. '));
          if (recs.lifestyle?.length) parts.push('Lifestyle: ' + recs.lifestyle.join('. '));
          setAiInsight(parts.join(' | ') || JSON.stringify(recs));
        } else {
          setAiInsight(JSON.stringify(recs));
        }
      } else if (data?.status) {
        setAiInsight(`Status: ${data.status}. ${data.statusMessage || ''}`);
      } else {
        setAiInsight('Analysis complete. No specific insights available yet — log more readings for better analysis.');
      }
    } catch (error) {
      console.error('AI analysis error:', error);
      setAiInsight('Could not generate analysis right now. Please try again later.');
    } finally {
      setAnalyzingAi(false);
    }
  };

  const handleSaveReading = async () => {
    if (!readingValue) {
      toast.error('Please enter a value');
      return;
    }
    setSaving(true);
    try {
      const recordedAt = new Date(`${readingDate}T${readingTime}:00`).toISOString();
      await api.post('metrics', {
        type: readingCategory === 'HbA1c' ? 'hba1c' : 'blood_sugar',
        value: parseFloat(readingValue),
        unit: readingCategory === 'HbA1c' ? '%' : 'mg/dL',
        readingContext: readingCategory === 'HbA1c' ? 'lab' : glucoseContext.toLowerCase(),
        recordedAt
      });
      toast.success(`${readingCategory} reading saved!`);
      setReadingValue('');
      // Reset date/time to now
      setReadingDate(new Date().toISOString().split('T')[0]);
      setReadingTime(new Date().toTimeString().slice(0, 5));
      fetchData();
    } catch (error) {
      console.error('Failed to save reading:', error);
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

  const formatLogDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const isYesterday = d.toDateString() === new Date(now - 86400000).toDateString();
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (isToday) return `Today, ${time}`;
    if (isYesterday) return `Yesterday, ${time}`;
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
  };

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-8 relative font-sans bg-transparent">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-light tracking-tight text-[#1a1a1a] mb-2">Diabetes Log</h1>
          <p className="text-[#666666] text-lg">Comprehensive tracking for Glucose and HbA1c metrics.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
            <span className="text-[10px] uppercase tracking-widest font-bold text-[#888888] mb-1">Avg Fasting</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#9583BC]">{avgFasting}</span>
              <span className="text-xs font-bold text-[#a0a0a0]">mg/dL</span>
            </div>
          </div>
          <div className="bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
            <span className="text-[10px] uppercase tracking-widest font-bold text-[#888888] mb-1">Latest HbA1c</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#1a1a1a]">{latestHba1c}</span>
              <span className="text-xs font-bold text-[#a0a0a0]">%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Log Form & Recent History */}
        <div className="lg:col-span-1 space-y-8">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${glassCard} p-6 md:p-8 relative overflow-hidden`}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#9583BC]/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>

            <h3 className="text-xl font-bold text-[#1a1a1a] mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#9583BC]" /> Log New Reading
            </h3>

            <div className="space-y-5 relative z-10">
              <div>
                <label className="block text-xs font-bold text-[#666666] uppercase tracking-wide mb-2">Category</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-[#F5F5F7] rounded-xl border border-white">
                  {['Glucose', 'HbA1c'].map(type => (
                    <button
                      key={type}
                      onClick={() => setReadingCategory(type)}
                      className={`py-2 text-xs font-bold rounded-lg transition-all ${readingCategory === type ? 'bg-white text-[#9583BC] shadow-sm' : 'text-[#888888] hover:text-[#1a1a1a]'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {readingCategory === 'Glucose' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <label className="block text-xs font-bold text-[#666666] uppercase tracking-wide mb-2">Context</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Fasting', 'Pre-Meal', 'Post-Meal', 'Random'].map(context => (
                      <button
                        key={context}
                        onClick={() => setGlucoseContext(context)}
                        className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all mt-1 ${glucoseContext === context ? 'bg-[#9583BC]/10 border-[#9583BC] text-[#9583BC]' : 'bg-white border-slate-200 text-[#888888] hover:border-[#9583BC]/50'}`}
                      >
                        {context}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#666666] uppercase tracking-wide mb-2">Value {readingCategory === 'HbA1c' ? '(%)' : '(mg/dL)'}</label>
                <input
                  type="number"
                  value={readingValue}
                  onChange={(e) => setReadingValue(e.target.value)}
                  placeholder={readingCategory === 'HbA1c' ? 'e.g. 6.1' : 'e.g. 105'}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#9583BC] focus:ring-2 focus:ring-[#E0D4FF] outline-none transition-all bg-white font-medium text-lg placeholder:text-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#666666] uppercase tracking-wide mb-2">Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888888] pointer-events-none" />
                    <input
                      type="date"
                      value={readingDate}
                      onChange={(e) => setReadingDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 bg-white text-[#1a1a1a] text-sm font-medium focus:border-[#9583BC] focus:ring-2 focus:ring-[#E0D4FF] outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#666666] uppercase tracking-wide mb-2">Time</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888888] pointer-events-none" />
                    <input
                      type="time"
                      value={readingTime}
                      onChange={(e) => setReadingTime(e.target.value)}
                      className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 bg-white text-[#1a1a1a] text-sm font-medium focus:border-[#9583BC] focus:ring-2 focus:ring-[#E0D4FF] outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleSaveReading}
                disabled={saving || !readingValue}
                className="w-full py-4 mt-2 bg-[#9583BC] text-white rounded-xl font-bold shadow-lg hover:bg-[#8574ab] transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                {saving ? 'Saving...' : 'Save to Log'}
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`${glassCard} p-6`}
          >
            <h3 className="text-lg font-bold text-[#1a1a1a] mb-4">Recent Logs</h3>
            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#9583BC]" />
                </div>
              ) : recentLogs.length === 0 ? (
                <div className="text-center py-8">
                  <Droplet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-[#888888]">No readings logged yet. Start by adding your first reading above.</p>
                </div>
              ) : (
                recentLogs.map((log, i) => {
                  const status = getLogStatus(log);
                  return (
                    <div key={log._id || i} className="flex items-center justify-between p-3 rounded-[16px] bg-[#F5F5F7]/80 border border-transparent hover:border-slate-200 transition-all cursor-default">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex flex-col items-center justify-center font-black ${status === 'excellent' || status === 'good' ? 'bg-[#F0FDF4] text-[#16A34A]' :
                          status === 'warning' ? 'bg-[#FFF8F5] text-[#FF8A66]' : 'bg-[#FFF0F0] text-[#EF4444]'
                          }`}>
                          <span className="text-sm leading-none">{log.value}</span>
                          <span className="text-[8px] uppercase tracking-wider">{log.type === 'HbA1c' ? '%' : 'mg'}</span>
                        </div>
                        <div>
                          <div className="font-bold text-[#1a1a1a] text-sm">{log.type}</div>
                          <div className="text-xs text-[#888888] font-medium">
                            {log.readingContext || 'Lab'} • {formatLogDate(log.recordedAt || log.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>

        {/* Right Column: Charts */}
        <div className="lg:col-span-2 space-y-8">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`${glassCard} p-6 md:p-8`}
          >
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[#1a1a1a]">Detailed Analytics</h2>
                <p className="text-[#666666] text-sm mt-1">Visualize your trends across different metrics</p>
              </div>

              <div className="flex flex-wrap bg-[#F5F5F7] p-1.5 rounded-2xl md:rounded-full border border-white shadow-sm gap-1">
                <button
                  onClick={() => setActiveChart('glucose')}
                  className={`px-4 py-2 text-sm font-bold rounded-xl md:rounded-full transition-all ${activeChart === 'glucose' ? 'bg-[#9583BC] text-white shadow-sm' : 'text-[#888888] hover:text-[#1a1a1a]'}`}
                >
                  Daily Glucose
                </button>
                <button
                  onClick={() => setActiveChart('hba1c')}
                  className={`px-4 py-2 text-sm font-bold rounded-xl md:rounded-full transition-all ${activeChart === 'hba1c' ? 'bg-[#9583BC] text-white shadow-sm' : 'text-[#888888] hover:text-[#1a1a1a]'}`}
                >
                  HbA1c Trends
                </button>
              </div>
            </div>

            <div className="h-[350px] w-full">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-[#9583BC]" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {activeChart === 'glucose' ? (
                    glucoseChartData.length > 0 ? (
                      <LineChart data={glucoseChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#888888', fontSize: 12, fontWeight: 500 }} dy={10} />
                        <YAxis domain={[60, 180]} axisLine={false} tickLine={false} tick={{ fill: '#888888', fontSize: 12 }} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', fontWeight: 500 }} cursor={{ stroke: '#F5F5F7', strokeWidth: 32 }} />
                        <ReferenceLine y={100} stroke="#16A34A" strokeDasharray="3 3" opacity={0.5} />
                        <ReferenceLine y={140} stroke="#FF8A66" strokeDasharray="3 3" opacity={0.5} />
                        <Line name="Fasting" type="monotone" dataKey="fasting" stroke="#9583BC" strokeWidth={3} dot={{ r: 4, fill: '#9583BC', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} connectNulls />
                        <Line name="Pre-Meal" type="monotone" dataKey="preMeal" stroke="#4FA7C7" strokeWidth={3} dot={{ r: 4, fill: '#4FA7C7', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} connectNulls />
                        <Line name="Post-Meal" type="monotone" dataKey="postMeal" stroke="#FF8A66" strokeWidth={3} dot={{ r: 4, fill: '#FF8A66', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} connectNulls />
                        <Line name="Random" type="monotone" dataKey="random" stroke="#d8cceb" strokeWidth={3} dot={{ r: 4, fill: '#d8cceb', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} connectNulls />
                      </LineChart>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full">
                        <Droplet className="w-10 h-10 text-slate-300 mb-3" />
                        <p className="text-sm text-[#888888]">No glucose readings yet. Log your first reading to see trends.</p>
                      </div>
                    )
                  ) : (
                    hba1cChartData.length > 0 ? (
                      <BarChart data={hba1cChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={48}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#888888', fontSize: 12, fontWeight: 500 }} dy={10} />
                        <YAxis domain={[5, 8]} axisLine={false} tickLine={false} tick={{ fill: '#888888', fontSize: 12 }} tickFormatter={(val) => `${val}%`} />
                        <Tooltip cursor={{ fill: '#F5F5F7' }} contentStyle={{ borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', fontWeight: 500 }} />
                        <ReferenceLine y={6.5} stroke="#FF8A66" strokeDasharray="4 4" label={{ position: 'top', value: 'High Risk (>6.5%)', fill: '#FF8A66', fontSize: 10 }} />
                        <Bar dataKey="value" name="HbA1c %" radius={[6, 6, 6, 6]}>
                          {hba1cChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.value >= 6.5 ? '#FF8A66' : '#9583BC'} />
                          ))}
                        </Bar>
                      </BarChart>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full">
                        <Droplet className="w-10 h-10 text-slate-300 mb-3" />
                        <p className="text-sm text-[#888888]">No HbA1c readings yet. Log a lab result to see trends.</p>
                      </div>
                    )
                  )}
                </ResponsiveContainer>
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-6 mt-8 pt-6 border-t border-slate-100">
              {activeChart === 'glucose' && (
                <>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#9583BC]"></div><span className="text-xs font-bold text-[#666666] uppercase tracking-wider">Fasting</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#4FA7C7]"></div><span className="text-xs font-bold text-[#666666] uppercase tracking-wider">Pre-Meal</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#FF8A66]"></div><span className="text-xs font-bold text-[#666666] uppercase tracking-wider">Post-Meal</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#d8cceb]"></div><span className="text-xs font-bold text-[#666666] uppercase tracking-wider">Random</span></div>
                </>
              )}
              {activeChart === 'hba1c' && (
                <>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-md bg-[#9583BC]"></div><span className="text-xs font-bold text-[#666666] uppercase tracking-wider">Healthy Range</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-md bg-[#FF8A66]"></div><span className="text-xs font-bold text-[#666666] uppercase tracking-wider">High Risk</span></div>
                </>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`${glassCard} p-6 md:p-8 bg-gradient-to-br from-[#9583BC] to-[#715c99] text-white border-none`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold">AI Insight</h3>
                  <button
                    onClick={fetchAiAnalysis}
                    disabled={analyzingAi}
                    className="px-4 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-full transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {analyzingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5" />}
                    {analyzingAi ? 'Analyzing...' : 'Analyze My Trends'}
                  </button>
                </div>
                <p className="text-white/90 leading-relaxed text-sm">
                  {analyzingAi ? 'Analyzing your glucose patterns, food consumption and HbA1c trends...' : (aiInsight || `Tap "Analyze My Trends" to get AI-powered insights on your glucose & HbA1c patterns based on your food intake and logged readings.`)}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
