import React from 'react';
import { motion } from 'framer-motion';
import { Wind, ChevronRight, TrendingDown, TrendingUp, Minus, Leaf } from 'lucide-react';
import { Link } from 'react-router-dom';
import useSmokeLog from '../hooks/useSmokeLog';
import { getSmokeSummary } from '../utils/smokeLog';

export default function SmokeTrackerCard() {
  const { log, loading } = useSmokeLog();
  const { today, diff, avg } = getSmokeSummary(log);
  const smokeFree = today === 0;

  const glowColor = smokeFree ? 'rgba(52,211,153,0.4)' : 'rgba(251,113,133,0.4)';
  const gradientFrom = smokeFree ? '#052e16' : '#1c0a0a';
  const gradientMid = smokeFree ? '#064e3b' : '#450a0a';
  const gradientTo = smokeFree ? '#065f46' : '#7f1d1d';
  const accentColor = smokeFree ? '#34d399' : '#fb7185';
  const accentDim = smokeFree ? 'rgba(52,211,153,0.15)' : 'rgba(251,113,133,0.15)';

  return (
    <Link to="/smoke-tracker" className="block">
      <motion.div
        whileHover={{ y: -3, scale: 1.01 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="relative rounded-[28px] overflow-hidden cursor-pointer"
        style={{
          background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientMid} 50%, ${gradientTo} 100%)`,
          boxShadow: `0 8px 32px ${glowColor}, 0 2px 8px rgba(0,0,0,0.25)`,
        }}
      >
        {/* Glow blobs */}
        <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full blur-2xl"
          style={{ background: `radial-gradient(circle, ${accentColor}, transparent)`, opacity: 0.25 }} />
        <div className="absolute bottom-0 left-4 w-20 h-20 rounded-full blur-2xl"
          style={{ background: `radial-gradient(circle, ${accentColor}, transparent)`, opacity: 0.15 }} />

        {/* Glass panel */}
        <div
          className="relative z-10 p-5"
          style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: accentDim, border: `1px solid ${accentColor}25` }}>
                {smokeFree
                  ? <Leaf className="w-5 h-5" style={{ color: accentColor }} />
                  : <Wind className="w-5 h-5" style={{ color: accentColor }} />
                }
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.15em] leading-none mb-0.5"
                  style={{ color: `${accentColor}60` }}>Habit</p>
                <p className="text-xs font-black text-white uppercase tracking-tight">Smoke Log</p>
              </div>
            </div>
            <div className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <ChevronRight className="w-3.5 h-3.5 text-white/40" />
            </div>
          </div>

          {/* Big number */}
          <div className="flex items-end gap-3 mb-4">
            <span className="text-5xl font-black text-white leading-none tracking-tighter">
              {loading ? '—' : today}
            </span>
            {smokeFree && !loading && (
              <div className="pb-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider"
                style={{ background: accentDim, color: accentColor }}>
                Smoke Free 🌿
              </div>
            )}
            {!smokeFree && !loading && (
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest pb-1">
                smoked today
              </span>
            )}
          </div>

          {/* Trend line */}
          <div className="pt-3 flex items-center gap-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            {!loading && diff !== null ? (
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest"
                style={{ color: diff < 0 ? '#34d399' : diff > 0 ? '#fb7185' : 'rgba(255,255,255,0.3)' }}>
                {diff < 0
                  ? <TrendingDown className="w-3.5 h-3.5" />
                  : diff > 0
                    ? <TrendingUp className="w-3.5 h-3.5" />
                    : <Minus className="w-3.5 h-3.5" />
                }
                <span>
                  {diff === 0
                    ? `At avg (${avg}/day)`
                    : diff < 0
                      ? `${Math.abs(diff)} below avg (${avg}/day)`
                      : `${diff} above avg (${avg}/day)`
                  }
                </span>
              </div>
            ) : !loading ? (
              <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider">Log daily to see trend</p>
            ) : null}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
