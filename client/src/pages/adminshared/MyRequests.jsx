import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ClipboardList, Plus, X, Ban, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import SEO from "../../hooks/useSEO";
import { adminV1Service } from "../../services/api";
import { EmptyState, Skeleton } from "../../components/admin/AdminUI";
import { EASE, riseIn } from "../../components/admin/adminTheme";
import { useApi } from "../../components/admin/useApi";
import { Page, PageHeader, ErrorState } from "../../components/admin/TakeAdminKit";

const TABS = [
  { v: "", l: "All" },
  { v: "pending_approval", l: "Pending" },
  { v: "changes_requested", l: "Changes requested" },
  { v: "executed", l: "Executed" },
  { v: "rejected", l: "Rejected" },
  { v: "cancelled", l: "Cancelled" },
];

const STATUS = {
  draft: ["bg-slate-100 text-slate-600", "Draft"],
  pending_approval: ["bg-tk-warn/20 text-amber-700", "Pending approval"],
  under_review: ["bg-tk-info/15 text-sky-700", "Under review"],
  changes_requested: ["bg-tk-blue/10 text-tk-blue", "Changes requested"],
  approved: ["bg-tk-teal-soft text-tk-teal", "Approved"],
  rejected: ["bg-tk-error/10 text-tk-error", "Rejected"],
  executed: ["bg-tk-teal-soft text-tk-teal", "Executed"],
  execution_failed: ["bg-tk-error/10 text-tk-error", "Execution failed"],
  cancelled: ["bg-slate-100 text-slate-600", "Cancelled"],
};

const Pill = ({ status }) => {
  const [cls, label] = STATUS[status] || STATUS.draft;
  return <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${cls}`}>{label}</span>;
};

const when = (d) => (d ? new Date(d).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "–");
const moduleLabel = (m) => String(m).replace(/_/g, " ");
const field =
  "w-full h-11 px-3.5 bg-white border border-tk-line rounded-xl text-sm font-medium text-tk-ink placeholder:text-slate-400 " +
  "focus:outline-none focus:border-tk-blue focus:ring-4 focus:ring-tk-blue/10 transition-all";

function NewFoodRequest({ onClose, onCreated }) {
  const reduce = useReducedMotion();
  const [f, setF] = useState({ foodName: "", quantity: "", calories: "", protein: "", carbs: "", fats: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const num = (v) => (v === "" ? undefined : Number(v));

  const submit = async (e) => {
    e.preventDefault();
    if (!f.foodName.trim()) return toast.error("Food name is required");
    if (f.reason.trim().length < 10) return toast.error("Reason must be at least 10 characters");
    setBusy(true);
    try {
      await adminV1Service.createRequest({
        module: "food_database",
        action: "create",
        newValue: {
          foodName: f.foodName.trim(),
          quantity: f.quantity.trim() || undefined,
          calories: num(f.calories),
          protein: num(f.protein),
          carbs: num(f.carbs),
          fats: num(f.fats),
        },
        reason: f.reason.trim(),
      });
      toast.success("Request sent for Super Admin approval");
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not send request");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[90] bg-tk-ink/40 backdrop-blur-[2px]" />
      <motion.form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label="New food request"
        initial={reduce ? { opacity: 0 } : { x: "100%" }}
        animate={reduce ? { opacity: 1 } : { x: 0 }}
        exit={reduce ? { opacity: 0 } : { x: "100%" }}
        transition={{ duration: 0.3, ease: EASE }}
        className="fixed inset-y-0 right-0 z-[100] w-full max-w-[520px] bg-white shadow-2xl flex flex-col"
      >
        <div className="shrink-0 px-6 py-5 bg-tk-blue text-white flex items-start justify-between">
          <div>
            <h3 className="text-lg font-extrabold">New food request</h3>
            <p className="text-xs text-white/75 mt-0.5">Goes to a Super Admin for approval. The food database does not change until approved.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 grid place-items-center rounded-xl hover:bg-white/15 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-tk-muted">Food name *</span>
            <input className={field + " mt-1.5"} value={f.foodName} onChange={set("foodName")} placeholder="e.g. Bajra Rotla" />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-tk-muted">Serving size</span>
            <input className={field + " mt-1.5"} value={f.quantity} onChange={set("quantity")} placeholder="e.g. 1 piece (60 g)" />
          </label>
          <div className="grid grid-cols-2 gap-4">
            {[
              ["calories", "Calories (kcal)"],
              ["protein", "Protein (g)"],
              ["carbs", "Carbs (g)"],
              ["fats", "Fat (g)"],
            ].map(([k, l]) => (
              <label key={k} className="block">
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-tk-muted">{l}</span>
                <input className={field + " mt-1.5"} type="number" min="0" step="any" value={f[k]} onChange={set(k)} />
              </label>
            ))}
          </div>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-tk-muted">Reason and data source *</span>
            <textarea className={field + " mt-1.5 !h-28 py-3 resize-none"} value={f.reason} onChange={set("reason")} placeholder="Why add this? Include the source (e.g. IFCT 2017) and the state or cuisine." />
            <span className="text-xs text-tk-muted">{f.reason.trim().length}/10 characters minimum</span>
          </label>
          <p className="text-xs text-tk-muted">State, cuisine, diet type and allergen fields are not part of the food record yet, so mention them in the reason.</p>
        </div>

        <div className="shrink-0 p-5 border-t border-tk-line">
          <button disabled={busy} className="w-full h-12 rounded-xl bg-tk-blue text-white font-bold text-sm hover:bg-tk-action transition-colors disabled:opacity-50">
            {busy ? "Sending…" : "Send for approval"}
          </button>
        </div>
      </motion.form>
    </>
  );
}

function Detail({ id, onClose, onChanged }) {
  const reduce = useReducedMotion();
  const { data: r, loading } = useApi(() => adminV1Service.getRequest(id), [id]);
  const cancellable = r && ["pending_approval", "changes_requested", "draft"].includes(r.status);

  const cancel = async () => {
    try {
      await adminV1Service.cancelRequest(id);
      toast.success("Request cancelled");
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not cancel");
    }
  };

  const json = (v) => (v == null ? "–" : JSON.stringify(v, null, 2));

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[90] bg-tk-ink/40 backdrop-blur-[2px]" />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label="Request details"
        initial={reduce ? { opacity: 0 } : { x: "100%" }}
        animate={reduce ? { opacity: 1 } : { x: 0 }}
        exit={reduce ? { opacity: 0 } : { x: "100%" }}
        transition={{ duration: 0.3, ease: EASE }}
        className="fixed inset-y-0 right-0 z-[100] w-full max-w-[560px] bg-white shadow-2xl flex flex-col"
      >
        <div className="shrink-0 px-6 py-5 border-b border-tk-line flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-tk-ink">Request details</h3>
          <button onClick={onClose} aria-label="Close" className="w-10 h-10 grid place-items-center rounded-xl text-tk-muted hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading || !r ? (
            <Skeleton className="h-48 rounded-2xl" />
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <Pill status={r.status} />
                <span className="px-2.5 py-1 rounded-full bg-tk-blue/10 text-tk-blue text-[11px] font-bold capitalize">{moduleLabel(r.module)} · {r.action}</span>
                {r.highRisk && <span className="px-2.5 py-1 rounded-full bg-tk-error/10 text-tk-error text-[11px] font-bold">High risk</span>}
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-tk-muted mb-1">Reason</p>
                <p className="text-sm text-tk-ink">{r.reason}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[["Old value", r.oldValue], ["Proposed value", r.newValue]].map(([t, v]) => (
                  <div key={t}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-tk-muted mb-1.5">{t}</p>
                    <pre className="text-xs bg-tk-bg border border-tk-line rounded-xl p-3 overflow-auto max-h-56 whitespace-pre-wrap break-words">{json(v)}</pre>
                  </div>
                ))}
              </div>
              {r.decisionReason && (
                <div className="p-4 rounded-2xl bg-tk-bg border border-tk-line">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-tk-muted mb-1">Decision comment</p>
                  <p className="text-sm text-tk-ink">{r.decisionReason}</p>
                </div>
              )}
              {r.executionError && (
                <div className="p-4 rounded-2xl bg-tk-error/10 border border-tk-error/20 text-sm text-tk-error font-semibold">Execution failed: {r.executionError}</div>
              )}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-tk-muted mb-3">History</p>
                <ol className="relative border-l-2 border-tk-line ml-2 space-y-4">
                  {(r.history || []).map((h, i) => (
                    <li key={i} className="pl-5 relative">
                      <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-tk-blue ring-4 ring-white" />
                      <p className="text-sm font-bold text-tk-ink">{(STATUS[h.toStatus] || [0, h.toStatus])[1]}</p>
                      <p className="text-xs text-tk-muted">{h.byRole} · {when(h.at)}</p>
                      {h.comment && <p className="text-sm text-slate-600 mt-0.5">{h.comment}</p>}
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
        </div>
        {cancellable && (
          <div className="shrink-0 p-5 border-t border-tk-line">
            <button onClick={cancel} className="w-full h-12 rounded-xl border border-tk-error/30 text-tk-error font-bold text-sm flex items-center justify-center gap-2 hover:bg-tk-error/5 transition-colors">
              <Ban className="w-4 h-4" /> Cancel this request
            </button>
          </div>
        )}
      </motion.aside>
    </>
  );
}

export default function MyRequests({ canCreateFood = true }) {
  const reduce = useReducedMotion();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);
  const params = useMemo(() => ({ status: status || undefined, page, limit: 15 }), [status, page]);
  const { data, loading, error, reload } = useApi(() => adminV1Service.listRequests(params), [params]);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <Page>
      <SEO pageName="myRequests" />
      <PageHeader
        icon={ClipboardList}
        title="My Requests"
        subtitle="Changes you asked for, and where they are in approval"
        actions={
          canCreateFood && (
            <button onClick={() => setCreating(true)} className="h-11 px-4 rounded-xl bg-tk-blue text-white text-sm font-bold flex items-center gap-2 hover:bg-tk-action transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-tk-blue/30">
              <Plus className="w-4 h-4" /> New food request
            </button>
          )
        }
      />

      <motion.div variants={riseIn} role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-1.5 p-1.5 bg-white border border-tk-line rounded-2xl w-fit">
        {TABS.map((t) => {
          const active = status === t.v;
          return (
            <button key={t.v || "all"} role="tab" aria-selected={active} onClick={() => { setStatus(t.v); setPage(1); }} className={`relative px-4 h-9 rounded-xl text-[13px] font-semibold transition-colors ${active ? "text-white" : "text-tk-muted hover:text-tk-ink"}`}>
              {active && <motion.span layoutId="req-tab" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-xl bg-tk-blue" />}
              <span className="relative">{t.l}</span>
            </button>
          );
        })}
      </motion.div>

      <motion.div variants={riseIn} className="bg-white rounded-3xl border border-tk-line overflow-hidden">
        {loading && !data ? (
          <div className="p-5 space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        ) : error ? (
          <div className="p-6"><ErrorState message={error} onRetry={reload} /></div>
        ) : data.items.length === 0 ? (
          <div className="py-16"><EmptyState title="No requests here" hint="Requests you send for approval will appear in this list." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[720px]">
              <thead>
                <tr className="bg-tk-bg border-b border-tk-line">
                  {["Module", "Action", "Priority", "Status", "Submitted"].map((h) => (
                    <th key={h} scope="col" className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-tk-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r._id} onClick={() => setOpenId(r._id)} className="border-b border-tk-line last:border-0 hover:bg-tk-blue/[0.03] cursor-pointer transition-colors">
                    <td className="px-6 py-3.5 text-sm font-bold text-tk-ink capitalize">{moduleLabel(r.module)}</td>
                    <td className="px-6 py-3.5 text-sm font-semibold text-slate-700 capitalize">{r.action}</td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold capitalize ${r.priority === "high" ? "bg-tk-error/10 text-tk-error" : "bg-slate-100 text-slate-600"}`}>{r.priority}</span>
                    </td>
                    <td className="px-6 py-3.5"><Pill status={r.status} /></td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{when(r.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > data.limit && (
          <div className="px-6 py-4 border-t border-tk-line flex items-center justify-between">
            <p className="text-sm font-semibold text-tk-muted">Page {page} of {pages}</p>
            <div className="flex gap-2">
              {[[ChevronLeft, page === 1, () => setPage((p) => p - 1), "Previous page"], [ChevronRight, page >= pages, () => setPage((p) => p + 1), "Next page"]].map(([Icon, dis, go, label]) => (
                <button key={label} disabled={dis} onClick={go} aria-label={label} className="w-9 h-9 rounded-xl border border-tk-line grid place-items-center text-tk-muted disabled:opacity-30 hover:bg-tk-blue hover:border-tk-blue hover:text-white transition-colors">
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {creating && <NewFoodRequest key="new" onClose={() => setCreating(false)} onCreated={() => { setCreating(false); setStatus(""); setPage(1); reload(); }} />}
        {openId && <Detail key="detail" id={openId} onClose={() => setOpenId(null)} onChanged={() => { setOpenId(null); reload(); }} />}
      </AnimatePresence>
    </Page>
  );
}
