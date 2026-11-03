import React, { useEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';

/** Three-dot menu. items: [{ label, icon, danger, onClick }] */
export default function Kebab({ items, light = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`p-1.5 rounded-full transition ${light ? 'text-white/80 hover:bg-white/10' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
        aria-label="More actions"
      >
        <MoreVertical size={17} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 min-w-[160px] bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => { setOpen(false); it.onClick(); }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-semibold text-left hover:bg-slate-50 ${it.danger ? 'text-red-600' : 'text-slate-700'}`}
            >
              {it.icon && <it.icon size={14} />} {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
