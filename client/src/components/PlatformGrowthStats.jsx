import { useState, useEffect } from 'react';
import { Users, TrendingUp, UserCheck, RefreshCcw, ArrowUpRight, ArrowDownRight, Activity, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { activityService } from '../services/api';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

export default function PlatformGrowthStats({ filters }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, [filters.startDate, filters.endDate]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await activityService.getDauMau({
        startDate: filters.startDate,
        endDate: filters.endDate
      });
      if (res.data?.success) setMetrics(res.data.metrics);
    } catch (e) {
      console.error('Failed to fetch platform metrics:', e);
    } finally {
      setLoading(false);
    }
  };

  const signupChartData = metrics?.signupTrend?.map(d => ({
    date: new Date(d._id).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    signups: d.count
  })) || [];

  const cards = metrics ? [
    {
      label: 'Total Registered Users',
      value: metrics.totalUsers,
      sub: 'All time platform signups',
      icon: Users,
      bg: 'bg-indigo-50',
      color: 'text-indigo-600',
      trend: null
    },
    {
      label: 'New Users (This Period)',
      value: metrics.newUsersInRange,
      sub: `${metrics.newUserGrowth >= 0 ? '+' : ''}${metrics.newUserGrowth}% vs prev period`,
      icon: UserCheck,
      bg: 'bg-emerald-50',
      color: 'text-emerald-600',
      trend: metrics.newUserGrowth,
      up: metrics.newUserGrowth >= 0
    },
    {
      label: 'Daily Active Users',
      value: metrics.dau,
      sub: 'Unique users active today',
      icon: Zap,
      bg: 'bg-amber-50',
      color: 'text-amber-600',
      trend: null
    },
    {
      label: 'Weekly Active Users',
      value: metrics.wau,
      sub: 'Unique users last 7 days',
      icon: Activity,
      bg: 'bg-blue-50',
      color: 'text-blue-600',
      trend: null
    },
    {
      label: 'Monthly Active Users',
      value: metrics.mau,
      sub: 'Unique users in date range',
      icon: TrendingUp,
      bg: 'bg-purple-50',
      color: 'text-purple-600',
      trend: null
    },
    {
      label: 'Retention Rate',
      value: `${metrics.retention}%`,
      sub: 'DAU ÷ MAU ratio',
      icon: TrendingUp,
      bg: metrics.retention >= 20 ? 'bg-emerald-50' : 'bg-rose-50',
      color: metrics.retention >= 20 ? 'text-emerald-600' : 'text-rose-600',
      trend: null
    }
  ] : [];

  return (
    <div className="bg-white p-9 rounded-[3rem] border border-white shadow-[0_25px_60px_-25px_rgba(0,0,0,0.1)] hover:shadow-[0_45px_90px_-30px_rgba(0,0,0,0.15)] transition-all duration-500">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Platform Growth</h3>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">
            User Acquisition & Engagement Metrics
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          disabled={loading}
          className="p-3 bg-slate-100 rounded-2xl border border-white/5 hover:bg-slate-100 hover:border-indigo-600/40 hover:text-indigo-600 transition-all shadow-sm group active:scale-95 disabled:opacity-50"
        >
          <RefreshCcw className={`w-4 h-4 text-slate-500 group-hover:text-indigo-600 transition-all ${loading ? 'animate-spin text-indigo-500' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <RefreshCcw className="w-8 h-8 text-indigo-500 animate-spin mb-3 opacity-50" />
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Loading Metrics...</p>
        </div>
      ) : (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {cards.map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex flex-col items-center justify-center text-center p-5 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:shadow-md transition-all duration-300 group"
              >
                <div className={`w-10 h-10 rounded-xl ${card.bg} ${card.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <card.icon className="w-5 h-5" />
                </div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-tight">{card.label}</p>
                <h4 className={`text-2xl font-black tabular-nums tracking-tight ${card.color}`}>
                  {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                </h4>
                <div className="mt-1 flex items-center gap-1">
                  {card.trend !== null && card.trend !== undefined && (
                    card.up
                      ? <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                      : <ArrowDownRight className="w-3 h-3 text-rose-500" />
                  )}
                  <p className="text-[8px] font-bold text-slate-400">{card.sub}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Signup Trend Chart */}
          {signupChartData.length > 1 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-black text-slate-700 uppercase tracking-widest">New User Signups — Daily Trend</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {metrics.newUsersInRange} total in period
                </p>
              </div>
              <div className="w-full h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={signupChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 800 }}
                      dy={8}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 800 }}
                      width={28}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)', padding: '10px' }}
                      formatter={(v) => [`${v} signups`, 'New Users']}
                    />
                    <Area
                      type="monotone"
                      dataKey="signups"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fill="url(#signupGrad)"
                      dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#6366f1' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Engagement Summary Bar */}
          <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2">Platform Reach</p>
              <p className="text-sm text-slate-700">
                <span className="font-black text-indigo-700">{metrics?.mau?.toLocaleString()}</span>
                <span className="text-slate-500 ml-1">out of</span>
                <span className="font-black text-slate-800 ml-1">{metrics?.totalUsers?.toLocaleString()}</span>
                <span className="text-slate-500 ml-1">users were active this period</span>
              </p>
            </div>
            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
              <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-2">Stickiness</p>
              <p className="text-sm text-slate-700">
                <span className="font-black text-emerald-700">{metrics?.retention}%</span>
                <span className="text-slate-500 ml-1">of monthly users return daily — </span>
                <span className="font-black text-slate-700">{metrics?.retention >= 20 ? 'Healthy' : metrics?.retention >= 10 ? 'Growing' : 'Needs attention'}</span>
              </p>
            </div>
            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
              <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2">New User Growth</p>
              <p className="text-sm text-slate-700">
                <span className={`font-black ${metrics?.newUserGrowth >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {metrics?.newUserGrowth >= 0 ? '+' : ''}{metrics?.newUserGrowth}%
                </span>
                <span className="text-slate-500 ml-1">vs previous period</span>
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
