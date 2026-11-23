import { useMemo, useState } from "react";
import { Globe2, MapPin, Users, Zap, Info } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { motion, useReducedMotion } from "framer-motion";
import SEO from "../../hooks/useSEO";
import { adminV1Service } from "../../services/api";
import { KpiCard, ChartCard, EmptyState } from "../../components/admin/AdminUI";
import { CHART_COLORS, BRAND, container, riseIn } from "../../components/admin/adminTheme";
import { useApi } from "../../components/admin/useApi";
import { Page, PageHeader, DateRange, LoadingGrid, ErrorState, PrivacyNote } from "../../components/admin/TakeAdminKit";

const iso = (d) => d.toISOString().split("T")[0];

function HBar({ rows, color = BRAND.blue, onPick, activeName }) {
  const reduce = useReducedMotion();
  if (!rows?.length) return <EmptyState title="Nothing to show yet" hint="No group reaches the 10-user minimum." />;
  const h = Math.max(220, rows.length * 38);
  return (
    <div style={{ height: h }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={130} axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: "#0B1B3A" }} />
          <Tooltip cursor={{ fill: "rgba(32,90,226,0.06)" }} formatter={(v) => [v.toLocaleString(), "Users"]} />
          <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={20} isAnimationActive={!reduce} animationDuration={900} onClick={onPick ? (d) => onPick(d.name) : undefined} cursor={onPick ? "pointer" : undefined} label={{ position: "right", fontSize: 12, fontWeight: 700, fill: "#0B1B3A" }}>
            {rows.map((r) => (
              <Cell key={r.name} fill={activeName && r.name !== activeName ? "#C9D6F7" : color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Donut({ rows }) {
  const reduce = useReducedMotion();
  if (!rows?.length) return <EmptyState title="Nothing to show yet" hint="No group reaches the 10-user minimum." />;
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="h-[200px] w-[200px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={4} cornerRadius={6} stroke="none" isAnimationActive={!reduce} animationDuration={1000}>
              {rows.map((r, i) => <Cell key={r.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 w-full space-y-2.5">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="font-semibold text-slate-700 capitalize truncate">{r.name}</span>
            </span>
            <span className="font-extrabold text-tk-ink">{r.value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function TakeAdminRegional() {
  const [start, setStart] = useState(() => iso(new Date(Date.now() - 30 * 864e5)));
  const [end, setEnd] = useState(() => iso(new Date()));
  const [state, setState] = useState("");
  const params = useMemo(() => ({ startDate: start, endDate: end, state: state || undefined }), [start, end, state]);

  const overview = useApi(() => adminV1Service.regional({ startDate: start, endDate: end }), [start, end]);
  const detail = useApi(() => adminV1Service.regional(params), [params]);

  const stateOptions = (overview.data?.states || []).filter((s) => s.name !== "Other (small groups)");
  const d = detail.data;

  return (
    <Page>
      <SEO pageName="takeAdminRegional" />
      <PageHeader
        icon={Globe2}
        title="Regional Analytics"
        subtitle="Where users are, and what they eat"
        actions={
          <>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              aria-label="Filter by state"
              className="h-11 px-3.5 bg-white border border-tk-line rounded-xl text-sm font-semibold text-tk-ink focus:outline-none focus:border-tk-blue focus:ring-4 focus:ring-tk-blue/10 cursor-pointer"
            >
              <option value="">All states</option>
              {stateOptions.map((s) => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
            <DateRange start={start} end={end} onStart={setStart} onEnd={setEnd} />
          </>
        }
      />
      <PrivacyNote minGroup={d?.minGroupSize} />

      {detail.loading && !d ? (
        <LoadingGrid cards={3} />
      ) : detail.error ? (
        <ErrorState message={detail.error} onRetry={detail.reload} />
      ) : d?.hidden ? (
        <div className="bg-white border border-tk-line rounded-3xl py-14">
          <EmptyState title={`${d.state}: details hidden`} hint={d.message} />
        </div>
      ) : (
        <>
          <motion.div variants={container} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard label={d.state ? `Users in ${d.state}` : "Total users"} value={d.totalUsers} icon={Users} tone="blue" />
            <KpiCard label="Users with a state set" value={`${d.coverage.pctWithState}%`} icon={MapPin} tone="teal" subtitle={`${d.coverage.withState.toLocaleString()} users told us their state`} />
            {d.state ? (
              <KpiCard label={`Active in ${d.state}`} value={d.activeUsers ?? 0} icon={Zap} tone="mint" subtitle="In the selected period" />
            ) : (
              <KpiCard label="States shown" value={d.states.filter((s) => s.name !== "Other (small groups)").length} icon={Globe2} tone="info" subtitle="Each has 10+ users" />
            )}
          </motion.div>

          {d.coverage.pctWithState < 70 && (
            <motion.div variants={riseIn} className="flex items-start gap-3 p-4 rounded-2xl bg-tk-warn/15 border border-tk-warn/30">
              <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">
                Only <b>{d.coverage.pctWithState}%</b> of users have a state saved, so these charts show a partial picture. Asking for the state at sign-up
                would make regional numbers reliable.
              </p>
            </motion.div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ChartCard title="Users by state" subtitle={d.state ? "Click a bar to switch state" : "Click a bar to drill in"}>
              <HBar rows={overview.data?.states || d.states} onPick={(n) => n !== "Other (small groups)" && setState(n)} activeName={d.state} />
            </ChartCard>

            <ChartCard title="Diet type" subtitle={d.state ? `In ${d.state}` : "All users who told us"}>
              <Donut rows={d.dietTypes} />
            </ChartCard>

            {d.state ? (
              <ChartCard title={`Cities in ${d.state}`} subtitle="Cities with 10+ users">
                <HBar rows={d.cities} color={BRAND.teal} />
              </ChartCard>
            ) : (
              <ChartCard title="Food region" subtitle="North, South, East, West, North-East">
                <HBar rows={d.regions} color={BRAND.teal} />
              </ChartCard>
            )}

            <ChartCard title="Not collected yet" subtitle="Needs new tracking before it can be shown">
              <ul className="space-y-2.5 text-sm text-slate-700">
                {["Most-logged foods per state", "Food suggestion acceptance per state", "Verified-food coverage per state"].map((t) => (
                  <li key={t} className="flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-tk-muted" /> {t}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-tk-muted">These are not stored per state in the database today, so nothing is estimated or made up here.</p>
            </ChartCard>
          </div>
        </>
      )}
    </Page>
  );
}
