import { useState } from 'react';
import { ChevronDown, Users, TrendingUp, Clock, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { activityService } from '../services/api';
import toast from 'react-hot-toast';

export default function FeatureUsageAnalytics({ stats, filters }) {
  const [expandedFeature, setExpandedFeature] = useState(null);
  const [userBreakdownData, setUserBreakdownData] = useState({});
  const [loadingFeature, setLoadingFeature] = useState(null);
  const [userPagination, setUserPagination] = useState({});
  const [exportingFeature, setExportingFeature] = useState(null);

  const displayNames = {
    'authentication': 'Security',
    'diagnostics': 'Diagnostics',
    'nutrition': 'Nutrition',
    'medical': 'Medical',
    'fitness': 'Fitness',
    'glucose': 'Glucose',
    'system': 'System'
  };

  const colors = {
    'authentication': 'bg-blue-600',
    'diagnostics': 'bg-emerald-600',
    'nutrition': 'bg-amber-600',
    'medical': 'bg-rose-600',
    'fitness': 'bg-purple-600',
    'glucose': 'bg-red-600',
    'system': 'bg-cyan-600'
  };

  // Fetch user breakdown for a feature
  const fetchUserBreakdown = async (featureId, page = 1) => {
    try {
      setLoadingFeature(featureId);
      console.log('📥 Fetching:', { featureId, page, limit: 5 });
      
      const response = await activityService.getFeatureStats({
        featureId,
        page,
        limit: 5,
        startDate: filters.startDate,
        endDate: filters.endDate
      });

      console.log('📤 Response:', response.data);

      setUserBreakdownData(prev => ({
        ...prev,
        [featureId]: response.data.userBreakdown
      }));

      setUserPagination(prev => ({
        ...prev,
        [featureId]: {
          currentPage: response.data.currentPage,
          totalPages: response.data.totalPages,
          totalCount: response.data.totalCount,
          limit: response.data.limit
        }
      }));
    } catch (error) {
      console.error('Failed to fetch user breakdown:', error);
    } finally {
      setLoadingFeature(null);
    }
  };

  const handleExpandFeature = async (featureId) => {
    if (expandedFeature === featureId) {
      setExpandedFeature(null);
    } else {
      setExpandedFeature(featureId);
      if (!userBreakdownData[featureId]) {
        await fetchUserBreakdown(featureId, 1);
      }
    }
  };

  const handlePageChange = async (featureId, newPage) => {
    await fetchUserBreakdown(featureId, newPage);
  };

  const handleExportCSV = async (featureId, featureName) => {
    setExportingFeature(featureId);
    try {
      const response = await activityService.getFeatureStats({
        featureId,
        page: 1,
        limit: 10000,
        startDate: filters.startDate,
        endDate: filters.endDate
      });

      const users = response.data.userBreakdown || [];
      if (users.length === 0) {
        toast.error('No data to export');
        return;
      }

      const headers = ['Name', 'Email', 'Action Count', 'Last Used'];
      const rows = users.map(u => [
        `"${u.userName || 'Unknown'}"`,
        `"${u.userEmail || 'N/A'}"`,
        u.count,
        `"${new Date(u.lastUsed).toLocaleDateString()}"`
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `feature-${featureId}-users-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`Exported ${users.length} users for ${featureName}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    } finally {
      setExportingFeature(null);
    }
  };

  if (!stats?.categoryStats || stats.categoryStats.length === 0) {
    return (
      <div className="bg-white p-9 rounded-[3rem] border border-white shadow-[0_25px_60px_-25px_rgba(0,0,0,0.1)]">
        <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">
          Feature Usage Analytics
        </h3>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-8">
          Platform Feature Adoption & Usage Patterns
        </p>
        <div className="flex flex-col items-center justify-center py-12">
          <TrendingUp className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            No Feature Data Available
          </p>
          <p className="text-[9px] text-slate-500 mt-1">
            Adjust filters to view feature usage analytics
          </p>
        </div>
      </div>
    );
  }

  const total = stats.categoryStats.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="bg-white p-9 rounded-[3rem] border border-white shadow-[0_25px_60px_-25px_rgba(0,0,0,0.1)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">
            Feature Usage Analytics
          </h3>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">
            Platform Feature Adoption & Usage Patterns
          </p>
        </div>
      </div>

      {/* Features List */}
      <div className="space-y-3">
        {stats.categoryStats.map((feature, idx) => {
          const percentage = Math.round((feature.count / total) * 100);
          const isExpanded = expandedFeature === feature._id;
          const isLoading = loadingFeature === feature._id;
          const pagination = userPagination[feature._id];
          const users = userBreakdownData[feature._id] || [];

          return (
            <motion.div
              key={feature._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="border border-slate-100 rounded-2xl overflow-hidden hover:border-slate-200 transition-all"
            >
              {/* Feature Row */}
              <button
                onClick={() => handleExpandFeature(feature._id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  {/* Color Badge */}
                  <div className={`w-3 h-3 rounded-full ${colors[feature._id] || 'bg-slate-400'}`} />

                  {/* Feature Name */}
                  <div className="text-left">
                    <p className="font-bold text-slate-900">
                      {displayNames[feature._id] || feature._id}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {feature.uniqueUsers} unique users
                    </p>
                  </div>

                  {/* Count */}
                  <div className="ml-auto mr-4">
                    <p className="font-black text-slate-900 text-lg">
                      {feature.count}
                    </p>
                    <p className="text-xs text-slate-500">actions</p>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className={`h-full ${colors[feature._id] || 'bg-slate-400'}`}
                    />
                  </div>

                  {/* Percentage */}
                  <p className="font-bold text-slate-900 w-12 text-right">
                    {percentage}%
                  </p>
                </div>

                {/* Expand Icon */}
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                </motion.div>
              </button>

              {/* Expanded User Breakdown */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-slate-100 bg-slate-50/50"
                  >
                    <div className="p-6 space-y-3">
                      {/* Export Button */}
                      <div className="flex justify-end mb-2">
                        <button
                          onClick={() => handleExportCSV(feature._id, displayNames[feature._id] || feature._id)}
                          disabled={exportingFeature === feature._id || isLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-indigo-700 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Download className={`w-3.5 h-3.5 ${exportingFeature === feature._id ? 'animate-spin' : ''}`} />
                          {exportingFeature === feature._id ? 'Exporting...' : 'Export CSV'}
                        </button>
                      </div>

                      {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-6 h-6 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
                        </div>
                      ) : users.length > 0 ? (
                        <>
                          {/* User Rows - Table Format */}
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-slate-200">
                                  <th className="text-left py-3 px-4 font-bold text-slate-700 text-xs uppercase tracking-wider">User</th>
                                  <th className="text-left py-3 px-4 font-bold text-slate-700 text-xs uppercase tracking-wider">Email</th>
                                  <th className="text-right py-3 px-4 font-bold text-slate-700 text-xs uppercase tracking-wider">Count</th>
                                  <th className="text-right py-3 px-4 font-bold text-slate-700 text-xs uppercase tracking-wider">Last Used</th>
                                </tr>
                              </thead>
                              <tbody>
                                {users.map((user, userIdx) => (
                                  <motion.tr
                                    key={user._id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: userIdx * 0.05 }}
                                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                                  >
                                    <td className="py-3 px-4">
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                                          <span className="text-xs font-black text-slate-700">
                                            {user.userName?.[0]?.toUpperCase() || 'U'}
                                          </span>
                                        </div>
                                        <p className="font-semibold text-slate-900 truncate">
                                          {user.userName || 'Unknown User'}
                                        </p>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4">
                                      <p className="text-sm text-slate-600 truncate">
                                        {user.userEmail || 'N/A'}
                                      </p>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                      <p className="font-black text-slate-900">
                                        {user.count}
                                      </p>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                      <p className="text-sm text-slate-500 flex items-center justify-end gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(user.lastUsed).toLocaleDateString()}
                                      </p>
                                    </td>
                                  </motion.tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Pagination */}
                          {pagination && pagination.totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-slate-200">
                              <button
                                onClick={() =>
                                  handlePageChange(
                                    feature._id,
                                    Math.max(1, pagination.currentPage - 1)
                                  )
                                }
                                disabled={pagination.currentPage === 1}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                              >
                                ← Prev
                              </button>

                              <div className="flex items-center gap-1">
                                {(() => {
                                  const totalPages = pagination.totalPages;
                                  const currentPage = pagination.currentPage;
                                  const maxVisible = 5;
                                  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                                  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
                                  
                                  if (endPage - startPage + 1 < maxVisible) {
                                    startPage = Math.max(1, endPage - maxVisible + 1);
                                  }

                                  const pages = [];
                                  for (let i = startPage; i <= endPage; i++) {
                                    pages.push(i);
                                  }

                                  return pages.map(pageNum => (
                                    <button
                                      key={pageNum}
                                      onClick={() =>
                                        handlePageChange(feature._id, pageNum)
                                      }
                                      className={`w-8 h-8 rounded-lg font-semibold text-sm transition-all ${
                                        pageNum === currentPage
                                          ? 'bg-slate-900 text-white'
                                          : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                                      }`}
                                    >
                                      {pageNum}
                                    </button>
                                  ));
                                })()}
                              </div>

                              <button
                                onClick={() =>
                                  handlePageChange(
                                    feature._id,
                                    Math.min(
                                      pagination.totalPages,
                                      pagination.currentPage + 1
                                    )
                                  )
                                }
                                disabled={
                                  pagination.currentPage ===
                                  pagination.totalPages
                                }
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                              >
                                Next →
                              </button>

                              <span className="text-xs text-slate-500 ml-2">
                                Page {pagination.currentPage} of{' '}
                                {pagination.totalPages}
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-8">
                          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-sm text-slate-500">
                            No users found for this feature
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mt-8 pt-8 border-t border-slate-100">
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Most Used
          </p>
          <p className="text-sm text-slate-600">
            <span className="font-black text-slate-900">
              {displayNames[stats.categoryStats[0]._id] ||
                stats.categoryStats[0]._id}
            </span>
            <span className="text-slate-500 ml-2">
              ({stats.categoryStats[0].count} actions)
            </span>
          </p>
        </div>

        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Total Features
          </p>
          <p className="text-sm text-slate-600">
            <span className="font-black text-slate-900">
              {stats.categoryStats.length}
            </span>
            <span className="text-slate-500 ml-2">categories tracked</span>
          </p>
        </div>

        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Total Usage
          </p>
          <p className="text-sm text-slate-600">
            <span className="font-black text-slate-900">{total}</span>
            <span className="text-slate-500 ml-2">total actions</span>
          </p>
        </div>
      </div>
    </div>
  );
}
