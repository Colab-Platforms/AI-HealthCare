import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { RefreshCw, AlertTriangle, Search, ShoppingBag } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import toast from "react-hot-toast";
import SEO from "../hooks/useSEO";
import { shopAdminService } from "../services/api";
import {
  inr, when, day, apiError, StatusChip, Flags, Card, Stat, Spinner, Empty, Table, Pager, Button, inputClass,
} from "../components/shopAdmin/ShopAdminUI";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "orders", label: "Orders" },
  { id: "attention", label: "Needs attention" },
  { id: "products", label: "Products" },
  { id: "carts", label: "Carts" },
  { id: "customers", label: "Customers" },
  { id: "refunds", label: "Refunds" },
];

const ORDER_STATUSES = [
  "placed", "awaiting_payment", "payment_failed", "expired", "confirmed", "shipped", "delivered",
  "returned", "cancelled", "refund_initiated", "partially_refunded", "refunded",
];

// Generic loader: { data, loading, reload }
function useLoad(fn, deps) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData((await fn()).data);
    } catch (err) {
      toast.error(apiError(err, "Failed to load"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, reload };
}

// ── Overview ───────────────────────────────────────────────────────────────

const RANGES = [["today", "Today"], ["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"]];
const BAR = "#2563eb"; // validated (dataviz validator, light surface)

function RevenueTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <div className="font-medium text-slate-900">{day(d.date)}</div>
      <div className="text-slate-600 mt-0.5">Revenue: <span className="text-slate-900 tabular-nums">{inr(d.revenue)}</span></div>
      <div className="text-slate-600">Orders: <span className="text-slate-900 tabular-nums">{d.orders}</span></div>
    </div>
  );
}

function Funnel({ funnel }) {
  const steps = [
    ["Viewed a product", funnel.viewedProduct],
    ["Added to cart", funnel.addedToCart],
    ["Started checkout", funnel.startedCheckout],
    ["Paid / placed", funnel.paid],
  ];
  const max = Math.max(1, ...steps.map(([, v]) => v));
  return (
    <div className="space-y-2.5">
      {steps.map(([label, v]) => (
        <div key={label}>
          <div className="flex justify-between text-xs text-slate-600 mb-1">
            <span>{label}</span>
            <span className="tabular-nums text-slate-900">{v}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full" style={{ width: `${(v / max) * 100}%`, background: BAR }} />
          </div>
        </div>
      ))}
      <p className="text-xs text-slate-500 pt-1">Logged-in shoppers. Plus {funnel.anonymousViews} anonymous product views and {funnel.searches} searches.</p>
    </div>
  );
}

function OverviewTab({ goTab }) {
  const [range, setRange] = useState("7d");
  const [showTable, setShowTable] = useState(false);
  const { data: o, loading, reload } = useLoad(() => shopAdminService.overview(range), [range]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        {RANGES.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setRange(id)}
            className={`px-3 py-1.5 rounded-lg text-sm ${range === id ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            {label}
          </button>
        ))}
        <button onClick={reload} className="ml-auto flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {loading && !o ? <Spinner /> : o && (
        <>
          {o.attention.total > 0 && (
            <button onClick={() => goTab("attention")} className="w-full flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm text-left">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span><b>{o.attention.total}</b> order(s) need attention — Shopify sync {o.attention.shopifySync}, review {o.attention.review},
                refunds to approve {o.attention.refundApproval}, refund problems {o.attention.refundProblem}, stuck payments {o.attention.stuckPayments}</span>
            </button>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Orders placed" value={o.orders.placed} hint={`${o.orders.prepaid} prepaid · ${o.orders.cod} COD · ${o.orders.cancelled} cancelled`} />
            <Stat label="Gross revenue" value={inr(o.revenue.gross)} hint={`Refunded ${inr(o.revenue.refunded)}`} />
            <Stat label="Net revenue" value={inr(o.revenue.net)} hint={`Avg order ${inr(o.revenue.averageOrder)}`} />
            <Stat label="Checkouts" value={o.checkouts.started} hint={`${o.checkouts.abandoned} abandoned / failed`} />
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            <Card
              className="lg:col-span-2"
              title="Revenue per day"
              action={<button onClick={() => setShowTable((s) => !s)} className="text-xs text-blue-600 hover:underline">{showTable ? "Show chart" : "Show as table"}</button>}
            >
              {showTable ? (
                <Table
                  columns={[
                    { key: "date", label: "Day", render: (r) => day(r.date) },
                    { key: "orders", label: "Orders", align: "right" },
                    { key: "revenue", label: "Revenue", align: "right", render: (r) => inr(r.revenue) },
                  ]}
                  rows={o.daily}
                />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={o.daily.map((d) => ({ ...d, value: d.revenue.rupees }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                      <CartesianGrid vertical={false} stroke="#eef0f3" />
                      <XAxis dataKey="date" tickFormatter={(d) => day(d).slice(0, 6)} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={48} />
                      <Tooltip content={<RevenueTooltip />} cursor={{ fill: "#f1f5f9" }} />
                      <Bar dataKey="value" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
            <Card title="Funnel (shoppers)"><Funnel funnel={o.funnel} /></Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <Card title="Top products">
              <Table
                columns={[
                  { key: "title", label: "Product" },
                  { key: "units", label: "Units", align: "right" },
                  { key: "revenue", label: "Revenue", align: "right", render: (r) => inr(r.revenue) },
                ]}
                rows={o.topProducts}
                empty="No sales in this period"
              />
            </Card>
            <Card title="Placed orders by status">
              {Object.keys(o.orders.byStatus).length === 0 ? <Empty>No orders in this period</Empty> : (
                <div className="space-y-2">
                  {Object.entries(o.orders.byStatus).map(([s, n]) => (
                    <div key={s} className="flex items-center justify-between text-sm">
                      <StatusChip status={s} /><span className="tabular-nums text-slate-900">{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ── Orders ─────────────────────────────────────────────────────────────────

function OrdersTab() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ status: "", paymentMethod: "", q: "", page: 1 });
  const [q, setQ] = useState("");
  const { data, loading } = useLoad(
    () => shopAdminService.orders({ ...filters, status: filters.status || undefined, paymentMethod: filters.paymentMethod || undefined, q: filters.q || undefined, limit: 25 }),
    [filters]
  );
  const set = (patch) => setFilters((f) => ({ ...f, ...patch, page: patch.page || 1 }));

  return (
    <Card>
      <div className="flex flex-wrap gap-2 mb-3">
        <select value={filters.status} onChange={(e) => set({ status: e.target.value })} className={`${inputClass} w-auto`}>
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <select value={filters.paymentMethod} onChange={(e) => set({ paymentMethod: e.target.value })} className={`${inputClass} w-auto`}>
          <option value="">Prepaid + COD</option>
          <option value="prepaid">Prepaid</option>
          <option value="cod">COD</option>
        </select>
        <form onSubmit={(e) => { e.preventDefault(); set({ q }); }} className="flex gap-2 flex-1 min-w-[240px]">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order id, phone, email, name, #TAKE…" className={inputClass} />
          <Button type="submit" variant="secondary"><Search className="w-4 h-4" /></Button>
        </form>
      </div>
      {loading && !data ? <Spinner /> : data && (
        <>
          <Table
            onRowClick={(r) => navigate(`/admin/shop/orders/${r.orderId}`)}
            columns={[
              { key: "orderId", label: "Order", render: (r) => <div><div className="font-medium text-slate-900">{r.orderId}</div><div className="text-xs text-slate-500">{r.shopifyOrderName || "—"}</div></div> },
              { key: "customer", label: "Customer", render: (r) => <div><div className="text-slate-900">{r.customer.name || "—"}</div><div className="text-xs text-slate-500">{r.customer.email || r.customer.phone || ""}</div></div> },
              { key: "items", label: "Items", render: (r) => <span className="text-slate-700">{r.firstItem}{r.itemCount > 1 ? ` · ${r.itemCount} units` : ""}</span> },
              { key: "total", label: "Total", align: "right", render: (r) => inr(r.total) },
              { key: "pm", label: "Pay", render: (r) => <span className="uppercase text-xs text-slate-600">{r.paymentMethod || "—"}</span> },
              { key: "status", label: "Status", render: (r) => <div className="space-y-1"><StatusChip status={r.status} /><Flags flags={r.flags} /></div> },
              { key: "createdAt", label: "Created", render: (r) => <span className="text-slate-600 whitespace-nowrap">{when(r.createdAt)}</span> },
            ]}
            rows={data.items.map((r) => ({ ...r, _key: r.orderId }))}
            empty="No orders match"
          />
          <Pager page={data.page} totalPages={data.totalPages} total={data.total} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
        </>
      )}
    </Card>
  );
}

// ── Attention ──────────────────────────────────────────────────────────────

function AttentionTab() {
  const navigate = useNavigate();
  const { data, loading, reload } = useLoad(() => shopAdminService.attention(), []);
  const [busy, setBusy] = useState(null);

  const act = async (key, fn, ok) => {
    setBusy(key);
    try { await fn(); toast.success(ok); reload(); } catch (err) { toast.error(apiError(err)); } finally { setBusy(null); }
  };

  const section = (title, hint, rows, extra) => (
    <Card title={`${title} (${rows.length})`}>
      <p className="text-xs text-slate-500 -mt-1 mb-2">{hint}</p>
      <Table
        onRowClick={(r) => navigate(`/admin/shop/orders/${r.orderId}`)}
        columns={[
          { key: "orderId", label: "Order", render: (r) => <span className="font-medium text-slate-900">{r.orderId}</span> },
          { key: "customer", label: "Customer", render: (r) => r.customer.name || r.customer.email || "—" },
          { key: "total", label: "Total", align: "right", render: (r) => inr(r.total) },
          { key: "status", label: "Status", render: (r) => <StatusChip status={r.status} /> },
          ...(extra || []),
        ]}
        rows={rows.map((r) => ({ ...r, _key: r.orderId }))}
        empty="All clear"
      />
    </Card>
  );

  if (loading && !data) return <Spinner />;
  if (!data) return null;
  return (
    <div className="space-y-5">
      {section("Refunds waiting for approval", "Customer / store cancellations. Approve to send the money back through Fastrr.", data.refundApproval, [
        {
          key: "act", label: "", render: (r) => r.refunds.filter((x) => x.status === "requested").map((x) => (
            <Button key={x.refundId} disabled={busy === x.refundId} onClick={(e) => { e.stopPropagation(); act(x.refundId, () => shopAdminService.approveRefund(r.orderId, x.refundId), "Refund sent to Fastrr"); }}>
              Approve {inr(x.amount)}
            </Button>
          )),
        },
      ])}
      {section("Shopify order not created", "Paid but the warehouse doesn't have it yet. Fix the cause (token, product), then retry.", data.shopifySync, [
        { key: "err", label: "Error", render: (r) => <span className="text-xs text-red-700">{r.shopifySyncError || "—"}</span> },
        {
          key: "act", label: "", render: (r) => r.reviewReasons.length ? <span className="text-xs text-slate-500">Resolve review first</span> : (
            <Button variant="secondary" disabled={busy === r.orderId} onClick={(e) => { e.stopPropagation(); act(r.orderId, () => shopAdminService.retrySync(r.orderId), "Sent to Shopify"); }}>Retry</Button>
          ),
        },
      ])}
      {section("Needs review", "Amount / items didn't match, or a customer paid twice. Open the order, check, then resolve.", data.review, [
        { key: "why", label: "Why", render: (r) => <span className="text-xs text-slate-700">{r.reviewReasons.join(", ")}</span> },
      ])}
      {section("Refund problems", "Fastrr refused (retry) or the result is unknown (check the Fastrr dashboard before doing anything).", data.refundProblem, [
        { key: "rf", label: "Refund", render: (r) => r.refunds.filter((x) => x.status !== "requested").map((x) => <div key={x.refundId} className="text-xs"><StatusChip status={x.status} /> {inr(x.amount)} <span className="text-red-700">{x.error}</span></div>) },
      ])}
      {section("Payments pending over 1 hour", "Usually abandoned. The 10-minute check expires them automatically; listed in case Fastrr is slow.", data.stuckPayments)}
    </div>
  );
}

// ── Products ───────────────────────────────────────────────────────────────

function ProductsTab() {
  const { data, loading, reload } = useLoad(() => shopAdminService.products(), []);
  const [syncing, setSyncing] = useState(false);
  const sync = async () => {
    setSyncing(true);
    try {
      const { data: r } = await shopAdminService.syncCatalog();
      toast.success(`Synced ${r.stats.products} products, ${r.stats.collections} collections`);
      reload();
    } catch (err) {
      toast.error(apiError(err, "Catalog sync failed"));
    } finally {
      setSyncing(false);
    }
  };
  return (
    <Card title="Catalog (synced from Shopify)" action={<Button variant="secondary" onClick={sync} disabled={syncing}><RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> Sync now</Button>}>
      {loading && !data ? <Spinner /> : !data?.items.length ? <Empty>No products — run Sync now</Empty> : (
        <div className="space-y-5">
          {data.items.map((p) => (
            <div key={p.id}>
              <div className="flex items-center gap-3 mb-2">
                {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-100" /> : <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center"><ShoppingBag className="w-4 h-4 text-slate-400" /></div>}
                <div>
                  <div className="font-medium text-slate-900">
                    {p.title}
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${p.status === "active" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>{p.status}</span>
                  </div>
                  <div className="text-xs text-slate-500">{p.collections.join(", ") || "no collection"} · synced {when(p.lastSyncedAt)}</div>
                </div>
              </div>
              <Table
                columns={[
                  { key: "title", label: "Variant", render: (v) => <span>{v.title}{v.hiddenInApp && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">hidden in app</span>}</span> },
                  { key: "sku", label: "SKU", render: (v) => <span className="text-xs text-slate-500">{v.sku || "—"}</span> },
                  { key: "price", label: "Price", align: "right", render: (v) => inr(v.price) },
                  { key: "stock", label: "Stock", align: "right", render: (v) => (v.stock === null ? "not tracked" : v.stock) },
                  { key: "held", label: "Held now", align: "right" },
                  { key: "sold", label: "Sold (30d)", align: "right", render: (v) => v.soldLast30Days },
                  { key: "w", label: "Weight", align: "right", render: (v) => (v.weightGrams ? `${v.weightGrams} g` : <span className="text-red-700">0 g</span>) },
                ]}
                rows={p.variants.map((v) => ({ ...v, _key: v.id }))}
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Carts ──────────────────────────────────────────────────────────────────

function CartsTab() {
  const navigate = useNavigate();
  const [abandoned, setAbandoned] = useState(false);
  const [page, setPage] = useState(1);
  const { data, loading } = useLoad(() => shopAdminService.carts({ abandoned: abandoned ? "true" : undefined, page, limit: 25 }), [abandoned, page]);
  return (
    <Card title="Carts" action={
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={abandoned} onChange={(e) => { setAbandoned(e.target.checked); setPage(1); }} /> Only abandoned (&gt; 1 hour)
      </label>
    }>
      {loading && !data ? <Spinner /> : data && (
        <>
          <Table
            onRowClick={(r) => navigate(`/admin/shop/customers/${r.user.id}`)}
            columns={[
              { key: "user", label: "Shopper", render: (r) => <div><div className="text-slate-900">{r.user.name || "—"}</div><div className="text-xs text-slate-500">{r.user.email || r.user.phone || ""}</div></div> },
              { key: "items", label: "In cart", render: (r) => r.items.map((i, k) => <div key={k} className="text-xs text-slate-700">{i.quantity} × {i.title} {i.variantTitle && i.variantTitle !== "Default Title" ? `(${i.variantTitle})` : ""}{i.issue && <span className="text-red-700"> · {i.issue}</span>}</div>) },
              { key: "value", label: "Value", align: "right", render: (r) => inr(r.value) },
              { key: "updatedAt", label: "Last change", render: (r) => <span className="whitespace-nowrap text-slate-600">{when(r.updatedAt)}{r.abandoned && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">abandoned</span>}</span> },
            ]}
            rows={data.items.map((r) => ({ ...r, _key: r.user.id }))}
            empty="No carts"
          />
          <Pager page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />
        </>
      )}
    </Card>
  );
}

// ── Customers ──────────────────────────────────────────────────────────────

function CustomersTab() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const { data, loading } = useLoad(() => shopAdminService.customers(query || undefined), [query]);
  return (
    <Card title={query ? `Customers matching “${query}”` : "Recently active shoppers"}>
      <form onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }} className="flex gap-2 mb-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or phone" className={inputClass} />
        <Button type="submit" variant="secondary"><Search className="w-4 h-4" /></Button>
      </form>
      {loading && !data ? <Spinner /> : data && (
        <Table
          onRowClick={(r) => navigate(`/admin/shop/customers/${r.id}`)}
          columns={[
            { key: "name", label: "Customer", render: (r) => <div><div className="text-slate-900">{r.name || "—"}</div><div className="text-xs text-slate-500">{r.email || ""} {r.phone ? `· ${r.phone}` : ""}</div></div> },
            { key: "orders", label: "Orders", align: "right" },
            { key: "spent", label: "Spent", align: "right", render: (r) => inr(r.spent) },
            { key: "ab", label: "Abandoned", align: "right", render: (r) => r.abandonedCheckouts },
            { key: "cart", label: "In cart", align: "right", render: (r) => r.cartItems },
            { key: "last", label: "Last active", render: (r) => <span className="whitespace-nowrap text-slate-600">{when(r.lastActivityAt)}</span> },
          ]}
          rows={data.items.map((r) => ({ ...r, _key: r.id }))}
          empty="No shoppers found"
        />
      )}
    </Card>
  );
}

// ── Refunds ────────────────────────────────────────────────────────────────

function RefundsTab() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const { data, loading } = useLoad(() => shopAdminService.refunds(status || undefined), [status]);
  return (
    <Card title="Refunds" action={
      <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} w-auto py-1.5`}>
        <option value="">All</option>
        {["requested", "initiated", "processing", "completed", "failed", "unknown"].map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    }>
      {loading && !data ? <Spinner /> : data && (
        <Table
          onRowClick={(r) => navigate(`/admin/shop/orders/${r.orderId}`)}
          columns={[
            { key: "refundId", label: "Refund", render: (r) => <div><div className="font-medium text-slate-900">{r.refundId}</div><div className="text-xs text-slate-500">{r.orderId}</div></div> },
            { key: "customer", label: "Customer", render: (r) => r.customer.name || r.customer.email || "—" },
            { key: "amount", label: "Amount", align: "right", render: (r) => inr(r.amount) },
            { key: "source", label: "Why", render: (r) => <span className="text-xs text-slate-700">{r.source?.replace(/_/g, " ")}{r.kind === "duplicate_payment" ? " (2nd payment)" : ""}</span> },
            { key: "status", label: "Status", render: (r) => <div><StatusChip status={r.status} />{r.error && <div className="text-xs text-red-700 mt-1">{r.error}</div>}</div> },
            { key: "method", label: "Method", render: (r) => <span className="text-xs text-slate-600">{r.method}{r.reference ? ` · ${r.reference}` : ""}</span> },
            { key: "createdAt", label: "Requested", render: (r) => <span className="whitespace-nowrap text-slate-600">{when(r.createdAt)}</span> },
          ]}
          rows={data.items.map((r) => ({ ...r, _key: r.refundId }))}
          empty="No refunds"
        />
      )}
    </Card>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminShop() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "overview";
  const goTab = (id) => setParams({ tab: id });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      <SEO title="Shop | Admin" />
      <div>
        <h1 className="text-xl font-bold text-slate-900">Shop</h1>
        <p className="text-sm text-slate-500 mt-1">In-app shop: orders, refunds, catalog, carts and shoppers.</p>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => goTab(t.id)}
            className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === t.id ? "border-blue-600 text-blue-700 font-medium" : "border-transparent text-slate-600 hover:text-slate-900"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "overview" && <OverviewTab goTab={goTab} />}
      {tab === "orders" && <OrdersTab />}
      {tab === "attention" && <AttentionTab />}
      {tab === "products" && <ProductsTab />}
      {tab === "carts" && <CartsTab />}
      {tab === "customers" && <CustomersTab />}
      {tab === "refunds" && <RefundsTab />}
    </div>
  );
}
