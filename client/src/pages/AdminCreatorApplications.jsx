import { useEffect, useState } from "react";
import { Download, ExternalLink, Users } from "lucide-react";
import { creatorService } from "../services/api";
import toast from "react-hot-toast";
import SEO from "../hooks/useSEO";

const STATUS_STYLES = {
  approved: "bg-emerald-50 text-emerald-600 border-emerald-100",
  rejected: "bg-red-50 text-red-600 border-red-100",
  pending: "bg-amber-50 text-amber-600 border-amber-100",
};

export default function AdminCreatorApplications() {
  const [applications, setApplications] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const { data } = await creatorService.list({
        page,
        limit: 12,
        status: status !== "all" ? status : undefined,
      });
      setApplications(data.data || []);
      setTotal(data.pagination?.total || 0);
      setPages(data.pagination?.pages || 1);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await creatorService.exportExcel(
        status !== "all" ? { status } : {}
      );
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `creator-applications-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (err) {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 w-full max-w-[1600px] mx-auto font-sans">
      <SEO pageName="adminCreatorApplications" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Creator Applications</h1>
          <p className="text-slate-500 text-sm">{total} total applications received</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2.5 bg-white border border-slate-100 rounded-lg text-sm focus:border-blue-500 outline-none shadow-sm transition-all"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2.5 bg-[#4338ca] hover:bg-[#3730a3] text-white rounded-lg transition-all shadow-sm font-bold text-xs uppercase whitespace-nowrap flex items-center gap-2 disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Exporting..." : "Export to Excel"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center h-[400px]">
            <div className="w-8 h-8 border-3 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50">
                <tr className="border-b border-slate-50">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Applicant</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Followers</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Best Video</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Applied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-20 text-center text-slate-400 text-sm font-medium">
                      <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      No creator applications found
                    </td>
                  </tr>
                ) : (
                  applications.map((app) => (
                    <tr key={app._id} className="hover:bg-slate-50/50 transition-all">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                            {app.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{app.name}</p>
                            <p className="text-[10px] text-slate-400 italic lowercase">{app.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-700">{app.phone || "-"}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-700">
                          {app.followerCount?.toLocaleString() ?? "-"}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-700">{app.contentCategory || "-"}</p>
                      </td>
                      <td className="px-6 py-4">
                        {app.bestVideoLink ? (
                          <a
                            href={app.bestVideoLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                            STATUS_STYLES[app.status] || STATUS_STYLES.pending
                          }`}
                        >
                          {app.status || "pending"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[11px] font-bold text-slate-700">
                          {new Date(app.createdAt).toLocaleDateString(undefined, {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-6 py-4 border-t border-slate-50 flex items-center justify-between text-xs">
          <p className="text-slate-400 font-medium">Page {page} of {pages}</p>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg disabled:opacity-30"
            >
              Previous
            </button>
            <button
              disabled={page === pages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
