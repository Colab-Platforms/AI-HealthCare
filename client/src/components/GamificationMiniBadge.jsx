import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, Award, Zap, X } from 'lucide-react';
import { gamificationService } from '../services/api';

const glass = {
    background: "rgba(255,255,255,0.96)",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    border: "1px solid rgba(229,231,235,0.8)",
    boxShadow: "0 8px 40px rgba(5,150,105,0.14), 0 1px 0 rgba(255,255,255,1) inset",
};

const GamificationMiniBadge = () => {
    const [points, setPoints] = useState(0);
    const [profile, setProfile] = useState(null);
    const [animate, setAnimate] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const prevPointsRef = useRef(0);
    const containerRef = useRef(null);

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
        } catch { }
    };

    useEffect(() => {
        fetchProfile();
        const interval = setInterval(fetchProfile, 30000);
        const handleUpdate = () => fetchProfile();
        window.addEventListener('gamificationUpdate', handleUpdate);
        return () => { clearInterval(interval); window.removeEventListener('gamificationUpdate', handleUpdate); };
    }, []);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
        };
        if (isOpen) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    const tierColors = {
        Bronze: { from: "#92400e", to: "#b45309", badge: "rgba(180,83,9,0.1)", text: "#92400e" },
        Silver: { from: "#475569", to: "#64748b", badge: "rgba(100,116,139,0.1)", text: "#475569" },
        Gold:   { from: "#92400e", to: "#d97706", badge: "rgba(217,119,6,0.1)", text: "#b45309" },
        Platinum: { from: "#0f766e", to: "#059669", badge: "rgba(5,150,105,0.1)", text: "#059669" },
    };
    const tier = tierColors[profile?.currentTier] || tierColors.Bronze;

    return (
        <div className="relative" ref={containerRef}>
            {/* Trigger badge */}
            <motion.button
                onClick={() => setIsOpen(p => !p)}
                animate={animate ? {
                    scale: [1, 1.25, 0.95, 1.1, 1],
                    boxShadow: ["0 2px 8px rgba(16,185,129,0.1)", "0 0 20px rgba(16,185,129,0.5)", "0 0 15px rgba(16,185,129,0.3)", "0 2px 8px rgba(16,185,129,0.1)"]
                } : {}}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl transition-all hover:scale-105"
                style={{
                    background: isOpen ? "rgba(5,150,105,0.1)" : "rgba(255,255,255,0.7)",
                    border: `1px solid ${isOpen ? "rgba(5,150,105,0.3)" : "rgba(255,255,255,0.9)"}`,
                    boxShadow: "0 2px 8px rgba(16,185,129,0.1)"
                }}
            >
                <Trophy className={`w-4 h-4 ${animate ? 'text-amber-500' : 'text-emerald-500'} transition-colors`} />
                <span className="text-[11px] font-black text-slate-700 tracking-wide">{points} PTS</span>
            </motion.button>

            {/* Popup */}
            <AnimatePresence>
                {isOpen && profile && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -8 }}
                        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                        className="absolute top-12 right-0 w-80 sm:w-96 rounded-3xl overflow-hidden z-[200] flex flex-col"
                        style={{ maxHeight: "420px", ...glass }}
                    >
                        {/* Header */}
                        <div className="px-5 pt-5 pb-4 relative" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute top-4 right-4 w-7 h-7 rounded-xl flex items-center justify-center transition-colors hover:bg-slate-100/60"
                            >
                                <X className="w-3.5 h-3.5 text-slate-400" />
                            </button>

                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: "rgba(5,150,105,0.10)", border: "1px solid rgba(5,150,105,0.15)" }}>
                                    <Trophy className="w-7 h-7 text-emerald-500" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Health Points</p>
                                    <p className="text-3xl font-black text-slate-800 leading-none" style={{ letterSpacing: "-1px" }}>
                                        {profile.totalPoints.toLocaleString()}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-1.5">
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
                                            style={{ background: tier.badge, color: tier.text }}>
                                            ★ {profile.currentTier}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-y-auto flex-1 p-5 space-y-5" style={{ scrollbarWidth: "none" }}>
                            {/* Badges */}
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                    <Award className="w-3 h-3" /> Badges Earned
                                </p>
                                {profile.badges?.length > 0 ? (
                                    <div className="grid grid-cols-3 gap-2">
                                        {profile.badges.map((badge, idx) => (
                                            <div key={idx}
                                                className="rounded-2xl p-2.5 flex flex-col items-center gap-1.5 text-center"
                                                style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.9)" }}>
                                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base"
                                                    style={{ background: "rgba(5,150,105,0.08)" }}>
                                                    {badge.icon}
                                                </div>
                                                <span className="text-[9px] font-black text-slate-600 leading-tight uppercase tracking-wide">{badge.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-2xl p-4 text-center"
                                        style={{ background: "rgba(255,255,255,0.5)", border: "1px dashed rgba(5,150,105,0.2)" }}>
                                        <p className="text-[11px] font-bold text-slate-400">Complete activities to earn badges</p>
                                    </div>
                                )}
                            </div>

                            {/* Recent Activity */}
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                    <Zap className="w-3 h-3" /> Recent Activity
                                </p>
                                {profile.recentActivity?.length > 0 ? (
                                    <div className="space-y-2">
                                        {profile.recentActivity.slice(0, 5).map((log, idx) => (
                                            <div key={idx}
                                                className="flex items-center gap-3 p-3 rounded-2xl"
                                                style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.9)" }}>
                                                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-[11px] text-emerald-700"
                                                    style={{ background: "rgba(5,150,105,0.10)", border: "1px solid rgba(5,150,105,0.15)" }}>
                                                    +{log.pointsAwarded}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[12px] font-bold text-slate-700 truncate leading-tight">{log.description}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
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
                                    <div className="rounded-2xl p-4 text-center"
                                        style={{ background: "rgba(255,255,255,0.5)", border: "1px dashed rgba(5,150,105,0.2)" }}>
                                        <p className="text-[11px] font-bold text-slate-400">No activity yet — start using the app!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default GamificationMiniBadge;
