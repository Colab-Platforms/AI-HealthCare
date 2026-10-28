import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, Pencil, Share2, Trash2 } from 'lucide-react';
import { vaultService, errorMessage } from '../../services/vaultService';
import { BackBar, BottomSheet, Field, GhostButton, PageShell, PrimaryButton, Spinner, inputClass } from './ui';
import ShareSheet from './ShareSheet';
import ConfirmSheet from './ConfirmSheet';
import { formatBytes, formatDateLong } from './vaultUtils';

const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function ReportPreview() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [folders, setFolders] = useState([]);
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewError, setPreviewError] = useState(false);

  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState({ title: '', reportDate: '', note: '', folderId: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setPreviewError(false);
    try {
      const { report: r } = await vaultService.getReport(id);
      setReport(r);
      // The preview needs the Authorization header, so fetch it as a blob rather than pointing an <img> at the URL.
      try {
        const res = await vaultService.reportBlob(id);
        setBlobUrl(URL.createObjectURL(new Blob([res.data], { type: r.file.mime })));
      } catch {
        setPreviewError(true);
      }
    } catch (err) {
      toast.error(errorMessage(err, 'Report not found'));
      navigate('/medical-vault', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  const download = async () => {
    const filename = report.file.originalName || `${report.title}.${report.file.format || 'pdf'}`;
    try {
      const info = await vaultService.reportDownload(id);
      if (info.downloadUrl) {
        const a = document.createElement('a');
        a.href = info.downloadUrl;
        a.download = info.filename || filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        const res = await vaultService.reportBlob(id, true);
        saveBlob(new Blob([res.data], { type: report.file.mime }), info.filename || filename);
      }
      toast.success('Download started');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not download'));
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await vaultService.deleteReport(id);
      toast.success('Report deleted');
      navigate(report.folderId ? `/medical-vault/folders/${report.folderId}` : '/medical-vault', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, 'Could not delete'));
      setDeleting(false);
    }
  };

  const openEdit = async () => {
    setEdit({
      title: report.title,
      note: report.note || '',
      reportDate: report.reportDate.slice(0, 10),
      folderId: report.folderId || '',
    });
    setEditOpen(true);
    vaultService.home().then((d) => setFolders(d.folders)).catch(() => {});
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { report: r } = await vaultService.updateReport(id, {
        title: edit.title,
        note: edit.note,
        reportDate: edit.reportDate,
        folderId: edit.folderId || null,
      });
      setReport((prev) => ({ ...prev, ...r }));
      setEditOpen(false);
      toast.success('Report updated');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageShell><Spinner /></PageShell>;
  if (!report) return null;

  const isImage = report.file.mime.startsWith('image/');

  return (
    <PageShell>
      <BackBar
        title={report.title}
        right={<button onClick={openEdit} className="p-2 rounded-full hover:bg-white/70 text-slate-500" aria-label="Edit report"><Pencil size={17} /></button>}
      />
      <p className="text-xs text-slate-500 font-medium -mt-2 mb-4 pl-8">
        {formatDateLong(report.reportDate)} · {formatBytes(report.file.sizeBytes)}
        {report.file.pageCount ? ` · ${report.file.pageCount} page${report.file.pageCount === 1 ? '' : 's'}` : ''}
        {report.activeShareCount ? ` · ${report.activeShareCount} active link${report.activeShareCount === 1 ? '' : 's'}` : ''}
      </p>

      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden mb-4 min-h-[60vh] flex items-center justify-center">
        {previewError || !blobUrl ? (
          <p className="text-sm text-slate-400 p-8 text-center">Preview unavailable. You can still download the file.</p>
        ) : isImage ? (
          <img src={blobUrl} alt={report.title} className="max-w-full max-h-[75vh] object-contain" />
        ) : (
          <iframe src={blobUrl} title={report.title} className="w-full h-[75vh] border-0" />
        )}
      </div>
      {report.note && <p className="text-sm text-slate-600 bg-white rounded-2xl border border-slate-100 p-3.5 mb-4">{report.note}</p>}

      <div className="fixed bottom-0 inset-x-0 z-40">
        <div className="max-w-3xl mx-auto px-4 pb-20 md:pb-4">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-2.5 grid grid-cols-3 gap-2">
            <PrimaryButton onClick={() => setShareOpen(true)}><Share2 size={16} /> Share</PrimaryButton>
            <GhostButton onClick={download}><Download size={16} /> Download</GhostButton>
            <button
              onClick={() => setDeleteOpen(true)}
              className="px-4 py-3 rounded-2xl text-sm font-bold bg-red-50 text-red-600 hover:bg-red-100 transition active:scale-[.98] flex items-center justify-center gap-2"
            >
              <Trash2 size={16} /> Delete
            </button>
          </div>
        </div>
      </div>

      <ShareSheet open={shareOpen} onClose={() => { setShareOpen(false); load(); }} report={report} />

      <ConfirmSheet
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        busy={deleting}
        title="Delete this report?"
        message={`“${report.title}” will be removed. Its public link will stop working. This can’t be undone.`}
        confirmLabel="Delete report"
        onConfirm={confirmDelete}
      />

      <BottomSheet open={editOpen} onClose={() => setEditOpen(false)} title="Edit report">
        <form onSubmit={saveEdit}>
          <Field label="Title"><input className={inputClass} value={edit.title} maxLength={160} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Report date"><input type="date" className={inputClass} value={edit.reportDate} onChange={(e) => setEdit({ ...edit, reportDate: e.target.value })} /></Field>
            <Field label="Folder">
              <select className={inputClass} value={edit.folderId} onChange={(e) => setEdit({ ...edit, folderId: e.target.value })}>
                <option value="">Unfiled</option>
                {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Note"><input className={inputClass} value={edit.note} maxLength={1000} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <GhostButton type="button" onClick={() => setEditOpen(false)}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={saving || !edit.title.trim()}>{saving ? 'Saving…' : 'Save'}</PrimaryButton>
          </div>
        </form>
      </BottomSheet>
    </PageShell>
  );
}
