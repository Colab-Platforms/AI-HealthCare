import React from 'react';
import { motion } from 'framer-motion';
import { Footprints, Flame, ChevronRight, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePedometer } from '../context/PedometerContext';

const StepMiniCard = () => {
    const { steps, dailyGoal } = usePedometer();

    const progress = Math.min((steps / Math.max(dailyGoal, 1)) * 100, 100);
    const calories = Math.round(steps * 0.04);
    const goalMet = steps >= dailyGoal;

    return (
        <Link to="/step-tracker" className="block">
            <motion.div
                whileHover={{ y: -5 }}
                className="bg-white rounded-[2.5rem] p-5 border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative"
            >
                {/* Decorative Background */}
                <div className="absolute -right-4 -bottom-4 opacity-[0.03] rotate-12">
                    <Footprints className="w-32 h-32 text-indigo-600" />
                </div>

                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
                                <Activity className="w-5 h-5 text-indigo-500" />
                            </div>
                            <div>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Pedometer</h3>
                                <p className="text-sm font-black text-black uppercase tracking-tight">Step Counter</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                <ChevronRight className="w-4 h-4" />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-end gap-3 mb-4">
                        <span className="text-4xl font-black text-black leading-none">{steps.toLocaleString()}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-1">Steps Today</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-3">
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 1, ease: 'easeOut' }}
                                className={`h-full ${goalMet ? 'bg-gradient-to-r from-emerald-500 to-green-400' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
                            />
                        </div>

                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                            <div className="flex items-center gap-1.5 text-orange-500">
                                <Flame className="w-3.5 h-3.5" />
                                <span>{calories} Cal</span>
                            </div>
                            <span className={goalMet ? 'text-emerald-500' : 'text-slate-400'}>
                                {goalMet ? 'Goal Met!' : `${Math.round(progress)}% of ${dailyGoal >= 1000 ? `${(dailyGoal / 1000).toFixed(dailyGoal % 1000 === 0 ? 0 : 1)}k` : dailyGoal}`}
                            </span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </Link>
    );
};

export default StepMiniCard;
