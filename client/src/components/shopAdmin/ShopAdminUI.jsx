// Shared building blocks for the shop admin pages (same look as the other admin pages:
// white cards, slate text, blue actions).
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export const inr = (money) => {
  if (!money || money.rupees === null || money.rupees === undefined) return "—";
  return `₹${Number(money.rupees).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

export const when = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
export const day = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

export const apiError = (err, fallback = "Something went wrong") =>
  err?.response?.data?.message || err?.message || fallback;

// Order status chip — text label always present (never colour alone).
const STATUS_STYLE = {
  awaiting_payment: "bg-slate-100 text-slate-700",
  payment_failed: "bg-red-50 text-red-700",
  expired: "bg-slate-100 text-slate-500",
  confirmed: "bg-blue-50 text-blue-700",
  shipped: "bg-amber-50 text-amber-800",
  delivered: "bg-green-50 text-green-700",
  returned: "bg-slate-100 text-slate-700",
  cancelled: "bg-red-50 text-red-700",
  refund_initiated: "bg-violet-50 text-violet-700",
  partially_refunded: "bg-violet-50 text-violet-700",
  refunded: "bg-violet-50 text-violet-700",
  // refund / sync statuses
  requested: "bg-amber-50 text-amber-800",
  initiating: "bg-blue-50 text-blue-700",
  initiated: "bg-blue-50 text-blue-700",
  processing: "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
  unknown: "bg-red-50 text-red-700",
  synced: "bg-green-50 text-green-700",
  pending: "bg-slate-100 text-slate-700",
  not_started: "bg-slate-100 text-slate-500",
  needs_attention: "bg-red-50 text-red-700",
};

export const StatusChip = ({ status }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_STYLE[status] || "bg-slate-100 text-slate-700"}`}>
    {String(status || "—").replace(/_/g, " ")}
  </span>
);

const FLAG_LABEL = {
  review: "Needs review",
  shopify_sync: "Shopify sync",
  refund_approval: "Refund approval",
  refund_problem: "Refund problem",
};
export const Flags = ({ flags = [] }) => (
  <div className="flex flex-wrap gap-1">
    {flags.map((f) => (
      <span key={f} className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-[11px] font-medium">⚠ {FLAG_LABEL[f] || f}</span>
    ))}
  </div>
);

export const Card = ({ title, action, children, className = "" }) => (
  <div className={`bg-white rounded-xl border border-slate-200 ${className}`}>
    {(title || action) && (
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
    )}
    <div className="p-4">{children}</div>
  </div>
);

// Hero number tile (not a chart).
export const Stat = ({ label, value, hint }) => (
  <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
    <div className="text-xs font-medium text-slate-500">{label}</div>
    <div className="text-2xl font-semibold text-slate-900 mt-1 tabular-nums">{value}</div>
    {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
  </div>
);

export const Spinner = () => (
  <div className="flex items-center justify-center py-16">
    <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
  </div>
);

export const Empty = ({ children }) => <div className="text-center text-sm text-slate-500 py-10">{children}</div>;

export const Table = ({ columns, rows, onRowClick, empty = "Nothing here yet" }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
          {columns.map((c) => (
            <th key={c.key} className={`py-2 px-3 font-medium whitespace-nowrap ${c.align === "right" ? "text-right" : ""}`}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={columns.length}><Empty>{empty}</Empty></td></tr>
        ) : rows.map((r, i) => (
          <tr
            key={r._key || i}
            onClick={onRowClick ? () => onRowClick(r) : undefined}
            className={`border-b border-slate-50 last:border-0 ${onRowClick ? "cursor-pointer hover:bg-slate-50" : ""}`}
          >
            {columns.map((c) => (
              <td key={c.key} className={`py-2.5 px-3 align-top ${c.align === "right" ? "text-right tabular-nums" : ""}`}>
                {c.render ? c.render(r) : r[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const Pager = ({ page, totalPages, total, onPage }) => (
  <div className="flex items-center justify-between pt-3 text-sm text-slate-600">
    <span>{total} total</span>
    <div className="flex items-center gap-2">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40" aria-label="Previous page">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="tabular-nums">{page} / {totalPages}</span>
      <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40" aria-label="Next page">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  </div>
);

export const Button = ({ children, variant = "primary", className = "", ...props }) => {
  const styles = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    secondary: "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700",
    danger: "bg-red-600 hover:bg-red-700 text-white",
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 text-sm font-medium rounded-lg px-3 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

// Small modal used for confirmations / forms.
export const Modal = ({ open, title, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">{children}</div>
      </div>
    </div>
  );
};

export const inputClass = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
