import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Calendar, FileText, Settings, LogOut,
  Bell, Search, Activity, Watch, Clock, Apple, MessageSquare, Utensils, ArrowLeft
} from 'lucide-react';
import { useState, useEffect } from 'react';
import TextSelectionPopup from './TextSelectionPopup';
import MobileBottomNav from './MobileBottomNav';
import PWAInstallPrompt from './PWAInstallPrompt';
import axios from 'axios';

const patientNavItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/ai-chat', icon: MessageSquare, label: 'AI Assistant' },
  { path: '/upload', icon: FileText, label: 'My Reports' },
  { path: '/nutrition', icon: Utensils, label: 'Nutrition' },
  { path: '/diet-plan', icon: Apple, label: 'Diet Plan' },
  { path: '/profile', icon: Settings, label: 'Profile' },
  { path: '/doctors', icon: Calendar, label: 'Appointments', comingSoon: true },
  { path: '/wearables', icon: Watch, label: 'Devices', comingSoon: true }
];

const doctorNavItems = [
  { path: '/doctor/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/doctor/availability', icon: Clock, label: 'Manage Slots' },
  { path: '/profile', icon: Settings, label: 'Profile' }
];

const adminNavItems = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/profile', icon: Settings, label: 'Settings' }
];

export default function Layout({ children, isAdmin: isAdminLayout, isDoctor: isDoctorLayout }) {
  const { user, logout, isAdmin, isDoctor } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [healthData, setHealthData] = useState({ healthScore: 0, caloriesConsumed: 0, calorieTarget: 2000 });

  // Fetch real-time health data for dashboard
  useEffect(() => {
    const fetchHealthData = async () => {
      if (location.pathname === '/dashboard' && !isAdmin() && !isDoctor()) {
        try {
          const token = localStorage.getItem('token');
          const headers = { Authorization: `Bearer ${token}` };

          // Fetch latest report for health score
          const reportsRes = await axios.get('/api/health/reports', { headers });
          const latestReport = reportsRes.data.reports?.[0];
          const healthScore = latestReport?.healthScore || 0;

          // Fetch today's nutrition summary
          const today = new Date().toISOString().split('T')[0];
          const nutritionRes = await axios.get(`/api/nutrition/summary/daily?date=${today}`, { headers });
          const caloriesConsumed = nutritionRes.data.summary?.totalCalories || 0;

          // Fetch health goal for calorie target
          const goalRes = await axios.get('/api/nutrition/goals', { headers }).catch(() => ({ data: { healthGoal: null } }));
          const calorieTarget = goalRes.data.healthGoal?.dailyCalorieTarget || 2000;

          setHealthData({ healthScore, caloriesConsumed, calorieTarget });
        } catch (error) {
          console.error('Failed to fetch health data:', error);
        }
      }
    };

    fetchHealthData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchHealthData, 30000);
    return () => clearInterval(interval);
  }, [location.pathname, isAdmin, isDoctor]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  let navItems = patientNavItems;
  let homeLink = '/dashboard';
  let portalName = 'Patient Portal';

  if (isAdmin() || isAdminLayout) {
    navItems = adminNavItems;
    homeLink = '/admin';
    portalName = 'Admin Panel';
  } else if (isDoctor() || isDoctorLayout) {
    navItems = doctorNavItems;
    homeLink = '/doctor/dashboard';
    portalName = user?.doctorProfile?.specialization || 'Doctor Portal';
  }

  // Clean white background for all pages
  const bgColor = 'bg-white';

  const isDashboardPage = location.pathname === '/dashboard' || location.pathname === '/doctor/dashboard' || location.pathname === '/admin';

  return (
    <div className={`min-h-screen flex ${bgColor}`}>
      {/* Sidebar - Slide from RIGHT on mobile, fixed on desktop */}
      <aside className={`fixed inset-y-0 right-0 lg:left-0 lg:right-auto z-50 w-64 shadow-2xl lg:shadow-none transform transition-transform duration-300 hidden lg:flex lg:flex-col bg-white border-r border-slate-100 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        <div className="flex flex-col h-full">
          {/* Logo - Fixed at top */}
          <div className="p-8 shrink-0 border-b border-slate-50">
            <Link to={homeLink} className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#2FC8B9]/10 border border-[#2FC8B9]/20 shadow-[0_0_15px_rgba(47,200,185,0.2)]">
                <Activity className="w-6 h-6 text-[#2FC8B9]" />
              </div>
              <div className="min-w-0">
                <p className="font-black text-black text-lg tracking-tighter uppercase leading-none">FitCure</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 truncate">{portalName}</p>
              </div>
            </Link>
          </div>

          {/* Navigation - Scrollable middle section */}
          <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
            {navItems.map(({ path, icon: Icon, label, comingSoon }) => {
              if (comingSoon) {
                return (
                  <div
                    key={path}
                    className="flex items-center gap-4 px-4 py-4 rounded-2xl font-bold transition-all cursor-not-allowed opacity-30 text-slate-300"
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm uppercase tracking-widest">{label}</span>
                  </div>
                );
              }

              const isActive = location.pathname === path;

              return (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-4 px-5 py-4 rounded-2xl font-black transition-all group ${isActive
                    ? 'bg-[#2FC8B9] text-white shadow-[0_10px_20px_-10px_rgba(47,200,185,0.5)]'
                    : 'text-slate-500 hover:text-black hover:bg-slate-50'
                    }`}
                >
                  <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-[#2FC8B9]'}`} />
                  <span className="text-xs uppercase tracking-[0.2em]">{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Footer - Fixed at bottom */}
          <div className="p-6 shrink-0 border-t border-slate-50">
            <div className="flex items-center gap-4 p-4 rounded-[1.25rem] bg-slate-50 hover:bg-slate-100 transition-all border border-slate-100">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#2FC8B9] shadow-lg">
                <span className="font-black text-white">{user?.name?.[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black truncate text-black uppercase tracking-wider">
                  {isDoctor() ? `DR. ${user?.name}` : user?.name}
                </p>
                <p className="text-[10px] truncate text-slate-500 font-bold lowercase">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl transition-all shrink-0 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content - Add left margin for fixed sidebar on desktop */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-64">
        {/* Desktop Header - Show on all pages */}
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 border-b border-slate-100 hidden md:block">
          <div className="flex items-center justify-between px-8 py-5">
            <div className="flex items-center gap-6">
              <h1 className="text-xl font-black text-black uppercase tracking-tight">
                {location.pathname === '/dashboard'
                  ? `Welcome, ${user?.name?.split(' ')[0] || 'User'}`
                  : (navItems.find(item => item.path === location.pathname)?.label || 'Dashboard')}
              </h1>
            </div>

            <div className="flex items-center gap-6 overflow-hidden">
              {/* Search */}
              <div className="hidden lg:flex items-center">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#2FC8B9] transition-colors" />
                  <input
                    type="text"
                    placeholder="Search metrics..."
                    className="w-64 pl-12 pr-6 py-3 rounded-2xl text-xs font-bold focus:outline-none bg-slate-50 border border-slate-100 focus:border-[#2FC8B9]/30 transition-all placeholder-slate-400"
                  />
                </div>
              </div>

              {/* Notifications */}
              <button className="relative p-3 rounded-2xl transition-all flex-shrink-0 bg-slate-50 border border-slate-100 text-slate-400 hover:text-[#2FC8B9] hover:bg-white hover:shadow-sm">
                <Bell className="w-5 h-5" />
                <span className="absolute top-3 right-3 w-2 h-2 bg-[#2FC8B9] rounded-full border-2 border-white" />
              </button>

              {/* Profile Icon - Click to go to profile */}
              <button
                onClick={() => navigate('/profile')}
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#2FC8B9] shadow-lg hover:shadow-xl transition-all cursor-pointer"
                title="Go to Profile"
              >
                <span className="font-black text-white">{user?.name?.[0]?.toUpperCase()}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Back Button Header - Only for non-dashboard and non-food-scan pages */}
        {!isDashboardPage && location.pathname !== '/quick-food-scan' && (
          <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/95 border-b border-slate-100 md:hidden">
            <div className="flex items-center px-4 py-3 gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-all"
                title="Go Back"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
              <h1 className="text-base font-bold text-black">
                {navItems.find(item => item.path === location.pathname)?.label || 'Back'}
              </h1>
            </div>
          </header>
        )}

        {/* Page Content */}
        <main className="flex-1 main-content-mobile overflow-x-hidden w-full" style={
          location.pathname === '/nutrition' || location.pathname === '/ai-chat'
            ? { padding: 0, backgroundColor: 'white' }
            : location.pathname === '/dashboard' || location.pathname === '/glucose-log'
              ? { padding: 0 }
              : { padding: 0 }
        }>
          {children}
        </main>

        {/* Mobile Bottom Navigation - Only show for patients on mobile */}
        {!isAdmin() && !isDoctor() && !isAdminLayout && !isDoctorLayout && (
          <>
            <MobileBottomNav />
            <PWAInstallPrompt />
          </>
        )}
      </div>

      {/* Text Selection Popup - Disabled on AI Chat page */}
      {location.pathname !== '/ai-chat' && <TextSelectionPopup />}
    </div>
  );
}
