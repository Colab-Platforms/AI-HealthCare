import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import api from '../services/api';

const glass = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.85)',
  boxShadow: '0 4px 24px rgba(16,185,129,0.06), 0 1px 0 rgba(255,255,255,0.9) inset',
};

export default function DeleteAccount() {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast]       = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await api.post('/privacy/delete-account');
      showToast('Account deletion scheduled in 30 days');
      setTimeout(() => navigate('/privacy-settings'), 1200);
    } catch {
      showToast('Failed. Try again.', 'error');
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F7F2] flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm rounded-3xl p-6 space-y-4"
        style={{ ...glass, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
               style={{ background: 'rgba(239,68,68,0.1)' }}>
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-slate-800 font-bold">Delete Account?</h3>
            <p className="text-slate-400 text-xs">Cannot be undone after 30 days</p>
          </div>
        </div>
        <p className="text-slate-500 text-sm leading-relaxed">
          All reports, documents, and data permanently deleted.
          You have a <strong className="text-slate-700">30-day window</strong> to cancel.
        </p>
        <div className="flex gap-3">
          <button onClick={() => navigate('/privacy-settings')}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors">
            Cancel
          </button>
          <button onClick={handleDeleteAccount} disabled={deleting}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-colors">
            {deleting ? 'Processing...' : 'Delete Account'}
          </button>
        </div>
      </motion.div>

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg"
          style={{ background: toast.type === 'error' ? '#dc2626' : '#059669' }}>
          <CheckCircle size={15} />
          {toast.msg}
        </motion.div>
      )}
    </div>
  );
}
