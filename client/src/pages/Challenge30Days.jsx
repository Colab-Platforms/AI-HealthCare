import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Trophy, Flame, CheckCircle, Circle, 
  Calendar, Target, Award, Sparkles, ChevronRight, 
  Droplet, Zap, Utensils, Moon, Timer 
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
  const [loading, setLoading] = useState(true);

  const glassCard = "bg-white/80 backdrop-blur-xl border border-white/50 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.02)]";

  useEffect(() => {
    window.scrollTo(0, 0);
    loadChallengeData();
  }, []);

  useEffect(() => {
    localStorage.setItem('challenge30DaysCurrentDay', currentDay);
  }, [currentDay]);

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
      setChallengeData(data);
      setStreak(response.data.streakDays || 0);
      localStorage.setItem('challenge30Days', JSON.stringify(data));
      localStorage.setItem('challenge30DaysStreak', response.data.streakDays || 0);
    } catch (error) {
      console.error('Failed to load challenge data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveChallengeData = async (newData) => {
    let localStreak = 0;
    const days = Object.keys(newData).map(Number).sort((a, b) => b - a);

    for (const day of days) {
      const dayData = newData[day];
      const completedTasks = Object.values(dayData || {}).filter(Boolean).length;
      if (completedTasks >= CHALLENGE_TASKS.length) localStreak++;
      else break;
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
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <button 
              onClick={() => navigate(-1)}
              className="mb-6 w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-all shadow-sm"
            >
              <ArrowLeft className="w-5 h-5 text-[#1a1a1a]" />
            </button>
            <h1 className="text-4xl md:text-5xl font-light tracking-tight text-[#1a1a1a] mb-2">30 Day <span className="font-medium text-[#A795C7]">Elite</span></h1>
            <p className="text-[#666666] text-lg">Your transformation journey, one day at a time.</p>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-white px-6 py-4 rounded-[24px] border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center">
                <Flame className="w-6 h-6 text-orange-500 fill-orange-500" />
              </div>
              <div>
                <span className="text-2xl font-black text-[#1a1a1a] leading-none">{streak}</span>
                <p className="text-[10px] uppercase tracking-widest font-black text-[#888888] mt-1">Day Streak</p>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Timer className="w-12 h-12 text-[#A795C7] animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Box: Calendar & Progress */}
            <div className="lg:col-span-1 space-y-8">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${glassCard} p-8`}
              >
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-medium text-[#1a1a1a]">Calendar</h3>
                  <p className="text-xs font-bold text-[#A795C7] uppercase tracking-widest">{getCompletedDays()}/30 Days Goal</p>
                </div>

                <div className="grid grid-cols-6 gap-3">
                  {Array.from({ length: 30 }).map((_, i) => {
                    const day = i + 1;
                    const progress = getDayProgress(day);
                    const isSelected = day === currentDay;
                    const isFuture = day > currentDay;
                    
                    return (
                      <motion.button
                        key={day}
                        whileHover={!isFuture ? { scale: 1.1 } : {}}
                        whileTap={!isFuture ? { scale: 0.95 } : {}}
                        onClick={() => !isFuture && setCurrentDay(day)}
                        className={`relative aspect-square rounded-xl flex items-center justify-center text-xs font-black transition-all ${
                          isSelected ? 'bg-[#1a1a1a] text-white shadow-xl scale-110 z-10' : 
                          isFuture ? 'bg-slate-50 text-slate-300 cursor-not-allowed' :
                          progress === 100 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {day}
                        {progress > 0 && progress < 100 && !isSelected && (
                          <div className="absolute bottom-1 w-1 h-1 rounded-full bg-[#1a1a1a]" />
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 space-y-4">
                  <div className="flex justify-between text-xs font-bold text-[#666666] uppercase tracking-widest">
                    <span>Overall Progress</span>
                    <span>{((getCompletedDays() / 30) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(getCompletedDays() / 30) * 100}%` }}
                      className="h-full bg-gradient-to-r from-[#A795C7] to-[#1a1a1a] rounded-full"
                    />
                  </div>
                </div>
              </motion.div>

              {/* Achievement Card */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-black rounded-[32px] p-8 text-white relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <Award className="w-6 h-6 text-[#A795C7]" />
                    <h3 className="text-xl font-medium">Badgets Earned</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: '🔥', label: 'Starter', min: 3 },
                      { icon: '💎', label: 'Week 1', min: 7 },
                      { icon: '🛡️', label: 'Consistent', min: 14 },
                      { icon: '🏆', label: 'Master', min: 30 }
                    ].map((b, i) => (
                      <div key={i} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                        streak >= b.min ? 'bg-white/20 border-white/20' : 'bg-white/5 border-transparent opacity-20'
                      }`}>
                        <span className="text-2xl">{b.icon}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">{b.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right Box: Tasks */}
            <div className="lg:col-span-2">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`${glassCard} p-8 lg:p-12`}
              >
                <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-[24px] bg-[#1a1a1a] text-white flex items-center justify-center text-2xl font-black shadow-xl">
                      {currentDay}
                    </div>
                    <div>
                      <h2 className="text-3xl font-light text-[#1a1a1a]">Focus of the Day</h2>
                      <p className="text-[#666666] font-medium mt-1">Complete your daily protocols to stay in the elite club.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-4xl font-light text-[#1a1a1a]">{getDayProgress(currentDay).toFixed(0)}%</p>
                      <p className="text-[10px] font-black text-[#A795C7] uppercase tracking-widest">Day Progress</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {CHALLENGE_TASKS.map((task, i) => {
                    const isCompleted = challengeData[currentDay]?.[task.id];
                    return (
                      <motion.button
                        key={task.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + (i * 0.05) }}
                        onClick={() => toggleTask(currentDay, task.id)}
                        className={`group p-6 rounded-[28px] border-2 transition-all flex items-center gap-5 text-left ${
                          isCompleted ? 'bg-white border-[#1a1a1a] shadow-lg' : 'bg-slate-50 border-transparent hover:border-slate-200'
                        }`}
                      >
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                          isCompleted ? 'bg-[#1a1a1a] text-white' : `${task.bg} ${task.color}`
                        }`}>
                          <task.icon className={`w-6 h-6 ${isCompleted ? 'text-white' : ''}`} />
                        </div>
                        <div className="flex-1">
                          <h4 className={`text-lg font-medium ${isCompleted ? 'text-[#1a1a1a]' : 'text-slate-700'}`}>{task.label}</h4>
                          <p className={`text-xs font-bold uppercase tracking-widest mt-0.5 ${isCompleted ? 'text-[#A795C7]' : 'text-slate-400'}`}>{task.sub}</p>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          isCompleted ? 'bg-[#1a1a1a] border-[#1a1a1a]' : 'border-slate-300'
                        }`}>
                          {isCompleted && <CheckCircle className="w-4 h-4 text-white" />}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                <div className="mt-16 p-8 bg-[#F5F5F7] rounded-[32px] border border-white shadow-sm flex flex-col md:flex-row items-center gap-6">
                  <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                    <Sparkles className="w-8 h-8 text-[#A795C7]" />
                  </div>
                  <div>
                    <h4 className="text-xl font-medium text-[#1a1a1a] mb-2">Did you know?</h4>
                    <p className="text-sm text-[#666666] leading-relaxed">
                      Maintaining a consistent streak for 21 days helps encode these habits into your basal ganglia, 
                      making healthy choices nearly automatic.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
