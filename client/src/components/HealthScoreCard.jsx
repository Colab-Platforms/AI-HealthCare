import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Activity, Moon, Droplets, Brain, Utensils, Info, X, Sparkles } from 'lucide-react';
import { useData } from '../context/DataContext';
import { usePedometer } from '../context/PedometerContext';
import { healthService } from '../services/api';

const HealthScoreCard = ({ selectedDate = new Date() }) => {
    const { dashboardData, nutritionData } = useData();
    const { steps, dailyGoal } = usePedometer();
    const [showInfo, setShowInfo] = useState(false);
    const [dbScoreData, setDbScoreData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch DB progress when date changes
    useEffect(() => {
        const fetchProgress = async () => {
            try {
                const dateStr = selectedDate.toISOString().split('T')[0];
                const isToday = dateStr === new Date().toISOString().split('T')[0];

                if (!isToday) {
                    setIsLoading(true);
                    const { data } = await healthService.getDailyProgress(dateStr);
                    if (data.success && data.progress) {
                        setDbScoreData({
                            total: data.progress.totalScore,
                            breakdown: [
                                { label: 'Nutrition', score: data.progress.nutritionScore, max: 40, icon: Utensils, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                                { label: 'Sleep', score: data.progress.sleepScore, max: 30, icon: Moon, color: 'text-purple-500', bg: 'bg-purple-50' },
                                { label: 'Stress', score: data.progress.stressScore, max: 20, icon: Brain, color: 'text-rose-500', bg: 'bg-rose-50' },
                                { label: 'Hydration', score: data.progress.hydrationScore, max: 10, icon: Droplets, color: 'text-cyan-500', bg: 'bg-cyan-50' },
                            ]
                        });
                    } else {
                        setDbScoreData(null);
                    }
                } else {
                    setDbScoreData(null);
                }
            } catch (err) {
                console.error('Failed to fetch daily progress:', err);
                setDbScoreData(null);
            } finally {
                setIsLoading(false);
            }
        };
        fetchProgress();
    }, [selectedDate]);

    const scoreData = useMemo(() => {
        // 1. Nutrition (40 points)
        const nutritionLogs = dashboardData?.nutritionData?.todayLogs || [];
        const planMealsLogged = nutritionLogs.filter(log => log.source === 'meal_plan').length;
        const totalRecommendedMeals = 5;
        const nutritionAdherence = Math.min((planMealsLogged / totalRecommendedMeals), 1) * 40;

        // 3. Sleep (30 points)
        const sleepHistory = JSON.parse(localStorage.getItem('sleep_history') || '[]');
        const todayStr = new Date().toDateString();
        const lastSleep = sleepHistory.find(r => new Date(r.date).toDateString() === todayStr) || sleepHistory[0];

        let sleepScore = 0;
        if (lastSleep) {
            const hours = lastSleep.hours || 0;
            if (hours >= 7 && hours <= 9) sleepScore = 30;
            else if (hours >= 6) sleepScore = 20;
            else if (hours >= 5) sleepScore = 15;
            else if (hours > 0) sleepScore = 10;
        }

        // 4. Hydration (10 points)
        const dateStr = new Date().toISOString().split('T')[0];
        const waterIntake = parseInt(localStorage.getItem(`waterIntake_${dateStr}`) || '0');
        const hydrationScore = Math.min((waterIntake / 8), 1) * 10;

        // 5. Stress (20 points)
        let stressScore = 15;
        if (sleepScore < 15) stressScore -= 5;
        if (nutritionAdherence < 15) stressScore -= 5;

        const totalScore = Math.round(nutritionAdherence + sleepScore + hydrationScore + stressScore);

        return {
            total: Math.min(totalScore, 100),
            rawValues: {
                nutritionScore: Math.round(nutritionAdherence),
                sleepScore: Math.round(sleepScore),
                hydrationScore: Math.round(hydrationScore),
                stressScore: Math.round(stressScore),
                waterIntake
            },
            breakdown: [
                { label: 'Nutrition', score: Math.round(nutritionAdherence), max: 40, icon: Utensils, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                { label: 'Sleep', score: Math.round(sleepScore), max: 30, icon: Moon, color: 'text-purple-500', bg: 'bg-purple-50' },
                { label: 'Stress', score: Math.round(stressScore), max: 20, icon: Brain, color: 'text-rose-500', bg: 'bg-rose-50' },
                { label: 'Hydration', score: Math.round(hydrationScore), max: 10, icon: Droplets, color: 'text-cyan-500', bg: 'bg-cyan-50' },
            ]
        };
    }, [dashboardData, nutritionData, steps, dailyGoal]);

    // Use DB score for past days, realtime score for today
    const isToday = selectedDate.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
    const activeScoreData = isToday ? scoreData : (dbScoreData || {
        total: 0,
        breakdown: [
            { label: 'Nutrition', score: 0, max: 40, icon: Utensils, color: 'text-emerald-500', bg: 'bg-emerald-50' },
            { label: 'Sleep', score: 0, max: 30, icon: Moon, color: 'text-purple-500', bg: 'bg-purple-50' },
            { label: 'Stress', score: 0, max: 20, icon: Brain, color: 'text-rose-500', bg: 'bg-rose-50' },
            { label: 'Hydration', score: 0, max: 10, icon: Droplets, color: 'text-cyan-500', bg: 'bg-cyan-50' },
        ]
    });

    // Sync today's realtime score with DB
    useEffect(() => {
        if (isToday) {
            const syncData = async () => {
                try {
                    await healthService.syncDailyProgress({
                        date: selectedDate.toISOString().split('T')[0],
                        totalScore: scoreData.total,
                        ...scoreData.rawValues
                    });
                } catch (err) {
                    console.error('Failed to sync progress:', err);
                }
            };
            const timeout = setTimeout(syncData, 5000); // Debounce sync
            return () => clearTimeout(timeout);
        }
    }, [scoreData, selectedDate]);

    return (
        <motion.div
            whileHover={{ y: -2 }}
            className="bg-white rounded-[2rem] p-3.5 border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)] transition-all group relative overflow-hidden"
        >
            <div className="absolute top-0 right-0 w-24 h-24 bg-black/5 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-black/10 transition-colors"></div>

            <div className="flex justify-between items-center mb-2.5 relative z-10">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center">
                        <Heart className="w-3.5 h-3.5 text-black" />
                    </div>
                    <div>
                        <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Health Score</h3>
                    </div>
                </div>
                <button
                    onClick={() => setShowInfo(true)}
                    className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center hover:bg-black hover:text-white transition-all text-slate-400"
                >
                    <Info className="w-3.5 h-3.5" />
                </button>
            </div>

            <div className="flex items-center gap-4 mb-3 relative z-10">
                <div className="relative inline-flex items-center justify-center">
                    <svg width="56" height="56" className="transform -rotate-90">
                        <circle
                            cx="28"
                            cy="28"
                            r="24"
                            stroke="#f1f5f9"
                            strokeWidth="5"
                            fill="none"
                        />
                        <motion.circle
                            cx="28"
                            cy="28"
                            r="24"
                            stroke="url(#scoreGradientSm)"
                            strokeWidth="5"
                            fill="none"
                            strokeDasharray={150.79}
                            initial={{ strokeDashoffset: 150.79 }}
                            animate={{ strokeDashoffset: 150.79 - (activeScoreData.total / 100) * 150.79 }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            strokeLinecap="round"
                        />
                        <defs>
                            <linearGradient id="scoreGradientSm" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#000" />
                                <stop offset="100%" stopColor="#666" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-base font-black text-black leading-none">{isLoading ? '...' : activeScoreData.total}</span>
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-black leading-tight tracking-tight truncate">
                        {activeScoreData.total >= 80 ? 'Excellent!' : activeScoreData.total >= 60 ? 'Good' : 'Improving'}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
                        Daily Progress
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-5 gap-1 pt-2.5 border-t border-slate-50 relative z-10">
                {activeScoreData.breakdown.map((item, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1">
                        <div className={`p-1 rounded-md ${item.bg} ${item.color}`}>
                            <item.icon className="w-3 h-3" />
                        </div>
                        <div className="w-full h-0.5 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(item.score / item.max) * 100}%` }}
                                className={`h-full bg-current ${item.color}`}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* Info Modal */}
            <AnimatePresence>
                {showInfo && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 sm:p-0">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowInfo(false)}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white w-full max-w-xs rounded-[2rem] p-5 shadow-2xl relative z-10"
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-xs font-black text-black uppercase tracking-widest">Score Logic</h4>
                                <button onClick={() => setShowInfo(false)} className="p-1.5 bg-slate-50 rounded-full text-slate-400 hover:text-black transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {activeScoreData.breakdown.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-xl ${item.bg} ${item.color} flex items-center justify-center shrink-0`}>
                                            <item.icon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs font-bold text-slate-700">{item.label}</span>
                                                <span className="text-[10px] font-black text-slate-400">{item.score}/{item.max}</span>
                                            </div>
                                            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full bg-current ${item.color}`} style={{ width: `${(item.score / item.max) * 100}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <p className="mt-6 text-[10px] font-bold text-slate-400 text-center leading-relaxed">
                                Your score is updated in real-time based on your nutrition logs, sleep data, stress levels, and hydration tracked today.
                            </p>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default HealthScoreCard;
