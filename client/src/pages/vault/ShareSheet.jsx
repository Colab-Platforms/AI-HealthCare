import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Copy, Link2, Share2, Trash2 } from 'lucide-react';
import { vaultService, errorMessage } from '../../services/vaultService';
import { BottomSheet, Field, GhostButton, PrimaryButton, inputClass } from './ui';
import { formatDateLong } from './vaultUtils';

const EXPIRY_OPTIONS = [
  { days: 1, label: '1 day' },
  { days: 3, label: '3 days' },
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
];

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API needs HTTPS/localhost; fall back for plain-http dev hosts.
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
};

/** Share flow (screens 06a–06c): create link -> copy / send with another app. */
export default function ShareSheet({ open, onClose, report }) {
  const [days, setDays] = useState(3);
  const [allowDownload, setAllowDownload] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null); // { url, expiresAt, allowDownload }
  const [copied, setCopied] = useState(false);
  const [existing, setExisting] = useState([]);

  const loadExisting = useCallback(() => {
    if (!report) return;
    vaultService.listShares(report.id).then((d) => setExisting(d.shares)).catch(() => {});
  }, [report]);

  useEffect(() => {
    if (!open) return;
    setCreated(null); setCopied(false); setDays(3); setAllowDownload(false);
    loadExisting();
  }, [open, loadExisting]);

  const create = async () => {
    setCreating(true);
    try {
      const { share } = await vaultService.createShare(report.id, { expiresInDays: days, allowDownload });
      setCreated(share);
      loadExisting();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not create link'));
    } finally {
      setCreating(false);
    }
  };

  const copy = async () => {
    if (await copyText(created.url)) {
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2500);
    } else {
      toast.error('Could not copy — select the link and copy it manually');
    }
  };

  const sendWithApp = async () => {
    const text = `${report.title} — shared via HealthVault`;
    if (navigator.share) {
      try { await navigator.share({ title: report.title, text, url: created.url }); } catch { /* dismissed */ }
      return;
    }
    // Desktop browsers without the share sheet: hand off to WhatsApp Web.
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${created.url}`)}`, '_blank', 'noopener');
  };

  const revoke = async (id) => {
    try {
      await vaultService.revokeShare(id);
      toast.success('Link revoked');
      setExisting((prev) => prev.filter((s) => s.id !== id));
      if (created?.id === id) setCreated(null);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not revoke link'));
    }
  };

  const others = existing.filter((s) => s.id !== created?.id);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={created ? 'Link ready' : 'Share report'}
      subtitle={report ? `${report.title}` : undefined}
    >
      {!created ? (
        <>
          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 mb-4">
            <Link2 size={17} className="text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-900">Anyone with the link can view</p>
              <p className="text-[11px] text-emerald-800/80">They can open this report in a browser. No app or sign-in needed.</p>
            </div>
          </div>

          <Field label="Link works for">
            <select className={inputClass} value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {EXPIRY_OPTIONS.map((o) => <option key={o.days} value={o.days}>{o.label}</option>)}
            </select>
          </Field>

          <label className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition mb-4 ${allowDownload ? 'border-[#2B3F86] bg-indigo-50/60' : 'border-slate-200 bg-slate-50'}`}>
            <input type="checkbox" className="mt-1 w-4 h-4 accent-[#2B3F86]" checked={allowDownload} onChange={(e) => setAllowDownload(e.target.checked)} />
            <span>
              <span className="block text-sm font-bold text-[#14212b]">Allow download</span>
              <span className="block text-[11px] text-slate-500">Off by default — recipients can only view. This can’t be changed after the link is made.</span>
            </span>
          </label>

          <PrimaryButton className="w-full" onClick={create} disabled={creating}>
            <Link2 size={16} /> {creating ? 'Creating…' : 'Create link'}
          </PrimaryButton>
        </>
      ) : (
        <>
          <Field label="Your link">
            <input readOnly className={`${inputClass} font-mono text-xs`} value={created.url} onFocus={(e) => e.target.select()} />
          </Field>
          <p className="text-[11px] text-slate-500 -mt-1 mb-4">
            {created.allowDownload ? 'View & download' : 'View only'} · works for {days} day{days === 1 ? '' : 's'} · until {formatDateLong(created.expiresAt)}
          </p>
          <PrimaryButton className="w-full mb-2.5" onClick={copy}>
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy link'}
          </PrimaryButton>
          <GhostButton className="w-full mb-2.5" onClick={sendWithApp}>
            <Share2 size={16} /> Send with another app
          </GhostButton>
          <GhostButton className="w-full" onClick={onClose}>Done</GhostButton>
        </>
      )}

      {others.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-100">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">Active links</p>
          <ul className="space-y-2">
            {others.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#14212b]">{s.allowDownload ? 'View & download' : 'View only'}</p>
                  <p className="text-[11px] text-slate-400">Until {formatDateLong(s.expiresAt)} · opened {s.accessCount}×</p>
                </div>
                <button onClick={() => revoke(s.id)} className="p-2 text-slate-400 hover:text-red-500" aria-label="Revoke link"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </BottomSheet>
  );
}
