import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { healthService } from '../services/api';
import { FileText, ArrowLeft, Calendar, Eye, TrendingUp, AlertCircle, Upload, Trash2, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import ReportsSkeleton from '../components/skeletons/ReportsSkeleton';

export default function AllReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, blood, comprehensive, etc.

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
    fetchAllReports();
  }, []);

  const fetchAllReports = async () => {
    try {
      const { data } = await healthService.getReports();
      setReports(data);
    } catch (error) {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReport = async (reportId, e) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation();

    if (!window.confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      return;
    }

    try {
      await healthService.deleteReport(reportId);
      setReports(reports.filter(r => r._id !== reportId));
      toast.success('Report deleted successfully');
    } catch (error) {
      toast.error('Failed to delete report');
    }
  };

  const filteredReports = filter === 'all'
    ? reports
    : reports.filter(r => r.reportType.toLowerCase().includes(filter.toLowerCase()));

  const reportTypes = ['all', ...new Set(reports.map(r => r.reportType))];

  if (loading) {
    return <ReportsSkeleton />;
  }

  return (
    <div className="w-full mx-auto space-y-8 animate-fade-in p-6 pb-24">
      {/* Welcome Message - Mobile Only */}
      <div className="md:hidden flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold shadow-md flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <h1 className="text-sm font-bold text-slate-800 truncate">
            {(() => {
              const hour = new Date().getHours();
              if (hour < 12) return 'Good Morning';
              if (hour < 18) return 'Good Afternoon';
              return 'Good Evening';
            })()}, {user?.name?.split(' ')[0] || 'there'}!
          </h1>
        </div>
        <button className="w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:shadow-lg transition-all flex-shrink-0">
          <Bell className="w-4 h-4 text-slate-700" />
        </button>
      </div>

      {/* Header Section */}
      <div className="card card-gradient p-8 text-slate-800 shadow-2xl relative overflow-hidden ring-1 ring-white/50 border-none">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-500 hover:text-purple-600 font-black transition-all mb-4 text-[10px] uppercase tracking-widest group">
              <div className="p-1.5 bg-white/50 rounded-lg group-hover:scale-110 transition-transform shadow-sm border border-white">
                <ArrowLeft className="w-3.5 h-3.5" />
              </div>
              Back to Dashboard
            </Link>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2 uppercase">Your Health Archive</h1>
            <p className="text-slate-500 text-sm font-bold opacity-80">Track your progress across {reports.length} diagnostic reports</p>
          </div>
          <Link
            to="/upload"
            className="px-6 py-4 bg-slate-900 text-white rounded-[1.5rem] font-black hover:shadow-2xl transition-all flex items-center justify-center gap-3 text-sm uppercase tracking-widest active:scale-95 group shadow-xl"
          >
            <Upload className="w-4 h-4 group-hover:-translate-y-1 transition-transform" />
            Upload New Report
          </Link>
        </div>
      </div>

      {/* Stats Summary - Premium Grid */}
      {reports.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-5 group hover:scale-[1.02] transition-all duration-300">
            <div className="flex flex-col items-center sm:items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{reports.length}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Reports</p>
              </div>
            </div>
          </div>

          <div className="card p-5 group hover:scale-[1.02] transition-all duration-300">
            <div className="flex flex-col items-center sm:items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-3xl font-black text-slate-900 tracking-tighter leading-none">
                  {reports.filter(r => r.status === 'completed').length}
                </p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Analyzed</p>
              </div>
            </div>
          </div>

          <div className="card p-5 group hover:scale-[1.02] transition-all duration-300">
            <div className="flex flex-col items-center sm:items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform">
                <Calendar className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter leading-none pt-1">
                  {reports.length > 0
                    ? new Date(reports[0].createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : 'N/A'}
                </p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Latest</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs - Horizontal scroll on mobile */}
      <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide -mx-6 px-6 sm:mx-0 sm:px-0">
        {reportTypes.map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-5 py-2.5 rounded-2xl font-black whitespace-nowrap transition-all text-[11px] uppercase tracking-widest leading-none snap-start border-2 ${filter === type
              ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-105'
              : 'bg-white/50 backdrop-blur-sm text-slate-600 border-white hover:border-purple-200 hover:bg-white'
              }`}
          >
            {type === 'all' ? 'All Diagnostics' : type}
          </button>
        ))}
      </div>

      {/* Reports Grid - Horizontal scroll on mobile if more than 3 */}
      {filteredReports.length > 0 ? (
        <>
          {/* Desktop: Grid layout */}
          <div className="hidden sm:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReports.map((report) => (
              <div
                key={report._id}
                className="card p-6 border-none hover:shadow-2xl transition-all duration-300 group relative ring-1 ring-white/50"
              >
                {/* Delete Button */}
                <button
                  onClick={(e) => handleDeleteReport(report._id, e)}
                  className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-red-50 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all z-10 shadow-sm opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="flex items-start gap-5 mb-6">
                  <div className="w-16 h-16 rounded-[1.25rem] bg-indigo-50 flex items-center justify-center shadow-inner group-hover:bg-indigo-100 transition-colors">
                    <FileText className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest ${report.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                        }`}>
                        {report.status}
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 leading-tight uppercase group-hover:text-purple-600 transition-colors mb-1">
                      {report.reportType}
                    </h3>
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest font-mono">
                      <Calendar className="w-3 h-3" />
                      {new Date(report.reportDate || report.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {report.aiAnalysis?.healthScore && (
                  <div className="bg-slate-50/50 backdrop-blur-md rounded-2xl p-4 border border-white/50 mb-6 shadow-inner flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Health Score</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-slate-900 tracking-tighter">{report.aiAnalysis.healthScore}</span>
                      <span className="text-slate-400 font-bold text-xs">/100</span>
                    </div>
                  </div>
                )}

                <Link
                  to={`/reports/${report._id}`}
                  onClick={() => window.scrollTo(0, 0)}
                  className="w-full py-4 bg-white border-2 border-slate-100 text-slate-800 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-purple-600 hover:text-purple-600 transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
                >
                  <Eye className="w-4 h-4" />
                  Analysis Details
                </Link>
              </div>
            ))}
          </div>

          {/* Mobile: Horizontal scroll if more than 3 reports */}
          <div className="sm:hidden">
            {filteredReports.length <= 3 ? (
              <div className="grid grid-cols-1 gap-4">
                {filteredReports.map((report) => (
                  <div
                    key={report._id}
                    className="card p-5 relative border-none ring-1 ring-white/50"
                  >
                    {/* Delete Button */}
                    <button
                      onClick={(e) => handleDeleteReport(report._id, e)}
                      className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-red-50 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all z-10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 rounded-[1rem] bg-indigo-50 flex items-center justify-center flex-shrink-0 shadow-inner">
                        <FileText className="w-6 h-6 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0 pr-8">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-sm font-black text-slate-800 truncate uppercase">{report.reportType}</h3>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest whitespace-nowrap ${report.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                            {report.status}
                          </span>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono mb-2">
                          {new Date(report.reportDate || report.createdAt).toLocaleDateString()}
                        </p>
                        {report.aiAnalysis?.healthScore && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Score:</span>
                            <span className="text-lg font-black text-slate-900 tracking-tighter">{report.aiAnalysis.healthScore}</span>
                            <span className="text-[10px] text-slate-400 font-bold">/100</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Link
                      to={`/reports/${report._id}`}
                      onClick={() => window.scrollTo(0, 0)}
                      className="w-full py-3 bg-white border-2 border-slate-100 text-slate-800 rounded-xl font-black text-[10px] uppercase tracking-widest hover:border-purple-600 hover:text-purple-600 transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
                    >
                      <Eye className="w-3 h-3" />
                      Details
                    </Link>
                  </div>
                ))}
              </div>

            ) : (
              <>
                <div className="flex overflow-x-auto gap-4 pb-6 snap-x snap-mandatory scrollbar-hide -mx-6 px-6">
                  {filteredReports.map((report) => (
                    <div
                      key={report._id}
                      className="min-w-[280px] card p-5 relative snap-start flex-shrink-0 border-none ring-1 ring-white/50"
                    >
                      {/* Delete Button */}
                      <button
                        onClick={(e) => handleDeleteReport(report._id, e)}
                        className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-red-50 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all z-10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="flex items-start gap-4 mb-4 pr-8">
                        <div className="w-12 h-12 rounded-[1rem] bg-indigo-50 flex items-center justify-center flex-shrink-0 shadow-inner">
                          <FileText className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-black text-slate-800 mb-1 uppercase truncate">{report.reportType}</h3>
                          <span className={`text-[8px] px-2 py-0.5 rounded-md font-black uppercase tracking-widest inline-block ${report.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                            {report.status}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono mb-4">
                        {new Date(report.reportDate || report.createdAt).toLocaleDateString()}
                      </p>
                      {report.aiAnalysis?.healthScore && (
                        <div className="flex items-center justify-between p-3 bg-slate-50/50 backdrop-blur-md border border-white/50 rounded-xl mb-4 shadow-inner">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Health Score</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-slate-900 tracking-tighter">{report.aiAnalysis.healthScore}</span>
                            <span className="text-[10px] text-slate-400 font-bold">/100</span>
                          </div>
                        </div>
                      )}
                      <Link
                        to={`/reports/${report._id}`}
                        onClick={() => window.scrollTo(0, 0)}
                        className="w-full py-3 bg-white border-2 border-slate-100 text-slate-800 rounded-xl font-black text-[10px] uppercase tracking-widest hover:border-purple-600 hover:text-purple-600 transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
                      >
                        <Eye className="w-3 h-3" />
                        Details
                      </Link>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2">
                  <span>← Swipe for more →</span>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-16 px-6 card border-none shadow-xl flex flex-col items-center max-w-lg mx-auto mt-12">
          <div className="w-24 h-24 bg-purple-50 rounded-3xl flex items-center justify-center mb-6 shadow-inner relative">
            <div className="absolute inset-0 bg-white/20 rounded-3xl blur" />
            <FileText className="w-12 h-12 text-purple-300 relative z-10" />
          </div>
          <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2 uppercase">No Data Found</h3>
          <p className="text-slate-500 mb-8 text-sm font-bold opacity-80 max-w-xs leading-relaxed">
            {filter === 'all'
              ? 'Start your health journey by uploading your first diagnostic report.'
              : `No ${filter} diagnostic records exist yet.`}
          </p>
          <Link
            to="/upload"
            className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-[1.5rem] font-black hover:shadow-2xl transition-all flex items-center justify-center gap-3 text-sm uppercase tracking-widest active:scale-95 shadow-xl"
          >
            <Upload className="w-4 h-4" />
            Upload Report
          </Link>
        </div>

      )}
    </div>
  );
}
