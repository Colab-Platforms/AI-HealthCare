import { useMemo, useState } from "react";
import { History, ChevronLeft, ChevronRight } from "lucide-react";
import SEO from "../../hooks/useSEO";
import { adminV1Service } from "../../services/api";
import { EmptyState, Skeleton } from "../../components/admin/AdminUI";
import { useApi } from "../../components/admin/useApi";
import { Page, PageHeader, ErrorState } from "../../components/admin/TakeAdminKit";

const RESULT = {
  success: "bg-tk-teal-soft text-tk-teal",
  pending: "bg-tk-warn/20 text-amber-700",
  failed: "bg-tk-error/10 text-tk-error",
  blocked: "bg-tk-error/10 text-tk-error",
};

const field =
  "h-10 px-3 bg-white border border-tk-line rounded-xl text-sm font-medium text-tk-ink focus:outline-none focus:border-tk-blue focus:ring-4 focus:ring-tk-blue/10 transition-all";

const when = (d) => new Date(d).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function MyActivity() {
  const [module, setModule] = useState("");
  const [result, setResult] = useState("");
  const [page, setPage] = useState(1);
  const params = useMemo(() => ({ module: module || undefined, result: result || undefined, page, limit: 20 }), [module, result, page]);
  const { data, loading, error, reload } = useApi(() => adminV1Service.auditLogs(params), [params]);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <Page>
      <SEO pageName="myActivity" />
      <PageHeader
        icon={History}
        title="My Activity"
        subtitle="Everything you did in the admin panel, saved permanently"
        actions={
          <>
            <select aria-label="Filter by module" value={module} onChange={(e) => { setModule(e.target.value); setPage(1); }} className={field}>
              <option value="">All modules</option>
              {["food_database", "health_profiles", "users", "user_analytics", "regional"].map((m) => (
                <option key={m} value={m}>{m.replace(/_/g, " ")}</option>
              ))}
            </select>
            <select aria-label="Filter by result" value={result} onChange={(e) => { setResult(e.target.value); setPage(1); }} className={field}>
              <option value="">Any result</option>
              {["success", "pending", "failed", "blocked"].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </>
        }
      />

      <div className="bg-white rounded-3xl border border-tk-line overflow-hidden">
        {loading && !data ? (
          <div className="p-5 space-y-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
        ) : error ? (
          <div className="p-6"><ErrorState message={error} onRetry={reload} /></div>
        ) : data.items.length === 0 ? (
          <div className="py-16"><EmptyState title="No activity yet" hint="Views, requests and decisions you make will be listed here." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[780px]">
              <thead>
                <tr className="bg-tk-bg border-b border-tk-line">
                  {["When", "Action", "Module", "Reason", "Result"].map((h) => (
                    <th key={h} scope="col" className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-tk-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a._id} className="border-b border-tk-line last:border-0">
                    <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">{when(a.at)}</td>
                    <td className="px-6 py-3 text-sm font-bold text-tk-ink">{a.action}</td>
                    <td className="px-6 py-3 text-sm font-semibold text-slate-700 capitalize">{(a.module || "–").replace(/_/g, " ")}</td>
                    <td className="px-6 py-3 text-sm text-slate-600 max-w-[320px] truncate" title={a.reason}>{a.reason || "–"}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold capitalize ${RESULT[a.result] || "bg-slate-100 text-slate-600"}`}>{a.result}</span>
                    </td>
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
      </div>
    </Page>
  );
}
