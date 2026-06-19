import { useState, useEffect, useRef } from 'react';
import {
  Bell, Clock, Moon, BarChart3, Apple, Target, Sparkles,
  Save, RotateCcw, RefreshCcw, Check, Utensils, BellOff,
  Zap, Shield, ChevronRight, Activity, ChevronUp, ChevronDown, X
} from 'lucide-react';
import { notificationPreferenceService } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const CATEGORIES = [
  {
    id: 'mealReminders',
    label: 'Meal Reminders',
    icon: Utensils,
    color: { from: '#f97316', to: '#fb923c', light: '#fff7ed', text: '#ea580c', ring: 'ring-orange-300', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-600' },
    description: 'Breakfast, lunch, snack & dinner alerts',
  },
  {
    id: 'sleepReminder',
    label: 'Sleep Reminder',
    icon: Moon,
    color: { from: '#6366f1', to: '#818cf8', light: '#eef2ff', text: '#4f46e5', ring: 'ring-indigo-300', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-600' },
    description: 'Bedtime & sleep goal tracking',
  },
  {
    id: 'macroUpdate',
    label: 'Macro Update',
    icon: BarChart3,
    color: { from: '#3b82f6', to: '#60a5fa', light: '#eff6ff', text: '#2563eb', ring: 'ring-blue-300', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-600' },
    description: 'Daily nutrition & macro check',
  },
  {
    id: 'dietAdherence',
    label: 'Diet Adherence',
    icon: Apple,
    color: { from: '#22c55e', to: '#4ade80', light: '#f0fdf4', text: '#16a34a', ring: 'ring-green-300', border: 'border-green-200', badge: 'bg-green-100 text-green-600' },
    description: 'Are you following your diet plan?',
  },
  {
    id: 'healthInsights',
    label: 'Health Insights',
    icon: Sparkles,
    color: { from: '#a855f7', to: '#c084fc', light: '#faf5ff', text: '#9333ea', ring: 'ring-purple-300', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-600' },
    description: 'Daily tips & personalized advice',
  },
  {
    id: 'glucoseAlerts',
    label: 'Glucose Alerts',
    icon: Activity,
    color: { from: '#ef4444', to: '#f87171', light: '#fef2f2', text: '#dc2626', ring: 'ring-red-300', border: 'border-red-200', badge: 'bg-red-100 text-red-600' },
    description: 'Blood sugar threshold alerts',
  },
];

const MEALS = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🌅', hint: 'Morning start' },
  { key: 'lunch', label: 'Lunch',     emoji: '☀️', hint: 'Midday fuel' },
  { key: 'snack',  label: 'Snack',    emoji: '🍎', hint: 'Afternoon boost' },
  { key: 'dinner', label: 'Dinner',   emoji: '🌙', hint: 'Evening meal' },
];

function TimePicker({ value, onChange, label, hint }) {
  const [open, setOpen] = useState(false);

  const [h24, min] = (value || '08:00').split(':').map(Number);
  const isPM = h24 >= 12;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;

  const setHour12 = (newH12) => {
    const newH24 = isPM ? (newH12 === 12 ? 12 : newH12 + 12) : (newH12 === 12 ? 0 : newH12);
    onChange(`${String(newH24).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  };
  const setMinute = (newMin) => {
    onChange(`${String(h24).padStart(2, '0')}:${String(newMin).padStart(2, '0')}`);
  };
  const toggleAMPM = () => {
    const newH24 = isPM ? (h24 - 12 + 24) % 24 : (h24 + 12) % 24;
    onChange(`${String(newH24).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  };

  const nextMin = () => setMinute((min + 1) % 60);
  const prevMin = () => setMinute((min - 1 + 60) % 60);

  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>}
      {hint && <span className="text-xs text-slate-400">{hint}</span>}

      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-3 px-4 py-3 bg-white border rounded-2xl shadow-sm hover:shadow-md transition-all group w-full ${open ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-300'}`}
      >
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${open ? 'bg-emerald-50' : 'bg-slate-100 group-hover:bg-emerald-50'}`}>
          <Clock className={`w-4 h-4 transition-colors ${open ? 'text-emerald-500' : 'text-slate-400 group-hover:text-emerald-500'}`} />
        </div>
        <div className="flex items-baseline gap-1 flex-1 text-left">
          <span className="text-2xl font-black text-slate-800 tabular-nums">{String(h12).padStart(2, '0')}:{String(min).padStart(2, '0')}</span>
          <span className={`text-sm font-bold ml-1 ${isPM ? 'text-orange-500' : 'text-blue-500'}`}>{isPM ? 'PM' : 'AM'}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform duration-200 ${open ? 'rotate-180 text-emerald-400' : ''}`} />
      </button>

      {/* Inline picker — expands in normal flow, no absolute positioning */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="bg-slate-900 rounded-2xl p-4 mt-1">
              <div className="flex items-stretch gap-3">

                {/* Hour column */}
                <div className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hour</span>
                  <button onClick={() => setHour12(h12 === 12 ? 1 : h12 + 1)} className="w-full flex justify-center py-2 rounded-xl hover:bg-white/10 active:bg-white/20 transition-colors">
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  </button>
                  <div className="w-full text-center py-2.5 bg-white/10 rounded-xl border border-white/10">
                    <span className="text-3xl font-black text-white tabular-nums">{String(h12).padStart(2, '0')}</span>
                  </div>
                  <button onClick={() => setHour12(h12 === 1 ? 12 : h12 - 1)} className="w-full flex justify-center py-2 rounded-xl hover:bg-white/10 active:bg-white/20 transition-colors">
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="flex items-center">
                  <span className="text-3xl font-black text-slate-500 select-none">:</span>
                </div>

                {/* Minute column */}
                <div className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Min</span>
                  <button onClick={nextMin} className="w-full flex justify-center py-2 rounded-xl hover:bg-white/10 active:bg-white/20 transition-colors">
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  </button>
                  <div className="w-full text-center py-2.5 bg-white/10 rounded-xl border border-white/10">
                    <span className="text-3xl font-black text-white tabular-nums">{String(min).padStart(2, '0')}</span>
                  </div>
                  <button onClick={prevMin} className="w-full flex justify-center py-2 rounded-xl hover:bg-white/10 active:bg-white/20 transition-colors">
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                {/* AM/PM column */}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">\u200E</span>
                  <div className="flex flex-col gap-2 mt-1">
                    <button
                      onClick={() => { if (isPM) toggleAMPM(); }}
                      className={`px-4 py-2.5 rounded-xl text-sm font-black transition-all ${!isPM ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}
                    >AM</button>
                    <button
                      onClick={() => { if (!isPM) toggleAMPM(); }}
                      className={`px-4 py-2.5 rounded-xl text-sm font-black transition-all ${isPM ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}
                    >PM</button>
                  </div>
                </div>
              </div>

              {/* Confirm */}
              <button
                onClick={() => setOpen(false)}
                className="mt-4 w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold transition-colors active:scale-95 shadow-lg shadow-emerald-500/20"
              >
                Done — {String(h12).padStart(2, '0')}:{String(min).padStart(2, '0')} {isPM ? 'PM' : 'AM'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToggleSwitch({ enabled, onChange, color }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        enabled ? `focus:ring-emerald-400` : 'focus:ring-slate-300'
      } ${enabled ? 'bg-emerald-500 shadow-md shadow-emerald-200' : 'bg-slate-200'}`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 700, damping: 30 }}
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  );
}

function MealPanel({ prefs, onChange }) {
  return (
    <div className="space-y-5">
      {/* Visual meal timeline */}
      <div className="relative h-12 bg-gradient-to-r from-orange-50 via-yellow-50 to-orange-50 rounded-2xl overflow-hidden border border-orange-100">
        <div className="absolute inset-0 flex items-center px-4">
          <div className="flex-1 flex items-center gap-1">
            {[...Array(24)].map((_, i) => (
              <div key={i} className={`flex-1 h-1 rounded-full ${i >= 6 && i <= 22 ? 'bg-orange-200' : 'bg-slate-100'}`} />
            ))}
          </div>
        </div>
        {MEALS.map((meal, idx) => {
          const time = prefs[meal.key] || '00:00';
          const [h, m] = time.split(':').map(Number);
          const pct = ((h * 60 + m) / (24 * 60)) * 100;
          return (
            <div
              key={meal.key}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${pct}%` }}
            >
              <div className="w-7 h-7 rounded-full bg-white border-2 border-orange-400 shadow-md flex items-center justify-center text-sm">
                {meal.emoji}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-400 text-center">Visual timeline of your meal reminders throughout the day</p>

      <div className="grid grid-cols-2 gap-4">
        {MEALS.map(meal => (
          <div key={meal.key} className="bg-orange-50/60 border border-orange-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{meal.emoji}</span>
              <div>
                <p className="text-sm font-bold text-slate-800">{meal.label}</p>
                <p className="text-xs text-slate-400">{meal.hint}</p>
              </div>
            </div>
            <TimePicker
              value={prefs[meal.key]}
              onChange={val => onChange(meal.key, val)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SleepPanel({ prefs, onChange }) {
  const hrs = prefs.targetSleepHours || 8;
  return (
    <div className="space-y-6">
      {/* Sleep arc visualization */}
      <div className="relative bg-gradient-to-b from-indigo-950 to-indigo-800 rounded-2xl p-6 overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, #6366f1 0%, transparent 60%), radial-gradient(circle at 80% 50%, #818cf8 0%, transparent 60%)'
        }} />
        <div className="relative flex items-center justify-between">
          <div className="text-center">
            <p className="text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-1">Bedtime</p>
            <p className="text-white text-2xl font-black">{prefs.time || '22:00'}</p>
          </div>
          <div className="flex-1 flex items-center justify-center gap-2 px-4">
            <div className="h-px flex-1 bg-indigo-600" />
            <Moon className="w-5 h-5 text-indigo-300" />
            <div className="h-px flex-1 bg-indigo-600" />
          </div>
          <div className="text-center">
            <p className="text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-1">Target</p>
            <p className="text-white text-2xl font-black">{hrs}h</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TimePicker
          value={prefs.time}
          onChange={val => onChange('time', val)}
          label="Reminder Time"
          hint="When to go to bed"
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sleep Goal</span>
          <span className="text-xs text-slate-400">Recommended hours</span>
          <div className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <button
              onClick={() => onChange('targetSleepHours', Math.max(4, hrs - 1))}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors flex-shrink-0"
            >
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </button>
            <div className="flex-1 text-center">
              <span className="text-2xl font-black text-slate-800">{hrs}</span>
              <span className="text-sm font-bold text-slate-400 ml-1">hrs</span>
            </div>
            <button
              onClick={() => onChange('targetSleepHours', Math.min(12, hrs + 1))}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors flex-shrink-0"
            >
              <ChevronUp className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SingleTimePanel({ value, onChange, color, label = 'Reminder Time', hint }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="max-w-xs">
        <TimePicker value={value} onChange={onChange} label={label} hint={hint} />
      </div>
      <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: color.light }}>
        <Zap className="w-5 h-5 flex-shrink-0" style={{ color: color.text }} />
        <p className="text-sm font-medium" style={{ color: color.text }}>
          You'll receive this notification once per day at the set time.
        </p>
      </div>
    </div>
  );
}

function GlucosePanel({ prefs, onChange }) {
  const low = prefs.lowThreshold || 70;
  const high = prefs.highThreshold || 180;
  const range = high - low;
  const totalRange = 300;
  const lowPct = (low / totalRange) * 100;
  const highPct = (high / totalRange) * 100;

  return (
    <div className="space-y-6">
      {/* Visual range bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Target Range Visualization</p>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1">
            Normal: {low}–{high} mg/dL
          </span>
        </div>
        <div className="relative h-6 bg-slate-100 rounded-full overflow-hidden">
          <div className="absolute inset-y-0 bg-red-300 rounded-l-full" style={{ left: 0, width: `${lowPct}%` }} />
          <div className="absolute inset-y-0 bg-emerald-300" style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }} />
          <div className="absolute inset-y-0 bg-red-300 rounded-r-full" style={{ left: `${highPct}%`, right: 0 }} />
        </div>
        <div className="flex justify-between text-xs font-semibold">
          <span className="text-slate-400">0</span>
          <span className="text-red-500">Low &lt;{low}</span>
          <span className="text-emerald-600">Normal</span>
          <span className="text-red-500">High &gt;{high}</span>
          <span className="text-slate-400">300+</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { key: 'lowThreshold', label: 'Low Alert', hint: 'Alert below this value', icon: '🔵', accent: 'focus:ring-blue-400' },
          { key: 'highThreshold', label: 'High Alert', hint: 'Alert above this value', icon: '🔴', accent: 'focus:ring-red-400' },
        ].map(({ key, label, hint, icon, accent }) => (
          <div key={key} className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{icon}</span>
              <div>
                <p className="text-sm font-bold text-slate-800">{label}</p>
                <p className="text-xs text-slate-400">{hint}</p>
              </div>
            </div>
            <div className="relative">
              <input
                type="number"
                value={prefs[key]}
                onChange={e => onChange(key, e.target.value)}
                className={`w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 ${accent} focus:border-transparent transition-all shadow-sm`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">mg/dL</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NotificationSettings() {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeCategory, setActiveCategory] = useState('mealReminders');
  const [sheetOpen, setSheetOpen] = useState(false);
  const prefsRef = useRef(null);
  const saveTimerRef = useRef(null);

  useEffect(() => { fetchPreferences(); }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const { data } = await notificationPreferenceService.getPreferences();
      setPreferences(data.preferences);
      prefsRef.current = data.preferences;
      setHasChanges(false);
    } catch {
      toast.error('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const autoSave = (newPrefs) => {
    // Debounce: wait 800ms after last change before saving
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        await notificationPreferenceService.updatePreferences(newPrefs);
        setHasChanges(false);
        setSaved(true);
        toast.success('Preferences saved!');
        setTimeout(() => setSaved(false), 2000);
      } catch {
        toast.error('Failed to save preferences');
      } finally {
        setSaving(false);
      }
    }, 800);
  };

  const update = (path, value) => {
    setPreferences(prev => {
      const next = { ...prev };
      if (path.length === 1) next[path[0]] = value;
      else if (path.length === 2) next[path[0]] = { ...next[path[0]], [path[1]]: value };
      prefsRef.current = next;
      autoSave(next);
      return next;
    });
    setHasChanges(true);
  };

  const handleToggle = id => update([id, 'enabled'], !preferences[id]?.enabled);

  const handleSave = async () => {
    clearTimeout(saveTimerRef.current);
    try {
      setSaving(true);
      await notificationPreferenceService.updatePreferences(preferences);
      setHasChanges(false);
      setSaved(true);
      toast.success('Preferences saved!');
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const activeCount = preferences
    ? CATEGORIES.filter(c => preferences[c.id]?.enabled).length
    : 0;

  const activeCat = CATEGORIES.find(c => c.id === activeCategory);
  const activePref = preferences?.[activeCategory] || {};

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
              <Bell className="w-7 h-7 text-emerald-500" />
            </div>
            <div className="absolute -inset-1 rounded-2xl border-2 border-emerald-300 animate-ping opacity-40" />
          </div>
          <p className="text-slate-500 text-sm font-semibold">Loading your preferences...</p>
        </div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <BellOff className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-slate-500 font-semibold">Failed to load preferences</p>
          <button onClick={fetchPreferences} className="text-emerald-600 text-sm font-semibold hover:underline">Try again</button>
        </div>
      </div>
    );
  }

  const renderPanel = () => {
    const p = preferences;
    switch (activeCategory) {
      case 'mealReminders':
        return <MealPanel prefs={p.mealReminders || {}} onChange={(k, v) => update(['mealReminders', k], v)} />;
      case 'sleepReminder':
        return <SleepPanel prefs={p.sleepReminder || {}} onChange={(k, v) => update(['sleepReminder', k], v)} />;
      case 'macroUpdate':
        return <SingleTimePanel value={p.macroUpdate?.time} onChange={v => update(['macroUpdate', 'time'], v)} color={activeCat.color} label="Check Time" hint="When to review your macros today" />;
      case 'dietAdherence':
        return <SingleTimePanel value={p.dietAdherence?.time} onChange={v => update(['dietAdherence', 'time'], v)} color={activeCat.color} label="Check Time" hint="When to review your diet adherence" />;
      case 'healthInsights':
        return <SingleTimePanel value={p.healthInsights?.time} onChange={v => update(['healthInsights', 'time'], v)} color={activeCat.color} label="Insight Time" hint="When to receive your daily health tip" />;
      case 'glucoseAlerts':
        return <GlucosePanel prefs={p.glucoseAlerts || {}} onChange={(k, v) => update(['glucoseAlerts', k], parseInt(v))} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 px-6 py-10 md:px-10">
        {/* background blobs */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-white/5 rounded-full translate-y-1/2" />

        <div className="relative max-w-5xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-5">
            <motion.div
              animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 4 }}
              className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur border border-white/20 flex items-center justify-center shadow-xl flex-shrink-0"
            >
              <Bell className="w-8 h-8 text-white" />
            </motion.div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Notification Settings</h1>
              <p className="text-emerald-100 text-sm font-medium mt-1">Control when & how you're reminded</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-white/15 backdrop-blur rounded-2xl px-5 py-3 border border-white/20">
              <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wider">Active</p>
              <p className="text-white text-2xl font-black">{activeCount}<span className="text-emerald-200 text-sm font-semibold"> / {CATEGORIES.length}</span></p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-2xl px-5 py-3 border border-white/20">
              <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wider">Status</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                <p className="text-white text-sm font-bold">Live</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Left Sidebar — Category List */}
          <div className="lg:w-72 flex-shrink-0">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Categories</p>
              </div>
              <div className="p-2 space-y-1">
                {CATEGORIES.map(cat => {
                  const enabled = preferences[cat.id]?.enabled;
                  const isActive = activeCategory === cat.id;
                  const Icon = cat.icon;
                  return (
                    <motion.button
                      key={cat.id}
                      onClick={() => { setActiveCategory(cat.id); setSheetOpen(true); }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl transition-all text-left group ${
                        isActive
                          ? 'bg-slate-900 shadow-md'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                        style={{ background: isActive ? 'rgba(255,255,255,0.15)' : cat.color.light }}
                      >
                        <Icon className="w-4 h-4" style={{ color: isActive ? 'white' : cat.color.text }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isActive ? 'text-white' : 'text-slate-700'}`}>{cat.label}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {enabled ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isActive ? 'bg-emerald-500/30 text-emerald-300' : 'bg-emerald-100 text-emerald-600'}`}>On</span>
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isActive ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-400'}`}>Off</span>
                        )}
                        <ChevronRight className={`w-3.5 h-3.5 transition-all ${isActive ? 'text-slate-400' : 'text-slate-300 group-hover:text-slate-400'}`} />
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Quick Tips Card */}
            <div className="mt-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-3xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600" />
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Pro Tips</p>
              </div>
              <ul className="space-y-2">
                {[
                  'Set meal reminders 10 min before eating',
                  'Sleep reminders work best 30 min early',
                  'Glucose alerts are real-time — no delay',
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-700 font-medium leading-relaxed">{tip}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Content Panel — desktop only */}
          <div className="flex-1 min-w-0 hidden lg:block">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCategory}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Panel Header */}
                <div className="p-6 border-b border-slate-100" style={{ background: activeCat.color.light }}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
                        style={{ background: `linear-gradient(135deg, ${activeCat.color.from}, ${activeCat.color.to})` }}
                      >
                        {(() => { const Icon = activeCat.icon; return <Icon className="w-6 h-6 text-white" />; })()}
                      </div>
                      <div>
                        <h2 className="text-lg font-black text-slate-900">{activeCat.label}</h2>
                        <p className="text-sm text-slate-500 font-medium mt-0.5">{activeCat.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-sm font-semibold ${activePref.enabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {activePref.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <ToggleSwitch
                        enabled={!!activePref.enabled}
                        onChange={() => handleToggle(activeCategory)}
                        color={activeCat.color}
                      />
                    </div>
                  </div>
                </div>

                {/* Panel Body */}
                <div className="p-6">
                  <AnimatePresence mode="wait">
                    {activePref.enabled ? (
                      <motion.div
                        key="content"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                      >
                        {renderPanel()}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="disabled"
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center py-16 gap-4"
                      >
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                          <BellOff className="w-8 h-8 text-slate-300" />
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-slate-500 text-lg">Notifications Off</p>
                          <p className="text-slate-400 text-sm mt-1">Toggle on to configure {activeCat.label.toLowerCase()}</p>
                        </div>
                        <button
                          onClick={() => handleToggle(activeCategory)}
                          className="mt-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:shadow-lg active:scale-95"
                          style={{ background: `linear-gradient(135deg, ${activeCat.color.from}, ${activeCat.color.to})` }}
                        >
                          Enable {activeCat.label}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Sheet */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 bg-slate-200 rounded-full" />
              </div>

              {/* Sheet Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex-shrink-0" style={{ background: activeCat.color.light }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${activeCat.color.from}, ${activeCat.color.to})` }}
                    >
                      {(() => { const Icon = activeCat.icon; return <Icon className="w-5 h-5 text-white" />; })()}
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900">{activeCat.label}</h2>
                      <p className="text-xs text-slate-500 font-medium">{activeCat.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-bold ${activePref.enabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {activePref.enabled ? 'On' : 'Off'}
                    </span>
                    <ToggleSwitch
                      enabled={!!activePref.enabled}
                      onChange={() => handleToggle(activeCategory)}
                    />
                  </div>
                </div>
              </div>

              {/* Sheet Body — scrollable */}
              <div className="flex-1 overflow-y-auto px-5 py-5">
                <AnimatePresence mode="wait">
                  {activePref.enabled ? (
                    <motion.div
                      key="content"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      {renderPanel()}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="disabled"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-12 gap-4"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <BellOff className="w-7 h-7 text-slate-300" />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-slate-500">Notifications Off</p>
                        <p className="text-slate-400 text-sm mt-1">Toggle on above to configure</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Sheet Footer */}
              <div className="px-5 pt-4 pb-24 border-t border-slate-100 flex-shrink-0 bg-white">
                <button
                  onClick={() => setSheetOpen(false)}
                  className="w-full py-3 rounded-2xl bg-slate-900 text-white font-bold text-sm active:scale-95 transition-all"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Save Bar */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-3 bg-slate-900 rounded-2xl shadow-2xl shadow-slate-900/40 px-4 py-3 border border-slate-700">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
              <p className="text-slate-300 text-sm font-semibold whitespace-nowrap">You have unsaved changes</p>
              <div className="flex items-center gap-2 ml-2">
                <button
                  onClick={fetchPreferences}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-70 active:scale-95 shadow-lg shadow-emerald-500/30"
                >
                  {saving ? (
                    <><RefreshCcw className="w-3.5 h-3.5 animate-spin" />Saving...</>
                  ) : saved ? (
                    <><Check className="w-3.5 h-3.5" />Saved!</>
                  ) : (
                    <><Save className="w-3.5 h-3.5" />Save Changes</>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
