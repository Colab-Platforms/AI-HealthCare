import { TrendingUp, TrendingDown, Sparkles, AlertTriangle } from "lucide-react";
import { useData } from "../context/DataContext";

const COMPONENT_LABELS = {
  sleep: "Sleep",
  nutrition: "Diet Quality",
  activity: "Activity",
  smoking: "Smoking",
  alcohol: "Alcohol",
  hydration: "Hydration",
};

export default function HealthScoreCard() {
  // Sourced from DataProvider (fetched once on Dashboard mount, cached there)
  // rather than an independent fetch in this component — Dashboard re-renders
  // very frequently, which would otherwise unmount/remount a local fetch
  // before it ever gets a chance to resolve.
  const { healthScoreData: data } = useData();

  if (!data) {
    return (
      <div className="liquid-glass-strong rounded-[28px] p-6 animate-pulse h-[220px]" />
    );
  }

  // No score yet at all (brand-new account, or nothing logged today and no
  // Long-Term score computed yet) — quiet empty state, not an error/a "0".
  // The engine itself has no dead zone once *something* is logged.
  const hasDailyComponents = data?.dailyHealthScore?.components && Object.keys(data.dailyHealthScore.components).length > 0;
  if (!hasDailyComponents && !data?.overallHealthScore) {
    return (
      <div className="liquid-glass-strong rounded-[28px] p-6 text-center">
        <Sparkles className="w-8 h-8 text-[#69A38D] mx-auto mb-2" />
        <p className="text-sm font-bold text-slate-500">
          Log a meal, water, or steps today to see your Health Score.
        </p>
      </div>
    );
  }

  // Prefer today's Daily Score, but only if it's backed by real components —
  // an empty-components day has value:0, which isn't "0 health", it's "no
  // data yet today" and should fall back to the Long-Term score instead.
  const score = Math.round(hasDailyComponents ? data.dailyHealthScore.value : (data.overallHealthScore?.value ?? 0));
  const circumference = 2 * Math.PI * 46;
  const offset = circumference - (circumference * score) / 100;
  const weeklyChange = data.weeklyChange;

  // Show every possible component, not just the ones with data — a missing
  // component is excluded from the score math (rescaled, not counted as 0),
  // but the user should still SEE which activities they didn't log today.
  // Calculation fairness and display transparency are separate concerns.
  const dailyComponents = data.dailyHealthScore?.components || {};
  const componentEntries = Object.keys(COMPONENT_LABELS)
    .map((key) => [key, typeof dailyComponents[key] === "number" ? dailyComponents[key] : null])
    .sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1));

  return (
    <div className="liquid-glass-strong rounded-[28px] p-6 flex flex-col items-center">
      {/* An in-progress day is labelled as such. The score climbs as the user
          logs more, so presenting a mid-morning number as "today's score" reads
          as a verdict on a day they haven't finished living. */}
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
        {data.dailyHealthScore?.isFinalScoreForToday === false ? "Today so far" : "Health Score"}
      </span>
      {data.dailyHealthScore?.isFinalScoreForToday === false && (
        <span className="text-[9px] font-semibold text-slate-400 mb-3">
          builds through the day
        </span>
      )}

      {/* Safety netting — shown ABOVE the score deliberately. A critical lab
          value must not be something the user has to infer from a number. */}
      {data.criticalAlert && (
        <div className="w-full mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 flex gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[11px] font-black text-rose-700 leading-snug">
              {data.criticalAlert.message}
            </p>
            <p className="text-[10px] text-rose-600 font-semibold mt-1 leading-snug">
              {data.criticalAlert.findings
                .map((f) => `${f.marker} ${f.value}${f.unit ? ` ${f.unit}` : ""} (${f.direction})`)
                .join(" · ")}
            </p>
          </div>
        </div>
      )}

      <div className="relative w-32 h-32 mb-2">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(105,163,141,0.15)" strokeWidth="7" />
          <circle
            cx="50" cy="50" r="46" fill="none" stroke="#69A38D" strokeWidth="7"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl font-black text-[#1a2138]">{score}</span>
        </div>
      </div>

      {weeklyChange !== null && weeklyChange !== undefined && (
        <div
          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black mb-4 ${
            weeklyChange >= 0 ? "bg-[#69A38D]/15 text-[#4a7b62]" : "bg-rose-100 text-rose-600"
          }`}
        >
          {weeklyChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {weeklyChange >= 0 ? "+" : ""}{weeklyChange} this week
        </div>
      )}

      {data.overallHealthScore?.daysOfHistory !== undefined && data.overallHealthScore.daysOfHistory < 14 && (
        <p className="text-[10px] text-slate-400 font-semibold -mt-2 mb-3 text-center">
          Based on {data.overallHealthScore.daysOfHistory} day{data.overallHealthScore.daysOfHistory === 1 ? "" : "s"} — gets more accurate over 2 weeks
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 w-full mt-2">
        {componentEntries.map(([key, value]) => (
          <div
            key={key}
            className={
              value === null
                ? "rounded-2xl p-3 border-2 border-dashed border-slate-200 bg-slate-50/50"
                : "liquid-glass-inner rounded-2xl p-3"
            }
          >
            <p className={value === null ? "text-lg font-black text-slate-300" : "text-lg font-black text-[#1a2138]"}>
              {value === null ? "—" : Math.round(value)}
            </p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              {COMPONENT_LABELS[key] || key}
              {value === null ? " · Not logged" : ""}
            </p>
          </div>
        ))}
      </div>

      {data.disclaimer && (
        <p className="text-[9px] text-slate-400 font-semibold mt-4 text-center leading-snug">
          {data.disclaimer}
        </p>
      )}
    </div>
  );
}
