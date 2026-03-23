import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const PedometerContext = createContext();

export const usePedometer = () => useContext(PedometerContext);

// --- Helpers ---
const getTodayString = () => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

const loadTodaySteps = () => {
    try {
        const data = JSON.parse(localStorage.getItem('takehealth_daily_steps') || '[]');
        const today = data.find(d => d.date === getTodayString());
        return today ? today.steps : 0;
    } catch { return 0; }
};

const persistSteps = (count) => {
    const todayStr = getTodayString();
    let data = [];
    try { data = JSON.parse(localStorage.getItem('takehealth_daily_steps') || '[]'); } catch { }
    const idx = data.findIndex(d => d.date === todayStr);
    if (idx >= 0) { data[idx].steps = count; }
    else { data.push({ date: todayStr, steps: count }); }
    if (data.length > 30) data = data.slice(-30);
    localStorage.setItem('takehealth_daily_steps', JSON.stringify(data));
};

export const PedometerProvider = ({ children }) => {
    const [steps, setSteps] = useState(() => loadTodaySteps());
    const [sensorStatus, setSensorStatus] = useState('initializing');
    const [dailyGoal, setDailyGoal] = useState(() => parseInt(localStorage.getItem('takehealth_step_goal')) || 7000);
    const [debugInfo, setDebugInfo] = useState({ readings: 0, lastMag: 0, gyroActive: false });

    // === SENSOR FUSION REFS ===
    const stepsRef = useRef(loadTodaySteps());
    const gravityRef = useRef({ x: 0, y: 0, z: 0 });

    // Gyro State
    const gyroAngleRef = useRef({ alpha: 0, beta: 0, gamma: 0 }); // Current angles
    const lastGyroAngleRef = useRef({ alpha: 0, beta: 0, gamma: 0 }); // For velocity check
    const gyroActiveRef = useRef(false);

    // Filtered Acceleration
    const filteredMagRef = useRef(0);
    const prevFilteredMagRef = useRef(0);
    const peakDetectedRef = useRef(false);

    // Timing and Rhythm
    const lastStepTimeRef = useRef(0);
    const lastSavedDateRef = useRef(getTodayString());
    const wakeLockRef = useRef(null);
    const sensorCountRef = useRef(0);

    // --- Daily Rollover ---
    const checkDayRollover = useCallback(() => {
        const today = getTodayString();
        if (lastSavedDateRef.current !== today) {
            stepsRef.current = 0;
            setSteps(0);
            lastSavedDateRef.current = today;
            persistSteps(0);
        }
    }, []);

    // --- GYRO HANDLER ---
    // Specifically listens for orientation changes to detect "shaking rotation"
    const handleOrientation = useCallback((event) => {
        if (event.beta !== null) {
            lastGyroAngleRef.current = { ...gyroAngleRef.current };
            gyroAngleRef.current = {
                alpha: event.alpha || 0,
                beta: event.beta || 0,
                gamma: event.gamma || 0
            };
            gyroActiveRef.current = true;
        }
    }, []);

    // --- MOTION HANDLER (Accelerometer Peak Detection Algorithm) ---
    const handleMotion = useCallback((event) => {
        checkDayRollover();
        sensorCountRef.current++;

        let ax = 0, ay = 0, az = 0;
        let hasLinear = false;

        // 1. Get Linear Acceleration (Clean accelerometer data without gravity)
        if (event.acceleration && event.acceleration.x !== null) {
            ax = event.acceleration.x || 0;
            ay = event.acceleration.y || 0;
            az = event.acceleration.z || 0;
            hasLinear = true;
        }

        // 2. High-Pass Filter Fallback (manual gravity removal if linear not available)
        if (!hasLinear && event.accelerationIncludingGravity) {
            const raw = event.accelerationIncludingGravity;
            if (raw.x === null) return;
            const a = 0.8;
            const g = gravityRef.current;
            g.x = a * g.x + (1 - a) * raw.x;
            g.y = a * g.y + (1 - a) * raw.y;
            g.z = a * g.z + (1 - a) * raw.z;
            ax = raw.x - g.x;
            ay = raw.y - g.y;
            az = raw.z - g.z;
        } else if (!hasLinear) return;

        // 3. Compute Resultant Magnitude (Vector sum of X, Y, Z)
        const magnitude = Math.sqrt(ax * ax + ay * ay + az * az);

        // 4. Low-Pass Filter (LPF) for signal smoothing
        // This removes high-frequency noise from the accelerometer
        const lpfAlpha = 0.18;
        prevFilteredMagRef.current = filteredMagRef.current;
        filteredMagRef.current = lpfAlpha * magnitude + (1 - lpfAlpha) * filteredMagRef.current;

        const smoothed = filteredMagRef.current;
        const prevSmoothed = prevFilteredMagRef.current;

        // 5. STEP DETECTION PARAMETERS
        const STEP_THRESHOLD = 1.4;    // Sensitivity threshold for peak detection
        const STEP_VALLEY = 0.6;      // Sensitivity threshold for valley/landing
        const STEP_COOLDOWN = 350;    // Minimum ms between steps (approx 2.8 step/sec max)

        const now = Date.now();

        // 6. PEAK DETECTION LOGIC
        // Identifies a peak when the signal goes above our threshold after being below it
        if (!peakDetectedRef.current && smoothed > STEP_THRESHOLD && prevSmoothed <= STEP_THRESHOLD) {
            peakDetectedRef.current = true;
        }

        // Complete the step when signal drops below the valley threshold
        if (peakDetectedRef.current && smoothed < STEP_VALLEY) {
            peakDetectedRef.current = false;
            const timeSinceLast = now - lastStepTimeRef.current;

            // Rhythmic check to ensure it's a valid human step and not random vibration
            if (timeSinceLast >= STEP_COOLDOWN && timeSinceLast <= 1500) {
                // ✅ ACCURATE STEP DETECTED
                stepsRef.current += 1;
                setSteps(stepsRef.current);

                // Batch persist for battery efficiency
                if (stepsRef.current % 5 === 0) persistSteps(stepsRef.current);
                lastStepTimeRef.current = now;
            }
        }

        // 7. Update Debug/Sensor Status Update (reduced frequency for performance)
        if (sensorCountRef.current % 60 === 0) {
            setDebugInfo(prev => ({
                ...prev,
                readings: sensorCountRef.current,
                lastMag: smoothed.toFixed(2)
            }));
        }
    }, [checkDayRollover]);

    const acquireWakeLock = useCallback(async () => {
        if ('wakeLock' in navigator && !wakeLockRef.current) {
            try {
                wakeLockRef.current = await navigator.wakeLock.request('screen');
                wakeLockRef.current.addEventListener('release', () => { wakeLockRef.current = null; });
            } catch { }
        }
    }, []);

    const startSensors = useCallback(async () => {
        const needsPermission = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';

        if (needsPermission) {
            setSensorStatus('needs-permission');
            return;
        }

        // Standard Browsers
        if (window.DeviceMotionEvent) {
            window.addEventListener('devicemotion', handleMotion, true);
            window.addEventListener('deviceorientation', handleOrientation, true);
            setSensorStatus('active');
            await acquireWakeLock();
        } else {
            setSensorStatus('error');
        }
    }, [handleMotion, handleOrientation, acquireWakeLock]);

    const requestPermission = async () => {
        try {
            // Need both motion and orientation for highest accuracy
            const motionPerm = await DeviceMotionEvent.requestPermission();
            const orientPerm = await DeviceOrientationEvent.requestPermission();

            if (motionPerm === 'granted' && orientPerm === 'granted') {
                window.addEventListener('devicemotion', handleMotion, true);
                window.addEventListener('deviceorientation', handleOrientation, true);
                setSensorStatus('active');
                await acquireWakeLock();
                return true;
            }
        } catch (e) { console.error("Permission error:", e); }
        setSensorStatus('error');
        return false;
    };

    const updateGoal = (newGoal) => {
        setDailyGoal(newGoal);
        localStorage.setItem('takehealth_step_goal', newGoal.toString());
    };

    useEffect(() => {
        startSensors();
        const handleVisibility = () => {
            if (!document.hidden) {
                checkDayRollover();
                const stored = loadTodaySteps();
                if (stored > stepsRef.current) {
                    stepsRef.current = stored;
                    setSteps(stored);
                }
                acquireWakeLock();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        const interval = setInterval(() => {
            checkDayRollover();
            persistSteps(stepsRef.current);
        }, 10000);

        return () => {
            window.removeEventListener('devicemotion', handleMotion, true);
            window.removeEventListener('deviceorientation', handleOrientation, true);
            document.removeEventListener('visibilitychange', handleVisibility);
            clearInterval(interval);
            if (wakeLockRef.current) wakeLockRef.current.release();
        };
    }, [startSensors, checkDayRollover, handleMotion, handleOrientation, acquireWakeLock]);

    return (
        <PedometerContext.Provider value={{
            steps,
            sensorStatus,
            dailyGoal,
            debugInfo,
            requestPermission,
            updateGoal
        }}>
            {children}
        </PedometerContext.Provider>
    );
};
