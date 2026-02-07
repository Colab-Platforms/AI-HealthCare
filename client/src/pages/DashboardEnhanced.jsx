import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import {
  Heart, Upload, Utensils, FileText, Activity, TrendingUp, User,
  Calendar, MessageSquare, Pill, Apple, Dumbbell, Brain, Shield, Sparkles,
  CheckCircle, Target, Award, ChevronRight, Zap, Sun, Droplets,
  BarChart3, ArrowRight, Star, Flame, Trophy
} from 'lucide-react';

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

// Feature Card Component
const FeatureCard = ({ title, description, link, status, icon: Icon, gradient }) => {
  return (
    <Link 
      to={link}
      className="group relative overflow-hidden rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
    >
      <div className={`h-48 bg-gradient-to-br ${gradient} relative rounded-t-3xl`}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.8),transparent_50%)] animate-pulse"></div>
        </div>
        <div className="absolute top-4 left-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Icon className="w-8 h-8 text-white" />
          </div>
        </div>
        {status && (
          <div className="absolute top-4 right-4">
            <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-semibold text-slate-700">
              {status}
            </span>
          </div>
        )}
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-tl-full"></div>
      </div>
      <div className="bg-white p-5 rounded-b-3xl">
        <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-cyan-600 transition-colors">
          {title}
        </h3>
        <p className="text-sm text-slate-600 line-clamp-2">{description}</p>
        <div className="mt-3 flex items-center text-cyan-600 text-sm font-medium">
          <span>Get Started</span>
          <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
};

// Quick Action Card Component
const QuickActionCard = ({ icon: Icon, title, subtitle, link, color, comingSoon }) => {
  const content = (
    <div className={`relative bg-white rounded-2xl p-4 border-2 border-slate-100 hover:border-${color}-200 hover:shadow-lg transition-all duration-300 group ${comingSoon ? 'opacity-60' : 'cursor-pointer'}`}>
      <div className={`w-14 h-14 rounded-xl bg-${color}-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
        <Icon className={`w-7 h-7 text-${color}-500`} />
      </div>
      <h4 className="font-semibold text-slate-800 text-sm mb-1">{title}</h4>
      <p className="text-xs text-slate-500">{subtitle}</p>
      {comingSoon && (
        <div className="absolute top-2 right-2">
          <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded-full">
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
    <div className={`relative flex items-start gap-4 p-4 rounded-2xl transition-all duration-300 ${
      active ? 'bg-gradient-to-r from-cyan-50 to-emerald-50 border-2 border-cyan-200' : 
      completed ? 'bg-emerald-50 border-2 border-emerald-200' : 
      'bg-slate-50 border-2 border-slate-200'
    }`}>
      <div className={`relative flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
        completed ? 'bg-emerald-500 text-white' :
        active ? 'bg-gradient-to-br from-cyan-500 to-emerald-500 text-white animate-pulse' :
        'bg-white text-slate-400 border-2 border-slate-300'
      }`}>
        {completed ? <CheckCircle className="w-6 h-6" /> : 
         active ? <Icon className="w-6 h-6" /> : 
         number}
      </div>
      <div className="flex-1">
        <h4 className={`font-semibold mb-1 ${
          completed || active ? 'text-slate-800' : 'text-slate-500'
        }`}>
          {title}
        </h4>
        <p className={`text-sm ${
          completed || active ? 'text-slate-600' : 'text-slate-400'
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
  const { dashboardData, loading, fetchDashboard } = useData();
  const [completionProgress, setCompletionProgress] = useState(0);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

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

  if (loading.dashboard) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-cyan-100">
      <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-20 px-4">
        
        {/* Header */}
        <div className="pt-6">
          <h1 className="text-3xl font-bold text-slate-800 mb-1">
            Hi, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-emerald-600">
              {user?.name?.split(' ')[0] || 'there'}
            </span>! 👋
          </h1>
          <p className="text-slate-600">Welcome to your health journey</p>
        </div>

        {/* Health Stats */}
        {hasReports && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-sm text-slate-600 mb-1">Health Score</p>
              <p className="text-3xl font-bold text-slate-800">
                {dashboardData?.user?.healthMetrics?.healthScore || 'N/A'}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-sm text-slate-600 mb-1">Total Reports</p>
              <p className="text-3xl font-bold text-slate-800">
                {dashboardData?.recentReports?.length || 0}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
                  <Utensils className="w-6 h-6 text-white" />
                </div>
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
              <p className="text-sm text-slate-600 mb-1">Meals Logged</p>
              <p className="text-3xl font-bold text-slate-800">
                {dashboardData?.mealsLogged || 0}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <Star className="w-5 h-5 text-amber-400" />
              </div>
              <p className="text-sm text-slate-600 mb-1">Streak Days</p>
              <p className="text-3xl font-bold text-slate-800">
                {dashboardData?.streakDays || 0}
              </p>
            </div>
          </div>
        )}

        {/* Health Journey */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Heart className="w-7 h-7 text-red-500" />
                Health Journey
              </h2>
              <p className="text-slate-600 text-sm mt-1">Your personalized health management tools</p>
            </div>
          </div>
          <div className="md:grid md:grid-cols-3 md:gap-6 flex md:flex-none overflow-x-auto gap-4 pb-4 md:pb-0 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
            <div className="min-w-[280px] md:min-w-0 snap-center">
              <FeatureCard
                title="Upload Report"
                description="Get AI-powered analysis of your health reports with personalized insights"
                icon={Upload}
                gradient="from-blue-400 via-blue-500 to-blue-600"
                link="/upload"
                status={hasReports ? `${dashboardData.recentReports.length} Reports` : "Get Started"}
              />
            </div>
            <div className="min-w-[280px] md:min-w-0 snap-center">
              <FeatureCard
                title="Nutrition Tracker"
                description="Track your daily meals, calories, and macros with smart recommendations"
                icon={Utensils}
                gradient="from-emerald-400 via-emerald-500 to-emerald-600"
                link="/nutrition"
                status={hasNutrition ? "Active" : "Start Tracking"}
              />
            </div>
            <div className="min-w-[280px] md:min-w-0 snap-center">
              <FeatureCard
                title="Diet Plan"
                description="Get personalized meal plans based on your health reports and goals"
                icon={Apple}
                gradient="from-orange-400 via-orange-500 to-orange-600"
                link="/diet-plan"
                status="Personalized"
              />
            </div>
          </div>
        </div>

        {/* Health Score Graph */}
        {hasReports && healthScore && dashboardData?.healthScores?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-800">Health Score Trend</h3>
                <p className="text-slate-500 text-sm">Your overall health progress over time</p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-slate-800">{healthScore}</span>
                <span className="text-slate-400 text-sm">/100</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={dashboardData.healthScores.map(s => ({
                date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                score: s.score
              }))}>
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={[50, 100]} hide />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '12px' }}
                  labelStyle={{ color: '#64748b' }}
                  formatter={(value) => [`${value}/100`, 'Score']}
                />
                <Area type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} fill="url(#scoreGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* More Offerings - Horizontal scroll on mobile (2 cards at a time) */}
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-cyan-600" />
            More Offerings
          </h2>
          
          {/* Desktop: Grid layout */}
          <div className="hidden md:grid md:grid-cols-4 gap-4">
            <QuickActionCard icon={FileText} title="My Reports" subtitle="View all reports" link="/reports" color="blue" />
            <QuickActionCard icon={Apple} title="Quick Food Check" subtitle="Instant nutrition" link="/nutrition" color="emerald" />
            <QuickActionCard icon={Activity} title="Vital Signs" subtitle="Track metrics" link="/dashboard/classic" color="red" />
            <QuickActionCard icon={Pill} title="Supplements" subtitle="Recommendations" link="/diet-plan" color="purple" />
            <QuickActionCard icon={MessageSquare} title="AI Chat" subtitle="Ask health questions" link="/ai-chat" color="cyan" />
            <QuickActionCard icon={Calendar} title="Appointments" subtitle="Book doctors" link="/doctors" color="indigo" comingSoon />
            <QuickActionCard icon={Dumbbell} title="Fitness Plan" subtitle="Exercise routines" link="/dashboard" color="orange" comingSoon />
            <QuickActionCard icon={Brain} title="Mental Health" subtitle="Mood tracking" link="/dashboard" color="pink" comingSoon />
          </div>

          {/* Mobile: Horizontal scroll (2 cards at a time) */}
          <div className="md:hidden">
            <div className="flex overflow-x-auto gap-3 pb-4 snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
              <div className="min-w-[calc(50%-6px)] snap-start flex-shrink-0">
                <QuickActionCard icon={FileText} title="My Reports" subtitle="View all reports" link="/reports" color="blue" />
              </div>
              <div className="min-w-[calc(50%-6px)] snap-start flex-shrink-0">
                <QuickActionCard icon={Apple} title="Quick Food Check" subtitle="Instant nutrition" link="/nutrition" color="emerald" />
              </div>
              <div className="min-w-[calc(50%-6px)] snap-start flex-shrink-0">
                <QuickActionCard icon={Activity} title="Vital Signs" subtitle="Track metrics" link="/dashboard/classic" color="red" />
              </div>
              <div className="min-w-[calc(50%-6px)] snap-start flex-shrink-0">
                <QuickActionCard icon={Pill} title="Supplements" subtitle="Recommendations" link="/diet-plan" color="purple" />
              </div>
              <div className="min-w-[calc(50%-6px)] snap-start flex-shrink-0">
                <QuickActionCard icon={MessageSquare} title="AI Chat" subtitle="Ask health questions" link="/ai-chat" color="cyan" />
              </div>
              <div className="min-w-[calc(50%-6px)] snap-start flex-shrink-0">
                <QuickActionCard icon={Calendar} title="Appointments" subtitle="Book doctors" link="/doctors" color="indigo" comingSoon />
              </div>
              <div className="min-w-[calc(50%-6px)] snap-start flex-shrink-0">
                <QuickActionCard icon={Dumbbell} title="Fitness Plan" subtitle="Exercise routines" link="/dashboard" color="orange" comingSoon />
              </div>
              <div className="min-w-[calc(50%-6px)] snap-start flex-shrink-0">
                <QuickActionCard icon={Brain} title="Mental Health" subtitle="Mood tracking" link="/dashboard" color="pink" comingSoon />
              </div>
            </div>
            
            {/* Scroll Indicator */}
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-slate-400 text-xs">
                <ChevronRight className="w-4 h-4 animate-pulse" />
                <span>Scroll for more</span>
                <ChevronRight className="w-4 h-4 animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Reports */}
        {hasReports && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="w-7 h-7 text-blue-600" />
                  Recent Reports
                </h2>
                <p className="text-slate-600 text-sm mt-1">Your latest uploaded health reports</p>
              </div>
              <Link to="/reports" className="text-cyan-600 hover:text-cyan-700 font-medium text-xs sm:text-sm flex items-center gap-1 whitespace-nowrap">
                View All
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {dashboardData.recentReports.slice(0, 2).map((report) => (
                <div key={report._id} className="bg-white rounded-2xl border-2 border-orange-200 p-5 hover:shadow-lg transition-all group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      report.status === 'completed' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {report.status === 'completed' ? 'ANALYZED' : 'PENDING'}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg mb-2">
                    {report.reportType}
                  </h3>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(report.createdAt).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}</span>
                    </div>
                    {report.aiAnalysis?.healthScore && (
                      <div className="flex items-center gap-1">
                        <Heart className="w-4 h-4 text-red-500" />
                        <span className="font-bold text-slate-800">{report.aiAnalysis.healthScore}</span>
                      </div>
                    )}
                  </div>
                  {report.aiAnalysis?.summary && (
                    <p className="text-sm text-slate-600 line-clamp-2 mb-4">
                      {report.aiAnalysis.summary}
                    </p>
                  )}
                  
                  {/* Action Button */}
                  <Link 
                    to={`/reports/${report._id}`}
                    className="w-full py-2 px-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <Activity className="w-4 h-4" />
                    View Details
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 30 Days Challenge - Above Did You Know */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">30 Days Challenge</h2>
              <p className="text-slate-600 text-sm">Build healthy habits, one day at a time</p>
            </div>
          </div>
          <Link 
            to="/challenge"
            className="block bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-3xl p-5 sm:p-8 text-white hover:shadow-2xl transition-all hover:-translate-y-1 group"
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
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
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

        {/* Coming Soon - Horizontal scroll on mobile */}
        <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 rounded-3xl border-2 border-purple-200 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Coming Soon</h2>
              <p className="text-slate-600 text-sm">Exciting new features we're working on</p>
            </div>
          </div>
          <div className="md:grid md:grid-cols-3 md:gap-4 flex md:flex-none overflow-x-auto gap-4 pb-4 md:pb-0 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
            <div className="min-w-[280px] md:min-w-0 snap-center bg-white/80 backdrop-blur-sm rounded-2xl p-5 border-2 border-purple-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-purple-600" />
                </div>
                <Star className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="font-bold text-slate-800 mb-2">Mental Wellness</h3>
              <p className="text-sm text-slate-600">Mood tracking, meditation guides, and stress management tools</p>
            </div>
            <div className="min-w-[280px] md:min-w-0 snap-center bg-white/80 backdrop-blur-sm rounded-2xl p-5 border-2 border-pink-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center">
                  <Target className="w-5 h-5 text-pink-600" />
                </div>
                <Star className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="font-bold text-slate-800 mb-2">Fitness Coaching</h3>
              <p className="text-sm text-slate-600">Personalized workout plans and virtual fitness trainer</p>
            </div>
            <div className="min-w-[280px] md:min-w-0 snap-center bg-white/80 backdrop-blur-sm rounded-2xl p-5 border-2 border-orange-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-orange-600" />
                </div>
                <Star className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="font-bold text-slate-800 mb-2">Health Insurance</h3>
              <p className="text-sm text-slate-600">Compare plans and manage your health coverage</p>
            </div>
          </div>
        </div>

        {/* CTA Footer */}
        <div className="bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-3xl p-8 text-white">
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

      </div>
    </div>
  );
}
