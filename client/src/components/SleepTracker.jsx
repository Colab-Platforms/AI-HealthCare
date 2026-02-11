import { useState, useEffect } from 'react';
import { Moon, X, Play, Pause, Edit2, Check, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SleepTracker({ isOpen, onClose }) {
  const [isTracking, setIsTracking] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [sleepHistory, setSleepHistory] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [editHours, setEditHours] = useState('');
  const [editMinutes, setEditMinutes] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Load sleep data from localStorage
  useEffect(() => {
    const savedTracking = localStorage.getItem('sleep_tracking');
    const savedHistory = localStorage.getItem('sleep_history');
    
    if (savedTracking) {
      const data = JSON.parse(savedTracking);
      setIsTracking(data.isTracking);
      setStartTime(data.startTime ? new Date(data.startTime) : null);
      
      // Calculate elapsed time if tracking
      if (data.isTracking && data.startTime) {
        const elapsed = Date.now() - new Date(data.startTime).getTime();
        setElapsedTime(elapsed);
      }
    }
    
    if (savedHistory) {
      setSleepHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Update timer every second when tracking
  useEffect(() => {
    let interval;
    if (isTracking && startTime) {
      interval = setInterval(() => {
        const elapsed = Date.now() - startTime.getTime();
        setElapsedTime(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTracking, startTime]);

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return { hours, minutes };
  };

  const startSleep = () => {
    const now = new Date();
    setIsTracking(true);
    setStartTime(now);
    setElapsedTime(0);
    
    localStorage.setItem('sleep_tracking', JSON.stringify({
      isTracking: true,
      startTime: now.toISOString()
    }));
    
    toast.success('Sleep tracking started 😴');
  };

  const stopSleep = () => {
    if (!startTime) return;
    
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    const { hours, minutes } = formatTime(duration);
    
    const sleepRecord = {
      id: Date.now(),
      date: startTime.toISOString(),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: duration,
      hours: hours,
      minutes: minutes,
      quality: calculateQuality(hours)
    };
    
    const updatedHistory = [sleepRecord, ...sleepHistory].slice(0, 7); // Keep last 7 days
    setSleepHistory(updatedHistory);
    localStorage.setItem('sleep_history', JSON.stringify(updatedHistory));
    
    setIsTracking(false);
    setStartTime(null);
    setElapsedTime(0);
    localStorage.removeItem('sleep_tracking');
    
    toast.success(`Sleep recorded: ${hours}h ${minutes}m 🌙`);
  };

  const calculateQuality = (hours) => {
    if (hours >= 7 && hours <= 9) return 85 + Math.floor(Math.random() * 15);
    if (hours >= 6 && hours < 7) return 70 + Math.floor(Math.random() * 15);
    if (hours >= 5 && hours < 6) return 55 + Math.floor(Math.random() * 15);
    return 40 + Math.floor(Math.random() * 15);
  };

  const saveManualEdit = () => {
    const hours = parseInt(editHours) || 0;
    const minutes = parseInt(editMinutes) || 0;
    
    if (hours === 0 && minutes === 0) {
      toast.error('Please enter valid time');
      return;
    }
    
    const duration = (hours * 3600 + minutes * 60) * 1000;
    const endTime = new Date(selectedDate);
    const startTime = new Date(endTime.getTime() - duration);
    
    const sleepRecord = {
      id: Date.now(),
      date: selectedDate.toISOString(),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: duration,
      hours: hours,
      minutes: minutes,
      quality: calculateQuality(hours),
      manual: true
    };
    
    const updatedHistory = [sleepRecord, ...sleepHistory].slice(0, 7);
    setSleepHistory(updatedHistory);
    localStorage.setItem('sleep_history', JSON.stringify(updatedHistory));
    
    setEditMode(false);
    setEditHours('');
    setEditMinutes('');
    toast.success('Sleep data saved manually ✅');
  };

  const getTodaySleep = () => {
    const today = new Date().toDateString();
    return sleepHistory.find(record => 
      new Date(record.date).toDateString() === today
    );
  };

  const getWeekDays = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date);
    }
    return days;
  };

  const { hours: currentHours, minutes: currentMinutes } = formatTime(elapsedTime);
  const todaySleep = getTodaySleep();
  const weekDays = getWeekDays();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden shadow-2xl border border-slate-700">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Moon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Sleep Tracker</h2>
              <p className="text-xs text-slate-400">Track your sleep quality</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Date & Week View */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-2xl font-bold text-white">
                {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
              </p>
              <p className="text-sm text-slate-400">
                {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long' })}
              </p>
            </div>
            <button onClick={() => setEditMode(!editMode)} className="p-2 hover:bg-slate-800 rounded-lg transition">
              <Calendar className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Week Days */}
          <div className="flex justify-between gap-2">
            {weekDays.map((day, index) => {
              const dayRecord = sleepHistory.find(r => 
                new Date(r.date).toDateString() === day.toDateString()
              );
              const isToday = day.toDateString() === new Date().toDateString();
              
              return (
                <div key={index} className={`flex-1 text-center ${isToday ? 'opacity-100' : 'opacity-60'}`}>
                  <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-1 ${
                    dayRecord 
                      ? 'bg-gradient-to-br from-orange-500 to-orange-600 ring-2 ring-orange-400/30' 
                      : 'bg-slate-800'
                  } ${isToday ? 'ring-2 ring-white/30' : ''}`}>
                    <span className="text-xs font-medium text-white">
                      {day.toLocaleDateString('en-US', { weekday: 'short' })[0]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Sleep Display */}
        <div className="p-6">
          {/* Quality Circle & Time */}
          <div className="flex items-center justify-between mb-6">
            {/* Quality Circle */}
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="56" stroke="#1e293b" strokeWidth="12" fill="none" />
                <circle 
                  cx="64" 
                  cy="64" 
                  r="56" 
                  stroke="url(#gradient)" 
                  strokeWidth="12" 
                  fill="none"
                  strokeDasharray={`${(todaySleep?.quality || 0) * 3.51} 351`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#fb923c" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-white">{todaySleep?.quality || 0}%</span>
                <span className="text-xs text-slate-400">Quality</span>
              </div>
            </div>

            {/* Time Stats */}
            <div className="flex-1 ml-6 space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-white">
                    {isTracking ? `${currentHours}h ${currentMinutes}m` : 
                     todaySleep ? `${todaySleep.hours}h ${todaySleep.minutes}m` : '0h 0m'}
                  </span>
                </div>
                <p className="text-sm text-slate-400">Time in bed</p>
              </div>
              
              <div>
                <span className="text-xl font-semibold text-white">
                  {isTracking ? `${currentHours}h ${currentMinutes}m` : 
                   todaySleep ? `${todaySleep.hours}h ${Math.floor(todaySleep.minutes * 0.9)}m` : '0h 0m'}
                </span>
                <p className="text-sm text-slate-400">Time asleep</p>
              </div>
            </div>
          </div>

          {/* Control Buttons */}
          {!editMode ? (
            <div className="space-y-3">
              {!isTracking ? (
                <button
                  onClick={startSleep}
                  className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 transition shadow-lg"
                >
                  <Play className="w-5 h-5" />
                  Start Sleep Tracking
                </button>
              ) : (
                <button
                  onClick={stopSleep}
                  className="w-full py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 transition shadow-lg animate-pulse"
                >
                  <Pause className="w-5 h-5" />
                  Stop & Save Sleep
                </button>
              )}
              
              <button
                onClick={() => setEditMode(true)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-medium flex items-center justify-center gap-2 transition"
              >
                <Edit2 className="w-4 h-4" />
                Manually Edit Sleep Time
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-800 rounded-2xl p-4">
                <p className="text-sm text-slate-400 mb-3">Enter sleep duration</p>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <input
                      type="number"
                      value={editHours}
                      onChange={(e) => setEditHours(e.target.value)}
                      placeholder="Hours"
                      className="w-full px-4 py-3 bg-slate-900 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      min="0"
                      max="24"
                    />
                    <p className="text-xs text-slate-500 mt-1 text-center">Hours</p>
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={editMinutes}
                      onChange={(e) => setEditMinutes(e.target.value)}
                      placeholder="Minutes"
                      className="w-full px-4 py-3 bg-slate-900 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      min="0"
                      max="59"
                    />
                    <p className="text-xs text-slate-500 mt-1 text-center">Minutes</p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={saveManualEdit}
                  className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 transition"
                >
                  <Check className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditMode(false);
                    setEditHours('');
                    setEditMinutes('');
                  }}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Sleep History */}
          {sleepHistory.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-700">
              <h3 className="text-sm font-semibold text-slate-400 mb-3">Recent Sleep History</h3>
              <div className="space-y-2">
                {sleepHistory.slice(0, 3).map((record) => (
                  <div key={record.id} className="bg-slate-800/50 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {new Date(record.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-xs text-slate-400">
                        {record.hours}h {record.minutes}m {record.manual && '(Manual)'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-orange-400">{record.quality}%</p>
                      <p className="text-xs text-slate-500">Quality</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
