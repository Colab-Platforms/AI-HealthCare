import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Calendar, Footprints, Flame, Target, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';

// ============================================================
// WALKING DETECTION ENGINE
// Mimics how real phone pedometers work:
// 1. Isolate linear acceleration (remove gravity)
// 2. Focus on vertical axis magnitude
// 3. Detect periodic peaks matching human gait cadence
// 4. Require consistent rhythm (rejects random shakes)
// 5. Use zero-crossing detection for reliable peak finding
// ============================================================

const CircularProgress = ({ value, max }) => {
    const radius = 120;
    const stroke = 18;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * Math.PI;
    const progress = Math.min(value / Math.max(max, 1), 1);
    const strokeDashoffset = circumference - progress * circumference;

    const getColor = (p) => {
        if (p >= 1) return '#10b981';
        if (p >= 0.6) return '#4ade80';
        if (p >= 0.3) return '#fb923c';
        return '#818cf8';
    };

    return (
        <div className="relative flex justify-center items-center my-8">
            <svg height={radius} width={radius * 2} style={{ overflow: 'visible' }}>
                <path
                    d={`M ${stroke * 2} ${radius} A ${normalizedRadius} ${normalizedRadius} 0 0 1 ${radius * 2 - stroke * 2} ${radius}`}
                    fill="none" stroke="#F1F5F9" strokeWidth={stroke} strokeLinecap="round" strokeDasharray="4 16"
                />
                <path
                    d={`M ${stroke * 2} ${radius} A ${normalizedRadius} ${normalizedRadius} 0 0 1 ${radius * 2 - stroke * 2} ${radius}`}
                    fill="none" stroke={getColor(progress)} strokeWidth={stroke} strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-end -bottom-2">
                <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mb-2">
                    <Footprints className="w-7 h-7 text-green-500 transform -rotate-12" />
                </div>
                <span className="text-4xl font-extrabold tracking-tight" style={{ color: getColor(progress) }}>
                    {value.toLocaleString()}
                </span>
                <span className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                    Of {max.toLocaleString()} Steps
                </span>
            </div>
        </div>
    );
};

// === Helper: Get today's date string ===
const getTodayString = () => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

// === Helper: Load today's steps from localStorage ===
const loadTodaySteps = () => {
    try {
        const data = JSON.parse(localStorage.getItem('fitcure_daily_steps') || '[]');
        const today = data.find(d => d.date === getTodayString());
        return today ? today.steps : 0;
    } catch { return 0; }
};

// === Helper: Save steps for today ===
const persistSteps = (count) => {
    const todayStr = getTodayString();
    let data = [];
    try { data = JSON.parse(localStorage.getItem('fitcure_daily_steps') || '[]'); } catch { }
    const idx = data.findIndex(d => d.date === todayStr);
    if (idx >= 0) {
        data[idx].steps = count;
    } else {
        data.push({ date: todayStr, steps: count });
    }
    // Keep only last 30 days of data
    if (data.length > 30) data = data.slice(-30);
    localStorage.setItem('fitcure_daily_steps', JSON.stringify(data));
};

export default function StepTracker() {
    const navigate = useNavigate();

    const [steps, setSteps] = useState(() => loadTodaySteps());
    const [isActive, setIsActive] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [dailySteps, setDailySteps] = useState([]);
    const [dailyGoal, setDailyGoal] = useState(() => {
        return parseInt(localStorage.getItem('fitcure_step_goal')) || 7000;
    });
    const [isEditingGoal, setIsEditingGoal] = useState(false);
    const [tempGoal, setTempGoal] = useState(dailyGoal);

    // Step detection engine refs
    const stepsRef = useRef(loadTodaySteps());
    const gravityRef = useRef({ x: 0, y: 0, z: 0 });
    const filteredAccelRef = useRef(0);
    const prevFilteredRef = useRef(0);
    const lastStepTimeRef = useRef(0);
    const stepCandidateCountRef = useRef(0);
    const lastSavedDateRef = useRef(getTodayString());
    const wakeLockRef = useRef(null);

    const caloriesBurned = Math.round(steps * 0.04);
    const distanceKm = (steps * 0.000762).toFixed(2); // avg stride ~0.762m

    // === Load weekly chart data ===
    const loadChartData = useCallback(() => {
        const goal = parseInt(localStorage.getItem('fitcure_step_goal')) || 7000;
        let data = [];
        try { data = JSON.parse(localStorage.getItem('fitcure_daily_steps') || '[]'); } catch { }

        // Build last 7 days
        const chart = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const dayData = data.find(entry => entry.date === dateStr);
            chart.push({
                displayDate: d.toLocaleDateString('en-US', { weekday: 'short' }),
                steps: dayData ? dayData.steps : 0,
                goal: goal,
            });
        }
        setDailySteps(chart);
    }, []);

    // === Auto daily reset check ===
    const checkDayRollover = useCallback(() => {
        const today = getTodayString();
        if (lastSavedDateRef.current !== today) {
            // New day! Reset steps
            stepsRef.current = 0;
            setSteps(0);
            lastSavedDateRef.current = today;
            persistSteps(0);
            loadChartData();
        }
    }, [loadChartData]);

    // === CORE: Device motion handler (walking detection) ===
    const handleMotion = useCallback((event) => {
        // Day rollover check
        checkDayRollover();

        const acc = event.accelerationIncludingGravity;
        const pureAcc = event.acceleration;
        let lx, ly, lz;

        if (pureAcc && pureAcc.x !== null && pureAcc.y !== null) {
            // Device provides linear acceleration directly (gravity removed)
            lx = pureAcc.x;
            ly = pureAcc.y;
            lz = pureAcc.z;
        } else if (acc && acc.x !== null) {
            // Must remove gravity ourselves with high-pass filter
            const a = 0.8;
            const g = gravityRef.current;
            g.x = a * g.x + (1 - a) * acc.x;
            g.y = a * g.y + (1 - a) * acc.y;
            g.z = a * g.z + (1 - a) * acc.z;
            lx = acc.x - g.x;
            ly = acc.y - g.y;
            lz = acc.z - g.z;
        } else {
            return; // No usable data
        }

        // Magnitude of linear acceleration
        const magnitude = Math.sqrt(lx * lx + ly * ly + lz * lz);

        // Low-pass filter the magnitude (smoothing)
        // This is the key to rejecting shakes:
        // Walking produces smooth sinusoidal acceleration
        // Shaking produces high-frequency spiky acceleration
        // A strong low-pass filter removes shake frequencies while preserving walk frequencies
        const alpha = 0.15; // Heavy smoothing — only ~1-2Hz signals pass through (walking cadence)
        prevFilteredRef.current = filteredAccelRef.current;
        filteredAccelRef.current = alpha * magnitude + (1 - alpha) * filteredAccelRef.current;

        const now = Date.now();
        const timeSinceLastStep = now - lastStepTimeRef.current;

        // Zero-crossing detection on filtered signal
        // A step occurs when the filtered signal crosses above threshold from below
        const THRESHOLD = 1.0; // m/s² — tuned for walking (hand shakes get smoothed out by LPF)
        const wasBelow = prevFilteredRef.current < THRESHOLD;
        const isAbove = filteredAccelRef.current >= THRESHOLD;

        if (wasBelow && isAbove) {
            // Potential step — validate timing
            // Human walking cadence: 1.3 - 2.5 steps/sec → 400ms - 770ms per step
            // Allow slightly wider range: 330ms - 1000ms
            if (timeSinceLastStep >= 330 && timeSinceLastStep <= 1000) {
                stepCandidateCountRef.current++;

                // Require 4 consistent steps before we start counting
                // This is how real pedometers work — they wait for a consistent pattern
                // This completely eliminates single shakes or random movements
                if (stepCandidateCountRef.current >= 4) {
                    // Once pattern is established, count every valid step
                    stepsRef.current += 1;
                    setSteps(stepsRef.current);
                    persistSteps(stepsRef.current);
                }

                lastStepTimeRef.current = now;
            } else if (timeSinceLastStep > 2000) {
                // User stopped walking for >2 seconds — reset pattern detection
                stepCandidateCountRef.current = 0;
                lastStepTimeRef.current = now;
            }
            // If timeSinceLastStep < 330ms, it's too fast (shake) — ignore completely
        }
    }, [checkDayRollover]);

    // === Wake Lock management ===
    const acquireWakeLock = useCallback(async () => {
        if ('wakeLock' in navigator) {
            try {
                wakeLockRef.current = await navigator.wakeLock.request('screen');
                wakeLockRef.current.addEventListener('release', () => {
                    wakeLockRef.current = null;
                });
            } catch { }
        }
    }, []);

    // === Start sensors ===
    const startSensors = useCallback(async () => {
        // iOS permission request
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const perm = await DeviceMotionEvent.requestPermission();
                if (perm !== 'granted') {
                    setErrorMsg('Sensor permission denied. Enable in Settings to use pedometer.');
                    return;
                }
            } catch {
                setErrorMsg('Could not request sensor permissions.');
                return;
            }
        }

        if (window.DeviceMotionEvent) {
            window.addEventListener('devicemotion', handleMotion, true);
            setIsActive(true);
            await acquireWakeLock();
        } else {
            setErrorMsg('Motion sensors not available on this device.');
        }
    }, [handleMotion, acquireWakeLock]);

    // === Lifecycle: auto-start + background handling ===
    useEffect(() => {
        // Load initial data
        loadChartData();

        // Auto-start pedometer
        startSensors();

        // Handle tab visibility changes — re-acquire wake lock and resume
        const handleVisibility = async () => {
            if (!document.hidden) {
                // Tab became visible — check day rollover and re-acquire wake lock
                checkDayRollover();
                // Reload steps from storage (in case another tab updated)
                const currentSteps = loadTodaySteps();
                if (currentSteps > stepsRef.current) {
                    stepsRef.current = currentSteps;
                    setSteps(currentSteps);
                }
                loadChartData();
                if (!wakeLockRef.current) {
                    await acquireWakeLock();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);

        // Periodic save and day-rollover check (every 10 seconds)
        const interval = setInterval(() => {
            checkDayRollover();
            persistSteps(stepsRef.current);
            loadChartData();
        }, 10000);

        return () => {
            window.removeEventListener('devicemotion', handleMotion, true);
            document.removeEventListener('visibilitychange', handleVisibility);
            clearInterval(interval);
            if (wakeLockRef.current) {
                wakeLockRef.current.release();
                wakeLockRef.current = null;
            }
        };
    }, [startSensors, loadChartData, checkDayRollover, handleMotion, acquireWakeLock]);

    // === Save goal ===
    const saveGoal = () => {
        const newGoal = Math.max(tempGoal, 100);
        setDailyGoal(newGoal);
        localStorage.setItem('fitcure_step_goal', newGoal.toString());
        setIsEditingGoal(false);
        loadChartData();
    };

    // === Chart tooltip ===
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const d = payload[0].payload;
            const pct = d.goal > 0 ? Math.round((d.steps / d.goal) * 100) : 0;
            return (
                <div className="bg-slate-800 text-white text-[10px] font-black px-3 py-2 rounded-xl shadow-xl">
                    <p>{d.steps.toLocaleString()} steps</p>
                    <p className="text-slate-400">{pct}% of goal</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-roboto w-full max-w-md mx-auto shadow-2xl overflow-hidden relative">

            {/* Header */}
            <header className="bg-white px-6 py-5 flex items-center justify-between border-b border-slate-100 z-10 sticky top-0">
                <button onClick={() => navigate(-1)} className="text-slate-700 hover:text-black transition-colors">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="text-lg font-black text-black tracking-tight">Step Tracker</h1>
                <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        {isActive ? 'Live' : 'Off'}
                    </span>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto pb-24">
                {/* Error */}
                {errorMsg && (
                    <div className="mx-6 mt-4 bg-red-50 text-red-500 text-xs font-bold p-3 rounded-2xl flex items-center gap-2">
                        {errorMsg}
                    </div>
                )}

                {/* Main Progress */}
                <div className="bg-white p-6 pb-8 border-b border-slate-100">
                    <div className="text-center mb-2">
                        <h2 className="text-xl font-bold text-slate-700 leading-tight">
                            You have walked <span className="text-indigo-500 font-black">{steps.toLocaleString()}</span><br />
                            <span className="text-indigo-400 font-black">steps</span> today
                        </h2>
                    </div>

                    <CircularProgress value={steps} max={dailyGoal} />

                    {/* Stats Row */}
                    <div className="flex justify-between items-center mt-4">
                        <div className="flex-1 text-center border-r border-slate-100">
                            <p className="text-[11px] font-bold text-slate-500 mb-1">Calories</p>
                            <p className="text-2xl font-black text-black">
                                {caloriesBurned}<span className="text-[10px] text-slate-400 font-bold ml-1">kcal</span>
                            </p>
                        </div>
                        <div className="flex-1 text-center border-r border-slate-100">
                            <p className="text-[11px] font-bold text-slate-500 mb-1">Distance</p>
                            <p className="text-2xl font-black text-black">
                                {distanceKm}<span className="text-[10px] text-slate-400 font-bold ml-1">km</span>
                            </p>
                        </div>
                        <div className="flex-1 text-center cursor-pointer group" onClick={() => {
                            setTempGoal(dailyGoal);
                            setIsEditingGoal(true);
                        }}>
                            <p className="text-[11px] font-bold text-slate-500 mb-1 flex items-center justify-center gap-1 group-hover:text-indigo-500 transition-colors">
                                Goal <Target className="w-3 h-3" />
                            </p>
                            <p className="text-2xl font-black text-black group-hover:scale-105 transition-transform">
                                {dailyGoal >= 1000 ? `${(dailyGoal / 1000).toFixed(dailyGoal % 1000 === 0 ? 0 : 1)}k` : dailyGoal}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Weekly Progress Chart */}
                <div className="bg-white p-6 mt-3">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-black text-slate-800">Weekly Progress</h3>
                        <div className="bg-slate-50 px-3 py-1.5 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Last 7 Days
                        </div>
                    </div>

                    <div className="w-full h-52">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dailySteps} margin={{ top: 15, right: 5, left: -15, bottom: 0 }}>
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }}
                                    domain={[0, (dataMax) => Math.max(dataMax, dailyGoal) * 1.15]}
                                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                                    width={35}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                                <ReferenceLine
                                    y={dailyGoal}
                                    stroke="#6366f1"
                                    strokeDasharray="6 4"
                                    strokeWidth={1.5}
                                    label={{
                                        value: `Goal`,
                                        position: 'insideTopLeft',
                                        fill: '#6366f1',
                                        fontSize: 10,
                                        fontWeight: 'bold',
                                        offset: 5
                                    }}
                                />
                                <Bar
                                    dataKey="steps"
                                    radius={[8, 8, 8, 8]}
                                    maxBarSize={20}
                                    animationDuration={1200}
                                >
                                    {dailySteps.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={
                                                entry.steps >= dailyGoal
                                                    ? '#10b981'     // green — goal met
                                                    : entry.steps > 0
                                                        ? '#fb923c' // orange — in progress
                                                        : '#e2e8f0' // grey — no data
                                            }
                                        />
                                    ))}
                                </Bar>
                                <XAxis
                                    dataKey="displayDate"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                                    dy={8}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center justify-center gap-6 mt-3 text-[9px] font-black uppercase tracking-widest text-slate-400">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Goal Met</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-orange-400" /> In Progress</span>
                        <span className="flex items-center gap-1.5 text-indigo-500">— — Goal Line</span>
                    </div>
                </div>

                {/* AI Health Insight */}
                <div className="p-6 mt-3">
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                    <Activity className="w-5 h-5" />
                                </div>
                                <h4 className="text-sm font-black uppercase tracking-widest leading-none">AI Health Insights</h4>
                            </div>
                            <p className="text-sm font-medium leading-relaxed mb-4 opacity-90 italic">
                                "{steps < 500
                                    ? "Start your walk! Even 10 minutes of walking strengthens your heart and lifts your mood."
                                    : steps < 3000
                                        ? "Good momentum! Consistent walking helps regulate blood sugar and improves cardiovascular health."
                                        : steps < dailyGoal
                                            ? `You're ${Math.round((steps / dailyGoal) * 100)}% to your goal. Keep going — your body is actively burning stored energy right now.`
                                            : "Outstanding! You've crushed your daily goal. Your metabolism is elevated and your heart thanks you."
                                }"
                            </p>
                            <div className="flex items-center gap-6">
                                <div>
                                    <p className="text-[10px] uppercase font-black opacity-60 mb-1">Burned</p>
                                    <div className="flex items-center gap-1.5">
                                        <Flame className="w-4 h-4 text-orange-400" />
                                        <span className="text-lg font-black">{caloriesBurned} kcal</span>
                                    </div>
                                </div>
                                <div className="h-8 w-[1px] bg-white/20"></div>
                                <div>
                                    <p className="text-[10px] uppercase font-black opacity-60 mb-1">Progress</p>
                                    <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg ${steps >= dailyGoal
                                        ? 'bg-emerald-500/30 text-emerald-300'
                                        : steps > dailyGoal * 0.5
                                            ? 'bg-amber-500/30 text-amber-300'
                                            : 'bg-white/10 text-white/70'
                                        }`}>
                                        {steps >= dailyGoal ? '🏆 Goal Met!' : `${Math.round((steps / dailyGoal) * 100)}%`}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Goal Setting Modal */}
            <AnimatePresence>
                {isEditingGoal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsEditingGoal(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 relative z-10 shadow-2xl"
                        >
                            <h3 className="text-xl font-black text-black mb-1 tracking-tight">Set Daily Goal</h3>
                            <p className="text-xs text-slate-400 font-bold mb-6 uppercase tracking-widest">Steps per day target</p>

                            <div className="relative mb-8">
                                <input
                                    type="number"
                                    value={tempGoal}
                                    onChange={(e) => setTempGoal(parseInt(e.target.value) || 0)}
                                    className="w-full text-4xl font-black text-indigo-600 border-b-4 border-indigo-100 focus:border-indigo-500 transition-colors py-2 outline-none"
                                    autoFocus
                                />
                                <span className="absolute right-0 bottom-3 text-xs font-black text-slate-300 uppercase tracking-widest">Steps</span>
                            </div>

                            {/* Quick presets */}
                            <div className="flex gap-2 mb-6">
                                {[5000, 7000, 10000, 15000].map(preset => (
                                    <button
                                        key={preset}
                                        onClick={() => setTempGoal(preset)}
                                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${tempGoal === preset
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                                            }`}
                                    >
                                        {(preset / 1000)}k
                                    </button>
                                ))}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsEditingGoal(false)}
                                    className="flex-1 py-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-black transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveGoal}
                                    className="flex-1 py-4 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-indigo-100"
                                >
                                    Save Goal
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
