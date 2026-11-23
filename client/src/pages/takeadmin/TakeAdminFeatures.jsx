import { useMemo, useState } from "react";
import { Boxes } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useReducedMotion } from "framer-motion";
import SEO from "../../hooks/useSEO";
import { adminV1Service } from "../../services/api";
import { ChartCard, EmptyState } from "../../components/admin/AdminUI";
import { CHART_COLORS } from "../../components/admin/adminTheme";
import { useApi } from "../../components/admin/useApi";
import { Page, PageHeader, DateRange, LoadingGrid, ErrorState, PrivacyNote } from "../../components/admin/TakeAdminKit";

const iso = (d) => d.toISOString().split("T")[0];

export default function TakeAdminFeatures() {
  const reduce = useReducedMotion();
  const [start, setStart] = useState(() => iso(new Date(Date.now() - 30 * 864e5)));
  const [end, setEnd] = useState(() => iso(new Date()));
  const params = useMemo(() => ({ startDate: start, endDate: end }), [start, end]);
  const { data, loading, error, reload } = useApi(() => adminV1Service.features(params), [params]);

  return (
    <Page>
      <SEO pageName="takeAdminFeatures" />
      <PageHeader
        icon={Boxes}
        title="Feature Usage"
        subtitle="How many different users use each feature"
        actions={<DateRange start={start} end={end} onStart={setStart} onEnd={setEnd} />}
      />
      <PrivacyNote minGroup={data?.minGroupSize} />

      {loading && !data ? (
        <LoadingGrid cards={0} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <>
          <ChartCard title="Users per feature" subtitle={`Out of ${data.activeUsers.toLocaleString()} active users in this period`}>
            {data.features.length === 0 ? (
              <EmptyState title="No feature reaches the 10-user minimum" hint="Widen the date range to include more activity." />
            ) : (
              <div style={{ height: Math.max(240, data.features.length * 52) }} className="w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.features} layout="vertical" margin={{ top: 0, right: 60, left: 8, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={140} axisLine={false} tickLine={false} tick={{ fontSize: 13, fontWeight: 600, fill: "#0B1B3A" }} />
                    <Tooltip cursor={{ fill: "rgba(32,90,226,0.06)" }} formatter={(v, _n, p) => [`${v.toLocaleString()} users (${p.payload.pctOfActive}% of active)`, ""]} />
                    <Bar dataKey="users" radius={[0, 8, 8, 0]} barSize={26} isAnimationActive={!reduce} animationDuration={900} label={{ position: "right", fontSize: 12, fontWeight: 700, fill: "#0B1B3A" }}>
                      {data.features.map((f, i) => <Cell key={f.key} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
          <p className="text-xs text-tk-muted">
            Counts distinct users, not taps, and logging in is not counted as a feature. AI assistant and diet-plan usage are not tracked as activity events yet.
          </p>
        </>
      )}
    </Page>
  );
}
