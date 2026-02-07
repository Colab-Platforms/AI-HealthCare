import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { healthService } from '../services/api';
import { FileText, ArrowLeft, Calendar, Eye, TrendingUp, AlertCircle, Upload, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AllReports() {
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
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 animate-fade-in p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 font-medium transition-colors mb-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">All Health Reports</h1>
          <p className="text-slate-500 mt-1 text-sm">View and manage all your uploaded health reports</p>
        </div>
        <Link 
          to="/upload" 
          className="px-4 py-2.5 sm:px-6 sm:py-3 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm sm:text-base whitespace-nowrap"
          style={{ backgroundColor: '#8B7355' }}
        >
          <Upload className="w-4 h-4" />
          Upload Report
        </Link>
      </div>

      {/* Stats Summary - Above filters */}
      {reports.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-cyan-100 flex items-center justify-center mb-2 sm:mb-0">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-500" />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-xl sm:text-2xl font-bold text-slate-800">{reports.length}</p>
                <p className="text-slate-500 text-[10px] sm:text-sm">Total Reports</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-emerald-100 flex items-center justify-center mb-2 sm:mb-0">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-xl sm:text-2xl font-bold text-slate-800">
                  {reports.filter(r => r.status === 'completed').length}
                </p>
                <p className="text-slate-500 text-[10px] sm:text-sm">Analyzed</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-100 flex items-center justify-center mb-2 sm:mb-0">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-xs sm:text-base font-bold text-slate-800 leading-tight">
                  {reports.length > 0 
                    ? new Date(reports[0].createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : 'N/A'}
                </p>
                <p className="text-slate-500 text-[10px] sm:text-sm">Latest</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs - Horizontal scroll on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
        {reportTypes.map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-medium whitespace-nowrap transition-all text-sm snap-start ${
              filter === type
                ? 'bg-cyan-500 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {type === 'all' ? 'All Reports' : type}
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
                className="bg-white rounded-2xl border-2 border-slate-200 p-4 sm:p-6 hover:border-cyan-400 hover:shadow-lg transition-all group relative"
              >
                {/* Delete Button - Top Right */}
                <button
                  onClick={(e) => handleDeleteReport(report._id, e)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors z-10"
                  title="Delete report"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>

                {/* Report Icon */}
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                    <FileText className="w-6 h-6 text-red-500" />
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                    report.status === 'completed' 
                      ? 'bg-emerald-100 text-emerald-600' 
                      : report.status === 'processing'
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {report.status === 'completed' ? 'ANALYZED' : report.status.toUpperCase()}
                  </span>
                </div>

                {/* Report Info */}
                <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-cyan-600 transition-colors">
                  {report.reportType}
                </h3>
                
                {/* Patient Name */}
                {(report.patientName || report.aiAnalysis?.patientName) && (
                  <p className="text-sm text-slate-600 mb-2">
                    Patient: {report.patientName || report.aiAnalysis?.patientName}
                  </p>
                )}

                {/* Date */}
                <div className="flex items-center gap-2 text-slate-500 text-sm mb-3">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {new Date(report.reportDate || report.createdAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>

                {/* Health Score */}
                {report.aiAnalysis?.healthScore && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl mb-3">
                    <span className="text-sm text-slate-600">Health Score</span>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-slate-800">
                        {report.aiAnalysis.healthScore}
                      </span>
                      <span className="text-slate-400 text-sm">/100</span>
                    </div>
                  </div>
                )}

                {/* Key Findings Count */}
                {report.aiAnalysis?.keyFindings?.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                    <AlertCircle className="w-4 h-4" />
                    <span>{report.aiAnalysis.keyFindings.length} key findings</span>
                  </div>
                )}

                {/* View Details Button */}
                <Link
                  to={`/reports/${report._id}`}
                  onClick={() => window.scrollTo(0, 0)}
                  className="block w-full mt-3 py-2 bg-cyan-500 text-white rounded-lg font-medium text-sm hover:bg-cyan-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  View Details
                </Link>
              </div>
            ))}
          </div>

          {/* Mobile: Horizontal scroll if more than 3 reports */}
          <div className="sm:hidden">
            {filteredReports.length <= 3 ? (
              <div className="grid grid-cols-1 gap-3">
                {filteredReports.map((report) => (
                  <div
                    key={report._id}
                    className="bg-white rounded-xl border-2 border-slate-200 p-4 hover:border-cyan-400 transition-all relative"
                  >
                    {/* Delete Button */}
                    <button
                      onClick={(e) => handleDeleteReport(report._id, e)}
                      className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors z-10"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    </button>

                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0 pr-8">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-sm font-bold text-slate-800 truncate">{report.reportType}</h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                            report.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                          }`}>
                            {report.status === 'completed' ? 'DONE' : 'PENDING'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">
                          {new Date(report.reportDate || report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        {report.aiAnalysis?.healthScore && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-slate-600">Score:</span>
                            <span className="text-lg font-bold text-slate-800">{report.aiAnalysis.healthScore}</span>
                            <span className="text-xs text-slate-400">/100</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Link
                      to={`/reports/${report._id}`}
                      onClick={() => window.scrollTo(0, 0)}
                      className="block w-full py-2 bg-cyan-500 text-white rounded-lg font-medium text-xs hover:bg-cyan-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Details
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="flex overflow-x-auto gap-3 pb-4 snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
                  {filteredReports.map((report) => (
                    <div
                      key={report._id}
                      className="min-w-[280px] bg-white rounded-xl border-2 border-slate-200 p-4 hover:border-cyan-400 transition-all snap-start flex-shrink-0 relative"
                    >
                      {/* Delete Button */}
                      <button
                        onClick={(e) => handleDeleteReport(report._id, e)}
                        className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors z-10"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      </button>

                      <div className="flex items-start gap-3 mb-3 pr-8">
                        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-slate-800 mb-1">{report.reportType}</h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            report.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                          }`}>
                            {report.status === 'completed' ? 'ANALYZED' : 'PENDING'}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">
                        {new Date(report.reportDate || report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      {report.aiAnalysis?.healthScore && (
                        <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg mb-3">
                          <span className="text-xs text-slate-600">Health Score</span>
                          <div className="flex items-center gap-1">
                            <span className="text-xl font-bold text-slate-800">{report.aiAnalysis.healthScore}</span>
                            <span className="text-xs text-slate-400">/100</span>
                          </div>
                        </div>
                      )}
                      <Link
                        to={`/reports/${report._id}`}
                        onClick={() => window.scrollTo(0, 0)}
                        className="block w-full py-2 bg-cyan-500 text-white rounded-lg font-medium text-xs hover:bg-cyan-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Details
                      </Link>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-2 text-slate-400 text-xs">
                  <span>← Scroll for more →</span>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">No Reports Found</h3>
          <p className="text-slate-500 mb-6 text-sm">
            {filter === 'all' 
              ? 'Upload your first health report to get started' 
              : `No ${filter} reports found`}
          </p>
          <Link 
            to="/upload" 
            className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-xl font-medium hover:shadow-lg transition-all"
            style={{ backgroundColor: '#8B7355' }}
          >
            <FileText className="w-4 h-4" />
            Upload Report
          </Link>
        </div>
      )}
    </div>
  );
}
