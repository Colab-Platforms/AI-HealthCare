import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { healthService } from '../services/api';
import { FileText, ArrowLeft, Calendar, Eye, TrendingUp, AlertCircle, Upload, Trash2, Bell, Zap, Activity, Filter, ChevronRight, Search, Clock, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import ReportsSkeleton from '../components/skeletons/ReportsSkeleton';

export default function AllReports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchAllReports();
  }, []);

  const fetchAllReports = async () => {
    try {
      const { data } = await healthService.getReports();
      setReports(data || []);
    } catch (error) {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReport = async (reportId, e) => {
    e.preventDefault(); e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this report?')) return;
    try {
      await healthService.deleteReport(reportId);
      setReports(reports.filter(r => r._id !== reportId));
      toast.success('Report deleted');
    } catch (error) {
      toast.error('Failed to delete report');
    }
  };

  const filteredReports = reports.filter(r => {
    const matchesFilter = filter === 'all' || r.reportType.toLowerCase().includes(filter.toLowerCase());
    const matchesSearch = searchQuery === '' || r.reportType.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const reportTypes = ['all', ...new Set(reports.map(r => r.reportType))];

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#F2F5EC]">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-white border-t-[#69A38D] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#69A38D] font-black uppercase tracking-widest text-[10px]">Loading Archives...</p>
      </div>
    </div>
  );

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-[#F2F5EC] to-[#E5EBE0] dark:from-[#161719] dark:to-[#161719] pb-32 relative overflow-x-hidden animate-in fade-in duration-500">
      <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-br from-white/40 dark:from-white/5 to-transparent pointer-events-none" />
      
      {/* Header Area */}
      <div className="px-6 pt-12 flex flex-col gap-8 max-w-5xl mx-auto relative z-10">
        
        {/* Navigation & Title */}
        <div className="flex flex-col gap-6">
           <button 
             onClick={() => navigate('/dashboard')}
             className="w-12 h-12 bg-white shadow-sm border border-white rounded-full flex items-center justify-center text-[#1a2138] hover:scale-105 transition-all"
           >
              <ArrowLeft size={22} strokeWidth={2.5} />
           </button>
           <div className="flex flex-col gap-1">
              <h1 className="text-[32px] font-black text-[#1a2138] dark:text-white tracking-tight leading-none uppercase">Clinical Records</h1>
              <p className="text-[14px] text-[#64748b] font-bold">Comprehensive archive of your diagnostic journey</p>
           </div>
        </div>

        {/* Action Header Card */}
        <div className="bg-white/60 backdrop-blur-xl rounded-[40px] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-white flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#69A38D]/5 rounded-full blur-3xl -mr-32 -mt-32 transition-transform group-hover:scale-110"></div>
          
          <div className="flex flex-col gap-6 relative z-10">
             <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-[24px] bg-[#69A38D]/10 flex items-center justify-center border border-[#69A38D]/20 shadow-inner">
                   <Activity size={32} className="text-[#69A38D]" />
                </div>
                <div className="flex flex-col">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{reports.length} Records Uploaded</span>
                   <span className="text-[20px] font-black text-[#1a2138] tracking-tight uppercase">Health Synthesis Active</span>
                </div>
             </div>
             
             <div className="flex bg-white/40 rounded-[24px] p-1.5 border border-white shadow-sm max-w-md">
                <div className="flex items-center gap-3 px-4 w-full">
                   <Search size={16} className="text-slate-400" />
                   <input 
                     type="text" 
                     placeholder="SEARCH DIAGNOSTICS..." 
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     className="bg-transparent border-none outline-none text-[#1a2138] font-black text-xs placeholder:text-slate-300 w-full uppercase"
                   />
                </div>
             </div>
          </div>

          <Link
            to="/upload"
            className="px-10 py-5 bg-[#69A38D] text-white rounded-[28px] font-black hover:bg-[#528270] transition-all flex items-center justify-center gap-4 text-sm uppercase tracking-widest shadow-lg shadow-[#69A38D]/20 active:scale-95 group relative z-10 shrink-0"
          >
            <Upload size={20} strokeWidth={3} className="group-hover:-translate-y-1 transition-transform" />
            Upload Report
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           {[
             { label: 'Total Files', value: reports.length, icon: FileText, color: 'text-[#69A38D]', bg: 'bg-[#69A38D]/10' },
             { label: 'Analyzed', value: reports.filter(r => r.status === 'completed').length, icon: Sparkles, color: 'text-amber-500', bg: 'bg-amber-50' },
             { label: 'Categories', value: reportTypes.length - 1, icon: Filter, color: 'text-indigo-500', bg: 'bg-indigo-50' },
             { label: 'Latest Checkup', value: reports.length > 0 ? new Date(reports[0].createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A', icon: Clock, color: 'text-rose-500', bg: 'bg-rose-50' }
           ].map((stat, i) => (
             <div key={i} className="bg-white/60 rounded-[32px] p-5 border border-white shadow-sm flex flex-col gap-3 group hover:bg-white/80 transition-all">
                <div className={`w-10 h-10 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform`}><stat.icon size={20} strokeWidth={2.5} /></div>
                <div className="flex flex-col">
                   <span className="text-[20px] font-black text-[#1a2138] tracking-tight">{stat.value}</span>
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                </div>
             </div>
           ))}
        </div>

        {/* Filter Navigation */}
        <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar -mx-6 px-6 lg:mx-0 lg:px-0 scroll-smooth">
          {reportTypes.map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-6 py-3 rounded-full font-black whitespace-nowrap transition-all text-[11px] uppercase tracking-widest flex items-center gap-2.5 border-2 ${filter === type
                ? 'bg-[#1a2138] border-[#1a2138] text-white shadow-lg'
                : 'bg-white/60 text-slate-400 border-white hover:border-[#69A38D] hover:text-[#69A38D]'
                }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${filter === type ? 'bg-[#69A38D]' : 'bg-slate-200'}`}></div>
              {type === 'all' ? 'Universal Registry' : type}
            </button>
          ))}
        </div>

        {/* Reports List */}
        <div className="flex flex-col gap-4">
           {filteredReports.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredReports.map((report) => (
                   <div key={report._id} className="bg-white/60 backdrop-blur-xl rounded-[40px] p-6 shadow-sm border border-white group relative hover:shadow-xl transition-all duration-500 overflow-hidden min-h-[220px] flex flex-col justify-between">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#69A38D]/5 rounded-full blur-2xl -mr-16 -mt-16"></div>
                      
                      {/* Top Row */}
                      <div className="flex items-start justify-between relative z-10">
                         <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-[20px] bg-[#E2EED2] flex items-center justify-center shadow-inner group-hover:rotate-6 transition-transform">
                               <FileText size={28} className="text-[#69A38D]" />
                            </div>
                            <div className="flex flex-col">
                               <span className="text-[10px] font-black text-[#69A38D] uppercase tracking-widest">{report.status === 'completed' ? 'SYNTHESIZED' : 'PROCESSING'}</span>
                               <h3 className="text-[18px] font-black text-[#1a2138] leading-tight uppercase tracking-tight line-clamp-1">{report.reportType}</h3>
                               <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">
                                 <Calendar size={12} className="text-[#69A38D]" />
                                 {new Date(report.reportDate || report.createdAt).toLocaleDateString()}
                               </div>
                            </div>
                         </div>
                         <button 
                           onClick={(e) => handleDeleteReport(report._id, e)}
                           className="w-9 h-9 rounded-xl bg-rose-50 text-rose-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500 hover:text-white flex items-center justify-center shadow-sm"
                         >
                            <Trash2 size={16} />
                         </button>
                      </div>

                      {/* Analysis Preview */}
                      {report.aiAnalysis?.healthScore && (
                        <div className="bg-white/80 rounded-[28px] p-4 flex items-center justify-between border border-[#69A38D]/10 mt-6 relative z-10">
                           <div className="flex flex-col">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Impact Score</span>
                              <div className="flex items-baseline gap-1.5">
                                 <span className="text-3xl font-black text-[#1a2138] tracking-tighter">{report.aiAnalysis.healthScore}</span>
                                 <span className="text-slate-300 font-bold text-xs uppercase">Optimization</span>
                              </div>
                           </div>
                           <div className="flex -space-x-2">
                              {[1,2,3].map(i => (
                                <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-black text-[#69A38D] shadow-sm uppercase">{i}</div>
                              ))}
                           </div>
                        </div>
                      )}

                      {/* Details Link */}
                      <Link
                        to={`/reports/${report._id}`}
                        className="w-full py-4 mt-6 bg-white border border-[#69A38D]/20 text-[#1a2138] rounded-[24px] font-black text-xs uppercase tracking-[0.2em] hover:bg-[#69A38D] hover:text-white transition-all flex items-center justify-center gap-3 relative z-10 active:scale-[0.98] shadow-sm"
                      >
                         <Zap size={16} fill="currentColor" /> Exploration
                      </Link>
                   </div>
                ))}
             </div>
           ) : (
             <div className="bg-white/60 backdrop-blur-xl rounded-[40px] p-20 border border-white flex flex-col items-center justify-center text-center gap-8 shadow-sm">
                <div className="w-24 h-24 rounded-[32px] bg-slate-50 flex items-center justify-center shadow-inner relative overflow-hidden group">
                   <div className="absolute inset-0 bg-[#69A38D]/5 blur group-hover:scale-150 transition-transform duration-700"></div>
                   <FileText size={48} className="text-slate-200 relative z-10" />
                </div>
                <div className="flex flex-col gap-2 max-w-sm">
                   <h3 className="text-[24px] font-black text-[#1a2138] uppercase tracking-tight leading-none">Registry Empty</h3>
                   <p className="text-[14px] text-slate-400 font-bold">Start your digital diagnostic journey by uploading your first clinical lab report.</p>
                </div>
                <Link
                  to="/upload"
                  className="px-10 py-5 bg-[#1a2138] text-white rounded-[28px] font-black hover:bg-black transition-all flex items-center justify-center gap-4 text-xs uppercase tracking-widest shadow-xl active:scale-95 shadow-black/10"
                >
                   <Upload size={18} strokeWidth={3} /> Standard Initiation
                </Link>
             </div>
           )}
        </div>

        {/* Footer Disclaimer */}
        <div className="text-center pt-8 pb-12 max-w-lg mx-auto">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
             Diagnostic archive is encrypted and HIPAA compliant. Processing engine utilizes clinical bio-marker synthesis for optimization insights.
           </p>
        </div>
      </div>
    </div>
  );
}
