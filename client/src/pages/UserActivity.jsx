import { useState, useEffect, useMemo } from 'react';
import { activityService } from '../services/api';
import ActivityDetailModal from '../components/ActivityDetailModal';
import {
  Activity, Search, Filter, Calendar,
  ChevronLeft, ChevronRight, RefreshCcw,
  Shield, Zap, Apple, Clock, Info,
  ArrowUpRight, ArrowDownRight, TrendingUp,
  LayoutGrid, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Label,
} from "recharts";

export default function UserActivity() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [limit, setLimit] = useState(5);
  // Use local date instead of UTC to avoid tomorrow/yesterday offsets
  const today = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');

  const [filters, setFilters] = useState({
    category: '',
    search: '',
    startDate: new Date(new Date().getTime() - (6 * 24 * 60 * 60 * 1000)).toLocaleDateString('en-CA'),
    endDate: new Date().toLocaleDateString('en-CA')
  });
  const [stats, setStats] = useState(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [statsLoading, setStatsLoading] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalFilterData, setModalFilterData] = useState(null);

  const [exporting, setExporting] = useState(false);

  const openModal = (title, filterData) => {
    setModalTitle(title);
    setModalFilterData(filterData);
    setModalOpen(true);
  };

  // Download all logs as CSV
  const handleDownloadCSV = async () => {
    setExporting(true);
    try {
      const params = {
        category: filters.category,
        search: debouncedSearch,
        startDate: filters.startDate,
        endDate: filters.endDate
      };

      const response = await activityService.exportLogs(params);
      
      // Create blob and download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `activity-logs-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Downloaded ${totalCount} records successfully!`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download logs');
    } finally {
      setExporting(false);
    }
  };

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    fetchDashboardData();
  }, [page, limit, filters.category, debouncedSearch, filters.startDate, filters.endDate]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setStatsLoading(true);
    try {
      const params = {
        page,
        limit,
        category: filters.category,
        search: debouncedSearch,
        startDate: filters.startDate,
        endDate: filters.endDate
      };

      // Concurrent fetch for maximum performance
      const [statsRes, logsRes] = await Promise.all([
        activityService.getStats(params),
        activityService.getLogs(params)
      ]);

      if (statsRes.data?.success) {
        setStats(statsRes.data.stats);
      }

      if (logsRes.data?.success) {
        setLogs(logsRes.data.logs || []);
        setTotalPages(logsRes.data.pages || 1);
        setTotalCount(logsRes.data.total || 0);
      }
    } catch (err) {
      toast.error('Service synchronization failed');
    } finally {
      setLoading(false);
      setStatsLoading(false);
    }
  };

  const categories = [
    { value: '', label: 'All', icon: LayoutGrid, color: '#0F172A' },
    { value: 'authentication', label: 'Security', icon: Shield, color: '#3B82F6' },
    { value: 'diagnostics', label: 'Diagnostics', icon: Zap, color: '#A855F7' },
    { value: 'nutrition', label: 'Nutrition', icon: Apple, color: '#10B981' },
    { value: 'medical', label: 'Medical', icon: Activity, color: '#F43F5E' },
    { value: 'fitness', label: 'Fitness', icon: Zap, color: '#F59E0B' },
    { value: 'system', label: 'System', icon: Info, color: '#64748B' }
  ];

  const chartData = useMemo(() => {
    if (!stats?.timelineStats) return [];
    return stats.timelineStats.map(d => ({
      name: new Date(d._id).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      total: d.total,
      diabetic: d.diabetic,
      male: d.male,
      female: d.female
    }));
  }, [stats]);

  const pieData = useMemo(() => {
    if (!stats?.categoryStats) return [];
    return stats.categoryStats.map(c => ({
      name: c._id.charAt(0).toUpperCase() + c._id.slice(1),
      value: c.count,
      color: categories.find(cat => cat.value === c._id)?.color || '#94a3b8'
    }));
  }, [stats]);

  const genderData = useMemo(() => {
    if (!stats?.genderStats) return [];
    const colors = { male: '#3B82F6', female: '#EC4899', other: '#8B5CF6' };
    const processed = stats.genderStats.map(g => {
      const id = (g._id || 'other').toLowerCase();
      return {
        name: id === 'male' ? 'Male' : id === 'female' ? 'Female' : 'Others',
        value: g.count,
        color: colors[id] || colors.other
      };
    });
    // Consolidate 'Others' if multiple 'Unknown' types exist
    const final = [];
    ['Male', 'Female', 'Others'].forEach(label => {
      const g = processed.find(p => p.name === label);
      if (g) final.push(g);
      else final.push({ name: label, value: 0, color: label === 'Male' ? '#3B82F6' : label === 'Female' ? '#EC4899' : '#8B5CF6' });
    });
    return final;
  }, [stats]);

  const diabeticData = useMemo(() => {
    if (!stats?.diabeticStats) return [];
    const colors = { yes: '#F43F5E', no: '#10B981' };
    return stats.diabeticStats.map(d => ({
      name: d._id === 'yes' ? 'Diabetic' : 'Non-Diabetic',
      value: d.count,
      color: colors[d._id] || '#cbd5e1'
    }));
  }, [stats]);

  const getCategoryIcon = (cat) => {
    const found = categories.find(c => c.value === cat);
    return found ? found.icon : Info;
  };

  return (
    <div className="min-h-full bg-[#d7dbd7] text-[#0F172A] font-sans pb-20 antialiased selection:bg-indigo-500/30">
      <ActivityDetailModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        filterData={modalFilterData}
        title={modalTitle}
      />
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-8 space-y-10">

        {/* Premium System Toolbar with Glassmorphism */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 p-8 bg-slate-100 backdrop-blur-3xl border border-white/10 rounded-[3rem] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] mb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 shadow-[0_8px_20px_-6px_rgba(79,70,229,0.5)] flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-800 leading-tight">Activity Intelligence</h2>
              <p className="text-slate-400 text-[10px] font-extrabold uppercase tracking-[0.2em]">Real-time Telemetry & Security Events</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
            {/* Refresh Action */}
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="p-3 bg-slate-100 rounded-2xl border border-white/5 hover:bg-slate-100 hover:border-indigo-600/40 hover:text-indigo-600 transition-all shadow-sm group active:scale-95 disabled:opacity-50"
              title="Refresh Dashboard"
            >
              <RefreshCcw className={`w-4 h-4 text-slate-500 group-hover:text-indigo-600 transition-all ${loading ? 'animate-spin text-indigo-500' : ''}`} />
            </button>

            {/* Module Filter */}
            <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md rounded-2xl border border-white/80 px-4 py-3 shadow-sm group hover:border-indigo-600/20 transition-all">
              <LayoutGrid className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
              <select
                value={filters.category}
                onChange={(e) => { setFilters({ ...filters, category: e.target.value }); setPage(1); }}
                className="text-[10px] font-black text-slate-600 focus:outline-none bg-transparent cursor-pointer uppercase tracking-wider border-none p-0"
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 lg:w-64 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              <input
                type="text"
                placeholder="Search logs..."
                className="w-full pl-11 pr-4 py-3 bg-slate-100 rounded-2xl text-[10px] border border-white/5 focus:ring-4 focus:ring-indigo-600/20 focus:border-indigo-600/40 transition-all font-bold shadow-sm placeholder:text-slate-500 text-white"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2 bg-slate-100 backdrop-blur-md rounded-2xl border border-white/5 px-4 py-3 shadow-sm group hover:border-indigo-600/40 transition-all">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => { setFilters({ ...filters, startDate: e.target.value }); setPage(1); }}
                className="text-[10px] font-black text-slate-800 focus:outline-none bg-transparent cursor-pointer uppercase tracking-wider inverse-calendar border-none outline-none p-0"
              />
              <span className="text-slate-600 mx-1">/</span>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => { setFilters({ ...filters, endDate: e.target.value }); setPage(1); }}
                className="text-[10px] font-black text-slate-800 focus:outline-none bg-transparent cursor-pointer uppercase tracking-wider inverse-calendar border-none outline-none p-0"
              />
            </div>

            {/* <button className="flex items-center gap-2 px-8 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-[0_10px_25px_-5px_rgba(15,23,42,0.4)] hover:bg-slate-800 hover:-translate-y-0.5 transition-all active:scale-95">
              <Download className="w-4 h-4" /> Export Report
            </button> */}
          </div>
        </div>

        {/* Global Critical Alert */}

        {/* Top Area: Stats & Performance Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-8 items-start">
          {/* Stats & Gender Grid (3/6) */}
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Total User Actions', value: stats?.totalLogs || 0, trend: `${stats?.trend >= 0 ? '+' : ''}${stats?.trend || 0}%`, up: (stats?.trend || 0) >= 0, icon: Zap, bg: 'bg-indigo-50', color: 'text-indigo-600' },
              { label: 'Login/Logout Events', value: stats?.categoryStats?.find(c => c._id === 'authentication')?.count || 0, trend: '+0.0%', up: true, icon: Shield, bg: 'bg-blue-50', color: 'text-blue-500' },
              { label: 'Health Reports Processed', value: stats?.categoryStats?.find(c => c._id === 'diagnostics')?.count || 0, trend: '-0.3%', up: false, icon: Activity, bg: 'bg-rose-50', color: 'text-rose-500' },
              { label: 'Live Active Users', value: stats?.liveActiveUsersCount || 0, trend: 'REAL-TIME', up: true, icon: TrendingUp, bg: 'bg-emerald-50', color: 'text-emerald-500' }
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5 }}
                className="bg-white p-7 rounded-[2.5rem] border border-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.08)] group transition-all duration-500 flex flex-col justify-between cursor-default hover:shadow-[0_30px_60px_-20px_rgba(79,70,229,0.2)]"
              >
                <div className="flex flex-col items-center justify-center text-center">
                  <div className={`w-16 h-16 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-sm mb-4`}>
                    <stat.icon className="w-8 h-8" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{stat.label}</p>
                  <h4 className="text-4xl font-black text-slate-900 leading-none tabular-nums tracking-tighter">{stat.value.toLocaleString()}</h4>
                </div>
                <div className="flex items-center justify-between pt-5 border-t border-slate-50">
                  <div className={`flex items-center gap-1.5 text-[11px] font-black ${stat.up ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {stat.up ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {stat.trend} <span className="text-slate-300 font-bold ml-1 uppercase">WEEKLY</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                </div>
              </motion.div>
            ))}

            {/* Integrated Gender Card - Matches Stat Card Size */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              whileHover={{ y: -5 }}
              className="bg-white p-7 rounded-[2.5rem] border border-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.08)] group transition-all duration-500 flex flex-col justify-between cursor-default hover:shadow-[0_30px_60px_-20px_rgba(79,70,229,0.2)]"
            >
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none mb-1">Gender</h3>
                <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-6">User Mix</p>

                <div className="space-y-4">
                  {genderData.map((d, i) => (
                    <div 
                      key={i} 
                      className="flex flex-col gap-1.5 cursor-default hover:opacity-80 transition-opacity"
                    >
                      <div className="flex items-center justify-between px-0.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{d.name}</span>
                        <span className="text-[10px] font-black text-slate-900 tabular-nums">{d.value}</span>
                      </div>
                      <div className="h-1 w-full bg-slate-50 rounded-full overflow-hidden shadow-inner">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: stats?.totalLogs > 0 ? `${(d.value / Math.max(1, genderData.reduce((acc, curr) => acc + curr.value, 0))) * 100}%` : '0%' }}
                          className="h-full rounded-full shadow-sm"
                          style={{ backgroundColor: d.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-50">
                <p className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.1em] leading-relaxed italic">Click to view details</p>
              </div>
            </motion.div>
          </div>

          {/* Performance Chart (3/6) */}
          <div className="lg:col-span-3 bg-white p-8 rounded-[3rem] border border-white shadow-[0_25px_60px_-25px_rgba(0,0,0,0.1)] relative flex flex-col min-h-[450px] group transition-all duration-500 hover:shadow-[0_45px_90px_-30px_rgba(0,0,0,0.15)]">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Interaction Metrics</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">Live Activity Feed Velocity</p>
              </div>
            </div>

            <div className="w-full relative h-[380px]">
              {statsLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/5 backdrop-blur-sm rounded-[2rem]">
                  <RefreshCcw className="w-8 h-8 text-indigo-500 animate-spin mb-3 opacity-50" />
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Aggregating Metrics...</p>
                </div>
              ) : chartData && chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }}
                      width={35}
                      domain={[0, 'auto']}
                    />
                    <Tooltip
                      cursor={{ fill: '#f8fafc', radius: 10 }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', padding: '12px' }}
                    />
                    <Bar 
                    dataKey="total" 
                    fill="#4f46e5" 
                    radius={[4, 4, 0, 0]} 
                    barSize={10}
                    // onClick={(data) => {
                    //   const dateStr = new Date(data.name).toISOString().split('T')[0];
                    //   openModal(`Activity on ${data.name}`, { startDate: dateStr, endDate: dateStr });
                    // }}
                    style={{ cursor: 'pointer' }}
                  />
                    <Bar 
                      dataKey="diabetic" 
                      fill="#f43f5e" 
                      radius={[4, 4, 0, 0]} 
                      barSize={10}
                      // onClick={(data) => {
                      //   const dateStr = new Date(data.name).toISOString().split('T')[0];
                      //   openModal(`Diabetic Activity on ${data.name}`, { startDate: dateStr, endDate: dateStr });
                      // }}
                      style={{ cursor: 'pointer' }}
                    />
                    <Bar 
                      dataKey="male" 
                      fill="#3b82f6" 
                      radius={[4, 4, 0, 0]} 
                      barSize={10}
                      // onClick={(data) => {
                      //   const dateStr = new Date(data.name).toISOString().split('T')[0];
                      //   openModal(`Male Users Activity on ${data.name}`, { startDate: dateStr, endDate: dateStr, search: 'male' });
                      // }}
                      style={{ cursor: 'pointer' }}
                    />
                    <Bar 
                      dataKey="female" 
                      fill="#ec4899" 
                      radius={[4, 4, 0, 0]} 
                      barSize={10}
                      // onClick={(data) => {
                      //   const dateStr = new Date(data.name).toISOString().split('T')[0];
                      //   openModal(`Female Users Activity on ${data.name}`, { startDate: dateStr, endDate: dateStr, search: 'female' });
                      // }}
                      style={{ cursor: 'pointer' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/5 rounded-[2rem] border-2 border-dashed border-white/5">
                  <Clock className="w-10 h-10 text-slate-800 mb-3" />
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No Intelligence Data Recorded</p>
                  <p className="text-[9px] text-slate-500 mt-1">Adjust filters or timeline to view sequence</p>
                </div>
              )}

              {loading && (
                <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] flex items-center justify-center rounded-[2rem] z-10">
                  <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-lg border border-slate-100">
                    <RefreshCcw className="w-3 h-3 text-indigo-600 animate-spin" />
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-wider">Syncing...</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-6 justify-center mt-8 border-t border-slate-50 pt-6">
              {[
                { label: 'Total', color: 'bg-indigo-600' },
                { label: 'Diabetic', color: 'bg-rose-500' },
                { label: 'Male', color: 'bg-blue-500' },
                { label: 'Female', color: 'bg-pink-500' }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Peak Visit Hours Analytics */}
        <div className="bg-white p-9 rounded-[3rem] border border-white shadow-[0_25px_60px_-25px_rgba(0,0,0,0.1)] hover:shadow-[0_45px_90px_-30px_rgba(0,0,0,0.15)] transition-all duration-500">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">Peak Visit Hours</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">When Users Typically Visit</p>
            </div>
            <div className="flex items-center gap-4">
              {stats?.hourlyStats && stats.hourlyStats.length > 0 && (
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peak Hour</p>
                    <p className="text-2xl font-black text-indigo-600 tabular-nums">
                      {stats.hourlyStats.reduce((max, h) => h.count > max.count ? h : max, stats.hourlyStats[0])?.hour || '--'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peak Visits</p>
                    <p className="text-2xl font-black text-emerald-600 tabular-nums">
                      {Math.max(...(stats.hourlyStats?.map(h => h.count) || [0]))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg/Hour</p>
                    <p className="text-2xl font-black text-blue-600 tabular-nums">
                      {Math.round((stats.hourlyStats?.reduce((sum, h) => sum + h.count, 0) || 0) / 24)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="w-full relative h-[320px]">
            {statsLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/5 backdrop-blur-sm rounded-[2rem]">
                <RefreshCcw className="w-8 h-8 text-indigo-500 animate-spin mb-3 opacity-50" />
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Aggregating Hourly Data...</p>
              </div>
            ) : stats?.hourlyStats && stats.hourlyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.hourlyStats} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="hour"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 800 }}
                    dy={10}
                    interval={2}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }}
                    width={35}
                    domain={[0, 'auto']}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc', radius: 10 }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', padding: '12px' }}
                    formatter={(value) => [`${value} visits`, 'Count']}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="#6366f1" 
                    radius={[4, 4, 0, 0]} 
                    barSize={12}
                    style={{ cursor: 'pointer' }}
                    onClick={(state) => {
                      // state contains the clicked bar data
                      console.log('🎯 Bar clicked - state:', state);
                      if (stats?.hourlyStats && state.activeTooltipIndex !== undefined) {
                        const clickedData = stats.hourlyStats[state.activeTooltipIndex];
                        console.log('🎯 Clicked data:', clickedData);
                        // TODO: Uncomment modal later
                        // if (clickedData) {
                        //   openModal(`Activity at ${clickedData.hour}`, { 
                        //     hour: clickedData.hourNum.toString(), 
                        //     startDate: filters.startDate, 
                        //     endDate: filters.endDate 
                        //   });
                        // }
                      }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/5 rounded-[2rem] border-2 border-dashed border-white/5">
                <Clock className="w-10 h-10 text-slate-800 mb-3" />
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No Hourly Data Available</p>
                <p className="text-[9px] text-slate-500 mt-1">Adjust filters or timeline to view peak hours</p>
              </div>
            )}

            {loading && (
              <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] flex items-center justify-center rounded-[2rem] z-10">
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-lg border border-slate-100">
                  <RefreshCcw className="w-3 h-3 text-indigo-600 animate-spin" />
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-wider">Syncing...</span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 pt-8 border-t border-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div 
                className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 hover:bg-indigo-50 transition-colors"
              >
                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2">Peak Activity</p>
                <p className="text-sm text-slate-600">Most users visit during <span className="font-black text-indigo-600">{stats?.hourlyStats && stats.hourlyStats.length > 0 ? stats.hourlyStats.reduce((max, h) => h.count > max.count ? h : max, stats.hourlyStats[0])?.hour : '--'}</span></p>
              </div>
              <div 
                className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50 hover:bg-emerald-50 transition-colors"
              >
                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-2">Daily Pattern</p>
                <p className="text-sm text-slate-600">Average <span className="font-black text-emerald-600">{Math.round((stats?.hourlyStats?.reduce((sum, h) => sum + h.count, 0) || 0) / 24)}</span> visits per hour</p>
              </div>
              <div 
                className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 hover:bg-blue-50 transition-colors"
              >
                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2">Total Hourly</p>
                <p className="text-sm text-slate-600">Total <span className="font-black text-blue-600">{stats?.hourlyStats?.reduce((sum, h) => sum + h.count, 0) || 0}</span> visits tracked</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Clinical Intelligence Card */}
          <div className="bg-white p-9 rounded-[3rem] border border-white shadow-[0_25px_60px_-25px_rgba(0,0,0,0.1)] flex flex-col justify-between hover:shadow-[0_40px_80px_-30px_rgba(0,10,0,0.08)] transition-all duration-500">
            <div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-1">Clinical Intelligence</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-10">Medical Condition Distribution</p>

              <div className="flex flex-col items-center gap-10">
                {/* Increased Chart Size & Vertical Layout */}
                <div className="w-56 h-56 flex-shrink-0 flex items-center justify-center bg-slate-50 rounded-full border border-slate-100 overflow-hidden relative shadow-inner cursor-default hover:shadow-lg transition-shadow"
                >
                  {diabeticData.length > 0 ? (
                    <PieChart width={220} height={220}>
                      <Pie
                        data={diabeticData}
                        innerRadius={65}
                        outerRadius={90}
                        paddingAngle={8}
                        dataKey="value"
                        stroke="none"
                      >
                        {diabeticData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} cornerRadius={10} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  ) : (
                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center px-4">No Data</div>
                  )}
                </div>

                <div className="w-full space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-4">Diabetes Demographics</h4>
                  {diabeticData.map((d, i) => (
                    <div 
                      key={i} 
                      className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-colors cursor-default"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: d.color }} />
                        <span className="text-xs font-bold text-slate-600">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(d.value / (stats?.totalLogs || 1)) * 100}%`, backgroundColor: d.color }} />
                        </div>
                        <span className="text-sm font-black text-slate-900 tabular-nums">{d.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-50">
              <div className="flex items-center justify-between bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100/50 hover:bg-indigo-50 transition-colors cursor-default">
                <div>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Live Active Users</p>
                  <p className="text-3xl font-black text-indigo-600 tabular-nums">{stats?.liveActiveUsersCount || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200 animate-pulse">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col h-full">
            <div className="bg-white rounded-[3rem] border border-white shadow-[0_25px_60px_-25px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col h-full hover:shadow-[0_45px_90px_-30px_rgba(0,0,0,0.15)] transition-all duration-700">
              {/* Intelligent List Header */}
              <div className="p-9 border-b border-slate-50 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">Interaction Feed</h3>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">Encrypted Telemetry Sequence</p>
                </div>
                <button
                  onClick={handleDownloadCSV}
                  disabled={exporting || totalCount === 0}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={`Download all ${totalCount} records as CSV`}
                >
                  <Download className={`w-4 h-4 ${exporting ? 'animate-spin' : ''}`} />
                  {exporting ? 'Exporting...' : `Export (${totalCount})`}
                </button>
              </div>

              {/* Data Table */}
              <div className="flex-1 overflow-x-auto scrollbar-hide">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/30">
                      <th className="px-9 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Profile</th>
                      <th className="px-9 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Module</th>
                      <th className="px-9 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Activity</th>
                      <th className="px-9 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50/60">
                    {loading ? (
                      <tr><td colSpan="4" className="py-32 text-center">
                        <div className="w-12 h-12 border-[4px] border-slate-100 border-t-indigo-600 rounded-full animate-spin mx-auto shadow-sm" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4 animate-pulse">Decrypting Feed...</p>
                      </td></tr>
                    ) : logs.length === 0 ? (
                      <tr><td colSpan="4" className="py-32 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100 shadow-inner">
                          <Activity className="w-10 h-10 text-slate-200" />
                        </div>
                        <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">No Intelligence Found</p>
                        <p className="text-[10px] text-slate-300 font-bold mt-2 uppercase tracking-widest">Adjust filters or check system connection</p>
                      </td></tr>
                    ) : (
                      logs.map((log, i) => {
                        const catColor = categories.find(c => c.value === log.category)?.color || '#94a3b8';
                        return (
                          <motion.tr
                            key={log._id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.03 }}
                            className="hover:bg-slate-50/40 transition-colors group"
                          >
                            <td className="px-9 py-5">
                              <div className="flex items-center gap-4">
                                <div
                                  className="w-11 h-11 rounded-2xl flex items-center justify-center text-xs font-black text-white shadow-lg shadow-slate-100 overflow-hidden ring-4 ring-white transition-transform group-hover:scale-110"
                                  style={{ backgroundColor: catColor }}
                                >
                                  {log.user?.profile?.avatar ? (
                                    <img src={log.user.profile.avatar} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="uppercase">{log.user?.name?.[0] || 'G'}</span>
                                  )}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors truncate max-w-[120px]">{log.user?.name || 'Guest User'}</span>
                                  <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider truncate max-w-[120px]">{log.user?.email || 'System Account'}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-9 py-5">
                              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catColor }} />
                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{log.category}</span>
                              </div>
                            </td>
                            <td className="px-9 py-5">
                              <div className="flex flex-col">
                                <span className="text-[11px] font-black text-slate-600 truncate max-w-[150px]">{log.action.replace(/_/g, ' ')}</span>
                                <span className="text-[9px] text-slate-300 font-extrabold uppercase italic mt-0.5">{log.metadata?.ip || 'SECURE.API'}</span>
                              </div>
                            </td>
                            <td className="px-9 py-5 text-right">
                              <div className="flex flex-col items-end">
                                <span className="text-sm font-black text-slate-900 tabular-nums">
                                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                </span>
                                <span className="text-[10px] font-black text-slate-400 tracking-tighter uppercase">
                                  {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: '2-digit' })}
                                </span>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Ultra Pagination */}
              <div className="p-9 bg-slate-50/30 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{totalCount.toLocaleString()} TOTAL EVENTS</span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 disabled:opacity-30 hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-95"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="px-6 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{page} <span className="text-slate-300 mx-1">OF</span> {totalPages}</span>
                  </div>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 disabled:opacity-30 hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-95"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
