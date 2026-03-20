import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Trophy, Flame, CheckCircle, Circle, 
  Calendar, Target, Award, Sparkles, ChevronRight, 
  Droplet, Zap, Utensils, Moon, Timer, ChevronLeft 
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const CHALLENGE_TASKS = [
  { id: 'water', label: 'Hydration Goal', sub: '8 glasses/day', icon: Droplet, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'workout', label: 'Daily Movement', sub: '30 mins session', icon: Zap, color: 'text-orange-500', bg: 'bg-orange-50' },
  { id: 'nutrition', label: 'Clean Eating', sub: 'Within goal', icon: Utensils, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 'sleep', label: 'Restful Sleep', sub: '7-8 hours', icon: Moon, color: 'text-indigo-500', bg: 'bg-indigo-50' },
];

export default function Challenge30Days() {
  const navigate = useNavigate();
  const [currentDay, setCurrentDay] = useState(() => {
    const saved = localStorage.getItem('challenge30DaysCurrentDay');
    return saved ? parseInt(saved) : 1;
  });
  const [challengeData, setChallengeData] = useState({});
  const [streak, setStreak] = useState(0);
  const [challengeStartDate, setChallengeStartDate] = useState(() => {
    return localStorage.getItem('challengeStartDate');
  });
  const [loading, setLoading] = useState(true);

  const glassCard = "bg-white/80 backdrop-blur-xl border border-white/50 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.02)]";

  useEffect(() => {
    window.scrollTo(0, 0);
    loadChallengeData();
  }, []);

  useEffect(() => {
    localStorage.setItem('challenge30DaysCurrentDay', currentDay);
  }, [currentDay]);

  useEffect(() => {
    if (challengeStartDate) {
      const start = new Date(challengeStartDate);
      start.setHours(0, 0, 0, 0);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const diffMs = now - start;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

      if (diffDays > 0 && diffDays <= 30) {
        setCurrentDay(diffDays);
      }
    }
  }, [challengeStartDate]);

  const loadChallengeData = async () => {
    setLoading(true);
    const savedData = localStorage.getItem('challenge30Days');
    const savedStreak = localStorage.getItem('challenge30DaysStreak');

    if (savedData) {
      try {
        setChallengeData(JSON.parse(savedData));
        setStreak(parseInt(savedStreak) || 0);
      } catch (e) {
        console.error('Error parsing saved data:', e);
      }
    }

    try {
      const response = await api.get('health/challenge');
      const data = response.data.challengeData || {};
      const startDate = response.data.challengeStartDate;
      
      setChallengeData(data);
      setStreak(response.data.streakDays || 0);
      if (startDate) setChallengeStartDate(startDate);
      
      localStorage.setItem('challenge30Days', JSON.stringify(data));
      localStorage.setItem('challenge30DaysStreak', response.data.streakDays || 0);
      if (startDate) localStorage.setItem('challengeStartDate', startDate);
    } catch (error) {
      console.error('Failed to load challenge data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveChallengeData = async (newData) => {
    let localStreak = 0;
    for (let d = 1; d <= 30; d++) {
      const dayData = newData[d];
      const completedTasks = Object.values(dayData || {}).filter(Boolean).length;
      if (completedTasks >= CHALLENGE_TASKS.length) {
        localStreak++;
      } else {
        break;
      }
    }

    setStreak(localStreak);
    localStorage.setItem('challenge30Days', JSON.stringify(newData));
    localStorage.setItem('challenge30DaysStreak', localStreak);

    try {
      await api.post('health/challenge', { challengeData: newData });
    } catch (error) {
      console.error('Failed to save challenge data:', error);
    }
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
    saveChallengeData(newData);

    const completed = Object.values(newData[day]).filter(Boolean).length;
    if (completed === CHALLENGE_TASKS.length) {
      toast.success('🎉 Goal Reached!', {
        style: { borderRadius: '20px', background: '#1a1a1a', color: '#fff' }
      });
    }
  };

  const getDayProgress = (day) => {
    const dayData = challengeData[day] || {};
    const completed = Object.values(dayData).filter(Boolean).length;
    return (completed / CHALLENGE_TASKS.length) * 100;
  };

  const getCompletedDays = () => {
    let count = 0;
    for (let i = 1; i <= 30; i++) {
      const dayData = challengeData[i] || {};
      if (Object.values(dayData).filter(Boolean).length >= CHALLENGE_TASKS.length) count++;
    }
    return count;
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] pb-32 px-4 md:px-8 lg:px-16 pt-8 font-sans">
      <div className="max-w-[1200px] mx-auto">
        
        <div className="pt-4" />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Timer className="w-12 h-12 text-[#A795C7] animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Horizontal Compact Calendar */}
            <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className={`${glassCard} p-4 overflow-hidden`}
            >
              <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide pb-2 px-2 snap-x">
                {Array.from({ length: 30 }).map((_, i) => {
                  const day = i + 1;
                  const progress = getDayProgress(day);
                  const isSelected = day === currentDay;
                  const isFuture = day > currentDay;
                  
                  return (
                    <button
                      key={day}
                      onClick={() => !isFuture && setCurrentDay(day)}
                      className={`relative flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black transition-all snap-center ${
                        isSelected ? 'bg-[#1a1a1a] text-white shadow-lg scale-105 z-10' : 
                        isFuture ? 'bg-slate-50 text-slate-300 cursor-not-allowed' :
                        progress === 100 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 shadow-sm border border-white'
                      }`}
                    >
                      {day}
                      {progress > 0 && progress < 100 && !isSelected && (
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-black/20" />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Task Section - High Priority */}
              <div className="lg:col-span-2 space-y-6">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`${glassCard} p-6 md:p-8`}
                >
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-[#1a1a1a] text-white flex items-center justify-center text-xl font-black">
                        {currentDay}
                      </div>
                      <div>
                        <h2 className="text-xl font-medium text-[#1a1a1a]">Day Protocols</h2>
                        <p className="text-[#888888] text-xs">Complete all to maintain streak</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-light text-[#1a1a1a]">{getDayProgress(currentDay).toFixed(0)}%</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {CHALLENGE_TASKS.map((task, i) => {
                      const isCompleted = challengeData[currentDay]?.[task.id];
                      return (
                        <motion.button
                          key={task.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => toggleTask(currentDay, task.id)}
                          className={`group p-4 rounded-2xl border-2 transition-all flex items-center gap-4 text-left ${
                            isCompleted ? 'bg-white border-[#1a1a1a] shadow-sm' : 'bg-slate-50 border-transparent hover:border-slate-200'
                          }`}
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                            isCompleted ? 'bg-[#1a1a1a] text-white' : `${task.bg} ${task.color}`
                          }`}>
                            <task.icon className={`w-5 h-5 ${isCompleted ? 'text-white' : ''}`} />
                          </div>
                          <div className="flex-1">
                            <h4 className={`text-sm font-semibold ${isCompleted ? 'text-[#1a1a1a]' : 'text-slate-700'}`}>{task.label}</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{task.sub}</p>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            isCompleted ? 'bg-[#1a1a1a] border-[#1a1a1a]' : 'border-slate-300'
                          }`}>
                            {isCompleted && <CheckCircle className="w-3 h-3 text-white" />}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>

                {/* Insight Banner */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 bg-[#F5F5F7] rounded-[32px] border border-white shadow-sm flex items-center gap-4"
                >
                  <Sparkles className="w-6 h-6 text-[#A795C7] shrink-0" />
                  <p className="text-sm font-medium text-[#666666] leading-relaxed">
                    Maintaining a consistent streak for 21 days helps encode these habits into your basal ganglia, making healthy choices automatic.
                  </p>
                </motion.div>
              </div>

              {/* Progress Detail Column */}
              <div className="lg:col-span-1 space-y-6">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`${glassCard} p-6`}
                >
                  <h3 className="text-lg font-medium text-[#1a1a1a] mb-6">Overall Progress</h3>
                  <div className="relative h-40 flex items-center justify-center mb-6">
                    <svg className="w-32 h-32 -rotate-90">
                      <circle cx="64" cy="64" r="58" fill="none" stroke="#F1F5F9" strokeWidth="10" />
                      <circle 
                        cx="64" cy="64" r="58" fill="none" stroke="#A795C7" strokeWidth="10" 
                        strokeDasharray={364}
                        strokeDashoffset={364 - (364 * getCompletedDays()) / 30}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black">{getCompletedDays()}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Days</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs font-bold text-[#666666]">
                      <span>Completion Rate</span>
                      <span>{((getCompletedDays() / 30) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#1a1a1a] rounded-full" style={{ width: `${(getCompletedDays() / 30) * 100}%` }} />
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Badges Earned - Now at specific bottom section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-black rounded-[40px] p-8 text-white relative overflow-hidden"
            >
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                  <Award className="w-6 h-6 text-[#A795C7]" />
                  <h3 className="text-xl font-medium">Badges Earned</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { icon: '🔥', label: 'Starter', min: 3, desc: '3 Day Streak' },
                    { icon: '💎', label: 'Week 1', min: 7, desc: '7 Day Streak' },
                    { icon: '🛡️', label: 'Consistent', min: 14, desc: '14 Day Streak' },
                    { icon: '🏆', label: 'Master', min: 30, desc: '30 Day Challenge' }
                  ].map((b, i) => (
                    <div key={i} className={`p-5 rounded-3xl border transition-all flex flex-col items-center text-center gap-3 ${
                      streak >= b.min ? 'bg-white/10 border-white/20 shadow-lg' : 'bg-white/5 border-transparent opacity-30'
                    }`}>
                      <span className={`text-4xl transition-transform ${streak >= b.min ? 'scale-110' : ''}`}>{b.icon}</span>
                      <div>
                        <p className="text-sm font-bold uppercase tracking-widest">{b.label}</p>
                        <p className="text-[9px] text-white/50">{b.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

          </div>
        )}
      </div>
    </div>
  );
}
