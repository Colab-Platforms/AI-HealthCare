import { useState, useEffect } from "react";
import { adminService, activityService } from "../services/api";
import {
  Users,
  FileText,
  Activity,
  ShieldCheck,
  ArrowRight,
  Utensils,
  BarChart3,
  Clock,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
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
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import SEO from "../hooks/useSEO";

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

  useEffect(() => {
    fetchStats();
  }, [startDate, endDate]);

  const fetchStats = async () => {
    try {
      const params = { startDate, endDate };
      const [statsRes, dauMauRes] = await Promise.all([
        adminService.getStats(params),
        activityService.getDauMau(params)
      ]);
      setStats(statsRes.data);
      setDauMau(dauMauRes.data.metrics);
    } catch (error) {
      toast.error("Failed to load stats");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088FE"];

  const growthData = stats
    ? (() => {
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - i);
          return d.toISOString().split("T")[0];
        }).reverse();

        return last7Days.map((date) => {
          const dayName = days[new Date(date).getDay()];
          const reportCount =
            stats?.stats?.reportGrowth?.find((g) => g._id === date)?.count || 0;
          const userCount =
            stats?.stats?.userGrowth?.find((g) => g._id === date)?.count || 0;
          return { name: dayName, users: userCount, reports: reportCount };
        });
      })()
    : [];

  const reportCategories =
    stats?.stats?.distribution?.length > 0
      ? stats.stats.distribution
      : [{ name: "No Data", value: 1 }];

  const statCards = [
    {
      label: "Total Users",
      value: stats?.stats?.totalUsers || 0,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
      trend: 12.5,
    },
    {
      label: "Daily Active Users",
      value: dauMau?.dau || 0,
      icon: Zap,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      trend: dauMau?.retention || 0,
      subtitle: "Today's active users"
    },
    {
      label: "Monthly Active Users",
      value: dauMau?.mau || 0,
      icon: Activity,
      color: "text-purple-600",
      bg: "bg-purple-50",
      subtitle: "Last 30 days"
    },
    // {
    //   label: "Repeat Users",
    //   value: stats?.stats?.repeatUsers || 0,
    //   icon: Clock,
    //   color: "text-rose-600",
    //   bg: "bg-rose-50",
    // },
    {
      label: "Total Reports",
      value: stats?.stats?.totalReports || 0,
      icon: FileText,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      trend: 8.2,
    },
    // {
    //   label: "Completion Rate",
    //   value: `${((stats?.stats?.completedReports / stats?.stats?.totalReports) * 100 || 0).toFixed(1)}%`,
    //   icon: Activity,
    //   color: "text-orange-600",
    //   bg: "bg-orange-50",
    //   trend: 2.4,
    // },
  ];

  const systemHubs = [
    { label: "Manage Users", path: "/admin/users", icon: Users },
    { label: "User Intelligence", path: "/admin/activity", icon: Activity },
    { label: "Food DB", path: "/admin/food-cache", icon: Utensils },
    { label: "Health Reports", path: "/admin/reports", icon: FileText },
  ];

  return (
    <div className="p-6 md:p-8 space-y-8 w-full mx-auto">
      <SEO pageName="adminDashboard" />
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Admin Overview</h1>
          <p className="text-slate-500 text-sm">
            System performance and user engagement metrics
          </p>
        </div>

        {/* Date Range Filter - Center */}
        <div className="flex items-center gap-4">
          {/* From Date */}
          <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2.5 shadow-sm border border-slate-100 hover:border-slate-200 transition-all">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-sm font-semibold text-slate-700 bg-transparent focus:outline-none cursor-pointer appearance-none w-32"
              style={{ 
                colorScheme: 'light',
                boxShadow: 'none',
                border: 'none'
              }}
            />
          </div>

          {/* Arrow Separator */}
          <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>

          {/* To Date */}
          <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2.5 shadow-sm border border-slate-100 hover:border-slate-200 transition-all">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-sm font-semibold text-slate-700 bg-transparent focus:outline-none cursor-pointer appearance-none w-32"
              style={{ 
                colorScheme: 'light',
                boxShadow: 'none',
                border: 'none'
              }}
            />
          </div>
        </div>

        {/* Chips - Right */}
        <div className="flex flex-wrap gap-2 justify-end">
          {systemHubs.map((hub, i) => (
            <motion.button
              key={i}
              onClick={() => navigate(hub.path)}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 border border-blue-200 rounded-full text-xs font-bold text-blue-700 flex items-center gap-2 transition-all hover:shadow-md hover:scale-105"
            >
              <hub.icon className="w-3.5 h-3.5" />
              {hub.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Stats Cards - Expanded for new metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={i}
            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3 hover:shadow-md transition-all"
          >
            <div className="flex justify-between items-start">
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              {stat.trend && stat.trend > 0 && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold">
                  <ArrowUpRight className="w-3 h-3" /> {stat.trend}%
                </div>
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5">
                {stat.label}
              </p>
              <p className="text-2xl font-black text-slate-800 tracking-tight">
                {stat.value}
              </p>
              {stat.subtitle && (
                <p className="text-[9px] text-slate-400 mt-1">{stat.subtitle}</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Analytics Visualization Group */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                Growth Velocity
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                Real-time engagement trends
              </p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  Users
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  Reports
                </span>
              </div>
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorReports" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f8fafc"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "16px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)",
                    background: "white",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="users"
                  stroke="#a855f7"
                  fillOpacity={1}
                  fill="url(#colorUsers)"
                  strokeWidth={3}
                  dot={{
                    r: 4,
                    fill: "#a855f7",
                    strokeWidth: 2,
                    stroke: "#fff",
                  }}
                  activeDot={{ r: 6 }}
                />
                <Area
                  type="monotone"
                  dataKey="reports"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorReports)"
                  strokeWidth={3}
                  dot={{
                    r: 4,
                    fill: "#3b82f6",
                    strokeWidth: 2,
                    stroke: "#fff",
                  }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-800">Distribution</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
              Health Report Categories
            </p>
          </div>

          <div className="h-[200px] w-full mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={reportCategories}
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {reportCategories.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            {reportCategories.slice(0, 4).map((cat, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    {cat.name}
                  </span>
                </div>
                <span className="text-xs font-black text-slate-800">
                  {cat.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Health / Status */}
        {/* <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <ShieldCheck className="w-6 h-6 text-blue-400" />
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-[10px] font-bold uppercase tracking-widest border border-blue-500/30">
                  Secure
                </span>
              </div>
              <div>
                <h4 className="font-bold text-lg">Platform Status</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  All core intelligence modules are operating within normal
                  parameters.
                </p>
              </div>
              <div className="pt-2 flex items-center gap-2 text-[10px] font-bold uppercase text-slate-500">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Real-time Monitoring Active
              </div>
            </div>
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4" /> Activity Feed
            </h4>
            <div className="space-y-4">
              {[
                {
                  time: "2m ago",
                  event: "New user registration",
                  type: "user",
                },
                {
                  time: "15m ago",
                  event: "Food cache updated (Biryani)",
                  type: "cache",
                },
                {
                  time: "1h ago",
                  event: "System backup completed",
                  type: "system",
                },
              ].map((log, i) => (
                <div key={i} className="flex gap-3 text-xs">
                  <span className="text-slate-400 font-medium whitespace-nowrap">
                    {log.time}
                  </span>
                  <span className="text-slate-600 font-bold">{log.event}</span>
                </div>
              ))}
            </div>
          </div>
        </div> */}
      </div>
    </div>
  );
}
