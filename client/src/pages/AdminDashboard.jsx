import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { 
  Users, FileText, Activity, ShieldCheck, 
  ArrowRight, Utensils, BarChart3, Clock, TrendingUp,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const { data } = await adminService.getStats();
      setStats(data);
    } catch (error) {
      toast.error('Failed to load stats');
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

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE'];

  const growthData = stats ? (() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => {
        const dayName = days[new Date(date).getDay()];
        const reportCount = stats?.stats?.reportGrowth?.find(g => g._id === date)?.count || 0;
        const userCount = stats?.stats?.userGrowth?.find(g => g._id === date)?.count || 0;
        return { name: dayName, users: userCount, reports: reportCount };
    });
  })() : [];

  const reportCategories = stats?.stats?.distribution?.length > 0 
    ? stats.stats.distribution 
    : [{ name: 'No Data', value: 1 }];

  const statCards = [
    { label: 'Total Users', value: stats?.stats?.totalUsers || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', trend: 12.5 },
    { label: 'Unique Users', value: stats?.stats?.uniqueUsers || 0, icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Repeat Users', value: stats?.stats?.repeatUsers || 0, icon: Clock, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Total Reports', value: stats?.stats?.totalReports || 0, icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: 8.2 },
    { label: 'Completion Rate', value: `${((stats?.stats?.completedReports / stats?.stats?.totalReports) * 100 || 0).toFixed(1)}%`, icon: Activity, color: 'text-orange-600', bg: 'bg-orange-50', trend: 2.4 },
    { label: 'IQ Cache', value: stats?.stats?.totalCachedFoods || 0, icon: Utensils, color: 'text-purple-600', bg: 'bg-purple-50' }
  ];

  return (
    <div className="p-6 md:p-8 space-y-8 w-full mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Admin Overview</h1>
        <p className="text-slate-500 text-sm">System performance and user engagement metrics</p>
      </div>

      {/* Stats Cards - Expanded for new metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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
              {stat.trend && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold">
                  <ArrowUpRight className="w-3 h-3" /> {stat.trend}%
                </div>
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5">{stat.label}</p>
              <p className="text-2xl font-black text-slate-800 tracking-tight">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Analytics Visualization Group */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Growth Velocity</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Real-time engagement trends</p>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Users</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Reports</span>
                    </div>
                </div>
            </div>
            
            <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={growthData}>
                        <defs>
                            <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorReports" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                        <Tooltip 
                            contentStyle={{ 
                                borderRadius: '16px', 
                                border: 'none', 
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
                                background: 'white',
                                fontSize: '12px'
                            }} 
                        />
                        <Area type="monotone" dataKey="users" stroke="#a855f7" fillOpacity={1} fill="url(#colorUsers)" strokeWidth={3} dot={{r: 4, fill: '#a855f7', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                        <Area type="monotone" dataKey="reports" stroke="#3b82f6" fillOpacity={1} fill="url(#colorReports)" strokeWidth={3} dot={{r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-800">Distribution</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Health Report Categories</p>
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
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-[10px] font-bold text-slate-500 uppercase">{cat.name}</span>
                        </div>
                        <span className="text-xs font-black text-slate-800">{cat.value}</span>
                    </div>
                ))}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden text-sm">
            <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-700 uppercase tracking-wider text-xs flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> System Hub
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-slate-50">
              {[
                { label: 'Manage Users', desc: 'Verify and update user roles', path: '/admin/users', icon: Users },
                { label: 'User Intelligence', desc: 'Monitor live activity logs', path: '/admin/activity', icon: Activity },
                { label: 'Food DB', desc: 'Manage Food Database', path: '/admin/food-cache', icon: Utensils },
                { label: 'Health Reports', desc: 'Review patient report analysis', path: '/admin/reports', icon: FileText }
              ].map((action, i) => (
                <button
                  key={i}
                  onClick={() => navigate(action.path)}
                  className="bg-white p-6 hover:bg-slate-50 transition-colors flex items-start gap-4 group"
                >
                  <div className="p-2.5 bg-slate-50 rounded-lg group-hover:bg-white transition-colors">
                    <action.icon className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{action.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{action.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 ml-auto self-center group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* System Health / Status */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <ShieldCheck className="w-6 h-6 text-blue-400" />
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-[10px] font-bold uppercase tracking-widest border border-blue-500/30">Secure</span>
              </div>
              <div>
                <h4 className="font-bold text-lg">Platform Status</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">All core intelligence modules are operating within normal parameters.</p>
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
                  { time: '2m ago', event: 'New user registration', type: 'user' },
                  { time: '15m ago', event: 'Food cache updated (Biryani)', type: 'cache' },
                  { time: '1h ago', event: 'System backup completed', type: 'system' }
                ].map((log, i) => (
                  <div key={i} className="flex gap-3 text-xs">
                    <span className="text-slate-400 font-medium whitespace-nowrap">{log.time}</span>
                    <span className="text-slate-600 font-bold">{log.event}</span>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
