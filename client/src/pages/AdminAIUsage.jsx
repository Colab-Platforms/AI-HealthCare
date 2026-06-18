import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Zap, DollarSign, Activity, Users, AlertTriangle,
  CheckCircle, TrendingUp, Database, RefreshCw,
  ChevronLeft, ChevronRight, Info,
} from "lucide-react";
import { adminService } from "../services/api";
import toast from "react-hot-toast";

// ─────────────────────────────────────────────────────────────────────────────
const PERIODS = [
  { label: "Today",      value: "today" },
  { label: "7D",         value: "7d"    },
  { label: "30D",        value: "30d"   },
  { label: "Month",      value: "month" },
  { label: "Year",       value: "year"  },
  { label: "All",        value: "all"   },
];

const FEATURE_LABELS = {
  validate_report:   "Validate",
  analyze_report:    "Analyze",
  reanalyze_report:  "Re-Analyze",
  ai_chat:           "AI Chat",
  chat_about_report: "Report Chat",
  metric_info:       "Metric Info",
  compare_reports:   "Compare",
  health_dna:        "Health DNA",
  vitals_insights:   "Vitals",
  diet_plan:         "Diet Plan",
  translate:         "Translate",
  other:             "Other",
};

const PIE_COLORS = ["#6366f1","#22d3ee","#f59e0b","#10b981","#f43f5e","#8b5cf6","#3b82f6","#ec4899"];

const fmt = {
  usd:  (v) => `$${Number(v || 0).toFixed(4)}`,
  usd2: (v) => `$${Number(v || 0).toFixed(2)}`,
  num:  (v) => Number(v || 0).toLocaleString(),
  pct:  (v) => `${Number(v || 0).toFixed(1)}%`,
  ms:   (v) => (v || 0) >= 1000 ? `${((v||0)/1000).toFixed(1)}s` : `${Math.round(v||0)}ms`,
  model:(v) => (v||"").replace("claude-","").replace(/-20\d{6}$/,"").replace("-latest",""),
};

// ── Tooltip explainers shown via (?) icon ────────────────────────────────────
const EXPLAINERS = {
  totalCost:      "Total USD billed by Anthropic for this period. Sum of input + output + cache costs across all users and features.",
  totalTokens:    "Every token counted: Input (what we sent) + Output (what Claude replied) + Cache Read + Cache Write. 14k tokens = ~10 pages of text processed total.",
  inputTokens:    "Tokens in the message we send to Claude — the prompt, extracted PDF text, or image data. Billed at $3/million for Sonnet.",
  outputTokens:   "Tokens Claude generates in its reply — the analysis, insights, JSON response. Most expensive: $15/million for Sonnet.",
  cacheRead:      "Tokens served from Anthropic's cache instead of re-processing. System prompts get cached. Billed at $0.30/million (90% cheaper than full input).",
  cacheWrite:     "First-time cost to write a system prompt into Anthropic's cache. Slightly above input rate ($3.75/M). Pays off on repeated calls within 5 min.",
  cacheHitRate:   "% of input tokens that were served from cache. Higher = cheaper. Formula: cacheReadTokens ÷ (cacheRead + freshInput) × 100.",
  cacheSavings:   "Money saved because cached tokens cost $0.30/M instead of $3.00/M (Sonnet). Savings = cacheReadTokens × ($3.00 − $0.30) ÷ 1,000,000.",
  avgLatency:     "Average wall-clock time from when we call Anthropic to when the full response arrives. Includes network + Claude processing time.",
  errorRate:      "% of API calls that returned an error (timeout, model unavailable, invalid file, etc.).",
  uniqueUsers:    "Count of distinct user accounts that triggered at least one Claude API call in this period.",
  budget:         "Monthly spend vs your configured budget (MONTHLY_AI_BUDGET_USD env var, default $100). Projected = (spent ÷ days elapsed) × days in month.",
};

// ── Info tooltip component ───────────────────────────────────────────────────
function InfoTip({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="text-slate-300 dark:text-slate-600 hover:text-indigo-400 transition-colors"
      >
        <Info size={12} />
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 bg-slate-800 text-white text-[11px] leading-relaxed rounded-xl p-3 shadow-xl pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </span>
      )}
    </span>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = "indigo", alert, tip }) {
  const colors = {
    indigo: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400",
    green:  "bg-green-50  dark:bg-green-900/20  text-green-600  dark:text-green-400",
    amber:  "bg-amber-50  dark:bg-amber-900/20  text-amber-600  dark:text-amber-400",
    red:    "bg-red-50    dark:bg-red-900/20    text-red-600    dark:text-red-400",
    cyan:   "bg-cyan-50   dark:bg-cyan-900/20   text-cyan-600   dark:text-cyan-400",
    purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
  };
  return (
    <div className="bg-white dark:bg-[#1e2235] rounded-2xl p-4 shadow-sm flex flex-col gap-2">
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-tight">{label}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {tip && <InfoTip text={tip} />}
          {alert && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              alert === "critical" ? "bg-red-100 text-red-600" :
              alert === "warning"  ? "bg-amber-100 text-amber-600" :
                                     "bg-green-100 text-green-600"
            }`}>{alert.toUpperCase()}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-black text-slate-800 dark:text-white leading-none truncate">{value}</p>
          {sub && <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Section header ───────────────────────────────────────────────────────────
function SectionHead({ title, sub, tip }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5">
        <h2 className="text-sm font-bold text-slate-800 dark:text-white">{title}</h2>
        {tip && <InfoTip text={tip} />}
      </div>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Bar chart tooltip ────────────────────────────────────────────────────────
function BarTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-[#1e2235] border border-slate-100 dark:border-slate-700 rounded-xl p-2.5 shadow-lg text-xs">
      <p className="font-semibold text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.fill || p.color }} className="font-bold">
          ${Number(p.value).toFixed(4)}
        </p>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AdminAIUsage() {
  const [period,       setPeriod]       = useState("month");
  const [granularity,  setGranularity]  = useState("day");
  const [summary,      setSummary]      = useState(null);
  const [budget,       setBudget]       = useState(null);
  const [costOverTime, setCostOverTime] = useState([]);
  const [byFeature,    setByFeature]    = useState([]);
  const [byModel,      setByModel]      = useState([]);
  const [byUser,       setByUser]       = useState([]);
  const [cacheStats,   setCacheStats]   = useState(null);
  const [logs,         setLogs]         = useState([]);
  const [logPage,      setLogPage]      = useState(1);
  const [logTotal,     setLogTotal]     = useState(0);
  const [logPages,     setLogPages]     = useState(1);
  const [logFilter,    setLogFilter]    = useState({ feature: "", status: "" });
  const [loading,      setLoading]      = useState(true);
  const [logsLoading,  setLogsLoading]  = useState(false);

  const fetchAll = useCallback(async (p, g) => {
    setLoading(true);
    try {
      const [sumRes, budRes, timeRes, featRes, modRes, userRes, cacheRes] = await Promise.all([
        adminService.getUsageSummary({ period: p }),
        adminService.getUsageBudget({ monthly: 97.44 }),
        adminService.getUsageCostOverTime({ period: p, granularity: g }),
        adminService.getUsageByFeature({ period: p }),
        adminService.getUsageByModel({ period: p }),
        adminService.getUsageByUser({ period: p, limit: 15 }),
        adminService.getUsageCacheStats({ period: p }),
      ]);
      setSummary(sumRes.data.summary || {});
      setBudget(budRes.data);
      setCostOverTime(timeRes.data.data || []);
      setByFeature(featRes.data.data || []);
      setByModel(modRes.data.data || []);
      setByUser(userRes.data.data || []);
      setCacheStats(cacheRes.data.data);
    } catch {
      toast.error("Failed to load usage data");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async (page, filter) => {
    setLogsLoading(true);
    try {
      const res = await adminService.getUsageLogs({ page, limit: 10, period, ...filter });
      setLogs(res.data.logs || []);
      setLogTotal(res.data.total || 0);
      setLogPages(res.data.pages || 1);
      setLogPage(page);
    } catch {
      toast.error("Failed to load logs");
    } finally {
      setLogsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAll(period, granularity);
    fetchLogs(1, logFilter);
  }, [period, granularity]);

  const refresh = () => { fetchAll(period, granularity); fetchLogs(1, logFilter); };

  const s = summary || {};

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-5 lg:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-5 pb-20">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">AI Usage & Cost</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">All users · Claude API token consumption &amp; billing</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-0.5 overflow-x-auto max-w-full">
            <button onClick={refresh} className="px-2 py-1.5 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors flex-shrink-0">
              <RefreshCw size={13} />
            </button>
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)}
                className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg whitespace-nowrap transition-all flex-shrink-0 ${
                  period === p.value
                    ? "bg-white dark:bg-[#1e2235] text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >{p.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Anthropic Account Balance Card ── */}
      {budget && (
        <div className={`rounded-2xl p-4 sm:p-5 border-2 ${
          budget.alert === "critical" ? "bg-red-50 dark:bg-red-900/10 border-red-300 dark:border-red-700" :
          budget.alert === "warning"  ? "bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700" :
                                        "bg-gradient-to-r from-indigo-50 to-cyan-50 dark:from-indigo-900/20 dark:to-cyan-900/20 border-indigo-200 dark:border-indigo-700"
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Left — remaining */}
            <div className="flex-1">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                Anthropic Credits Remaining (All-time)
              </p>
              <div className="flex items-end gap-2 flex-wrap">
                <span className={`text-3xl sm:text-4xl font-black ${
                  budget.alert === "critical" ? "text-red-600" :
                  budget.alert === "warning"  ? "text-amber-600" :
                                                "text-indigo-600 dark:text-indigo-400"
                }`}>
                  {fmt.usd2(Math.max(0, budget.budget - budget.spent))}
                </span>
                <span className="text-sm text-slate-400 mb-1">of $100.00 total credit</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Based on tracked API spend · Actual balance at{" "}
                <a href="https://console.anthropic.com" target="_blank" rel="noreferrer"
                  className="text-indigo-500 underline">console.anthropic.com</a>
              </p>
            </div>

            {/* Middle — progress bar */}
            <div className="flex-1 sm:max-w-[240px]">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1.5">
                <span>Tracked spend: {fmt.usd2(budget.spent)}</span>
                <span>{fmt.pct(((2.36 + budget.spent) / 100) * 100)} of $100 used</span>
              </div>
              <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    budget.alert === "critical" ? "bg-red-500" :
                    budget.alert === "warning"  ? "bg-amber-500" :
                                                  "bg-gradient-to-r from-indigo-500 to-cyan-500"
                  }`}
                  style={{ width: `${Math.min(100, budget.percentUsed)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
                <span>$0</span>
                <span>$100.00</span>
              </div>
            </div>

            {/* Right — stats */}
            <div className="flex sm:flex-col gap-4 sm:gap-2 sm:text-right flex-shrink-0">
              <div>
                <p className="text-[10px] text-slate-400">Total API Calls</p>
                <p className="text-base font-black text-slate-700 dark:text-white">{fmt.num(budget.calls)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Remaining</p>
                <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  {fmt.usd2(Math.max(0, budget.budget - budget.spent))}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Budget Alert ── */}
      {budget && budget.alert !== "ok" && (
        <div className={`flex items-start gap-3 p-3.5 rounded-2xl border ${
          budget.alert === "critical"
            ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
            : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
        }`}>
          <AlertTriangle size={16} className={`flex-shrink-0 mt-0.5 ${budget.alert === "critical" ? "text-red-500" : "text-amber-500"}`} />
          <div>
            <p className={`text-sm font-bold ${budget.alert === "critical" ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"}`}>
              {budget.alert === "critical" ? "Budget Critical" : "Budget Warning"}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {fmt.usd2(budget.spent)} spent of {fmt.usd2(budget.budget)} ({fmt.pct(budget.percentUsed)}) — all-time
            </p>
          </div>
        </div>
      )}

      {/* ── KPI Grid: Row 1 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={DollarSign} color="indigo" label="Total Cost" tip={EXPLAINERS.totalCost}
          value={fmt.usd(s.totalCostUsd)}
          sub={`${fmt.num(s.totalCalls)} API calls · all users`} />
        <StatCard icon={Zap} color="purple" label="Total Tokens" tip={EXPLAINERS.totalTokens}
          value={fmt.num(s.totalTokens)}
          sub={`${fmt.num(s.totalInputTokens)} in · ${fmt.num(s.totalOutputTokens)} out`} />
        <StatCard icon={Activity} label="Avg Latency" tip={EXPLAINERS.avgLatency}
          color={s.errorRate > 5 ? "red" : "green"}
          value={fmt.ms(s.avgDurationMs || 0)}
          sub={`Error rate: ${fmt.pct(s.errorRate)}`} />
        <StatCard icon={Database} color="cyan" label="Cache Hit Rate" tip={EXPLAINERS.cacheHitRate}
          value={fmt.pct(s.cacheHitRate)}
          sub={`Saved ${fmt.usd(s.cacheSavingsUsd)}`} />
      </div>

      {/* ── KPI Grid: Row 2 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} color="indigo" label="Unique Users" tip={EXPLAINERS.uniqueUsers}
          value={fmt.num(s.uniqueUserCount)}
          sub="Users who used AI" />
        <StatCard icon={CheckCircle} color="green" label="Successful Calls"
          value={fmt.num(s.successCalls)}
          sub={`${fmt.num(s.errorCalls)} failed`} />
        <StatCard icon={TrendingUp} color="cyan" label="Cache Read Tokens" tip={EXPLAINERS.cacheRead}
          value={fmt.num(s.totalCacheRead)}
          sub="Served cheap from cache" />
        {budget && (
          <StatCard icon={DollarSign} label="Monthly Budget" tip={EXPLAINERS.budget}
            color={budget.alert === "critical" ? "red" : budget.alert === "warning" ? "amber" : "green"}
            alert={budget.alert}
            value={fmt.usd2(budget.spent)}
            sub={`of ${fmt.usd2(budget.budget)} · ${fmt.pct(budget.percentUsed)} used`} />
        )}
      </div>

      {/* ── Token Breakdown explainer strip ── */}
      <div className="bg-slate-50 dark:bg-[#181d2e] rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Input Tokens",      value: s.totalInputTokens,  color: "text-indigo-600", tip: EXPLAINERS.inputTokens,  rate: "Sonnet $3/M" },
          { label: "Output Tokens",     value: s.totalOutputTokens, color: "text-rose-600",   tip: EXPLAINERS.outputTokens, rate: "Sonnet $15/M" },
          { label: "Cache Read",        value: s.totalCacheRead,    color: "text-cyan-600",   tip: EXPLAINERS.cacheRead,    rate: "Sonnet $0.30/M" },
          { label: "Cache Write",       value: s.totalCacheWrite,   color: "text-amber-600",  tip: EXPLAINERS.cacheWrite,   rate: "Sonnet $3.75/M" },
        ].map(item => (
          <div key={item.label} className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{item.label}</span>
              <InfoTip text={item.tip} />
            </div>
            <p className={`text-base sm:text-lg font-black ${item.color}`}>{fmt.num(item.value)}</p>
            <p className="text-[10px] text-slate-400">{item.rate}</p>
          </div>
        ))}
      </div>

      {/* ── Cost Over Time (Bar) ── */}
      <div className="bg-white dark:bg-[#1e2235] rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2 mb-4">
          <SectionHead title="Cost Over Time" sub="USD billed by Anthropic per period · all users" />
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 self-start xs:self-auto">
            {["day","week","month"].map(g => (
              <button key={g} onClick={() => setGranularity(g)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all capitalize ${
                  granularity === g
                    ? "bg-white dark:bg-[#2a3050] text-indigo-600 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >{g}</button>
            ))}
          </div>
        </div>
        {costOverTime.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-slate-400 text-sm">No data for this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={costOverTime} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="#94a3b8" tickLine={false} />
              <YAxis tick={{ fontSize: 9 }} stroke="#94a3b8" tickFormatter={v => `$${v}`} tickLine={false} axisLine={false} />
              <Tooltip content={<BarTip />} cursor={{ fill: "#6366f120" }} />
              <Bar dataKey="cost" name="Cost (USD)" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Feature + Model ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* By Feature */}
        <div className="bg-white dark:bg-[#1e2235] rounded-2xl p-4 sm:p-5 shadow-sm">
          <SectionHead title="Cost by Feature" sub="Which app features spend the most budget" />
          {byFeature.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-slate-400 text-sm">No data</div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="w-full sm:w-auto flex-shrink-0">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={byFeature} dataKey="totalCost" nameKey="feature"
                      cx="50%" cy="50%" outerRadius={65} innerRadius={38}>
                      {byFeature.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [`$${Number(v).toFixed(4)}`, "Cost"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 w-full space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {byFeature.map((f, i) => (
                  <div key={f.feature} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate">{FEATURE_LABELS[f.feature] || f.feature}</span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[11px] font-bold text-slate-800 dark:text-white">{fmt.usd(f.totalCost)}</p>
                      <p className="text-[10px] text-slate-400">{fmt.pct(f.costPct)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* By Model */}
        <div className="bg-white dark:bg-[#1e2235] rounded-2xl p-4 sm:p-5 shadow-sm">
          <SectionHead title="Cost by Model" sub="Sonnet vs Haiku spend with pricing rates" />
          {byModel.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-slate-400 text-sm">No data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={byModel} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9 }} stroke="#94a3b8" tickFormatter={v => `$${v}`} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="model" tick={{ fontSize: 9 }} stroke="#94a3b8" width={80}
                    tickFormatter={v => fmt.model(v)} tickLine={false} axisLine={false} />
                  <Tooltip content={<BarTip />} cursor={{ fill: "#6366f110" }} />
                  <Bar dataKey="totalCost" radius={[0,6,6,0]} maxBarSize={24}>
                    {byModel.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-2 border-t border-slate-100 dark:border-slate-700 pt-3">
                {byModel.map((m, i) => (
                  <div key={m.model} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-[10px] text-slate-500 font-mono">{fmt.model(m.model)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <span>{fmt.num(m.calls)} calls</span>
                      <span>{fmt.num(m.totalTokens)} tok</span>
                      <span className="font-bold text-slate-700 dark:text-white">{fmt.usd(m.totalCost)}</span>
                    </div>
                    {m.pricing && (
                      <p className="w-full text-[9px] text-slate-300 dark:text-slate-600 pl-3.5">
                        ${m.pricing.inputPerMToken}/M in · ${m.pricing.outputPerMToken}/M out · ${m.pricing.cacheReadPerMToken}/M cache
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Cache Stats ── */}
      {cacheStats && (
        <div className="bg-white dark:bg-[#1e2235] rounded-2xl p-4 sm:p-5 shadow-sm">
          <SectionHead title="Prompt Cache Savings"
            sub="System prompts get cached — repeated calls within 5 min get a 90% discount on those tokens"
            tip={EXPLAINERS.cacheSavings} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Cache Hit Rate",    value: fmt.pct(cacheStats.cacheHitRate),             color: "text-indigo-600", tip: EXPLAINERS.cacheHitRate },
              { label: "Total Saved",       value: fmt.usd(cacheStats.savingsUsd),                color: "text-green-600",  tip: EXPLAINERS.cacheSavings },
              { label: "Tokens Read (Cheap)",value: fmt.num(cacheStats.totalCacheReadTokens),     color: "text-cyan-600",   tip: EXPLAINERS.cacheRead },
              { label: "Tokens Written",    value: fmt.num(cacheStats.totalCacheWriteTokens),     color: "text-amber-600",  tip: EXPLAINERS.cacheWrite },
            ].map(item => (
              <div key={item.label} className="bg-slate-50 dark:bg-[#181d2e] rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <p className="text-[10px] text-slate-400">{item.label}</p>
                  <InfoTip text={item.tip} />
                </div>
                <p className={`text-lg sm:text-xl font-black ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>
          {cacheStats.byModel?.length > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-700 pt-3 space-y-2">
              <p className="text-[11px] font-semibold text-slate-400">Per-Model Cache Savings</p>
              {cacheStats.byModel.map(m => (
                <div key={m.model} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 text-[10px]">
                  <span className="text-slate-500 font-mono">{fmt.model(m.model)}</span>
                  <div className="flex flex-wrap gap-3 text-slate-400">
                    <span>{fmt.num(m.cacheReadTokens)} tokens cached</span>
                    <span>${m.inputPricePerM}/M full → ${m.cacheReadPricePerM}/M cached</span>
                    <span className="font-bold text-green-600">{fmt.usd(m.savingsUsd)} saved</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Top Users ── */}
      <div className="bg-white dark:bg-[#1e2235] rounded-2xl p-4 sm:p-5 shadow-sm">
        <SectionHead title="Top Users by Cost" sub="All platform users ranked by AI spend" tip={EXPLAINERS.uniqueUsers} />
        {byUser.length === 0 ? (
          <div className="h-20 flex items-center justify-center text-slate-400 text-sm">No data</div>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  {["#","User","Calls","Tokens","Cost","Last Used"].map(h => (
                    <th key={h} className={`py-2 px-2 text-[10px] font-semibold text-slate-400 ${h === "#" || h === "User" ? "text-left" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byUser.map((u, i) => (
                  <tr key={u.userId} className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-2 text-[10px] text-slate-400">{i + 1}</td>
                    <td className="py-2 px-2">
                      <p className="text-[11px] font-semibold text-slate-800 dark:text-white">{u.name}</p>
                      <p className="text-[9px] text-slate-400 truncate max-w-[140px]">{u.email}</p>
                    </td>
                    <td className="py-2 px-2 text-right text-[11px] text-slate-500">{fmt.num(u.calls)}</td>
                    <td className="py-2 px-2 text-right text-[11px] text-slate-500">{fmt.num(u.totalTokens)}</td>
                    <td className="py-2 px-2 text-right text-[11px] font-bold text-slate-800 dark:text-white">{fmt.usd(u.totalCost)}</td>
                    <td className="py-2 px-2 text-right text-[10px] text-slate-400 whitespace-nowrap">
                      {u.lastUsed ? new Date(u.lastUsed).toLocaleDateString(undefined, { month:"short", day:"numeric" }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Feature Detail Table ── */}
      <div className="bg-white dark:bg-[#1e2235] rounded-2xl p-4 sm:p-5 shadow-sm">
        <SectionHead title="Feature Breakdown" sub="Per-feature cost, avg tokens, latency and error rate" />
        {byFeature.length === 0 ? (
          <div className="h-20 flex items-center justify-center text-slate-400 text-sm">No data</div>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left py-2 px-2 text-[10px] font-semibold text-slate-400">Feature</th>
                  <th className="text-right py-2 px-2 text-[10px] font-semibold text-slate-400">Calls</th>
                  <th className="text-right py-2 px-2 text-[10px] font-semibold text-slate-400">Errors</th>
                  <th className="text-right py-2 px-2 text-[10px] font-semibold text-slate-400">Avg Tokens</th>
                  <th className="text-right py-2 px-2 text-[10px] font-semibold text-slate-400">Avg Time</th>
                  <th className="text-right py-2 px-2 text-[10px] font-semibold text-slate-400">Cost</th>
                  <th className="text-right py-2 px-2 text-[10px] font-semibold text-slate-400">Share</th>
                </tr>
              </thead>
              <tbody>
                {byFeature.map((f, i) => (
                  <tr key={f.feature} className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{FEATURE_LABELS[f.feature] || f.feature}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right text-[11px] text-slate-500">{fmt.num(f.calls)}</td>
                    <td className="py-2.5 px-2 text-right">
                      <span className={`text-[11px] font-semibold ${f.errors > 0 ? "text-red-500" : "text-slate-300 dark:text-slate-600"}`}>
                        {f.errors > 0 ? `${f.errors} (${fmt.pct(f.errorRate)})` : "—"}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right text-[11px] text-slate-500">{fmt.num(f.avgTokens)}</td>
                    <td className="py-2.5 px-2 text-right text-[11px] text-slate-500">{fmt.ms(f.avgDurationMs)}</td>
                    <td className="py-2.5 px-2 text-right text-[11px] font-bold text-slate-800 dark:text-white">{fmt.usd(f.totalCost)}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-12 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${f.costPct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        </div>
                        <span className="text-[10px] text-slate-400 w-7 text-right">{fmt.pct(f.costPct)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── API Call Logs ── */}
      <div className="bg-white dark:bg-[#1e2235] rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <SectionHead title="API Call Logs" sub={`${fmt.num(logTotal)} total records · all users`} />
          <div className="flex flex-wrap gap-2">
            <select value={logFilter.feature}
              onChange={e => { const f = { ...logFilter, feature: e.target.value }; setLogFilter(f); fetchLogs(1, f); }}
              className="text-[11px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a1f35] text-slate-600 dark:text-slate-300 rounded-lg px-2 py-1.5"
            >
              <option value="">All Features</option>
              {Object.entries(FEATURE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={logFilter.status}
              onChange={e => { const f = { ...logFilter, status: e.target.value }; setLogFilter(f); fetchLogs(1, f); }}
              className="text-[11px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a1f35] text-slate-600 dark:text-slate-300 rounded-lg px-2 py-1.5"
            >
              <option value="">All Status</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                {[
                  { label: "Time",    align: "left"  },
                  { label: "Feature", align: "left"  },
                  { label: "Model",   align: "left"  },
                  { label: "User",    align: "left"  },
                  { label: "In",      align: "right", tip: EXPLAINERS.inputTokens  },
                  { label: "Out",     align: "right", tip: EXPLAINERS.outputTokens },
                  { label: "Cache",   align: "right", tip: EXPLAINERS.cacheRead    },
                  { label: "Cost",    align: "right" },
                  { label: "Time",    align: "right", tip: EXPLAINERS.avgLatency   },
                  { label: "✓",       align: "center"},
                ].map((h, i) => (
                  <th key={i} className={`py-2 px-2 text-[10px] font-semibold text-slate-400 text-${h.align}`}>
                    <span className="inline-flex items-center gap-0.5">
                      {h.label}{h.tip && <InfoTip text={h.tip} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logsLoading ? (
                <tr><td colSpan={10} className="py-8 text-center text-slate-400 text-xs">Loading…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={10} className="py-8 text-center text-slate-400 text-xs">No logs found</td></tr>
              ) : logs.map(log => (
                <tr key={log._id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-2 px-2 text-[10px] text-slate-400 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString(undefined, { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })}
                  </td>
                  <td className="py-2 px-2">
                    <span className="text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                      {FEATURE_LABELS[log.feature] || log.feature}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-[10px] text-slate-400 font-mono whitespace-nowrap">{fmt.model(log.model)}</td>
                  <td className="py-2 px-2 text-[10px] text-slate-500 max-w-[100px] truncate">{log.userId?.name || log.userId?.email || "—"}</td>
                  <td className="py-2 px-2 text-right text-[10px] text-slate-500">{fmt.num(log.inputTokens)}</td>
                  <td className="py-2 px-2 text-right text-[10px] text-slate-500">{fmt.num(log.outputTokens)}</td>
                  <td className="py-2 px-2 text-right text-[10px] text-cyan-600 font-medium">{fmt.num(log.cacheReadTokens)}</td>
                  <td className="py-2 px-2 text-right text-[10px] font-bold text-slate-700 dark:text-slate-200">{fmt.usd(log.costUsd)}</td>
                  <td className="py-2 px-2 text-right text-[10px] text-slate-400">{fmt.ms(log.durationMs)}</td>
                  <td className="py-2 px-2 text-center">
                    {log.status === "success"
                      ? <span className="text-green-500 font-bold text-xs">✓</span>
                      : <span className="text-red-500 font-bold text-xs" title={log.errorMessage}>✗</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {logTotal > 0 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
            <p className="text-[11px] text-slate-400">Page {logPage} of {logPages} · {fmt.num(logTotal)} logs</p>
            <div className="flex items-center gap-1">
              <button disabled={logPage <= 1} onClick={() => fetchLogs(logPage - 1, logFilter)}
                className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <ChevronLeft size={13} />
              </button>
              {Array.from({ length: Math.min(5, logPages) }, (_, i) => {
                const p = logPage <= 3 ? i + 1 : logPage - 2 + i;
                if (p < 1 || p > logPages) return null;
                return (
                  <button key={p} onClick={() => fetchLogs(p, logFilter)}
                    className={`w-6 h-6 text-[11px] rounded-lg font-semibold transition-colors ${
                      p === logPage ? "bg-indigo-600 text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}>{p}</button>
                );
              })}
              <button disabled={logPage >= logPages} onClick={() => fetchLogs(logPage + 1, logFilter)}
                className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
