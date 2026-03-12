import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, MessageSquare, Utensils, FileText, MoreVertical, Settings, LogOut, Heart, Watch, X, Calendar, ScanLine, Activity, Bell, Plus, Scale, Droplets, Moon, Footprints, Apple } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Check if modal is open by looking for modal elements
  useEffect(() => {
    const checkModal = () => {
      // Check for any fixed overlay with high z-index (modal backdrop)
      const fixedElements = document.querySelectorAll('.fixed');
      let foundModal = false;

      fixedElements.forEach(el => {
        // Check if it's a modal (has backdrop, high z-index, or data-modal)
        const classList = el.className || '';
        const hasBackdrop = classList.includes('bg-black') || classList.includes('bg-slate-900') || classList.includes('inset-0');
        const hasHighZ = classList.includes('z-50') || classList.includes('z-40') || classList.includes('z-[100]') || classList.includes('z-[999]');
        const isDataModal = el.getAttribute('data-modal') === 'true';

        // If it has backdrop/inset and high z-index, it's likely a modal
        if ((hasBackdrop && hasHighZ && el.offsetHeight > 0) || isDataModal) {
          foundModal = true;
        }
      });

      setIsModalOpen(foundModal);
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

  const hideNavbar = isModalOpen || showMoreMenu || showLogModal;

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { path: '/nutrition', icon: Activity, label: 'Nutrition' },
    { path: '#log', icon: Plus, label: 'Log', isCenter: true },
    { path: '/upload', icon: FileText, label: 'Reports' }
  ];

  const logActivities = [
    { label: 'Food Log', icon: Utensils, path: '/nutrition', color: 'text-black', iconBg: 'bg-slate-50', state: { openLogMeal: true } },
    { label: 'Sleep', icon: Moon, path: '/log-vitals/sleep', color: 'text-black', iconBg: 'bg-slate-50' },
    { label: 'Weight', icon: Scale, path: '/log-vitals/weight', color: 'text-black', iconBg: 'bg-slate-50' },
    { label: 'Water', icon: Droplets, path: '/nutrition', color: 'text-black', iconBg: 'bg-slate-50', state: { scrollToWater: true } },
  ];

  const exploreServices = []; // Removed to focus on 4 core items

  const moreMenuItems = [
    { path: '/profile', icon: Settings, label: 'Profile' },
    { path: '/diet-plan', icon: Heart, label: 'Diet Plan' }
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
          <div className="p-6 bg-slate-900 rounded-[2rem] mb-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-white text-lg tracking-tighter uppercase leading-none">FitCure</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Elite Menu</p>
              </div>
              <button onClick={() => setShowMoreMenu(false)} className="text-white hover:bg-white/10 rounded-xl p-2 transition-colors">
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
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-slate-700 hover:bg-slate-50 rounded-xl transition-all text-sm group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                      <Icon className="w-5 h-5 text-slate-600" />
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
                    : 'bg-slate-100 group-hover:bg-slate-200'
                    }`}>
                    <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-slate-600'}`} />
                  </div>
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}

            <div className="border-t border-slate-100 my-3" />

            <div className="px-5 py-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-black flex items-center justify-center text-white font-black shadow-lg">
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

      <AnimatePresence>
        {showLogModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] md:hidden"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[3.5rem] z-[101] md:hidden p-8 pb-12 shadow-[0_-20px_80px_rgba(0,0,0,0.2)] border-t border-slate-100 h-[50vh] overflow-hidden"
            >
              <div className="w-16 h-1.5 bg-slate-100 rounded-full mx-auto mb-10" />

              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-black tracking-tight uppercase">Quick Log</h3>
                <button
                  onClick={() => setShowLogModal(false)}
                  className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-black active:bg-slate-100 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {logActivities.map((act) => {
                  const Icon = act.icon;
                  return (
                    <Link
                      key={act.label}
                      to={act.path}
                      state={act.state}
                      onClick={() => setShowLogModal(false)}
                      className="flex items-center gap-4 p-5 rounded-[2.5rem] border border-slate-100 bg-white shadow-sm active:scale-95 transition-all group hover:bg-black hover:text-white"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 group-hover:bg-white/10">
                        <Icon className="w-6 h-6 text-black group-hover:text-white" />
                      </div>
                      <span className="text-sm font-black tracking-tight uppercase">{act.label}</span>
                    </Link>
                  );
                })}
              </div>

              <div className="mt-12 flex justify-center">
                <button
                  onClick={() => setShowLogModal(false)}
                  className="w-14 h-14 rounded-full bg-black text-white flex items-center justify-center shadow-xl active:scale-90 transition-transform"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav className={`mobile-bottom-nav-container ${hideNavbar ? 'hidden' : ''} !bg-white border-t border-slate-200/50 shadow-[0_-5px_20px_rgba(0,0,0,0.03)]`}>
        <div className="mobile-bottom-nav">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            const key = `${item.label}-${index}`;

            if (item.isCenter) {
              return (
                <button
                  key={key}
                  onClick={() => setShowLogModal(true)}
                  className="nav-center-fab flex flex-col items-center justify-center !bg-black !shadow-black/20"
                  aria-label={item.label}
                  title={item.label}
                >
                  <Icon className="w-8 h-8 text-white" />
                </button>
              );
            }

            return (
              <Link
                key={key}
                to={item.path}
                state={item.state}
                className={`nav-item-modern flex flex-col items-center justify-center gap-0.5 ${active ? 'active' : ''} text-slate-400 [&.active]:text-white`}
                aria-label={item.label}
                title={item.label}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-tighter mt-0.5">{item.label}</span>
              </Link>
            );
          })}

          <Link
            to="/diet-plan"
            className={`nav-item-modern flex flex-col items-center justify-center gap-0.5 ${isActive('/diet-plan') ? 'active' : ''} text-slate-400 [&.active]:text-white`}
            aria-label="Diet Plan"
            title="Diet Plan"
          >
            <Apple className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-tighter mt-0.5">Diet Plan</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
