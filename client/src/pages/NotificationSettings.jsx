import { useState, useEffect } from 'react';
import { Bell, Clock, Moon, BarChart3, Apple, Target, FileText, Sparkles, Save, RotateCcw, RefreshCcw, ChevronRight } from 'lucide-react';
import { notificationPreferenceService } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function NotificationSettings() {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const { data } = await notificationPreferenceService.getPreferences();
      setPreferences(data.preferences);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
      setMessage({ type: 'error', text: 'Failed to load preferences' });
      toast.error('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleMealTimeChange = (mealType, time) => {
    setPreferences(prev => ({
      ...prev,
      mealReminders: { ...prev.mealReminders, [mealType]: time }
    }));
    setHasChanges(true);
  };

  const handleSleepScheduleChange = (field, value) => {
    setPreferences(prev => ({
      ...prev,
      sleepReminder: { ...prev.sleepReminder, [field]: value }
    }));
    setHasChanges(true);
  };

  const handleMacroTimeChange = (time) => {
    setPreferences(prev => ({
      ...prev,
      macroUpdate: { ...prev.macroUpdate, time }
    }));
    setHasChanges(true);
  };

  const handleDietTimeChange = (time) => {
    setPreferences(prev => ({
      ...prev,
      dietAdherence: { ...prev.dietAdherence, time }
    }));
    setHasChanges(true);
  };

  const handleHealthInsightTimeChange = (time) => {
    setPreferences(prev => ({
      ...prev,
      healthInsights: { ...prev.healthInsights, time }
    }));
    setHasChanges(true);
  };

  const handleGlucoseThresholdChange = (field, value) => {
    setPreferences(prev => ({
      ...prev,
      glucoseAlerts: { ...prev.glucoseAlerts, [field]: parseInt(value) }
    }));
    setHasChanges(true);
  };

  const handleToggle = (type) => {
    setPreferences(prev => ({
      ...prev,
      [type]: { ...prev[type], enabled: !prev[type].enabled }
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await notificationPreferenceService.updatePreferences(preferences);
      setMessage({ type: 'success', text: 'Preferences saved successfully!' });
      setHasChanges(false);
      toast.success('Preferences saved successfully!');
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Failed to save preferences:', error);
      setMessage({ type: 'error', text: 'Failed to save preferences' });
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    fetchPreferences();
    setMessage({ type: '', text: '' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm font-semibold">Loading preferences...</p>
        </div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <p className="text-red-500 font-semibold">Failed to load preferences</p>
        </div>
      </div>
    );
  }

  // Notification sections configuration
  const notificationSections = [
    {
      id: 'mealReminders',
      title: '🍽️ Meal Reminders',
      subtitle: 'Get reminded to log your meals',
      icon: Clock,
      color: 'orange',
      enabled: preferences.mealReminders?.enabled,
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {['breakfast', 'lunch', 'snack', 'dinner'].map(meal => (
            <div key={meal}>
              <label className="block text-sm font-semibold text-slate-700 mb-2 capitalize">
                {meal === 'breakfast' && '🌅 Breakfast'}
                {meal === 'lunch' && '☀️ Lunch'}
                {meal === 'snack' && '🍎 Snack'}
                {meal === 'dinner' && '🌙 Dinner'}
              </label>
              <input
                type="time"
                value={preferences.mealReminders[meal]}
                onChange={(e) => handleMealTimeChange(meal, e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>
          ))}
        </div>
      )
    },
    {
      id: 'sleepReminder',
      title: '😴 Sleep Reminder',
      subtitle: 'Get reminded to log your sleep',
      icon: Moon,
      color: 'indigo',
      enabled: preferences.sleepReminder?.enabled,
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Sleep Time
            </label>
            <input
              type="time"
              value={preferences.sleepReminder.time}
              onChange={(e) => handleSleepScheduleChange('time', e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Target Sleep Hours
            </label>
            <input
              type="number"
              min="4"
              max="12"
              value={preferences.sleepReminder.targetSleepHours}
              onChange={(e) => handleSleepScheduleChange('targetSleepHours', parseInt(e.target.value))}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
          </div>
        </div>
      )
    },
    {
      id: 'macroUpdate',
      title: '📊 Macro Update',
      subtitle: 'Daily macro consumption check',
      icon: BarChart3,
      color: 'blue',
      enabled: preferences.macroUpdate?.enabled,
      content: (
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Check Time
          </label>
          <input
            type="time"
            value={preferences.macroUpdate.time}
            onChange={(e) => handleMacroTimeChange(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          />
        </div>
      )
    },
    {
      id: 'dietAdherence',
      title: '📋 Diet Adherence',
      subtitle: 'Check if you\'re following your diet plan',
      icon: Apple,
      color: 'green',
      enabled: preferences.dietAdherence?.enabled,
      content: (
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Check Time
          </label>
          <input
            type="time"
            value={preferences.dietAdherence.time}
            onChange={(e) => handleDietTimeChange(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          />
        </div>
      )
    },
    {
      id: 'healthInsights',
      title: '💡 Health Insights',
      subtitle: 'Daily health tips and recommendations',
      icon: Sparkles,
      color: 'purple',
      enabled: preferences.healthInsights?.enabled,
      content: (
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Insight Time
          </label>
          <input
            type="time"
            value={preferences.healthInsights.time}
            onChange={(e) => handleHealthInsightTimeChange(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          />
        </div>
      )
    },
    {
      id: 'glucoseAlerts',
      title: '⚠️ Glucose Alerts',
      subtitle: 'Alert when glucose is abnormal',
      icon: Target,
      color: 'red',
      enabled: preferences.glucoseAlerts?.enabled,
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Low Threshold (mg/dL)
            </label>
            <input
              type="number"
              value={preferences.glucoseAlerts.lowThreshold}
              onChange={(e) => handleGlucoseThresholdChange('lowThreshold', e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              High Threshold (mg/dL)
            </label>
            <input
              type="number"
              value={preferences.glucoseAlerts.highThreshold}
              onChange={(e) => handleGlucoseThresholdChange('highThreshold', e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
          </div>
        </div>
      )
    }
  ];

  const colorMap = {
    orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    green: { bg: 'bg-green-100', text: 'text-green-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
    red: { bg: 'bg-red-100', text: 'text-red-600' }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4 md:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center shadow-sm">
              <Bell className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Notification Settings</h1>
              <p className="text-slate-500 text-sm font-semibold mt-1">Customize when you receive notifications</p>
            </div>
          </div>
        </motion.div>

        {/* Message Alert */}
        <AnimatePresence>
          {message.text && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`mb-6 p-4 rounded-2xl border backdrop-blur-sm ${
                message.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notification Sections */}
        <div className="space-y-4">
          {notificationSections.map((section, index) => {
            const colors = colorMap[section.color];
            const Icon = section.icon;

            return (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                {/* Section Header */}
                <div className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
                  onClick={() => handleToggle(section.id)}>
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-6 h-6 ${colors.text}`} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">{section.title}</h2>
                      <p className="text-sm text-slate-500 mt-0.5">{section.subtitle}</p>
                    </div>
                  </div>
                  
                  {/* Toggle Switch */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(section.id);
                    }}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors flex-shrink-0 ${
                      section.enabled ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <motion.span
                      layout
                      className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                        section.enabled ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Section Content */}
                <AnimatePresence>
                  {section.enabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t border-slate-100 px-6 py-6 bg-slate-50/50"
                    >
                      {section.content}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-4 mt-8 sticky bottom-0 bg-gradient-to-t from-slate-100 via-slate-100 to-transparent pt-6 pb-4"
        >
          <button
            onClick={handleReset}
            disabled={!hasChanges || saving}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 border border-slate-300 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            <RotateCcw className="w-5 h-5" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl font-semibold text-white hover:shadow-lg hover:shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            {saving ? (
              <>
                <RefreshCcw className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
