import { useState, useEffect } from 'react';
import { supportService } from '../services/api';
import {
  MessageSquare, ChevronLeft, ChevronRight,
  RefreshCcw, Clock, CheckCircle, AlertCircle,
  X, Send
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export default function AdminSupport() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [limit] = useState(15);

  const [filters, setFilters] = useState({
    status: '',
    category: ''
  });

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, [page, filters.status, filters.category]);

  useEffect(() => {
    if (selectedTicket) {
      setResponseText(selectedTicket.adminResponse || '');
      setNewStatus(selectedTicket.status);
    }
  }, [selectedTicket]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        status: filters.status,
        category: filters.category
      };

      const res = await supportService.getAllTickets(params);
      if (res.data?.success) {
        setTickets(res.data.tickets || []);
        setTotalPages(res.data.pages || 1);
        setTotalCount(res.data.total || 0);
      }
    } catch (error) {
      toast.error('Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async () => {
    if (!responseText.trim()) {
      toast.error('Please enter a response');
      return;
    }

    setResponding(true);
    try {
      const res = await supportService.respondToTicket(selectedTicket._id, {
        response: responseText,
        status: newStatus
      });

      if (res.data?.success) {
        toast.success('Ticket updated successfully');
        setResponseText('');
        setSelectedTicket(null);
        fetchTickets();
      }
    } catch (error) {
      toast.error('Failed to update ticket');
    } finally {
      setResponding(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      open: 'bg-blue-50 text-blue-700 border-blue-200',
      in_progress: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      resolved: 'bg-green-50 text-green-700 border-green-200',
      closed: 'bg-gray-50 text-gray-700 border-gray-200'
    };
    return colors[status] || colors.open;
  };

  const getStatusIcon = (status) => {
    const icons = {
      open: <AlertCircle className="w-4 h-4" />,
      in_progress: <Clock className="w-4 h-4" />,
      resolved: <CheckCircle className="w-4 h-4" />,
      closed: <X className="w-4 h-4" />
    };
    return icons[status] || icons.open;
  };

  const getCategoryColor = (category) => {
    const colors = {
      bug: 'bg-red-100 text-red-700',
      feature_request: 'bg-purple-100 text-purple-700',
      general_help: 'bg-blue-100 text-blue-700',
      account_issue: 'bg-orange-100 text-orange-700',
      other: 'bg-gray-100 text-gray-700'
    };
    return colors[category] || colors.other;
  };

  return (
    <div className="min-h-screen bg-[#d7dbd7] text-[#0F172A] font-sans pb-8 antialiased">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 bg-slate-100 backdrop-blur-3xl border border-white/10 rounded-[2rem] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 shadow-[0_8px_20px_-6px_rgba(79,70,229,0.5)] flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-800">Support Tickets</h2>
              <p className="text-slate-400 text-[8px] font-bold uppercase tracking-wider">{totalCount} Total</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={fetchTickets}
              disabled={loading}
              className="p-2.5 bg-slate-100 rounded-xl border border-white/5 hover:border-indigo-600/40 hover:text-indigo-600 transition-all shadow-sm active:scale-95 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCcw className={`w-4 h-4 text-slate-500 transition-all ${loading ? 'animate-spin text-indigo-500' : ''}`} />
            </button>

            <select
              value={filters.status}
              onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}
              className="px-3 py-2 bg-white/80 border border-white/80 rounded-xl text-[8px] font-black text-slate-600 focus:outline-none cursor-pointer uppercase tracking-wider"
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>

            <select
              value={filters.category}
              onChange={(e) => { setFilters({ ...filters, category: e.target.value }); setPage(1); }}
              className="px-3 py-2 bg-white/80 border border-white/80 rounded-xl text-[8px] font-black text-slate-600 focus:outline-none cursor-pointer uppercase tracking-wider"
            >
              <option value="">All Categories</option>
              <option value="bug">Bug Report</option>
              <option value="feature_request">Feature Request</option>
              <option value="general_help">General Help</option>
              <option value="account_issue">Account Issue</option>
            </select>
          </div>
        </div>

        {/* Tickets List */}
        <div className="space-y-2.5">
          {loading ? (
            <div className="text-center py-12 bg-white rounded-[1.5rem] border border-slate-100">
              <div className="w-10 h-10 border-[4px] border-slate-100 border-t-indigo-600 rounded-full animate-spin mx-auto shadow-sm" />
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2.5">Loading Tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-[1.5rem] border border-slate-100">
              <MessageSquare className="w-10 h-10 text-slate-200 mx-auto mb-2.5" />
              <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">No Tickets Found</p>
            </div>
          ) : (
            tickets.map((ticket, i) => (
              <motion.div
                key={ticket._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setSelectedTicket(ticket)}
                className="bg-white p-4 rounded-[1.5rem] border border-white shadow-[0_10px_30px_-15px_rgba(0,0,0,0.08)] hover:shadow-[0_20px_40px_-15px_rgba(79,70,229,0.15)] transition-all duration-300 group cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <div className={`px-2 py-0.5 rounded-lg border text-[7px] font-black uppercase tracking-widest flex items-center gap-1 ${getStatusColor(ticket.status)}`}>
                        {getStatusIcon(ticket.status)}
                        {ticket.status}
                      </div>
                      <div className={`px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-widest ${getCategoryColor(ticket.category)}`}>
                        {ticket.category.replace(/_/g, ' ')}
                      </div>
                    </div>

                    <h3 className="text-sm font-black text-slate-900 mb-0.5 truncate group-hover:text-indigo-600 transition-colors">
                      {ticket.subject}
                    </h3>

                    <p className="text-xs text-slate-600 mb-1.5 line-clamp-1">
                      {ticket.message}
                    </p>

                    <div className="flex items-center gap-3 text-[7px] font-black text-slate-400 uppercase tracking-widest">
                      <span>{ticket.user?.name || 'Unknown'}</span>
                      <span>•</span>
                      <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {ticket.adminResponse ? (
                      <div className="px-2.5 py-1 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-[7px] font-black text-green-600 uppercase tracking-widest">Replied</p>
                      </div>
                    ) : (
                      <div className="px-2.5 py-1 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-[7px] font-black text-red-600 uppercase tracking-widest">Pending</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3.5 bg-white rounded-[1.5rem] border border-slate-100 shadow-sm">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
              Page {page} of {totalPages}
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 disabled:opacity-30 hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-95"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 disabled:opacity-30 hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-95"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2rem] shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
          >
            {/* Modal Header */}
            <div className="bg-indigo-600 text-white p-5 flex items-center justify-between border-b border-indigo-700 flex-shrink-0">
              <div>
                <h3 className="text-lg font-black">Ticket Details</h3>
                <p className="text-indigo-100 text-[8px] mt-0.5 uppercase tracking-wider">ID: {selectedTicket._id.slice(-8)}</p>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-2 hover:bg-indigo-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Ticket Info */}
              <div className="space-y-3">
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Subject</p>
                  <p className="text-base font-black text-slate-900">{selectedTicket.subject}</p>
                </div>

                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Message</p>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedTicket.message}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Category</p>
                    <p className={`inline-block px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${getCategoryColor(selectedTicket.category)}`}>
                      {selectedTicket.category.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">From</p>
                    <p className="text-sm font-bold text-slate-900">{selectedTicket.user?.name}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Email</p>
                  <p className="text-sm text-slate-600">{selectedTicket.user?.email}</p>
                </div>

                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Created</p>
                  <p className="text-sm text-slate-600">{new Date(selectedTicket.createdAt).toLocaleString()}</p>
                </div>
              </div>

              {/* Status Update Section */}
              <div className="border-t border-slate-200 pt-4">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Update Status</p>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              {/* Admin Response */}
              {selectedTicket.adminResponse && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3.5">
                  <p className="text-[8px] font-black text-green-600 uppercase tracking-widest mb-1.5">Previous Response</p>
                  <p className="text-sm text-green-900 whitespace-pre-wrap mb-1.5">{selectedTicket.adminResponse}</p>
                  <p className="text-[7px] text-green-600">Responded: {new Date(selectedTicket.respondedAt).toLocaleString()}</p>
                </div>
              )}

              {/* Response Form */}
              <div className="space-y-2.5 border-t border-slate-200 pt-4">
                <div>
                  <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1.5 block">
                    Your Response
                  </label>
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Type your response here..."
                    rows="4"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm resize-none"
                  />
                </div>

                <button
                  onClick={handleRespond}
                  disabled={responding || !responseText.trim()}
                  className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-black text-sm uppercase tracking-wider hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {responding ? 'Updating...' : 'Update Ticket'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
