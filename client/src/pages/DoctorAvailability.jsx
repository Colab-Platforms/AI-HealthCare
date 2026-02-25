import { useState, useEffect } from 'react';
import { doctorService } from '../services/api';
import { Clock, Calendar, Save, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_SETTINGS = {
  startTime: '09:00',
  endTime: '18:00',
  slotDuration: 30
};

export default function DoctorAvailability() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [weekSlots, setWeekSlots] = useState({});
  const [blockedSlots, setBlockedSlots] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Get next 7 days starting from today
  const getNext7Days = () => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push({
        date: date.toISOString().split('T')[0],
        dayName: DAYS[date.getDay()],
        displayDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        isToday: i === 0
      });
    }
    return days;
  };

  const [weekDays] = useState(getNext7Days());

  useEffect(() => {
    fetchAvailability();
  }, []);

  const fetchAvailability = async () => {
    try {
      const { data } = await doctorService.getMyAvailability();
      
      // Merge with defaults to ensure all fields exist
      const fetchedSettings = {
        startTime: data.availability?.settings?.startTime || DEFAULT_SETTINGS.startTime,
        endTime: data.availability?.settings?.endTime || DEFAULT_SETTINGS.endTime,
        slotDuration: data.availability?.settings?.slotDuration || DEFAULT_SETTINGS.slotDuration
      };
      
      setSettings(fetchedSettings);
      
      if (data.availability?.blockedSlots) {
        setBlockedSlots(data.availability.blockedSlots);
      }
      
      generateSlots(fetchedSettings);
    } catch (error) {
      console.error('Failed to fetch availability:', error);
      generateSlots(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  };

  // Generate time slots based on settings
  const generateSlots = (config) => {
    if (!config) {
      config = DEFAULT_SETTINGS;
    }
    
    const slots = {};
    const startTime = config.startTime || DEFAULT_SETTINGS.startTime;
    const endTime = config.endTime || DEFAULT_SETTINGS.endTime;
    const slotDuration = config.slotDuration || DEFAULT_SETTINGS.slotDuration;
    
    // Parse times safely
    const startParts = startTime.split(':');
    const endParts = endTime.split(':');
    
    if (startParts.length < 2 || endParts.length < 2) {
      console.error('Invalid time format');
      return;
    }
    
    const startHour = parseInt(startParts[0], 10);
    const startMin = parseInt(startParts[1], 10);
    const endHour = parseInt(endParts[0], 10);
    const endMin = parseInt(endParts[1], 10);
    
    weekDays.forEach(day => {
      slots[day.date] = [];
      
      let currentTime = startHour * 60 + startMin;
      const endTimeMinutes = endHour * 60 + endMin;
      
      while (currentTime < endTimeMinutes) {
        const hours = Math.floor(currentTime / 60);
        const mins = currentTime % 60;
        const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        const displayTime = new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        
        slots[day.date].push({
          time: timeStr,
          display: displayTime
        });
        
        currentTime += slotDuration;
      }
    });
    
    setWeekSlots(slots);
  };

  const handleSettingsChange = (field, value) => {
    const newSettings = { ...settings, [field]: value };
    setSettings(newSettings);
    generateSlots(newSettings);
  };

  const toggleSlotBlock = (date, time) => {
    setBlockedSlots(prev => {
      const dateBlocks = prev[date] || [];
      if (dateBlocks.includes(time)) {
        return { ...prev, [date]: dateBlocks.filter(t => t !== time) };
      } else {
        return { ...prev, [date]: [...dateBlocks, time] };
      }
    });
  };

  const toggleDayBlock = (date) => {
    const daySlots = weekSlots[date] || [];
    const currentBlocked = blockedSlots[date] || [];
    
    if (currentBlocked.length === daySlots.length) {
      setBlockedSlots(prev => ({ ...prev, [date]: [] }));
    } else {
      setBlockedSlots(prev => ({ ...prev, [date]: daySlots.map(s => s.time) }));
    }
  };

  const isSlotBlocked = (date, time) => {
    return (blockedSlots[date] || []).includes(time);
  };

  const isDayFullyBlocked = (date) => {
    const daySlots = weekSlots[date] || [];
    const blocked = blockedSlots[date] || [];
    return daySlots.length > 0 && blocked.length === daySlots.length;
  };

  const saveAvailability = async () => {
    setSaving(true);
    try {
      const response = await doctorService.updateMyAvailability({
        settings,
        blockedSlots
      });
      console.log('Save response:', response.data);
      toast.success('Availability saved successfully!');
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error(error.response?.data?.message || 'Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading availability...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manage Your Slots</h1>
          <p className="text-slate-500 mt-1">Set your operating hours and block unavailable times</p>
        </div>
        <button
          onClick={saveAvailability}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-orange-500 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          Save Changes
        </button>
      </div>

      {/* Operating Hours Settings */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-cyan-500" />
          Operating Hours
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Start Time</label>
            <select
              value={settings.startTime}
              onChange={(e) => handleSettingsChange('startTime', e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:border-cyan-500 focus:outline-none"
            >
              {Array.from({ length: 24 }, (_, i) => {
                const time = `${i.toString().padStart(2, '0')}:00`;
                const display = new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                return <option key={time} value={time}>{display}</option>;
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">End Time</label>
            <select
              value={settings.endTime}
              onChange={(e) => handleSettingsChange('endTime', e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:border-cyan-500 focus:outline-none"
            >
              {Array.from({ length: 24 }, (_, i) => {
                const time = `${i.toString().padStart(2, '0')}:00`;
                const display = new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                return <option key={time} value={time}>{display}</option>;
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Slot Duration</label>
            <select
              value={settings.slotDuration}
              onChange={(e) => handleSettingsChange('slotDuration', parseInt(e.target.value))}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:border-cyan-500 focus:outline-none"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </div>
        </div>
        <p className="text-sm text-slate-400 mt-3">
          Current: {settings.startTime} to {settings.endTime}, {settings.slotDuration} min slots
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-emerald-100 border-2 border-emerald-300"></div>
          <span className="text-slate-600">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-100 border-2 border-red-300"></div>
          <span className="text-slate-600">Blocked</span>
        </div>
        <p className="text-slate-400 ml-auto">Click on slots to block/unblock</p>
      </div>

      {/* Weekly Slots */}
      <div className="space-y-4">
        {weekDays.map((day) => {
          const daySlots = weekSlots[day.date] || [];
          const isFullyBlocked = isDayFullyBlocked(day.date);
          
          return (
            <div key={day.date} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-cyan-500" />
                  <div>
                    <h3 className="font-semibold text-slate-800">
                      {day.dayName}
                      {day.isToday && <span className="ml-2 text-xs bg-cyan-100 text-cyan-600 px-2 py-0.5 rounded-full">Today</span>}
                    </h3>
                    <p className="text-sm text-slate-500">{day.displayDate}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleDayBlock(day.date)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isFullyBlocked
                      ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                      : 'bg-red-100 text-red-600 hover:bg-red-200'
                  }`}
                >
                  {isFullyBlocked ? (
                    <span className="flex items-center gap-1"><Check className="w-4 h-4" /> Unblock All</span>
                  ) : (
                    <span className="flex items-center gap-1"><X className="w-4 h-4" /> Block Day</span>
                  )}
                </button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {daySlots.map((slot) => {
                  const blocked = isSlotBlocked(day.date, slot.time);
                  return (
                    <button
                      key={slot.time}
                      onClick={() => toggleSlotBlock(day.date, slot.time)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        blocked 
                          ? 'bg-red-100 text-red-600 border border-red-200 hover:bg-red-200' 
                          : 'bg-emerald-100 text-emerald-600 border border-emerald-200 hover:bg-emerald-200'
                      }`}
                    >
                      {slot.display}
                    </button>
                  );
                })}
                {daySlots.length === 0 && (
                  <p className="text-slate-400 text-sm py-2">No slots - check your operating hours</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Help */}
      <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
        <h3 className="font-medium text-cyan-800 mb-2">💡 Quick Tips</h3>
        <ul className="text-sm text-cyan-700 space-y-1">
          <li>• Set your operating hours above to auto-generate time slots</li>
          <li>• Click individual slots to block specific times</li>
          <li>• Use "Block Day" to mark entire days as unavailable</li>
          <li>• Don't forget to save your changes!</li>
        </ul>
      </div>
    </div>
  );
}
