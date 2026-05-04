import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCcw, Clock } from 'lucide-react';
import { activityService } from '../services/api';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from "recharts";

export default function ActivityDetailModal({ isOpen, onClose, filterData, title }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (isOpen && filterData) {
      fetchFilteredLogs();
    }
  }, [isOpen, filterData, page]);

  const fetchFilteredLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 10,
        ...filterData
      };

      console.log('📊 Modal API Request:', params);  // DEBUG LOG

      const res = await activityService.getLogs(params);
      if (res.data?.success) {
        console.log('📊 Modal API Response:', res.data);  // DEBUG LOG
        setLogs(res.data.logs || []);
        setTotalPages(res.data.pages || 1);
        setTotalCount(res.data.total || 0);
      }
    } catch (err) {
      console.error('Error fetching filtered logs:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-[3rem] shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-8 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-blue-50">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">{title}</h2>
                  <p className="text-slate-500 text-sm mt-1">Total: {totalCount.toLocaleString()} records</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-3 hover:bg-white rounded-2xl transition-colors"
                >
                  <X className="w-6 h-6 text-slate-600" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-8">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <RefreshCcw className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                    <p className="text-slate-500 font-semibold">Loading data...</p>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Clock className="w-12 h-12 text-slate-300 mb-4" />
                    <p className="text-slate-500 font-semibold">No records found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {logs.map((log, idx) => (
                      <motion.div
                        key={log._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">User</p>
                            <p className="font-semibold text-slate-900">{log.user?.name || 'Unknown'}</p>
                            <p className="text-xs text-slate-500">{log.user?.email}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Category</p>
                            <p className="font-semibold text-slate-900 capitalize">{log.category}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Action</p>
                            <p className="font-semibold text-slate-900">{log.action.replace(/_/g, ' ')}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Time</p>
                            <p className="font-semibold text-slate-900">
                              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-xs text-slate-500">
                              {new Date(log.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer with Pagination */}
              {totalPages > 1 && (
                <div className="p-8 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    Page <span className="font-black">{page}</span> of <span className="font-black">{totalPages}</span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}
                      className="px-6 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 disabled:opacity-50 hover:bg-slate-100 transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      disabled={page === totalPages}
                      onClick={() => setPage(p => p + 1)}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-semibold disabled:opacity-50 hover:bg-indigo-700 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
