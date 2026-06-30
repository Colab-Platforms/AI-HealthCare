import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Download, Trash2, ToggleLeft, ToggleRight, AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react';
import api from '../services/api';

const glass = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.85)',
  boxShadow: '0 4px 24px rgba(16,185,129,0.06), 0 1px 0 rgba(255,255,255,0.9) inset',
};

const glassDivider = { borderBottom: '1px solid rgba(0,0,0,0.05)' };

export default function PrivacySettings() {
  const [consent, setConsent]         = useState(null);
  const [settings, setSettings]       = useState(null);
  const [loading, setLoading]         = useState(true);
  const [exporting, setExporting]     = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [toast, setToast]             = useState(null);

  useEffect(() => { fetchStatus(); }, []);

  const fetchStatus = async () => {
    try {
      const { data } = await api.get('/privacy/consent');
      setConsent(data.consent);
      setSettings(data.privacySettings);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleSetting = async (key) => {
    const newVal = !settings[key];
    setSettings(p => ({ ...p, [key]: newVal }));
    try {
      await api.put('/privacy/settings', { [key]: newVal });
      showToast('Preference saved');
    } catch {
      setSettings(p => ({ ...p, [key]: !newVal }));
      showToast('Failed to save', 'error');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${baseUrl}/api/privacy/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `takehealth-data-${Date.now()}.zip`;
      a.click(); URL.revokeObjectURL(url);
      showToast('Data exported successfully');
    } catch {
      showToast('Export failed. Try again.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await api.post('/privacy/delete-account');
      showToast('Account deletion scheduled in 30 days');
      setDeleteModal(false);
      fetchStatus();
    } catch {
      showToast('Failed. Try again.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDeletion = async () => {
    try {
      await api.post('/privacy/cancel-deletion');
      showToast('Deletion cancelled. Account restored.');
      fetchStatus();
    } catch {
      showToast('Failed to cancel.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const scheduledDeletion = consent?.scheduledDeletion;

  return (
    <div className="min-h-screen bg-[#F2F7F2] px-4 py-6">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
               style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
            <Shield size={20} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="text-slate-800 font-black text-xl" style={{ letterSpacing: '-0.4px' }}>Privacy & Data</h1>
            <p className="text-slate-400 text-xs font-medium">DPDPA 2023 Compliant • Your choices are saved instantly</p>
          </div>
        </div>

        {/* Consent Status */}
        <Section title="Consent Status">
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-slate-700 text-sm font-semibold">Data Processing Consent</p>
              <p className="text-slate-400 text-xs mt-0.5">
                {consent?.given
                  ? `Granted on ${new Date(consent.givenAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : 'Not given yet'}
              </p>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${consent?.given && !consent?.withdrawn ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
              {consent?.given && !consent?.withdrawn ? '✓ Active' : '✗ Withdrawn'}
            </span>
          </div>
        </Section>

        {/* Data Preferences — toggles with REAL backend impact */}
        {settings && (
          <Section title="Data Preferences">
            {[
              {
                key: 'analyticsEnabled',
                label: 'Usage Analytics',
                desc: 'We track which features you use (e.g. diet plan, reports) to improve the app.',
                impact: '✦ OFF → we stop recording your feature usage immediately.',
              },
              {
                key: 'marketingEnabled',
                label: 'Health Tips & Newsletters',
                desc: 'Occasional emails with health tips, new features, and wellness content.',
                impact: '✦ OFF → you will only receive critical emails like OTP and account alerts.',
              },
              // {
              //   key: 'dataSharing',
              //   label: 'Anonymous Research',
              //   desc: 'Your health trends (no name, no contact) shared with researchers to improve public health.',
              //   impact: '✦ OFF → your data is never included in any research or export.',
              // },
            ].map(({ key, label, desc, impact }) => (
              <div key={key} className="p-4" style={glassDivider}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-slate-700 text-sm font-semibold">{label}</p>
                    <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{desc}</p>
                    <p className="text-emerald-600 text-[11px] font-medium mt-1">
                      {impact}
                    </p>
                  </div>
                  <button onClick={() => toggleSetting(key)} className="flex-shrink-0 mt-0.5">
                    {settings[key]
                      ? <ToggleRight size={30} className="text-emerald-500" />
                      : <ToggleLeft  size={30} className="text-slate-300" />}
                  </button>
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* Data Rights */}
        <Section title="Your Data Rights (DPDPA Art. 11 & 12)">
          {/* Export */}
          <button onClick={handleExport} disabled={exporting}
            className="w-full flex items-center justify-between p-4 hover:bg-white/50 transition-colors"
            style={glassDivider}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                   style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.15)' }}>
                <Download size={17} className="text-blue-500" />
              </div>
              <div className="text-left">
                <p className="text-slate-700 text-sm font-semibold">Export My Data</p>
                <p className="text-slate-400 text-xs">ZIP with all reports, logs, chat history & profile</p>
              </div>
            </div>
            {exporting
              ? <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              : <ChevronRight size={16} className="text-slate-300" />}
          </button>

          {/* Delete / Cancel */}
          {scheduledDeletion ? (
            <div className="p-4">
              <div className="rounded-xl p-3 flex items-start gap-3"
                   style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-600 text-sm font-semibold">Deletion Scheduled</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Permanently deleted on{' '}
                    <span className="font-semibold text-slate-700">
                      {new Date(scheduledDeletion).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </p>
                  <button onClick={handleCancelDeletion}
                    className="mt-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors">
                    Cancel Deletion →
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button onClick={() => setDeleteModal(true)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                     style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <Trash2 size={17} className="text-red-500" />
                </div>
                <div className="text-left">
                  <p className="text-red-500 text-sm font-semibold">Delete My Account</p>
                  <p className="text-slate-400 text-xs">Permanently removes all data after 30-day grace period</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
            </button>
          )}
        </Section>

        {/* Info footer */}
        <div className="rounded-2xl p-4 text-xs text-slate-400 leading-relaxed space-y-1.5"
             style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.7)' }}>
          <p>🔒 Medical files encrypted at rest and in transit (AES-256)</p>
          <p>🇮🇳 Compliant with India's Digital Personal Data Protection Act 2023</p>
          <p>📧 Data concerns: <span className="text-slate-600 font-medium">privacy@take.health</span></p>
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)' }}>
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
              <button onClick={() => setDeleteModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors">
                Cancel
              </button>
              <button onClick={handleDeleteAccount} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-colors">
                {deleting ? 'Processing...' : 'Delete Account'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Toast */}
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

function Section({ title, children }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={glass}>
      <div className="px-4 py-3" style={{ ...glassDivider, background: 'rgba(255,255,255,0.4)' }}>
        <h2 className="text-slate-500 text-[11px] font-black uppercase tracking-widest">{title}</h2>
      </div>
      {children}
    </div>
  );
}
