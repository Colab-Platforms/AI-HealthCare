import React from 'react';
import { motion } from 'framer-motion';
import { Wind, ChevronRight, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';
import useSmokeLog from '../hooks/useSmokeLog';
import { getSmokeSummary } from '../utils/smokeLog';

export default function SmokeTrackerCard() {
  const { log, loading } = useSmokeLog();
  const { today, diff, avg } = getSmokeSummary(log);
  const smokeFree = today === 0;

  return (
    <Link to="/smoke-tracker" className="block">
      <motion.div whileHover={{ y: -5 }}
        className="bg-white rounded-[2.5rem] p-5 border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
        <div className="absolute -right-4 -bottom-4 opacity-[0.03] rotate-12">
          <Wind className="w-32 h-32 text-rose-500" />
        </div>
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${smokeFree ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                {smokeFree ? <TrendingDown className="w-5 h-5 text-emerald-500" /> : <Wind className="w-5 h-5 text-rose-400" />}
              </div>
              <div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Habit</h3>
                <p className="text-sm font-black text-black uppercase tracking-tight">Smoke Log</p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-slate-900 group-hover:text-white transition-all">
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-end gap-3 mb-3">
            <span className="text-4xl font-black text-black leading-none">
              {loading ? '—' : today}
            </span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-1">
              {loading ? 'Syncing…' : smokeFree ? "Smoke free today 🌿" : "smoked today"}
            </span>
          </div>

          {!loading && diff !== null ? (
            <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${diff < 0 ? 'text-emerald-500' : diff > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
              {diff < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : diff > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
              <span>
                {diff === 0 ? `At avg (${avg}/day)` : diff < 0 ? `${Math.abs(diff)} below avg (${avg}/day)` : `${diff} above avg (${avg}/day)`}
              </span>
            </div>
          ) : !loading ? (
            <p className="text-[10px] font-bold text-slate-400">Log daily to see your trend</p>
          ) : null}
        </div>
      </motion.div>
    </Link>
  );
}
