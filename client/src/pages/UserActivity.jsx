import { useState, useEffect } from 'react';
import { activityService } from '../services/api';
import { 
  Activity, Search, Filter, Calendar, User, 
  ChevronLeft, ChevronRight, RefreshCcw, 
  Shield, Zap, Apple, Clock, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function UserActivity() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [limit, setLimit] = useState(20);
  const [filters, setFilters] = useState({
    category: '',
    search: ''
  });
  const [stats, setStats] = useState(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setPage(1); // Reset to page 1 on new search
    }, 500);
    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    fetchLogs();
  }, [page, limit, filters.category, debouncedSearch]);

  useEffect(() => {
    fetchStats();
  }, []); // Only fetch stats once or on refresh

  const fetchStats = async () => {
    try {
      const { data } = await activityService.getStats();
      setStats(data.stats);
    } catch (err) {
      console.error('Failed to fetch stats');
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        category: filters.category,
        search: debouncedSearch
      };
      const { data } = await activityService.getLogs(params);
      setLogs(data.data || []);
      setTotalPages(data.pages || 1);
      setTotalCount(data.total || 0);
    } catch (err) {
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { value: '', label: 'All Events' },
    { value: 'authentication', label: 'Security', icon: Shield, color: 'text-blue-500', bg: 'bg-blue-50' },
    { value: 'diagnostics', label: 'Diagnostics', icon: Zap, color: 'text-purple-500', bg: 'bg-purple-50' },
    { value: 'nutrition', label: 'Nutrition', icon: Apple, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { value: 'medical', label: 'Medical', icon: Activity, color: 'text-rose-500', bg: 'bg-rose-50' },
    { value: 'fitness', label: 'Fitness', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50' },
    { value: 'system', label: 'System', icon: Info, color: 'text-slate-500', bg: 'bg-slate-50' }
  ];

  const getCategoryIcon = (cat) => {
    const found = categories.find(c => c.value === cat);
    return found ? found.icon : Info;
  };

  const getCategoryColor = (cat) => {
    const found = categories.find(c => c.value === cat);
    return found ? found.color : 'text-slate-500';
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="w-full px-4 md:px-8 py-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-200">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">System Intelligence</h1>
                <p className="text-slate-500 font-medium tracking-tight">Monitoring {totalCount?.toLocaleString()} live user interactions</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search user or behavior..."
                className="pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all w-72 shadow-sm font-medium"
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
              />
            </div>
            <button 
              onClick={() => { fetchLogs(); fetchStats(); }}
              className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all hover:shadow-md active:scale-95"
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Refresh Data</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center"><Zap className="w-6 h-6 text-blue-500" /></div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Events</p>
                <h3 className="text-2xl font-black text-slate-900">{stats?.totalLogs?.toLocaleString() || '...'}</h3>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center"><Shield className="w-6 h-6 text-emerald-500" /></div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Auth Events</p>
                <h3 className="text-2xl font-black text-slate-900">{stats?.categoryStats?.find(c => c._id === 'authentication')?.count || 0}</h3>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center"><Activity className="w-6 h-6 text-purple-500" /></div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Diagnostics</p>
                <h3 className="text-2xl font-black text-slate-900">{stats?.categoryStats?.find(c => c._id === 'diagnostics')?.count || 0}</h3>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center"><Clock className="w-6 h-6 text-amber-500" /></div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Status</p>
                <h3 className="text-2xl font-black text-emerald-600">Syncing</h3>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
          {/* Tabs/Filters Bar */}
          <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex flex-wrap items-center gap-3">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => { setFilters({...filters, category: cat.value}); setPage(1); }}
                className={`px-6 py-2.5 rounded-2xl text-xs font-bold transition-all border flex items-center gap-2.5 ${
                  filters.category === cat.value 
                    ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-200' 
                    : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'
                }`}
              >
                {cat.icon && <cat.icon className="w-3.5 h-3.5" />}
                {cat.label}
              </button>
            ))}
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">User Identity</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Interaction</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Domain</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Metadata</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <AnimatePresence mode="popLayout">
                  {logs.map((log, idx) => {
                    const Icon = getCategoryIcon(log.category);
                    const color = getCategoryColor(log.category);
                    return (
                      <motion.tr 
                        key={log._id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-xs font-black text-white shadow-sm overflow-hidden">
                              {log.user?.profile?.avatar ? (
                                  <img src={log.user.profile.avatar} alt="" className="w-full h-full object-cover" />
                              ) : log.user?.name?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900">{log.user?.name || 'Guest User'}</p>
                              <p className="text-[11px] text-slate-400 font-bold">{log.user?.email || 'api-access'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className="px-3 py-1 rounded-lg bg-slate-100 text-[10px] font-black text-slate-600 uppercase tracking-wider italic">
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <div className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-widest ${color}`}>
                              <Icon className="w-3.5 h-3.5" />
                              {log.category}
                          </div>
                        </td>
                        <td className="px-8 py-5 max-w-xs">
                          <p className="text-[11px] text-slate-500 font-medium italic truncate">
                            {Object.entries(log.metadata || {}).map(([k, v]) => `${k}: ${v}`).join(' ‣ ') || 'No extra telemetry'}
                          </p>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-black text-slate-900 tabular-nums">
                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                            </span>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' })}
                            </span>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Footer/Pagination */}
          <div className="p-8 bg-slate-50/30 border-t border-slate-50 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Displaying <span className="text-slate-900">{logs.length}</span> of <span className="text-slate-900">{totalCount.toLocaleString()}</span> live events
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rows:</p>
                <select 
                  value={limit}
                  onChange={(e) => { setLimit(parseInt(e.target.value)); setPage(1); }}
                  className="bg-white border border-slate-200 rounded-xl px-2 py-1 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all outline-none"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="p-3 rounded-2xl border border-slate-200 bg-white text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all active:scale-90"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-1">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  let pageNum;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (page <= 3) pageNum = i + 1;
                  else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = page - 2 + i;

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-11 h-11 rounded-2xl border text-xs font-black transition-all ${
                        page === pageNum 
                          ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-200' 
                          : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                {totalPages > 5 && page < totalPages - 2 && (
                  <span className="px-2 text-slate-400 font-black">...</span>
                )}
              </div>

              <button 
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="p-3 rounded-2xl border border-slate-200 bg-white text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all active:scale-90"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
