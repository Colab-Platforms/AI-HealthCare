import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, IndianRupee, Users, Receipt, Edit3, Download, Loader2 } from "lucide-react";
import { adminService } from "../services/api";
import toast from "react-hot-toast";
import SEO from "../hooks/useSEO";
import { useAuth } from "../context/AuthContext";

const TABS = [
  { id: "subscribers", label: "Subscribers" },
  { id: "payments", label: "Payments" },
];

const STATUS_STYLES = {
  active: "bg-emerald-50 text-emerald-600 border-emerald-100",
  past_due: "bg-amber-50 text-amber-600 border-amber-100",
  cancelled: "bg-red-50 text-red-600 border-red-100",
  expired: "bg-red-50 text-red-600 border-red-100",
  inactive: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function AdminSubscriptions() {
  const { isSuperAdmin } = useAuth();
  const [tab, setTab] = useState("subscribers");

  const [revenue, setRevenue] = useState(null);

  const [subscribers, setSubscribers] = useState([]);
  const [subTotal, setSubTotal] = useState(0);
  const [subPage, setSubPage] = useState(1);
  const [subPages, setSubPages] = useState(1);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loadingSubs, setLoadingSubs] = useState(true);

  const [payments, setPayments] = useState([]);
  const [payTotal, setPayTotal] = useState(0);
  const [payPage, setPayPage] = useState(1);
  const [payPages, setPayPages] = useState(1);
  const [loadingPayments, setLoadingPayments] = useState(true);

  const [overrideTarget, setOverrideTarget] = useState(null);
  const [overrideForm, setOverrideForm] = useState({ plan: "", status: "", currentPeriodEnd: "" });
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const handleDownloadInvoice = async (payment) => {
    setDownloadingId(payment._id);
    try {
      const response = await adminService.downloadPaymentInvoice(payment._id);
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${payment.invoiceNumber || "invoice"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Couldn't download invoice");
    } finally {
      setDownloadingId(null);
    }
  };

  const fetchRevenue = async () => {
    try {
      const { data } = await adminService.getRevenueSummary();
      setRevenue(data);
    } catch (err) {
      console.error("Revenue fetch failed:", err);
    }
  };

  const fetchSubscribers = async () => {
    setLoadingSubs(true);
    try {
      const { data } = await adminService.getSubscribers({
        page: subPage,
        limit: 15,
        search: search || undefined,
        plan: planFilter !== "all" ? planFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      setSubscribers(data.users || []);
      setSubTotal(data.total || 0);
      setSubPages(data.pages || 1);
    } catch (err) {
      toast.error("Failed to load subscribers");
    } finally {
      setLoadingSubs(false);
    }
  };

  const fetchPayments = async () => {
    setLoadingPayments(true);
    try {
      const { data } = await adminService.getSubscriptionPayments({ page: payPage, limit: 15 });
      setPayments(data.payments || []);
      setPayTotal(data.total || 0);
      setPayPages(data.pages || 1);
    } catch (err) {
      toast.error("Failed to load payments");
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => { fetchRevenue(); }, []);

  useEffect(() => {
    const timer = setTimeout(fetchSubscribers, 350);
    return () => clearTimeout(timer);
  }, [subPage, search, planFilter, statusFilter]);

  useEffect(() => {
    if (tab === "payments") fetchPayments();
  }, [tab, payPage]);

  const openOverride = (user) => {
    setOverrideTarget(user);
    setOverrideForm({
      plan: user.subscription?.plan || "free",
      status: user.subscription?.status || "active",
      currentPeriodEnd: user.subscription?.currentPeriodEnd
        ? new Date(user.subscription.currentPeriodEnd).toISOString().slice(0, 10)
        : "",
    });
  };

  const handleOverrideSave = async () => {
    setSaving(true);
    try {
      await adminService.overrideSubscription(overrideTarget._id, overrideForm);
      toast.success("Subscription updated");
      setOverrideTarget(null);
      fetchSubscribers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Override failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 w-full max-w-[1600px] mx-auto font-sans">
      <SEO pageName="adminSubscriptions" />

      <div>
        <h1 className="text-2xl font-bold text-slate-800">Subscriptions & Billing</h1>
        <p className="text-slate-500 text-sm">Paid subscribers, payment history, and revenue</p>
      </div>

      {/* Revenue summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <IndianRupee className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Revenue</p>
            <p className="text-xl font-bold text-slate-800">
              ₹{(revenue?.totalRevenue || 0).toLocaleString("en-IN")}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Paid Subscribers</p>
            <p className="text-xl font-bold text-slate-800">{subTotal}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Payments Recorded</p>
            <p className="text-xl font-bold text-slate-800">{payTotal || "—"}</p>
          </div>
        </div>
      </div>

      {/* Revenue by plan */}
      {revenue?.byPlan?.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Revenue by Plan</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {revenue.byPlan.map((p, i) => (
              <div key={i} className="p-3 bg-slate-50 rounded-xl">
                <p className="text-xs font-bold text-slate-700 capitalize">{p.planName} ({p.billingCycle})</p>
                <p className="text-lg font-bold text-slate-900">₹{p.totalRevenue.toLocaleString("en-IN")}</p>
                <p className="text-[10px] text-slate-400">{p.paymentCount} payments</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-100">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
              tab === t.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "subscribers" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSubPage(1); }}
                className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-100 rounded-lg text-sm focus:border-blue-500 outline-none shadow-sm"
              />
            </div>
            <select
              value={planFilter}
              onChange={(e) => { setPlanFilter(e.target.value); setSubPage(1); }}
              className="px-3 py-2.5 border border-slate-100 rounded-lg text-sm bg-white shadow-sm"
            >
              <option value="all">All Plans</option>
              <option value="basic">Basic</option>
              <option value="premium">Premium</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setSubPage(1); }}
              className="px-3 py-2.5 border border-slate-100 rounded-lg text-sm bg-white shadow-sm"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="past_due">Past Due</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-h-[300px]">
            {loadingSubs ? (
              <div className="flex items-center justify-center h-[300px]">
                <div className="w-8 h-8 border-3 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50">
                    <tr className="border-b border-slate-50">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">User</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Plan</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Renews / Ends</th>
                      {isSuperAdmin() && (
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {subscribers.length === 0 ? (
                      <tr>
                        <td colSpan={isSuperAdmin() ? 5 : 4} className="px-6 py-16 text-center text-slate-400 text-sm font-medium">
                          No paid subscribers found
                        </td>
                      </tr>
                    ) : (
                      subscribers.map((u) => (
                        <tr key={u._id} className="hover:bg-slate-50/50 transition-all">
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-slate-800">{u.name}</p>
                            <p className="text-[10px] text-slate-400 lowercase">{u.email}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-slate-700 capitalize">
                              {u.subscription?.plan} · {u.subscription?.billingCycle}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${STATUS_STYLES[u.subscription?.status] || STATUS_STYLES.inactive}`}>
                              {u.subscription?.status || "inactive"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs text-slate-600">
                              {u.subscription?.currentPeriodEnd
                                ? new Date(u.subscription.currentPeriodEnd).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                                : "—"}
                            </p>
                          </td>
                          {isSuperAdmin() && (
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => openOverride(u)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Manually override subscription"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="px-6 py-4 border-t border-slate-50 flex items-center justify-between text-xs">
              <p className="text-slate-400 font-medium">Page {subPage} of {subPages}</p>
              <div className="flex gap-2">
                <button disabled={subPage === 1} onClick={() => setSubPage((p) => p - 1)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg disabled:opacity-30">Previous</button>
                <button disabled={subPage === subPages} onClick={() => setSubPage((p) => p + 1)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg disabled:opacity-30">Next</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "payments" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-h-[300px]">
          {loadingPayments ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="w-8 h-8 border-3 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50">
                  <tr className="border-b border-slate-50">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">User</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Plan</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Invoice</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-slate-400 text-sm font-medium">
                        No payments recorded yet
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p._id} className="hover:bg-slate-50/50 transition-all">
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-800">{p.user?.name || "—"}</p>
                          <p className="text-[10px] text-slate-400 lowercase">{p.user?.email}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-slate-700 capitalize">
                            {p.plan?.name} · {p.plan?.billingCycle}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-800">₹{p.amount}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                            p.status === "paid" ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                            : p.status === "failed" ? "bg-red-50 text-red-600 border-red-100"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          <div className="flex items-center gap-2">
                            <span>{p.invoiceNumber || "—"}</span>
                            {p.status === "paid" && p.invoiceNumber && (
                              <button
                                onClick={() => handleDownloadInvoice(p)}
                                disabled={downloadingId === p._id}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-60"
                                title="Download invoice"
                              >
                                {downloadingId === p._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-6 py-4 border-t border-slate-50 flex items-center justify-between text-xs">
            <p className="text-slate-400 font-medium">Page {payPage} of {payPages}</p>
            <div className="flex gap-2">
              <button disabled={payPage === 1} onClick={() => setPayPage((p) => p - 1)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg disabled:opacity-30">Previous</button>
              <button disabled={payPage === payPages} onClick={() => setPayPage((p) => p + 1)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg disabled:opacity-30">Next</button>
            </div>
          </div>
        </div>
      )}

      {/* Override modal */}
      <AnimatePresence>
        {overrideTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOverrideTarget(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md shadow-2xl rounded-3xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                <div>
                  <h2 className="font-bold text-slate-800 text-lg">Override Subscription</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{overrideTarget.email}</p>
                </div>
                <button onClick={() => setOverrideTarget(null)} className="p-2.5 hover:bg-white hover:shadow-md rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-xl">
                  This bypasses Razorpay — use for support/comp access only. It will be overwritten by the next real webhook event.
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Plan</label>
                  <select
                    value={overrideForm.plan}
                    onChange={(e) => setOverrideForm({ ...overrideForm, plan: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="free">Free</option>
                    <option value="basic">Basic</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status</label>
                  <select
                    value={overrideForm.status}
                    onChange={(e) => setOverrideForm({ ...overrideForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="past_due">Past Due</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="expired">Expired</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Access Until</label>
                  <input
                    type="date"
                    value={overrideForm.currentPeriodEnd}
                    onChange={(e) => setOverrideForm({ ...overrideForm, currentPeriodEnd: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button
                  onClick={handleOverrideSave}
                  disabled={saving}
                  className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-all disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Override"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
