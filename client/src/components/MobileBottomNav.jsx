import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, MessageSquare, Utensils, FileText, MoreVertical, Settings, LogOut, Heart, Watch, X, Calendar, ScanLine, Activity, Bell } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [hideNavbar, setHideNavbar] = useState(false);

  // Check if modal is open by looking for modal elements
  useEffect(() => {
    const checkModal = () => {
      // Check for any fixed overlay with high z-index (modal backdrop)
      const fixedElements = document.querySelectorAll('.fixed');
      let hasModal = false;

      fixedElements.forEach(el => {
        // Check if it's a modal (has bg-black/50 or similar backdrop)
        const classList = el.className;
        const hasBackdrop = classList.includes('bg-black') || classList.includes('inset-0');
        const hasHighZ = classList.includes('z-50') || classList.includes('z-40');

        // If it has both backdrop and high z-index, it's likely a modal
        if (hasBackdrop && hasHighZ && el.offsetHeight > 0) {
          hasModal = true;
        }
      });

      // Also check for AI Chat page
      if (location.pathname === '/ai-chat') {
        hasModal = true;
      }

      setHideNavbar(hasModal || showMoreMenu);
    };

    // Check immediately
    checkModal();

    // Check on a small delay to catch modals that render after this effect
    const timer = setTimeout(checkModal, 100);

    // Watch for changes
    const observer = new MutationObserver(checkModal);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [location.pathname, showMoreMenu]);

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { path: '/nutrition', icon: Activity, label: 'Nutrition' },
    { path: '/quick-food-scan', icon: ScanLine, label: 'Scan Food', isCenter: true },
    { path: '/upload', icon: FileText, label: 'Reports' }
  ];

  const moreMenuItems = [
    { path: '/profile', icon: Settings, label: 'Profile' },
    { path: '/diet-plan', icon: Heart, label: 'Diet Plan' },
    { path: '/wearables', icon: Watch, label: 'Wearables', comingSoon: true },
    { path: '#appointment', icon: Calendar, label: 'Appointment', comingSoon: true }
  ];

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
    setShowMoreMenu(false);
  };

  return (
    <>
      {/* More Menu Modal */}
      {showMoreMenu && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setShowMoreMenu(false)} />
      )}

      {/* More Menu Dropdown */}
      {showMoreMenu && (
        <div className="fixed bottom-24 right-4 left-4 sm:left-auto sm:w-72 bg-white rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] z-50 overflow-hidden animate-fade-in border border-slate-100 p-2">
          <div className="p-6 bg-black rounded-[2rem] mb-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-white text-lg tracking-tighter uppercase leading-none">FitCure</h3>
                <p className="text-[10px] text-[#2FC8B9] font-black uppercase tracking-widest mt-1">Elite Menu</p>
              </div>
              <button onClick={() => setShowMoreMenu(false)} className="text-white hover:bg-white/20 rounded-xl p-2 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="space-y-1 p-3">
            {moreMenuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              if (item.comingSoon) {
                return (
                  <div
                    key={item.label}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-slate-500 bg-slate-50 rounded-xl opacity-60 cursor-not-allowed text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-semibold">Soon</span>
                  </div>
                );
              }

              if (item.path === '#appointment') {
                return (
                  <button
                    key={item.label}
                    onClick={() => {
                      toast.info('Appointment coming soon');
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-slate-700 hover:bg-[#2FC8B9]/5 rounded-xl transition-all text-sm group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#2FC8B9]/10 flex items-center justify-center group-hover:bg-[#2FC8B9]/20 transition-colors">
                      <Icon className="w-5 h-5 text-[#2FC8B9]" />
                    </div>
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              }

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setShowMoreMenu(false)}
                  className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all group ${active
                    ? 'bg-black text-white shadow-xl'
                    : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${active
                    ? 'bg-white/20'
                    : 'bg-[#2FC8B9]/10 group-hover:bg-[#2FC8B9]/20'
                    }`}>
                    <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-[#2FC8B9]'}`} />
                  </div>
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}

            <div className="border-t border-slate-100 my-3" />

            <div className="px-5 py-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-black flex items-center justify-center text-[#2FC8B9] font-black shadow-lg">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-black uppercase tracking-wider truncate">{user?.name}</p>
                <p className="text-[10px] text-slate-400 font-bold lowercase truncate">{user?.email}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-red-600 hover:bg-red-50 rounded-xl transition-all text-sm font-medium group"
            >
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                <LogOut className="w-5 h-5" />
              </div>
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      <nav className={`mobile-bottom-nav-container ${hideNavbar ? 'hidden' : ''}`}>
        <div className="mobile-bottom-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            if (item.isCenter) {
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="nav-center-fab flex flex-col items-center justify-center"
                  aria-label={item.label}
                  title={item.label}
                >
                  <Icon className="w-7 h-7" />
                </Link>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item-modern flex flex-col items-center justify-center gap-0.5 ${active ? 'active' : ''}`}
                aria-label={item.label}
                title={item.label}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[9px] font-medium">{item.label}</span>
              </Link>
            );
          })}

          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className={`nav-item-modern flex flex-col items-center justify-center gap-0.5 ${showMoreMenu ? 'active' : ''}`}
            aria-label="More"
            title="More"
          >
            <MoreVertical className="w-5 h-5" />
            <span className="text-[11px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
