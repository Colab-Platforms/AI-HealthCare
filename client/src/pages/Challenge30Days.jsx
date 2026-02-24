import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Flame, CheckCircle, Circle, Calendar, Target, Award } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const CHALLENGE_TASKS = [
  { id: 'water', label: 'Drink 8 glasses of water', icon: '💧' },
  { id: 'workout', label: 'Workout/Yoga (30 mins)', icon: '🧘' },
  { id: 'nutrition', label: 'Healthy Nutrition (within goal)', icon: '🥗' },
  { id: 'sleep', label: 'Sleep 7-8 hours', icon: '😴' },
];

export default function Challenge30Days() {
  const [currentDay, setCurrentDay] = useState(() => {
    // Load current day from localStorage on mount
    const saved = localStorage.getItem('challenge30DaysCurrentDay');
    return saved ? parseInt(saved) : 1;
  });
  const [challengeData, setChallengeData] = useState({});
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);

    // Load challenge data from backend
    loadChallengeData();
  }, []);

  // Save current day whenever it changes
  useEffect(() => {
    localStorage.setItem('challenge30DaysCurrentDay', currentDay);
  }, [currentDay]);

  const loadChallengeData = async () => {
    // First load from localStorage immediately for instant display
    const savedData = localStorage.getItem('challenge30Days');
    const savedStreak = localStorage.getItem('challenge30DaysStreak');

    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setChallengeData(data);
        setStreak(parseInt(savedStreak) || 0);
      } catch (e) {
        console.error('Error parsing saved data:', e);
      }
    }

    // Then try to load from backend
    try {
      const response = await api.get('/health/challenge');
      const data = response.data.challengeData || {};

      // Convert Map to plain object if needed
      const plainData = {};
      if (data && typeof data === 'object') {
        Object.keys(data).forEach(day => {
          plainData[day] = data[day];
        });
      }

      setChallengeData(plainData);
      setStreak(response.data.streakDays || 0);

      // Save to localStorage
      localStorage.setItem('challenge30Days', JSON.stringify(plainData));
      localStorage.setItem('challenge30DaysStreak', response.data.streakDays || 0);
    } catch (error) {
      console.error('Failed to load challenge data from server:', error);
      // Already loaded from localStorage above, so just continue
    } finally {
      setLoading(false);
    }
  };

  const saveChallengeData = async (newData) => {
    // Calculate streak locally first
    let localStreak = 0;
    const days = Object.keys(newData).map(Number).sort((a, b) => b - a);

    for (const day of days) {
      const dayData = newData[day];
      const completedTasks = Object.values(dayData).filter(Boolean).length;

      if (completedTasks >= CHALLENGE_TASKS.length) {
        localStreak++;
      } else {
        break;
      }
    }

    // Update UI immediately
    setStreak(localStreak);

    // Save to localStorage immediately
    localStorage.setItem('challenge30Days', JSON.stringify(newData));
    localStorage.setItem('challenge30DaysStreak', localStreak);

    // Try to save to backend
    try {
      const response = await api.post('/health/challenge', {
        challengeData: newData
      });

      // Update with server's calculation if different
      if (response.data.streakDays !== localStreak) {
        setStreak(response.data.streakDays);
        localStorage.setItem('challenge30DaysStreak', response.data.streakDays);
      }
    } catch (error) {
      console.error('Failed to save challenge data to server:', error);
      // Don't show error to user since localStorage worked
      // The data will sync next time they load the page
    }
  };

  const calculateStreak = (data) => {
    let currentStreak = 0;
    for (let i = currentDay; i >= 1; i--) {
      const dayData = data[i];
      if (dayData && Object.values(dayData).filter(Boolean).length >= CHALLENGE_TASKS.length) {
        currentStreak++;
      } else {
        break;
      }
    }
    setStreak(currentStreak);
  };

  const toggleTask = (day, taskId) => {
    const newData = {
      ...challengeData,
      [day]: {
        ...challengeData[day],
        [taskId]: !challengeData[day]?.[taskId]
      }
    };
    setChallengeData(newData);

    // Save to backend
    saveChallengeData(newData);

    // Show encouragement
    const completed = Object.values(newData[day]).filter(Boolean).length;
    if (completed === CHALLENGE_TASKS.length) {
      toast.success('🎉 Amazing! You completed all tasks for today!');
    }
  };

  const getDayProgress = (day) => {
    const dayData = challengeData[day] || {};
    const completed = Object.values(dayData).filter(Boolean).length;
    return (completed / CHALLENGE_TASKS.length) * 100;
  };

  const getTotalProgress = () => {
    let totalCompleted = 0;
    for (let i = 1; i <= 30; i++) {
      const dayData = challengeData[i] || {};
      totalCompleted += Object.values(dayData).filter(Boolean).length;
    }
    return (totalCompleted / (CHALLENGE_TASKS.length * 30)) * 100;
  };

  const getCompletedDays = () => {
    let count = 0;
    for (let i = 1; i <= 30; i++) {
      const dayData = challengeData[i] || {};
      if (Object.values(dayData).filter(Boolean).length >= CHALLENGE_TASKS.length) {
        count++;
      }
    }
    return count;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in p-4">
      {loading ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-600">Loading your challenge...</p>
          </div>
        </div>
      ) : (
        <>
          {/* New Select Day Card UI */}
          <div className="bg-[#E2D5FF] rounded-[2.5rem] p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <button
                onClick={() => setCurrentDay(Math.max(1, currentDay - 1))}
                className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center text-slate-700 hover:bg-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="text-center">
                <h2 className="text-xl font-bold text-indigo-900">
                  {currentDay === 1 ? 'Today, ' : `Day ${currentDay}, `}
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </h2>
              </div>

              <button
                onClick={() => setCurrentDay(Math.min(30, currentDay + 1))}
                className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center text-slate-700 hover:bg-white transition-colors rotate-180"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-between items-end gap-2 overflow-x-auto pb-4 scrollbar-hide">
              {(() => {
                const days = ['Sa', 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr'];
                // Generate a window of days around currentDay
                const start = Math.max(1, currentDay - 3);
                const end = Math.min(30, start + 6);
                const displayDays = Array.from({ length: 7 }, (_, i) => {
                  const dayNum = start + i;
                  if (dayNum > 30) return null;
                  return dayNum;
                }).filter(Boolean);

                return displayDays.map((day) => {
                  const progress = getDayProgress(day);
                  const isSelected = day === currentDay;
                  const dayName = days[(day - 1) % 7];

                  return (
                    <div key={day} className="flex flex-col items-center gap-3 min-w-[50px]">
                      <span className={`text-sm font-semibold ${isSelected ? 'text-indigo-800' : 'text-slate-500'}`}>
                        {dayName}
                      </span>

                      <button
                        onClick={() => setCurrentDay(day)}
                        className={`w-14 h-14 rounded-full flex items-center justify-center relative transition-all ${isSelected
                          ? 'bg-white shadow-xl scale-110'
                          : 'bg-white/30 hover:bg-white/50'
                          }`}
                      >
                        {/* Dynamic Progress Circle */}
                        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 56 56">
                          <circle
                            cx="28"
                            cy="28"
                            r="25"
                            fill="none"
                            stroke={isSelected ? '#EEF2FF' : 'rgba(255,255,255,0.2)'}
                            strokeWidth="3"
                          />
                          <circle
                            cx="28"
                            cy="28"
                            r="25"
                            fill="none"
                            stroke="#818CF8" // Indigo 400
                            strokeWidth="3"
                            strokeDasharray={`${(progress / 100) * 157} 157`}
                            strokeLinecap="round"
                            className="transition-all duration-700 ease-out"
                          />
                        </svg>

                        {isSelected ? (
                          <Flame className="w-6 h-6 text-orange-500 relative z-10 fill-orange-500" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-slate-200/50" />
                        )}
                      </button>

                      <span className={`text-xs font-bold ${isSelected ? 'text-indigo-800' : 'text-slate-500'}`}>
                        {day}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Stats Summary Section */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-[2rem] p-5 shadow-md border border-slate-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center">
                <Flame className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-800">{streak}</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Day Streak</p>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-5 shadow-md border border-slate-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-indigo-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-800">{getCompletedDays()}</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Days Done</p>
              </div>
            </div>
          </div>

          {/* Current Day Tasks */}
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Day {currentDay} Tasks</h3>
                <p className="text-slate-500 text-sm">
                  {Object.values(challengeData[currentDay] || {}).filter(Boolean).length} of {CHALLENGE_TASKS.length} completed
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-cyan-600">
                  {getDayProgress(currentDay).toFixed(0)}%
                </div>
                <div className="text-xs text-slate-500">Progress</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-3 mb-6">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                style={{ width: `${getDayProgress(currentDay)}%` }}
              />
            </div>

            {/* Task List */}
            <div className="space-y-3">
              {CHALLENGE_TASKS.map((task) => {
                const isCompleted = challengeData[currentDay]?.[task.id];
                return (
                  <button
                    key={task.id}
                    onClick={() => toggleTask(currentDay, task.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${isCompleted
                      ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    <div className="text-3xl">{task.icon}</div>
                    <div className="flex-1 text-left">
                      <p className={`font-medium ${isCompleted ? 'text-emerald-700 line-through' : 'text-slate-800'}`}>
                        {task.label}
                      </p>
                    </div>
                    <div>
                      {isCompleted ? (
                        <CheckCircle className="w-6 h-6 text-emerald-500" />
                      ) : (
                        <Circle className="w-6 h-6 text-slate-300" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Achievements */}
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <Award className="w-6 h-6" />
              <h3 className="text-lg font-semibold">Achievements</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className={`p-3 rounded-xl text-center ${streak >= 3 ? 'bg-white/20' : 'bg-white/10 opacity-50'}`}>
                <div className="text-2xl mb-1">🔥</div>
                <p className="text-xs font-medium">3 Day Streak</p>
              </div>
              <div className={`p-3 rounded-xl text-center ${streak >= 7 ? 'bg-white/20' : 'bg-white/10 opacity-50'}`}>
                <div className="text-2xl mb-1">⭐</div>
                <p className="text-xs font-medium">1 Week Streak</p>
              </div>
              <div className={`p-3 rounded-xl text-center ${getCompletedDays() >= 15 ? 'bg-white/20' : 'bg-white/10 opacity-50'}`}>
                <div className="text-2xl mb-1">💪</div>
                <p className="text-xs font-medium">Half Way</p>
              </div>
              <div className={`p-3 rounded-xl text-center ${getCompletedDays() >= 30 ? 'bg-white/20' : 'bg-white/10 opacity-50'}`}>
                <div className="text-2xl mb-1">🏆</div>
                <p className="text-xs font-medium">Champion</p>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">💡 Tips for Success</h3>
            <ul className="space-y-2 text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-cyan-500 mt-1">•</span>
                <span>Complete all 4 tasks daily to maintain your streak</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-500 mt-1">•</span>
                <span>Set reminders on your phone for each task</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-500 mt-1">•</span>
                <span>Start with easier tasks and gradually increase difficulty</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-500 mt-1">•</span>
                <span>Share your progress with friends for accountability</span>
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
