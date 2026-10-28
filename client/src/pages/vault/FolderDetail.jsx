import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BedDouble, Calendar, FileText, Pencil, Trash2, Upload } from 'lucide-react';
import { vaultService, errorMessage } from '../../services/vaultService';
import { BackBar, Chip, EmptyState, PageShell, Spinner, VaultNav, inputClass } from './ui';
import Kebab from './Kebab';
import FolderSheet from './FolderSheet';
import UploadSheet from './UploadSheet';
import DeleteFolderFlow from './DeleteFolderFlow';
import ReportRow from './ReportRow';
import { formatDate, monthLabel } from './vaultUtils';

const UNFILED = {
  id: 'unfiled',
  name: 'Unfiled',
  color: '#94a3b8',
  isAdmitted: false,
  category: { label: 'No folder' },
  stats: {},
};

const mergeGroups = (prev, next) => {
  const out = prev.map((g) => ({ ...g, reports: [...g.reports] }));
  for (const g of next) {
    const last = out[out.length - 1];
    if (last && last.month === g.month) last.reports.push(...g.reports);
    else out.push({ ...g, reports: [...g.reports] });
  }
  return out;
};

export default function FolderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isUnfiled = id === 'unfiled';

  const [folder, setFolder] = useState(isUnfiled ? UNFILED : null);
  const [groups, setGroups] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showDates, setShowDates] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const fetchPage = useCallback(
    (cursor) => {
      const params = { cursor, from: from || undefined, to: to || undefined };
      return isUnfiled
        ? vaultService.listReports({ ...params, folderId: 'unfiled' })
        : vaultService.folderReports(id, params);
    },
    [id, isUnfiled, from, to]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPage();
      if (res.folder) setFolder(res.folder);
      setGroups(res.groups);
      setNextCursor(res.nextCursor);
    } catch (err) {
      if (err?.response?.status === 404) {
        toast.error('Folder not found');
        navigate('/medical-vault', { replace: true });
      } else {
        toast.error(errorMessage(err, 'Could not load folder'));
      }
    } finally {
      setLoading(false);
    }
  }, [fetchPage, navigate]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await fetchPage(nextCursor);
      setGroups((g) => mergeGroups(g, res.groups));
      setNextCursor(res.nextCursor);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load more'));
    } finally {
      setLoadingMore(false);
    }
  };

  const total = folder?.stats?.reportCount;
  const count = groups.reduce((n, g) => n + g.reports.length, 0);

  return (
    <PageShell>
      <BackBar
        title={folder?.name || 'Folder'}
        right={
          !isUnfiled && folder && (
            <Kebab
              items={[
                { label: 'Edit folder', icon: Pencil, onClick: () => setEditOpen(true) },
                { label: 'Delete folder', icon: Trash2, danger: true, onClick: () => setDeleting(folder) },
              ]}
            />
          )
        }
      />

      {folder && (
        <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-4">
          <span className="absolute top-0 inset-x-0 h-1.5" style={{ background: folder.color }} />
          <div className="p-4 pt-5">
            <div className="flex flex-wrap gap-1.5 mb-2">
              <Chip color={folder.color}>{folder.category.label}</Chip>
              {folder.isAdmitted && <Chip className="bg-indigo-50 text-indigo-700"><BedDouble size={11} /> Admitted</Chip>}
            </div>
            <h2 className="text-xl font-black text-[#14212b]">{folder.name}</h2>
            <p className="text-xs text-slate-500 mt-1">
              {folder.isAdmitted ? 'Admitted to hospital · reports from the stay are kept in this folder' : isUnfiled ? 'Reports saved without a folder' : 'Reports for this folder'}
            </p>
            {!isUnfiled && (
              <div className="grid grid-cols-3 gap-2 border-t border-dashed border-slate-200 mt-3.5 pt-3">
                {[
                  ['Reports', folder.stats.reportCount ?? 0],
                  ['First', formatDate(folder.stats.firstReportDate) || '—'],
                  ['Latest', formatDate(folder.stats.latestReportDate) || '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{k}</p>
                    <p className="text-sm font-black text-[#14212b]">{v}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => setUploadOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 text-emerald-800 text-sm font-bold hover:bg-emerald-50 transition mb-5"
      >
        <Upload size={16} /> {isUnfiled ? 'Add reports' : 'Upload reports to this folder'}
        <span className="text-[11px] font-medium text-emerald-700/70 hidden sm:inline">· PDF or photos, add several at once</span>
      </button>

      <div className="flex items-center justify-between mb-3 relative">
        <h2 className="text-sm font-black text-[#14212b]">Report timeline</h2>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-slate-400">{total ?? count} reports</span>
          <button
            onClick={() => setShowDates((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-600"
          >
            <Calendar size={13} /> {from || to ? `${from || '…'} → ${to || '…'}` : 'All dates'}
          </button>
        </div>
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

      {loading ? (
        <Spinner />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={from || to ? 'No reports in this range' : 'No reports yet'}
          text={from || to ? 'Try a wider date range.' : 'Upload your first report to start the timeline.'}
        />
      ) : (
        <>
          {groups.map((g) => (
            <section key={g.month} className="mb-4">
              <p className="text-[11px] font-black tracking-widest text-slate-400 mb-2 pl-1">{monthLabel(g.month)}</p>
              <div className="space-y-2.5">
                {g.reports.map((r) => (
                  <ReportRow key={r.id} report={r} showDate accent={folder?.color} />
                ))}
              </div>
            </section>
          ))}
          {nextCursor && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-3 rounded-2xl bg-white border border-slate-200 text-sm font-bold text-slate-600 hover:border-slate-300 disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}

      <VaultNav onAdd={() => setUploadOpen(true)} />

      <UploadSheet
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        lockedFolderId={isUnfiled ? null : id}
        onUploaded={load}
      />
      {!isUnfiled && <FolderSheet open={editOpen} folder={folder} onClose={() => setEditOpen(false)} onSaved={(f) => { setFolder(f); load(); }} />}
      {deleting && <DeleteFolderFlow folder={deleting} onClose={() => setDeleting(null)} onDeleted={() => navigate('/medical-vault', { replace: true })} />}
    </PageShell>
  );
}
