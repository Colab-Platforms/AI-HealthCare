import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import SEO from "../hooks/useSEO";
import { shopAdminService } from "../services/api";
import { inr, when, day, apiError, StatusChip, Flags, Card, Spinner, Empty, Table } from "../components/shopAdmin/ShopAdminUI";

// Human wording for the event log.
const LABEL = {
  search: (m) => `Searched “${m.q}” (${m.results ?? 0} results)`,
  product_view: (m) => `Viewed ${m.handle || "a product"}`,
  cart_add: (m) => `Added to cart (qty ${m.quantity ?? 1})`,
  cart_update: (m) => `Changed quantity to ${m.quantity}`,
  cart_remove: () => "Removed from cart",
  cart_clear: () => "Emptied cart",
  checkout_start: (m) => `Started checkout (₹${((m.amountPaise || 0) / 100).toLocaleString("en-IN")})`,
  checkout_error: (m) => `Checkout blocked: ${String(m.code || "").replace(/_/g, " ").toLowerCase()}`,
  payment_page_open: () => "Opened payment page",
  payment_success: (m) => `Paid (${m.method === "cod" ? "COD" : "prepaid"})`,
  payment_failed: () => "Payment failed",
  order_cancelled: (m) => `Order cancelled by ${m.by}${m.reason ? ` — “${m.reason}”` : ""}`,
  order_shipped: (m) => `Shipped${m.courier ? ` with ${m.courier}` : ""}`,
  order_delivered: () => "Delivered",
  refund_requested: (m) => `Refund requested (₹${((m.amountPaise || 0) / 100).toLocaleString("en-IN")}, ${String(m.source || "").replace(/_/g, " ")})`,
  refund_completed: (m) => `Refund completed (₹${((m.amountPaise || 0) / 100).toLocaleString("en-IN")})`,
};
const DOT = { payment_success: "bg-green-600", payment_failed: "bg-red-600", checkout_error: "bg-red-600", order_cancelled: "bg-red-600", refund_completed: "bg-violet-600", refund_requested: "bg-violet-600" };

export default function AdminShopCustomer() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { setData((await shopAdminService.customer(userId)).data); } catch (err) { toast.error(apiError(err, "Customer not found")); } finally { setLoading(false); }
    })();
  }, [userId]);

  if (loading) return <Spinner />;
  if (!data) return <div className="max-w-5xl mx-auto px-4 py-6"><Link to="/admin/shop?tab=customers" className="text-sm text-blue-600">← Customers</Link></div>;

  const { customer, cart, orders, events } = data;
  // Group the timeline by day (newest first).
  const byDay = events.reduce((acc, e) => {
    const k = day(e.at);
    (acc[k] = acc[k] || []).push(e);
    return acc;
  }, {});

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      <SEO title={`${customer.name || "Customer"} | Shop admin`} />
      <Link to="/admin/shop?tab=customers" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft className="w-4 h-4" /> Customers</Link>
      <div>
        <h1 className="text-xl font-bold text-slate-900">{customer.name || "Customer"}</h1>
        <div className="text-sm text-slate-500 mt-1">{customer.email || ""}{customer.phone ? ` · ${customer.phone}` : ""}</div>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <Card title="Cart right now">
          {!cart ? <Empty>Empty</Empty> : (
            <>
              {cart.items.map((i, k) => (
                <div key={k} className="flex justify-between text-sm py-1">
                  <span className="text-slate-800">{i.quantity} × {i.title}{i.variantTitle && i.variantTitle !== "Default Title" ? ` (${i.variantTitle})` : ""}{i.issue && <span className="text-red-700"> · {i.issue}</span>}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm pt-2 mt-1 border-t border-slate-100"><span className="text-slate-500">Value</span><b>{inr(cart.value)}</b></div>
              <div className="text-xs text-slate-500 mt-1">Last change {when(cart.updatedAt)}</div>
            </>
          )}
        </Card>
        <Card title={`Checkouts & orders (${orders.length})`} className="md:col-span-2">
          <Table
            onRowClick={(r) => navigate(`/admin/shop/orders/${r.orderId}`)}
            columns={[
              { key: "orderId", label: "Order", render: (r) => <span className="font-medium text-slate-900">{r.orderId}</span> },
              { key: "items", label: "Items", render: (r) => `${r.firstItem || "—"}${r.itemCount > 1 ? ` · ${r.itemCount} units` : ""}` },
              { key: "total", label: "Total", align: "right", render: (r) => inr(r.total) },
              { key: "status", label: "Status", render: (r) => <div className="space-y-1"><StatusChip status={r.status} /><Flags flags={r.flags} /></div> },
              { key: "createdAt", label: "When", render: (r) => <span className="whitespace-nowrap text-slate-600">{when(r.createdAt)}</span> },
            ]}
            rows={orders.map((r) => ({ ...r, _key: r.orderId }))}
            empty="No checkouts yet"
          />
        </Card>
      </div>

      <Card title={`Journey (${events.length} events, newest first)`}>
        {events.length === 0 ? <Empty>No activity recorded</Empty> : Object.entries(byDay).map(([d, list]) => (
          <div key={d} className="mb-4 last:mb-0">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{d}</div>
            <ol className="relative border-l border-slate-200 ml-2">
              {list.map((e, i) => (
                <li key={i} className="ml-4 pb-2.5">
                  <span className={`absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border-2 border-white ${DOT[e.type] || "bg-slate-400"}`} />
                  <div className="text-sm text-slate-900">
                    {(LABEL[e.type] || (() => e.type))(e.meta || {})}
                    {e.orderId && <Link to={`/admin/shop/orders/${e.orderId}`} className="ml-2 text-xs text-blue-600 hover:underline">{e.orderId}</Link>}
                  </div>
                  <div className="text-xs text-slate-500">{new Date(e.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </Card>
    </div>
  );
}
