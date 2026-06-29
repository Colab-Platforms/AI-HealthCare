import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, TrendingUp, Info, X } from 'lucide-react';
import { gamificationService } from '../services/api';
import { toast } from 'react-hot-toast';

const GamificationWidget = () => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showInfo, setShowInfo] = useState(false);

    useEffect(() => {
        fetchProfile();
        // Optional: Poll every 30 seconds if realtime is highly desired, 
        // or just rely on component remounts/actions.
        const interval = setInterval(fetchProfile, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchProfile = async () => {
        try {
            const { data } = await gamificationService.getProfile();
            if (data.success) {
                setProfile(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch gamification profile:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-[2rem] p-4 border border-slate-100 shadow-sm animate-pulse h-32 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="bg-red-50 rounded-[2rem] p-4 border border-red-100 text-red-600 text-center text-sm shadow-sm">
                Failed to load gamification data. Please check server logs.
            </div>
        );
    }

    const { totalPoints, currentTier, tierIcon, nextTier, progress, streak, badges } = profile;
    const progressPercent = progress ?? 0;

    return (
        <motion.div
            whileHover={{ y: -2 }}
            className="bg-white rounded-[2rem] p-4 border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)] transition-all relative overflow-hidden"
        >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -mr-16 -mt-16"></div>

            <div className="flex justify-between items-center mb-3 relative z-10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                        <Trophy className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Health Tier</h3>
                        <p className="text-sm font-bold text-slate-800">{tierIcon} {currentTier}</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowInfo(true)}
                    className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-500 transition-all text-slate-400"
                >
                    <Info className="w-3.5 h-3.5" />
                </button>
            </div>

            <div className="mb-4 relative z-10">
                <div className="flex justify-between items-end mb-1">
                    <span className="text-2xl font-black text-slate-800">{totalPoints} <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">PTS</span></span>
                    <div className="flex items-center gap-2">
                        {streak > 0 && <span className="text-xs font-bold text-orange-500">🔥 {streak}d</span>}
                        <span className="text-xs font-bold text-emerald-500">{progressPercent.toFixed(0)}% to {nextTier || 'max'}</span>
                    </div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-emerald-400 to-teal-500"
                    />
                </div>
            </div>

            {badges && badges.length > 0 && (
                <div className="relative z-10 pt-3 border-t border-slate-50">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Recent Badges</p>
                    <div className="flex gap-2">
                        {badges.slice(-4).map((badge, idx) => (
                            <div key={idx} className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100" title={badge.name}>
                                <span className="text-sm">{badge.icon}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Info Modal */}
            <AnimatePresence>
                {showInfo && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 sm:p-0">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowInfo(false)}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl relative z-10"
                        >
                            <div className="flex justify-between items-center mb-5">
                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">How to earn points</h4>
                                <button onClick={() => setShowInfo(false)} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-black transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-blue-100 text-blue-500 rounded-lg flex items-center justify-center">
                                            <TrendingUp className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-bold text-slate-700">Daily Login</span>
                                    </div>
                                    <span className="text-sm font-black text-emerald-500">+5 pts</span>
                                </div>
                                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-orange-100 text-orange-500 rounded-lg flex items-center justify-center">
                                            <Star className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-bold text-slate-700">Log a Meal</span>
                                    </div>
                                    <span className="text-sm font-black text-emerald-500">+10 pts</span>
                                </div>
                                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-purple-100 text-purple-500 rounded-lg flex items-center justify-center">
                                            <Trophy className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-bold text-slate-700">Hit Step Goal</span>
                                    </div>
                                    <span className="text-sm font-black text-emerald-500">+20 pts</span>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default GamificationWidget;
