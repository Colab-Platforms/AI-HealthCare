import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { EASE, TONES, riseIn } from "./adminTheme";

/** Counts up to `value` once it scrolls into view. Falls back to a plain number for reduced motion. */
export function AnimatedNumber({ value, className = "" }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const numeric = typeof value === "number" && Number.isFinite(value);
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    if (!numeric || reduce || !inView) return;
    const controls = animate(mv, value, { duration: 1.1, ease: EASE });
    return () => controls.stop();
  }, [value, numeric, reduce, inView, mv]);

  if (!numeric || reduce) return <span className={className}>{numeric ? value.toLocaleString() : value}</span>;
  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  );
}

/** KPI tile: icon, label, animated value, optional trend chip and subtitle. */
export function KpiCard({ label, value, icon: Icon, tone = "blue", trend, subtitle, onClick }) {
  const reduce = useReducedMotion();
  const t = TONES[tone] || TONES.blue;
  const Trend = trend < 0 ? ArrowDownRight : ArrowUpRight;
  const Tag = onClick ? motion.button : motion.div;

  return (
    <Tag
      variants={riseIn}
      whileHover={reduce ? undefined : { y: -4 }}
      whileTap={onClick && !reduce ? { scale: 0.985 } : undefined}
      onClick={onClick}
      className={`group text-left bg-white rounded-2xl border border-tk-line p-5 flex flex-col gap-4
        shadow-[0_1px_2px_rgba(11,27,58,0.04)] hover:shadow-[0_12px_28px_-12px_rgba(32,90,226,0.25)]
        ring-1 ring-transparent ${t.ring} transition-shadow duration-300
        ${onClick ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-tk-blue" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 rounded-xl grid place-items-center ${t.tile} transition-transform duration-300 group-hover:scale-110`}>
          <Icon className="w-5 h-5" />
        </div>
        {typeof trend === "number" && trend !== 0 && (
          <span
            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
              trend < 0 ? "bg-tk-error/10 text-tk-error" : "bg-tk-teal-soft text-tk-teal"
            }`}
          >
            <Trend className="w-3 h-3" />
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-tk-muted">{label}</p>
        <AnimatedNumber value={value} className="block mt-1 text-[28px] leading-none font-extrabold tracking-tight text-tk-ink" />
        {subtitle && <p className="mt-1.5 text-xs text-tk-muted">{subtitle}</p>}
      </div>
    </Tag>
  );
}

/** White rounded card with title + legend slot, used around every chart and table. */
export function ChartCard({ title, subtitle, legend, className = "", children }) {
  return (
    <motion.section
      variants={riseIn}
      className={`bg-white rounded-3xl border border-tk-line p-6 md:p-7 shadow-[0_1px_2px_rgba(11,27,58,0.04)] ${className}`}
    >
      <header className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-tk-ink">{title}</h3>
          {subtitle && <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-tk-muted">{subtitle}</p>}
        </div>
        {legend}
      </header>
      {children}
    </motion.section>
  );
}

export function LegendDot({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-tk-muted">
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

export function StatusBadge({ tone = "teal", children }) {
  const map = {
    teal: "bg-tk-teal-soft text-tk-teal",
    blue: "bg-tk-blue/10 text-tk-blue",
    amber: "bg-tk-warn/20 text-amber-700",
    error: "bg-tk-error/10 text-tk-error",
    muted: "bg-slate-100 text-slate-600",
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${map[tone] || map.teal}`}>{children}</span>;
}

/** Shimmering placeholder block while data loads. */
export function Skeleton({ className = "" }) {
  return <div className={`relative overflow-hidden rounded-xl bg-slate-200/60 ${className}`}>
    <div className="absolute inset-0 -translate-x-full animate-[tkshimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/70 to-transparent" />
  </div>;
}

export function EmptyState({ title, hint }) {
  return (
    <div className="h-full min-h-[160px] grid place-items-center text-center">
      <div>
        <p className="text-sm font-semibold text-tk-ink">{title}</p>
        {hint && <p className="mt-1 text-xs text-tk-muted">{hint}</p>}
      </div>
    </div>
  );
}
