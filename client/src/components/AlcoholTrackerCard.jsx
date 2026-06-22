import React from 'react';
import { motion } from 'framer-motion';
import { Wine, ChevronRight, TrendingDown, TrendingUp, Minus, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAlcoholLog from '../hooks/useAlcoholLog';
import { getAlcoholSummary, getPatternInsights } from '../utils/alcoholLog';
import { features } from '../config/features';

export default function AlcoholTrackerCard() {
  const { log, loading } = useAlcoholLog();
  const { today, diff, avg, soberToday } = getAlcoholSummary(log);
  const { soberDays, weekTotal } = getPatternInsights(log);

  if (!features.alcoholTracker) return null;

  const glowColor = soberToday ? 'rgba(52,211,153,0.3)' : 'rgba(251,191,36,0.35)';
  const gradientFrom = soberToday ? '#052e16' : '#1c1003';
  const gradientMid = soberToday ? '#064e3b' : '#451a03';
  const gradientTo = soberToday ? '#065f46' : '#78350f';
  const accentColor = soberToday ? '#34d399' : '#fbbf24';
  const accentDim = soberToday ? 'rgba(52,211,153,0.12)' : 'rgba(251,191,36,0.12)';

  return (
    <Link to="/alcohol-tracker" className="block">
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
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full blur-2xl"
          style={{ background: `radial-gradient(circle, ${accentColor}, transparent)`, opacity: 0.2 }} />
        <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full blur-2xl"
          style={{ background: `radial-gradient(circle, ${accentColor}, transparent)`, opacity: 0.12 }} />

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
                {soberToday
                  ? <ShieldCheck className="w-5 h-5" style={{ color: accentColor }} />
                  : <Wine className="w-5 h-5" style={{ color: accentColor }} />
                }
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.15em] leading-none mb-0.5"
                  style={{ color: `${accentColor}60` }}>Awareness</p>
                <p className="text-xs font-black text-white uppercase tracking-tight">Drink Log</p>
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
            {soberToday && !loading ? (
              <div className="pb-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider"
                style={{ background: accentDim, color: accentColor }}>
                Sober Today ✓
              </div>
            ) : !loading && today > 0 ? (
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest pb-1">logged today</span>
            ) : null}
          </div>

          {/* Footer stats */}
          <div className="pt-3 flex items-center justify-between"
            style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            {!loading && diff !== null && today > 0 ? (
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
                    ? `Avg (${avg})`
                    : diff < 0
                      ? `Below avg (${avg})`
                      : `Above avg (${avg})`
                  }
                </span>
              </div>
            ) : !loading && weekTotal > 0 ? (
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {weekTotal} this week · {soberDays} clear days
              </p>
            ) : !loading ? (
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Tap to start logging
              </p>
            ) : null}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
