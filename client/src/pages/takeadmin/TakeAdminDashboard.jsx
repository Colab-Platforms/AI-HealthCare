import { useMemo, useState } from "react";
import { Users, UserPlus, Zap, Activity, CalendarRange, Repeat, BarChart3 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useReducedMotion } from "framer-motion";
import SEO from "../../hooks/useSEO";
import { adminV1Service } from "../../services/api";
import { KpiCard, ChartCard, LegendDot, EmptyState } from "../../components/admin/AdminUI";
import { BRAND, container } from "../../components/admin/adminTheme";
import { useApi } from "../../components/admin/useApi";
import { Page, PageHeader, DateRange, LoadingGrid, ErrorState, PrivacyNote } from "../../components/admin/TakeAdminKit";
import { motion } from "framer-motion";

const iso = (d) => d.toISOString().split("T")[0];
const shortDate = (s) => new Date(s).toLocaleDateString(undefined, { day: "2-digit", month: "short" });

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-white border border-tk-line shadow-lg px-3.5 py-2.5 text-xs">
      <p className="font-bold text-tk-ink mb-1.5">{shortDate(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 font-semibold" style={{ color: p.color }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="text-tk-ink">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function TrendChart({ data, dataKey, name, color, gradId }) {
  const reduce = useReducedMotion();
  if (!data?.length) return <EmptyState title="No data in this period" hint="Try widening the date range." />;
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.24} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E3EAF0" />
          <XAxis dataKey="date" tickFormatter={shortDate} axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: "#6B7794" }} minTickGap={24} />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: "#6B7794" }} />
          <Tooltip content={<Tip />} cursor={{ stroke: BRAND.action, strokeDasharray: "4 4" }} />
          <Area type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={3} fill={`url(#${gradId})`} isAnimationActive={!reduce} animationDuration={1100} dot={false} activeDot={{ r: 5, strokeWidth: 3, stroke: "#fff" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Cohort heatmap: rows = signup week, columns = weeks since signup, cell = % still active. */
function RetentionHeatmap({ cohorts }) {
  const maxWeeks = Math.max(0, ...cohorts.map((c) => c.weeks.length));
  const visible = cohorts.filter((c) => !c.hidden);
  if (!visible.length) {
    return <EmptyState title="Not enough users per weekly cohort yet" hint="A cohort needs at least 10 sign-ups in a week to be shown." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-1 min-w-[520px]">
        <thead>
          <tr className="text-[11px] font-bold uppercase tracking-[0.1em] text-tk-muted">
            <th className="text-left px-2 py-1.5 font-bold">Week of sign-up</th>
            <th className="px-2 py-1.5 font-bold text-right">Users</th>
            {Array.from({ length: maxWeeks }).map((_, i) => (
              <th key={i} className="px-2 py-1.5 font-bold text-center">{i === 0 ? "Wk 0" : `Wk ${i}`}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((c) => (
            <tr key={c.cohortStart}>
              <td className="px-2 py-1.5 font-semibold text-tk-ink whitespace-nowrap">{shortDate(c.cohortStart)}</td>
              <td className="px-2 py-1.5 text-right text-slate-600 font-semibold">{c.size}</td>
              {Array.from({ length: maxWeeks }).map((_, i) => {
                const v = c.weeks[i];
                return (
                  <td key={i} className="p-0">
                    {v == null ? (
                      <div className="h-9 rounded-lg" />
                    ) : (
                      <div
                        className="h-9 rounded-lg grid place-items-center text-xs font-bold"
                        style={{ backgroundColor: `rgba(32,90,226,${0.08 + (v / 100) * 0.85})`, color: v > 45 ? "#fff" : "#0B1B3A" }}
                        title={`${v}% active`}
                      >
                        {v}%
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TakeAdminDashboard() {
  const [start, setStart] = useState(() => iso(new Date(Date.now() - 30 * 864e5)));
  const [end, setEnd] = useState(() => iso(new Date()));
  const params = useMemo(() => ({ startDate: start, endDate: end }), [start, end]);

  const platform = useApi(() => adminV1Service.platform(params), [params]);
  const retention = useApi(() => adminV1Service.retention(), []);

  const k = platform.data?.kpis;

  return (
    <Page>
      <SEO pageName="takeAdminDashboard" />
      <PageHeader
        icon={BarChart3}
        title="Platform Analytics"
        subtitle="Growth, engagement and retention across the whole business"
        actions={<DateRange start={start} end={end} onStart={setStart} onEnd={setEnd} />}
      />
      <PrivacyNote minGroup={platform.data?.minGroupSize} />

      {platform.loading && !platform.data ? (
        <LoadingGrid />
      ) : platform.error ? (
        <ErrorState message={platform.error} onRetry={platform.reload} />
      ) : (
        <>
          <motion.div variants={container} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <KpiCard label="Total registered users" value={k.totalUsers} icon={Users} tone="blue" subtitle="Excludes admin accounts" />
            <KpiCard
              label="New registrations"
              value={k.newUsers}
              icon={UserPlus}
              tone="teal"
              trend={k.newUserGrowthPct ?? undefined}
              subtitle="vs. the previous period of the same length"
            />
            <KpiCard label="Daily active users" value={k.dau} icon={Zap} tone="mint" subtitle="On the last day of the range" />
            <KpiCard label="Weekly active users" value={k.wau} icon={Activity} tone="info" subtitle="Last 7 days of the range" />
            <KpiCard label="Monthly active users" value={k.mau} icon={CalendarRange} tone="blue" subtitle="Active in the selected period" />
            <KpiCard label="Stickiness (DAU ÷ MAU)" value={`${k.stickinessPct}%`} icon={Repeat} tone="amber" subtitle="How often active users come back" />
          </motion.div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ChartCard title="Registration growth" subtitle="New sign-ups per day" legend={<LegendDot color={BRAND.blue} label="Sign-ups" />}>
              <TrendChart data={platform.data.signupTrend} dataKey="signups" name="Sign-ups" color={BRAND.blue} gradId="tkSignups" />
            </ChartCard>
            <ChartCard title="Active users" subtitle="Distinct users active per day" legend={<LegendDot color={BRAND.teal} label="Active users" />}>
              <TrendChart data={platform.data.activeTrend} dataKey="activeUsers" name="Active users" color={BRAND.teal} gradId="tkActive" />
            </ChartCard>
          </div>
        </>
      )}

      <ChartCard title="User retention" subtitle="Weekly cohorts: % still active after sign-up">
        {retention.loading && !retention.data ? (
          <LoadingGrid cards={0} />
        ) : retention.error ? (
          <ErrorState message={retention.error} onRetry={retention.reload} />
        ) : (
          <RetentionHeatmap cohorts={retention.data.cohorts} />
        )}
      </ChartCard>
    </Page>
  );
}
