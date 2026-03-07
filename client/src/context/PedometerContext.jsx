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

export const PedometerProvider = ({ children }) => {
    const [steps, setSteps] = useState(() => loadTodaySteps());
    const [sensorStatus, setSensorStatus] = useState('initializing');
    const [dailyGoal, setDailyGoal] = useState(() => parseInt(localStorage.getItem('fitcure_step_goal')) || 7000);
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

    // --- MOTION HANDLER (v5 Super-Accuracy Algorithm) ---
    const handleMotion = useCallback((event) => {
        checkDayRollover();
        sensorCountRef.current++;

        let ax = 0, ay = 0, az = 0;
        let hasLinear = false;

        // 1. Get Linear Acceleration (prefer Clean data)
        if (event.acceleration && event.acceleration.x !== null) {
            ax = event.acceleration.x || 0;
            ay = event.acceleration.y || 0;
            az = event.acceleration.z || 0;
            hasLinear = true;
        }

        // 2. High-Pass Filter Fallback (manual gravity removal)
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

        // 3. Compute Magnitude
        const magnitude = Math.sqrt(ax * ax + ay * ay + az * az);

        // 4. Low-Pass Filter (LPF) for smoothing vibrations
        const lpfAlpha = 0.25; // Balanced for response vs noise
        prevFilteredMagRef.current = filteredMagRef.current;
        filteredMagRef.current = lpfAlpha * magnitude + (1 - lpfAlpha) * filteredMagRef.current;

        const smoothed = filteredMagRef.current;
        const prev = prevFilteredMagRef.current;

        // 5. GYRO SHAKE REJECTION (The "Magic" Part)
        // Calculate the angular velocity sum
        let angularVelocity = 0;
        if (gyroActiveRef.current) {
            const da = Math.abs(gyroAngleRef.current.alpha - lastGyroAngleRef.current.alpha);
            const db = Math.abs(gyroAngleRef.current.beta - lastGyroAngleRef.current.beta);
            const dg = Math.abs(gyroAngleRef.current.gamma - lastGyroAngleRef.current.gamma);
            angularVelocity = da + db + dg;
        }

        // Shaking usually results in angular velocity > 15 deg per sample
        // Walking is much smoother and rotational changes are gradual
        const isCurrentlyShaking = angularVelocity > 15;

        // 6. DYNAMIC STEP DETECTION (Peak/Valley Hysteresis)
        const PEAK_THRESHOLD = 1.3;   // Standard walking amplitude
        const VALLEY_THRESHOLD = 0.7;  // Foot landing/valley
        const MIN_COOLDOWN = 320;      // ~3 steps per sec max speed
        const MAX_WINDOW = 1200;       // Slow stroll limit

        const now = Date.now();

        // Detect Rising Edge (Start of a step movement)
        if (!peakDetectedRef.current && smoothed > PEAK_THRESHOLD && prev <= PEAK_THRESHOLD) {
            peakDetectedRef.current = true;
        }

        // Detect Falling Edge (Step completion)
        if (peakDetectedRef.current && smoothed < VALLEY_THRESHOLD) {
            peakDetectedRef.current = false;
            const timeSinceLast = now - lastStepTimeRef.current;

            // CRITICAL CHECK: Only count if timing is rhythmic AND not shaking
            if (timeSinceLast >= MIN_COOLDOWN && timeSinceLast <= MAX_WINDOW && !isCurrentlyShaking) {
                // ✅ VALID STEP COUNTED
                stepsRef.current += 1;
                setSteps(stepsRef.current);

                // Persistence
                if (stepsRef.current % 3 === 0) persistSteps(stepsRef.current);
            }
            lastStepTimeRef.current = now;
        }

        // 7. Update Debug Info (Every 0.5 sec)
        if (sensorCountRef.current % 30 === 0) {
            setDebugInfo({
                readings: sensorCountRef.current,
                lastMag: smoothed.toFixed(2),
                gyroActive: gyroActiveRef.current
            });
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
        localStorage.setItem('fitcure_step_goal', newGoal.toString());
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
