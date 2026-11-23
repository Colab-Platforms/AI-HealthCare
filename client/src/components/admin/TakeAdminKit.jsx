import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, EyeOff, RefreshCcw, ShieldCheck } from "lucide-react";
import { CalendarDays } from "lucide-react";
import { Skeleton } from "./AdminUI";
import { container, riseIn } from "./adminTheme";

export function PageHeader({ icon: Icon, title, subtitle, actions }) {
  return (
    <motion.div variants={riseIn} className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div className="flex items-center gap-3.5">
        {Icon && (
          <div className="w-12 h-12 rounded-2xl bg-tk-blue grid place-items-center shadow-[0_10px_24px_-8px_rgba(32,90,226,0.55)]">
            <Icon className="w-6 h-6 text-white" />
          </div>
        )}
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-tk-ink leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-tk-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </motion.div>
  );
}

export function Page({ children }) {
  return (
    <div className="p-6 md:p-8 space-y-6 w-full max-w-[1500px] mx-auto">
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        {children}
      </motion.div>
    </div>
  );
}

export function DateRange({ start, end, onStart, onEnd }) {
  const field =
    "group flex items-center gap-2 bg-white rounded-xl pl-3 pr-2 py-2 border border-tk-line hover:border-tk-action " +
    "focus-within:border-tk-blue focus-within:ring-4 focus-within:ring-tk-blue/10 transition-all";
  const input = "text-sm font-semibold text-tk-ink bg-transparent focus:outline-none cursor-pointer w-[8.5rem]";
  return (
    <div className="flex items-center gap-2">
      <label className={field}>
        <CalendarDays className="w-4 h-4 text-tk-muted" />
        <span className="sr-only">Start date</span>
        <input type="date" value={start} onChange={(e) => onStart(e.target.value)} className={input} style={{ colorScheme: "light", border: "none", boxShadow: "none" }} />
      </label>
      <span className="text-tk-muted" aria-hidden>→</span>
      <label className={field}>
        <CalendarDays className="w-4 h-4 text-tk-muted" />
        <span className="sr-only">End date</span>
        <input type="date" value={end} onChange={(e) => onEnd(e.target.value)} className={input} style={{ colorScheme: "light", border: "none", boxShadow: "none" }} />
      </label>
    </div>
  );
}

export function LoadingGrid({ cards = 4, tall = true }) {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-[148px] rounded-2xl" />
        ))}
      </div>
      {tall && <Skeleton className="h-[340px] rounded-3xl" />}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="bg-white border border-tk-error/25 rounded-3xl p-8 text-center">
      <AlertTriangle className="w-8 h-8 text-tk-error mx-auto mb-3" />
      <p className="font-bold text-tk-ink">Couldn't load this data</p>
      <p className="text-sm text-tk-muted mt-1">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-tk-blue text-white text-sm font-bold hover:bg-tk-action transition-colors">
          <RefreshCcw className="w-4 h-4" /> Try again
        </button>
      )}
    </div>
  );
}

/** Reminder shown on every Take Admin analytics screen. */
export function PrivacyNote({ minGroup = 10 }) {
  return (
    <motion.div variants={riseIn} className="flex items-start gap-3 p-4 rounded-2xl bg-tk-teal-soft border border-tk-teal/15">
      <ShieldCheck className="w-5 h-5 text-tk-teal shrink-0 mt-0.5" />
      <p className="text-sm text-slate-700">
        <b className="text-tk-ink">Group totals only.</b> No names, contacts or health values are shown. Any group with fewer than{" "}
        {minGroup} users is hidden to protect privacy.
      </p>
    </motion.div>
  );
}

export function HiddenValue({ minGroup = 10 }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-tk-muted text-sm font-semibold" title={`Fewer than ${minGroup} users`}>
      <EyeOff className="w-4 h-4" /> Hidden
    </span>
  );
}
