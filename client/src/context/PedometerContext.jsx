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
    const [sensorStatus, setSensorStatus] = useState('initializing'); // initializing | needs-permission | active | error
    const [dailyGoal, setDailyGoal] = useState(() => parseInt(localStorage.getItem('fitcure_step_goal')) || 7000);
    const [debugInfo, setDebugInfo] = useState({ readings: 0, lastMag: 0, gyroActive: false });

    // === SENSOR FUSION REFS ===
    const stepsRef = useRef(loadTodaySteps());
    const gravityRef = useRef({ x: 0, y: 0, z: 0 });
    const filteredAngleRef = useRef(0);
    const lastTimestampRef = useRef(0);
    const gyroRateRef = useRef({ alpha: 0, beta: 0, gamma: 0 });
    const gyroActiveRef = useRef(false);
    const filteredMagRef = useRef(0);
    const prevFilteredMagRef = useRef(0);
    const peakDetectedRef = useRef(false);
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

    // --- Motion Handler (v4 Algorithm) ---
    const handleMotion = useCallback((event) => {
        checkDayRollover();
        sensorCountRef.current++;

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
            const a = 0.8;
            const g = gravityRef.current;
            g.x = a * g.x + (1 - a) * raw.x;
            g.y = a * g.y + (1 - a) * raw.y;
            g.z = a * g.z + (1 - a) * raw.z;
            ax = raw.x - g.x;
            ay = raw.y - g.y;
            az = raw.z - g.z;
        } else if (!hasLinear) return;

        const magnitude = Math.sqrt(ax * ax + ay * ay + az * az);
        const accelAngle = Math.atan2(ay, Math.sqrt(ax * ax + az * az)) * (180 / Math.PI);
        const now = Date.now();
        const dt = lastTimestampRef.current > 0 ? (now - lastTimestampRef.current) / 1000 : 0.016;
        lastTimestampRef.current = now;

        const ALPHA = 0.98;
        if (gyroActiveRef.current && dt > 0 && dt < 0.5) {
            const gyroAngleChange = gyroRateRef.current.beta * dt;
            filteredAngleRef.current = ALPHA * (filteredAngleRef.current + gyroAngleChange) + (1 - ALPHA) * accelAngle;
        } else {
            filteredAngleRef.current = accelAngle;
        }

        const lpfAlpha = 0.3;
        prevFilteredMagRef.current = filteredMagRef.current;
        filteredMagRef.current = lpfAlpha * magnitude + (1 - lpfAlpha) * filteredMagRef.current;

        const smoothed = filteredMagRef.current;
        const prev = prevFilteredMagRef.current;

        let isShaking = false;
        if (gyroActiveRef.current) {
            const rotationSum = Math.abs(gyroRateRef.current.alpha) + Math.abs(gyroRateRef.current.beta) + Math.abs(gyroRateRef.current.gamma);
            if (rotationSum > 80) isShaking = true;
        }

        const PEAK_THRESHOLD = 1.2;
        const VALLEY_THRESHOLD = 0.6;
        const MIN_INT = 300;
        const MAX_INT = 1200;

        if (!peakDetectedRef.current && smoothed > PEAK_THRESHOLD && prev <= PEAK_THRESHOLD) {
            peakDetectedRef.current = true;
        }

        if (peakDetectedRef.current && smoothed < VALLEY_THRESHOLD) {
            peakDetectedRef.current = false;
            const timeSinceLast = now - lastStepTimeRef.current;

            if (timeSinceLast >= MIN_INT && timeSinceLast <= MAX_INT && !isShaking) {
                stepsRef.current += 1;
                setSteps(stepsRef.current);
                if (stepsRef.current % 3 === 0) persistSteps(stepsRef.current);
            }
            lastStepTimeRef.current = now;
        }

        if (sensorCountRef.current % 30 === 0) {
            setDebugInfo({ readings: sensorCountRef.current, lastMag: smoothed.toFixed(2), gyroActive: gyroActiveRef.current });
        }
    }, [checkDayRollover]);

    const handleOrientation = useCallback((event) => {
        if (event.rotationRate) {
            gyroRateRef.current = {
                alpha: event.rotationRate.alpha || 0,
                beta: event.rotationRate.beta || 0,
                gamma: event.rotationRate.gamma || 0
            };
            gyroActiveRef.current = true;
        }
    }, []);

    const acquireWakeLock = useCallback(async () => {
        if ('wakeLock' in navigator && !wakeLockRef.current) {
            try {
                wakeLockRef.current = await navigator.wakeLock.request('screen');
                wakeLockRef.current.addEventListener('release', () => { wakeLockRef.current = null; });
            } catch { }
        }
    }, []);

    const startSensors = useCallback(async () => {
        const needsPermission = typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';
        if (needsPermission) {
            setSensorStatus('needs-permission');
            return;
        }

        if (window.DeviceMotionEvent) {
            window.addEventListener('devicemotion', handleMotion, true);
            setSensorStatus('active');
            await acquireWakeLock();
        } else {
            setSensorStatus('error');
        }
    }, [handleMotion, acquireWakeLock]);

    const requestPermission = async () => {
        try {
            const perm = await DeviceMotionEvent.requestPermission();
            if (perm === 'granted') {
                window.addEventListener('devicemotion', handleMotion, true);
                setSensorStatus('active');
                await acquireWakeLock();
                return true;
            }
        } catch (e) { console.error(e); }
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
            document.removeEventListener('visibilitychange', handleVisibility);
            clearInterval(interval);
            if (wakeLockRef.current) wakeLockRef.current.release();
        };
    }, [startSensors, checkDayRollover, handleMotion, acquireWakeLock]);

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
