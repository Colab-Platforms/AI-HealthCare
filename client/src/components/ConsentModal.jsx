import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, FileText, Heart, BarChart2, X } from 'lucide-react';
import api from '../services/api';

const PURPOSES = [
  { id: 'health_processing', icon: Heart,    label: 'Health Data Processing',  desc: 'Analyze your reports, metrics, and vitals to provide AI-powered health insights.', required: true },
  { id: 'analytics',        icon: BarChart2, label: 'Usage Analytics',         desc: 'Understand how you use FitCure to improve the app experience.', required: false },
  { id: 'marketing',        icon: FileText,  label: 'Health Tips & Updates',   desc: 'Receive personalized health tips and feature announcements via email.', required: false },
];

export default function ConsentModal({ onAccept }) {
  const [selected, setSelected] = useState({ health_processing: true, analytics: true, marketing: false });
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const toggle = (id, required) => {
    if (required) return;
    setSelected(p => ({ ...p, [id]: !p[id] }));
  };

  const handleAccept = async () => {
    setLoading(true);
    try {
      const purposes = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
      await api.post('/privacy/consent', { action: 'granted', purposes });
      onAccept();
    } catch (e) {
      console.error('Consent error:', e);
      onAccept(); // allow through even if API fails
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4"
           style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          className="w-full max-w-md rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(145deg, #0d1f13 0%, #0a1628 100%)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Header */}
          <div className="p-6 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                   style={{ background: 'linear-gradient(135deg, #22c55e33, #16a34a33)', border: '1px solid #22c55e44' }}>
                <Shield size={20} className="text-green-400" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg leading-tight">Your Data, Your Control</h2>
                <p className="text-white/40 text-xs">DPDPA 2023 Compliant</p>
              </div>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              FitCure processes your health data to provide AI-powered insights. Choose what you're comfortable sharing.
            </p>
          </div>

          {/* Purposes */}
          <div className="p-4 space-y-3">
            {PURPOSES.map(({ id, icon: Icon, label, desc, required }) => {
              const active = selected[id];
              return (
                <button key={id} onClick={() => toggle(id, required)}
                  className="w-full text-left rounded-xl p-3.5 transition-all"
                  style={{
                    background: active ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${active ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    cursor: required ? 'not-allowed' : 'pointer',
                  }}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                         style={{ background: active ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)' }}>
                      <Icon size={15} className={active ? 'text-green-400' : 'text-white/30'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${active ? 'text-white' : 'text-white/50'}`}>{label}</span>
                        {required && <span className="text-[10px] font-bold text-green-500/70 bg-green-500/10 px-1.5 py-0.5 rounded">Required</span>}
                      </div>
                      <p className="text-white/40 text-xs mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-10 h-5 rounded-full transition-all flex items-center px-0.5"
                           style={{ background: active ? '#22c55e' : 'rgba(255,255,255,0.1)' }}>
                        <div className="w-4 h-4 rounded-full bg-white shadow transition-transform"
                             style={{ transform: active ? 'translateX(20px)' : 'translateX(0)' }} />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Details toggle */}
          <div className="px-4 pb-2">
            <button onClick={() => setShowDetails(p => !p)}
              className="text-xs text-white/30 hover:text-white/50 transition-colors flex items-center gap-1">
              <FileText size={11} />
              {showDetails ? 'Hide' : 'View'} full Privacy Policy
            </button>
            <AnimatePresence>
              {showDetails && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden">
                  <div className="mt-2 p-3 rounded-xl text-white/40 text-xs leading-relaxed space-y-1"
                       style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p>• Data stored securely in India (MongoDB Atlas)</p>
                    <p>• Medical files encrypted at rest and in transit</p>
                    <p>• You can export or delete your data anytime from Privacy Settings</p>
                    <p>• We never sell your health data to third parties</p>
                    <p>• Compliant with DPDPA 2023 (India) and global best practices</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Actions */}
          <div className="p-4 pt-2 space-y-2">
            <button onClick={handleAccept} disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Saving...' : 'Accept & Continue'}
            </button>
            <p className="text-center text-white/25 text-[11px]">
              You can change these preferences anytime in Privacy Settings
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
