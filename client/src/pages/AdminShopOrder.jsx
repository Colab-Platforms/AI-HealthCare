import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import SEO from "../hooks/useSEO";
import { shopAdminService } from "../services/api";
import {
  inr, when, apiError, StatusChip, Flags, Card, Spinner, Table, Button, Modal, inputClass,
} from "../components/shopAdmin/ShopAdminUI";

const money = (paise) => (paise === null || paise === undefined ? null : { paise, rupees: paise / 100 });
const Row = ({ label, children }) => (
  <div className="flex justify-between gap-4 py-1 text-sm">
    <span className="text-slate-500">{label}</span>
    <span className="text-slate-900 text-right break-all">{children ?? "—"}</span>
  </div>
);

export default function AdminShopOrder() {
  const { orderId } = useParams();
  const [o, setO] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null); // { type, refund? }
  const [form, setForm] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try { setO((await shopAdminService.order(orderId)).data); } catch (err) { toast.error(apiError(err, "Order not found")); } finally { setLoading(false); }
  }, [orderId]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); toast.success(ok); setModal(null); setForm({}); await load(); } catch (err) { toast.error(apiError(err)); } finally { setBusy(false); }
  };
  const open = (type, refund = null) => { setForm({ method: "manual_upi" }); setModal({ type, refund }); };

  if (loading && !o) return <Spinner />;
  if (!o) return <div className="w-full max-w-5xl mx-auto px-4 py-6"><Link to="/admin/shop?tab=orders" className="text-sm text-blue-600">← Orders</Link></div>;

  const pr = o.pricing || {};
  const canCancel = ["paid", "cod_pending"].includes(o.paymentStatus) && o.fulfillmentStatus === "unfulfilled";
  const canRefund = o.paymentMethod === "prepaid" && ["paid", "refund_pending", "partially_refunded"].includes(o.paymentStatus);
  const canRetrySync = ["needs_attention", "failed"].includes(o.shopifySyncStatus);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 space-y-5">
      <SEO title={`${o.internalOrderId} | Shop admin`} />
      <Link to="/admin/shop?tab=orders" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft className="w-4 h-4" /> Orders</Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">{o.internalOrderId} <StatusChip status={o.status} /></h1>
          <div className="text-sm text-slate-500 mt-1">Created {when(o.createdAt)}{o.placedAt ? ` · placed ${when(o.placedAt)}` : ""}{o.shopifyOrderName ? ` · Shopify ${o.shopifyOrderName}` : ""}</div>
          <div className="mt-2"><Flags flags={o.flags} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={load}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></Button>
          {o.shopifyAdminUrl && <a href={o.shopifyAdminUrl} target="_blank" rel="noreferrer"><Button variant="secondary"><ExternalLink className="w-4 h-4" /> Shopify</Button></a>}
          {o.review?.needed && <Button onClick={() => open("review")}>Resolve review</Button>}
          {canRetrySync && <Button disabled={busy || o.review?.needed} onClick={() => run(() => shopAdminService.retrySync(o.internalOrderId), "Sent to Shopify")}>Retry Shopify sync</Button>}
          {canRefund && <Button variant="secondary" onClick={() => open("refund")}>Refund</Button>}
          <Button variant="secondary" onClick={() => open("manual")}>Record manual refund</Button>
          {canCancel && <Button variant="danger" onClick={() => open("cancel")}>Cancel order</Button>}
        </div>
      </div>

      {o.review?.needed && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">
          Held for review: <b>{o.review.reasons.join(", ")}</b>. Not sent to Shopify until resolved.
        </div>
      )}
      {o.shopifySyncError && canRetrySync && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 text-sm">Shopify: {o.shopifySyncError}</div>
      )}

      <div className="grid md:grid-cols-3 gap-5">
        <Card title="Customer">
          <Row label="Name">{o.customer?.name}</Row>
          <Row label="Account email">{o.customer?.email}</Row>
          <Row label="Account phone">{o.customer?.phone}</Row>
          <Row label="Checkout phone">{o.customer?.checkoutPhone}</Row>
          <Row label="Checkout email">{o.customer?.checkoutEmail}</Row>
          {o.customer?.id && <Link to={`/admin/shop/customers/${o.customer.id}`} className="text-sm text-blue-600 hover:underline">Customer journey →</Link>}
        </Card>
        <Card title="Payment">
          <Row label="Method">{o.paymentMethod?.toUpperCase()}</Row>
          <Row label="Status"><StatusChip status={o.paymentStatus} /></Row>
          <Row label="Gateway">{o.payment?.gateway} {o.payment?.method ? `· ${o.payment.method}` : ""}</Row>
          <Row label="PG transaction">{o.payment?.pgTransactionId}</Row>
          <Row label="Received">{inr(money(o.payment?.amountReceived))}</Row>
          <Row label="Fastrr order">{o.paidFastrrOrderId || o.fastrrOrderId}</Row>
          <Row label="RTO risk">{o.rtoPrediction}</Row>
        </Card>
        <Card title="Delivery">
          <Row label="Fulfilment"><StatusChip status={o.fulfillmentStatus} /></Row>
          <Row label="Shopify sync"><StatusChip status={o.shopifySyncStatus} /></Row>
          <Row label="Courier">{o.tracking?.courier}</Row>
          <Row label="AWB">{o.tracking?.url ? <a className="text-blue-600 hover:underline" href={o.tracking.url} target="_blank" rel="noreferrer">{o.tracking.number}</a> : o.tracking?.number}</Row>
          <Row label="Expected">{o.edd}</Row>
          <Row label="Delivered">{o.deliveredAt ? when(o.deliveredAt) : null}</Row>
          {o.shippingAddress && (
            <div className="text-sm text-slate-700 mt-2 pt-2 border-t border-slate-100">
              {[o.shippingAddress.firstName, o.shippingAddress.lastName].filter(Boolean).join(" ")}<br />
              {[o.shippingAddress.line1, o.shippingAddress.line2, o.shippingAddress.landmark].filter(Boolean).join(", ")}<br />
              {o.shippingAddress.city}, {o.shippingAddress.state} {o.shippingAddress.pincode}
            </div>
          )}
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <Card title="Items" className="md:col-span-2">
          <Table
            columns={[
              { key: "title", label: "Product", render: (i) => <div><div className="text-slate-900">{i.title}</div><div className="text-xs text-slate-500">{i.variantTitle} · {i.sku || i.variantId}</div></div> },
              { key: "quantity", label: "Qty", align: "right" },
              { key: "price", label: "Price", align: "right", render: (i) => inr(money(i.priceSnapshot)) },
              { key: "line", label: "Total", align: "right", render: (i) => inr(money(i.priceSnapshot * i.quantity)) },
            ]}
            rows={(o.items || []).map((i) => ({ ...i, _key: i.variantId }))}
          />
        </Card>
        <Card title="Price">
          <Row label="Subtotal">{inr(money(pr.subtotal ?? o.amount))}</Row>
          <Row label="Discount">{pr.discount ? `− ${inr(money(pr.discount))}` : "—"}</Row>
          <Row label="Shipping">{inr(money(pr.shipping || 0))}</Row>
          <Row label="COD charges">{inr(money(pr.codCharges || 0))}</Row>
          <div className="border-t border-slate-100 mt-1 pt-1"><Row label="Total"><b>{inr(money(pr.total ?? o.amount))}</b></Row></div>
          {pr.couponCodes?.length > 0 && <Row label="Coupons">{pr.couponCodes.join(", ")}</Row>}
        </Card>
      </div>

      <Card title={`Refunds (${(o.refunds || []).length})`}>
        <Table
          columns={[
            { key: "refundId", label: "Refund", render: (r) => <div><div className="font-medium text-slate-900">{r.refundId}</div><div className="text-xs text-slate-500">{r.source?.replace(/_/g, " ")}{r.kind === "duplicate_payment" ? " · 2nd payment" : ""}</div></div> },
            { key: "amount", label: "Amount", align: "right", render: (r) => inr(money(r.amount)) },
            { key: "status", label: "Status", render: (r) => <div><StatusChip status={r.status} />{r.error && <div className="text-xs text-red-700 mt-1">{r.error}</div>}</div> },
            { key: "method", label: "Method", render: (r) => <span className="text-xs text-slate-600">{r.method}{r.reference ? ` · ${r.reference}` : ""}{r.fastrrRefundId ? ` · ${r.fastrrRefundId}` : ""}</span> },
            { key: "when", label: "Requested", render: (r) => <span className="whitespace-nowrap text-slate-600">{when(r.createdAt)}</span> },
            {
              key: "act", label: "", render: (r) => (
                <div className="flex gap-1 justify-end">
                  {r.status === "requested" && <Button disabled={busy} onClick={() => run(() => shopAdminService.approveRefund(o.internalOrderId, r.refundId), "Refund sent to Fastrr")}>Approve</Button>}
                  {r.status === "failed" && <Button variant="secondary" disabled={busy} onClick={() => run(() => shopAdminService.retryRefund(o.internalOrderId, r.refundId), "Refund sent again")}>Retry</Button>}
                  {["requested", "failed", "unknown"].includes(r.status) && <Button variant="secondary" onClick={() => open("markPaid", r)}>Mark paid</Button>}
                </div>
              ),
            },
          ]}
          rows={(o.refunds || []).map((r) => ({ ...r, _key: r.refundId }))}
          empty="No refunds"
        />
      </Card>

      <Card title="Timeline">
        <ol className="relative border-l border-slate-200 ml-2">
          {o.timeline.map((t, i) => (
            <li key={i} className="ml-4 pb-3">
              <span className={`absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border-2 border-white ${t.kind === "status" ? "bg-blue-600" : t.kind === "refund" ? "bg-violet-600" : t.kind === "event" ? "bg-slate-400" : "bg-slate-900"}`} />
              <div className="text-sm text-slate-900">{t.label.replace(/_/g, " ")}</div>
              <div className="text-xs text-slate-500">{when(t.at)}{t.source ? ` · ${t.source}` : ""}</div>
            </li>
          ))}
        </ol>
      </Card>

      {/* Modals */}
      <Modal open={modal?.type === "cancel"} title="Cancel order" onClose={() => setModal(null)}>
        <p className="text-sm text-slate-600">Cancels in Shopify (stock goes back){o.paymentMethod === "prepaid" ? " and refunds the full amount through Fastrr right away" : ""}.</p>
        <input className={inputClass} placeholder="Reason (shown in history)" value={form.reason || ""} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        <Button variant="danger" className="w-full" disabled={busy} onClick={() => run(() => shopAdminService.cancelOrder(o.internalOrderId, form.reason), "Order cancelled")}>Cancel order</Button>
      </Modal>

      <Modal open={modal?.type === "refund"} title="Refund through Fastrr" onClose={() => setModal(null)}>
        <p className="text-sm text-slate-600">Leave the amount empty to refund everything still refundable. Sent to Fastrr immediately.</p>
        <input className={inputClass} type="number" min="1" step="0.01" placeholder="Amount in ₹ (optional)" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <input className={inputClass} placeholder="Reason" value={form.reason || ""} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        <Button className="w-full" disabled={busy} onClick={() => run(() => shopAdminService.createRefund(o.internalOrderId, {
          amountPaise: form.amount ? Math.round(Number(form.amount) * 100) : undefined, reason: form.reason,
        }), "Refund sent to Fastrr")}>Send refund</Button>
      </Modal>

      <Modal open={modal?.type === "markPaid" || modal?.type === "manual"} title={modal?.type === "markPaid" ? `Mark ${modal?.refund?.refundId} as paid` : "Record a manual refund"} onClose={() => setModal(null)}>
        <p className="text-sm text-slate-600">
          {modal?.type === "markPaid"
            ? "Only after you confirmed the money reached the customer (UPI / bank / Fastrr dashboard)."
            : "Money returned outside Fastrr (e.g. COD order refunded by UPI)."}
        </p>
        {modal?.type === "manual" && (
          <input className={inputClass} type="number" min="1" step="0.01" placeholder="Amount in ₹" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        )}
        <select className={inputClass} value={form.method || "manual_upi"} onChange={(e) => setForm({ ...form, method: e.target.value })}>
          <option value="manual_upi">UPI</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="store_credit">Store credit</option>
          <option value="other">Other</option>
        </select>
        <input className={inputClass} placeholder="UPI / bank reference (required)" value={form.reference || ""} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        {modal?.type === "manual" && <input className={inputClass} placeholder="Reason" value={form.reason || ""} onChange={(e) => setForm({ ...form, reason: e.target.value })} />}
        <Button className="w-full" disabled={busy} onClick={() => run(() => (modal.type === "markPaid"
          ? shopAdminService.markRefundPaid(o.internalOrderId, modal.refund.refundId, { method: form.method, reference: form.reference })
          : shopAdminService.manualRefund(o.internalOrderId, { amountPaise: Math.round(Number(form.amount) * 100), method: form.method, reference: form.reference, reason: form.reason })
        ), "Refund recorded")}>Save</Button>
      </Modal>

      <Modal open={modal?.type === "review"} title="Resolve review" onClose={() => setModal(null)}>
        <p className="text-sm text-slate-600">Reasons: <b>{o.review?.reasons?.join(", ")}</b>. Write what you checked (e.g. Fastrr dashboard shows ₹X paid). After resolving, use “Retry Shopify sync”.</p>
        <textarea className={inputClass} rows={3} value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <Button className="w-full" disabled={busy} onClick={() => run(() => shopAdminService.resolveReview(o.internalOrderId, form.note), "Review resolved")}>Resolve</Button>
      </Modal>
    </div>
  );
}
