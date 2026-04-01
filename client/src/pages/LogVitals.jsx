import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, Footprints, Moon, ArrowLeft, Calendar, Save, Plus, Flame, Clock, Sparkles, Loader2, CheckCircle, AlertTriangle, TrendingUp, Activity, RotateCcw } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function LogVitals() {
    const { metric } = useParams();
    const navigate = useNavigate();
    const { user, updateUser } = useAuth();
    const {
        dashboardData,
        fetchDashboard,
        fetchWearable,
        fetchNutrition,
        invalidateCache
    } = useData();

    const validMetrics = ['weight', 'steps', 'sleep'];
    const initialMetric = metric && validMetrics.includes(metric) ? metric : 'weight';

    const [activeTab, setActiveTab] = useState(initialMetric);
    const [value, setValue] = useState('');
    const [sleepHours, setSleepHours] = useState('');
    const [sleepMins, setSleepMins] = useState('');
    // Use local-aware date string for initial state (YYYY-MM-DD)
    const getLocalDateString = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const [date, setDate] = useState(getLocalDateString());
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (metric && validMetrics.includes(metric)) {
            setActiveTab(metric);
        }
    }, [metric]);

    useEffect(() => {
        const loadData = async () => {
            if (!dashboardData) {
                await fetchDashboard();
            }
        };
        loadData();
    }, []);

    // Get data for the SPECIFIC selected date
    const selectedDateItem = useMemo(() => {
        if (!dashboardData?.history) return null;
        return dashboardData.history.find(h => h.date === date);
    }, [dashboardData, date]);

    const history = useMemo(() => {
        if (!dashboardData?.history) return [];
        
        // Find index of selected date to shift the window if needed
        const selectedIdx = dashboardData.history.findIndex(h => h.date === date);
        const todayStr = getLocalDateString();
        const todayIdx = dashboardData.history.findIndex(h => h.date === todayStr);
        
        let end = dashboardData.history.length;
        let start = Math.max(0, end - 7);

        // If selected date is outside the default last 7 days ending today, shift the window
        if (selectedIdx !== -1 && selectedIdx < todayIdx - 3) {
            end = Math.min(dashboardData.history.length, selectedIdx + 4);
            start = Math.max(0, end - 7);
        }

        return dashboardData.history.slice(start, end).map(item => {
            const [year, month, day] = item.date.split('-');
            const localDate = new Date(year, month - 1, day);
            return {
                ...item,
                day: localDate.toLocaleDateString('en-US', { weekday: 'short' }),
                dateFull: item.date,
                isSelected: item.date === date
            };
        });
    }, [dashboardData, date]);

    // Fallback logic for weight: if no entry for selected date, use latest history entry or profile
    const latestHistoryWeight = dashboardData?.history?.slice().reverse().find(h => h.weight > 0)?.weight;
    const currentWeight = selectedDateItem?.weight || latestHistoryWeight || user?.profile?.weight || 72.5;
    
    // Steps and Sleep are 0 if not logged for that specific day
    const currentSteps = selectedDateItem?.steps || 0;
    const currentSleep = selectedDateItem?.sleep || 0;
    
    const currentSleepHrs = Math.floor(currentSleep);
    const currentSleepMins = Math.round((currentSleep - currentSleepHrs) * 60);

    const stepGoal = 10000;
    const sleepGoal = 8;
    const weightGoal = dashboardData?.goals?.weight || user?.nutritionGoal?.weightGoal || 70;

    const [goalInput, setGoalInput] = useState('');
    const [loadingGoal, setLoadingGoal] = useState(false);

    const isToday = useMemo(() => date === getLocalDateString(), [date]);

    useEffect(() => {
        if (activeTab === 'weight') {
            setValue(selectedDateItem?.weight?.toString() || '');
        } else if (activeTab === 'steps') {
            setValue(''); // Don't pre-fill for additive mode
        } else if (activeTab === 'sleep') {
            setSleepHours(''); // Don't pre-fill for additive mode
            setSleepMins('');
        }
    }, [date, activeTab, selectedDateItem]);

    const handleSaveGoal = async () => {
        if (!goalInput) {
            toast.error('Please enter a goal value');
            return;
        }
        
        if (activeTab !== 'weight') {
            toast.error('Only weight goals can be set manually');
            return;
        }

        setLoadingGoal(true);
        try {
            const numValue = Number(goalInput);
            await api.put('nutrition/goals', { weightGoal: numValue });
            
            toast.success('Goal updated successfully');
            setGoalInput('');
            
            // Invalidate cache and reload
            invalidateCache(['dashboard']);
            await fetchDashboard(true);

            // SYNC: Update global user context to sync nutritionGoals immediately
            const { data: userData } = await api.get('auth/profile');
            updateUser(userData);
        } catch (err) {
            toast.error(err.message || 'Failed to update goal');
        } finally {
            setLoadingGoal(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            if (activeTab === 'weight') {
                if (!value) throw new Error('Weight is required');
                await api.post('nutrition/log-weight', { weight: Number(value), notes: 'Manual log', date });
            } else {
                const payload = activeTab === 'steps' ? {
                    deviceType: 'other',
                    isAdditive: isToday,
                    metrics: { steps: Number(value), date }
                } : {
                    deviceType: 'other',
                    isAdditive: isToday,
                    sleepData: { totalSleepMinutes: (Number(sleepHours) * 60) + Number(sleepMins), date }
                };
                
                await api.post(activeTab === 'steps' ? 'wearables/sync' : 'wearables/sleep', payload);
            }

            toast.success(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} logged successfully`);

            // Invalidate and refetch everything related
            invalidateCache(['dashboard', 'wearable', `nutrition_${date}`]);
            await Promise.all([
                fetchDashboard(true),
                fetchWearable(true),
                fetchNutrition(date, true)
            ]);

            // SYNC: Update global user context to sync nutritionGoals immediately if weight was changed
            if (activeTab === 'weight') {
                const { data: userData } = await api.get('auth/profile');
                updateUser(userData);
            }

            setValue('');
            setSleepHours('');
            setSleepMins('');

        } catch (err) {
            toast.error(err.message || 'Failed to log vital');
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: 'weight', label: 'Weight', icon: Scale, color: 'bg-[#C8BFF0]' },
        { id: 'steps', label: 'Steps', icon: Footprints, color: 'bg-[#D4F1A5]' },
        { id: 'sleep', label: 'Sleep', icon: Moon, color: 'bg-[#E2F0FD]' }
    ];

    // AI Insights Logic
    const [insights, setInsights] = useState(null);
    const [insightsLoading, setInsightsLoading] = useState(false);
    const [insightsTab, setInsightsTab] = useState(null);

    const fetchInsights = async (metricType, force = false) => {
        if (insightsLoading) return;
        setInsightsLoading(true);
        if (force) setInsights(null); 
        setInsightsTab(metricType);
        try {
            const url = `health/vitals-insights/${metricType}${force ? '?refresh=true' : ''}`;
            const { data } = await api.get(url);
            setInsights(data.insights);
        } catch (err) {
            toast.error('Failed to get AI insights');
            console.error(err);
        } finally {
            setInsightsLoading(false);
        }
    };

    useEffect(() => {
        fetchInsights(activeTab);
    }, [activeTab]);

    const InsightsCard = ({ metricType, color }) => {
        const getStatusColor = (status) => {
            if (!status) return 'bg-slate-50 text-slate-700 border-slate-200';
            const lower = status.toLowerCase();
            if (lower.includes('track') || lower.includes('great') || lower.includes('excellent') || lower.includes('on')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            if (lower.includes('attention') || lower.includes('concern') || lower.includes('needs')) return 'bg-amber-50 text-amber-700 border-amber-100';
            return 'bg-indigo-50 text-indigo-700 border-indigo-100';
        };

        return (
            <div className="p-6 md:p-8 bg-white/40 backdrop-blur-xl rounded-[32px] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] mt-8 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-100/20 to-indigo-100/20 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 relative z-10">
                    <div className="flex items-center gap-3.5">
                        <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center shadow-inner`}>
                            <Sparkles className="w-6 h-6 text-[#1a1a1a]" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-bold text-[#1a1a1a]">AI Coach</h3>
                                {insights && (
                                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-sm ${getStatusColor(insights.status)}`}>
                                        {insights.status}
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Vitals Analysis</p>
                        </div>
                    </div>
                    
                    {insights && (
                        <button
                            onClick={() => fetchInsights(metricType, true)}
                            disabled={insightsLoading}
                            className="p-2.5 bg-white/80 hover:bg-white text-slate-600 rounded-xl border border-slate-100 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                            title="Refresh Analysis"
                        >
                            <RotateCcw className={`w-4 h-4 ${insightsLoading ? 'animate-spin' : ''}`} />
                        </button>
                    )}
                </div>

                <div className="min-h-[120px] relative z-10">
                    {insightsLoading && !insights ? (
                        <div className="text-center py-12">
                            <div className="relative w-12 h-12 mx-auto mb-6">
                                <div className="absolute inset-0 border-3 border-indigo-100 rounded-full"></div>
                                <div className="absolute inset-0 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest animate-pulse">Deep Analysis in progress...</p>
                        </div>
                    ) : insights ? (
                        <motion.div 
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-8"
                        >
                            <div className="relative">
                                <div className="absolute -left-4 top-0 bottom-0 w-1 bg-indigo-500 rounded-full opacity-30"></div>
                                <p className="text-base md:text-lg text-slate-700 leading-snug font-medium italic">
                                    "{insights.analysis}"
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="h-px flex-1 bg-slate-100"></div>
                                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Next Steps</h4>
                                    <div className="h-px flex-1 bg-slate-100"></div>
                                </div>
                                
                                <div className="flex flex-wrap gap-2.5">
                                    {insights.recommendations?.map((rec, i) => (
                                        <div key={i} className="flex items-center gap-2 px-4 py-2.5 bg-white/60 hover:bg-white border border-slate-100/80 rounded-2xl shadow-sm transition-all hover:shadow-md cursor-default group">
                                            <div className="w-2 h-2 rounded-full bg-emerald-400 group-hover:scale-125 transition-transform" />
                                            <p className="text-xs text-slate-600 font-bold">{rec}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 flex items-center justify-between border-t border-slate-50">
                                <p className="text-[10px] font-bold text-indigo-600 tracking-wide bg-indigo-50/50 px-3 py-1 rounded-lg">
                                    {insights.encouragement}
                                </p>
                                {insights.lastUpdated && (
                                    <p className="text-[9px] text-slate-300 font-medium">
                                        Updated {new Date(insights.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        <div className="text-center py-10 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                                <Sparkles className="w-6 h-6 text-indigo-400" />
                            </div>
                            <p className="text-sm text-slate-500 mb-6 font-semibold px-6">Ready to decode your {metricType} patterns?</p>
                            <button
                                onClick={() => fetchInsights(metricType)}
                                disabled={insightsLoading}
                                className="px-8 py-3.5 bg-[#1a1a1a] text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl active:scale-[0.98] disabled:opacity-50 flex items-center gap-2 mx-auto"
                            >
                                <Sparkles className="w-4 h-4 text-purple-300" />
                                Generate Insights
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-full bg-transparent px-4 md:px-8 pt-0 md:pt-8 font-sans relative">
            <div className="max-w-[1000px] mx-auto relative z-10 space-y-4 md:space-y-8">

                {/* Content Card */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/80 backdrop-blur-xl rounded-[32px] p-6 md:p-8 border border-white/50 shadow-[0_4px_24px_rgba(0,0,0,0.02)]"
                >
                    {/* Tabs */}
                    <div className="flex bg-[#F5F5F7] p-1 rounded-full border border-white shadow-sm w-full mb-4 md:mb-8">
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 md:gap-2 px-2 md:px-6 py-2.5 md:py-3 rounded-full text-xs md:text-sm font-medium transition-all whitespace-nowrap relative ${isActive ? 'text-[#1a1a1a] shadow-sm bg-white' : 'text-[#666666] hover:text-[#1a1a1a]'
                                        }`}
                                >
                                    <Icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${isActive ? 'text-[#1a1a1a]' : 'text-[#888888]'}`} />
                                    <span className="capitalize">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Content Area */}
                    <div className="py-2 md:py-4">
                        <AnimatePresence mode="wait">

                            {activeTab === 'weight' && (
                                <motion.div
                                    key="weight"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-8"
                                >
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                                        {/* Left Column - Current Status */}
                                        <div className="flex flex-col items-center justify-center p-6 md:p-8 bg-white/60 backdrop-blur-md rounded-[32px] border border-white shadow-sm relative overflow-hidden">
                                            <div className="absolute top-6 right-6 flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-[#C8BFF0] animate-pulse"></div>
                                                <span className="text-[10px] font-bold text-[#888888] tracking-widest uppercase">{date === getLocalDateString() ? 'LIVE' : 'SELECTED'}</span>
                                            </div>

                                            <div className="text-center mb-8 mt-2">
                                                <h2 className="text-2xl md:text-3xl font-light text-[#1a1a1a]">
                                                    Weight on <span className="font-semibold text-[#1a1a1a]">{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>: <span className="font-semibold text-[#1a1a1a]">{currentWeight} kg</span>
                                                </h2>
                                            </div>

                                            <div className="relative w-48 h-48 flex items-center justify-center mb-8 bg-[#F5F5F7]/50 rounded-full border border-white border-dashed">
                                                <div className="text-center z-10">
                                                    <div className="w-12 h-12 bg-[#C8BFF0] rounded-full mx-auto flex items-center justify-center mb-3 shadow-sm border border-white">
                                                        <Scale className="w-6 h-6 text-[#1a1a1a]" />
                                                    </div>
                                                    <div className="text-5xl font-bold text-[#1a1a1a] tracking-tight">{currentWeight}</div>
                                                    <div className="text-[11px] font-bold text-[#888888] uppercase tracking-widest mt-2">KILOGRAMS</div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 w-full gap-4 pt-8 border-t border-slate-100/60 mt-4">
                                                <div className="text-center">
                                                    <div className="text-xs font-bold text-[#888888] mb-1.5 uppercase tracking-wider">Goal</div>
                                                    <div className="text-2xl font-medium text-[#1a1a1a]">{weightGoal} <span className="text-sm text-[#888888] font-normal">kg</span></div>
                                                </div>
                                                <div className="text-center border-l border-r border-slate-100/60">
                                                    <div className="text-xs font-bold text-[#888888] mb-1.5 uppercase tracking-wider">Progress</div>
                                                    <div className="text-2xl font-medium text-[#1a1a1a]">{(currentWeight - weightGoal).toFixed(1)} <span className="text-sm text-[#888888] font-normal">kg</span></div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-xs font-bold text-[#888888] mb-1.5 uppercase tracking-wider">BMI</div>
                                                    <div className="text-2xl font-medium text-[#1a1a1a]">23.4</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Column - Weekly Chart & Log Form */}
                                        <div className="flex flex-col gap-6">

                                            <div className="p-6 md:p-8 bg-[#F5F5F7]/50 rounded-[32px] border border-white border-dashed">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                                                        <Plus className="w-4 h-4 text-[#1a1a1a]" />
                                                    </div>
                                                    <h4 className="font-medium text-[#1a1a1a]">Log Weight</h4>
                                                </div>
                                                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
                                                    <div className="flex-1 w-full space-y-2">
                                                        <label className="text-[10px] font-bold text-[#888888] uppercase tracking-wider ml-2">Weight (kg)</label>
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            value={value}
                                                            onChange={(e) => setValue(e.target.value)}
                                                            placeholder="E.g., 72.5"
                                                            className="w-full bg-white border border-slate-200 rounded-xl md:rounded-full px-5 py-3 shadow-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#C8BFF0] transition-all font-medium"
                                                        />
                                                    </div>
                                                    <div className="flex-1 w-full space-y-2">
                                                        <label className="text-[10px] font-bold text-[#888888] uppercase tracking-wider ml-2">Date</label>
                                                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl md:rounded-full px-4 py-3 shadow-sm">
                                                            <Calendar className="w-4 h-4 text-slate-400" />
                                                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-transparent text-[#1a1a1a] outline-none text-sm font-medium" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleSave}
                                                    disabled={loading}
                                                    className="w-full mt-6 py-4 bg-[#4A2B8C]/70 backdrop-blur-md border border-[#4A2B8C]/20 text-white rounded-full font-medium transition-all shadow-xl hover:bg-[#4A2B8C]/90 flex items-center justify-center gap-2 group disabled:opacity-50"
                                                >
                                                    {loading ? (
                                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <>
                                                            <Save className="w-5 h-5 group-hover:scale-110 transition-transform" /> Save Weight
                                                        </>
                                                    )}
                                                </button>
                                            </div>

                                            <div className="p-6 md:p-8 bg-[#F5F5F7]/50 rounded-[32px] border border-white border-dashed">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                                                        <Flame className="w-4 h-4 text-[#1a1a1a]" />
                                                    </div>
                                                    <h4 className="font-medium text-[#1a1a1a]">Set Target Goal</h4>
                                                </div>
                                                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
                                                    <div className="flex-1 w-full space-y-2">
                                                        <label className="text-[10px] font-bold text-[#888888] uppercase tracking-wider ml-2">Target Weight (kg)</label>
                                                        <input
                                                            type="number"
                                                            value={goalInput}
                                                            onChange={(e) => setGoalInput(e.target.value)}
                                                            placeholder={`Current: ${weightGoal}`}
                                                            className="w-full bg-white border border-slate-200 rounded-xl md:rounded-full px-5 py-3 shadow-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#C8BFF0] transition-all font-medium"
                                                        />
                                                    </div>
                                                    <button 
                                                        onClick={handleSaveGoal}
                                                        disabled={loadingGoal || !goalInput}
                                                        className="w-full sm:w-auto mt-4 sm:mt-0 px-8 py-3 bg-[#1a1a1a] text-white rounded-xl md:rounded-full font-bold shadow-lg hover:-translate-y-0.5 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                                                    >
                                                        {loadingGoal ? <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span> : 'Set Target'}
                                                    </button>
                                                </div>
                                            </div>

                                        </div>
                                    </div>

                                    <div className="p-6 md:p-8 bg-white/60 backdrop-blur-md rounded-[32px] border border-white shadow-sm flex-1 flex flex-col mt-8">
                                        <div className="flex justify-between items-center mb-8">
                                            <h3 className="text-xl font-medium text-[#1a1a1a]">Trend</h3>
                                            <span className="px-4 py-1.5 bg-[#F5F5F7] text-[#666666] text-[10px] font-bold uppercase tracking-widest rounded-full border border-slate-100">Last 7 Days</span>
                                        </div>

                                        <div className="w-full min-h-[250px] relative">
                                            {history && history.length > 0 ? (
                                                <ResponsiveContainer width="100%" height={250}>
                                                    <LineChart data={history} margin={{ top: 10, right: 45, left: -20, bottom: 0 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                                        <XAxis
                                                            dataKey="day"
                                                            axisLine={false}
                                                            tickLine={false}
                                                            tick={{ fill: '#888888', fontSize: 11, fontWeight: 500 }}
                                                            dy={10}
                                                            height={40}
                                                        />
                                                        <YAxis
                                                            axisLine={false}
                                                            tickLine={false}
                                                            tick={{ fill: '#888888', fontSize: 11 }}
                                                            domain={[
                                                                (dataMin) => Math.min(isFinite(dataMin) ? dataMin : (weightGoal || 70), weightGoal || 70) - 3, 
                                                                (dataMax) => Math.max(isFinite(dataMax) ? dataMax : (weightGoal || 70), weightGoal || 70) + 3
                                                            ]}
                                                            tickFormatter={(val) => `${val}`}
                                                            width={40}
                                                        />
                                                        <Tooltip
                                                            cursor={{ stroke: '#F5F5F7', strokeWidth: 2 }}
                                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                                                            formatter={(value) => [value + ' kg', 'Weight']}
                                                        />
                                                        <ReferenceLine y={weightGoal} stroke="#FF6B6B" strokeDasharray="6 6" strokeWidth={2} label={{ value: `Goal`, position: 'right', fill: '#FF6B6B', fontSize: 10, fontWeight: 'bold', dx: 5 }} />
                                                        <Line
                                                            type="monotone"
                                                            dataKey="weight"
                                                            stroke="#4A2B8C"
                                                            strokeWidth={3}
                                                            dot={{ r: 4, fill: '#4A2B8C', strokeWidth: 2, stroke: '#fff' }}
                                                            activeDot={{ r: 6, fill: '#4A2B8C', strokeWidth: 2, stroke: '#fff' }}
                                                        />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="h-[250px] flex items-center justify-center text-slate-400 text-sm font-medium italic">No historical data available</div>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap justify-center gap-6 mt-6 pt-6 border-t border-slate-100/60">
                                            <div className="flex items-center gap-2"><div className="w-4 h-0 border-t-2 border-solid border-[#4A2B8C]"></div><span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Weight</span></div>
                                            <div className="flex items-center gap-2"><div className="w-4 h-0 border-t-2 border-dashed border-[#FF6B6B]"></div><span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Target ({weightGoal}kg)</span></div>
                                        </div>
                                    </div>

                                    {/* AI Insights Card for Weight */}
                                    <InsightsCard metricType="weight" color="bg-[#C8BFF0]" />
                                </motion.div>
                            )}

                            {activeTab === 'steps' && (
                                <motion.div
                                    key="steps"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-8"
                                >
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">

                                        <div className="flex flex-col items-center justify-center p-6 md:p-8 bg-white/60 backdrop-blur-md rounded-[32px] border border-white shadow-sm relative overflow-hidden">
                                            <div className="absolute top-6 right-6 flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-[#D4F1A5] animate-pulse"></div>
                                                <span className="text-[10px] font-bold text-[#888888] tracking-widest uppercase">{date === getLocalDateString() ? 'LIVE' : 'SELECTED'}</span>
                                            </div>

                                            <div className="text-center mb-8 mt-2">
                                                <h2 className="text-2xl md:text-3xl font-light text-[#1a1a1a]">
                                                    Steps on <span className="font-semibold text-[#1a1a1a]">{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>: <span className="font-semibold text-[#1a1a1a]">{currentSteps.toLocaleString()}</span>
                                                </h2>
                                            </div>

                                            <div className="relative w-[280px] h-[160px] flex items-end justify-center mb-8">
                                                <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 280 150">
                                                    <path
                                                        d="M 20 140 A 120 120 0 0 1 260 140"
                                                        fill="none"
                                                        stroke="#F5F5F7"
                                                        strokeWidth="24"
                                                        strokeLinecap="round"
                                                    />
                                                    <path
                                                        d="M 20 140 A 120 120 0 0 1 260 140"
                                                        fill="none"
                                                        stroke="#D4F1A5"
                                                        strokeWidth="24"
                                                        strokeLinecap="round"
                                                        strokeDasharray={120 * Math.PI}
                                                        strokeDashoffset={120 * Math.PI * (1 - Math.min(currentSteps / stepGoal, 1))}
                                                        className="transition-all duration-1000 ease-out"
                                                    />
                                                </svg>

                                                <div className="text-center z-10 pb-2">
                                                    <div className="w-12 h-12 bg-[#D4F1A5] rounded-full mx-auto flex items-center justify-center mb-3 shadow-sm border border-white">
                                                        <Footprints className="w-6 h-6 text-[#1a1a1a]" />
                                                    </div>
                                                    <div className="text-5xl font-bold text-[#1a1a1a] tracking-tight">{currentSteps.toLocaleString()}</div>
                                                    <div className="text-[11px] font-bold text-[#888888] uppercase tracking-widest mt-2 text-center flex flex-col">
                                                        <span>OF {stepGoal.toLocaleString()} STEPS</span>
                                                        <span className="text-[9px] mt-0.5 opacity-60">Daily Goal</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 w-full gap-4 pt-8 border-t border-slate-100/60 mt-4">
                                                <div className="text-center">
                                                    <div className="text-xs font-bold text-[#888888] mb-1.5 uppercase tracking-wider">Calories</div>
                                                    <div className="text-2xl font-medium text-[#1a1a1a]">{Math.round(currentSteps * 0.04)} <span className="text-sm text-[#888888] font-normal">kcal</span></div>
                                                </div>
                                                <div className="text-center border-l border-r border-slate-100/60">
                                                    <div className="text-xs font-bold text-[#888888] mb-1.5 uppercase tracking-wider">Distance</div>
                                                    <div className="text-2xl font-medium text-[#1a1a1a]">{(currentSteps * 0.00076).toFixed(1)} <span className="text-sm text-[#888888] font-normal">km</span></div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-xs font-bold text-[#888888] mb-1.5 uppercase tracking-wider">Goal</div>
                                                    <div className="text-2xl font-medium text-[#1a1a1a]">{stepGoal >= 1000 ? `${(stepGoal / 1000).toFixed(1)}k` : stepGoal}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-6">

                                            <div className={`p-6 md:p-8 rounded-[32px] border border-white border-dashed ${isToday ? 'bg-[#F5F5F7]/50' : 'bg-slate-50/50 grayscale-[0.5] opacity-80 cursor-not-allowed'}`}>
                                                 <div className="flex items-center gap-3 mb-4">
                                                     <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                                                         <Plus className={`w-4 h-4 ${isToday ? 'text-[#1a1a1a]' : 'text-slate-400'}`} />
                                                     </div>
                                                     <h4 className={`font-medium ${isToday ? 'text-[#1a1a1a]' : 'text-slate-500'}`}>{isToday ? 'Add Steps' : 'Log Steps'}</h4>
                                                     {currentSteps > 0 && <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-slate-200 text-slate-500 shrink-0 ml-1">Total: {currentSteps.toLocaleString()}</span>}
                                                     {!isToday && <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 shrink-0">Read Only</span>}
                                                 </div>
                                                 <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
                                                     <div className="flex-1 w-full space-y-2">
                                                         <label className="text-[10px] font-bold text-[#888888] uppercase tracking-wider ml-2">Steps to Add</label>
                                                         <input
                                                             type="number"
                                                             value={value}
                                                             disabled={!isToday}
                                                             onChange={(e) => setValue(e.target.value)}
                                                             placeholder={isToday ? "E.g., 500" : "N/A"}
                                                             className="w-full bg-white border border-slate-200 rounded-xl md:rounded-full px-5 py-3 shadow-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#D4F1A5] transition-all font-medium disabled:bg-slate-100 disabled:text-slate-400"
                                                         />
                                                     </div>
                                                     <div className="flex-1 w-full space-y-2">
                                                         <label className="text-[10px] font-bold text-[#888888] uppercase tracking-wider ml-2">Date</label>
                                                         <div className={`flex items-center gap-2 bg-white border border-slate-200 rounded-xl md:rounded-full px-4 py-3 shadow-sm ${!isToday ? 'bg-white/50' : ''}`}>
                                                             <Calendar className="w-4 h-4 text-slate-400" />
                                                             <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-transparent text-[#1a1a1a] outline-none text-sm font-medium" />
                                                         </div>
                                                     </div>
                                                 </div>
                                                 
                                                 {!isToday && (
                                                     <p className="mt-4 text-[10px] font-bold text-slate-400 italic text-center">Note: Historical steps cannot be edited manually. Please select today to log.</p>
                                                 )}

                                                 <button
                                                     onClick={handleSave}
                                                     disabled={loading || !isToday}
                                                     className={`w-full mt-6 py-4 rounded-full font-medium transition-all shadow-xl flex items-center justify-center gap-2 group ${
                                                         !isToday 
                                                         ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                                                         : 'bg-[#4A8C2B]/80 backdrop-blur-md border border-[#4A8C2B]/20 text-white hover:bg-[#4A8C2B]'
                                                     }`}
                                                 >
                                                         {loading ? (
                                                             <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                         ) : (
                                                             <>
                                                                 <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" /> Add Steps
                                                             </>
                                                         )}
                                                     </button>
                                             </div>


                                        </div>
                                    </div>

                                    <div className="p-6 md:p-8 bg-white/60 backdrop-blur-md rounded-[32px] border border-white shadow-sm flex-1 flex flex-col mt-8">
                                        <div className="flex justify-between items-center mb-8">
                                            <h3 className="text-xl font-medium text-[#1a1a1a]">Weekly Progress</h3>
                                            <span className="px-4 py-1.5 bg-[#F5F5F7] text-[#666666] text-[10px] font-bold uppercase tracking-widest rounded-full border border-slate-100">Last 7 Days</span>
                                        </div>

                                        <div className="w-full min-h-[250px] relative">
                                            {history && history.length > 0 ? (
                                                <ResponsiveContainer width="100%" height={250}>
                                                    <LineChart data={history} margin={{ top: 10, right: 45, left: -10, bottom: 0 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                                        <XAxis
                                                            dataKey="day"
                                                            axisLine={false}
                                                            tickLine={false}
                                                            tick={{ fill: '#888888', fontSize: 11, fontWeight: 500 }}
                                                            dy={10}
                                                            height={40}
                                                        />
                                                        <YAxis
                                                            axisLine={false}
                                                            tickLine={false}
                                                            tick={{ fill: '#888888', fontSize: 11 }}
                                                            tickFormatter={(val) => val === 0 ? '0' : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                                                            width={45}
                                                            domain={[0, (dataMax) => Math.max(isFinite(dataMax) ? dataMax : stepGoal, stepGoal) * 1.15]}
                                                        />
                                                        <Tooltip
                                                            cursor={{ stroke: '#F5F5F7', strokeWidth: 2 }}
                                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                                                            formatter={(value) => [value.toLocaleString() + ' steps', 'Steps']}
                                                        />
                                                        <ReferenceLine y={stepGoal} stroke="#FF6B6B" strokeDasharray="6 6" strokeWidth={2} label={{ value: `Goal`, position: 'right', fill: '#FF6B6B', fontSize: 10, fontWeight: 'bold', dx: 5 }} />
                                                        <Line
                                                            type="monotone"
                                                            dataKey="steps"
                                                            stroke="#4A8C2B"
                                                            strokeWidth={3}
                                                            dot={{ r: 4, fill: '#D4F1A5', strokeWidth: 2, stroke: '#4A8C2B' }}
                                                            activeDot={{ r: 6, fill: '#D4F1A5', strokeWidth: 2, stroke: '#4A8C2B' }}
                                                        />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="h-[250px] flex items-center justify-center text-slate-400 text-sm font-medium italic">No historical data available</div>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap justify-center gap-6 mt-6 pt-6 border-t border-slate-100/60">
                                            <div className="flex items-center gap-2"><div className="w-4 h-0 border-t-2 border-solid border-[#4A8C2B]"></div><span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Steps</span></div>
                                            <div className="flex items-center gap-2"><div className="w-4 h-0 border-t-2 border-dashed border-[#FF6B6B]"></div><span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Goal ({stepGoal >= 1000 ? (stepGoal/1000).toFixed(0)+'k' : stepGoal})</span></div>
                                        </div>
                                    </div>

                                    {/* AI Insights Card for Steps */}
                                    <InsightsCard metricType="steps" color="bg-[#D4F1A5]" />
                                </motion.div>
                            )}

                            {activeTab === 'sleep' && (
                                <motion.div
                                    key="sleep"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-8"
                                >
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">

                                        <div className="flex flex-col items-center justify-center p-6 md:p-8 bg-white/60 backdrop-blur-md rounded-[32px] border border-white shadow-sm relative overflow-hidden">
                                            <div className="absolute top-6 right-6 flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-[#E2F0FD] animate-pulse"></div>
                                                <span className="text-[10px] font-bold text-[#888888] tracking-widest uppercase">{date === getLocalDateString() ? 'LIVE' : 'SELECTED'}</span>
                                            </div>

                                            <div className="text-center mb-8 mt-2">
                                                <h2 className="text-2xl md:text-3xl font-light text-[#1a1a1a]">
                                                    Sleep on <span className="font-semibold text-[#1a1a1a]">{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>: <span className="font-semibold text-[#1a1a1a]">{currentSleepHrs}h {currentSleepMins}m</span>
                                                </h2>
                                            </div>

                                            <div className="relative w-[280px] h-[160px] flex items-end justify-center mb-8">
                                                <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 280 150">
                                                    <path
                                                        d="M 20 140 A 120 120 0 0 1 260 140"
                                                        fill="none"
                                                        stroke="#F5F5F7"
                                                        strokeWidth="24"
                                                        strokeLinecap="round"
                                                    />
                                                    <path
                                                        d="M 20 140 A 120 120 0 0 1 260 140"
                                                        fill="none"
                                                        stroke="#E2F0FD"
                                                        strokeWidth="24"
                                                        strokeLinecap="round"
                                                        strokeDasharray={120 * Math.PI}
                                                        strokeDashoffset={120 * Math.PI * (1 - Math.min(currentSleep / sleepGoal, 1))}
                                                        className="transition-all duration-1000 ease-out"
                                                    />
                                                </svg>

                                                <div className="text-center z-10 pb-2">
                                                    <div className="w-12 h-12 bg-[#E2F0FD] rounded-full mx-auto flex items-center justify-center mb-3 shadow-sm border border-white">
                                                        <Moon className="w-6 h-6 text-[#1a1a1a]" />
                                                    </div>
                                                    <div className="text-5xl font-bold text-[#1a1a1a] tracking-tight">{currentSleep.toFixed(1)}</div>
                                                    <div className="text-[11px] font-bold text-[#888888] uppercase tracking-widest mt-2">HOURS</div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 w-full gap-4 pt-8 border-t border-slate-100/60 mt-4">
                                                <div className="text-center">
                                                    <div className="text-xs font-bold text-[#888888] mb-1.5 uppercase tracking-wider">Deep</div>
                                                    <div className="text-2xl font-medium text-[#1a1a1a]">{Math.floor(currentSleep * 0.3)}h <span className="text-sm text-[#888888] font-normal">{Math.round((currentSleep * 0.3 % 1) * 60)}m</span></div>
                                                </div>
                                                <div className="text-center border-l border-r border-slate-100/60">
                                                    <div className="text-xs font-bold text-[#888888] mb-1.5 uppercase tracking-wider">Quality</div>
                                                    <div className="text-2xl font-medium text-[#1a1a1a]">85%</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-xs font-bold text-[#888888] mb-1.5 uppercase tracking-wider">Goal</div>
                                                    <div className="text-2xl font-medium text-[#1a1a1a]">{sleepGoal}h</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-6">

                                            <div className={`p-6 md:p-8 rounded-[32px] border border-white border-dashed ${isToday ? 'bg-[#F5F5F7]/50' : 'bg-slate-50/50 grayscale-[0.5] opacity-80 cursor-not-allowed'}`}>
                                                <div className="flex items-center gap-3 mb-4">
                                                     <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                                                         <Plus className={`w-4 h-4 ${isToday ? 'text-[#1a1a1a]' : 'text-slate-400'}`} />
                                                     </div>
                                                     <h4 className={`font-medium ${isToday ? 'text-[#1a1a1a]' : 'text-slate-500'}`}>{isToday ? 'Add Sleep' : 'Log Sleep'}</h4>
                                                     {currentSleep > 0 && <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-slate-200 text-slate-500 shrink-0 ml-1">Current: {currentSleep.toFixed(1)} hrs</span>}
                                                     {!isToday && <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 shrink-0">Read Only</span>}
                                                 </div>
                                                 <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
                                                     <div className="flex flex-1 gap-2 w-full sm:w-auto">
                                                         <div className="flex-1 space-y-2">
                                                             <label className="text-[10px] font-bold text-[#888888] uppercase tracking-wider ml-2">Hrs to Add</label>
                                                             <input
                                                                 type="number"
                                                                 value={sleepHours}
                                                                 disabled={!isToday}
                                                                 onChange={(e) => setSleepHours(e.target.value)}
                                                                 placeholder={isToday ? "Hrs" : "N/A"}
                                                                 max="24" min="0"
                                                                 className="w-full bg-white border border-slate-200 rounded-xl md:rounded-full px-5 py-3 shadow-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#E2F0FD] transition-all font-medium disabled:bg-slate-100 disabled:text-slate-400"
                                                             />
                                                         </div>
                                                         <div className="flex-1 space-y-2">
                                                             <label className="text-[10px] font-bold text-[#888888] uppercase tracking-wider ml-2">Mins to Add</label>
                                                             <input
                                                                 type="number"
                                                                 value={sleepMins}
                                                                 disabled={!isToday}
                                                                 onChange={(e) => setSleepMins(e.target.value)}
                                                                 placeholder={isToday ? "Min" : "N/A"}
                                                                 max="59" min="0"
                                                                 className="w-full bg-white border border-slate-200 rounded-xl md:rounded-full px-5 py-3 shadow-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#E2F0FD] transition-all font-medium disabled:bg-slate-100 disabled:text-slate-400"
                                                             />
                                                         </div>
                                                     </div>
                                                    <div className="flex-1 space-y-2 w-full sm:w-auto">
                                                        <label className="text-[10px] font-bold text-[#888888] uppercase tracking-wider ml-2">Date</label>
                                                        <div className={`flex items-center gap-2 bg-white border border-slate-200 rounded-xl md:rounded-full px-4 py-3 shadow-sm ${!isToday ? 'bg-white/50' : ''}`}>
                                                            <Calendar className="w-4 h-4 text-slate-400" />
                                                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-transparent text-[#1a1a1a] outline-none text-sm font-medium" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {!isToday && (
                                                     <p className="mt-4 text-[10px] font-bold text-slate-400 italic text-center">Note: Historical sleep data cannot be edited manually. Please select today to log.</p>
                                                 )}

                                                 <button
                                                     onClick={handleSave}
                                                     disabled={loading || !isToday}
                                                     className={`w-full mt-6 py-4 rounded-full font-medium transition-all shadow-xl flex items-center justify-center gap-2 group ${
                                                         !isToday 
                                                         ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                                                         : 'bg-[#75AADB]/80 backdrop-blur-md border border-[#75AADB]/20 text-white hover:bg-[#75AADB]'
                                                     }`}
                                                 >
                                                     {loading ? (
                                                         <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                     ) : (
                                                         <>
                                                             <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" /> Add Sleep
                                                         </>
                                                     )}
                                                 </button>
                                            </div>


                                        </div>
                                    </div>

                                    <div className="p-6 md:p-8 bg-white/60 backdrop-blur-md rounded-[32px] border border-white shadow-sm flex-1 flex flex-col mt-8">
                                        <div className="flex justify-between items-center mb-8">
                                            <h3 className="text-xl font-medium text-[#1a1a1a]">Weekly Sleep</h3>
                                            <span className="px-4 py-1.5 bg-[#F5F5F7] text-[#666666] text-[10px] font-bold uppercase tracking-widest rounded-full border border-slate-100">Last 7 Days</span>
                                        </div>

                                        <div className="w-full min-h-[250px] relative">
                                            {history && history.length > 0 ? (
                                                <ResponsiveContainer width="100%" height={250}>
                                                    <LineChart data={history} margin={{ top: 10, right: 45, left: -20, bottom: 0 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                                        <XAxis
                                                            dataKey="day"
                                                            axisLine={false}
                                                            tickLine={false}
                                                            tick={{ fill: '#888888', fontSize: 11, fontWeight: 500 }}
                                                            dy={10}
                                                            height={40}
                                                        />
                                                        <YAxis
                                                            axisLine={false}
                                                            tickLine={false}
                                                            tick={{ fill: '#888888', fontSize: 11 }}
                                                            domain={[0, (dataMax) => Math.max(isFinite(dataMax) ? dataMax : sleepGoal, sleepGoal) + 2]}
                                                            tickFormatter={(val) => `${val}h`}
                                                            width={45}
                                                        />
                                                        <Tooltip
                                                            cursor={{ stroke: '#F5F5F7', strokeWidth: 2 }}
                                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                                                            formatter={(value) => [value.toFixed(1) + ' hours', 'Sleep']}
                                                        />
                                                        <ReferenceLine y={sleepGoal} stroke="#FF6B6B" strokeDasharray="6 6" strokeWidth={2} label={{ value: `Goal`, position: 'right', fill: '#FF6B6B', fontSize: 10, fontWeight: 'bold', dx: 5 }} />
                                                        <Line
                                                            type="monotone"
                                                            dataKey="sleep"
                                                            stroke="#75AADB"
                                                            strokeWidth={3}
                                                            dot={{ r: 4, fill: '#E2F0FD', strokeWidth: 2, stroke: '#75AADB' }}
                                                            activeDot={{ r: 6, fill: '#E2F0FD', strokeWidth: 2, stroke: '#75AADB' }}
                                                        />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="h-[250px] flex items-center justify-center text-slate-400 text-sm font-medium italic">No historical data available</div>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap justify-center gap-6 mt-6 pt-6 border-t border-slate-100/60">
                                            <div className="flex items-center gap-2"><div className="w-4 h-0 border-t-2 border-solid border-[#75AADB]"></div><span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Sleep</span></div>
                                            <div className="flex items-center gap-2"><div className="w-4 h-0 border-t-2 border-dashed border-[#FF6B6B]"></div><span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Goal ({sleepGoal}h)</span></div>
                                        </div>
                                    </div>

                                    {/* AI Insights Card for Sleep */}
                                    <InsightsCard metricType="sleep" color="bg-[#E2F0FD]" />
                                </motion.div>
                            )}
                        </AnimatePresence>


                    </div>
                </motion.div>

            </div>
        </div>
    );
}
