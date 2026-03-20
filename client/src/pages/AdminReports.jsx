import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Search, ChevronLeft, ChevronRight, Eye, AlertCircle, CheckCircle, Clock, Download } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function AdminReports() {
    const [reports, setReports] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedReport, setSelectedReport] = useState(null);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit: 15 });
            if (statusFilter) params.append('status', statusFilter);
            const { data } = await api.get(`admin/reports?${params}`);
            setReports(data.reports || []);
            setTotal(data.total || 0);
            setPages(data.pages || 1);
        } catch (err) {
            toast.error('Failed to load reports');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchReports(); }, [page, statusFilter]);

    const getStatusBadge = (status) => {
        const map = {
            completed: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
            failed: { color: 'bg-red-50 text-red-700 border-red-200', icon: AlertCircle },
            processing: { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
            pending: { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Clock },
        };
        return map[status] || map.pending;
    };

    return (
        <div className="min-h-full p-4 md:p-8 font-sans">
            <div className="max-w-[1200px] mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-[#1a1a1a]">All Reports</h1>
                        <p className="text-sm text-slate-500 mt-1">{total} reports across all users</p>
                    </div>
                </div>

                {/* Filters */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 border border-white/50 shadow-sm flex gap-3"
                >
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                        className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                    >
                        <option value="">All Status</option>
                        <option value="completed">Completed</option>
                        <option value="failed">Failed</option>
                        <option value="processing">Processing</option>
                    </select>
                </motion.div>

                {/* Reports Table */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/50 shadow-sm overflow-hidden"
                >
                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto" />
                            <p className="text-sm text-slate-500 mt-3">Loading reports...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="text-left px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">User</th>
                                        <th className="text-left px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden md:table-cell">Report Type</th>
                                        <th className="text-center px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Health Score</th>
                                        <th className="text-center px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                                        <th className="text-center px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden md:table-cell">Date</th>
                                        <th className="text-center px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reports.map((r) => {
                                        const badge = getStatusBadge(r.status);
                                        const StatusIcon = badge.icon;
                                        return (
                                            <tr key={r._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                            {r.user?.name?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-[#1a1a1a] truncate max-w-[140px]">{r.user?.name || 'Unknown'}</p>
                                                            <p className="text-[11px] text-slate-400 truncate max-w-[140px]">{r.user?.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 hidden md:table-cell">
                                                    <span className="text-sm text-slate-600 capitalize">{r.reportType || 'General'}</span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className={`text-lg font-bold ${(r.aiAnalysis?.healthScore || 0) >= 70 ? 'text-emerald-600' : (r.aiAnalysis?.healthScore || 0) >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                                        {r.aiAnalysis?.healthScore || '—'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${badge.color}`}>
                                                        <StatusIcon className="w-3 h-3" />
                                                        {r.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center hidden md:table-cell">
                                                    <p className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</p>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <button
                                                        onClick={() => setSelectedReport(r)}
                                                        className="p-2 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {pages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                            <p className="text-xs text-slate-500">Page {page} of {pages}</p>
                            <div className="flex gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* Report Detail Modal */}
                {selectedReport && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelectedReport(null)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="space-y-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                                        <FileText className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-[#1a1a1a]">{selectedReport.user?.name}'s Report</h2>
                                        <p className="text-xs text-slate-500">{new Date(selectedReport.createdAt).toLocaleString()}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-slate-50 rounded-xl">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">Health Score</p>
                                        <p className="text-2xl font-bold text-[#1a1a1a]">{selectedReport.aiAnalysis?.healthScore || '—'}</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-xl">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">Status</p>
                                        <p className="text-sm font-bold text-[#1a1a1a] capitalize mt-1">{selectedReport.status}</p>
                                    </div>
                                </div>

                                <div className="p-3 bg-slate-50 rounded-xl">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Report Type</p>
                                    <p className="text-sm font-medium text-[#1a1a1a] capitalize">{selectedReport.reportType || 'General Health Report'}</p>
                                </div>

                                <button onClick={() => setSelectedReport(null)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium text-sm hover:bg-slate-800 transition-colors">
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </div>
        </div>
    );
}
