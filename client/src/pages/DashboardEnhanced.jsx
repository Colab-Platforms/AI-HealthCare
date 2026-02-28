import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Bar, BarChart, Legend
} from 'recharts';
import {
  Heart, Upload, Utensils, FileText, Activity, TrendingUp, User,
  Calendar, MessageSquare, Pill, Apple, Dumbbell, Brain, Shield, Sparkles,
  CheckCircle, Target, Award, ChevronRight, Zap, Sun, Droplets,
  BarChart3, ArrowRight, ArrowLeft, Star, Flame, Trophy, Moon, Wind, Bell, ChevronLeft, ArrowUp,
  AlertCircle, AlertTriangle, Plus, TrendingDown
} from 'lucide-react';
import BMIWidget from '../components/BMIWidget';
import SleepTracker from '../components/SleepTracker';
import NotificationPanel, { useNotificationCount } from '../components/NotificationPanel';
import { healthService } from '../services/api';

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
          stroke="#f1f5f9"
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
            <stop offset="0%" stopColor="#2FC8B9" />
            <stop offset="100%" stopColor="#1db7a6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-black tracking-tighter">{progress}%</span>
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] -mt-1">Complete</span>
      </div>
    </div>
  );
};

// Feature Card Component with 3D Visual Elements
const FeatureCard = ({ title, description, link, status, icon: Icon, emoji }) => {
  return (
    <Link to={link} className="group">
      <div className="bg-white rounded-[2.5rem] h-full flex flex-col overflow-hidden border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.03)] hover:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 transform hover:-translate-y-2">
        <div className="h-44 bg-slate-50 relative overflow-hidden group-hover:bg-[#2FC8B9]/5 transition-colors">
          {/* Subtle Background Pattern */}
          <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:20px_20px]"></div>

          {/* 3D Floating Elements */}
          <div className="absolute top-1/2 right-8 transform -translate-y-1/2">
            <div className="relative w-24 h-24 group-hover:scale-110 transition-transform duration-700">
              <div className="absolute inset-0 bg-white shadow-[0_15px_35px_rgba(0,0,0,0.08)] rounded-[2rem] flex items-center justify-center border border-slate-100 group-hover:rotate-6 transition-transform">
                <span className="text-5xl filter drop-shadow-sm">{emoji}</span>
              </div>
            </div>
          </div>

          {/* Icon Badge */}
          <div className="absolute top-6 left-6 z-10">
            <div className="w-14 h-14 rounded-2xl bg-[#2FC8B9]/10 flex items-center justify-center shadow-inner group-hover:bg-[#2FC8B9]/20 transition-all border border-[#2FC8B9]/10">
              <Icon className="w-7 h-7 text-[#2FC8B9]" />
            </div>
          </div>

          {/* Status Badge */}
          {status && (
            <div className="absolute top-6 right-6 z-10">
              <span className="px-3 py-1 bg-white rounded-full text-[9px] font-black text-black shadow-sm uppercase tracking-widest border border-slate-100">
                {status}
              </span>
            </div>
          )}
        </div>

        <div className="p-8 flex-1 flex flex-col">
          <h3 className="text-xl font-black text-black mb-2 tracking-tight">
            {title}
          </h3>
          <p className="text-xs text-slate-400 font-bold leading-relaxed flex-1">{description}</p>
          <div className="mt-6 flex items-center text-black group-hover:text-[#2FC8B9] text-[10px] font-black uppercase tracking-[0.25em] transition-colors">
            <span>Explore Now</span>
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" />
          </div>
        </div>
      </div>
    </Link>
  );
};

// Quick Action Card Component
const QuickActionCard = ({ icon: Icon, title, subtitle, link, comingSoon }) => {
  const content = (
    <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:border-[#2FC8B9]/20 transition-all duration-500 group relative overflow-hidden h-full">
      <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center mb-6 group-hover:rotate-6 transition-all shadow-lg group-hover:shadow-[#2FC8B9]/20">
        <Icon className="w-7 h-7 text-[#2FC8B9]" />
      </div>
      <h4 className="font-black text-black text-base mb-1 tracking-tight">{title}</h4>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{subtitle}</p>
      {comingSoon && (
        <div className="absolute top-6 right-6">
          <span className="px-2.5 py-1 bg-slate-100 text-slate-500 text-[8px] font-black rounded-full border border-slate-200 uppercase tracking-tighter">
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
    <div className={`relative flex items-center gap-6 p-6 rounded-[2rem] transition-all duration-500 ${active ? 'bg-[#2FC8B9] border border-[#2FC8B9]/10 shadow-2xl scale-[1.02]' :
      completed ? 'bg-white border border-slate-100 opacity-60' :
        'bg-slate-50 border border-slate-100'
      }`}>
      <div className={`relative flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl transition-all ${completed ? 'bg-black text-white' :
        active ? 'bg-white text-[#2FC8B9] animate-pulse shadow-[0_0_20px_rgba(255,255,255,0.3)]' :
          'bg-white text-slate-300 border border-slate-100'
        }`}>
        {completed ? <CheckCircle className="w-8 h-8" /> :
          active ? <Icon className="w-8 h-8" /> :
            number}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className={`text-base font-black uppercase tracking-tight mb-0.5 ${active ? 'text-white' : 'text-black'}`}>
          {title}
        </h4>
        <p className={`text-[11px] font-bold uppercase tracking-wider ${active ? 'text-black/60' : 'text-slate-400'}`}>
          {description}
        </p>
      </div>
      {completed && (
        <div className="absolute -top-2 -right-2">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center border-2 border-[#2FC8B9] shadow-lg">
            <CheckCircle className="w-5 h-5 text-[#2FC8B9]" />
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

  // Notification state
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const bellRef = useRef(null);
  const notifCount = useNotificationCount();

  // Report comparison state
  const [reportComparison, setReportComparison] = useState(null);
  const [comparisonLoading, setComparisonLoading] = useState(true);

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

  // Fetch report comparison data
  useEffect(() => {
    const fetchComparison = async () => {
      try {
        setComparisonLoading(true);
        const { data } = await healthService.getReportComparison();
        setReportComparison(data);
      } catch (error) {
        console.error('Failed to fetch report comparison:', error);
      } finally {
        setComparisonLoading(false);
      }
    };
    fetchComparison();
  }, []);

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
          <div className="w-16 h-16 border-4 border-[#2FC8B9]/20 border-t-[#2FC8B9] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-bold">Loading your health dashboard...</p>
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
    <div className="min-h-screen bg-white font-roboto">
      {/* Subtle refresh indicator - only shows when refreshing with cached data */}
      {loading.dashboard && dashboardData && (
        <div className="fixed top-20 right-4 z-50 bg-white rounded-full shadow-lg px-4 py-2 flex items-center gap-2 animate-slide-in-right border border-[#2FC8B9]/10">
          <div className="w-4 h-4 border-2 border-[#2FC8B9]/30 border-t-[#2FC8B9] rounded-full animate-spin" />
          <span className="text-sm text-slate-500 font-bold">Refreshing...</span>
        </div>
      )}

      <div className="w-full mx-auto space-y-6 animate-fade-in pb-20 px-0 md:px-4">

        {/* Mobile-Only Header - Compact */}
        <div className="pt-4 space-y-3 md:hidden px-3">
          {/* Welcome Message and Notification */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Profile Picture - Clickable */}
              <button
                onClick={() => navigate('/profile')}
                className="w-12 h-12 rounded-full overflow-hidden shadow-md border-2 border-[#2FC8B9] hover:scale-105 transition-transform flex-shrink-0"
              >
                {user?.profilePicture ? (
                  <img src={user.profilePicture} alt={user?.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-black flex items-center justify-center text-white text-lg font-black">
                    {user?.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
              </button>

              {/* Greeting and Stats */}
              <div>
                <h1 className="text-lg font-black text-black flex items-center gap-2">
                  {getGreeting()}, <span className="text-[#2FC8B9]">{user?.name?.split(' ')[0] || 'there'}!</span>
                </h1>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-widest font-black">
                  <span>{nutritionData?.totalCalories || 0} cal</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-emerald-500">
                    {healthScore || 82}% Score
                  </span>
                </div>
              </div>
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                ref={bellRef}
                onClick={() => setNotifPanelOpen(!notifPanelOpen)}
                className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center hover:shadow-lg transition-all"
              >
                <Bell className="w-5 h-5 text-slate-700" />
                {notifCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-black animate-pulse">
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </button>
              <NotificationPanel
                isOpen={notifPanelOpen}
                onClose={() => setNotifPanelOpen(false)}
                triggerRef={bellRef}
              />
            </div>
          </div>

          {/* Upload Report Button */}
          <button
            onClick={() => navigate('/upload')}
            className="w-full bg-gradient-to-r from-[#2FC8B9] to-[#1db7a6] text-white rounded-2xl px-6 py-4 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all active:scale-95"
          >
            <Upload className="w-5 h-5" />
            <span className="text-sm font-black uppercase tracking-wider">Upload Report</span>
          </button>
        </div>

        {/* Enhanced Header with Greeting, Stats, and Search - Hidden on mobile */}
        <div className="pt-8 space-y-6 hidden md:block px-3 md:px-0">
          {/* Top Row: Profile, Greeting, Stats, Notification */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {/* Profile Picture */}
              <button
                onClick={() => navigate('/profile')}
                className="w-16 h-16 rounded-[1.5rem] overflow-hidden shadow-inner border-2 border-[#2FC8B9]/10 relative group hover:scale-105 transition-transform flex-shrink-0"
              >
                <div className="absolute inset-0 bg-[#2FC8B9]/5 rounded-[1.5rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                {user?.profilePicture ? (
                  <img src={user.profilePicture} alt={user?.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-50 flex items-center justify-center text-[#2FC8B9] text-2xl font-black">
                    {user?.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
              </button>

              {/* Greeting and Stats */}
              <div>
                <h1 className="text-3xl font-black text-black tracking-tighter uppercase leading-none">
                  Welcome, {user?.name?.split(' ')[0] || 'User'}
                </h1>
                <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">
                  <span className="flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-orange-500" /> {dashboardData?.nutritionData?.totalCalories || 0} kcal burned</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                  <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-[#2FC8B9]" /> {dashboardData?.user?.healthMetrics?.healthScore || 82}% Efficiency</span>
                </div>
              </div>
            </div>

            {/* Notification & Actions */}
            <div className="flex items-center gap-3 relative">
              <button
                ref={bellRef}
                onClick={() => setNotifPanelOpen(!notifPanelOpen)}
                className="w-12 h-12 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-400 hover:text-black hover:border-black transition-all group relative"
              >
                <Bell className="w-6 h-6 group-hover:animate-swing" />
                {notifCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-black animate-pulse">
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </button>
              <NotificationPanel
                isOpen={notifPanelOpen}
                onClose={() => setNotifPanelOpen(false)}
                triggerRef={bellRef}
              />
            </div>
          </div>

          {/* Upload Report Button - Desktop */}
          <button
            onClick={() => navigate('/upload')}
            className="w-full bg-gradient-to-r from-[#2FC8B9] to-[#1db7a6] text-white rounded-[2rem] px-8 py-6 flex items-center justify-center gap-4 shadow-xl hover:shadow-2xl transition-all active:scale-[0.98] group"
          >
            <Upload className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span className="text-base font-black uppercase tracking-widest">Upload Health Report</span>
          </button>
        </div>

        {/* Premium Day Selector Card - Matching Image 2 */}
        <div className="px-3 md:px-0 mb-6 font-roboto">
          <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#2FC8B9]/10 rounded-full blur-3xl"></div>
            <div className="flex items-center justify-between mb-8 px-2 relative z-10">
              <button onClick={handlePrevDate} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-black transition-all hover:bg-[#2FC8B9] hover:text-white hover:scale-110 active:scale-95">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-base sm:text-lg font-black text-black flex items-center gap-2 tracking-tight">
                {selectedDate.toDateString() === new Date().toDateString() ? 'Today, ' : ''}
                {selectedDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
              </h2>
              <button onClick={handleNextDate} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-black transition-all hover:bg-[#2FC8B9] hover:text-white hover:scale-110 active:scale-95 rotate-180">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-between items-end gap-1 overflow-visible pb-2 sm:overflow-x-auto sm:scrollbar-hide">
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

                  if (dayInfo.fullDate > new Date()) {
                    // Don't show progress for future dates
                    completionPercentage = 0;
                  } else if (isSelected) {
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
                      const isPastDay = dayInfo.fullDate.toDateString() !== new Date().toDateString();
                      if (isPastDay) {
                        completionPercentage = (dayInfo.date % 3 === 0) ? 100 : (dayInfo.date % 2 === 0 ? 60 : 30);
                      }
                    }
                  }

                  return (
                    <div
                      key={index}
                      className="flex flex-col items-center gap-2 flex-1 min-w-0 cursor-pointer relative z-10"
                      onClick={() => setSelectedDate(dayInfo.fullDate)}
                    >
                      <span className={`text-[9px] font-black uppercase tracking-tight transition-colors ${isSelected ? 'text-[#2FC8B9]' : 'text-slate-500'}`}>
                        {dayInfo.label}
                      </span>

                      <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-full flex items-center justify-center relative transition-all duration-300 ${isSelected ? 'bg-white shadow-[0_0_20px_rgba(47,200,185,0.4)] scale-110 ring-2 ring-[#2FC8B9]' : 'bg-slate-50 hover:bg-slate-100 border border-slate-100'
                        }`}>
                        {/* Dynamic SVG Ring */}
                        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 48 48">
                          <circle cx="24" cy="24" r="21" fill="none" stroke={isSelected ? '#F8FAFC' : 'rgba(255,255,255,0.1)'} strokeWidth="3" />
                          <circle
                            cx="24" cy="24" r="21" fill="none"
                            stroke="#2FC8B9" strokeWidth="3"
                            strokeDasharray={`${(completionPercentage / 100) * 132} 132`}
                            strokeLinecap="round"
                            className="transition-all duration-1000"
                          />
                        </svg>

                        {isToday ? (
                          <Flame className={`w-5 h-5 ${isSelected ? 'text-orange-500 fill-orange-500' : 'text-orange-400'}`} />
                        ) : null}

                      </div>

                      <span className={`text-xs font-black transition-all ${isSelected ? 'text-black scale-110' : 'text-slate-400'}`}>
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
            className="card p-4 sm:p-6 group relative overflow-hidden bg-white border border-slate-100"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#2FC8B9]/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#2FC8B9]/10 flex items-center justify-center group-hover:rotate-12 transition-transform shadow-sm">
                <Flame className="w-6 h-6 sm:w-7 sm:h-7 text-[#2FC8B9]" />
              </div>
              {nutritionData?.averageHealthScore > 0 && (
                <div className={`px-2 py-1 rounded-lg text-[10px] font-black shadow-lg flex flex-col items-center justify-center min-w-[36px] ${nutritionData.averageHealthScore >= 80 ? 'bg-[#2FC8B9] text-white' :
                  nutritionData.averageHealthScore >= 60 ? 'bg-amber-400 text-white' :
                    'bg-rose-500 text-white'
                  }`}>
                  <span className="leading-none">{Math.round(nutritionData.averageHealthScore)}</span>
                  <span className="text-[6px] opacity-80 tracking-tighter uppercase font-black">Score</span>
                </div>
              )}
            </div>
            <h3 className="text-slate-500 text-[10px] sm:text-xs font-black mb-1 uppercase tracking-[0.15em] relative z-10">Nutrition</h3>
            <p className="text-2xl sm:text-3xl font-black text-black mb-1 relative z-10">
              {nutritionData?.totalCalories || 0} <span className="text-base sm:text-lg opacity-40 font-medium">kcal</span>
            </p>
            <p className="text-[10px] sm:text-xs text-[#2FC8B9] font-black uppercase tracking-widest relative z-10">
              {nutritionData?.calorieGoal
                ? `${Math.round((nutritionData.totalCalories / nutritionData.calorieGoal) * 100)}% Goal`
                : 'Track meals'}
            </p>
          </Link>

          {/* Sleep Card */}
          <button
            onClick={() => setSleepTrackerOpen(true)}
            className="card p-4 sm:p-6 group relative overflow-hidden text-left bg-white border border-slate-100"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#2FC8B9]/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#2FC8B9]/10 flex items-center justify-center group-hover:rotate-12 transition-transform shadow-sm">
                <Moon className="w-6 h-6 sm:w-7 sm:h-7 text-[#2FC8B9]" />
              </div>
            </div>
            <h3 className="text-slate-500 text-[10px] sm:text-xs font-black mb-1 uppercase tracking-[0.15em] relative z-10">Sleep</h3>
            <p className="text-2xl sm:text-3xl font-black text-black mb-1 relative z-10">
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
                return 'Track sleep';
              })()}
            </p>
          </button>

          {/* Diet Plan Card */}
          <Link
            to="/diet-plan"
            className="card p-4 sm:p-6 group relative overflow-hidden bg-white border border-slate-100"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#2FC8B9]/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#2FC8B9]/10 flex items-center justify-center group-hover:rotate-12 transition-transform shadow-sm">
                <Utensils className="w-6 h-6 sm:w-7 sm:h-7 text-[#2FC8B9]" />
              </div>
            </div>
            <h3 className="text-slate-500 text-[10px] sm:text-xs font-black mb-1 uppercase tracking-[0.15em] relative z-10">Diet Plan</h3>
            <p className="text-base sm:text-lg font-black text-black mb-1 relative z-10 leading-tight">
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
              {activeDietPlan ? 'Personalized plan' : 'Generate plan'}
            </p>
          </Link>

          {/* Mind Card */}
          <Link
            to="/challenge"
            className="card p-4 sm:p-6 group relative overflow-hidden bg-white border border-slate-100"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#2FC8B9]/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#2FC8B9]/10 flex items-center justify-center group-hover:rotate-12 transition-transform shadow-sm">
                <Wind className="w-6 h-6 sm:w-7 sm:h-7 text-[#2FC8B9]" />
              </div>
            </div>
            <h3 className="text-slate-500 text-[10px] sm:text-xs font-black mb-1 uppercase tracking-[0.15em] relative z-10">Mind</h3>
            <p className="text-2xl sm:text-3xl font-black text-black mb-1 relative z-10">
              {dashboardData?.streakDays || user?.challengeStreak || 0} <span className="text-base sm:text-lg opacity-40 font-medium">days</span>
            </p>
            <p className="text-[10px] sm:text-xs text-slate-400 font-bold relative z-10 text-[#2FC8B9]">Daily Streak</p>
          </Link>
        </div>

        {/* Diabetes Management Card */}
        <Link
          to="/glucose-log"
          className="block bg-white rounded-[2.5rem] shadow-sm p-6 sm:p-8 hover:shadow-xl transition-all group relative overflow-hidden border border-slate-100 mx-3 md:mx-0"
        >
          {/* Decorative Droplet Watermark */}
          <div className="absolute bottom-4 right-4 opacity-[0.03] pointer-events-none">
            <Droplets className="w-32 h-32 text-[#2FC8B9]" />
          </div>

          {/* Content */}
          <div className="relative z-10">
            {/* Top Row: Icon + Title + Badge */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center shadow-lg">
                  <Droplets className="w-6 h-6 text-[#2FC8B9]" />
                </div>
                <span className="text-xs font-black text-black uppercase tracking-[0.2em]">
                  Diabetes Care
                </span>
              </div>
              <span className="px-4 py-1.5 bg-[#2FC8B9] text-white rounded-full text-[10px] font-black shadow-sm tracking-widest uppercase">
                IN RANGE
              </span>
            </div>

            {/* Large Reading */}
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-5xl font-black text-black tracking-tighter">
                {(() => {
                  const glucoseData = JSON.parse(localStorage.getItem('glucoseData') || '[]');
                  return glucoseData.length > 0 ? glucoseData[0].value : 108;
                })()}
              </span>
              <span className="text-xs text-slate-400 font-black tracking-widest uppercase">MG/DL</span>
            </div>

            {/* Description */}
            <p className="text-slate-500 text-sm mb-6 leading-relaxed max-w-sm font-bold">
              Your fasting glucose is stable. Tap to log your next reading or view progress.
            </p>

            {/* CTA Link */}
            <div className="flex items-center gap-2 text-[#2FC8B9] font-black text-xs uppercase tracking-widest group-hover:gap-4 transition-all">
              <span>Enter Care Center</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </Link>

        {/* AI Health Insights Section - Only shown if user has reports */}
        {
          hasReports && (
            <div className="space-y-6 mx-3 md:mx-0">
              {/* AI Health Insights - Main Card */}
              <div className="bg-[#2FC8B9] rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden group">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl pointer-events-none"></div>
                <Sparkles className="absolute top-8 right-12 w-16 h-16 text-white/20 group-hover:scale-110 transition-transform duration-500" />

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-6">
                    <Sparkles className="w-5 h-5 text-white" />
                    <span className="text-xs font-black text-white uppercase tracking-[0.2em]">AI Insights</span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black text-white mb-4 tracking-tight leading-tight">
                    {dashboardData.recentReports[0]?.reportType || 'Health Report'} Analysis
                    <span className="block text-lg font-medium text-white/90 mt-1">
                      ({new Date(dashboardData.recentReports[0]?.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})
                    </span>
                  </h2>

                  <p className="text-white/80 text-sm sm:text-base leading-relaxed mb-10 max-w-xl font-bold italic">
                    "{dashboardData.latestAnalysis?.summary?.split('.')[0]}... {dashboardData.latestAnalysis?.summary?.split('.')[1]}."
                  </p>

                  <Link
                    to={`/reports/${dashboardData.recentReports[0]?._id}`}
                    className="inline-flex items-center gap-3 bg-black text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest transition-all hover:bg-slate-900 shadow-xl group"
                  >
                    Analysis Details
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>

              {/* Health Progress Comparison - Replaces Wellness Score */}
              <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 shadow-sm border border-slate-100 relative overflow-hidden">
                {comparisonLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-10 h-10 border-3 border-[#2FC8B9]/20 border-t-[#2FC8B9] rounded-full animate-spin" />
                  </div>
                ) : reportComparison?.hasData ? (
                  <>
                    {/* Header with score change */}
                    <div className="flex justify-between items-start mb-6 relative z-10">
                      <div>
                        <span className="text-xs font-black text-[#2FC8B9] uppercase tracking-widest">Health Progress</span>
                        <div className="flex items-baseline gap-3 mt-3">
                          <span className="text-5xl sm:text-6xl font-black text-black tracking-tighter">
                            {reportComparison.latestReport.healthScore}%
                          </span>
                          {reportComparison.hasComparison && reportComparison.scoreChange !== 0 && (
                            <span className={`flex items-center gap-1 text-sm font-black ${reportComparison.scoreChange > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {reportComparison.scoreChange > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                              {reportComparison.scoreChange > 0 ? '+' : ''}{reportComparison.scoreChange}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {reportComparison.hasComparison ? (
                          <div className={`px-3 py-1.5 rounded-xl text-xs font-black ${reportComparison.scoreChange > 0 ? 'bg-emerald-50 text-emerald-600' : reportComparison.scoreChange < 0 ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-500'}`}>
                            {reportComparison.scoreChange > 0 ? '📈 Improved' : reportComparison.scoreChange < 0 ? '📉 Declined' : '📊 Stable'}
                          </div>
                        ) : (
                          <div className="px-3 py-1.5 rounded-xl text-xs font-black bg-[#2FC8B9]/10 text-[#2FC8B9]">
                            🌟 Baseline Set
                          </div>
                        )}
                        <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-wider">
                          {reportComparison.totalReports} report{reportComparison.totalReports > 1 ? 's' : ''} analyzed
                        </p>
                      </div>
                    </div>

                    {/* Score History Chart */}
                    <div className="h-48 sm:h-56 w-full mt-4 -mx-2 sm:mx-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={reportComparison.scoreHistory} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis
                            dataKey="dateLabel"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                            domain={[0, 100]}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-black shadow-2xl rounded-2xl p-4 border border-[#2FC8B9]/20">
                                    <p className="text-[10px] font-black text-[#2FC8B9] uppercase mb-1 tracking-wider">{payload[0].payload.dateLabel}</p>
                                    <p className="text-sm font-black text-white">{payload[0].value}% Health Score</p>
                                    <p className="text-[10px] text-white/60 mt-1">{payload[0].payload.type}</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="score" fill="#2FC8B9" radius={[8, 8, 0, 0]} maxBarSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Comparison Metrics Grid */}
                    {reportComparison.comparisonMetrics?.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Biomarker Comparison</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {reportComparison.comparisonMetrics.slice(0, 6).map((metric, idx) => (
                            <div key={idx} className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                              <p className="text-[10px] text-slate-500 font-bold truncate">{metric.name}</p>
                              <div className="flex items-end gap-1 mt-1">
                                <span className="text-lg font-black text-black">{metric.latestValue}</span>
                                <span className="text-[10px] text-slate-400 font-bold mb-0.5">{metric.unit}</span>
                              </div>
                              {metric.change !== 0 && (
                                <div className={`flex items-center gap-1 mt-1 text-[10px] font-black ${metric.changePercent > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                  {metric.changePercent > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  {metric.changePercent > 0 ? '+' : ''}{metric.changePercent}% from last
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI Insights */}
                    {reportComparison.insights?.length > 0 && (
                      <div className="mt-8">
                        <div className="flex items-center gap-2 mb-4">
                          <Sparkles className="w-4 h-4 text-[#2FC8B9]" />
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">AI Analysis</h4>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {reportComparison.insights.map((insight, idx) => {
                            const isPositive = insight.type === 'positive';
                            const isWarning = insight.type === 'warning';

                            return (
                              <div
                                key={idx}
                                className={`group relative overflow-hidden rounded-[2rem] p-5 flex items-center gap-5 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-xl
                                  ${isPositive ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-50/50 to-white border border-emerald-100/50' :
                                    isWarning ? 'bg-gradient-to-br from-orange-500/10 via-orange-50/50 to-white border border-orange-100/50' :
                                      'bg-gradient-to-br from-blue-500/10 via-blue-50/50 to-white border border-blue-100/50'
                                  }`}
                              >
                                {/* Animated background element */}
                                <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl opacity-20 transition-all group-hover:scale-150
                                  ${isPositive ? 'bg-emerald-400' : isWarning ? 'bg-orange-400' : 'bg-blue-400'}`} />

                                <div className={`flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner transition-transform group-hover:rotate-12
                                  ${isPositive ? 'bg-emerald-100 text-emerald-600' :
                                    isWarning ? 'bg-orange-100 text-orange-600' :
                                      'bg-blue-100 text-blue-600'
                                  }`}>
                                  {isPositive ? <TrendingUp className="w-7 h-7" /> :
                                    isWarning ? <TrendingDown className="w-7 h-7" /> :
                                      <Activity className="w-7 h-7" />}
                                </div>

                                <div className="flex-1 relative z-10">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] 
                                      ${isPositive ? 'text-emerald-500' : isWarning ? 'text-orange-500' : 'text-blue-500'}`}>
                                      {isPositive ? 'Improvement' : isWarning ? 'Attention' : 'Analysis'}
                                    </span>
                                    {insight.icon && <span className="text-sm">{insight.icon}</span>}
                                  </div>
                                  <p className="text-sm font-black text-slate-800 leading-tight">
                                    {insight.text}
                                  </p>
                                </div>

                                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-black group-hover:translate-x-1 transition-all" />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* No comparison available */
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-[#2FC8B9]/10 flex items-center justify-center mx-auto mb-4">
                      <BarChart3 className="w-8 h-8 text-[#2FC8B9]" />
                    </div>
                    <h3 className="text-xl font-black text-black mb-2">Health Progress Tracking</h3>
                    <p className="text-sm text-slate-500 font-bold max-w-sm mx-auto mb-6">
                      {reportComparison?.message || 'Upload at least 2 health reports to see your progress comparison and trends.'}
                    </p>
                    {dashboardData?.healthScores?.length > 0 && (
                      <div className="h-32 w-full mt-4 -mx-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={dashboardData.healthScores?.slice(-7) || []}>
                            <defs>
                              <linearGradient id="scoreGradient2" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2FC8B9" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#2FC8B9" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="score" stroke="#2FC8B9" strokeWidth={3} fillOpacity={1} fill="url(#scoreGradient2)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    <Link
                      to="/upload"
                      className="inline-flex items-center gap-2 mt-4 px-6 py-3 bg-[#2FC8B9] text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-[#1db7a6] transition-all shadow-lg"
                    >
                      <Upload className="w-4 h-4" />
                      Upload Report
                    </Link>
                  </div>
                )}
              </div>

              {/* Biomarker Trends Section */}
              <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-black text-black tracking-tight uppercase">Biomarker Trends</h3>
                  <button className="text-[#2FC8B9] text-xs font-black uppercase tracking-widest flex items-center gap-1 group">
                    View All
                    <ArrowRight className="w-3 h-3 group-hover:gap-2 transition-all" />
                  </button>
                </div>

                {/* Biomarker Selector & Chart */}
                <div className="space-y-6 sm:space-y-8">
                  {/* Custom Styled Select with Trend Summary */}
                  <div className="relative">
                    <button
                      onClick={() => setIsMetricDropdownOpen(!isMetricDropdownOpen)}
                      className="w-full bg-slate-50 rounded-3xl p-4 sm:p-6 border border-slate-100 flex items-center justify-between hover:border-[#2FC8B9]/20 transition-all text-left"
                    >
                      <div>
                        <span className="text-black font-black block sm:inline">
                          {currentMetric?.name || 'Core Biomarker'}
                        </span>
                        {currentMetric && currentMetric.history.length > 0 && (
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                            Current: {currentMetric.history[currentMetric.history.length - 1]?.value} {currentMetric.unit}
                          </p>
                        )}
                      </div>
                      <ChevronRight className={`w-5 h-5 text-[#2FC8B9] transition-transform ${isMetricDropdownOpen ? 'rotate-[-90deg]' : 'rotate-90'}`} />
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
                            className={`w-full px-6 py-4 text-left hover:bg-slate-50 transition-colors text-sm font-bold ${selectedMetric === key ? 'text-[#2FC8B9]' : 'text-slate-600'}`}
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
                                <div className="bg-black shadow-2xl rounded-2xl p-4 border border-[#2FC8B9]/20 shadow-[#2FC8B9]/10">
                                  <p className="text-[10px] font-black text-[#2FC8B9] uppercase mb-1 tracking-wider">{payload[0].payload.date}</p>
                                  <p className="text-sm font-black text-white">{payload[0].value} {currentMetric?.unit}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#2FC8B9"
                          strokeWidth={4}
                          fill="#2FC8B9"
                          fillOpacity={0.05}
                          dot={{ r: 5, fill: '#2FC8B9', strokeWidth: 3, stroke: '#fff' }}
                          activeDot={{ r: 7, fill: '#2FC8B9', strokeWidth: 3, stroke: '#fff', shadow: '0 0 15px rgba(47,200,185,0.4)' }}
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
                <h3 className="text-lg font-black text-black tracking-tight mb-6 sm:mb-8 uppercase">Vitality Overview</h3>
                <div className="grid grid-cols-3 gap-3 sm:gap-4 pb-2 sm:pb-0">
                  <div className="bg-slate-50 rounded-3xl p-4 sm:p-6 border border-slate-100 text-center group hover:scale-105 transition-transform">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-sm">
                      <span className="text-xl sm:text-2xl font-black text-[#2FC8B9]">
                        {Object.values(dashboardData.latestAnalysis?.metrics || {}).filter(m => m.status === 'normal' || m.status?.toLowerCase() === 'normal').length || 4}
                      </span>
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest block">Optimal</span>
                  </div>
                  <div className="bg-slate-50 rounded-3xl p-4 sm:p-6 border border-slate-100 text-center group hover:scale-105 transition-transform">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-sm">
                      <span className="text-xl sm:text-2xl font-black text-amber-500">
                        {Object.values(dashboardData.latestAnalysis?.metrics || {}).filter(m => m.status === 'moderate' || m.status === 'warning' || m.status?.toLowerCase().includes('borderline')).length || 2}
                      </span>
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest block">Moderate</span>
                  </div>
                  <div className="bg-slate-50 rounded-3xl p-4 sm:p-6 border border-slate-100 text-center group hover:scale-105 transition-transform">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-sm">
                      <span className="text-xl sm:text-2xl font-black text-rose-500">
                        {Object.values(dashboardData.latestAnalysis?.metrics || {}).filter(m => ['low', 'high', 'critical'].includes(m.status?.toLowerCase())).length || 2}
                      </span>
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest block">Review</span>
                  </div>
                </div>
              </div>

              {/* Critical Deficiencies Section */}
              <div className="bg-slate-50 rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-slate-100">
                <div className="flex items-center gap-4 mb-6 sm:mb-8">
                  <div className="w-11 h-11 rounded-2xl bg-black flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-[#2FC8B9]" />
                  </div>
                  <h3 className="text-lg font-black text-black tracking-tight uppercase">Critical Alerts</h3>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  {(dashboardData.latestAnalysis?.deficiencies?.length > 0 ? dashboardData.latestAnalysis.deficiencies : [
                    { name: 'Vitamin D Deficiency', severity: 'High' },
                    { name: 'Iron Insufficiency', severity: 'Moderate' }
                  ]).map((def, idx) => (
                    <Link
                      key={idx}
                      to={`/reports/${dashboardData.recentReports[0]?._id}`}
                      className="flex items-center justify-between bg-white rounded-3xl p-5 border border-slate-100 hover:border-[#2FC8B9]/20 transition-all group shadow-sm"
                    >
                      <div className="flex items-center gap-4 overflow-hidden">
                        <div className={`w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center bg-slate-50 group-hover:bg-[#2FC8B9]/10`}>
                          <AlertTriangle className="w-5 h-5 text-amber-500 group-hover:text-[#2FC8B9] transition-colors" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-black group-hover:text-[#2FC8B9] transition-colors text-sm sm:text-base truncate">{def.name}</h4>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                            {def.severity || 'High'} Priority
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#2FC8B9] transition-all flex-shrink-0" />
                    </Link>
                  ))}

                  <Link
                    to="/nutrition"
                    className="w-full mt-4 bg-black hover:bg-[#2FC8B9] text-white font-black text-xs sm:text-sm uppercase tracking-[0.2em] py-5 rounded-3xl transition-all shadow-lg flex items-center justify-center gap-2 group"
                  >
                    Personalized Diet Plan
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
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
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-black text-black uppercase tracking-tight">Recent Tests</h3>
              <Link to="/reports" className="text-[10px] font-black text-[#2FC8B9] uppercase tracking-widest hover:underline transition-all">View All</Link>
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
                    <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-inner text-slate-400 group-hover:text-[#2FC8B9] transition-colors">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-black text-black group-hover:text-[#2FC8B9] transition-colors text-sm">{report.reportType}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                        {new Date(report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${report.status === 'completed' ? 'text-[#2FC8B9]' : 'text-amber-500'
                      }`}>
                      {report.status === 'completed' ? 'Analyzed' : 'In Progress'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#2FC8B9] transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Recommended Tests Column */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-11 h-11 rounded-2xl bg-black flex items-center justify-center">
                <Activity className="w-6 h-6 text-[#2FC8B9]" />
              </div>
              <h3 className="text-lg font-black text-black uppercase tracking-tight leading-tight">Elite Choices</h3>
            </div>
            <div className="space-y-4">
              {[
                { name: 'Vitamin B12 Panel', reason: 'Low intake detected in food log', type: 'Test' },
                { name: 'Omega-3 (1000mg)', reason: 'To support heart and brain health', type: 'Supplement' },
                { name: 'HbA1c Test', reason: 'Important for diabetes monitoring', type: 'Test' },
                { name: 'Vitamin D3 (2000 IU)', reason: 'Low sun exposure detected', type: 'Supplement' }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-3xl group cursor-pointer hover:bg-white border border-transparent hover:border-slate-100 transition-all">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-black text-black">{item.name}</h4>
                      <span className={`text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-md ${item.type === 'Test' ? 'bg-black text-white' : 'bg-[#2FC8B9] text-white'
                        }`}>
                        {item.type}
                      </span>
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.reason}</p>
                  </div>
                  <button className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm text-black hover:bg-[#2FC8B9] hover:text-white transition-all">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>








        <div>
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center">
              <Trophy className="w-6 h-6 text-[#2FC8B9]" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-black tracking-tight leading-none uppercase">30 Days Challenge</h2>
              <p className="text-slate-500 text-sm font-bold mt-1">Sculpt your future, day by day</p>
            </div>
          </div>
          <Link
            to="/challenge"
            className="block bg-white rounded-[2.5rem] p-8 sm:p-12 text-black shadow-xl border border-slate-100 hover:shadow-2xl transition-all relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#2FC8B9]/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
            <div className="flex items-center justify-between mb-8 sm:mb-10 relative z-10">
              <div className="flex items-center gap-4 sm:gap-6 flex-1">
                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-[2rem] bg-slate-50 flex items-center justify-center border border-slate-100">
                  <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-[#2FC8B9]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl sm:text-3xl font-black mb-1 leading-tight tracking-tight text-black">Daily Discipline</h3>
                  <p className="text-sm sm:text-lg text-slate-500 font-bold">Unleash your ultimate physical potential</p>
                </div>
              </div>
              <ChevronRight className="w-8 h-8 sm:w-10 sm:h-10 text-slate-300 group-hover:text-[#2FC8B9] group-hover:translate-x-3 transition-all flex-shrink-0" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12 relative z-10">
              <div className="bg-slate-50 rounded-3xl p-5 sm:p-6 text-center border border-slate-100 group-hover:bg-[#2FC8B9]/5 transition-all">
                <div className="text-3xl sm:text-4xl mb-3">💧</div>
                <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#2FC8B9]">Hydrate</p>
              </div>
              <div className="bg-slate-50 rounded-3xl p-5 sm:p-6 text-center border border-slate-100 group-hover:bg-[#2FC8B9]/5 transition-all">
                <div className="text-3xl sm:text-4xl mb-3">🏋️</div>
                <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#2FC8B9]">Push</p>
              </div>
              <div className="bg-slate-50 rounded-3xl p-5 sm:p-6 text-center border border-slate-100 group-hover:bg-[#2FC8B9]/5 transition-all">
                <div className="text-3xl sm:text-4xl mb-3">🥩</div>
                <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#2FC8B9]">Fuel</p>
              </div>
              <div className="bg-slate-50 rounded-3xl p-5 sm:p-6 text-center border border-slate-100 group-hover:bg-[#2FC8B9]/5 transition-all">
                <div className="text-3xl sm:text-4xl mb-3">⚡</div>
                <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#2FC8B9]">Recover</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <span className="text-sm font-black uppercase tracking-widest text-slate-700">Active Streak</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm font-black uppercase tracking-widest text-slate-700">Badges</span>
                </div>
              </div>
              <div className="px-10 py-5 bg-black text-white rounded-2xl text-xs sm:text-sm font-black uppercase tracking-widest shadow-xl flex items-center gap-3 transition-transform hover:bg-[#2FC8B9] hover:scale-105">
                Start Today
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>
          </Link>
        </div>

        <div>
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-[#2FC8B9]" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-black tracking-tight leading-none uppercase">Did You Know?</h2>
              <p className="text-slate-500 text-sm font-bold mt-1">Science-backed nutrition secrets</p>
            </div>
          </div>
          <div className="md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-4 flex md:flex-none overflow-x-auto gap-4 pb-4 md:pb-0 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
            <div className="min-w-[280px] md:min-w-0 snap-center bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-xl hover:border-[#2FC8B9]/10 transition-all">
              <div className="flex items-center gap-4 mb-6">
                <div className="text-4xl drop-shadow-md">🥑</div>
                <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                  <Apple className="w-6 h-6 text-[#2FC8B9]" />
                </div>
              </div>
              <h3 className="font-black text-black mb-3 text-lg">Guava Power</h3>
              <p className="text-sm text-slate-500 leading-relaxed font-bold">
                One guava contains <span className="text-[#2FC8B9] font-black">3g of protein</span> - more than most fruits in nature!
              </p>
            </div>
            <div className="min-w-[280px] md:min-w-0 snap-center bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-xl hover:border-[#2FC8B9]/10 transition-all">
              <div className="flex items-center gap-4 mb-6">
                <div className="text-4xl drop-shadow-md">🥬</div>
                <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                  <Droplets className="w-6 h-6 text-[#2FC8B9]" />
                </div>
              </div>
              <h3 className="font-black text-black mb-3 text-lg">Spinach Iron</h3>
              <p className="text-sm text-slate-500 leading-relaxed font-bold">
                Spinach packs <span className="text-[#2FC8B9] font-black">2.7mg of iron</span> per 100g - super blood support fuel.
              </p>
            </div>
            <div className="min-w-[280px] md:min-w-0 snap-center bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-xl hover:border-[#2FC8B9]/10 transition-all">
              <div className="flex items-center gap-4 mb-6">
                <div className="text-4xl drop-shadow-md">🥜</div>
                <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                  <Zap className="w-6 h-6 text-[#2FC8B9]" />
                </div>
              </div>
              <h3 className="font-black text-black mb-3 text-lg">Almond Energy</h3>
              <p className="text-sm text-slate-500 leading-relaxed font-bold">
                Just <span className="text-[#2FC8B9] font-black">23 almonds</span> provide 6g protein and fats for better brain power.
              </p>
            </div>
            <div className="min-w-[280px] md:min-w-0 snap-center bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-xl hover:border-[#2FC8B9]/10 transition-all">
              <div className="flex items-center gap-4 mb-6">
                <div className="text-4xl drop-shadow-md">🥚</div>
                <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                  <Sun className="w-6 h-6 text-[#2FC8B9]" />
                </div>
              </div>
              <h3 className="font-black text-black mb-3 text-lg">Egg Vitamin D</h3>
              <p className="text-sm text-slate-500 leading-relaxed font-bold">
                One egg yolk has <span className="text-[#2FC8B9] font-black">40 IU Vitamin D</span> - essential for bone density.
              </p>
            </div>
          </div>
        </div>
        {/* CTA Footer */}
        <div className="bg-[#2FC8B9] rounded-[3rem] p-10 sm:p-16 text-white relative overflow-hidden group shadow-2xl">
          <div className="absolute top-0 left-1/2 w-[600px] h-[600px] bg-white/10 rounded-full -translate-y-1/2 -translate-x-1/2 blur-[120px] pointer-events-none"></div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-12 relative z-10">
            <div className="text-center md:text-left">
              <h3 className="text-4xl sm:text-5xl font-black mb-6 tracking-tighter uppercase leading-none">Elevate Your Journey</h3>
              <p className="text-white/80 font-bold text-base sm:text-xl max-w-xl">Our Health Intelligence engine is primed to optimize your wellness trajectory through advanced data analysis.</p>
            </div>
            <Link
              to="/ai-chat"
              className="px-12 py-6 bg-black text-white rounded-2xl font-black uppercase tracking-[0.25em] transition-all hover:bg-slate-900 shadow-2xl flex items-center gap-4 group hover:scale-105 active:scale-95"
            >
              <MessageSquare className="w-6 h-6 text-[#2FC8B9]" />
              Initialize AI
              <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
            </Link>
          </div>
        </div>

        <div className="mt-12 mb-8 px-4">
          <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed max-w-2xl mx-auto">
              Medical Disclaimer: The AI-generated insights, health scores, and diet recommendations provided by this platform are for informational and educational purposes only. This is not medical advice. Always consult with a qualified healthcare professional before making any changes to your medication, diet, or exercise routine.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
