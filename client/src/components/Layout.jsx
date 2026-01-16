import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Calendar, FileText, History, Settings, LogOut,
  Bell, Search, Menu, X, Watch, Users, HelpCircle, Activity, Clock, Apple, MessageSquare
} from 'lucide-react';
import { useState } from 'react';
import TextSelectionPopup from './TextSelectionPopup';

const patientNavItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/ai-chat', icon: MessageSquare, label: 'AI Assistant' },
  { path: '/doctors', icon: Calendar, label: 'Appointments' },
  { path: '/upload', icon: FileText, label: 'My Reports' },
  { path: '/wearables', icon: Watch, label: 'Devices' },
  { path: '/diet-plan', icon: Apple, label: 'Diet Plan' },
  { path: '/profile', icon: Settings, label: 'Profile' }
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

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - Slide from RIGHT on mobile, fixed on desktop */}
      <aside className={`fixed inset-y-0 right-0 lg:left-0 lg:right-auto z-50 w-64 bg-white border-l lg:border-r lg:border-l-0 border-slate-200 shadow-lg lg:shadow-sm transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        <div className="flex flex-col h-full">
          {/* Logo - Fixed at top */}
          <div className="p-6 border-b border-slate-100 shrink-0">
            <Link to={homeLink} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-slate-800">HealthAI</p>
                <p className="text-xs text-slate-500">{portalName}</p>
              </div>
            </Link>
          </div>

          {/* Navigation - Scrollable middle section */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map(({ path, icon: Icon, label }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  location.pathname === path
                    ? 'bg-cyan-50 text-cyan-600 border border-cyan-200'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>

          {/* User Footer - Fixed at bottom */}
          <div className="p-4 border-t border-slate-100 shrink-0">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shrink-0">
                <span className="text-white font-bold">{user?.name?.[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {isDoctor() ? `Dr. ${user?.name}` : user?.name}
                </p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0"
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
        <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content - Add left margin for fixed sidebar on desktop */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-64">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200">
          <div className="flex items-center justify-between px-4 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg">
                <Menu className="w-6 h-6" />
              </button>
              <h1 className="text-lg font-semibold text-slate-800 hidden sm:block">
                {navItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="hidden md:flex items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="w-48 pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Notifications */}
              <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
              </button>

              {/* User Avatar */}
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">{user?.name?.[0]?.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>

      {/* Text Selection Popup - Disabled on AI Chat page */}
      {location.pathname !== '/ai-chat' && <TextSelectionPopup />}
    </div>
  );
}
