import { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { Share2, Download, X, Loader2 } from 'lucide-react';
import { gamificationService } from '../services/api';

/* ─────────────────────────────────────────
   Utility — generate PNG from a DOM node
   Security: runs entirely client-side,
   no data leaves the browser.
───────────────────────────────────────── */
async function captureCard(ref) {
  const canvas = await html2canvas(ref, {
    backgroundColor: '#0f172a',   // explicit bg so no transparency glitches
    scale: 3,
    useCORS: true,
    logging: false,
    removeContainer: true,
    allowTaint: false,
  });
  return canvas.toDataURL('image/png');
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function nativeShare(dataUrl, filename, title) {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return true;
    }
  } catch (_) { /* fallback */ }
  return false;
}

/* ─────────────────────────────────────────
   Health Score Share Card (Strava-style)
───────────────────────────────────────── */
const FONT = "'DM Sans', 'Inter', sans-serif";

function TierBadge({ icon, name }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
      background: 'linear-gradient(135deg, rgba(212,175,55,0.18) 0%, rgba(255,215,0,0.10) 100%)',
      border: '1px solid rgba(212,175,55,0.45)',
      borderRadius: 100, padding: '5px 12px 5px 8px',
      boxShadow: '0 0 16px rgba(212,175,55,0.15)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 7, fontWeight: 700, color: 'rgba(212,175,55,0.7)',
          letterSpacing: '0.16em', textTransform: 'uppercase', fontFamily: FONT, marginBottom: 1 }}>Tier</div>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#f5d060',
          letterSpacing: '0.02em', fontFamily: FONT, lineHeight: 1, whiteSpace: 'nowrap' }}>{name}</div>
      </div>
    </div>
  );
}

function BadgeChip({ icon, name }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, minWidth: 68 }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: 'linear-gradient(135deg, rgba(105,163,141,0.25) 0%, rgba(105,163,141,0.10) 100%)',
        border: '1.5px solid rgba(105,163,141,0.5)',
        boxShadow: '0 4px 16px rgba(105,163,141,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
      }}>
        {icon}
      </div>
      <div style={{
        fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)',
        textAlign: 'center', maxWidth: 68, lineHeight: 1.3,
        textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: FONT,
      }}>{name}</div>
    </div>
  );
}

function ScoreCard({ data }) {
  const {
    healthScore = 0, currentTier = 'Health Novice', tierIcon = '🌱',
    streak = 0, totalPoints = 0, badges = [], metrics = [], userName = '',
  } = data;

  const scoreColor = healthScore >= 80 ? '#22c55e' : healthScore >= 60 ? '#f59e0b' : '#ef4444';
  const topBadges = badges.slice(-4);

  return (
    <div style={{
      width: 400,
      background: 'linear-gradient(145deg, #0d1f13 0%, #112316 40%, #0a1a10 100%)',
      borderRadius: 28, padding: '28px 28px 24px',
      fontFamily: FONT, position: 'relative', overflow: 'hidden',
      color: '#fff', boxSizing: 'border-box',
    }}>
      {/* Glow blobs */}
      <div style={{ position: 'absolute', top: -100, right: -100, width: 280, height: 280,
        background: 'radial-gradient(circle, rgba(105,163,141,0.28) 0%, transparent 65%)',
        borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -80, left: -80, width: 220, height: 220,
        background: 'radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 65%)',
        borderRadius: '50%', pointerEvents: 'none' }} />

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 12, marginBottom: 24 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.22em', color: '#69A38D',
            textTransform: 'uppercase', marginBottom: 3 }}>take.health</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
            lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {userName ? `${userName}'s Card` : 'My Health Card'}
          </div>
        </div>
        <TierBadge icon={tierIcon} name={currentTier} />
      </div>

      {/* Big score */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 4 }}>
        <div style={{ fontSize: 92, fontWeight: 900, lineHeight: 0.9, color: scoreColor,
          textShadow: `0 0 50px ${scoreColor}55, 0 0 100px ${scoreColor}22`, letterSpacing: '-4px' }}>
          {healthScore}
        </div>
        <div style={{ paddingBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.12em', textTransform: 'uppercase' }}>out of</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: 'rgba(255,255,255,0.25)', letterSpacing: '-1px' }}>100</div>
        </div>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)',
        letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 24 }}>Health Score</div>

      {/* Stats pills */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Points', value: totalPoints.toLocaleString() },
          { label: 'Streak', value: streak > 0 ? `${streak}d 🔥` : '—' },
          { label: 'Badges', value: badges.length },
        ].map(({ label, value }) => (
          <div key={label} style={{ flex: 1,
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 14, padding: '10px 12px',
            border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.35)',
              letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Metrics */}
      {metrics.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.18em',
            color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginBottom: 10 }}>Key Metrics</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {metrics.slice(0, 3).map(m => (
              <div key={m.name} style={{ display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,0.035)',
                borderRadius: 10, padding: '7px 12px',
                border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.65)',
                  textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden',
                  textOverflow: 'ellipsis', maxWidth: 160 }}>{m.name}</span>
                <span style={{ fontSize: 11, fontWeight: 800, flexShrink: 0,
                  color: m.status === 'normal' ? '#4ade80' : m.status === 'high' ? '#f87171' : '#fbbf24',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                  {String(m.value).length > 18 ? String(m.value).slice(0, 18) + '…' : m.value}{m.unit ? ` ${m.unit}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Badges */}
      {topBadges.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.18em',
            color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginBottom: 14 }}>Achievements</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {topBadges.map((b, i) => <BadgeChip key={i} icon={b.icon} name={b.name} />)}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.25)',
          letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
        <div style={{ fontSize: 9, fontWeight: 900, color: '#69A38D',
          letterSpacing: '0.18em', textTransform: 'uppercase' }}>take.health</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Report Summary Card
───────────────────────────────────────── */
function ReportCard({ data }) {
  const {
    healthScore = 0, reportType = 'Health Report', reportDate,
    keyFindings = [], deficiencies = [], userName = '', category = 'lab_report',
  } = data;

  const scoreColor = healthScore >= 80 ? '#22c55e' : healthScore >= 60 ? '#f59e0b' : '#ef4444';
  const categoryEmoji = {
    lab_report: '🧪', prescription: '💊', scan: '🩻',
    doctor_notes: '🩺', vaccination: '💉', insurance: '📋', other: '📄',
  }[category] || '📄';

  return (
    <div style={{
      width: 400,
      background: 'linear-gradient(145deg, #0d1f13 0%, #112316 40%, #0a1a10 100%)',
      borderRadius: 28, padding: '28px 28px 24px',
      fontFamily: FONT,
      position: 'relative', overflow: 'hidden', color: '#fff',
      boxSizing: 'border-box',
    }}>
      <div style={{ position: 'absolute', top: -100, right: -100, width: 280, height: 280,
        background: 'radial-gradient(circle, rgba(105,163,141,0.28) 0%, transparent 65%)',
        borderRadius: '50%', pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.22em',
          color: '#69A38D', textTransform: 'uppercase', marginBottom: 10 }}>take.health</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14,
            background: 'rgba(105,163,141,0.15)', border: '1px solid rgba(105,163,141,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
            {categoryEmoji}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{reportType}</div>
            {reportDate && <div style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
              {new Date(reportDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>}
          </div>
        </div>
        {userName && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>{userName}</div>}
      </div>

      {/* Score */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 4 }}>
        <div style={{ fontSize: 86, fontWeight: 900, lineHeight: 0.9, color: scoreColor,
          textShadow: `0 0 50px ${scoreColor}55`, letterSpacing: '-4px' }}>{healthScore}</div>
        <div style={{ paddingBottom: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.12em', textTransform: 'uppercase' }}>Health</div>
          <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.12em', textTransform: 'uppercase' }}>Score</div>
        </div>
      </div>
      <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.25)',
        letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 22 }}>out of 100</div>

      {/* Key findings */}
      {keyFindings.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.18em',
            color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginBottom: 10 }}>Key Findings</div>
          {keyFindings.slice(0, 3).map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 7 }}>
              <span style={{ color: '#69A38D', fontSize: 10, marginTop: 2, flexShrink: 0 }}>•</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.65)',
                lineHeight: 1.5 }}>{typeof f === 'string' ? f : f.finding || f.text || ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* Deficiencies */}
      {deficiencies.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.18em',
            color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginBottom: 8 }}>Watch Out</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {deficiencies.slice(0, 4).map((d, i) => (
              <div key={i} style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 8, padding: '4px 10px', fontSize: 9, fontWeight: 700,
                color: '#fca5a5', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {typeof d === 'string' ? d : d.name || d.nutrient || ''}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 4 }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.25)',
          letterSpacing: '0.1em', textTransform: 'uppercase' }}>Generated by AI</div>
        <div style={{ fontSize: 9, fontWeight: 900, color: '#69A38D',
          letterSpacing: '0.18em', textTransform: 'uppercase' }}>take.health</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Modal — rendered via portal at body level
   so it escapes any Framer Motion transform
   stacking context.
───────────────────────────────────────── */
function ShareModal({ type, data, onClose }) {
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState('');
  const [liveData, setLiveData] = useState(data);
  const cardRef = useRef(null);

  // Re-fetch fresh gamification data when modal opens (avoids stale tier)
  useEffect(() => {
    if (type === 'score') {
      gamificationService.getProfile().then(({ data: res }) => {
        if (res?.success) {
          setLiveData(prev => ({
            ...prev,
            currentTier: res.data.currentTier,
            tierIcon: res.data.tierIcon,
            streak: res.data.streak,
            totalPoints: res.data.totalPoints,
            badges: res.data.badges || [],
          }));
        }
      }).catch(() => {});
    }
  }, [type]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleExport = useCallback(async (action = 'download') => {
    if (!cardRef.current) return;
    setExporting(true);
    setStatus('Generating image...');
    try {
      const dataUrl = await captureCard(cardRef.current);
      const filename = type === 'score'
        ? `takehealth-score-${Date.now()}.png`
        : `takehealth-report-${Date.now()}.png`;

      if (action === 'share') {
        setStatus('Opening share sheet...');
        const shared = await nativeShare(dataUrl, filename, 'My Health Card — take.health');
        if (!shared) {
          downloadDataUrl(dataUrl, filename);
          setStatus('Downloaded!');
        } else {
          setStatus('Shared!');
        }
      } else {
        downloadDataUrl(dataUrl, filename);
        setStatus('Downloaded!');
      }
      setTimeout(() => setStatus(''), 2000);
    } catch (e) {
      console.error('Export failed:', e);
      setStatus('Failed — try again');
      setTimeout(() => setStatus(''), 3000);
    } finally {
      setExporting(false);
    }
  }, [type]);

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 20 }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }} />

      {/* Close — fixed top-right, always fully visible */}
      <button
        onClick={onClose}
        style={{ position: 'fixed', top: 20, right: 20, width: 36, height: 36,
          borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none',
          color: '#fff', cursor: 'pointer', fontSize: 16, zIndex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >✕</button>

      {/* Unified card wrapper — same dark bg as card, buttons feel integrated */}
      <div
        style={{ position: 'relative', zIndex: 1, borderRadius: 28,
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          background: 'linear-gradient(145deg, #0d1f13 0%, #112316 40%, #0a1a10 100%)',
          overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Capture area — only this gets exported to PNG */}
        <div ref={cardRef} style={{ userSelect: 'none' }}>
          {type === 'score' ? <ScoreCard data={liveData} /> : <ReportCard data={liveData} />}
        </div>

        {/* Buttons — same container, outside cardRef, not captured in PNG */}
        <div style={{
          display: 'flex', gap: 10, padding: '0 28px 24px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          paddingTop: 16,
        }}>
          <button
            onClick={() => handleExport('download')}
            disabled={exporting}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, padding: '11px 0',
              background: 'rgba(255,255,255,0.08)', color: '#fff',
              borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)',
              fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
              fontFamily: "'DM Sans', sans-serif",
              cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.5 : 1,
              transition: 'background 0.2s' }}
          >
            {exporting
              ? <span style={{ display: 'inline-block', width: 12, height: 12,
                  border: '2px solid rgba(255,255,255,0.6)', borderTopColor: 'transparent',
                  borderRadius: '50%', animation: 'hsc-spin 0.6s linear infinite' }} />
              : '⬇'}
            {status || 'Save PNG'}
          </button>

          <button
            onClick={() => handleExport('share')}
            disabled={exporting}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, padding: '11px 0',
              background: '#69A38D', color: '#fff',
              borderRadius: 14, border: 'none',
              fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
              fontFamily: "'DM Sans', sans-serif",
              cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.5 : 1,
              boxShadow: '0 4px 16px rgba(105,163,141,0.35)', transition: 'opacity 0.2s' }}
          >
            ↗ Share
          </button>
        </div>
      </div>

      <style>{`@keyframes hsc-spin { to { transform: rotate(360deg); } }`}</style>
    </div>,
    document.body,
  );
}

/* ─────────────────────────────────────────
   Main export component — modal trigger
───────────────────────────────────────── */
export default function HealthShareCard({ type = 'score', data = {}, trigger }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div onClick={() => setOpen(true)} style={{ display: 'inline-flex' }}>
        {trigger || (
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-black text-slate-600 hover:bg-[#69A38D]/10 hover:border-[#69A38D]/30 hover:text-[#69A38D] transition-all">
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
        )}
      </div>

      {open && <ShareModal type={type} data={data} onClose={() => setOpen(false)} />}
    </>
  );
}
