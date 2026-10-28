import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BedDouble, Calendar, FolderPlus, Pencil, Search, Trash2, X, FolderOpen } from 'lucide-react';
import { vaultService, errorMessage } from '../../services/vaultService';
import { Chip, EmptyState, PageShell, Spinner, VaultNav, inputClass } from './ui';
import Kebab from './Kebab';
import FolderSheet from './FolderSheet';
import UploadSheet from './UploadSheet';
import DeleteFolderFlow from './DeleteFolderFlow';
import ReportRow from './ReportRow';
import { folderRange, formatBytes, tint } from './vaultUtils';

export const FolderCard = ({ folder, onEdit, onDelete }) => (
  <Link
    to={`/medical-vault/folders/${folder.id}`}
    className="relative block bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition overflow-hidden pt-3"
  >
    <span className="absolute top-0 left-0 h-1.5 w-2/5 rounded-br-lg" style={{ background: folder.color }} />
    <div className="p-3.5 pt-2.5">
      <div className="flex items-start justify-between gap-1">
        <div className="flex flex-wrap gap-1.5">
          <Chip color={folder.color}>{folder.category.label}</Chip>
          {folder.isAdmitted && (
            <Chip className="bg-indigo-50 text-indigo-700"><BedDouble size={11} /> Admitted</Chip>
          )}
        </div>
        {onEdit && (
          <Kebab
            items={[
              { label: 'Edit', icon: Pencil, onClick: () => onEdit(folder) },
              { label: 'Delete', icon: Trash2, danger: true, onClick: () => onDelete(folder) },
            ]}
          />
        )}
      </div>
      <p className="mt-2.5 font-black text-[#14212b] leading-tight truncate">{folder.name}</p>
      <p className="text-[11px] text-slate-400 font-medium mt-0.5">{folderRange(folder)}</p>
      <div className="border-t border-dashed border-slate-200 mt-3 pt-2 text-[11px] font-bold text-slate-500">
        {folder.stats.reportCount} report{folder.stats.reportCount === 1 ? '' : 's'}
      </div>
    </div>
  </Link>
);

export default function VaultHome() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showDates, setShowDates] = useState(false);

  const [folderSheet, setFolderSheet] = useState({ open: false, folder: null });
  const [deleting, setDeleting] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current; // ignore out-of-order responses while typing
    try {
      const res = await vaultService.home({ q: q.trim() || undefined, from: from || undefined, to: to || undefined });
      if (mine === seq.current) setData(res);
    } catch (err) {
      if (mine === seq.current) toast.error(errorMessage(err, 'Could not load your vault'));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [q, from, to]);

  useEffect(() => {
    const t = setTimeout(load, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const filtering = !!(q.trim() || from || to);
  const usage = data?.usage;
  const pct = usage ? Math.min(100, (usage.usedBytes / usage.quotaBytes) * 100) : 0;

  return (
    <PageShell>
      <h1 className="text-[30px] font-black text-[#14212b] tracking-tight leading-none">HealthVault</h1>
      <p className="text-[13px] text-slate-500 font-medium mt-1.5 mb-4">Your reports, filed by what they were for</p>

      <div className="flex gap-2 mb-3 relative">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inputClass} pl-10 !bg-white`}
            placeholder="Search folders or reports"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowDates((v) => !v)}
          className={`w-12 rounded-xl border flex items-center justify-center transition ${from || to ? 'bg-[#2B3F86] border-[#2B3F86] text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
          aria-label="Filter by date"
        >
          <Calendar size={17} />
        </button>

        {showDates && (
          <div className="absolute right-0 top-full mt-2 z-30 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">Report date</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className={inputClass} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
              <input type="date" className={inputClass} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To" />
            </div>
            <button onClick={() => { setFrom(''); setTo(''); setShowDates(false); }} className="mt-3 text-xs font-bold text-[#2B3F86]">
              Clear dates
            </button>
          </div>
        )}
      </div>

      {usage && (
        <div className="mb-5">
          <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full bg-[#2B3F86] rounded-full transition-all" style={{ width: `${Math.max(pct, 1)}%` }} />
          </div>
          <p className="text-[11px] text-slate-500 font-semibold mt-1.5">
            {formatBytes(usage.usedBytes)} of {formatBytes(usage.quotaBytes)} used
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-black text-[#14212b]">{filtering ? 'Matching folders' : 'Folders'}</h2>
        <button onClick={() => setFolderSheet({ open: true, folder: null })} className="text-xs font-bold text-[#2B3F86] flex items-center gap-1">
          <FolderPlus size={14} /> New folder
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {data?.folders.map((f) => (
              <FolderCard
                key={f.id}
                folder={f}
                onEdit={(folder) => setFolderSheet({ open: true, folder })}
                onDelete={setDeleting}
              />
            ))}

            {!filtering && data?.unfiledCount > 0 && (
              <Link
                to="/medical-vault/folders/unfiled"
                className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition p-3.5 pt-5 relative overflow-hidden"
              >
                <span className="absolute top-0 left-0 h-1.5 w-2/5 rounded-br-lg bg-slate-400" />
                <Chip className="bg-slate-100 text-slate-600">No folder</Chip>
                <p className="mt-2.5 font-black text-[#14212b]">Unfiled</p>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">Move them into a folder later</p>
                <div className="border-t border-dashed border-slate-200 mt-3 pt-2 text-[11px] font-bold text-slate-500">
                  {data.unfiledCount} report{data.unfiledCount === 1 ? '' : 's'}
                </div>
              </Link>
            )}

            {!filtering && (
              <button
                onClick={() => setFolderSheet({ open: true, folder: null })}
                className="min-h-[132px] rounded-2xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-[#2B3F86] hover:text-[#2B3F86] transition flex flex-col items-center justify-center gap-1.5"
              >
                <FolderPlus size={22} />
                <span className="text-xs font-bold">New folder</span>
              </button>
            )}
          </div>

          {!filtering && !data?.folders.length && !data?.unfiledCount && (
            <EmptyState icon={FolderOpen} title="Your vault is empty" text="Create a folder, then add your first report." />
          )}

          {filtering && (
            <div className="mt-6">
              <h2 className="text-sm font-black text-[#14212b] mb-3">Matching reports</h2>
              {data?.reports.length ? (
                <div className="space-y-2.5">
                  {data.reports.map((r) => <ReportRow key={r.id} report={r} />)}
                </div>
              ) : (
                <EmptyState icon={X} title="No reports match" text="Try a different search or date range." />
              )}
            </div>
          )}
        </>
      )}

      <VaultNav onAdd={() => setUploadOpen(true)} />

      <FolderSheet
        open={folderSheet.open}
        folder={folderSheet.folder}
        onClose={() => setFolderSheet({ open: false, folder: null })}
        onSaved={load}
      />
      <UploadSheet open={uploadOpen} onClose={() => setUploadOpen(false)} onUploaded={load} />
      {deleting && <DeleteFolderFlow folder={deleting} onClose={() => setDeleting(null)} onDeleted={load} />}
    </PageShell>
  );
}
