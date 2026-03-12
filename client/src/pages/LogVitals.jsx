import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, Footprints, Moon, ArrowLeft, Calendar, Save, Plus, Flame, Clock } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
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
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (metric && validMetrics.includes(metric)) {
            setActiveTab(metric);
        }
    }, [metric]);

    const history = useMemo(() => {
        if (!dashboardData?.history) return [];
        return dashboardData.history.map(item => ({
            ...item,
            day: new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })
        }));
    }, [dashboardData]);

    const currentWeight = user?.profile?.weight || 72.5;
    const currentSteps = dashboardData?.stepsToday || 0;
    const currentSleep = dashboardData?.history?.slice(-1)[0]?.sleep || 0;

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

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-4"
                >
                    <button
                        onClick={() => navigate(-1)}
                        className="w-12 h-12 rounded-full bg-white/60 backdrop-blur-md flex items-center justify-center border border-white shadow-sm hover:bg-white transition-all"
                    >
                        <ArrowLeft className="w-5 h-5 text-[#1a1a1a]" />
                    </button>
                    <div>
                        <h1 className="text-3xl md:text-4xl font-light tracking-tight text-[#1a1a1a]">Log Vitals</h1>
                        <p className="text-[#666666] mt-1 text-sm md:text-base">Track your daily progress</p>
                    </div>
                </motion.div>

                {/* Content Card */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/80 backdrop-blur-xl rounded-[32px] p-6 md:p-8 border border-white/50 shadow-[0_4px_24px_rgba(0,0,0,0.02)]"
                >
                    {/* Tabs */}
                    <div className="flex bg-[#F5F5F7] p-1.5 rounded-full border border-white shadow-sm overflow-x-auto w-full mb-8">
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all whitespace-nowrap relative ${isActive ? 'text-[#1a1a1a] shadow-sm bg-white' : 'text-[#666666] hover:text-[#1a1a1a]'
                                        }`}
                                >
                                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#1a1a1a]' : 'text-[#888888]'}`} />
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
                                                <span className="text-[10px] font-bold text-[#888888] tracking-widest uppercase">LIVE</span>
                                            </div>

                                            <div className="text-center mb-8 mt-2">
                                                <h2 className="text-2xl md:text-3xl font-light text-[#1a1a1a]">
                                                    Current Weight <span className="font-semibold text-[#1a1a1a]">{currentWeight} kg</span>
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
                                                    <div className="text-2xl font-medium text-[#1a1a1a]">{user?.nutritionGoal?.weightGoal || 70} <span className="text-sm text-[#888888] font-normal">kg</span></div>
                                                </div>
                                                <div className="text-center border-l border-r border-slate-100/60">
                                                    <div className="text-xs font-bold text-[#888888] mb-1.5 uppercase tracking-wider">Progress</div>
                                                    <div className="text-2xl font-medium text-[#1a1a1a]">{(currentWeight - (user?.nutritionGoal?.weightGoal || 70)).toFixed(1)} <span className="text-sm text-[#888888] font-normal">kg</span></div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-xs font-bold text-[#888888] mb-1.5 uppercase tracking-wider">BMI</div>
                                                    <div className="text-2xl font-medium text-[#1a1a1a]">23.4</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Column - Weekly Chart & Log Form */}
                                        <div className="flex flex-col gap-6">

                                            <div className="p-6 md:p-8 bg-white/60 backdrop-blur-md rounded-[32px] border border-white shadow-sm flex-1 flex flex-col">
                                                <div className="flex justify-between items-center mb-8">
                                                    <h3 className="text-xl font-medium text-[#1a1a1a]">Trend</h3>
                                                    <span className="px-4 py-1.5 bg-[#F5F5F7] text-[#666666] text-[10px] font-bold uppercase tracking-widest rounded-full border border-slate-100">Last 7 Days</span>
                                                </div>

                                                <div className="flex-1 min-h-[200px] w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                            <XAxis
                                                                dataKey="day"
                                                                axisLine={false}
                                                                tickLine={false}
                                                                tick={{ fill: '#888888', fontSize: 12, fontWeight: 500 }}
                                                                dy={10}
                                                            />
                                                            <YAxis
                                                                domain={['dataMin - 1', 'dataMax + 1']}
                                                                axisLine={false}
                                                                tickLine={false}
                                                                tick={{ fill: '#888888', fontSize: 12 }}
                                                            />
                                                            <Tooltip
                                                                cursor={{ stroke: '#F5F5F7', strokeWidth: 2 }}
                                                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                                                            />
                                                            <ReferenceLine y={user?.nutritionGoal?.weightGoal || 70} stroke="#C8BFF0" strokeDasharray="6 6" />
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
                                                </div>

                                                <div className="flex flex-wrap justify-center gap-6 mt-6 pt-6 border-t border-slate-100/60">
                                                    <div className="flex items-center gap-2"><div className="w-4 h-0 border-t-2 border-solid border-[#4A2B8C]"></div><span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Weight</span></div>
                                                    <div className="flex items-center gap-2"><div className="w-4 h-0 border-t-2 border-dashed border-[#C8BFF0]"></div><span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Target</span></div>
                                                </div>
                                            </div>

                                            <div className="p-6 md:p-8 bg-[#F5F5F7]/50 rounded-[32px] border border-white border-dashed">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                                                        <Plus className="w-4 h-4 text-[#1a1a1a]" />
                                                    </div>
                                                    <h4 className="font-medium text-[#1a1a1a]">Log Weight</h4>
                                                </div>
                                                <div className="flex items-end gap-4">
                                                    <div className="flex-1 space-y-2">
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
                                                    <div className="flex-1 space-y-2">
                                                        <label className="text-[10px] font-bold text-[#888888] uppercase tracking-wider ml-2">Date</label>
                                                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl md:rounded-full px-4 py-3 shadow-sm">
                                                            <Calendar className="w-4 h-4 text-slate-400" />
                                                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-transparent text-[#1a1a1a] outline-none text-sm font-medium" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

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
                                                <span className="text-[10px] font-bold text-[#888888] tracking-widest uppercase">LIVE</span>
                                            </div>

                                            <div className="text-center mb-8 mt-2">
                                                <h2 className="text-2xl md:text-3xl font-light text-[#1a1a1a]">
                                                    You have walked <span className="font-semibold text-[#1a1a1a]">{currentSteps.toLocaleString()} steps</span> today
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
                                                        strokeDashoffset={120 * Math.PI * (1 - Math.min(currentSteps / 10000, 1))}
                                                        className="transition-all duration-1000 ease-out"
                                                    />
                                                </svg>

                                                <div className="text-center z-10 pb-2">
                                                    <div className="w-12 h-12 bg-[#D4F1A5] rounded-full mx-auto flex items-center justify-center mb-3 shadow-sm border border-white">
                                                        <Footprints className="w-6 h-6 text-[#1a1a1a]" />
                                                    </div>
                                                    <div className="text-5xl font-bold text-[#1a1a1a] tracking-tight">{currentSteps.toLocaleString()}</div>
                                                    <div className="text-[11px] font-bold text-[#888888] uppercase tracking-widest mt-2">OF 10,000 STEPS</div>
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
                                                    <div className="text-2xl font-medium text-[#1a1a1a]">10k</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-6">

                                            <div className="p-6 md:p-8 bg-white/60 backdrop-blur-md rounded-[32px] border border-white shadow-sm flex-1 flex flex-col">
                                                <div className="flex justify-between items-center mb-8">
                                                    <h3 className="text-xl font-medium text-[#1a1a1a]">Weekly Progress</h3>
                                                    <span className="px-4 py-1.5 bg-[#F5F5F7] text-[#666666] text-[10px] font-bold uppercase tracking-widest rounded-full border border-slate-100">Last 7 Days</span>
                                                </div>

                                                <div className="flex-1 min-h-[200px] w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={history} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                                            <XAxis
                                                                dataKey="day"
                                                                axisLine={false}
                                                                tickLine={false}
                                                                tick={{ fill: '#888888', fontSize: 12, fontWeight: 500 }}
                                                                dy={10}
                                                            />
                                                            <YAxis
                                                                axisLine={false}
                                                                tickLine={false}
                                                                tick={{ fill: '#888888', fontSize: 12 }}
                                                                tickFormatter={(val) => val === 0 ? '0' : `${val / 1000}k`}
                                                            />
                                                            <Tooltip
                                                                cursor={{ fill: '#F5F5F7' }}
                                                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                                                            />
                                                            <ReferenceLine y={10000} stroke="#C8BFF0" strokeDasharray="6 6" />
                                                            <Bar dataKey="steps" radius={[6, 6, 6, 6]} barSize={32}>
                                                                {history.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={entry.steps >= 10000 ? '#D4F1A5' : '#E2F0FD'} />
                                                                ))}
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>

                                                <div className="flex flex-wrap justify-center gap-6 mt-6 pt-6 border-t border-slate-100/60">
                                                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#D4F1A5]"></div><span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Goal Met</span></div>
                                                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#E2F0FD]"></div><span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">In Progress</span></div>
                                                    <div className="flex items-center gap-2"><div className="w-4 h-0 border-t-2 border-dashed border-[#C8BFF0]"></div><span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Goal</span></div>
                                                </div>
                                            </div>

                                            <div className="p-6 md:p-8 bg-[#F5F5F7]/50 rounded-[32px] border border-white border-dashed">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                                                        <Plus className="w-4 h-4 text-[#1a1a1a]" />
                                                    </div>
                                                    <h4 className="font-medium text-[#1a1a1a]">Manual Entry</h4>
                                                </div>
                                                <div className="flex items-end gap-4">
                                                    <div className="flex-1 space-y-2">
                                                        <label className="text-[10px] font-bold text-[#888888] uppercase tracking-wider ml-2">Steps to add</label>
                                                        <input
                                                            type="number"
                                                            value={value}
                                                            onChange={(e) => setValue(e.target.value)}
                                                            placeholder="E.g., 2000"
                                                            className="w-full bg-white border border-slate-200 rounded-xl md:rounded-full px-5 py-3 shadow-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#D4F1A5] transition-all font-medium"
                                                        />
                                                    </div>
                                                    <div className="flex-1 space-y-2">
                                                        <label className="text-[10px] font-bold text-[#888888] uppercase tracking-wider ml-2">Date</label>
                                                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl md:rounded-full px-4 py-3 shadow-sm">
                                                            <Calendar className="w-4 h-4 text-slate-400" />
                                                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-transparent text-[#1a1a1a] outline-none text-sm font-medium" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

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
                                                <span className="text-[10px] font-bold text-[#888888] tracking-widest uppercase">LAST NIGHT</span>
                                            </div>

                                            <div className="text-center mb-8 mt-2">
                                                <h2 className="text-2xl md:text-3xl font-light text-[#1a1a1a]">
                                                    You slept <span className="font-semibold text-[#1a1a1a]">{Math.floor(currentSleep)}h {Math.round((currentSleep % 1) * 60)}m</span>
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
                                                        strokeDashoffset={120 * Math.PI * (1 - Math.min(currentSleep / 8, 1))}
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
                                                    <div className="text-2xl font-medium text-[#1a1a1a]">2h <span className="text-sm text-[#888888] font-normal">10m</span></div>
                                                </div>
                                                <div className="text-center border-l border-r border-slate-100/60">
                                                    <div className="text-xs font-bold text-[#888888] mb-1.5 uppercase tracking-wider">Quality</div>
                                                    <div className="text-2xl font-medium text-[#1a1a1a]">85%</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-xs font-bold text-[#888888] mb-1.5 uppercase tracking-wider">Goal</div>
                                                    <div className="text-2xl font-medium text-[#1a1a1a]">8h</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-6">

                                            <div className="p-6 md:p-8 bg-white/60 backdrop-blur-md rounded-[32px] border border-white shadow-sm flex-1 flex flex-col">
                                                <div className="flex justify-between items-center mb-8">
                                                    <h3 className="text-xl font-medium text-[#1a1a1a]">Weekly Sleep</h3>
                                                    <span className="px-4 py-1.5 bg-[#F5F5F7] text-[#666666] text-[10px] font-bold uppercase tracking-widest rounded-full border border-slate-100">Last 7 Days</span>
                                                </div>

                                                <div className="flex-1 min-h-[200px] w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={history} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                                            <XAxis
                                                                dataKey="day"
                                                                axisLine={false}
                                                                tickLine={false}
                                                                tick={{ fill: '#888888', fontSize: 12, fontWeight: 500 }}
                                                                dy={10}
                                                            />
                                                            <YAxis
                                                                axisLine={false}
                                                                tickLine={false}
                                                                tick={{ fill: '#888888', fontSize: 12 }}
                                                                domain={[0, 10]}
                                                                tickFormatter={(val) => `${val}h`}
                                                            />
                                                            <Tooltip
                                                                cursor={{ fill: '#F5F5F7' }}
                                                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                                                            />
                                                            <ReferenceLine y={8} stroke="#E2F0FD" strokeDasharray="6 6" />
                                                            <Bar dataKey="sleep" radius={[6, 6, 6, 6]} barSize={32}>
                                                                {history.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={(entry.sleep || 0) >= 8 ? '#C8BFF0' : '#E2F0FD'} />
                                                                ))}
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>

                                                <div className="flex flex-wrap justify-center gap-6 mt-6 pt-6 border-t border-slate-100/60">
                                                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#C8BFF0]"></div><span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Goal Met</span></div>
                                                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#E2F0FD]"></div><span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Below Goal</span></div>
                                                    <div className="flex items-center gap-2"><div className="w-4 h-0 border-t-2 border-dashed border-[#E2F0FD]"></div><span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Goal (8h)</span></div>
                                                </div>
                                            </div>

                                            <div className="p-6 md:p-8 bg-[#F5F5F7]/50 rounded-[32px] border border-white border-dashed">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                                                        <Plus className="w-4 h-4 text-[#1a1a1a]" />
                                                    </div>
                                                    <h4 className="font-medium text-[#1a1a1a]">Log Sleep</h4>
                                                </div>
                                                <div className="flex flex-col sm:flex-row items-end gap-4">
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
                                            </div>

                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="mt-10 max-w-[1000px] mx-auto">
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="w-full py-4 bg-[#4A2B8C]/70 backdrop-blur-md border-2 border-white/30 text-white rounded-full font-medium transition-all shadow-xl hover:bg-[#4A2B8C]/90 flex items-center justify-center gap-2 group disabled:opacity-50"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Save className="w-5 h-5 group-hover:scale-110 transition-transform" /> Save {activeTab}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </motion.div>

            </div>
        </div>
    );
}
