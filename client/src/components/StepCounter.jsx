import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Footprints, Play, Square, AlertCircle, BarChart2, X, RotateCcw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const StepCounter = () => {
    const [isTracking, setIsTracking] = useState(false);
    const [steps, setSteps] = useState(0);
    const [errorMsg, setErrorMsg] = useState('');
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [showGraph, setShowGraph] = useState(false);
    const [dailySteps, setDailySteps] = useState([]);

    // Peak detection variables
    const lastPeakTimeRef = useRef(0);
    const threshold = 1.2; // Acceleration threshold (m/s^2)
    const alpha = 0.8; // Low pass filter constant
    const gravityRef = useRef(9.81); // Initial gravity estimate

    // Load saved steps on mount
    useEffect(() => {
        loadDailySteps();

        // Check for today's saved steps to resume
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

    // Save steps automatically when they change
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

                // Format for chart (e.g. "Mar 07")
                const chartData = parsedData.map(item => {
                    const dateObj = new Date(item.date);
                    const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return {
                        ...item,
                        displayDate: formattedDate
                    };
                });

                // Keep only last 7 days
                const last7Days = chartData.slice(-7);
                setDailySteps(last7Days);
            } catch (e) {
                console.error("Failed to parse saved steps", e);
                setDailySteps([]);
            }
        } else {
            // Initialize with empty array if no data
            setDailySteps([]);
        }
    };

    const saveTodaySteps = (currentSteps) => {
        const todayStr = getTodayString();
        const savedData = localStorage.getItem('fitcure_daily_steps');
        let parsedData = [];

        if (savedData) {
            try {
                parsedData = JSON.parse(savedData);
            } catch (e) {
                console.error("Failed to parse saved steps", e);
            }
        }

        const existingDayIndex = parsedData.findIndex(d => d.date === todayStr);

        if (existingDayIndex >= 0) {
            // Only update if current steps are higher (handles page refresh)
            if (currentSteps > parsedData[existingDayIndex].steps) {
                parsedData[existingDayIndex].steps = currentSteps;
            }
        } else {
            parsedData.push({ date: todayStr, steps: currentSteps });
        }

        localStorage.setItem('fitcure_daily_steps', JSON.stringify(parsedData));

        // Refresh local state if graph is open
        if (showGraph) {
            loadDailySteps();
        }
    };

    const resetTodaySteps = () => {
        if (window.confirm("Are you sure you want to reset today's step count to zero?")) {
            setSteps(0);

            const todayStr = getTodayString();
            const savedData = localStorage.getItem('fitcure_daily_steps');
            if (savedData) {
                try {
                    let parsedData = JSON.parse(savedData);
                    const existingDayIndex = parsedData.findIndex(d => d.date === todayStr);
                    if (existingDayIndex >= 0) {
                        parsedData[existingDayIndex].steps = 0;
                        localStorage.setItem('fitcure_daily_steps', JSON.stringify(parsedData));
                        loadDailySteps();
                    }
                } catch (e) {
                    console.error("Failed to reset steps", e);
                }
            }
        }
    };

    const requestPermission = async () => {
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const permissionState = await DeviceMotionEvent.requestPermission();
                if (permissionState === 'granted') {
                    setPermissionGranted(true);
                    return true;
                } else {
                    setErrorMsg('Permission to access device motion was denied.');
                    return false;
                }
            } catch (error) {
                console.error(error);
                setErrorMsg('Error requesting device motion permission.');
                return false;
            }
        } else {
            // Non-iOS 13+ devices
            setPermissionGranted(true);
            return true;
        }
    };

    const processMagnitude = (magnitude, includesGravity) => {
        let accelerationWithoutGravity = magnitude;

        if (includesGravity) {
            // Update gravity estimate using a low-pass filter
            gravityRef.current = alpha * gravityRef.current + (1 - alpha) * magnitude;
            // High-pass filter to get purely the acceleration
            accelerationWithoutGravity = magnitude - gravityRef.current;
        }

        const currentTime = Date.now();

        // Detect peak (absolute value to capture both foot strikes)
        if (Math.abs(accelerationWithoutGravity) > threshold) {
            // Debounce: 350ms minimum between steps to prevent double-counting
            if (currentTime - lastPeakTimeRef.current > 350) {
                setSteps(prev => prev + 1);
                lastPeakTimeRef.current = currentTime;
            }
        }
    };

    const handleDeviceMotion = (event) => {
        // Option 1: Try acceleration Including gravity
        if (event.accelerationIncludingGravity &&
            event.accelerationIncludingGravity.x !== null) {
            const { x, y, z } = event.accelerationIncludingGravity;
            const magnitude = Math.sqrt(x * x + y * y + z * z);
            processMagnitude(magnitude, true);
        }
        // Option 2: Try raw acceleration (without gravity) if available
        else if (event.acceleration && event.acceleration.x !== null) {
            const { x, y, z } = event.acceleration;
            const magnitude = Math.sqrt(x * x + y * y + z * z);
            processMagnitude(magnitude, false);
        }
    };

    const startTracking = async () => {
        setErrorMsg('');
        let granted = permissionGranted;
        if (!granted) {
            granted = await requestPermission();
        }

        if (granted) {
            if (window.DeviceMotionEvent) {
                window.addEventListener('devicemotion', handleDeviceMotion, true);
                setIsTracking(true);

                // Add wake lock if available to keep screen on/tracker running
                if ('wakeLock' in navigator) {
                    try {
                        window.wakeLockRef = await navigator.wakeLock.request('screen');
                    } catch (err) {
                        console.log('Wake Lock error:', err);
                    }
                }
            } else {
                setErrorMsg('DeviceMotion api is not supported on this device.');
            }
        }
    };

    const stopTracking = () => {
        window.removeEventListener('devicemotion', handleDeviceMotion, true);
        setIsTracking(false);

        // Release wake lock
        if (window.wakeLockRef) {
            window.wakeLockRef.release().then(() => {
                window.wakeLockRef = null;
            });
        }
    };

    useEffect(() => {
        // Initial permission check if possible
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission !== 'function') {
            setPermissionGranted(true); // Auto grant on non-iOS
        }

        return () => {
            window.removeEventListener('devicemotion', handleDeviceMotion, true);
            if (window.wakeLockRef) {
                window.wakeLockRef.release();
            }
        };
    }, []);

    // Also calculate approximate distance based on steps
    const AVERAGE_STEP_LENGTH = 0.762;
    const distanceMeters = steps * AVERAGE_STEP_LENGTH;

    const toggleGraph = () => {
        if (!showGraph) {
            loadDailySteps();
        }
        setShowGraph(!showGraph);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/80 backdrop-blur-xl border border-white/20 p-6 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 relative overflow-hidden h-full flex flex-col min-h-[400px]"
        >
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Footprints className="w-24 h-24" />
            </div>

            <AnimatePresence mode="wait">
                {!showGraph ? (
                    <motion.div
                        key="main"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="relative z-10 flex flex-col flex-1"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                    <Activity className="w-4 h-4" />
                                </span>
                                Motion Tracker
                            </h2>
                            <div className="flex items-center gap-2">
                                {isTracking && (
                                    <span className="flex items-center gap-1.5 text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full uppercase">
                                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                                        Background
                                    </span>
                                )}
                                <button
                                    onClick={toggleGraph}
                                    className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-colors"
                                >
                                    <BarChart2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <p className="text-xs text-slate-500 font-bold mb-6 max-w-[200px]">
                            Tracks background steps automatically. Stays active while screen is on.
                        </p>

                        <div className="flex-1 flex flex-col justify-center items-center py-2 mb-4 relative">
                            <div className="text-6xl font-black tracking-tighter text-indigo-600 mb-1">
                                {steps}
                            </div>
                            <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
                                Today's Steps
                            </div>

                            <div className="flex items-center gap-4 text-sm font-black text-slate-700 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
                                <Footprints className="w-4 h-4 text-indigo-500" />
                                <span>{(distanceMeters / 1000).toFixed(2)} KM Distance</span>
                            </div>

                            <button
                                onClick={resetTodaySteps}
                                className="absolute bottom-0 right-0 p-2 text-slate-300 hover:text-rose-500 transition-colors tooltip items-center justify-center flex"
                                title="Reset today's steps"
                            >
                                <RotateCcw className="w-3 h-3" />
                            </button>
                        </div>

                        {errorMsg && (
                            <div className="bg-red-50 text-red-500 text-[10px] font-black uppercase p-3 rounded-xl mb-4 text-center border border-red-100 mx-2 flex items-center gap-2 justify-center">
                                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                <span className="text-left">{errorMsg}</span>
                            </div>
                        )}

                        <button
                            onClick={isTracking ? stopTracking : startTracking}
                            className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg text-xs mt-auto flex items-center justify-center gap-2 ${isTracking
                                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 shadow-none'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 hover:shadow-indigo-300'
                                }`}
                        >
                            {isTracking ? <><Square className="w-4 h-4" fill="currentColor" /> Stop Tracker</> : <><Play className="w-4 h-4" fill="currentColor" /> Start Background Tracker</>}
                        </button>
                    </motion.div>
                ) : (
                    <motion.div
                        key="graph"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="relative z-10 flex flex-col flex-1 w-full h-full"
                    >
                        <div className="flex justify-between items-start mb-6">
                            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                                    <BarChart2 className="w-4 h-4" />
                                </span>
                                Activity Log
                            </h2>
                            <button
                                onClick={toggleGraph}
                                className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 w-full h-[250px] min-h-[250px] -ml-4 pr-4">
                            {dailySteps.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dailySteps} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis
                                            dataKey="displayDate"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
                                            dy={10}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#f1f5f9' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                        />
                                        <Bar dataKey="steps" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <Activity className="w-8 h-8 mb-2 opacity-50" />
                                    <p className="text-xs font-bold uppercase tracking-widest text-center">No history yet.<br />Start walking today!</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default StepCounter;
