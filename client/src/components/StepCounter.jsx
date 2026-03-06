import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation, Activity } from 'lucide-react';

// Haversine formula to calculate the distance between two GPS coordinates in meters
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in metres
    const φ1 = lat1 * (Math.PI / 180);
    const φ2 = lat2 * (Math.PI / 180);
    const Δφ = (lat2 - lat1) * (Math.PI / 180);
    const Δλ = (lon2 - lon1) * (Math.PI / 180);

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
};

const StepCounter = () => {
    const [isTracking, setIsTracking] = useState(false);
    const [distance, setDistance] = useState(0); // in meters
    const [steps, setSteps] = useState(0); // estimated
    const [errorMsg, setErrorMsg] = useState('');

    const watchIdRef = useRef(null);
    const lastPosRef = useRef(null);

    // Average step length in meters (standard estimation)
    const AVERAGE_STEP_LENGTH = 0.762;

    const startTracking = () => {
        setErrorMsg('');
        if (!('geolocation' in navigator)) {
            setErrorMsg('GPS/Location is not supported on your browser.');
            return;
        }

        setIsTracking(true);

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        // Watch position continuously
        watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;

                // Ignore highly inaccurate GPS jumps (e.g. > 20 meters off)
                if (accuracy > 20) return;

                if (lastPosRef.current) {
                    const distMoved = calculateDistance(
                        lastPosRef.current.latitude,
                        lastPosRef.current.longitude,
                        latitude,
                        longitude
                    );

                    // Only count movements larger than 2 meters to avoid "GPS drift" standing still
                    if (distMoved > 2) {
                        setDistance((prev) => {
                            const newDist = prev + distMoved;
                            // Estimate steps based on distance
                            setSteps(Math.round(newDist / AVERAGE_STEP_LENGTH));
                            return newDist;
                        });
                        lastPosRef.current = { latitude, longitude };
                    }
                } else {
                    // First position reading
                    lastPosRef.current = { latitude, longitude };
                }
            },
            (err) => {
                console.warn('GPS Error:', err);
                if (err.code === 1) {
                    setErrorMsg('Location access denied. Please allow GPS.');
                } else {
                    setErrorMsg('Failed to get GPS signal. Step outside!');
                }
                setIsTracking(false);
            },
            options
        );
    };

    const stopTracking = () => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        setIsTracking(false);
        lastPosRef.current = null;
    };

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/80 backdrop-blur-xl border border-white/20 p-6 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 relative overflow-hidden h-full flex flex-col"
        >
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <MapPin className="w-24 h-24" />
            </div>

            <div className="relative z-10 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-4">
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                            <Navigation className="w-4 h-4" />
                        </span>
                        GPS Walk Tracker
                    </h2>
                    {isTracking && (
                        <span className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full uppercase">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            Live GPS
                        </span>
                    )}
                </div>

                <p className="text-xs text-slate-500 font-bold mb-6 max-w-[200px]">
                    Uses device location to estimate outdoor walking distance & steps.
                </p>

                <div className="flex-1 flex flex-col justify-center items-center py-2 mb-4">
                    <div className="text-6xl font-black tracking-tighter text-blue-600 mb-1">
                        {steps}
                    </div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
                        Estimated Steps
                    </div>

                    <div className="flex items-center gap-4 text-sm font-black text-slate-700 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
                        <Activity className="w-4 h-4 text-blue-500" />
                        <span>{(distance / 1000).toFixed(2)} KM Distance</span>
                    </div>
                </div>

                {errorMsg && (
                    <div className="bg-red-50 text-red-500 text-[10px] font-black uppercase p-3 rounded-xl mb-4 text-center border border-red-100 mx-2">
                        {errorMsg}
                    </div>
                )}

                <button
                    onClick={isTracking ? stopTracking : startTracking}
                    className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg text-xs mt-auto ${isTracking
                            ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 shadow-none'
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 hover:shadow-blue-300'
                        }`}
                >
                    {isTracking ? 'Stop Workout' : 'Start Outdoor Walk'}
                </button>
            </div>
        </motion.div>
    );
};

export default StepCounter;
