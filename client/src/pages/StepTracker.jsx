import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Calendar, Footprints, Flame, Target, Play, Square, AlertCircle, RotateCcw, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';

const CircularProgress = ({ value, max }) => {
    // Semi-circle SVG implementation
    const radius = 120;
    const stroke = 18;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * Math.PI; // Half circle
    const strokeDashoffset = circumference - (Math.min(value, max) / max) * circumference;

    return (
        <div className="relative flex justify-center items-center my-8">
            <svg
                height={radius}
                width={radius * 2}
                className="transform"
                style={{ overflow: 'visible' }}
            >
                {/* Dotted background arc */}
                <path
                    d={`M ${stroke * 2} ${radius} A ${normalizedRadius} ${normalizedRadius} 0 0 1 ${radius * 2 - stroke * 2} ${radius}`}
                    fill="none"
                    stroke="#F1F5F9"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray="4 16"
                />

                {/* Foreground progress arc */}
                <path
                    d={`M ${stroke * 2} ${radius} A ${normalizedRadius} ${normalizedRadius} 0 0 1 ${radius * 2 - stroke * 2} ${radius}`}
                    fill="none"
                    stroke="#4ade80"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-end -bottom-2">
                <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mb-2">
                    <Footprints className="w-7 h-7 text-green-500 transform -rotate-12" />
                </div>
                <span className="text-4xl font-extrabold text-green-500 tracking-tight">{value}</span>
                <span className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Of {max} Steps</span>
            </div>
        </div>
    );
};

export default function StepTracker() {
    const navigate = useNavigate();

    // Core tracking state
    const [isTracking, setIsTracking] = useState(false);
    const [steps, setSteps] = useState(0);
    const [errorMsg, setErrorMsg] = useState('');
    const [permissionGranted, setPermissionGranted] = useState(false);

    // UI state
    const [dailySteps, setDailySteps] = useState([]);
    const [dailyGoal, setDailyGoal] = useState(() => {
        const saved = localStorage.getItem('fitcure_step_goal');
        return saved ? parseInt(saved) : 7000;
    });
    const [isEditingGoal, setIsEditingGoal] = useState(false);
    const [tempGoal, setTempGoal] = useState(dailyGoal);

    const saveGoal = () => {
        setDailyGoal(tempGoal);
        localStorage.setItem('fitcure_step_goal', tempGoal.toString());
        setIsEditingGoal(false);
    };

    // --- Sensor Fusion Variables ---
    const lastPeakTimeRef = useRef(0);
    const gravityRef = useRef({ x: 0, y: 0, z: 0 });
    const smoothedAccelRef = useRef(0);

    const ACCEL_THRESHOLD = 1.5;
    const LPF_ALPHA = 0.15;
    const GRAVITY_ALPHA = 0.8;
    const TREMOR_THRESHOLD = 5;

    const currentOrientationRef = useRef({ beta: 0, gamma: 0 });
    const lastOrientationRef = useRef({ beta: 0, gamma: 0 });

    // AI calculated calories (approximate metabolic equivalent formula)
    // Walking ~0.04 cal per step for average adult
    const caloriesBurned = Math.round(steps * 0.04);

    useEffect(() => {
        loadDailySteps();

        const todayStr = getTodayString();
        const savedData = localStorage.getItem('fitcure_daily_steps');
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                const todayData = parsedData.find(d => d.date === todayStr);
                if (todayData) {
                    setSteps(todayData.steps);
                }
            } catch (e) {
                console.error("Failed to parse saved steps", e);
            }
        }
    }, []);

    useEffect(() => {
        if (steps > 0) {
            saveTodaySteps(steps);
        }
    }, [steps]);

    const getTodayString = () => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    };

    const loadDailySteps = () => {
        const savedData = localStorage.getItem('fitcure_daily_steps');
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                const chartData = parsedData.map(item => {
                    const dateObj = new Date(item.date);
                    return {
                        ...item,
                        displayDate: dateObj.toLocaleDateString('en-US', { weekday: 'short' })
                    };
                });

                // Ensure we have 7 days of data for the graph
                let last7Days = chartData.slice(-7);
                // Fill if less than 7
                if (last7Days.length < 7) {
                    const dummyData = [];
                    for (let i = 7 - last7Days.length; i > 0; i--) {
                        dummyData.push({ steps: 0, displayDate: '-' });
                    }
                    last7Days = [...dummyData, ...last7Days];
                }

                setDailySteps(last7Days);
            } catch (e) {
                setDailySteps([]);
            }
        } else {
            setDailySteps(Array(7).fill({ steps: 0, displayDate: '-' }));
        }
    };

    const saveTodaySteps = (currentSteps) => {
        const todayStr = getTodayString();
        const savedData = localStorage.getItem('fitcure_daily_steps');
        let parsedData = [];

        if (savedData) {
            try {
                parsedData = JSON.parse(savedData);
            } catch (e) { }
        }

        const existingDayIndex = parsedData.findIndex(d => d.date === todayStr);

        if (existingDayIndex >= 0) {
            if (currentSteps > parsedData[existingDayIndex].steps) {
                parsedData[existingDayIndex].steps = currentSteps;
            }
        } else {
            parsedData.push({ date: todayStr, steps: currentSteps });
        }

        localStorage.setItem('fitcure_daily_steps', JSON.stringify(parsedData));
    };

    const requestPermission = async () => {
        let motionGranted = false;
        let orientationGranted = false;

        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const permissionState = await DeviceMotionEvent.requestPermission();
                motionGranted = permissionState === 'granted';
            } catch (error) { }
        } else {
            motionGranted = true;
        }

        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permissionState = await DeviceOrientationEvent.requestPermission();
                orientationGranted = permissionState === 'granted';
            } catch (error) { }
        } else {
            orientationGranted = true;
        }

        if (motionGranted && orientationGranted) {
            setPermissionGranted(true);
            return true;
        } else {
            setErrorMsg('Permission to access device sensors was denied.');
            return false;
        }
    };

    const handleDeviceOrientation = (event) => {
        lastOrientationRef.current = { ...currentOrientationRef.current };
        currentOrientationRef.current = {
            beta: event.beta || 0,
            gamma: event.gamma || 0
        };
    };

    const handleDeviceMotion = (event) => {
        let rawAx = 0, rawAy = 0, rawAz = 0;
        let includesGravity = false;

        if (event.accelerationIncludingGravity && event.accelerationIncludingGravity.x !== null) {
            rawAx = event.accelerationIncludingGravity.x;
            rawAy = event.accelerationIncludingGravity.y;
            rawAz = event.accelerationIncludingGravity.z;
            includesGravity = true;
        } else if (event.acceleration && event.acceleration.x !== null) {
            rawAx = event.acceleration.x;
            rawAy = event.acceleration.y;
            rawAz = event.acceleration.z;
            includesGravity = false;
        } else {
            return;
        }

        let linearAx = rawAx, linearAy = rawAy, linearAz = rawAz;

        if (includesGravity) {
            gravityRef.current.x = GRAVITY_ALPHA * gravityRef.current.x + (1 - GRAVITY_ALPHA) * rawAx;
            gravityRef.current.y = GRAVITY_ALPHA * gravityRef.current.y + (1 - GRAVITY_ALPHA) * rawAy;
            gravityRef.current.z = GRAVITY_ALPHA * gravityRef.current.z + (1 - GRAVITY_ALPHA) * rawAz;

            linearAx = rawAx - gravityRef.current.x;
            linearAy = rawAy - gravityRef.current.y;
            linearAz = rawAz - gravityRef.current.z;
        }

        const linearMagnitude = Math.sqrt(linearAx * linearAx + linearAy * linearAy + linearAz * linearAz);
        smoothedAccelRef.current = LPF_ALPHA * linearMagnitude + (1 - LPF_ALPHA) * smoothedAccelRef.current;

        const deltaBeta = Math.abs(currentOrientationRef.current.beta - lastOrientationRef.current.beta);
        const deltaGamma = Math.abs(currentOrientationRef.current.gamma - lastOrientationRef.current.gamma);

        const isTremor = deltaBeta > TREMOR_THRESHOLD || deltaGamma > TREMOR_THRESHOLD;
        const currentTime = Date.now();

        if (smoothedAccelRef.current > ACCEL_THRESHOLD && !isTremor) {
            if (currentTime - lastPeakTimeRef.current > 320) {
                setSteps(prev => {
                    const next = prev + 1;
                    return next;
                });
                lastPeakTimeRef.current = currentTime;
            }
        }
    };

    const startTracking = async () => {
        setErrorMsg('');
        let granted = permissionGranted;
        if (!granted) {
            granted = await requestPermission();
        }

        if (granted) {
            if (window.DeviceMotionEvent && window.DeviceOrientationEvent) {
                window.addEventListener('deviceorientation', handleDeviceOrientation, true);
                window.addEventListener('devicemotion', handleDeviceMotion, true);
                setIsTracking(true);

                if ('wakeLock' in navigator) {
                    try {
                        window.wakeLockRef = await navigator.wakeLock.request('screen');
                    } catch (err) { }
                }
            } else {
                setErrorMsg('Motion APIs not supported.');
            }
        }
    };

    const stopTracking = () => {
        window.removeEventListener('deviceorientation', handleDeviceOrientation, true);
        window.removeEventListener('devicemotion', handleDeviceMotion, true);
        setIsTracking(false);

        if (window.wakeLockRef) {
            window.wakeLockRef.release().then(() => {
                window.wakeLockRef = null;
            });
        }
    };

    useEffect(() => {
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission !== 'function') {
            setPermissionGranted(true);
        }

        return () => {
            window.removeEventListener('deviceorientation', handleDeviceOrientation, true);
            window.removeEventListener('devicemotion', handleDeviceMotion, true);
            if (window.wakeLockRef) {
                window.wakeLockRef.release();
            }
        };
    }, []);

    // Tooltip format
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-800 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-lg shadow-lg">
                    {payload[0].value} Steps
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
                <button className="text-slate-400 hover:text-black transition-colors">
                    <Calendar className="w-5 h-5" />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto pb-10">
                {/* Tracker Controls - MOVED TO TOP */}
                <div className="p-6 pb-2">
                    {errorMsg && (
                        <div className="bg-red-50 text-red-500 text-xs font-bold p-3 rounded-2xl mb-4 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {errorMsg}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={isTracking ? stopTracking : startTracking}
                            className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-md text-xs flex items-center justify-center gap-2 ${isTracking
                                ? 'bg-rose-50 text-rose-600 border border-rose-100 shadow-none'
                                : 'bg-indigo-600 text-white shadow-indigo-200 hover:shadow-indigo-400'
                                }`}
                        >
                            {isTracking ? <><Square className="w-4 h-4" fill="currentColor" /> Stop Walk</> : <><Play className="w-4 h-4" fill="currentColor" /> Start Tracking</>}
                        </button>

                        <button
                            onClick={() => {
                                if (window.confirm("Reset steps?")) {
                                    setSteps(0);
                                    saveTodaySteps(0);
                                }
                            }}
                            className="w-14 bg-white border border-slate-200 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm"
                        >
                            <RotateCcw className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="bg-white p-6 pb-8 border-b border-t border-slate-100 mt-2">
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
                            <p className="text-2xl font-black text-black">{caloriesBurned}<span className="text-[10px] text-slate-400 font-bold ml-1">Cal</span></p>
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
                </div>

                <div className="bg-white p-6 mt-3">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-black text-slate-800">Today Activity</h3>
                        <div className="bg-slate-50 px-3 py-1.5 rounded-xl flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Today <ChevronLeft className="w-3 h-3 rotate-270" />
                        </div>
                    </div>

                    <div className="w-full h-40">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dailySteps} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                                <Bar
                                    dataKey="steps"
                                    fill="#fb923c"
                                    radius={[10, 10, 10, 10]}
                                    maxBarSize={8}
                                    animationDuration={1500}
                                />
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
                                "{steps < 1000 ? "You're just starting! Every step builds heart health." :
                                    steps < 5000 ? "Active start! You've burned enough calories to offset a small snack. Keep pushing for that goal." :
                                        "Outstanding activity level! Your metabolic rate is significantly elevated. You've burned roughly equivalent to a light meal today."}"
                            </p>
                            <div className="flex items-center gap-6">
                                <div>
                                    <p className="text-[10px] uppercase font-black opacity-60 mb-1">Burned</p>
                                    <span className="text-lg font-black">{caloriesBurned} kcal</span>
                                </div>
                                <div className="h-8 w-[1px] bg-white/10"></div>
                                <div>
                                    <p className="text-[10px] uppercase font-black opacity-60 mb-1">Status</p>
                                    <span className="text-xs font-black px-2 py-0.5 bg-emerald-500/30 rounded-lg text-emerald-300">
                                        {steps > dailyGoal / 2 ? "Active" : "Stable"}
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
