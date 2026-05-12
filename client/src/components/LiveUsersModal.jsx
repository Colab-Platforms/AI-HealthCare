import { useState, useEffect } from 'react';
import { X, Users, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { activityService } from '../services/api';
import toast from 'react-hot-toast';

export default function LiveUsersModal({ isOpen, onClose }) {
  const [liveUsers, setLiveUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  useEffect(() => {
    if (isOpen) {
      fetchLiveUsers(1);
    }
  }, [isOpen]);

  const fetchLiveUsers = async (pageNum) => {
    try {
      setLoading(true);
      const res = await activityService.getLiveUsers({ page: pageNum, limit });
      if (res.data?.success) {
        setLiveUsers(res.data.liveUsers || []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.pages || 1);
        setPage(pageNum);
      }
    } catch (error) {
      console.error('Error fetching live users:', error);
      toast.error('Failed to load live users');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      fetchLiveUsers(page - 1);
    }
  };

  const handleNextPage = () => {
    if (page < totalPages) {
      fetchLiveUsers(page + 1);
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
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black">Live Active Users</h2>
                    <p className="text-indigo-100 text-xs font-semibold">Currently active (last 5 minutes)</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
                      <p className="text-sm text-slate-600 font-semibold">Loading live users...</p>
                    </div>
                  </div>
                ) : liveUsers.length > 0 ? (
                  <div className="space-y-3">
                    {liveUsers.map((user, idx) => (
                      <motion.div
                        key={user._id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          {/* Avatar */}
                          {user.profilePicture ? (
                            <img
                              src={user.profilePicture}
                              alt={user.name}
                              className="w-12 h-12 rounded-lg object-cover shadow-sm"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
                              {user.name?.[0]?.toUpperCase()}
                            </div>
                          )}

                          {/* User Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-900 truncate">{user.name}</h3>
                            <p className="text-xs text-slate-500 truncate">{user.email}</p>
                          </div>

                          {/* Activity Info */}
                          <div className="text-right shrink-0">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                              <span className="text-xs font-black text-green-600">LIVE</span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-semibold">
                              {user.activityCount} action{user.activityCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Users className="w-12 h-12 text-slate-300 mb-3" />
                    <p className="text-slate-600 font-semibold">No live users right now</p>
                    <p className="text-slate-500 text-sm mt-1">Check back in a few moments</p>
                  </div>
                )}
              </div>

              {/* Footer with Pagination */}
              {liveUsers.length > 0 && (
                <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between shrink-0">
                  <div className="text-sm text-slate-600 font-semibold">
                    Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total} users
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrevPage}
                      disabled={page === 1 || loading}
                      className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Previous page"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>

                    <div className="px-3 py-1 bg-white rounded-lg border border-slate-200">
                      <span className="text-sm font-bold text-slate-900">
                        {page} / {totalPages}
                      </span>
                    </div>

                    <button
                      onClick={handleNextPage}
                      disabled={page === totalPages || loading}
                      className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Next page"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-600" />
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
