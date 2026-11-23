import { useState, useEffect, useMemo } from "react";
import { adminService, activityService } from "../services/api";
import {
  Users,
  FileText,
  Activity,
  Utensils,
  Zap,
  UserPlus,
  CalendarDays,
  ArrowRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import SEO from "../hooks/useSEO";
import {
  KpiCard,
  ChartCard,
  LegendDot,
  Skeleton,
  EmptyState,
} from "../components/admin/AdminUI";
import { BRAND, CHART_COLORS, container, riseIn } from "../components/admin/adminTheme";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const systemHubs = [
  { label: "Manage Users", path: "/admin/users", icon: Users },
  { label: "User Intelligence", path: "/admin/activity", icon: Activity },
  { label: "Food DB", path: "/admin/food-cache", icon: Utensils },
  { label: "Health Reports", path: "/admin/reports", icon: FileText },
  { label: "AI Usage & Cost", path: "/admin/ai-usage", icon: Zap },
  { label: "Creator Applications", path: "/admin/creator-applications", icon: UserPlus },
];

function DateField({ value, onChange, label }) {
  return (
    <label className="group flex items-center gap-2 bg-white rounded-xl pl-3 pr-2 py-2 border border-tk-line
      hover:border-tk-action focus-within:border-tk-blue focus-within:ring-4 focus-within:ring-tk-blue/10 transition-all">
      <CalendarDays className="w-4 h-4 text-tk-muted group-focus-within:text-tk-blue transition-colors" />
      <span className="sr-only">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="text-sm font-semibold text-tk-ink bg-transparent focus:outline-none cursor-pointer w-[8.5rem]"
        style={{ colorScheme: "light", boxShadow: "none", border: "none" }}
      />
    </label>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-white border border-tk-line shadow-lg px-3.5 py-2.5 text-xs">
      <p className="font-bold text-tk-ink mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 font-semibold" style={{ color: p.color }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.dataKey}: <span className="text-tk-ink">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-6 md:p-8 space-y-8">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[148px] rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="lg:col-span-2 h-[380px] rounded-3xl" />
        <Skeleton className="h-[380px] rounded-3xl" />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [dauMau, setDauMau] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  useEffect(() => {
    fetchStats();
  }, [startDate, endDate]);

  const fetchStats = async () => {
    try {
      const params = { startDate, endDate };
      const [statsRes, dauMauRes] = await Promise.all([
        adminService.getStats(params),
        activityService.getDauMau(params),
      ]);
      setStats(statsRes.data);
      setDauMau(dauMauRes.data.metrics);
    } catch (error) {
      toast.error("Failed to load stats");
    } finally {
      setLoading(false);
    }
  };

  const growthData = useMemo(() => {
    if (!stats) return [];
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split("T")[0];
    }).reverse();
    return last7Days.map((date) => ({
      name: DAYS[new Date(date).getDay()],
      users: stats?.stats?.userGrowth?.find((g) => g._id === date)?.count || 0,
      reports: stats?.stats?.reportGrowth?.find((g) => g._id === date)?.count || 0,
    }));
  }, [stats]);

  const reportCategories = stats?.stats?.distribution?.length > 0 ? stats.stats.distribution : [];

  if (loading) return <DashboardSkeleton />;

  // Trends stay as before (placeholders from the original dashboard) until the API returns real deltas.
  const statCards = [
    { label: "Total Users", value: stats?.stats?.totalUsers || 0, icon: Users, tone: "blue", trend: 12.5 },
    { label: "Daily Active Users", value: dauMau?.dau || 0, icon: Zap, tone: "teal", trend: dauMau?.retention || 0, subtitle: "Today's active users" },
    { label: "Monthly Active Users", value: dauMau?.mau || 0, icon: Activity, tone: "info", subtitle: "Last 30 days" },
    { label: "Total Reports", value: stats?.stats?.totalReports || 0, icon: FileText, tone: "mint", trend: 8.2 },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="p-6 md:p-8 space-y-8 w-full mx-auto bg-tk-bg min-h-full"
    >
      <SEO pageName="adminDashboard" />

      {/* Header */}
      <motion.div variants={riseIn} className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-tk-ink">Admin Overview</h1>
          <p className="text-sm text-tk-muted mt-0.5">System performance and user engagement metrics</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DateField value={startDate} onChange={setStartDate} label="Start date" />
          <ArrowRight className="w-4 h-4 text-tk-muted" aria-hidden />
          <DateField value={endDate} onChange={setEndDate} label="End date" />
        </div>
      </motion.div>

      {/* Quick links */}
      <motion.div variants={riseIn} className="flex flex-wrap gap-2">
        {systemHubs.map((hub) => (
          <motion.button
            key={hub.path}
            onClick={() => navigate(hub.path)}
            whileHover={reduce ? undefined : { y: -2 }}
            whileTap={reduce ? undefined : { scale: 0.97 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold
              bg-white text-tk-blue border border-tk-blue/20 hover:bg-tk-blue hover:text-white hover:border-tk-blue
              focus:outline-none focus-visible:ring-4 focus-visible:ring-tk-blue/20 transition-colors"
          >
            <hub.icon className="w-3.5 h-3.5" />
            {hub.label}
          </motion.button>
        ))}
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <KpiCard key={s.label} {...s} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard
          title="Growth Velocity"
          subtitle="Real-time engagement trends"
          className="lg:col-span-2"
          legend={
            <div className="flex gap-4">
              <LegendDot color={BRAND.blue} label="Users" />
              <LegendDot color={BRAND.teal} label="Reports" />
            </div>
          }
        >
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="tkUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BRAND.blue} stopOpacity={0.22} />
                    <stop offset="95%" stopColor={BRAND.blue} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="tkReports" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BRAND.teal} stopOpacity={0.22} />
                    <stop offset="95%" stopColor={BRAND.teal} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E3EAF0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: "#6B7794" }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: "#6B7794" }} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: BRAND.action, strokeDasharray: "4 4" }} />
                <Area
                  type="monotone"
                  dataKey="users"
                  stroke={BRAND.blue}
                  strokeWidth={3}
                  fill="url(#tkUsers)"
                  isAnimationActive={!reduce}
                  animationDuration={1200}
                  animationEasing="ease-out"
                  dot={{ r: 3.5, fill: BRAND.blue, strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 6, strokeWidth: 3, stroke: "#fff" }}
                />
                <Area
                  type="monotone"
                  dataKey="reports"
                  stroke={BRAND.teal}
                  strokeWidth={3}
                  fill="url(#tkReports)"
                  isAnimationActive={!reduce}
                  animationDuration={1400}
                  animationBegin={200}
                  animationEasing="ease-out"
                  dot={{ r: 3.5, fill: BRAND.teal, strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 6, strokeWidth: 3, stroke: "#fff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Distribution" subtitle="Health report categories">
          {reportCategories.length === 0 ? (
            <EmptyState title="No reports in this period" hint="Try widening the date range." />
          ) : (
            <>
              <div className="h-[200px] w-full mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reportCategories}
                      innerRadius={58}
                      outerRadius={84}
                      paddingAngle={4}
                      cornerRadius={6}
                      dataKey="value"
                      stroke="none"
                      isAnimationActive={!reduce}
                      animationDuration={1100}
                      animationBegin={150}
                    >
                      {reportCategories.map((entry, i) => (
                        <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-3">
                {reportCategories.slice(0, 4).map((cat, i) => (
                  <li key={cat.name} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-[11px] font-bold uppercase tracking-wide text-tk-muted truncate">{cat.name}</span>
                    </span>
                    <span className="text-sm font-extrabold text-tk-ink">{cat.value}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </ChartCard>
      </div>
    </motion.div>
  );
}
