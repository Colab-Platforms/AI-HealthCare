import { useState, useEffect } from "react";
import { supportService } from "../services/api";
import {
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  X,
  Send,
  User,
  Mail,
  CalendarDays,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import toast from "react-hot-toast";
import SEO from "../hooks/useSEO";
import { Skeleton, EmptyState } from "../components/admin/AdminUI";
import { EASE, container, riseIn } from "../components/admin/adminTheme";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const STATUS_STYLE = {
  open: { chip: "bg-tk-blue/10 text-tk-blue", Icon: AlertCircle, label: "Open" },
  in_progress: { chip: "bg-tk-warn/20 text-amber-700", Icon: Clock, label: "In progress" },
  resolved: { chip: "bg-tk-teal-soft text-tk-teal", Icon: CheckCircle2, label: "Resolved" },
  closed: { chip: "bg-slate-100 text-slate-600", Icon: XCircle, label: "Closed" },
};

const CATEGORY_STYLE = {
  bug: "bg-tk-error/10 text-tk-error",
  feature_request: "bg-tk-info/15 text-sky-700",
  general_help: "bg-tk-blue/10 text-tk-blue",
  account_issue: "bg-tk-warn/20 text-amber-700",
  other: "bg-slate-100 text-slate-600",
};

const fieldCls =
  "w-full px-3.5 py-2.5 bg-white border border-tk-line rounded-xl text-sm font-medium text-tk-ink " +
  "focus:outline-none focus:border-tk-blue focus:ring-4 focus:ring-tk-blue/10 transition-all";

function StatusPill({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.open;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${s.chip}`}>
      <s.Icon className="w-3.5 h-3.5" />
      {s.label}
    </span>
  );
}

function CategoryPill({ category }) {
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold capitalize ${CATEGORY_STYLE[category] || CATEGORY_STYLE.other}`}>
      {String(category || "other").replace(/_/g, " ")}
    </span>
  );
}

export default function AdminSupport() {
  const reduce = useReducedMotion();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [limit] = useState(15);

  const [filters, setFilters] = useState({ status: "", category: "" });

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [responseText, setResponseText] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, [page, filters.status, filters.category]);

  useEffect(() => {
    if (selectedTicket) {
      setResponseText(selectedTicket.adminResponse || "");
      setNewStatus(selectedTicket.status);
    }
  }, [selectedTicket]);

  // Esc closes the details panel.
  useEffect(() => {
    if (!selectedTicket) return;
    const onKey = (e) => e.key === "Escape" && setSelectedTicket(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedTicket]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params = { page, limit, status: filters.status, category: filters.category };
      const res = await supportService.getAllTickets(params);
      if (res.data?.success) {
        setTickets(res.data.tickets || []);
        setTotalPages(res.data.pages || 1);
        setTotalCount(res.data.total || 0);
      } else {
        toast.error(res.data?.message || "Failed to fetch tickets");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch tickets");
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async () => {
    if (!responseText.trim()) {
      toast.error("Please enter a response");
      return;
    }
    setResponding(true);
    try {
      const res = await supportService.respondToTicket(selectedTicket._id, {
        response: responseText,
        status: newStatus,
      });
      if (res.data?.success) {
        toast.success("Ticket updated successfully");
        setResponseText("");
        setSelectedTicket(null);
        fetchTickets();
      }
    } catch (error) {
      toast.error("Failed to update ticket");
    } finally {
      setResponding(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto">
      <SEO pageName="adminSupport" />

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        {/* Header */}
        <motion.div variants={riseIn} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-tk-blue grid place-items-center shadow-[0_10px_24px_-8px_rgba(32,90,226,0.55)]">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-[26px] font-extrabold tracking-tight text-tk-ink leading-tight">Support Tickets</h1>
              <p className="text-sm text-tk-muted">{totalCount.toLocaleString()} ticket{totalCount === 1 ? "" : "s"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filters.category}
              onChange={(e) => {
                setFilters({ ...filters, category: e.target.value });
                setPage(1);
              }}
              aria-label="Filter by category"
              className={fieldCls + " !w-auto cursor-pointer"}
            >
              <option value="">All categories</option>
              <option value="bug">Bug report</option>
              <option value="feature_request">Feature request</option>
              <option value="general_help">General help</option>
              <option value="account_issue">Account issue</option>
            </select>
            <motion.button
              whileTap={reduce ? undefined : { scale: 0.93 }}
              onClick={fetchTickets}
              disabled={loading}
              title="Refresh"
              aria-label="Refresh tickets"
              className="w-11 h-11 grid place-items-center rounded-xl bg-white border border-tk-line text-tk-muted hover:text-tk-blue hover:border-tk-action transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-tk-blue/20"
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin text-tk-blue" : ""}`} />
            </motion.button>
          </div>
        </motion.div>

        {/* Status tabs */}
        <motion.div variants={riseIn} role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-1.5 p-1.5 bg-white border border-tk-line rounded-2xl w-fit">
          {STATUS_TABS.map((t) => {
            const active = filters.status === t.value;
            return (
              <button
                key={t.value || "all"}
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setFilters({ ...filters, status: t.value });
                  setPage(1);
                }}
                className={`relative px-4 h-9 rounded-xl text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-tk-blue/20 ${
                  active ? "text-white" : "text-tk-muted hover:text-tk-ink"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="support-tab"
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-xl bg-tk-blue"
                  />
                )}
                <span className="relative">{t.label}</span>
              </button>
            );
          })}
        </motion.div>

        {/* Ticket list */}
        <div className="space-y-3">
          {loading ? (
            [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[104px] rounded-2xl" />)
          ) : tickets.length === 0 ? (
            <div className="bg-white rounded-3xl border border-tk-line py-14">
              <EmptyState title="No tickets found" hint="Try a different status or category." />
            </div>
          ) : (
            <motion.ul variants={container} initial="hidden" animate="show" className="space-y-3">
              {tickets.map((ticket) => (
                <motion.li key={ticket._id} variants={riseIn}>
                  <button
                    onClick={() => setSelectedTicket(ticket)}
                    className="group w-full text-left bg-white p-5 rounded-2xl border border-tk-line
                      hover:border-tk-action hover:shadow-[0_12px_28px_-14px_rgba(32,90,226,0.35)] hover:-translate-y-0.5
                      transition-all duration-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-tk-blue/20"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <StatusPill status={ticket.status} />
                          <CategoryPill category={ticket.category} />
                        </div>
                        <h3 className="text-[15px] font-bold text-tk-ink truncate group-hover:text-tk-blue transition-colors">
                          {ticket.subject}
                        </h3>
                        <p className="text-sm text-tk-muted line-clamp-1 mt-0.5">{ticket.message}</p>
                        <p className="mt-2.5 text-xs text-tk-muted flex items-center gap-2">
                          <span className="font-semibold text-slate-600">{ticket.user?.name || "Unknown"}</span>
                          <span aria-hidden>•</span>
                          <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                        </p>
                      </div>
                      <span
                        className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold ${
                          ticket.adminResponse ? "bg-tk-teal-soft text-tk-teal" : "bg-tk-error/10 text-tk-error"
                        }`}
                      >
                        {ticket.adminResponse ? "Replied" : "Pending"}
                      </span>
                    </div>
                  </button>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <motion.div variants={riseIn} className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-tk-line">
            <span className="text-sm font-semibold text-tk-muted">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              {[
                { Icon: ChevronLeft, disabled: page === 1, onClick: () => setPage((p) => p - 1), label: "Previous page" },
                { Icon: ChevronRight, disabled: page === totalPages, onClick: () => setPage((p) => p + 1), label: "Next page" },
              ].map(({ Icon, disabled, onClick, label }) => (
                <button
                  key={label}
                  disabled={disabled}
                  onClick={onClick}
                  aria-label={label}
                  className="w-9 h-9 rounded-xl border border-tk-line grid place-items-center text-tk-muted disabled:opacity-30
                    hover:bg-tk-blue hover:border-tk-blue hover:text-white transition-colors active:scale-95"
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Details drawer */}
      <AnimatePresence>
        {selectedTicket && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTicket(null)}
              className="fixed inset-0 z-[60] bg-tk-ink/40 backdrop-blur-[2px]"
            />
            <motion.aside
              key="drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Ticket details"
              initial={reduce ? { opacity: 0 } : { x: "100%" }}
              animate={reduce ? { opacity: 1 } : { x: 0 }}
              exit={reduce ? { opacity: 0 } : { x: "100%" }}
              transition={{ duration: 0.3, ease: EASE }}
              className="fixed inset-y-0 right-0 z-[70] w-full max-w-[520px] bg-white shadow-2xl flex flex-col"
            >
              <div className="shrink-0 px-6 py-5 bg-tk-blue text-white flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-extrabold">Ticket details</h3>
                  <p className="text-xs text-white/75 mt-0.5 font-medium">ID {selectedTicket._id.slice(-8)}</p>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  aria-label="Close"
                  className="w-9 h-9 grid place-items-center rounded-xl hover:bg-white/15 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusPill status={selectedTicket.status} />
                  <CategoryPill category={selectedTicket.category} />
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-tk-muted mb-1">Subject</p>
                  <p className="text-lg font-bold text-tk-ink">{selectedTicket.subject}</p>
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-tk-muted mb-1.5">Message</p>
                  <div className="bg-tk-bg p-4 rounded-2xl border border-tk-line">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedTicket.message}</p>
                  </div>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {[
                    { Icon: User, term: "From", desc: selectedTicket.user?.name },
                    { Icon: Mail, term: "Email", desc: selectedTicket.user?.email },
                    { Icon: CalendarDays, term: "Created", desc: new Date(selectedTicket.createdAt).toLocaleString() },
                  ].map(({ Icon, term, desc }) => (
                    <div key={term} className="flex items-start gap-2.5 min-w-0">
                      <span className="w-8 h-8 shrink-0 rounded-lg bg-tk-blue/10 text-tk-blue grid place-items-center">
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-tk-muted">{term}</dt>
                        <dd className="font-semibold text-tk-ink break-words">{desc || "—"}</dd>
                      </div>
                    </div>
                  ))}
                </dl>

                {selectedTicket.adminResponse && (
                  <div className="bg-tk-teal-soft border border-tk-teal/20 rounded-2xl p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-tk-teal mb-1.5">Previous response</p>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{selectedTicket.adminResponse}</p>
                    {selectedTicket.respondedAt && (
                      <p className="text-xs text-tk-teal mt-2 font-medium">
                        Responded {new Date(selectedTicket.respondedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-4 pt-5 border-t border-tk-line">
                  <div>
                    <label htmlFor="ticket-status" className="text-[11px] font-bold uppercase tracking-[0.12em] text-tk-muted mb-1.5 block">
                      Status
                    </label>
                    <select id="ticket-status" value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className={fieldCls}>
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="ticket-response" className="text-[11px] font-bold uppercase tracking-[0.12em] text-tk-muted mb-1.5 block">
                      Your response
                    </label>
                    <textarea
                      id="ticket-response"
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="Type your response here…"
                      rows={5}
                      className={fieldCls + " resize-none"}
                    />
                  </div>
                </div>
              </div>

              <div className="shrink-0 p-5 border-t border-tk-line bg-white">
                <motion.button
                  whileTap={reduce ? undefined : { scale: 0.98 }}
                  onClick={handleRespond}
                  disabled={responding || !responseText.trim()}
                  className="w-full h-12 rounded-xl bg-tk-blue text-white font-bold text-sm flex items-center justify-center gap-2
                    hover:bg-tk-action transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                    focus:outline-none focus-visible:ring-4 focus-visible:ring-tk-blue/30"
                >
                  <Send className="w-4 h-4" />
                  {responding ? "Updating…" : "Update ticket"}
                </motion.button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
