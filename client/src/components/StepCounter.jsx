import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

const StepCounter = () => {
    const [steps, setSteps] = useState(0);
    const [isTracking, setIsTracking] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [magnitude, setMagnitude] = useState(0);

    // Constants for our basic pedometer algorithm
    const STEP_THRESHOLD = 15; // Customize based on testing (gravity is normally ~9.8)

    const handleMotion = useCallback((event) => {
        // Get acceleration data including gravity
        const acc = event.accelerationIncludingGravity;
        if (!acc) return;

        // Calculate the total magnitude of the acceleration vector
        const currentMagnitude = Math.sqrt(
            Math.pow(acc.x || 0, 2) + Math.pow(acc.y || 0, 2) + Math.pow(acc.z || 0, 2)
        );

        setMagnitude(currentMagnitude.toFixed(2));

        // If the movement crosses the threshold, register a step
        if (currentMagnitude > STEP_THRESHOLD) {
            setSteps((prevSteps) => prevSteps + 1);
        }
    }, []);

    const requestAccess = async () => {
        // iOS 13+ requires explicit permission for DeviceMotionEvent
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const permissionState = await DeviceMotionEvent.requestPermission();
                if (permissionState === 'granted') {
                    setPermissionGranted(true);
                    startTracking();
                } else {
                    alert('Permission to access device motion was denied.');
                }
            } catch (error) {
                console.error('Error requesting motion permission:', error);
                // Fallback or Android
                setPermissionGranted(true);
                startTracking();
            }
        } else {
            // Android and older iOS devices don't need explicit permission requests
            setPermissionGranted(true);
            startTracking();
        }
    };

    const startTracking = () => {
        if (window.DeviceMotionEvent) {
            window.addEventListener('devicemotion', handleMotion);
            setIsTracking(true);
        } else {
            alert('Device motion is not supported on your device/browser.');
        }
    };

    const stopTracking = () => {
        window.removeEventListener('devicemotion', handleMotion);
        setIsTracking(false);
    };

    useEffect(() => {
        // Cleanup listener on unmount
        return () => {
            window.removeEventListener('devicemotion', handleMotion);
        };
    }, [handleMotion]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/80 backdrop-blur-xl border border-white/20 p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 relative overflow-hidden"
        >
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2C7.58172 2 4 5.58172 4 10c0 4.4183 8 12 8 12s8-7.5817 8-12c0-4.4183-3.5817-8-8-8z" />
                    <circle cx="12" cy="10" r="3" />
                </svg>
            </div>

            <div className="relative z-10 flex flex-col items-center">
                <h2 className="text-lg font-semibold text-slate-800 mb-1 flex items-center gap-2">
                    <span className="text-xl">👟</span> Live Step Counter
                </h2>

                <p className="text-xs text-slate-500 mb-4 text-center">
                    Tracks device motion (Keep page open)
                </p>

                <div className="text-5xl font-extrabold text-[#7C3AED] mb-2 tracking-tight">
                    {steps}
                </div>

                <div className="text-xs text-slate-400 mb-5 font-mono bg-slate-100 px-3 py-1 rounded-full">
                    Motion: {isTracking ? `${magnitude} g` : 'Idle'}
                </div>

                {!permissionGranted && !isTracking ? (
                    <button
                        onClick={requestAccess}
                        className="w-full bg-[#7C3AED] text-white px-4 py-3 rounded-2xl font-semibold hover:bg-violet-700 active:scale-95 transition-all shadow-lg shadow-violet-200"
                    >
                        Enable Sensor
                    </button>
                ) : (
                    <button
                        onClick={isTracking ? stopTracking : startTracking}
                        className={`w-full px-4 py-3 rounded-2xl font-semibold active:scale-95 transition-all shadow-md ${isTracking
                                ? 'bg-rose-100 text-rose-600 hover:bg-rose-200'
                                : 'bg-[#7C3AED] text-white hover:bg-violet-700 shadow-violet-200'
                            }`}
                    >
                        {isTracking ? 'Pause Tracking' : 'Resume Tracking'}
                    </button>
                )}
            </div>
        </motion.div>
    );
};

export default StepCounter;
