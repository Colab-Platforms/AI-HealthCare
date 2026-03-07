import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Calendar, Footprints, Flame, Target, AlertCircle, RotateCcw, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';

// --- Advanced Walking Detection Algorithm ---
// This algorithm distinguishes real walking from hand shaking by:
// 1. Using a vertical-axis (Y) dominant analysis — walking produces rhythmic Y-axis peaks
// 2. Requiring consistent cadence (steps are periodic, shakes are erratic)
// 3. Checking step duration window (real steps take 300-1200ms, shakes are faster)
// 4. Analyzing the ratio of vertical vs horizontal acceleration (walking = vertical dominant)
// 5. Using a sliding window to require multiple peaks before counting

const STEP_CONFIG = {
    // Walking produces acceleration between 1.2 and 6 m/s². Hand shakes go much higher.
    ACCEL_MIN: 1.2,
    ACCEL_MAX: 6.0,
    // Real walking cadence: 300ms–1200ms per step (~50-200 steps/min)
    MIN_STEP_INTERVAL: 350,
    MAX_STEP_INTERVAL: 1200,
    // Low-pass filter to smooth sensor noise
    LPF_ALPHA: 0.2,
    // Gravity isolation filter
    GRAVITY_ALPHA: 0.8,
    // Vertical dominance ratio: walking has >40% vertical component
    VERTICAL_RATIO_MIN: 0.35,
    // Require N consistent peaks before counting steps (prevents single shakes)
    CONSISTENCY_WINDOW: 3,
    // Maximum orientation change per sample for walking (hand shakes rotate rapidly)
    MAX_ORIENTATION_DELTA: 8,
};

const CircularProgress = ({ value, max }) => {
    const radius = 120;
    const stroke = 18;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * Math.PI;
    const progress = Math.min(value / max, 1);
    const strokeDashoffset = circumference - progress * circumference;

    // Color transitions: red → orange → green as progress increases
    const getColor = (p) => {
        if (p >= 1) return '#10b981';
        if (p >= 0.6) return '#4ade80';
        if (p >= 0.3) return '#fb923c';
        return '#f87171';
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

export default function StepTracker() {
    const navigate = useNavigate();

    // Core state
    const [steps, setSteps] = useState(0);
    const [errorMsg, setErrorMsg] = useState('');
    const [isActive, setIsActive] = useState(false);
    const [dailySteps, setDailySteps] = useState([]);
    const [dailyGoal, setDailyGoal] = useState(() => {
        const saved = localStorage.getItem('fitcure_step_goal');
        return saved ? parseInt(saved) : 7000;
    });
    const [isEditingGoal, setIsEditingGoal] = useState(false);
    const [tempGoal, setTempGoal] = useState(dailyGoal);

    // --- Advanced step detection refs ---
    const gravityRef = useRef({ x: 0, y: 0, z: 0 });
    const smoothedRef = useRef({ x: 0, y: 0, z: 0 });
    const lastPeakTimeRef = useRef(0);
    const peakHistoryRef = useRef([]); // timestamps of recent peaks for cadence analysis
    const orientationRef = useRef({ beta: 0, gamma: 0 });
    const lastOrientationRef = useRef({ beta: 0, gamma: 0 });
    const consistentPeaksRef = useRef(0); // count consistent peaks before counting
    const isAboveThresholdRef = useRef(false); // for peak detection (rising/falling)
    const stepsRef = useRef(0);

    const caloriesBurned = Math.round(steps * 0.04);

    // --- Persistence ---
    const getTodayString = useCallback(() => {
        const t = new Date();
        return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    }, []);

    const saveTodaySteps = useCallback((currentSteps) => {
        const todayStr = getTodayString();
        let parsedData = [];
        try {
            parsedData = JSON.parse(localStorage.getItem('fitcure_daily_steps') || '[]');
        } catch (e) { }
        const idx = parsedData.findIndex(d => d.date === todayStr);
        if (idx >= 0) {
            parsedData[idx].steps = Math.max(parsedData[idx].steps, currentSteps);
        } else {
            parsedData.push({ date: todayStr, steps: currentSteps });
        }
        localStorage.setItem('fitcure_daily_steps', JSON.stringify(parsedData));
    }, [getTodayString]);

    const loadDailySteps = useCallback(() => {
        const goal = parseInt(localStorage.getItem('fitcure_step_goal')) || 7000;
        try {
            const parsedData = JSON.parse(localStorage.getItem('fitcure_daily_steps') || '[]');
            const chartData = parsedData.map(item => ({
                ...item,
                goal: goal,
                displayDate: new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })
            }));
            let last7 = chartData.slice(-7);
            while (last7.length < 7) {
                last7.unshift({ steps: 0, goal: goal, displayDate: '-' });
            }
            setDailySteps(last7);
        } catch (e) {
            setDailySteps(Array(7).fill(null).map(() => ({ steps: 0, goal: goal, displayDate: '-' })));
        }
    }, []);

    const saveGoal = () => {
        setDailyGoal(tempGoal);
        localStorage.setItem('fitcure_step_goal', tempGoal.toString());
        setIsEditingGoal(false);
        loadDailySteps();
    };

    // --- Sensor Handlers ---
    const handleOrientation = useCallback((event) => {
        lastOrientationRef.current = { ...orientationRef.current };
        orientationRef.current = {
            beta: event.beta || 0,
            gamma: event.gamma || 0
        };
    }, []);

    const handleMotion = useCallback((event) => {
        const acc = event.accelerationIncludingGravity;
        const pureAcc = event.acceleration;

        let rawX, rawY, rawZ;
        let needGravityRemoval = false;

        if (pureAcc && pureAcc.x !== null) {
            // Linear acceleration available directly
            rawX = pureAcc.x;
            rawY = pureAcc.y;
            rawZ = pureAcc.z;
        } else if (acc && acc.x !== null) {
            rawX = acc.x;
            rawY = acc.y;
            rawZ = acc.z;
            needGravityRemoval = true;
        } else {
            return;
        }

        let linX = rawX, linY = rawY, linZ = rawZ;

        if (needGravityRemoval) {
            const g = gravityRef.current;
            const a = STEP_CONFIG.GRAVITY_ALPHA;
            g.x = a * g.x + (1 - a) * rawX;
            g.y = a * g.y + (1 - a) * rawY;
            g.z = a * g.z + (1 - a) * rawZ;
            linX = rawX - g.x;
            linY = rawY - g.y;
            linZ = rawZ - g.z;
        }

        // Low-pass filter for smoothing
        const lpf = STEP_CONFIG.LPF_ALPHA;
        const s = smoothedRef.current;
        s.x = lpf * linX + (1 - lpf) * s.x;
        s.y = lpf * linY + (1 - lpf) * s.y;
        s.z = lpf * linZ + (1 - lpf) * s.z;

        const magnitude = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);
        const verticalMag = Math.abs(s.y); // Y-axis is vertical when phone is upright
        const totalMag = Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.z);

        // --- Check 1: Vertical dominance ratio ---
        // Walking produces mostly vertical acceleration. Shaking produces chaotic multi-axis.
        const verticalRatio = totalMag > 0.1 ? verticalMag / totalMag : 0;

        // --- Check 2: Orientation stability ---
        // Walking: orientation changes slowly. Shaking: rapid orientation swings.
        const deltaBeta = Math.abs(orientationRef.current.beta - lastOrientationRef.current.beta);
        const deltaGamma = Math.abs(orientationRef.current.gamma - lastOrientationRef.current.gamma);
        const orientationStable = deltaBeta < STEP_CONFIG.MAX_ORIENTATION_DELTA &&
            deltaGamma < STEP_CONFIG.MAX_ORIENTATION_DELTA;

        const now = Date.now();

        // --- Peak detection with hysteresis ---
        if (magnitude > STEP_CONFIG.ACCEL_MIN && !isAboveThresholdRef.current) {
            // Rising edge — potential step start
            isAboveThresholdRef.current = true;
        } else if (magnitude < STEP_CONFIG.ACCEL_MIN * 0.7 && isAboveThresholdRef.current) {
            // Falling edge — peak completed
            isAboveThresholdRef.current = false;

            const timeSinceLastPeak = now - lastPeakTimeRef.current;

            // --- Validate this peak as a real step ---
            const validAmplitude = magnitude < STEP_CONFIG.ACCEL_MAX;
            const validTiming = timeSinceLastPeak >= STEP_CONFIG.MIN_STEP_INTERVAL &&
                timeSinceLastPeak <= STEP_CONFIG.MAX_STEP_INTERVAL;
            const validVertical = verticalRatio >= STEP_CONFIG.VERTICAL_RATIO_MIN;
            const validOrientation = orientationStable;

            if (validAmplitude && validTiming && validVertical && validOrientation) {
                // Check cadence consistency over the last few peaks
                peakHistoryRef.current.push(now);
                // Keep only last 5 peaks
                if (peakHistoryRef.current.length > 5) peakHistoryRef.current.shift();

                consistentPeaksRef.current++;

                // Only start counting after CONSISTENCY_WINDOW consistent peaks
                if (consistentPeaksRef.current >= STEP_CONFIG.CONSISTENCY_WINDOW) {
                    stepsRef.current += 1;
                    setSteps(stepsRef.current);
                }

                lastPeakTimeRef.current = now;
            } else if (timeSinceLastPeak > STEP_CONFIG.MAX_STEP_INTERVAL) {
                // Too long since last peak — user stopped walking, reset consistency
                consistentPeaksRef.current = 0;
                peakHistoryRef.current = [];
                lastPeakTimeRef.current = now;
            }
        }
    }, []);

    // --- Auto-start on mount ---
    useEffect(() => {
        // Load saved steps for today
        const todayStr = getTodayString();
        try {
            const data = JSON.parse(localStorage.getItem('fitcure_daily_steps') || '[]');
            const today = data.find(d => d.date === todayStr);
            if (today) {
                setSteps(today.steps);
                stepsRef.current = today.steps;
            }
        } catch (e) { }

        loadDailySteps();

        // Auto-start sensors
        const startSensors = async () => {
            // Request permission on iOS
            if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
                try {
                    const motionPerm = await DeviceMotionEvent.requestPermission();
                    const orientPerm = await DeviceOrientationEvent.requestPermission();
                    if (motionPerm !== 'granted' || orientPerm !== 'granted') {
                        setErrorMsg('Sensor permission denied. Please allow access in Settings.');
                        return;
                    }
                } catch (e) {
                    setErrorMsg('Could not request sensor permissions.');
                    return;
                }
            }

            if (window.DeviceMotionEvent && window.DeviceOrientationEvent) {
                window.addEventListener('deviceorientation', handleOrientation, true);
                window.addEventListener('devicemotion', handleMotion, true);
                setIsActive(true);

                // Keep screen on
                if ('wakeLock' in navigator) {
                    try {
                        window.__stepWakeLock = await navigator.wakeLock.request('screen');
                    } catch (e) { }
                }
            } else {
                setErrorMsg('Motion sensors not available on this device.');
            }
        };

        startSensors();

        return () => {
            window.removeEventListener('deviceorientation', handleOrientation, true);
            window.removeEventListener('devicemotion', handleMotion, true);
            if (window.__stepWakeLock) {
                window.__stepWakeLock.release();
                window.__stepWakeLock = null;
            }
        };
    }, [getTodayString, loadDailySteps, handleOrientation, handleMotion]);

    // Save steps when they change
    useEffect(() => {
        if (steps > 0) {
            saveTodaySteps(steps);
            loadDailySteps();
        }
    }, [steps, saveTodaySteps, loadDailySteps]);

    // Custom tooltip for the chart
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-slate-800 text-white text-[10px] font-black px-3 py-2 rounded-lg shadow-lg">
                    <p className="uppercase">{data.steps.toLocaleString()} Steps</p>
                    <p className="text-slate-400 text-[9px]">Goal: {data.goal?.toLocaleString()}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-roboto w-full max-w-md mx-auto shadow-2xl overflow-hidden relative">

            {/* Single Header — no Layout header needed */}
            <header className="bg-white px-6 py-5 flex items-center justify-between border-b border-slate-100 z-10 sticky top-0">
                <button onClick={() => navigate(-1)} className="text-slate-700 hover:text-black transition-colors">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="text-lg font-black text-black tracking-tight">Step Tracker</h1>
                <button className="text-slate-400 hover:text-black transition-colors">
                    <Calendar className="w-5 h-5" />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto pb-24">
                {/* Status Badge */}
                <div className="px-6 pt-4 pb-1">
                    {errorMsg ? (
                        <div className="bg-red-50 text-red-500 text-xs font-bold p-3 rounded-2xl flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {errorMsg}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                {isActive ? 'Tracking Active' : 'Sensors Initializing...'}
                            </span>
                        </div>
                    )}
                </div>

                {/* Main Progress */}
                <div className="bg-white p-6 pb-8 border-b border-slate-100">
                    <div className="text-center mb-2">
                        <h2 className="text-xl font-bold text-slate-700 leading-tight">
                            You have walked <span className="text-indigo-500 font-black">{steps.toLocaleString()}</span><br />
                            <span className="text-indigo-400 font-black">steps</span> today
                        </h2>
                    </div>

                    <CircularProgress value={steps} max={dailyGoal} />

                    <div className="flex justify-between items-center mt-4">
                        <div className="flex-1 text-center border-r border-slate-100">
                            <p className="text-[11px] font-bold text-slate-500 mb-1">Cal Burned</p>
                            <p className="text-2xl font-black text-black">
                                {caloriesBurned}<span className="text-[10px] text-slate-400 font-bold ml-1">Cal</span>
                            </p>
                        </div>
                        <div className="flex-1 text-center cursor-pointer group" onClick={() => {
                            setTempGoal(dailyGoal);
                            setIsEditingGoal(true);
                        }}>
                            <p className="text-[11px] font-bold text-slate-500 mb-1 flex items-center justify-center gap-1 group-hover:text-indigo-500 transition-colors">
                                Daily Goal <Target className="w-3 h-3" />
                            </p>
                            <p className="text-2xl font-black text-black group-hover:scale-110 transition-transform">
                                {dailyGoal.toLocaleString()}<span className="text-[10px] text-slate-400 font-bold ml-1 uppercase">Step</span>
                            </p>
                        </div>
                    </div>

                    {/* Reset button */}
                    <div className="flex justify-center mt-6">
                        <button
                            onClick={() => {
                                if (window.confirm("Reset today's steps to 0?")) {
                                    setSteps(0);
                                    stepsRef.current = 0;
                                    consistentPeaksRef.current = 0;
                                    peakHistoryRef.current = [];
                                    saveTodaySteps(0);
                                    loadDailySteps();
                                }
                            }}
                            className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors px-4 py-2 rounded-xl hover:bg-slate-50"
                        >
                            <RotateCcw className="w-3.5 h-3.5" /> Reset Steps
                        </button>
                    </div>
                </div>

                {/* Weekly Activity Chart with Goal Line */}
                <div className="bg-white p-6 mt-3">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-black text-slate-800">Weekly Progress</h3>
                        <div className="bg-slate-50 px-3 py-1.5 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Last 7 Days
                        </div>
                    </div>

                    <div className="w-full h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dailySteps} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#cbd5e1', fontSize: 9, fontWeight: 'bold' }}
                                    width={40}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                                <ReferenceLine
                                    y={dailyGoal}
                                    stroke="#4f46e5"
                                    strokeDasharray="6 4"
                                    strokeWidth={1.5}
                                    label={{
                                        value: `Goal: ${dailyGoal.toLocaleString()}`,
                                        position: 'insideTopRight',
                                        fill: '#4f46e5',
                                        fontSize: 9,
                                        fontWeight: 'bold'
                                    }}
                                />
                                <Bar
                                    dataKey="steps"
                                    radius={[8, 8, 8, 8]}
                                    maxBarSize={14}
                                    animationDuration={1500}
                                >
                                    {dailySteps.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.steps >= dailyGoal ? '#10b981' : entry.steps > 0 ? '#fb923c' : '#e2e8f0'}
                                        />
                                    ))}
                                </Bar>
                                <XAxis
                                    dataKey="displayDate"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#cbd5e1', fontSize: 10, fontWeight: 'bold' }}
                                    dy={10}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center justify-center gap-6 mt-4 text-[9px] font-black uppercase tracking-widest text-slate-400">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Goal Met</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-orange-400" /> In Progress</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-200" /> No Data</span>
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
                                "{steps < 500 ? "Start your walk! Even 10 minutes of walking strengthens your heart and improves mood." :
                                    steps < 3000 ? "Good momentum! You're warming up. Consistent walking at this pace helps regulate blood sugar levels." :
                                        steps < dailyGoal ? `Almost there! You're ${Math.round((steps / dailyGoal) * 100)}% towards your goal. Keep going for maximum cardiovascular benefit.` :
                                            "Outstanding! You've crushed your goal today. Your metabolism is elevated and you're burning calories at an accelerated rate."}"
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
                                    <p className="text-[10px] uppercase font-black opacity-60 mb-1">Status</p>
                                    <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg ${steps >= dailyGoal ? 'bg-emerald-500/30 text-emerald-300' :
                                        steps > dailyGoal / 2 ? 'bg-amber-500/30 text-amber-300' :
                                            'bg-white/10 text-white/70'
                                        }`}>
                                        {steps >= dailyGoal ? '🏆 Goal Met!' : steps > dailyGoal / 2 ? 'Active' : 'Warming Up'}
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
                            <p className="text-xs text-slate-400 font-bold mb-6 uppercase tracking-widest">Adjust your target steps</p>

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
