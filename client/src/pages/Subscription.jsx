import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { subscriptionService } from "../services/api";
import { Check, X, ShieldCheck, Loader2, AlertCircle, Download, Receipt } from "lucide-react";
import GenericSkeleton from "../components/skeletons/GenericSkeleton";
import SEO from "../hooks/useSEO";
import PricingSection from "../components/landing/PricingSection";
import { loadRazorpayScript } from "../utils/loadRazorpay";

export default function Subscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [dbPlans, setDbPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(true);

  useEffect(() => {
    fetchSubscription();
    fetchPlans();
    fetchPayments();
  }, []);

  const fetchSubscription = async () => {
    try {
      const { data } = await subscriptionService.getSubscription();
      setSubscription(data);
    } catch (error) {
      console.error("Failed to fetch subscription");
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const { data } = await subscriptionService.getPlans();
      setDbPlans(data?.plans || []);
    } catch (error) {
      console.error("Failed to fetch plans");
    }
  };

  const fetchPayments = async () => {
    setLoadingPayments(true);
    try {
      const { data } = await subscriptionService.getMyPayments();
      setPayments(data?.payments || []);
    } catch (error) {
      console.error("Failed to fetch payment history");
    } finally {
      setLoadingPayments(false);
    }
  };

  const currentPlan = subscription?.plan || user?.subscription?.plan || "free";
  const currentStatus = subscription?.status || user?.subscription?.status || "active";
  const currentPeriodEnd = subscription?.currentPeriodEnd || user?.subscription?.currentPeriodEnd;

  const handleCancel = async () => {
    if (!window.confirm("Cancel your subscription? You'll keep access until the current billing period ends.")) return;
    setCancelling(true);
    setCancelError("");
    try {
      await subscriptionService.cancel();
      await fetchSubscription();
    } catch (err) {
      setCancelError(err?.response?.data?.message || "Couldn't cancel your subscription. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <GenericSkeleton />;

  return (
    <div className="w-full mx-auto space-y-10 animate-fade-in">
      <SEO pageName="subscription" />

      {/* Header */}
      <div className="text-center max-w-xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-black text-landing-text mb-3 font-landing-title">
          Pricing Plans
        </h1>
        <p className="text-landing-text/60 font-landing-body">
          Track, understand, and act on your health with a plan built for
          your needs.
        </p>
      </div>

      {currentPlan !== "free" && (
        <CurrentPlanCard
          plan={currentPlan}
          status={currentStatus}
          currentPeriodEnd={currentPeriodEnd}
          autoRenew={subscription?.autoRenew ?? user?.subscription?.autoRenew}
          cancelling={cancelling}
          cancelError={cancelError}
          onCancel={handleCancel}
        />
      )}

      <PricingSection currentPlan={currentPlan} onSelectPlan={setSelectedPlan} />

      {!loadingPayments && payments.length > 0 && <PaymentHistory payments={payments} />}

      <CheckoutModal
        plan={selectedPlan}
        dbPlans={dbPlans}
        onClose={() => setSelectedPlan(null)}
        onSubscribed={() => { fetchSubscription(); fetchPayments(); }}
      />
    </div>
  );
}

const STATUS_LABELS = {
  active: { label: "Active", color: "text-green-700 bg-green-100" },
  past_due: { label: "Payment issue — grace period", color: "text-amber-700 bg-amber-100" },
  cancelled: { label: "Cancelled", color: "text-red-700 bg-red-100" },
  expired: { label: "Expired", color: "text-red-700 bg-red-100" },
  inactive: { label: "Inactive", color: "text-landing-text/50 bg-landing-text/5" },
};

function CurrentPlanCard({ plan, status, currentPeriodEnd, autoRenew, cancelling, cancelError, onCancel }) {
  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.inactive;
  const canCancel = status === "active";

  return (
    <div className="max-w-2xl mx-auto bg-white/60 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-sm p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-landing-text/50 uppercase tracking-wider font-semibold mb-1">Current Plan</p>
          <p className="text-xl font-bold text-landing-text capitalize">{plan}</p>
        </div>
        <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      </div>

      {currentPeriodEnd && (
        <p className="text-sm text-landing-text/60 mt-3">
          {status === "cancelled" ? "Access ends" : "Renews"} on{" "}
          {new Date(currentPeriodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      )}

      {status === "past_due" && (
        <div className="flex items-start gap-2 mt-4 bg-amber-50 text-amber-800 text-xs rounded-xl p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          Your last payment didn't go through. Please update your payment method to avoid losing access.
        </div>
      )}

      {cancelError && (
        <p className="text-xs text-red-600 bg-red-50 rounded-xl p-3 mt-4">{cancelError}</p>
      )}

      {canCancel && (
        <button
          onClick={onCancel}
          disabled={cancelling}
          className="mt-5 text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-60 flex items-center gap-2"
        >
          {cancelling && <Loader2 className="w-4 h-4 animate-spin" />}
          {cancelling ? "Cancelling…" : "Cancel subscription"}
        </button>
      )}
    </div>
  );
}

const PAYMENT_STATUS_LABELS = {
  paid: { label: "Paid", color: "text-green-700 bg-green-100" },
  failed: { label: "Failed", color: "text-red-700 bg-red-100" },
  created: { label: "Pending", color: "text-amber-700 bg-amber-100" },
  authenticated: { label: "Pending", color: "text-amber-700 bg-amber-100" },
  refunded: { label: "Refunded", color: "text-landing-text/50 bg-landing-text/5" },
};

function PaymentHistory({ payments }) {
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadError, setDownloadError] = useState("");

  const handleDownload = async (payment) => {
    setDownloadError("");
    setDownloadingId(payment._id);
    try {
      const response = await subscriptionService.downloadInvoice(payment._id);
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
      setDownloadError("Couldn't download the invoice. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white/60 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <Receipt className="w-4 h-4 text-landing-text/50" />
        <p className="text-sm font-bold text-landing-text">Payment History</p>
      </div>

      {downloadError && (
        <p className="text-xs text-red-600 bg-red-50 rounded-xl p-3 mb-3">{downloadError}</p>
      )}

      <div className="space-y-2">
        {payments.map((p) => {
          const statusInfo = PAYMENT_STATUS_LABELS[p.status] || PAYMENT_STATUS_LABELS.created;
          const canDownload = p.status === "paid" && !!p.invoiceNumber;
          const isDownloading = downloadingId === p._id;

          return (
            <div
              key={p._id}
              className="flex items-center justify-between gap-3 p-3.5 bg-white/60 rounded-2xl border border-white/60"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-landing-text capitalize truncate">
                  {p.plan?.name || "Plan"} · {p.plan?.billingCycle || ""}
                </p>
                <p className="text-xs text-landing-text/50">
                  {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  {" · "}₹{p.amount}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
                {canDownload && (
                  <button
                    onClick={() => handleDownload(p)}
                    disabled={isDownloading}
                    className="p-2 text-landing-text/50 hover:text-landing-primary hover:bg-landing-primary/10 rounded-xl transition-all disabled:opacity-60"
                    title="Download invoice"
                  >
                    {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CheckoutModal({ plan, dbPlans, onClose, onSubscribed }) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
  }, [plan]);

  const dbPlan = plan
    ? dbPlans.find((p) => p.key === plan.id && p.billingCycle === plan.billingCycle)
    : null;

  const handlePay = async () => {
    if (!dbPlan) {
      setError("This plan isn't available for checkout right now. Please try again shortly.");
      return;
    }
    setPaying(true);
    setError("");
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setError("Couldn't load the payment widget. Check your connection and try again.");
        return;
      }

      const { data } = await subscriptionService.subscribe(dbPlan._id);

      const rzp = new window.Razorpay({
        key: data.razorpayKeyId,
        order_id: data.razorpayOrderId,
        name: "take.health",
        description: `${data.plan.name} Plan — ${data.plan.billingCycle}`,
        theme: { color: "#014343" },
        handler: () => {
          // Access is granted by the webhook, not this callback — just refresh state.
          onSubscribed?.();
          onClose();
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
      });
      rzp.open();
    } catch (err) {
      setError(err?.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {plan && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-landing-text/40 backdrop-blur-sm z-[200]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-[201] flex items-center justify-center p-4"
          >
            <div className="bg-white/90 backdrop-blur-2xl rounded-[2rem] border border-white/60 shadow-2xl max-w-md w-full overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-landing-text/10">
                <h2 className="text-lg font-bold text-landing-text">Confirm your plan</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-landing-text/5 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-landing-text/50" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between bg-landing-accent-bg rounded-2xl p-4">
                  <div>
                    <p className="text-landing-text font-bold capitalize">{plan.name} Plan</p>
                    <p className="text-landing-text/50 text-xs capitalize">{plan.billingCycle} billing</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-landing-primary">₹{plan.price}</p>
                    <p className="text-landing-text/50 text-xs">/month</p>
                    {plan.billingCycle === "yearly" && (
                      <p className="text-landing-text/50 text-[11px] mt-0.5">
                        Billed ₹{plan.price * 12}/year
                      </p>
                    )}
                  </div>
                </div>

                <ul className="space-y-2">
                  {plan.features.slice(0, 4).map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-landing-text/70">
                      <Check className="w-4 h-4 text-landing-primary flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="flex items-start gap-3 bg-landing-text/5 rounded-2xl p-4">
                  <ShieldCheck className="w-5 h-5 text-landing-text/40 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-landing-text/50">
                    Payments are processed securely via Razorpay. This is a one-time
                    payment for the {plan.billingCycle} period — we'll remind you
                    before it's time to renew.
                  </p>
                </div>

                {error && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-xl p-3">{error}</p>
                )}

                <button
                  onClick={handlePay}
                  disabled={paying}
                  className="w-full py-3.5 rounded-2xl font-bold text-sm bg-landing-primary text-white hover:bg-landing-primary-hover transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {paying && <Loader2 className="w-4 h-4 animate-spin" />}
                  {paying ? "Opening secure checkout…" : "Pay with Razorpay"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
