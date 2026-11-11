import { useState, useEffect, useRef } from 'react';
import { RefreshCcw, Repeat, Clock, Download, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { activityService } from '../services/api';

// Returning users: how many distinct days each user came back in the selected
// range, who the returning ones are, and which features they use most.
// "Retention Rate" on Platform Growth is only DAU ÷ MAU; this is per user.

const FEATURE_NAMES = {
  diagnostics: 'Diagnostics',
  nutrition: 'Nutrition',
  medical: 'Medical',
  fitness: 'Fitness',
  glucose: 'Glucose',
};

const FEATURE_COLORS = {
  diagnostics: 'bg-emerald-600',
  nutrition: 'bg-amber-600',
  medical: 'bg-rose-600',
  fitness: 'bg-purple-600',
  glucose: 'bg-red-600',
};

const MIN_DAYS_OPTIONS = [2, 4, 7, 10];
const PAGE_SIZE = 10;
// Same cap the API enforces.
const MAX_RANGE_DAYS = 90;
const RANGE_PRESETS = [7, 30, 90];

const dateKey = (date) => date.toLocaleDateString('en-CA');
const lastNDays = (days) => ({
  startDate: dateKey(new Date(Date.now() - (days - 1) * 86400000)),
  endDate: dateKey(new Date()),
});
const daysInRange = ({ startDate, endDate }) =>
  Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1;

const featureName = (category) => FEATURE_NAMES[category] || category;

const csvCell = (value) => {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Has its own date range (default: last 30 days) instead of the page filter,
// whose 7-day default is too short to see who comes back.
export default function ReturningUsers() {
  const [range, setRange] = useState(() => lastNDays(30));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [minDays, setMinDays] = useState(4);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  // Only the latest request may set data, so a slow older page can't
  // overwrite a newer one after a quick filter or page change.
  const latestRequest = useRef(0);

  const params = (overrides = {}) => ({
    startDate: range.startDate,
    endDate: range.endDate,
    minDays,
    page,
    limit: PAGE_SIZE,
    ...overrides,
  });

  const fetchData = async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    try {
      const res = await activityService.getReturningUsers(params());
      if (requestId === latestRequest.current && res.data?.success) setData(res.data);
    } catch (e) {
      if (requestId === latestRequest.current) toast.error(e.response?.data?.message || 'Failed to load returning users');
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  };

  // A new range or threshold starts again from page 1.
  useEffect(() => { setPage(1); }, [range.startDate, range.endDate, minDays]);
  useEffect(() => { fetchData(); }, [range.startDate, range.endDate, minDays, page]);

  // Keeps the range valid (start <= end, never past today, max 90 days) by
  // moving the other end, instead of sending a request the API rejects.
  const changeRange = (field, value) => {
    if (!value) return;
    const today = dateKey(new Date());
    const next = { ...range, [field]: value > today ? today : value };
    if (next.startDate > next.endDate) {
      if (field === 'startDate') next.endDate = next.startDate;
      else next.startDate = next.endDate;
    }
    if (daysInRange(next) > MAX_RANGE_DAYS) {
      const shift = (MAX_RANGE_DAYS - 1) * 86400000;
      if (field === 'startDate') next.endDate = dateKey(new Date(new Date(next.startDate).getTime() + shift));
      else next.startDate = dateKey(new Date(new Date(next.endDate).getTime() - shift));
      toast(`Range limited to ${MAX_RANGE_DAYS} days`);
    }
    setRange(next);
  };

  const activePreset = range.endDate === dateKey(new Date())
    ? RANGE_PRESETS.find((d) => daysInRange(range) === d)
    : null;

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = [];
      let current = 1;
      let totalPages = 1;
      do {
        const res = await activityService.getReturningUsers(params({ page: current, limit: 100 }));
        rows.push(...(res.data?.users || []));
        totalPages = res.data?.pagination?.totalPages || 1;
        current += 1;
      } while (current <= totalPages);

      if (rows.length === 0) {
        toast.error('No returning users to export');
        return;
      }
      const header = ['Name', 'Email', 'Days Active', 'Actions', 'Top Features', 'Last Active'];
      const lines = rows.map((u) => [
        u.name,
        u.email || '',
        u.daysActive,
        u.events,
        u.topFeatures.map((f) => `${featureName(f.category)} (${f.events})`).join('; '),
        new Date(u.lastActive).toLocaleDateString(),
      ].map(csvCell).join(','));
      const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `returning-users-${minDays}plus-days-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} returning users`);
    } catch (e) {
      toast.error('Failed to export');
    } finally {
      setExporting(false);
    }
  };

  const maxBucket = Math.max(1, ...(data?.buckets || []).map((b) => b.users));
  const maxFeatureUsers = Math.max(1, ...(data?.featureSummary || []).map((f) => f.users));

  return (
    <div className="bg-white p-9 rounded-[3rem] border border-white shadow-[0_25px_60px_-25px_rgba(0,0,0,0.1)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Returning Users</h3>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">
            Who comes back, how often, and what they use
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {RANGE_PRESETS.map((d) => (
            <button
              key={d}
              onClick={() => setRange(lastNDays(d))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activePreset === d ? 'bg-indigo-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Last {d} days
            </button>
          ))}
          <input
            type="date"
            value={range.startDate}
            max={range.endDate}
            onChange={(e) => changeRange('startDate', e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700"
          />
          <span className="text-xs font-bold text-slate-400">to</span>
          <input
            type="date"
            value={range.endDate}
            min={range.startDate}
            max={dateKey(new Date())}
            onChange={(e) => changeRange('endDate', e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Came back on</span>
          {MIN_DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setMinDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                minDays === d ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {d}+ days
            </button>
          ))}
          <button
            onClick={fetchData}
            disabled={loading}
            title="Refresh"
            className="p-3 bg-slate-100 rounded-2xl hover:text-indigo-600 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCcw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin text-indigo-500' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex flex-col items-center justify-center py-16">
          <RefreshCcw className="w-8 h-8 text-indigo-500 animate-spin mb-3 opacity-50" />
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Loading...</p>
        </div>
      ) : data ? (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="p-5 rounded-2xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Active in range</p>
              <p className="text-2xl font-black text-slate-800 tabular-nums">{data.activeUsers.toLocaleString()}</p>
              <p className="text-[10px] text-slate-400 font-bold">users with any activity</p>
            </div>
            <div className="p-5 rounded-2xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Came back {minDays}+ days</p>
              <p className="text-2xl font-black text-indigo-600 tabular-nums">{data.returningUsers.toLocaleString()}</p>
              <p className="text-[10px] text-slate-400 font-bold">{data.returningPercent}% of active users</p>
            </div>
            <div className="p-5 rounded-2xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Used only once</p>
              <p className="text-2xl font-black text-rose-600 tabular-nums">
                {(data.buckets.find((b) => b.key === '1')?.users || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400 font-bold">active on a single day</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Days-active distribution */}
            <div>
              <p className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4">Days active</p>
              <div className="space-y-3">
                {data.buckets.map((b) => (
                  <div key={b.key} className="flex items-center gap-3">
                    <p className="w-24 text-xs font-bold text-slate-600">{b.label}</p>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(b.users / maxBucket) * 100}%` }}
                        className="h-full bg-indigo-500"
                      />
                    </div>
                    <p className="w-14 text-right text-sm font-black text-slate-800 tabular-nums">{b.users.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* What returning users use */}
            <div>
              <p className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4">
                What they use ({minDays}+ days users)
              </p>
              {data.featureSummary.length === 0 ? (
                <p className="text-sm text-slate-400">No feature activity</p>
              ) : (
                <div className="space-y-3">
                  {data.featureSummary.map((f) => (
                    <div key={f.category} className="flex items-center gap-3">
                      <p className="w-24 text-xs font-bold text-slate-600">{featureName(f.category)}</p>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(f.users / maxFeatureUsers) * 100}%` }}
                          className={`h-full ${FEATURE_COLORS[f.category] || 'bg-slate-400'}`}
                        />
                      </div>
                      <p className="w-32 text-right text-xs text-slate-500">
                        <span className="font-black text-slate-800">{f.users}</span> users · {f.events.toLocaleString()} actions
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Returning users table */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-black text-slate-700 uppercase tracking-widest">
              Returning users ({data.pagination.total})
            </p>
            <button
              onClick={handleExport}
              disabled={exporting || data.pagination.total === 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className={`w-3.5 h-3.5 ${exporting ? 'animate-spin' : ''}`} />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>

          {data.users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No users came back on {minDays}+ days in this range</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-bold text-slate-700 text-xs uppercase tracking-wider">User</th>
                    <th className="text-left py-3 px-4 font-bold text-slate-700 text-xs uppercase tracking-wider">Email</th>
                    <th className="text-right py-3 px-4 font-bold text-slate-700 text-xs uppercase tracking-wider" title="Distinct days with any activity in the range">Days active</th>
                    <th className="text-right py-3 px-4 font-bold text-slate-700 text-xs uppercase tracking-wider" title="Logged or synced actions in the range">Actions</th>
                    <th className="text-left py-3 px-4 font-bold text-slate-700 text-xs uppercase tracking-wider">Uses most</th>
                    <th className="text-right py-3 px-4 font-bold text-slate-700 text-xs uppercase tracking-wider">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr key={u.userId} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-black text-slate-700">{u.name?.[0]?.toUpperCase() || 'U'}</span>
                          </div>
                          <p className="font-semibold text-slate-900 truncate">{u.name}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4"><p className="text-sm text-slate-600 truncate">{u.email || 'N/A'}</p></td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 font-black text-indigo-600">
                          <Repeat className="w-3 h-3" />{u.daysActive}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">{u.events}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {u.topFeatures.length === 0 ? (
                            <span className="text-xs text-slate-400">Login only</span>
                          ) : u.topFeatures.map((f) => (
                            <span key={f.category} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-700">
                              <span className={`w-1.5 h-1.5 rounded-full ${FEATURE_COLORS[f.category] || 'bg-slate-400'}`} />
                              {featureName(f.category)} <span className="text-slate-400">{f.events}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <p className="text-sm text-slate-500 flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" />{new Date(u.lastActive).toLocaleDateString()}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-slate-200">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <span className="text-xs text-slate-500 mx-2">Page {page} of {data.pagination.totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page === data.pagination.totalPages || loading}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}

          <p className="text-[10px] text-slate-400 mt-6">
            Counts days with a login or a logged/synced action (meals, steps, sleep, reports...). Opening the app without
            doing anything isn't recorded, and wearable syncs can count as activity without the user opening the app.
          </p>
        </>
      ) : null}
    </div>
  );
}
