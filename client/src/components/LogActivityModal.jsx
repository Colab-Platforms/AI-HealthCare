import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Flame, Footprints, CheckCircle2, Loader2 } from 'lucide-react';

const ACTIVITY_TYPES = ['Walk', 'Run', 'Cycle', 'Gym', 'Yoga', 'Other'];

export function LogActivityModal({ onClose, onSubmit, isSubmitting }) {
  const [activityType, setActivityType] = useState('Walk');
  const [minutes, setMinutes] = useState('');
  const [caloriesBurned, setCaloriesBurned] = useState('');

  const canSubmit = Number(caloriesBurned) > 0 && !isSubmitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      activityType,
      activeMinutes: Number(minutes) || 0,
      caloriesBurned: Number(caloriesBurned),
    });
  };

  return (
    <div className="fixed inset-0 z-[1002] flex items-end md:items-center justify-center p-0 md:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, y: 80, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 80, scale: 0.97 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative w-full max-w-sm bg-[#f7f8f4] rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-[0_-10px_60px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col"
      >
        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Log Activity</h2>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
              Burned calories offset your daily total
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 bg-white hover:bg-slate-50 rounded-full flex items-center justify-center transition-all border border-slate-200 shadow-sm shrink-0 ml-3"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Activity type */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">
              Activity
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ACTIVITY_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setActivityType(type)}
                  className={`py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all ${
                    activityType === type
                      ? 'bg-[#69A38D] text-white shadow-md'
                      : 'bg-white text-slate-500 border border-slate-100'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Minutes */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">
              Duration (minutes)
            </label>
            <div className="relative">
              <Footprints className="w-4 h-4 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                min="0"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="e.g. 30"
                className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#69A38D]/30 focus:border-[#69A38D]"
              />
            </div>
          </div>

          {/* Calories burned */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">
              Calories Burned
            </label>
            <div className="relative">
              <Flame className="w-4 h-4 text-orange-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                min="0"
                value={caloriesBurned}
                onChange={(e) => setCaloriesBurned(e.target.value)}
                placeholder="e.g. 150"
                className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#69A38D]/30 focus:border-[#69A38D]"
              />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-4 bg-[#69A38D] hover:bg-[#5B9A80] text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 mt-2"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {isSubmitting ? 'Saving...' : 'Log Activity'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
