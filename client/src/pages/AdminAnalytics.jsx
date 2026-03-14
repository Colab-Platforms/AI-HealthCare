import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Users, FileText, Activity, ArrowUpRight, ArrowDownRight, Filter, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function AdminAnalytics() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const { data } = await api.get('admin/stats');
                setStats(data.stats);
            } catch (err) {
                toast.error('Failed to load analytics data');
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE'];

    // Map real data for charts
    const growthData = stats ? (() => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0];
        }).reverse();

        return last7Days.map(date => {
            const dayName = days[new Date(date).getDay()];
            const reportCount = stats.reportGrowth?.find(g => g._id === date)?.count || 0;
            const userCount = stats.userGrowth?.find(g => g._id === date)?.count || 0;
            return { name: dayName, users: userCount, reports: reportCount };
        });
    })() : [];

    const reportCategories = stats?.distribution?.length > 0 
        ? stats.distribution 
        : [{ name: 'No Data', value: 1 }];

    if (loading) {
        return (
            <div className="min-h-full flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-purple-600 rounded-full animate-spin" />
            </div>
        );
    }

    const StatCard = ({ title, value, subtext, icon: Icon, trend, color }) => (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-white/80 backdrop-blur-xl rounded-[28px] border border-white/50 shadow-sm"
        >
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl ${color} shadow-sm`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {Math.abs(trend)}%
                    </div>
                )}
            </div>
            <h3 className="text-sm font-bold text-[#888] uppercase tracking-widest">{title}</h3>
            <p className="text-3xl font-black text-[#1a1a1a] mt-1">{value}</p>
            <p className="text-xs text-slate-400 mt-2 font-medium">{subtext}</p>
        </motion.div>
    );

    return (
        <div className="min-h-full p-4 md:p-8 space-y-8 max-w-[1200px] mx-auto">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-[#1a1a1a] tracking-tight">Platform Analytics</h1>
                    <p className="text-sm text-slate-500 font-medium">Real-time overview of platform's health and growth</p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-100 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-50 transition-all">
                        <Calendar className="w-4 h-4" />
                        Last 30 Days
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-slate-800 transition-all">
                        <Filter className="w-4 h-4" />
                        Apply Filter
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Total Users" 
                    value={stats?.totalUsers || 0} 
                    subtext="Growth in past month" 
                    icon={Users} 
                    trend={12.5} 
                    color="bg-indigo-500" 
                />
                <StatCard 
                    title="Reports Processed" 
                    value={stats?.totalReports || 0} 
                    subtext="AI analysis successful" 
                    icon={FileText} 
                    trend={8.2} 
                    color="bg-purple-500" 
                />
                <StatCard 
                    title="Completion Rate" 
                    value={`${((stats?.completedReports / stats?.totalReports) * 100 || 0).toFixed(1)}%`} 
                    subtext="Overall AI precision" 
                    icon={Activity} 
                    trend={2.4} 
                    color="bg-emerald-500" 
                />
                <StatCard 
                    title="Active Doctors" 
                    value="24" 
                    subtext="Verified professionals" 
                    icon={Activity} 
                    color="bg-amber-500" 
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Growth Chart */}
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-8 bg-white/80 backdrop-blur-xl rounded-[32px] border border-white shadow-sm"
                >
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-[#1a1a1a]">Growth Trends</h3>
                            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-1">Weekly Snapshot</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-purple-500" />
                                <span className="text-[10px] font-bold text-slate-500">Users</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-indigo-500" />
                                <span className="text-[10px] font-bold text-slate-500">Reports</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={growthData}>
                                <defs>
                                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorReports" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                                <Tooltip 
                                    contentStyle={{ 
                                        borderRadius: '16px', 
                                        border: 'none', 
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                        background: 'rgba(255, 255, 255, 0.9)',
                                        backdropBlur: '12px'
                                    }} 
                                />
                                <Area type="monotone" dataKey="users" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorUsers)" strokeWidth={3} />
                                <Area type="monotone" dataKey="reports" stroke="#6366f1" fillOpacity={1} fill="url(#colorReports)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Categories Chart */}
                <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-8 bg-white/80 backdrop-blur-xl rounded-[32px] border border-white shadow-sm"
                >
                    <div className="mb-8">
                        <h3 className="text-lg font-bold text-[#1a1a1a]">Report Distribution</h3>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-1">Classification by type</p>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="h-[250px] w-full md:w-1/2">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={reportCategories}
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {reportCategories.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        
                        <div className="w-full md:w-1/2 space-y-4">
                            {reportCategories.map((cat, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                        <span className="text-sm font-semibold text-slate-600">{cat.name}</span>
                                    </div>
                                    <span className="text-sm font-black text-[#1a1a1a]">{cat.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
