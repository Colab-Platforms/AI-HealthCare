import React, { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, ListTree, Plus, X } from 'lucide-react';
import { NAVY } from './vaultUtils';

export const PageShell = ({ children }) => (
  <div
    className="w-full min-h-screen pb-36 relative overflow-x-hidden"
    style={{ background: 'linear-gradient(160deg, #eef3f6 0%, #f4f7f9 50%, #e9eff3 100%)' }}
  >
    <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 relative z-10">{children}</div>
  </div>
);

/** Slides up from the bottom on phones, centred modal on desktop. */
export const BottomSheet = ({ open, onClose, title, subtitle, children }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
          <motion.div
            className="absolute inset-0 bg-slate-900/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="relative w-full max-w-md bg-white rounded-t-[28px] md:rounded-[28px] p-5 pb-6 max-h-[92vh] overflow-y-auto shadow-2xl"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-4 md:hidden" />
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-black text-[#14212b] tracking-tight">{title}</h3>
                {subtitle && <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>}
              </div>
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const Chip = ({ children, color, active, onClick, className = '' }) => (
  <span
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${onClick ? 'cursor-pointer select-none' : ''} ${className}`}
    style={color ? { background: `${color}1F`, color } : undefined}
    data-active={active}
  >
    {children}
  </span>
);

export const PrimaryButton = ({ children, className = '', ...rest }) => (
  <button
    {...rest}
    className={`px-4 py-3 rounded-2xl text-sm font-bold text-white transition active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${className}`}
    style={{ background: NAVY }}
  >
    {children}
  </button>
);

export const GhostButton = ({ children, className = '', ...rest }) => (
  <button
    {...rest}
    className={`px-4 py-3 rounded-2xl text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition active:scale-[.98] disabled:opacity-50 flex items-center justify-center gap-2 ${className}`}
  >
    {children}
  </button>
);

export const Field = ({ label, hint, children }) => (
  <label className="block mb-3">
    <span className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-slate-400 mt-1">{hint}</span>}
  </label>
);

export const inputClass =
  'w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-[#14212b] outline-none focus:border-[#2B3F86] focus:bg-white transition';

/** Vault | Timeline switcher and the centre "+" button (bottom bar in the mobile design). */
export const VaultNav = ({ onAdd }) => {
  const tab = ({ isActive }) =>
    `flex flex-col items-center gap-0.5 px-8 py-1 text-[11px] font-bold transition ${isActive ? 'text-[#2B3F86]' : 'text-slate-400'}`;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
      <div className="max-w-md mx-auto mb-20 md:mb-4 px-4 pointer-events-auto">
        <div className="relative bg-white rounded-3xl shadow-xl border border-slate-100 flex items-center justify-around h-16">
          <NavLink to="/medical-vault" end className={tab}>
            <Folder size={20} />
            Vault
          </NavLink>
          <button
            onClick={onAdd}
            className="-mt-8 w-14 h-14 rounded-2xl text-white shadow-lg flex items-center justify-center active:scale-95 transition"
            style={{ background: NAVY }}
            aria-label="Add a report"
          >
            <Plus size={26} strokeWidth={2.5} />
          </button>
          <NavLink to="/medical-vault/timeline" className={tab}>
            <ListTree size={20} />
            Timeline
          </NavLink>
        </div>
      </div>
    </div>
  );
};

export const BackBar = ({ title, right }) => {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-white/70 text-slate-700"
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h1 className="text-lg font-black text-[#14212b] truncate">{title}</h1>
      </div>
      {right}
    </div>
  );
};

export const EmptyState = ({ icon: Icon, title, text, action }) => (
  <div className="text-center py-12 px-6">
    <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto mb-3 text-slate-400">
      <Icon size={24} />
    </div>
    <p className="font-black text-[#14212b]">{title}</p>
    {text && <p className="text-sm text-slate-500 mt-1">{text}</p>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);

export const Spinner = () => (
  <div className="flex justify-center py-16">
    <div className="w-7 h-7 rounded-full border-[3px] border-slate-200 border-t-[#2B3F86] animate-spin" />
  </div>
);
