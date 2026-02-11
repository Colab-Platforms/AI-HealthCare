import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Flame, CheckCircle, Circle, Calendar, Target, Award } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const CHALLENGE_TASKS = [
  { id: 'water', label: 'Drink 8 glasses of water', icon: '💧' },
  { id: 'workout', label: 'Workout/Yoga (30 mins)', icon: '🧘' },
  { id: 'fruits', label: 'Eat 2 servings of fruits', icon: '🍎' },
  { id: 'vegetables', label: 'Eat 3 servings of vegetables', icon: '🥗' },
  { id: 'sleep', label: 'Sleep 7-8 hours', icon: '😴' },
  { id: 'meditation', label: 'Meditate (10 mins)', icon: '🧘‍♀️' },
  { id: 'steps', label: 'Walk 8,000 steps', icon: '👟' },
  { id: 'screen', label: 'Limit screen time (< 2 hrs)', icon: '📱' },
];

export default function Challenge30Days() {
  const [currentDay, setCurrentDay] = useState(1);
  const [challengeData, setChallengeData] = useState({});
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
    
    // Load challenge data from backend
    loadChallengeData();
  }, []);

  const loadChallengeData = async () => {
    try {
      const response = await api.get('/api/health/challenge');
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
      
      // Also save to localStorage as backup
      localStorage.setItem('challenge30Days', JSON.stringify(plainData));
    } catch (error) {
      console.error('Failed to load challenge data:', error);
      // Fallback to localStorage
      const saved = localStorage.getItem('challenge30Days');
      if (saved) {
        const data = JSON.parse(saved);
        setChallengeData(data);
        calculateStreak(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveChallengeData = async (newData) => {
    try {
      const response = await api.post('/api/health/challenge', {
        challengeData: newData
      });
      
      setStreak(response.data.streakDays || 0);
      
      // Also save to localStorage as backup
      localStorage.setItem('challenge30Days', JSON.stringify(newData));
    } catch (error) {
      console.error('Failed to save challenge data:', error);
      toast.error('Failed to save progress. Please try again.');
      
      // Still save to localStorage as fallback
      localStorage.setItem('challenge30Days', JSON.stringify(newData));
      calculateStreak(newData);
    }
  };

  const calculateStreak = (data) => {
    let currentStreak = 0;
    for (let i = currentDay; i >= 1; i--) {
      const dayData = data[i];
      if (dayData && Object.values(dayData).filter(Boolean).length >= 5) {
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
    } else if (completed === 5) {
      toast.success('💪 Great job! You\'re doing awesome!');
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
      if (Object.values(dayData).filter(Boolean).length >= 5) {
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
      {/* Header */}
      <div>
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 font-medium transition-colors mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
              <Trophy className="w-8 h-8 text-amber-500" />
              30 Days Health Challenge
            </h1>
            <p className="text-slate-500 mt-1">Build healthy habits, one day at a time</p>
          </div>
        </div>
      </div>

      {/* Stats Cards - Always in one row on mobile */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl sm:rounded-2xl p-3 sm:p-6 text-white">
          <div className="flex flex-col sm:flex-row items-center sm:gap-3 mb-2">
            <Flame className="w-6 h-6 sm:w-8 sm:h-8 mb-1 sm:mb-0" />
            <div className="text-center sm:text-left">
              <p className="text-2xl sm:text-3xl font-bold">{streak}</p>
              <p className="text-amber-100 text-[10px] sm:text-sm">Day Streak</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl sm:rounded-2xl p-3 sm:p-6 text-white">
          <div className="flex flex-col sm:flex-row items-center sm:gap-3 mb-2">
            <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 mb-1 sm:mb-0" />
            <div className="text-center sm:text-left">
              <p className="text-2xl sm:text-3xl font-bold">{getCompletedDays()}</p>
              <p className="text-emerald-100 text-[10px] sm:text-sm">Days Done</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl sm:rounded-2xl p-3 sm:p-6 text-white">
          <div className="flex flex-col sm:flex-row items-center sm:gap-3 mb-2">
            <Target className="w-6 h-6 sm:w-8 sm:h-8 mb-1 sm:mb-0" />
            <div className="text-center sm:text-left">
              <p className="text-2xl sm:text-3xl font-bold">{getTotalProgress().toFixed(0)}%</p>
              <p className="text-cyan-100 text-[10px] sm:text-sm">Progress</p>
            </div>
          </div>
        </div>
      </div>

      {/* Day Selector - Scrollable rows on mobile */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-slate-800">Select Day</h3>
          <span className="text-xs sm:text-sm text-slate-500">Current: Day {currentDay}</span>
        </div>
        
        {/* Mobile: Scrollable rows of 7 days each */}
        <div className="block sm:hidden space-y-3 max-h-[300px] overflow-y-auto">
          {[0, 1, 2, 3].map((rowIndex) => (
            <div key={rowIndex} className="flex gap-2">
              {Array.from({ length: 7 }, (_, i) => rowIndex * 7 + i + 1)
                .filter(day => day <= 30)
                .map((day) => {
                  const progress = getDayProgress(day);
                  const isComplete = progress >= 62.5;
                  return (
                    <button
                      key={day}
                      onClick={() => setCurrentDay(day)}
                      className={`flex-1 aspect-square rounded-xl font-bold text-sm transition-all ${
                        currentDay === day
                          ? 'bg-cyan-500 text-white shadow-lg scale-105'
                          : isComplete
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : progress > 0
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>

        {/* Desktop: Grid layout */}
        <div className="hidden sm:grid grid-cols-10 gap-2">
          {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => {
            const progress = getDayProgress(day);
            const isComplete = progress >= 62.5;
            return (
              <button
                key={day}
                onClick={() => setCurrentDay(day)}
                className={`aspect-square rounded-xl font-bold text-sm transition-all ${
                  currentDay === day
                    ? 'bg-cyan-500 text-white shadow-lg scale-110'
                    : isComplete
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : progress > 0
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {day}
              </button>
            );
          })}
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
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                  isCompleted
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
            <span>Complete at least 5 tasks daily to maintain your streak</span>
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
