import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { 
  Users, FileText, Activity, ShieldCheck, 
  ArrowRight, Utensils, BarChart3, Clock, TrendingUp
} from 'lucide-react';
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

  const statCards = [
    { label: 'Total Users', value: stats.stats?.totalUsers || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total Reports', value: stats.stats?.totalReports || 0, icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Active Users', value: stats.stats?.activeUsers || 0, icon: Activity, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'IQ Cache', value: '4.2k', icon: Utensils, color: 'text-purple-600', bg: 'bg-purple-50' }
  ];

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Admin Overview</h1>
        <p className="text-slate-500 text-sm">System performance and user engagement metrics</p>
      </div>

      {/* Stats Cards - Simplified */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-xl ${stat.bg}`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">{stat.label}</p>
              <p className="text-xl font-bold text-slate-800">{stat.value}</p>
            </div>
          </div>
        ))}
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
                { label: 'Food DB', desc: 'Manage Food Database', path: '/admin/food-cache', icon: Utensils },
                { label: 'Health Reports', desc: 'Review patient report analysis', path: '/admin/reports', icon: FileText },
                { label: 'Global Analytics', desc: 'Detailed system statistics', path: '/admin/analytics', icon: TrendingUp }
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
