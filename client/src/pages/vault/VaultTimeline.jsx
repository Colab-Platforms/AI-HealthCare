import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Calendar, ChevronDown, ChevronRight, Folder, ListTree } from 'lucide-react';
import { vaultService, errorMessage } from '../../services/vaultService';
import { EmptyState, PageShell, Spinner, VaultNav, inputClass } from './ui';
import UploadSheet from './UploadSheet';
import ReportRow from './ReportRow';
import { dayParts, monthLabel } from './vaultUtils';

const mergeGroups = (prev, next) => {
  const out = prev.map((g) => ({ ...g, entries: g.entries.map((e) => (e.type === 'folder' ? { ...e, reports: [...e.reports] } : e)) }));
  for (const g of next) {
    const last = out[out.length - 1];
    if (!last || last.month !== g.month) { out.push(g); continue; }
    for (const entry of g.entries) {
      const existing = entry.type === 'folder' && last.entries.find((e) => e.type === 'folder' && e.folder.id === entry.folder.id);
      if (existing) existing.reports.push(...entry.reports);
      else last.entries.push(entry);
    }
  }
  return out;
};

const FolderEntry = ({ entry }) => {
  const [open, setOpen] = useState(true);
  const { folder, reports } = entry;
  const { day, mon } = dayParts(reports[0].reportDate);
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 shrink-0 text-center pt-3">
        <p className="text-sm font-black text-[#14212b] leading-none">{day}</p>
        <p className="text-[9px] font-bold text-slate-400 tracking-wider mt-0.5">{mon}</p>
      </div>
      <div className="flex-1 min-w-0 rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden" style={{ borderTop: `3px solid ${folder.color}` }}>
        <div className="flex items-center gap-2 p-3">
          <button onClick={() => setOpen((v) => !v)} className="text-slate-400" aria-label={open ? 'Collapse' : 'Expand'}>
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <Link to={`/medical-vault/folders/${folder.id}`} className="min-w-0 flex-1">
            <p className="text-sm font-black text-[#14212b] truncate">{folder.name}</p>
            <p className="text-[11px] text-slate-400 font-medium truncate">
              {folder.category.label}{folder.isAdmitted ? ' · Admitted' : ''} · {folder.stats.reportCount} reports
            </p>
          </Link>
          <Folder size={16} className="text-slate-300 shrink-0" />
        </div>
        {open && (
          <div className="px-3 pb-3 space-y-2">
            {reports.map((r) => (
              <ReportRow key={r.id} report={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default function VaultTimeline() {
  const [data, setData] = useState({ summary: null, groups: [], nextCursor: null });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showDates, setShowDates] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await vaultService.timeline({ from: from || undefined, to: to || undefined }));
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load timeline'));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await vaultService.timeline({ cursor: data.nextCursor, from: from || undefined, to: to || undefined });
      setData((d) => ({ ...res, groups: mergeGroups(d.groups, res.groups) }));
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load more'));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <PageShell>
      <div className="flex items-start justify-between relative">
        <div>
          <h1 className="text-[30px] font-black text-[#14212b] tracking-tight leading-none">Timeline</h1>
          {data.summary && (
            <p className="text-[13px] text-slate-500 font-medium mt-1.5">
              {data.summary.folderCount} folder{data.summary.folderCount === 1 ? '' : 's'} · {data.summary.reportCount} report{data.summary.reportCount === 1 ? '' : 's'}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowDates((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-600"
        >
          <Calendar size={13} /> {from || to ? `${from || '…'} → ${to || '…'}` : 'All dates'}
        </button>
        {showDates && (
          <div className="absolute right-0 top-full mt-2 z-30 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-4">
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className={inputClass} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
              <input type="date" className={inputClass} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To" />
            </div>
            <button onClick={() => { setFrom(''); setTo(''); setShowDates(false); }} className="mt-3 text-xs font-bold text-[#2B3F86]">Clear dates</button>
          </div>
        )}
      </div>

      <div className="mt-6">
        {loading ? (
          <Spinner />
        ) : data.groups.length === 0 ? (
          <EmptyState icon={ListTree} title="Nothing on your timeline yet" text="Reports you add show up here, newest first." />
        ) : (
          <>
            {data.groups.map((g) => (
              <section key={g.month} className="mb-5">
                <p className="text-[11px] font-black tracking-widest text-slate-400 mb-2 pl-1">{monthLabel(g.month)}</p>
                <div className="space-y-3">
                  {g.entries.map((entry, i) =>
                    entry.type === 'folder' ? (
                      <FolderEntry key={`${g.month}-${entry.folder.id}`} entry={entry} />
                    ) : (
                      <ReportRow key={`${g.month}-${entry.report.id}-${i}`} report={entry.report} showDate accent="#94a3b8" />
                    )
                  )}
                </div>
              </section>
            ))}
            {data.nextCursor && (
              <button onClick={loadMore} disabled={loadingMore} className="w-full py-3 rounded-2xl bg-white border border-slate-200 text-sm font-bold text-slate-600 hover:border-slate-300 disabled:opacity-50">
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>

      <VaultNav onAdd={() => setUploadOpen(true)} />
      <UploadSheet open={uploadOpen} onClose={() => setUploadOpen(false)} onUploaded={load} />
    </PageShell>
  );
}
