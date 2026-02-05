import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Calendar, FileText, Settings, LogOut,
  Bell, Search, Activity, Watch, Clock, Apple, MessageSquare, Utensils
} from 'lucide-react';
import { useState } from 'react';
import TextSelectionPopup from './TextSelectionPopup';
import MobileBottomNav from './MobileBottomNav';

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
    <div className="min-h-screen flex" style={{ backgroundColor: '#F5F1EA' }}>
      {/* Sidebar - Slide from RIGHT on mobile, fixed on desktop */}
      <aside className={`fixed inset-y-0 right-0 lg:left-0 lg:right-auto z-50 w-64 bg-white shadow-lg lg:shadow-sm transform transition-transform duration-300 hidden lg:flex lg:flex-col ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`} style={{ borderRight: '2px solid #E5DFD3', borderLeft: '2px solid #E5DFD3' }}>
        <div className="flex flex-col h-full">
          {/* Logo - Fixed at top */}
          <div className="p-6 shrink-0" style={{ borderBottom: '1px solid #E5DFD3' }}>
            <Link to={homeLink} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#8B7355' }}>
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold" style={{ color: '#2C2416' }}>HealthAI</p>
                <p className="text-xs" style={{ color: '#5C4F3D' }}>{portalName}</p>
              </div>
            </Link>
          </div>

          {/* Navigation - Scrollable middle section */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map(({ path, icon: Icon, label, comingSoon }) => {
              // If coming soon, render as a div instead of Link
              if (comingSoon) {
                return (
                  <div
                    key={path}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all cursor-not-allowed relative"
                    style={{ color: '#5C4F3D', opacity: 0.6 }}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{label}</span>
                    <span 
                      className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ 
                        backgroundColor: '#8B7355',
                        color: 'white'
                      }}
                    >
                      Soon
                    </span>
                  </div>
                );
              }

              // Regular navigation item
              return (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                    location.pathname === path
                      ? 'border'
                      : ''
                  }`}
                  style={location.pathname === path ? {
                    backgroundColor: '#F5F1EA',
                    color: '#8B7355',
                    borderColor: '#E5DFD3'
                  } : {
                    color: '#5C4F3D'
                  }}
                  onMouseEnter={(e) => {
                    if (location.pathname !== path) {
                      e.currentTarget.style.backgroundColor = '#F5F1EA';
                      e.currentTarget.style.color = '#2C2416';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (location.pathname !== path) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#5C4F3D';
                    }
                  }}
                >
                  <Icon className="w-5 h-5" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Footer - Fixed at bottom */}
          <div className="p-4 shrink-0" style={{ borderTop: '1px solid #E5DFD3' }}>
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: '#F5F1EA' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#8B7355' }}>
                <span className="text-white font-bold">{user?.name?.[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#2C2416' }}>
                  {isDoctor() ? `Dr. ${user?.name}` : user?.name}
                </p>
                <p className="text-xs truncate" style={{ color: '#5C4F3D' }}>{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg transition-all shrink-0"
                style={{ color: '#5C4F3D' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#dc2626';
                  e.currentTarget.style.backgroundColor = '#fee2e2';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#5C4F3D';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
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
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl" style={{ borderBottom: '1px solid #E5DFD3' }}>
          <div className="flex items-center justify-between px-3 md:px-4 lg:px-8 py-3 md:py-4">
            <div className="flex items-center gap-2 md:gap-4 flex-1 md:flex-none">
              {/* Mobile Logo - Show on mobile, hide on desktop */}
              <Link to={homeLink} className="lg:hidden flex items-center gap-2 flex-shrink-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#8B7355' }}>
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-bold" style={{ color: '#2C2416' }}>HealthAI</span>
              </Link>
              
              {/* Desktop Title - Hide on mobile */}
              <h1 className="text-base md:text-lg font-semibold hidden sm:block" style={{ color: '#2C2416' }}>
                {navItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
              </h1>
            </div>

            <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
              {/* Search */}
              <div className="hidden md:flex items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#5C4F3D' }} />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="w-48 pl-10 pr-4 py-2 rounded-xl text-sm focus:outline-none"
                    style={{ 
                      backgroundColor: '#F5F1EA',
                      border: '1px solid #E5DFD3',
                      color: '#2C2416'
                    }}
                  />
                </div>
              </div>

              {/* Notifications */}
              <button className="relative p-2 rounded-xl transition-all flex-shrink-0" style={{ color: '#5C4F3D' }}>
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
              </button>

              {/* User Avatar */}
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#8B7355' }}>
                <span className="text-white font-bold text-sm">{user?.name?.[0]?.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-3 md:p-4 lg:p-8 main-content-mobile overflow-x-hidden w-full" style={location.pathname === '/nutrition' ? { padding: 0, backgroundColor: 'white' } : {}}>
          {children}
        </main>

        {/* Mobile Bottom Navigation - Only show for patients on mobile */}
        {!isAdmin() && !isDoctor() && !isAdminLayout && !isDoctorLayout && (
          <MobileBottomNav />
        )}
      </div>

      {/* Text Selection Popup - Disabled on AI Chat page */}
      {location.pathname !== '/ai-chat' && <TextSelectionPopup />}
    </div>
  );
}
