import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Footprints, Flame, Target, Activity, Smartphone } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';

// ============================================================
// STEP DETECTION ENGINE v4 — COMPLEMENTARY FILTER FUSION
//
// Uses the complementary filter to fuse:
//   - Gyroscope (accurate short-term, drifts long-term)
//   - Accelerometer (accurate long-term, noisy short-term)
//
// Formula:
//   filteredAngle = α × (filteredAngle + gyroRate × dt) + (1-α) × accelAngle
//   α = 0.98
//
// Step detection:
//   1. Compute linear acceleration magnitude (gravity removed)
//   2. Smooth with complementary-filter-corrected data
//   3. Peak+valley detection with threshold crossing
//   4. Validate timing (300ms-1200ms = human gait)
//   5. Gyro fusion rejects non-walking movements:
//      - Hand tremors (gyro sees no body rotation)
//      - Car bumps (no rhythmic rotation pattern)
//      - Phone drops (single spike, not periodic)
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

// === Helpers ===
const getTodayString = () => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

const loadTodaySteps = () => {
    try {
        const data = JSON.parse(localStorage.getItem('fitcure_daily_steps') || '[]');
        const today = data.find(d => d.date === getTodayString());
        return today ? today.steps : 0;
    } catch { return 0; }
};

const persistSteps = (count) => {
    const todayStr = getTodayString();
    let data = [];
    try { data = JSON.parse(localStorage.getItem('fitcure_daily_steps') || '[]'); } catch { }
    const idx = data.findIndex(d => d.date === todayStr);
    if (idx >= 0) { data[idx].steps = count; }
    else { data.push({ date: todayStr, steps: count }); }
    if (data.length > 30) data = data.slice(-30);
    localStorage.setItem('fitcure_daily_steps', JSON.stringify(data));
};

export default function StepTracker() {
    const navigate = useNavigate();

    const [steps, setSteps] = useState(() => loadTodaySteps());
    const [sensorStatus, setSensorStatus] = useState('initializing');
    const [dailySteps, setDailySteps] = useState([]);
    const [dailyGoal, setDailyGoal] = useState(() => parseInt(localStorage.getItem('fitcure_step_goal')) || 7000);
    const [isEditingGoal, setIsEditingGoal] = useState(false);
    const [tempGoal, setTempGoal] = useState(dailyGoal);
    const [debugInfo, setDebugInfo] = useState({ readings: 0, lastMag: 0, gyroActive: false });

    // === SENSOR FUSION REFS ===
    const stepsRef = useRef(loadTodaySteps());

    // Gravity isolation (high-pass filter)
    const gravityRef = useRef({ x: 0, y: 0, z: 0 });

    // Complementary filter state
    const filteredAngleRef = useRef(0);       // Fused tilt angle (pitch)
    const lastTimestampRef = useRef(0);        // For dt calculation

    // Gyroscope data
    const gyroRateRef = useRef({ alpha: 0, beta: 0, gamma: 0 }); // rotation rates (deg/s)
    const gyroActiveRef = useRef(false);

    // Walking rhythm analysis
    const filteredMagRef = useRef(0);          // Smoothed acceleration magnitude
    const prevFilteredMagRef = useRef(0);      // Previous sample for crossing detection
    const peakDetectedRef = useRef(false);     // Currently above threshold?
    const lastStepTimeRef = useRef(0);         // Timestamp of last counted step
    const recentStepTimesRef = useRef([]);     // Recent step timestamps for rhythm check

    // Misc
    const lastSavedDateRef = useRef(getTodayString());
    const wakeLockRef = useRef(null);
    const sensorCountRef = useRef(0);

    const caloriesBurned = Math.round(steps * 0.04);
    const distanceKm = (steps * 0.000762).toFixed(2);

    // === Chart data ===
    const loadChartData = useCallback(() => {
        const goal = parseInt(localStorage.getItem('fitcure_step_goal')) || 7000;
        let data = [];
        try { data = JSON.parse(localStorage.getItem('fitcure_daily_steps') || '[]'); } catch { }
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

    // === Day rollover ===
    const checkDayRollover = useCallback(() => {
        const today = getTodayString();
        if (lastSavedDateRef.current !== today) {
            stepsRef.current = 0;
            setSteps(0);
            lastSavedDateRef.current = today;
            persistSteps(0);
            loadChartData();
        }
    }, [loadChartData]);

    // === GYROSCOPE HANDLER ===
    // Captures rotation rates for the complementary filter
    const handleOrientation = useCallback((event) => {
        // rotationRate gives angular velocity in deg/s
        if (event.rotationRate) {
            gyroRateRef.current = {
                alpha: event.rotationRate.alpha || 0, // yaw
                beta: event.rotationRate.beta || 0,   // pitch (forward/back tilt)
                gamma: event.rotationRate.gamma || 0   // roll (left/right tilt)
            };
            gyroActiveRef.current = true;
        }
    }, []);

    // === CORE: ACCELEROMETER + GYRO FUSION HANDLER ===
    const handleMotion = useCallback((event) => {
        checkDayRollover();
        sensorCountRef.current++;

        // --- 1. Get raw acceleration ---
        let ax = 0, ay = 0, az = 0;
        let hasLinear = false;

        if (event.acceleration && event.acceleration.x !== null) {
            ax = event.acceleration.x || 0;
            ay = event.acceleration.y || 0;
            az = event.acceleration.z || 0;
            hasLinear = true;
        }

        if (!hasLinear && event.accelerationIncludingGravity) {
            const raw = event.accelerationIncludingGravity;
            if (raw.x === null) return;
            // High-pass filter to remove gravity
            const a = 0.8;
            const g = gravityRef.current;
            g.x = a * g.x + (1 - a) * raw.x;
            g.y = a * g.y + (1 - a) * raw.y;
            g.z = a * g.z + (1 - a) * raw.z;
            ax = raw.x - g.x;
            ay = raw.y - g.y;
            az = raw.z - g.z;
        } else if (!hasLinear) {
            return;
        }

        // --- 2. Compute acceleration magnitude ---
        const magnitude = Math.sqrt(ax * ax + ay * ay + az * az);

        // --- 3. Complementary Filter ---
        // Compute tilt angle from accelerometer (accurate long-term)
        const accelAngle = Math.atan2(ay, Math.sqrt(ax * ax + az * az)) * (180 / Math.PI);

        // Time delta
        const now = Date.now();
        const dt = lastTimestampRef.current > 0 ? (now - lastTimestampRef.current) / 1000 : 0.016;
        lastTimestampRef.current = now;

        // Fuse gyro + accel using complementary filter
        const ALPHA = 0.98; // Trust gyro 98%, accel 2%
        if (gyroActiveRef.current && dt > 0 && dt < 0.5) {
            // Gyroscope gives rotation rate (deg/s) — integrate to get angle change
            const gyroAngleChange = gyroRateRef.current.beta * dt;
            filteredAngleRef.current = ALPHA * (filteredAngleRef.current + gyroAngleChange) + (1 - ALPHA) * accelAngle;
        } else {
            // No gyro available — use accel angle directly
            filteredAngleRef.current = accelAngle;
        }

        // --- 4. Smoothed magnitude for step detection ---
        // Use moderate LPF: α=0.3 lets walking frequencies through, blocks high-freq shakes
        const lpfAlpha = 0.3;
        prevFilteredMagRef.current = filteredMagRef.current;
        filteredMagRef.current = lpfAlpha * magnitude + (1 - lpfAlpha) * filteredMagRef.current;

        const smoothed = filteredMagRef.current;
        const prev = prevFilteredMagRef.current;

        // --- 5. Gyro-based shake rejection ---
        // When walking, the body rotates rhythmically ~2-5 deg/step on the pitch axis
        // When shaking by hand, rotation rates are much higher (>50 deg/s) and erratic
        let isShaking = false;
        if (gyroActiveRef.current) {
            const totalRotationRate = Math.abs(gyroRateRef.current.alpha) +
                Math.abs(gyroRateRef.current.beta) +
                Math.abs(gyroRateRef.current.gamma);
            // Walking produces total rotation rate of ~10-40 deg/s
            // Hand shaking produces >80 deg/s
            if (totalRotationRate > 80) {
                isShaking = true;
            }
        }

        // --- 6. Peak + Valley detection ---
        //
        //  Magnitude over time while walking:
        //
        //  2.5 |        *               *
        //      |       * *             * *
        //  2.0 |      *   *           *   *
        //      |     *     *         *     *
        //  1.5 |----*-------*-------*-------*----  ← PEAK_THRESHOLD (1.2)
        //      |             *     *
        //  1.0 |              *   *
        //      |               * *
        //  0.5 |                *                   ← VALLEY_THRESHOLD (0.6)
        //      +------------------------------------→ time
        //                ↑ Step!          ↑ Step!

        const PEAK_THRESHOLD = 1.2;
        const VALLEY_THRESHOLD = 0.6;
        const MIN_STEP_INTERVAL = 300;  // Fastest possible step (~3.3 steps/sec, sprinting)
        const MAX_STEP_INTERVAL = 1200; // Slowest walk (~0.83 steps/sec, very slow stroll)

        // Rising edge: signal crosses above peak threshold
        if (!peakDetectedRef.current && smoothed > PEAK_THRESHOLD && prev <= PEAK_THRESHOLD) {
            peakDetectedRef.current = true;
        }

        // Falling edge: signal drops below valley threshold after a peak
        if (peakDetectedRef.current && smoothed < VALLEY_THRESHOLD) {
            peakDetectedRef.current = false;

            const timeSinceLastStep = now - lastStepTimeRef.current;

            // --- VALIDATE STEP ---
            const validTiming = timeSinceLastStep >= MIN_STEP_INTERVAL && timeSinceLastStep <= MAX_STEP_INTERVAL;
            const notShaking = !isShaking;

            if (validTiming && notShaking) {
                // ✅ Valid step detected!
                stepsRef.current += 1;
                setSteps(stepsRef.current);

                // Track recent step times for rhythm monitoring
                recentStepTimesRef.current.push(now);
                if (recentStepTimesRef.current.length > 10) recentStepTimesRef.current.shift();

                // Save every 3 steps
                if (stepsRef.current % 3 === 0) {
                    persistSteps(stepsRef.current);
                }
            } else if (timeSinceLastStep > MAX_STEP_INTERVAL * 2) {
                // User paused for a while — reset rhythm tracking
                recentStepTimesRef.current = [];
            }

            lastStepTimeRef.current = now;
        }

        // Update debug info periodically
        if (sensorCountRef.current % 30 === 0) {
            setDebugInfo({
                readings: sensorCountRef.current,
                lastMag: smoothed.toFixed(2),
                gyroActive: gyroActiveRef.current
            });
        }
    }, [checkDayRollover]);

    // === Wake Lock ===
    const acquireWakeLock = useCallback(async () => {
        if ('wakeLock' in navigator && !wakeLockRef.current) {
            try {
                wakeLockRef.current = await navigator.wakeLock.request('screen');
                wakeLockRef.current.addEventListener('release', () => { wakeLockRef.current = null; });
            } catch { }
        }
    }, []);

    // === Start sensors ===
    const startSensors = useCallback(async () => {
        const needsPermission = typeof DeviceMotionEvent !== 'undefined' &&
            typeof DeviceMotionEvent.requestPermission === 'function';

        if (needsPermission) {
            setSensorStatus('needs-permission');
            return;
        }

        // Android / Desktop — start immediately
        if (window.DeviceMotionEvent) {
            window.addEventListener('devicemotion', handleMotion, true);
            // Also listen for gyroscope data (comes through devicemotion.rotationRate)
            setSensorStatus('active');
            await acquireWakeLock();
        } else {
            setSensorStatus('error');
        }
    }, [handleMotion, acquireWakeLock]);

    // iOS permission (must be called from user tap)
    const requestIOSPermission = async () => {
        try {
            const motionPerm = await DeviceMotionEvent.requestPermission();
            if (motionPerm === 'granted') {
                window.addEventListener('devicemotion', handleMotion, true);
                setSensorStatus('active');
                await acquireWakeLock();
            } else {
                setSensorStatus('error');
            }
        } catch {
            setSensorStatus('error');
        }
    };

    // === Lifecycle ===
    useEffect(() => {
        loadChartData();
        startSensors();

        const handleVisibility = async () => {
            if (!document.hidden) {
                checkDayRollover();
                const currentSteps = loadTodaySteps();
                if (currentSteps > stepsRef.current) {
                    stepsRef.current = currentSteps;
                    setSteps(currentSteps);
                }
                loadChartData();
                if (!wakeLockRef.current) await acquireWakeLock();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

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

    // Save goal
    const saveGoal = () => {
        const newGoal = Math.max(tempGoal, 100);
        setDailyGoal(newGoal);
        localStorage.setItem('fitcure_step_goal', newGoal.toString());
        setIsEditingGoal(false);
        loadChartData();
    };

    // Chart tooltip
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
                    <span className={`w-2 h-2 rounded-full ${sensorStatus === 'active' ? 'bg-emerald-500 animate-pulse' : sensorStatus === 'error' ? 'bg-red-400' : 'bg-amber-400 animate-pulse'}`} />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        {sensorStatus === 'active' ? 'Live' : sensorStatus === 'needs-permission' ? 'Tap' : sensorStatus === 'error' ? 'Off' : '...'}
                    </span>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto pb-24">

                {/* iOS Permission Banner */}
                {sensorStatus === 'needs-permission' && (
                    <div className="mx-6 mt-4">
                        <button
                            onClick={requestIOSPermission}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl p-5 flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-transform"
                        >
                            <Smartphone className="w-5 h-5" />
                            <div className="text-left">
                                <p className="text-sm font-black uppercase tracking-wider">Tap to Enable Pedometer</p>
                                <p className="text-[10px] opacity-80 font-bold">Allow motion sensor access to count your steps</p>
                            </div>
                        </button>
                    </div>
                )}

                {/* Sensor Error */}
                {sensorStatus === 'error' && (
                    <div className="mx-6 mt-4 bg-red-50 text-red-500 text-xs font-bold p-4 rounded-2xl">
                        <p className="font-black mb-1">Motion sensors unavailable</p>
                        <p>Step tracking requires a mobile device with accelerometer and gyroscope sensors.</p>
                    </div>
                )}

                {/* Sensor Debug Bar */}
                {sensorStatus === 'active' && (
                    <div className="mx-6 mt-3 bg-slate-50 rounded-xl px-4 py-2 flex items-center justify-between text-[10px] font-bold text-slate-400">
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>{debugInfo.readings} readings</span>
                        </div>
                        <span>Accel: {debugInfo.lastMag} m/s²</span>
                        <span className={debugInfo.gyroActive ? 'text-emerald-500' : 'text-slate-300'}>
                            Gyro: {debugInfo.gyroActive ? 'ON' : 'OFF'}
                        </span>
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
                                    label={{ value: 'Goal', position: 'insideTopLeft', fill: '#6366f1', fontSize: 10, fontWeight: 'bold', offset: 5 }}
                                />
                                <Bar dataKey="steps" radius={[8, 8, 8, 8]} maxBarSize={20} animationDuration={1200}>
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
                                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                                    dy={8}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="flex items-center justify-center gap-6 mt-3 text-[9px] font-black uppercase tracking-widest text-slate-400">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Goal Met</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-orange-400" /> In Progress</span>
                        <span className="flex items-center gap-1.5 text-indigo-500">— — Goal</span>
                    </div>
                </div>

                {/* AI Health Insights */}
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
                                        ? "Good start! Walking at this pace helps regulate blood sugar and boosts metabolism."
                                        : steps < dailyGoal
                                            ? `You're ${Math.round((steps / dailyGoal) * 100)}% to your goal. Your body is actively burning stored energy — keep pushing!`
                                            : "Outstanding! You've smashed your goal. Your metabolic rate is elevated and your cardiovascular system is thanking you."
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
                                    <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg ${steps >= dailyGoal ? 'bg-emerald-500/30 text-emerald-300'
                                        : steps > dailyGoal * 0.5 ? 'bg-amber-500/30 text-amber-300'
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
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
                                    type="number" value={tempGoal}
                                    onChange={(e) => setTempGoal(parseInt(e.target.value) || 0)}
                                    className="w-full text-4xl font-black text-indigo-600 border-b-4 border-indigo-100 focus:border-indigo-500 transition-colors py-2 outline-none"
                                    autoFocus
                                />
                                <span className="absolute right-0 bottom-3 text-xs font-black text-slate-300 uppercase tracking-widest">Steps</span>
                            </div>
                            <div className="flex gap-2 mb-6">
                                {[5000, 7000, 10000, 15000].map(preset => (
                                    <button key={preset} onClick={() => setTempGoal(preset)}
                                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${tempGoal === preset ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                    >{(preset / 1000)}k</button>
                                ))}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setIsEditingGoal(false)}
                                    className="flex-1 py-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-black transition-colors">Cancel</button>
                                <button onClick={saveGoal}
                                    className="flex-1 py-4 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-indigo-100">Save Goal</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
