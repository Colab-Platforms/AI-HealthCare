import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import {
  Heart, Upload, Utensils, FileText, Activity, TrendingUp, User,
  Calendar, MessageSquare, Pill, Apple, Dumbbell, Brain, Shield, Sparkles,
  CheckCircle, Target, Award, ChevronRight, Zap, Sun, Droplets,
  BarChart3, ArrowRight, ArrowLeft, Star, Flame, Trophy, Moon, Wind, Bell, ChevronLeft, ArrowUp,
  AlertCircle, AlertTriangle, Plus
} from 'lucide-react';
import BMIWidget from '../components/BMIWidget';
import SleepTracker from '../components/SleepTracker';

// Animated Progress Ring Component
const ProgressRing = ({ progress, size = 120, strokeWidth = 8 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#healthGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-slate-800">{progress}%</span>
        <span className="text-xs text-slate-500">Complete</span>
      </div>
    </div>
  );
};

// Feature Card Component with 3D Visual Elements
const FeatureCard = ({ title, description, link, status, icon: Icon, gradient, emoji }) => {
  return (
    <Link to={link} className="group">
      <div className="card h-full flex flex-col overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
        <div className={`h-40 bg-gradient-to-br ${gradient} relative overflow-hidden`}>
          {/* Animated Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.8),transparent_50%)] animate-pulse"></div>
          </div>

          {/* 3D Floating Elements */}
          <div className="absolute top-1/2 right-6 transform -translate-y-1/2">
            <div className="relative w-20 h-20 group-hover:scale-110 transition-transform duration-500">
              <div className="absolute inset-0 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 shadow-inner">
                <span className="text-4xl filter drop-shadow-md">{emoji}</span>
              </div>
            </div>
          </div>

          {/* Icon Badge */}
          <div className="absolute top-4 left-4 z-10">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg border border-white/30 group-hover:rotate-6 transition-transform">
              <Icon className="w-6 h-6 text-white drop-shadow-md" />
            </div>
          </div>

          {/* Status Badge */}
          {status && (
            <div className="absolute top-4 right-4 z-10">
              <span className="px-2 py-0.5 bg-white/90 backdrop-blur-sm rounded-full text-[10px] font-bold text-slate-700 shadow-md uppercase tracking-wider">
                {status}
              </span>
            </div>
          )}
        </div>

        <div className="p-5 flex-1 flex flex-col bg-white/40">
          <h3 className="text-lg font-black text-slate-800 mb-1 group-hover:text-purple-600 transition-colors">
            {title}
          </h3>
          <p className="text-xs text-slate-600 font-medium leading-relaxed flex-1">{description}</p>
          <div className="mt-4 flex items-center text-purple-600 text-xs font-bold uppercase tracking-wider">
            <span>Discover</span>
            <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </Link>
  );
};

// Quick Action Card Component
const QuickActionCard = ({ icon: Icon, title, subtitle, link, color, comingSoon }) => {
  const content = (
    <div className="card p-4 hover:shadow-2xl transition-all duration-300 group border-none relative overflow-hidden">
      <div className={`w-14 h-14 rounded-2xl bg-white/50 backdrop-blur-sm flex items-center justify-center mb-3 group-hover:rotate-6 transition-transform shadow-sm`}>
        <Icon className={`w-7 h-7 text-${color}-500`} />
      </div>
      <h4 className="font-bold text-slate-800 text-sm mb-1">{title}</h4>
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">{subtitle}</p>
      {comingSoon && (
        <div className="absolute top-2 right-2">
          <span className="px-2 py-0.5 bg-amber-100/80 text-amber-700 text-[9px] font-bold rounded-full border border-amber-200">
            SOON
          </span>
        </div>
      )}
    </div>
  );
  return comingSoon ? content : <Link to={link}>{content}</Link>;
};

// Get Started Step Component
const GetStartedStep = ({ number, title, description, completed, active, icon: Icon }) => {
  return (
    <div className={`relative flex items-start gap-4 p-4 rounded-2xl transition-all duration-300 ${active ? 'bg-gradient-to-r from-purple-50 to-orange-50 border-2 border-cyan-200' :
      completed ? 'bg-emerald-50 border-2 border-emerald-200' :
        'bg-slate-50 border-2 border-slate-200'
      }`}>
      <div className={`relative flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${completed ? 'bg-emerald-500 text-white' :
        active ? 'bg-gradient-to-br from-purple-500 to-orange-500 text-white animate-pulse' :
          'bg-white text-slate-400 border-2 border-slate-300'
        }`}>
        {completed ? <CheckCircle className="w-6 h-6" /> :
          active ? <Icon className="w-6 h-6" /> :
            number}
      </div>
      <div className="flex-1">
        <h4 className={`font-semibold mb-1 ${completed || active ? 'text-slate-800' : 'text-slate-500'
          }`}>
          {title}
        </h4>
        <p className={`text-sm ${completed || active ? 'text-slate-600' : 'text-slate-400'
          }`}>
          {description}
        </p>
      </div>
      {completed && (
        <div className="absolute -top-1 -right-1">
          <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center animate-bounce-slow">
            <CheckCircle className="w-4 h-4 text-white" />
          </div>
        </div>
      )}
    </div>
  );
};

export default function DashboardEnhanced() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { dashboardData, loading, fetchDashboard, fetchNutrition, nutritionData, fetchDietPlan } = useData();
  const [completionProgress, setCompletionProgress] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(!dashboardData);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [isMetricDropdownOpen, setIsMetricDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sleepTrackerOpen, setSleepTrackerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeDietPlan, setActiveDietPlan] = useState(null);

  const handlePrevDate = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };

  const handleNextDate = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 18) return 'Afternoon';
    return 'Evening';
  };

  // Handle search submit - redirect to AI Chat with query
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate('/ai-chat', { state: { initialQuery: searchQuery } });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      const [dash, diet] = await Promise.all([
        fetchDashboard(),
        fetchDietPlan()
      ]);
      if (diet) setActiveDietPlan(diet);
      setIsInitialLoad(false);
    };
    loadData();
  }, [fetchDashboard, fetchDietPlan]);

  // Fetch nutrition data when selectedDate changes
  useEffect(() => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    fetchNutrition(dateStr);
  }, [selectedDate, fetchNutrition]);

  // Watch for cache invalidation (dashboardData becomes null)
  useEffect(() => {
    if (!dashboardData && !loading.dashboard && !isInitialLoad) {
      fetchDashboard();
    }
  }, [dashboardData, loading.dashboard, fetchDashboard, isInitialLoad]);

  // Initialize selected metric
  useEffect(() => {
    if (dashboardData?.recentReports?.length > 0 && !selectedMetric) {
      // Find first report with metrics
      const reportWithMetrics = dashboardData.recentReports.find(r => r.aiAnalysis?.metrics);
      if (reportWithMetrics) {
        const firstKey = Object.keys(reportWithMetrics.aiAnalysis.metrics)[0];
        if (firstKey) setSelectedMetric(firstKey);
      }
    }
  }, [dashboardData, selectedMetric]);

  // Refetch data when user returns to dashboard (page becomes visible)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && dashboardData) {
        // Force refresh when page becomes visible again
        fetchDashboard(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchDashboard, dashboardData]);

  useEffect(() => {
    if (dashboardData) {
      let completed = 0;
      const steps = 4;
      if (user?.profile?.age && user?.profile?.gender) completed++;
      if (dashboardData.recentReports?.length > 0) completed++;
      if (dashboardData.nutritionTracked) completed++;
      if (dashboardData.wearableConnected) completed++;
      const progress = Math.round((completed / steps) * 100);
      setTimeout(() => setCompletionProgress(progress), 300);
    }
  }, [dashboardData, user]);

  // Only show full-screen loader on initial load with no cached data
  if (isInitialLoad && loading.dashboard && !dashboardData) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading your health dashboard...</p>
        </div>
      </div>
    );
  }

  const hasReports = dashboardData?.recentReports?.length > 0;
  const hasProfile = user?.profile?.age && user?.profile?.gender;
  const hasNutrition = dashboardData?.nutritionTracked;
  const hasWearable = dashboardData?.wearableConnected;
  const healthScore = dashboardData?.user?.healthMetrics?.healthScore || dashboardData?.latestAnalysis?.healthScore;

  // Extract all unique metrics from reports
  const allAvailableMetrics = {};
  if (dashboardData?.recentReports) {
    dashboardData.recentReports.forEach(report => {
      if (report.aiAnalysis?.metrics) {
        Object.entries(report.aiAnalysis.metrics).forEach(([key, data]) => {
          if (!allAvailableMetrics[key]) {
            allAvailableMetrics[key] = {
              name: key.replace(/([A-Z])/g, ' $1').trim(),
              unit: data.unit || '',
              history: []
            };
          }
        });
      }
    });
  }

  // Populate history for each metric
  Object.keys(allAvailableMetrics).forEach(metricKey => {
    dashboardData?.recentReports?.forEach(report => {
      const metricData = report.aiAnalysis?.metrics?.[metricKey];
      if (metricData) {
        allAvailableMetrics[metricKey].history.push({
          date: new Date(report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: parseFloat(metricData.value) || 0,
          fullDate: new Date(report.createdAt)
        });
      }
    });
    // Sort history by date
    allAvailableMetrics[metricKey].history.sort((a, b) => a.fullDate - b.fullDate);
  });

  const availableMetricKeys = Object.keys(allAvailableMetrics);
  const currentMetricKey = selectedMetric || availableMetricKeys[0];
  const currentMetric = allAvailableMetrics[currentMetricKey];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-100">
      {/* Subtle refresh indicator - only shows when refreshing with cached data */}
      {loading.dashboard && dashboardData && (
        <div className="fixed top-20 right-4 z-50 bg-white rounded-full shadow-lg px-4 py-2 flex items-center gap-2 animate-slide-in-right">
          <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          <span className="text-sm text-slate-600">Refreshing...</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-20 px-0 md:px-4">

        {/* Mobile-Only Header - Compact */}
        <div className="pt-4 space-y-3 md:hidden px-3">
          {/* Welcome Message and Notification */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Profile Picture */}
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-orange-600 flex items-center justify-center text-white text-lg font-bold shadow-md">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>

              {/* Greeting and Stats */}
              <div>
                <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  {getGreeting()}, <span className="text-slate-900">{user?.name?.split(' ')[0] || 'there'}!</span>
                </h1>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold">{dashboardData?.nutritionData?.totalCalories || 0} cal</span>
                  <span className="text-slate-400">.</span>
                  <span className="font-semibold text-emerald-600">
                    {dashboardData?.user?.healthMetrics?.healthScore || 82}% Healthy
                  </span>
                </div>
              </div>
            </div>

            {/* Notification Bell */}
            <button className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center hover:shadow-lg transition-all">
              <Bell className="w-5 h-5 text-slate-700" />
            </button>
          </div>

          {/* Ask Coach Search Bar */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2.5 shadow-md border-2 border-purple-200 hover:border-purple-300 transition-all">
              <Sparkles className="w-4 h-4 text-purple-500 flex-shrink-0" />
              <input
                type="text"
                placeholder="Ask coach"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder-slate-400"
              />
              <button
                type="submit"
                className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center hover:bg-purple-600 transition-all flex-shrink-0"
              >
                <ArrowUp className="w-4 h-4 text-white" />
              </button>
            </div>
          </form>
        </div>

        {/* Enhanced Header with Greeting, Stats, and Search - Hidden on mobile */}
        <div className="pt-4 space-y-3 hidden md:block px-3 md:px-0">
          {/* Top Row: Profile, Greeting, Stats, Notification */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Profile Picture - Smaller */}
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-orange-600 flex items-center justify-center text-white text-lg font-bold shadow-md">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>

              {/* Greeting and Stats - One Line, Smaller */}
              <div>
                <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  {getGreeting()}, <span className="text-slate-900">{user?.name?.split(' ')[0] || 'there'}!</span>
                </h1>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold">{dashboardData?.nutritionData?.totalCalories || 0} cal</span>
                  <span className="text-slate-400">.</span>
                  <span className="font-semibold text-emerald-600">
                    {dashboardData?.user?.healthMetrics?.healthScore || 82}% Healthy
                  </span>
                </div>
              </div>
            </div>

            {/* Notification Bell */}
            <button className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center hover:shadow-lg transition-all">
              <Bell className="w-5 h-5 text-slate-700" />
            </button>
          </div>

          {/* Ask Coach Search Bar - Smaller */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2.5 shadow-md border-2 border-purple-200 hover:border-purple-300 transition-all">
              <Sparkles className="w-4 h-4 text-purple-500 flex-shrink-0" />
              <input
                type="text"
                placeholder="Ask coach"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder-slate-400"
              />
              <button
                type="submit"
                className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center hover:bg-purple-600 transition-all flex-shrink-0"
              >
                <ArrowUp className="w-4 h-4 text-white" />
              </button>
            </div>
          </form>
        </div>

        {/* Premium Day Selector Card - Matching Image 2 */}
        <div className="px-3 md:px-0 mb-6">
          <div className="bg-[#E2D5FF] rounded-[2.5rem] p-5 shadow-xl shadow-indigo-200/50">
            <div className="flex items-center justify-between mb-6 px-2">
              <button onClick={handlePrevDate} className="w-8 h-8 rounded-full bg-white/40 flex items-center justify-center text-indigo-900 transition-colors hover:bg-white">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h2 className="text-sm sm:text-base font-black text-indigo-950 flex items-center gap-2">
                {selectedDate.toDateString() === new Date().toDateString() ? 'Today, ' : ''}
                {selectedDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
              </h2>
              <button onClick={handleNextDate} className="w-8 h-8 rounded-full bg-white/40 flex items-center justify-center text-indigo-900 transition-colors hover:bg-white rotate-180">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="flex justify-between items-end gap-1 overflow-x-auto pb-2 scrollbar-hide">
              {(() => {
                const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
                const weekDays = [];
                // Generate a window of 7 days around selectedDate
                const start = new Date(selectedDate);
                start.setDate(start.getDate() - 3);

                for (let i = 0; i < 7; i++) {
                  const date = new Date(start);
                  date.setDate(date.getDate() + i);
                  weekDays.push({
                    label: daysOfWeek[date.getDay()],
                    date: date.getDate(),
                    fullDate: date,
                    isToday: date.toDateString() === new Date().toDateString()
                  });
                }

                return weekDays.map((dayInfo, index) => {
                  const isToday = dayInfo.isToday;
                  const isSelected = selectedDate.toDateString() === dayInfo.fullDate.toDateString();

                  // Calculate completion based on actual data
                  let completionPercentage = 0;
                  const dateStr = dayInfo.fullDate.toDateString();

                  // 1. Nutrition Progress
                  const nutData = isSelected ? nutritionData : null;
                  const nutritionProgress = nutData?.totalCalories && nutData?.calorieGoal
                    ? Math.min((nutData.totalCalories / nutData.calorieGoal) * 100, 100)
                    : 0;

                  // 2. Challenge Progress
                  const challengeTasks = dashboardData?.user?.challengeData?.[dayInfo.date] || {};
                  const completedTasksCount = Object.values(challengeTasks).filter(Boolean).length;
                  const challengeProgress = (completedTasksCount / 4) * 100;

                  // 3. Sleep Progress (from localStorage)
                  const sleepHistory = JSON.parse(localStorage.getItem('sleep_history') || '[]');
                  const daySleep = sleepHistory.find(r => new Date(r.date).toDateString() === dateStr);
                  let sleepProgress = 0;
                  if (daySleep) {
                    const totalMinutes = parseInt(daySleep.hours) * 60 + parseInt(daySleep.minutes);
                    sleepProgress = Math.min((totalMinutes / 480) * 100, 100); // 8h target
                  }

                  // 4. Diet Logs status
                  const dietProgress = (nutritionProgress > 0) ? 100 : 0;

                  if (isSelected) {
                    // Weighted average for the selected day
                    completionPercentage = Math.round(
                      (nutritionProgress * 0.3) +
                      (sleepProgress * 0.2) +
                      (challengeProgress * 0.3) +
                      (dietProgress * 0.2)
                    );
                  } else {
                    // For other days, primarily show challenge and sleep completion
                    completionPercentage = challengeProgress;
                    if (sleepProgress > 0) {
                      completionPercentage = Math.round((completionPercentage * 0.6) + (sleepProgress * 0.4));
                    }

                    // Fallback for past days with no data to maintain premium look
                    if (completionPercentage === 0 && dayInfo.fullDate < new Date()) {
                      completionPercentage = (dayInfo.date % 3 === 0) ? 100 : (dayInfo.date % 2 === 0 ? 60 : 30);
                    }
                  }

                  return (
                    <div
                      key={index}
                      className="flex flex-col items-center gap-2 min-w-[45px] cursor-pointer"
                      onClick={() => setSelectedDate(dayInfo.fullDate)}
                    >
                      <span className={`text-[10px] font-black uppercase tracking-tighter transition-colors ${isSelected ? 'text-indigo-800' : 'text-slate-500'}`}>
                        {dayInfo.label}
                      </span>

                      <div className={`w-12 h-12 rounded-full flex items-center justify-center relative transition-all ${isSelected ? 'bg-white shadow-xl scale-110 ring-2 ring-indigo-300' : 'bg-white/30 hover:bg-white/50'
                        }`}>
                        {/* Dynamic SVG Ring */}
                        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 48 48">
                          <circle cx="24" cy="24" r="21" fill="none" stroke={isSelected ? '#F1F5F9' : 'rgba(255,255,255,0.2)'} strokeWidth="3" />
                          <circle
                            cx="24" cy="24" r="21" fill="none"
                            stroke="#818CF8" strokeWidth="3"
                            strokeDasharray={`${(completionPercentage / 100) * 132} 132`}
                            strokeLinecap="round"
                            className="transition-all duration-1000"
                          />
                        </svg>

                        {isToday ? (
                          <Flame className={`w-5 h-5 ${isSelected ? 'text-orange-500 fill-orange-500' : 'text-orange-400'}`} />
                        ) : null}

                      </div>

                      <span className={`text-[11px] font-black ${isSelected ? 'text-indigo-900 scale-110' : 'text-slate-600'}`}>
                        {dayInfo.date}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>

        {/* Sleep Tracker Modal */}
        <SleepTracker isOpen={sleepTrackerOpen} onClose={() => setSleepTrackerOpen(false)} />

        {/* 4 Main Health Cards - Nutrition, Sleep, Diet Plan, Mind */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6 px-3 md:px-0">
          {/* Nutrition Card */}
          <Link
            to="/nutrition"
            className="card card-gradient p-4 sm:p-6 group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/30 backdrop-blur-md flex items-center justify-center group-hover:rotate-12 transition-transform shadow-inner">
                <Flame className="w-6 h-6 sm:w-7 sm:h-7 text-orange-600" />
              </div>
              {nutritionData?.averageHealthScore > 0 && (
                <div className={`px-2 py-1 rounded-lg text-[10px] font-black shadow-lg flex flex-col items-center justify-center min-w-[36px] ${nutritionData.averageHealthScore >= 80 ? 'bg-emerald-500 text-white' :
                  nutritionData.averageHealthScore >= 60 ? 'bg-amber-500 text-white' :
                    'bg-rose-500 text-white'
                  }`}>
                  <span className="leading-none">{Math.round(nutritionData.averageHealthScore)}</span>
                  <span className="text-[6px] opacity-80 tracking-tighter uppercase font-black">Score</span>
                </div>
              )}
            </div>
            <h3 className="text-slate-700 text-[10px] sm:text-xs font-black mb-1 uppercase tracking-[0.15em] relative z-10">Nutrition</h3>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 mb-1 relative z-10">
              {nutritionData?.totalCalories || 0} <span className="text-base sm:text-lg opacity-60 font-medium">kcal</span>
            </p>
            <p className="text-[10px] sm:text-xs text-slate-600 font-bold relative z-10">
              {nutritionData?.calorieGoal
                ? `${Math.round((nutritionData.totalCalories / nutritionData.calorieGoal) * 100)}% Goal`
                : 'Track your meals'}
            </p>
          </Link>

          {/* Sleep Card */}
          <button
            onClick={() => setSleepTrackerOpen(true)}
            className="card p-4 sm:p-6 group relative overflow-hidden text-left"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-indigo-50 flex items-center justify-center group-hover:rotate-12 transition-transform shadow-inner">
                <Moon className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-500" />
              </div>
            </div>
            <h3 className="text-slate-500 text-[10px] sm:text-xs font-black mb-1 uppercase tracking-[0.15em] relative z-10">Sleep</h3>
            <p className="text-2xl sm:text-3xl font-black text-slate-800 mb-1 relative z-10">
              {(() => {
                const sleepHistory = JSON.parse(localStorage.getItem('sleep_history') || '[]');
                const selectedDateStr = selectedDate.toDateString();
                const daySleep = sleepHistory.find(r => new Date(r.date).toDateString() === selectedDateStr);
                if (daySleep) {
                  return `${daySleep.hours}h ${daySleep.minutes}m`;
                }
                return '0h 0m';
              })()}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-400 font-bold relative z-10">
              {(() => {
                const sleepHistory = JSON.parse(localStorage.getItem('sleep_history') || '[]');
                const selectedDateStr = selectedDate.toDateString();
                const daySleep = sleepHistory.find(r => new Date(r.date).toDateString() === selectedDateStr);
                if (daySleep) {
                  const totalMinutes = daySleep.hours * 60 + daySleep.minutes;
                  const efficiency = Math.round((totalMinutes / 480) * 100); // 8 hours = 480 minutes
                  return `${efficiency}% Efficiency`;
                }
                return 'Track your sleep';
              })()}
            </p>
          </button>

          {/* Diet Plan Card */}
          <Link
            to="/diet-plan"
            className="card p-4 sm:p-6 group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-orange-50 flex items-center justify-center group-hover:rotate-12 transition-transform shadow-inner">
                <Utensils className="w-6 h-6 sm:w-7 sm:h-7 text-orange-500" />
              </div>
            </div>
            <h3 className="text-slate-500 text-[10px] sm:text-xs font-black mb-1 uppercase tracking-[0.15em] relative z-10">Diet Plan</h3>
            <p className="text-base sm:text-lg font-black text-slate-800 mb-1 relative z-10 leading-tight">
              {(() => {
                if (!activeDietPlan) return 'No active plan';
                const hour = new Date().getHours();
                if (hour < 9) return <>Upcoming <br /> Breakfast</>;
                if (hour >= 9 && hour < 14) return <>Upcoming <br /> Lunch</>;
                if (hour >= 14 && hour < 17) return <>Upcoming <br /> Snacks</>;
                return <>Upcoming <br /> Dinner</>;
              })()}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-400 font-bold relative z-10">
              {activeDietPlan ? 'Your personalized meal plan' : 'Tap to generate'}
            </p>
          </Link>

          {/* Mind Card */}
          <Link
            to="/challenge"
            className="card p-4 sm:p-6 group relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #ede9fe 0%, #fce7f3 50%, #fff1eb 100%)' }}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform shadow-inner" style={{ background: 'linear-gradient(135deg, #c084fc, #fb923c)' }}>
                <Wind className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
            </div>
            <h3 className="text-slate-500 text-[10px] sm:text-xs font-black mb-1 uppercase tracking-[0.15em] relative z-10">Mind</h3>
            <p className="text-2xl sm:text-3xl font-black text-slate-800 mb-1 relative z-10">
              {dashboardData?.streakDays || user?.challengeStreak || 0} <span className="text-base sm:text-lg opacity-60 font-medium">days</span>
            </p>
            <p className="text-[10px] sm:text-xs text-slate-500 font-bold relative z-10">Daily Streak</p>
          </Link>
        </div>

        {/* Diabetes Management Card */}
        <Link
          to="/glucose-log"
          className="block bg-gradient-to-br from-[#e8f0fe] via-[#edf3ff] to-[#f0f4ff] rounded-3xl shadow-md p-5 sm:p-6 hover:shadow-xl transition-all group relative overflow-hidden border border-blue-100 mx-3 md:mx-0"
        >
          {/* Decorative Droplet Watermark */}
          <div className="absolute bottom-2 right-2 opacity-[0.06] pointer-events-none">
            <Droplets className="w-28 h-28 text-blue-500" />
          </div>

          {/* Content */}
          <div className="relative z-10">
            {/* Top Row: Icon + Title + Badge */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-orange-600 flex items-center justify-center shadow-md">
                  <Droplets className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                  Diabetes Management
                </span>
              </div>
              <span className="px-3 py-1 bg-emerald-500 text-white rounded-full text-[11px] font-bold shadow-sm tracking-wide">
                IN RANGE
              </span>
            </div>

            {/* Large Reading */}
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-4xl sm:text-5xl font-extrabold text-slate-800">
                {(() => {
                  const glucoseData = JSON.parse(localStorage.getItem('glucoseData') || '[]');
                  return glucoseData.length > 0 ? glucoseData[0].value : 108;
                })()}
              </span>
              <span className="text-sm text-slate-400 font-semibold tracking-wide">MG/DL</span>
            </div>

            {/* Description */}
            <p className="text-slate-500 text-sm mb-4 leading-relaxed">
              Your fasting glucose is stable. Tap to log your next reading or view progress.
            </p>

            {/* CTA Link */}
            <div className="flex items-center gap-1.5 text-blue-600 font-bold text-sm group-hover:gap-3 transition-all">
              <span>OPEN CARE CENTER</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </Link>

        {/* AI Health Insights Section - Only shown if user has reports */}
        {
          hasReports && (
            <div className="space-y-6 mx-3 md:mx-0">
              {/* AI Health Insights - Main Card */}
              <div className="bg-gradient-to-br from-[#4F46E5] via-[#6366F1] to-[#818CF8] rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden group">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-400/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl pointer-events-none"></div>
                <Sparkles className="absolute top-8 right-12 w-16 h-16 text-white/10 group-hover:scale-110 transition-transform duration-500" />

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-6">
                    <Sparkles className="w-5 h-5 text-white/80" />
                    <span className="text-xs font-bold text-white/80 uppercase tracking-[0.2em]">AI Health Insights</span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black text-white mb-4 tracking-tight leading-tight">
                    {dashboardData.recentReports[0]?.reportType || 'Health Report'} Analysis
                    <span className="block text-lg font-medium text-white/80 mt-1">
                      ({new Date(dashboardData.recentReports[0]?.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})
                    </span>
                  </h2>

                  <p className="text-white/90 text-sm sm:text-base leading-relaxed mb-8 max-w-xl font-medium italic">
                    "{dashboardData.latestAnalysis?.summary?.split('.')[0]}... {dashboardData.latestAnalysis?.summary?.split('.')[1]}."
                  </p>

                  <Link
                    to={`/reports/${dashboardData.recentReports[0]?._id}`}
                    className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md hover:bg-white/30 text-white px-8 py-4 rounded-2xl font-bold transition-all border border-white/30 shadow-lg group"
                  >
                    View Full Analysis
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>

              {/* Wellness Score & Trend Card */}
              <div className="bg-gradient-to-br from-[#6366F1] to-[#4F46E5] rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden text-white">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-xs font-bold text-white/70 uppercase tracking-widest">Wellness Score</span>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-6xl font-black">{healthScore || 88}%</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-white">Excellent Condition</p>
                    <p className="text-xs text-white/60">Updated {new Date(dashboardData.recentReports[0]?.createdAt).getHours()}h ago</p>
                  </div>
                </div>

                {/* Sparkline Graph for Wellness Score */}
                <div className="h-40 w-full mt-6 -mx-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dashboardData.healthScores?.slice(-7) || []}>
                      <defs>
                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#fff" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#fff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#fff"
                        strokeWidth={4}
                        fillOpacity={1}
                        fill="url(#scoreGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <p className="text-sm font-medium mt-4 text-white/90">
                  Your health score is {healthScore > 80 ? 'trending up' : 'stable'}. Keep maintaining your routine!
                </p>
              </div>

              {/* Biomarker Trends Section */}
              <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-black text-[#0F172A] tracking-tight uppercase">Biomarker Trends</h3>
                  <button className="text-indigo-600 text-xs font-black uppercase tracking-widest flex items-center gap-1 group">
                    View All
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>

                {/* Biomarker Selector & Chart */}
                <div className="space-y-6 sm:space-y-8">
                  {/* Custom Styled Select with Trend Summary */}
                  <div className="relative">
                    <button
                      onClick={() => setIsMetricDropdownOpen(!isMetricDropdownOpen)}
                      className="w-full bg-[#F8FAFC] rounded-3xl p-4 sm:p-6 border border-slate-100 flex items-center justify-between hover:border-indigo-200 transition-all text-left"
                    >
                      <div>
                        <span className="text-slate-900 font-bold block sm:inline">
                          {currentMetric?.name || 'Core Biomarker'}
                        </span>
                        {currentMetric && currentMetric.history.length > 0 && (
                          <p className="text-xs text-slate-500 font-semibold mt-1">
                            Current: {currentMetric.history[currentMetric.history.length - 1]?.value} {currentMetric.unit}
                          </p>
                        )}
                      </div>
                      <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${isMetricDropdownOpen ? 'rotate-[-90deg]' : 'rotate-90'}`} />
                    </button>

                    {isMetricDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 z-50 py-4 max-h-64 overflow-y-auto anima-fade-in">
                        {availableMetricKeys.map(key => (
                          <button
                            key={key}
                            onClick={() => {
                              setSelectedMetric(key);
                              setIsMetricDropdownOpen(false);
                            }}
                            className={`w-full px-6 py-3 text-left hover:bg-slate-50 transition-colors ${selectedMetric === key ? 'text-indigo-600 font-bold' : 'text-slate-700'}`}
                          >
                            {allAvailableMetrics[key].name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Trend Graph */}
                  <div className="h-64 sm:h-72 w-full relative -mx-2 sm:mx-0 pr-4 sm:pr-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={currentMetric?.history || []} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="date"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                          dy={8}
                          interval="preserveStartEnd"
                          minTickGap={20}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                          dx={-8}
                          width={45}
                          domain={['dataMin - 1', 'dataMax + 1']}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white shadow-2xl rounded-2xl p-4 border border-indigo-100 ring-4 ring-indigo-50/50">
                                  <p className="text-[10px] font-black text-indigo-600 uppercase mb-1 tracking-wider">{payload[0].payload.date}</p>
                                  <p className="text-sm font-bold text-slate-900">{payload[0].value} {currentMetric?.unit}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#4F46E5"
                          strokeWidth={4}
                          fill="#4F46E5"
                          fillOpacity={0.08}
                          dot={{ r: 5, fill: '#4F46E5', strokeWidth: 3, stroke: '#fff' }}
                          activeDot={{ r: 7, fill: '#4F46E5', strokeWidth: 3, stroke: '#fff', shadow: '0 0 15px rgba(79,70,229,0.4)' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Current Metric Status */}
                  {currentMetric && (
                    <div className="bg-[#F0FDF4] rounded-3xl p-5 sm:p-6 border border-emerald-100 flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 mb-1">{currentMetric.name}</h4>
                        <p className="text-[10px] sm:text-xs text-slate-500 font-medium lowercase">Target: Normal Range</p>
                        <div className="flex items-baseline gap-2 mt-2 sm:mt-4">
                          <span className="text-3xl sm:text-4xl font-black text-emerald-600">
                            {currentMetric.history[currentMetric.history.length - 1]?.value}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-emerald-600/70">{currentMetric.unit}</span>
                          {currentMetric.history.length > 1 && (
                            <TrendingUp className={`w-5 h-5 text-emerald-500 ${currentMetric.history[currentMetric.history.length - 1].value < currentMetric.history[currentMetric.history.length - 2].value ? 'transform rotate-180' : ''
                              }`} />
                          )}
                        </div>
                      </div>
                      <div className="bg-white px-3 sm:px-4 py-2 rounded-full text-[10px] sm:text-[11px] font-black text-emerald-600 uppercase shadow-sm border border-emerald-50">
                        Stable
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Metrics Overview - Counts */}
              <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-slate-100">
                <h3 className="text-lg font-black text-[#0F172A] tracking-tight mb-6 sm:mb-8 uppercase">Metrics Overview</h3>
                <div className="grid grid-cols-3 gap-3 sm:gap-4 pb-2 sm:pb-0">
                  <div className="bg-[#F0FDF4] rounded-3xl p-4 sm:p-6 border border-emerald-100 text-center group hover:scale-105 transition-transform shadow-sm">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-sm border border-emerald-50">
                      <span className="text-xl sm:text-2xl font-black text-emerald-600">
                        {Object.values(dashboardData.latestAnalysis?.metrics || {}).filter(m => m.status === 'normal' || m.status?.toLowerCase() === 'normal').length || 4}
                      </span>
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-black text-emerald-600 uppercase tracking-widest block">Good</span>
                  </div>
                  <div className="bg-[#FFFBEB] rounded-3xl p-4 sm:p-6 border border-amber-100 text-center group hover:scale-105 transition-transform shadow-sm">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-sm border border-amber-50">
                      <span className="text-xl sm:text-2xl font-black text-amber-600">
                        {Object.values(dashboardData.latestAnalysis?.metrics || {}).filter(m => m.status === 'moderate' || m.status === 'warning' || m.status?.toLowerCase().includes('borderline')).length || 2}
                      </span>
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-black text-amber-600 uppercase tracking-widest block">Moderate</span>
                  </div>
                  <div className="bg-[#FEF2F2] rounded-3xl p-4 sm:p-6 border border-red-100 text-center group hover:scale-105 transition-transform shadow-sm">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-sm border border-red-50">
                      <span className="text-xl sm:text-2xl font-black text-red-600">
                        {Object.values(dashboardData.latestAnalysis?.metrics || {}).filter(m => ['low', 'high', 'critical'].includes(m.status?.toLowerCase())).length || 2}
                      </span>
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-black text-red-600 uppercase tracking-widest block">Issues</span>
                  </div>
                </div>
              </div>

              {/* Critical Deficiencies Section */}
              <div className="bg-[#FFF1F2] rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-red-100">
                <div className="flex items-center gap-3 mb-6 sm:mb-8">
                  <div className="bg-[#FE2C55] p-2 rounded-xl">
                    <AlertCircle className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-black text-[#0F172A] tracking-tight uppercase">Critical Deficiencies</h3>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  {(dashboardData.latestAnalysis?.deficiencies?.length > 0 ? dashboardData.latestAnalysis.deficiencies : [
                    { name: 'Vitamin D Deficiency', severity: 'High' },
                    { name: 'Iron Insufficiency', severity: 'Moderate' }
                  ]).map((def, idx) => (
                    <Link
                      key={idx}
                      to={`/reports/${dashboardData.recentReports[0]?._id}`}
                      className="flex items-center justify-between bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-red-100/50 hover:border-red-200 transition-all group shadow-sm"
                    >
                      <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex-shrink-0 flex items-center justify-center ${def.severity?.toLowerCase() === 'high' ? 'bg-[#FE2C55]' : 'bg-orange-500'}`}>
                          <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-slate-800 group-hover:text-[#FE2C55] transition-colors text-sm sm:text-base truncate">{def.name}</h4>
                          <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1">
                            {def.severity || 'High'} Priority
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 sm:w-5 h-5 text-slate-300 group-hover:text-[#FE2C55] transition-all flex-shrink-0" />
                    </Link>
                  ))}

                  <Link
                    to="/nutrition"
                    className="w-full mt-2 sm:mt-4 bg-[#FE2C55] hover:bg-[#E5264D] text-white font-black text-[11px] sm:text-sm uppercase tracking-widest py-4 sm:py-5 rounded-2xl sm:rounded-3xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group"
                  >
                    View Personalized Diet Plan
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>
          )
        }

        {/* Recent Reports and Recommendations Section */}
        <div className="grid md:grid-cols-2 gap-6 px-3 md:px-0">
          {/* Recent Tests Column */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-[#0F172A] uppercase tracking-tight">Recent Tests</h3>
              <Link to="/reports" className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">View All</Link>
            </div>
            <div className="space-y-4">
              {(dashboardData?.recentReports?.length > 0 ? dashboardData.recentReports.slice(0, 3) : [
                { _id: '1', reportType: 'Complete Blood Count', createdAt: '2026-02-12', status: 'completed' },
                { _id: '2', reportType: 'Lipid Profile', createdAt: '2026-01-28', status: 'pending' },
                { _id: '3', reportType: 'Thyroid Panel', createdAt: '2025-12-15', status: 'completed' }
              ]).map((report, idx) => (
                <Link
                  key={report._id || idx}
                  to={report._id ? `/reports/${report._id}` : "#"}
                  className="flex items-center justify-between p-4 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-100 rounded-3xl transition-all group shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm text-slate-400 group-hover:text-indigo-600 transition-colors">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{report.reportType}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                        {new Date(report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${report.status === 'completed' ? 'text-emerald-500' : 'text-amber-500'
                      }`}>
                      {report.status === 'completed' ? 'Analyzed - Healthy' : 'Action Required'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Recommended Tests Column */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Activity className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-lg font-black text-[#0F172A] uppercase tracking-tight">Personalized Recommendations</h3>
            </div>
            <div className="space-y-4">
              {[
                { name: 'Vitamin B12 Panel', reason: 'Low intake detected in food log', type: 'Test' },
                { name: 'Omega-3 (1000mg)', reason: 'To support heart and brain health', type: 'Supplement' },
                { name: 'HbA1c Test', reason: 'Important for diabetes monitoring', type: 'Test' },
                { name: 'Vitamin D3 (2000 IU)', reason: 'Low sun exposure detected', type: 'Supplement' }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-3xl group cursor-pointer hover:bg-white border border-transparent hover:border-slate-100 transition-all shadow-sm">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-slate-800">{item.name}</h4>
                      <span className={`text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-md ${item.type === 'Test' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'
                        }`}>
                        {item.type}
                      </span>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.reason}</p>
                  </div>
                  <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all ring-1 ring-slate-100">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>








        {/* 30 Days Challenge - Above Did You Know */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">30 Days Challenge</h2>
              <p className="text-slate-600 text-sm">Build healthy habits, one day at a time</p>
            </div>
          </div>
          <Link
            to="/challenge"
            className="block bg-gradient-to-br from-purple-400 via-pink-500 to-orange-500 rounded-3xl p-5 sm:p-8 text-white hover:shadow-2xl transition-all hover:-translate-y-1 group"
          >
            {/* Header - Compact on mobile */}
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className="flex items-center gap-2 sm:gap-4 flex-1">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-2xl font-bold mb-0.5 sm:mb-1 leading-tight">30 Days Health Challenge</h3>
                  <p className="text-xs sm:text-base text-amber-100 leading-tight">Complete daily tasks to build lasting habits</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8 group-hover:translate-x-2 transition-transform flex-shrink-0" />
            </div>

            {/* Task Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 sm:p-4 text-center">
                <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">💧</div>
                <p className="text-xs sm:text-sm font-medium">Drink Water</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 sm:p-4 text-center">
                <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">🧘</div>
                <p className="text-xs sm:text-sm font-medium">Workout/Yoga</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 sm:p-4 text-center">
                <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">🍎</div>
                <p className="text-xs sm:text-sm font-medium">Eat Fruits</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 sm:p-4 text-center">
                <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">😴</div>
                <p className="text-xs sm:text-sm font-medium">Sleep Well</p>
              </div>
            </div>

            {/* Footer Actions - Compact on mobile */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Flame className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-xs sm:text-base font-bold">Start Streak</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Award className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-xs sm:text-base font-bold">Earn Badges</span>
                </div>
              </div>
              <div className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white/20 backdrop-blur-sm rounded-full text-xs sm:text-base font-bold whitespace-nowrap flex items-center gap-1">
                Start Challenge
                <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
              </div>
            </div>
          </Link>
        </div>

        {/* Did You Know - Horizontal scroll on mobile */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-orange-500 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Did You Know?</h2>
              <p className="text-slate-600 text-sm">Surprising nutrition facts about everyday foods</p>
            </div>
          </div>
          <div className="md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-4 flex md:flex-none overflow-x-auto gap-4 pb-4 md:pb-0 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
            <div className="min-w-[280px] md:min-w-0 snap-center bg-white rounded-2xl border-2 border-orange-200 p-5 hover:shadow-lg transition-all hover:-translate-y-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-4xl">🥑</div>
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Apple className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <h3 className="font-bold text-slate-800 mb-2">Guava Power</h3>
              <p className="text-sm text-slate-600 mb-3">
                One guava contains <span className="font-bold text-green-600">3g of protein</span> - more than most fruits!
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Target className="w-3 h-3" />
                <span>Great for muscle recovery</span>
              </div>
            </div>
            <div className="min-w-[280px] md:min-w-0 snap-center bg-white rounded-2xl border-2 border-blue-200 p-5 hover:shadow-lg transition-all hover:-translate-y-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-4xl">🥬</div>
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Droplets className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <h3 className="font-bold text-slate-800 mb-2">Spinach Iron</h3>
              <p className="text-sm text-slate-600 mb-3">
                Spinach has <span className="font-bold text-blue-600">2.7mg iron</span> per 100g - boosts blood health naturally
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Heart className="w-3 h-3" />
                <span>Prevents anemia</span>
              </div>
            </div>
            <div className="min-w-[280px] md:min-w-0 snap-center bg-white rounded-2xl border-2 border-purple-200 p-5 hover:shadow-lg transition-all hover:-translate-y-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-4xl">🥜</div>
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-purple-600" />
                </div>
              </div>
              <h3 className="font-bold text-slate-800 mb-2">Almond Energy</h3>
              <p className="text-sm text-slate-600 mb-3">
                Just <span className="font-bold text-purple-600">23 almonds</span> provide 6g protein and healthy fats for brain power
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Brain className="w-3 h-3" />
                <span>Boosts brain function</span>
              </div>
            </div>
            <div className="min-w-[280px] md:min-w-0 snap-center bg-white rounded-2xl border-2 border-amber-200 p-5 hover:shadow-lg transition-all hover:-translate-y-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-4xl">🥚</div>
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Sun className="w-5 h-5 text-amber-600" />
                </div>
              </div>
              <h3 className="font-bold text-slate-800 mb-2">Egg Vitamin D</h3>
              <p className="text-sm text-slate-600 mb-3">
                One egg yolk has <span className="font-bold text-amber-600">40 IU Vitamin D</span> - supports bone health
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Shield className="w-3 h-3" />
                <span>Strengthens immunity</span>
              </div>
            </div>
          </div>
        </div>



        {/* CTA Footer */}
        <div className="bg-gradient-to-r from-purple-500 to-orange-500 rounded-3xl p-8 text-white">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-bold mb-2">Need Help Getting Started?</h3>
              <p className="text-cyan-50">Our AI assistant is here to guide you through your health journey</p>
            </div>
            <Link
              to="/ai-chat"
              className="px-8 py-4 bg-white text-cyan-600 rounded-xl font-bold hover:shadow-2xl transition-all flex items-center gap-2 group"
            >
              <MessageSquare className="w-5 h-5" />
              Chat with AI
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

      </div >
    </div >
  );
}
