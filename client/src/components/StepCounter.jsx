import React from 'react';
import { motion } from 'framer-motion';
import { Footprints, Flame, ChevronRight, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePedometer } from '../context/PedometerContext';

const StepMiniCard = () => {
    const { steps, dailyGoal } = usePedometer();

    const progress = Math.min((steps / Math.max(dailyGoal, 1)) * 100, 100);
    const calories = Math.round(steps * 0.04);
    const goalMet = steps >= dailyGoal;
    const distance = (steps * 0.0008).toFixed(1);

    // SVG arc progress ring
    const size = 64;
    const stroke = 5;
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const filled = circ * (progress / 100);

    return (
        <Link to="/step-tracker" className="block">
            <motion.div
                whileHover={{ y: -3, scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="relative rounded-[28px] overflow-hidden cursor-pointer"
                style={{
                    background: 'linear-gradient(135deg, #052e16 0%, #064e3b 50%, #065f46 100%)',
                    boxShadow: '0 8px 32px rgba(6,78,59,0.45), 0 2px 8px rgba(0,0,0,0.2)',
                }}
            >
                {/* Glow blob */}
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-30 blur-2xl"
                    style={{ background: 'radial-gradient(circle, #34d399, transparent)' }} />
                <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full opacity-20 blur-2xl"
                    style={{ background: 'radial-gradient(circle, #10b981, transparent)' }} />

                {/* Glass panel */}
                <div className="relative z-10 p-5"
                    style={{
                        background: 'rgba(255,255,255,0.06)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        borderTop: '1px solid rgba(255,255,255,0.12)',
                        borderLeft: '1px solid rgba(255,255,255,0.08)',
                    }}
                >
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-[9px] font-black text-emerald-300/60 uppercase tracking-[0.15em] leading-none mb-0.5">Pedometer</p>
                            <p className="text-xs font-black text-white uppercase tracking-tight">Step Counter</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <div className="w-7 h-7 rounded-full flex items-center justify-center"
                                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <ChevronRight className="w-3.5 h-3.5 text-white/50" />
                            </div>
                        </div>
                    </div>

                    {/* Main content: big number + arc */}
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-4xl font-black text-white leading-none tracking-tighter">
                                {steps.toLocaleString()}
                            </p>
                            <p className="text-[9px] font-bold text-emerald-300/50 uppercase tracking-widest mt-1">Steps Today</p>
                        </div>
                        {/* SVG arc ring */}
                        <div className="relative w-14 h-14 flex items-center justify-center">
                            <svg width={size} height={size} className="-rotate-90">
                                <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                                    stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
                                <motion.circle
                                    cx={size / 2} cy={size / 2} r={r} fill="none"
                                    stroke={goalMet ? '#34d399' : '#6ee7b7'}
                                    strokeWidth={stroke}
                                    strokeLinecap="round"
                                    strokeDasharray={circ}
                                    initial={{ strokeDashoffset: circ }}
                                    animate={{ strokeDashoffset: circ - filled }}
                                    transition={{ duration: 1, ease: 'easeOut' }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                {goalMet
                                    ? <Zap className="w-4 h-4 text-emerald-400" />
                                    : <Footprints className="w-4 h-4 text-emerald-300/60" />
                                }
                            </div>
                        </div>
                    </div>

                    {/* Footer stats */}
                    <div className="flex items-center justify-between pt-3"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex items-center gap-1.5">
                            <Flame className="w-3 h-3 text-orange-400" />
                            <span className="text-[10px] font-black text-orange-400">{calories} Cal</span>
                        </div>
                        <span className="text-[9px] font-bold text-white/30">{distance} km</span>
                        <span className={`text-[9px] font-black uppercase tracking-wider ${goalMet ? 'text-emerald-400' : 'text-emerald-300/50'}`}>
                            {goalMet ? 'Goal Met ✓' : `${Math.round(progress)}% of ${dailyGoal >= 1000 ? `${(dailyGoal / 1000).toFixed(dailyGoal % 1000 === 0 ? 0 : 1)}k` : dailyGoal}`}
                        </span>
                    </div>
                </div>
            </motion.div>
        </Link>
    );
};

export default StepMiniCard;
