import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Footprints, Flame, ChevronRight, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

const StepMiniCard = () => {
    const [steps, setSteps] = useState(0);
    const dailyGoal = 7000;

    useEffect(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const savedData = localStorage.getItem('fitcure_daily_steps');
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                const todayData = parsedData.find(d => d.date.includes(todayStr));
                if (todayData) setSteps(todayData.steps);
            } catch (e) { }
        }

        // Listen for localstorage changes (to update real-time if tracker is running)
        const handleStorage = () => {
            const data = localStorage.getItem('fitcure_daily_steps');
            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    const today = parsed.find(d => d.date.includes(todayStr));
                    if (today) setSteps(today.steps);
                } catch (e) { }
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const progress = Math.min((steps / dailyGoal) * 100, 100);
    const calories = Math.round(steps * 0.04);

    return (
        <Link to="/step-tracker" className="block">
            <motion.div
                whileHover={{ y: -5 }}
                className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative"
            >
                {/* Decorative Background */}
                <div className="absolute -right-4 -bottom-4 opacity-[0.03] rotate-12">
                    <Footprints className="w-32 h-32 text-indigo-600" />
                </div>

                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                                <Activity className="w-6 h-6 text-indigo-500" />
                            </div>
                            <div>
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Pedometer</h3>
                                <p className="text-sm font-black text-black uppercase tracking-tight">Step Counter</p>
                            </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                            <ChevronRight className="w-4 h-4" />
                        </div>
                    </div>

                    <div className="flex items-end gap-3 mb-6">
                        <span className="text-4xl font-black text-black leading-none">{steps.toLocaleString()}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-1">Steps Today</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-4">
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                            />
                        </div>

                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                            <div className="flex items-center gap-1.5 text-orange-500">
                                <Flame className="w-3.5 h-3.5" />
                                <span>{calories} Cal Burned</span>
                            </div>
                            <span className="text-slate-400">{Math.round(progress)}% of Goal</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </Link>
    );
};

export default StepMiniCard;
