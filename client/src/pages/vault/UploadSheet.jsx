import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Camera, FileText, Image as ImageIcon, Upload, X, CheckCircle2 } from 'lucide-react';
import { vaultService, errorMessage, resolveMime, ALLOWED_MIMES } from '../../services/vaultService';
import { BottomSheet, Field, GhostButton, PrimaryButton, inputClass } from './ui';
import { formatBytes, todayISO } from './vaultUtils';

const FAIL_TEXT = {
  NOT_UPLOADED: 'was not received by storage',
  FILE_TOO_LARGE: 'is too large',
  INVALID_FORMAT: 'is not a supported format',
  QUOTA_EXCEEDED: 'does not fit in your remaining storage',
  SAVE_FAILED: 'could not be saved',
};

/**
 * Upload reports (screen 04) and the "+" Add a report sheet (screen 09).
 * With `lockedFolderId` the folder picker is hidden (opened from inside a folder).
 */
export default function UploadSheet({ open, onClose, lockedFolderId = null, onUploaded }) {
  const [folders, setFolders] = useState([]);
  const [limits, setLimits] = useState({ maxFileBytes: 10 * 1024 * 1024, maxFilesPerUpload: 10 });
  const [folderId, setFolderId] = useState(lockedFolderId || '');
  const [files, setFiles] = useState([]);
  const [source, setSource] = useState('upload');
  const [reportDate, setReportDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState({});
  const [busy, setBusy] = useState(false);

  const fileInput = useRef(null);
  const photoInput = useRef(null);
  const cameraInput = useRef(null);

  useEffect(() => {
    if (!open) return;
    setFiles([]); setProgress({}); setNote(''); setReportDate(todayISO()); setSource('upload');
    setFolderId(lockedFolderId || '');
    vaultService.home().then((d) => { setFolders(d.folders); if (d.limits) setLimits(d.limits); }).catch(() => {});
  }, [open, lockedFolderId]);

  const maxMb = Math.round(limits.maxFileBytes / (1024 * 1024));

  const addFiles = (list, from) => {
    const next = [];
    for (const f of Array.from(list || [])) {
      if (!ALLOWED_MIMES.includes(resolveMime(f))) { toast.error(`${f.name}: use PDF, JPG, PNG or TXT`); continue; }
      if (f.size > limits.maxFileBytes) { toast.error(`${f.name} is larger than ${maxMb} MB`); continue; }
      next.push(f);
    }
    setFiles((prev) => [...prev, ...next].slice(0, limits.maxFilesPerUpload));
    if (next.length) setSource(from);
  };

  const submit = async () => {
    if (!files.length) return;
    setBusy(true);
    setProgress({});
    try {
      const res = await vaultService.uploadReports({
        files,
        folderId: lockedFolderId || folderId || null,
        reportDate,
        note,
        source,
        onProgress: (i, p) => setProgress((prev) => ({ ...prev, [i]: p })),
      });
      res.failed?.forEach((f) => toast.error(`A file ${FAIL_TEXT[f.reason] || 'failed'} (${f.reason})`));
      toast.success(`${res.reports.length} report${res.reports.length === 1 ? '' : 's'} saved`);
      onUploaded?.(res);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, 'Upload failed'));
    } finally {
      setBusy(false);
    }
  };

  const picker = (ref, accept, from, capture) => (
    <input
      ref={ref}
      type="file"
      hidden
      multiple={!capture}
      accept={accept}
      capture={capture}
      onChange={(e) => { addFiles(e.target.files, from); e.target.value = ''; }}
    />
  );

  return (
    <BottomSheet
      open={open}
      onClose={busy ? undefined : onClose}
      title={lockedFolderId ? 'Upload reports' : 'Add a report'}
      subtitle={lockedFolderId ? undefined : 'Saved straight to your vault — no folder needed'}
    >
      {picker(fileInput, '.pdf,.jpg,.jpeg,.png,.txt,application/pdf,image/jpeg,image/png,text/plain', 'upload')}
      {picker(photoInput, 'image/jpeg,image/png', 'upload')}
      {picker(cameraInput, 'image/*', 'camera', 'environment')}

      {!lockedFolderId && (
        <Field label="Save to">
          <select className={inputClass} value={folderId} onChange={(e) => setFolderId(e.target.value)}>
            <option value="">Unfiled · no folder</option>
            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </Field>
      )}

      <button
        type="button"
        onClick={() => cameraInput.current?.click()}
        className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-white text-left mb-2.5 active:scale-[.99] transition"
        style={{ background: '#2B3F86' }}
      >
        <span className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center"><Camera size={19} /></span>
        <span>
          <span className="block text-sm font-bold">Scan with camera</span>
          <span className="block text-[11px] text-white/70">Photograph a paper report and add it</span>
        </span>
      </button>

      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <button type="button" onClick={() => fileInput.current?.click()} className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-slate-300 text-sm font-bold text-slate-700 hover:border-[#2B3F86] hover:text-[#2B3F86] transition">
          <Upload size={16} /> Choose files
        </button>
        <button type="button" onClick={() => photoInput.current?.click()} className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-slate-300 text-sm font-bold text-slate-700 hover:border-[#2B3F86] hover:text-[#2B3F86] transition">
          <ImageIcon size={16} /> Photo library
        </button>
      </div>
      <p className="text-[11px] text-center text-slate-400 mb-3">PDF, JPG, PNG or TXT · up to {maxMb} MB each</p>

      {files.length === 0 ? (
        <p className="text-xs text-center text-slate-400 py-2 mb-3">Nothing added yet — scan a page or pick a file</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <FileText size={16} className="text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#14212b] truncate">{f.name}</p>
                {busy && (
                  <div className="h-1 rounded-full bg-slate-200 mt-1.5 overflow-hidden">
                    <div className="h-full bg-[#2B3F86] transition-all" style={{ width: `${progress[i] || 0}%` }} />
                  </div>
                )}
              </div>
              <span className="text-[11px] text-slate-400 shrink-0">{formatBytes(f.size)}</span>
              {busy
                ? (progress[i] === 100 && <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />)
                : <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500" aria-label="Remove"><X size={15} /></button>}
            </li>
          ))}
          <li className="text-[11px] text-slate-400 px-1">{files.length} file{files.length === 1 ? '' : 's'} · each keeps its own file name as the report name</li>
        </ul>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Report date">
          <input type="date" className={inputClass} value={reportDate} max={todayISO()} onChange={(e) => setReportDate(e.target.value)} />
        </Field>
        <Field label="Note">
          <input className={inputClass} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </Field>
      </div>
      <p className="text-[11px] text-slate-400 -mt-1 mb-4">Use the date printed on the report, so the timeline stays in order.</p>

      <div className="grid grid-cols-2 gap-3">
        <GhostButton onClick={onClose} disabled={busy}>Cancel</GhostButton>
        <PrimaryButton onClick={submit} disabled={busy || !files.length}>
          <Upload size={16} />
          {busy ? 'Uploading…' : files.length ? `Upload ${files.length} report${files.length === 1 ? '' : 's'}` : 'Add a page or file first'}
        </PrimaryButton>
      </div>
    </BottomSheet>
  );
}
