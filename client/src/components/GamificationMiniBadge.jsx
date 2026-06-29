import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, Award, Zap, X, ChevronRight } from 'lucide-react';
import { gamificationService } from '../services/api';

const GamificationMiniBadge = () => {
    const [points, setPoints] = useState(0);
    const [profile, setProfile] = useState(null);
    const [animate, setAnimate] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const prevPointsRef = useRef(0);

    const fetchProfile = async () => {
        try {
            const { data } = await gamificationService.getProfile();
            if (data.success && data.data) {
                const newPoints = data.data.totalPoints;
                if (newPoints > prevPointsRef.current && prevPointsRef.current > 0) {
                    setAnimate(true);
                    setTimeout(() => setAnimate(false), 1200);
                }
                prevPointsRef.current = newPoints;
                setPoints(newPoints);
                setProfile(data.data);
            }
        } catch (error) {
            // Silently fail for mini badge
        }
    };

    useEffect(() => {
        fetchProfile();
        const interval = setInterval(fetchProfile, 30000);

        const handleUpdate = () => fetchProfile();
        window.addEventListener('gamificationUpdate', handleUpdate);

        return () => {
            clearInterval(interval);
            window.removeEventListener('gamificationUpdate', handleUpdate);
        };
    }, []);

    return (
        <div className="relative">
            <motion.div
                onClick={() => setIsModalOpen(true)}
                animate={animate ? {
                    scale: [1, 1.25, 0.95, 1.1, 1],
                    boxShadow: [
                        "0 2px 8px rgba(16,185,129,0.1)",
                        "0 0 20px rgba(16,185,129,0.5)",
                        "0 0 25px rgba(16,185,129,0.4)",
                        "0 0 15px rgba(16,185,129,0.3)",
                        "0 2px 8px rgba(16,185,129,0.1)"
                    ]
                } : {}}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl transition-all cursor-pointer hover:scale-105"
                style={{
                    background: "rgba(255,255,255,0.7)",
                    border: "1px solid rgba(255,255,255,0.9)",
                    boxShadow: "0 2px 8px rgba(16,185,129,0.1)"
                }}
                title="Your Health Points"
            >
                <Trophy className={`w-4 h-4 ${animate ? 'text-amber-500' : 'text-emerald-500'} transition-colors`} />
                <span className="text-[11px] font-black text-slate-700 tracking-wide">{points} PTS</span>
            </motion.div>

            <AnimatePresence>
                {isModalOpen && profile && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsModalOpen(false)}
                            className="fixed inset-0 z-[150]"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className="absolute top-12 right-0 bg-white w-80 sm:w-96 rounded-3xl shadow-2xl z-[200] overflow-hidden flex flex-col max-h-[80vh] border border-slate-100"
                        >
                            {/* Header */}
                            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white relative">
                                <button 
                                    onClick={() => setIsModalOpen(false)}
                                    className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                                <div className="flex items-center gap-4 mt-2">
                                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shadow-inner">
                                        <Trophy className="w-6 h-6 text-yellow-300" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black tracking-tight">{profile.totalPoints} PTS</h2>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <Star className="w-3.5 h-3.5 fill-yellow-300 text-yellow-300" />
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">{profile.currentTier}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 overflow-y-auto flex-1 scrollbar-hide pb-6">
                                {/* Badges Section */}
                                <div className="mb-6">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                        <Award className="w-3.5 h-3.5" /> Badges
                                    </h3>
                                    
                                    {profile.badges?.length > 0 ? (
                                        <div className="grid grid-cols-3 gap-2">
                                            {profile.badges.map((badge, idx) => (
                                                <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl p-2 flex flex-col items-center justify-center text-center gap-1 hover:bg-slate-100 transition-colors cursor-default">
                                                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-base shadow-sm">
                                                        {badge.icon}
                                                    </div>
                                                    <span className="text-[9px] font-bold text-slate-700 leading-tight">{badge.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100 border-dashed">
                                            <p className="text-[11px] font-bold text-slate-500">No badges yet</p>
                                        </div>
                                    )}
                                </div>

                                {/* Recent Activity */}
                                <div>
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                        <Zap className="w-3.5 h-3.5" /> Recent Activity
                                    </h3>
                                    
                                    {profile.recentActivity?.length > 0 ? (
                                        <div className="flex flex-col gap-2">
                                            {profile.recentActivity.slice(0, 5).map((log, idx) => (
                                                <div key={idx} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-slate-100 shadow-sm">
                                                    <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[9px] font-black shrink-0">
                                                        +{log.pointsAwarded}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-bold text-slate-700 truncate">{log.description}</p>
                                                        <p className="text-[9px] text-slate-400 font-medium">
                                                            {(() => {
                                                                const diff = Date.now() - new Date(log.createdAt).getTime();
                                                                const m = Math.floor(diff / 60000);
                                                                if (m < 1) return 'Just now';
                                                                if (m < 60) return `${m}m ago`;
                                                                const h = Math.floor(m / 60);
                                                                if (h < 24) return `${h}h ago`;
                                                                return `${Math.floor(h / 24)}d ago`;
                                                            })()}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-[11px] font-medium text-slate-400 text-center py-2">No activity found.</p>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default GamificationMiniBadge;
