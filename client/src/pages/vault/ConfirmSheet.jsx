import React from 'react';
import { Trash2 } from 'lucide-react';
import { BottomSheet, GhostButton } from './ui';

/** Simple destructive confirmation (screen 05b). `children` replaces the action buttons when given. */
export default function ConfirmSheet({ open, onClose, title, message, confirmLabel = 'Delete', busy, onConfirm, children }) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="flex items-start gap-3 mb-5">
        <span className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0"><Trash2 size={18} /></span>
        <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
      </div>
      {children || (
        <div className="grid grid-cols-2 gap-3">
          <GhostButton onClick={onClose} disabled={busy}>Cancel</GhostButton>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-3 rounded-2xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition active:scale-[.98] disabled:opacity-50"
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
