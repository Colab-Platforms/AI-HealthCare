import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, Footprints, Moon, ArrowLeft, Calendar, Save, Plus, Flame, Clock } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function LogVitals() {
    const { metric } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
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

    const stepGoal = dashboardData?.goals?.steps || 10000;
    const sleepGoal = dashboardData?.goals?.sleep || 8;
    const weightGoal = dashboardData?.goals?.weight || user?.nutritionGoal?.weightGoal || 70;

    const [goalInput, setGoalInput] = useState('');
    const [loadingGoal, setLoadingGoal] = useState(false);

    useEffect(() => {
        setGoalInput('');
    }, [activeTab]);

    const handleSaveGoal = async () => {
        if (!goalInput) {
            toast.error('Please enter a goal value');
            return;
        }
        setLoadingGoal(true);
        try {
            const numValue = Number(goalInput);
            if (activeTab === 'weight') {
                await api.put('nutrition/goals', { weightGoal: numValue });
            } else if (activeTab === 'steps') {
                await api.put('nutrition/goals', { stepGoal: numValue });
            } else if (activeTab === 'sleep') {
                await api.put('nutrition/goals', { sleepGoal: numValue });
            }
            
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
            } else if (activeTab === 'steps') {
                if (!value) throw new Error('Steps are required');
                // Check if there is a wearable connected, if not use 'other'
                await api.post('wearables/sync', {
                    deviceType: 'other',
                    metrics: { steps: Number(value), date }
                });
            } else if (activeTab === 'sleep') {
                if (!sleepHours && !sleepMins) throw new Error('Sleep duration is required');
                const totalMinutes = (parseInt(sleepHours || 0) * 60) + parseInt(sleepMins || 0);
                await api.post('wearables/sleep', {
                    deviceType: 'other',
                    sleepData: { date, totalSleepMinutes: totalMinutes, sleepScore: 85 }
                });
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

    return (
        <div className="min-h-full bg-transparent p-4 md:p-8 font-sans relative">
            <div className="max-w-[1000px] mx-auto relative z-10 space-y-8">

                <div className="pt-4" />

                {/* Content Card */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/80 backdrop-blur-xl rounded-[32px] p-6 md:p-8 border border-white/50 shadow-[0_4px_24px_rgba(0,0,0,0.02)]"
                >
                    {/* Tabs */}
                    <div className="flex bg-[#F5F5F7] p-1 rounded-full border border-white shadow-sm w-full mb-8">
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
                    <div className="py-4">
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

                                            <div className="p-6 md:p-8 bg-[#F5F5F7]/50 rounded-[32px] border border-white border-dashed">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                                                        <Plus className="w-4 h-4 text-[#1a1a1a]" />
                                                    </div>
                                                    <h4 className="font-medium text-[#1a1a1a]">Manual Entry</h4>
                                                </div>
                                                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
                                                    <div className="flex-1 w-full space-y-2">
                                                        <label className="text-[10px] font-bold text-[#888888] uppercase tracking-wider ml-2">Steps to add</label>
                                                        <input
                                                            type="number"
                                                            value={value}
                                                            onChange={(e) => setValue(e.target.value)}
                                                            placeholder="E.g., 2000"
                                                            className="w-full bg-white border border-slate-200 rounded-xl md:rounded-full px-5 py-3 shadow-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#D4F1A5] transition-all font-medium"
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
                                                    className="w-full mt-6 py-4 bg-[#4A8C2B]/80 backdrop-blur-md border border-[#4A8C2B]/20 text-white rounded-full font-medium transition-all shadow-xl hover:bg-[#4A8C2B] flex items-center justify-center gap-2 group disabled:opacity-50"
                                                >
                                                    {loading ? (
                                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <>
                                                            <Save className="w-5 h-5 group-hover:scale-110 transition-transform" /> Save Steps
                                                        </>
                                                    )}
                                                </button>
                                            </div>

                                            <div className="p-6 md:p-8 bg-[#F5F5F7]/50 rounded-[32px] border border-white border-dashed">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                                                        <Flame className="w-4 h-4 text-[#1a1a1a]" />
                                                    </div>
                                                    <h4 className="font-medium text-[#1a1a1a]">Set Step Goal</h4>
                                                </div>
                                                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
                                                    <div className="flex-1 w-full space-y-2">
                                                        <label className="text-[10px] font-bold text-[#888888] uppercase tracking-wider ml-2">Target Steps</label>
                                                        <input
                                                            type="number"
                                                            value={goalInput}
                                                            onChange={(e) => setGoalInput(e.target.value)}
                                                            placeholder={`Current: ${stepGoal}`}
                                                            className="w-full bg-white border border-slate-200 rounded-xl md:rounded-full px-5 py-3 shadow-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#D4F1A5] transition-all font-medium"
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

                                            <div className="p-6 md:p-8 bg-[#F5F5F7]/50 rounded-[32px] border border-white border-dashed">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                                                        <Plus className="w-4 h-4 text-[#1a1a1a]" />
                                                    </div>
                                                    <h4 className="font-medium text-[#1a1a1a]">Log Sleep</h4>
                                                </div>
                                                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
                                                    <div className="flex flex-1 gap-2 w-full sm:w-auto">
                                                        <div className="flex-1 space-y-2">
                                                            <label className="text-[10px] font-bold text-[#888888] uppercase tracking-wider ml-2">Hours</label>
                                                            <input
                                                                type="number"
                                                                value={sleepHours}
                                                                onChange={(e) => setSleepHours(e.target.value)}
                                                                placeholder="Hrs"
                                                                max="24" min="0"
                                                                className="w-full bg-white border border-slate-200 rounded-xl md:rounded-full px-5 py-3 shadow-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#E2F0FD] transition-all font-medium"
                                                            />
                                                        </div>
                                                        <div className="flex-1 space-y-2">
                                                            <label className="text-[10px] font-bold text-[#888888] uppercase tracking-wider ml-2">Mins</label>
                                                            <input
                                                                type="number"
                                                                value={sleepMins}
                                                                onChange={(e) => setSleepMins(e.target.value)}
                                                                placeholder="Min"
                                                                max="59" min="0"
                                                                className="w-full bg-white border border-slate-200 rounded-xl md:rounded-full px-5 py-3 shadow-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#E2F0FD] transition-all font-medium"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 space-y-2 w-full sm:w-auto">
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
                                                    className="w-full mt-6 py-4 bg-[#75AADB]/80 backdrop-blur-md border border-[#75AADB]/20 text-white rounded-full font-medium transition-all shadow-xl hover:bg-[#75AADB] flex items-center justify-center gap-2 group disabled:opacity-50"
                                                >
                                                    {loading ? (
                                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <>
                                                            <Save className="w-5 h-5 group-hover:scale-110 transition-transform" /> Save Sleep
                                                        </>
                                                    )}
                                                </button>
                                            </div>

                                            <div className="p-6 md:p-8 bg-[#F5F5F7]/50 rounded-[32px] border border-white border-dashed">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                                                        <Flame className="w-4 h-4 text-[#1a1a1a]" />
                                                    </div>
                                                    <h4 className="font-medium text-[#1a1a1a]">Set Sleep Goal</h4>
                                                </div>
                                                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
                                                    <div className="flex-1 w-full space-y-2">
                                                        <label className="text-[10px] font-bold text-[#888888] uppercase tracking-wider ml-2">Target Sleep (Hours)</label>
                                                        <input
                                                            type="number"
                                                            value={goalInput}
                                                            onChange={(e) => setGoalInput(e.target.value)}
                                                            placeholder={`Current: ${sleepGoal}`}
                                                            className="w-full bg-white border border-slate-200 rounded-xl md:rounded-full px-5 py-3 shadow-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#E2F0FD] transition-all font-medium"
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
                                </motion.div>
                            )}
                        </AnimatePresence>


                    </div>
                </motion.div>

            </div>
        </div>
    );
}
