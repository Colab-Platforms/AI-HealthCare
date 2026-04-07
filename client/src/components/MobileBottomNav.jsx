import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import {
  LayoutDashboard, MessageSquare, Utensils, FileText, MoreVertical,
  Settings, LogOut, Heart, Watch, X, Calendar, ScanLine,
  Activity, Bell, Plus, Scale, Droplets, Moon, Footprints,
  Apple, Sparkles, Trophy, BarChart3, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { dashboardData } = useData() || {};
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Determine the best path for 'Reports' tab
  // If there's an active processing report, go there; otherwise go to upload
  const processingReportId = dashboardData?.processingReport?._id;
  const reportsPath = processingReportId ? `/reports/${processingReportId}` : '/upload';

  // Check if modal is open by looking for modal elements
  useEffect(() => {
    const checkModal = () => {
      const fixedElements = document.querySelectorAll('.fixed');
      let foundModal = false;

      fixedElements.forEach(el => {
        const classList = el.className || '';
        const hasBackdrop = classList.includes('bg-black') || classList.includes('bg-slate-900') || classList.includes('inset-0');
        const hasHighZ = classList.includes('z-50') || classList.includes('z-40') || classList.includes('z-[100]') || classList.includes('z-[999]');
        const isDataModal = el.getAttribute('data-modal') === 'true';

        if ((hasBackdrop && hasHighZ && el.offsetHeight > 0) || isDataModal) {
          foundModal = true;
        }
      });

      setIsModalOpen(foundModal);
    };

    checkModal();
    const timer = setTimeout(checkModal, 100);
    const observer = new MutationObserver(checkModal);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [location.pathname, showMoreMenu]);

  // Routes where the navbar should be completely hidden
  const isExcludedPage = location.pathname === '/ai-chat' || location.pathname === '/profile';

  // Logic to hide the navbar UI but keep the component mounted (to allow the log modal to open)
  const hideNavbarUI = isModalOpen || showMoreMenu;

  const isDiabetic = user?.profile?.isDiabetic === 'yes';
  const hasSeenTour = user?.profile?.hasSeenMobileTour || 
                      (user?._id && localStorage.getItem(`joyride-completed-${user._id}`) === 'true') ||
                      localStorage.getItem("joyride-completed-any") === 'true';

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    isDiabetic
      ? { path: '/complete-analysis', icon: BarChart3, label: 'Analysis' }
      : { path: '/nutrition', icon: Activity, label: 'Nutrition', image: 'https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Icon_3.svg?v=1775560186' },
    { path: '#log', icon: Plus, label: 'Log', isCenter: true },
    { path: reportsPath, icon: FileText, label: 'Reports' },
  ];

  const logActivities = [
    { label: 'Food Log', icon: Utensils, path: '/nutrition', color: 'text-orange-500', borderColor: 'border-orange-100', iconBg: 'bg-orange-50', state: { openLogMeal: true } },
    isDiabetic
      ? { label: 'Nutrition', icon: Activity, path: '/nutrition', color: 'text-emerald-700', borderColor: 'border-emerald-100', iconBg: 'bg-emerald-50' }
      : { label: 'Analysis', icon: BarChart3, path: '/complete-analysis', color: 'text-purple-600', borderColor: 'border-purple-100', iconBg: 'bg-purple-50' },
    { label: 'Ask Coach', icon: Sparkles, path: '/ai-chat', color: 'text-emerald-600', borderColor: 'border-emerald-100', iconBg: 'bg-emerald-50' },
    { label: 'Challenge', icon: Trophy, path: '/challenge', color: 'text-amber-500', borderColor: 'border-amber-100', iconBg: 'bg-amber-50' },
    { label: 'Steps', icon: Footprints, path: '/dashboard', color: 'text-indigo-500', borderColor: 'border-indigo-100', iconBg: 'bg-indigo-50', state: { openLogVitals: 'Steps' } },
    { label: 'Sleep', icon: Moon, path: '/dashboard', color: 'text-blue-500', borderColor: 'border-blue-100', iconBg: 'bg-blue-50', state: { openLogVitals: 'Sleep' } },
    { label: 'Weight', icon: Scale, path: '/dashboard', color: 'text-emerald-500', borderColor: 'border-emerald-100', iconBg: 'bg-emerald-50', state: { openLogVitals: 'Weight' } },
    { label: 'Water', icon: Droplets, path: '/dashboard', color: 'text-cyan-500', borderColor: 'border-cyan-100', iconBg: 'bg-cyan-50', state: { openLogVitals: 'Water' } }
  ];

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

  if (isExcludedPage) return null;

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
              <div className="flex items-center">
                <img
                  src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/logo_with_text-1.png?v=1774261099"
                  alt="take.health"
                  className="h-8 w-auto object-contain brightness-0 invert"
                />
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
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 h-[90vh] bg-[#EBF1E5] rounded-t-[40px] z-[101] md:hidden shadow-[0_-10px_40px_rgba(0,0,0,0.12)] select-none border-t border-white/40 overflow-hidden"
            >
              <div className="p-5 pt-3 pb-[140px] max-h-[90vh] overflow-y-auto scrollbar-hide">
                {/* Grab Handle */}
                <div className="w-10 h-1 bg-gray-400/10 rounded-full mx-auto mb-5"></div>

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[19px] font-black text-[#1A2138] tracking-tight">Quick Log</h3>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#064e3b] bg-emerald-500/10 px-2.5 py-1.5 rounded-full border border-emerald-500/10">Primary</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3.5 mb-3.5">
                  {/* Add Meal */}
                  <button 
                    onClick={() => { setShowLogModal(false); navigate('/nutrition', { state: { openLogMeal: true } }); }}
                    className="bg-white p-4 rounded-[24px] shadow-[0_4px_15px_rgba(0,0,0,0.02)] border border-white hover:scale-[1.02] active:scale-95 transition-all duration-300 flex flex-col items-center justify-center gap-2"
                  >
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                      <Utensils size={24} className="text-[#69A38D]" strokeWidth={2.5} />
                    </div>
                    <div className="text-center">
                      <div className="text-[14px] font-extrabold text-[#1A2138] mb-0">Add Meal</div>
                      <div className="text-[10px] text-slate-400 font-semibold">Daily intake</div>
                    </div>
                  </button>

                  {/* Lab Insights */}
                  <button 
                    onClick={() => { setShowLogModal(false); navigate('/upload'); }}
                    className="bg-white p-4 rounded-[24px] shadow-[0_4px_15px_rgba(0,0,0,0.02)] border border-white hover:scale-[1.02] active:scale-95 transition-all duration-300 flex flex-col items-center justify-center gap-2"
                  >
                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                      <img src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Icon_1.svg?v=1775559212" alt="Lab Insights" className="w-7 h-7 object-contain" />
                    </div>
                    <div className="text-center">
                      <div className="text-[14px] font-extrabold text-[#1A2138] mb-0">Lab Insights</div>
                      <div className="text-[10px] text-slate-400 font-semibold">Direct clarity</div>
                    </div>
                  </button>
                </div>

                {/* Dynamic Insight Card - Logic based on Navbar Tab */}
                <div className="mb-5">
                  {isDiabetic ? (
                    <button 
                      onClick={() => { setShowLogModal(false); navigate('/nutrition'); }}
                      className="w-full bg-white/60 p-4 rounded-[26px] border border-[#A4B0C9]/30 hover:bg-white/80 active:scale-[0.98] transition-all duration-300 flex items-center justify-between group px-5 shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 bg-white rounded-[16px] flex items-center justify-center shadow-sm border border-[#A4B0C9]/10">
                          <Utensils size={22} className="text-[#7C8BA8]" strokeWidth={2.5} />
                        </div>
                        <div className="text-left">
                          <div className="text-[16px] font-extrabold text-[#445577] mb-0.5 tracking-tight px-0.5">Nutrition Insights</div>
                          <div className="text-[11px] text-[#7C8BA8] font-bold px-0.5">Review daily intake</div>
                        </div>
                      </div>
                      <div className="text-[#7C8BA8]/50 group-hover:text-[#7C8BA8] group-hover:translate-x-1 transition-all duration-300">
                        <ArrowRight size={20} strokeWidth={2.5} />
                      </div>
                    </button>
                  ) : (
                    <button 
                      onClick={() => { setShowLogModal(false); navigate('/complete-analysis'); }}
                      className="w-full bg-white/60 p-4 rounded-[26px] border border-[#A4B0C9]/30 hover:bg-white/80 active:scale-[0.98] transition-all duration-300 flex items-center justify-between group px-5 shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 bg-white rounded-[16px] flex items-center justify-center shadow-sm border border-[#A4B0C9]/10">
                          <BarChart3 size={22} className="text-[#7C8BA8]" strokeWidth={2.5} />
                        </div>
                        <div className="text-left">
                          <div className="text-[16px] font-extrabold text-[#445577] mb-0.5 tracking-tight px-0.5">Progress Insights</div>
                          <div className="text-[11px] text-[#7C8BA8] font-bold px-0.5">Review vitality metrics</div>
                        </div>
                      </div>
                      <div className="text-[#7C8BA8]/50 group-hover:text-[#7C8BA8] group-hover:translate-x-1 transition-all duration-300">
                        <ArrowRight size={20} strokeWidth={2.5} />
                      </div>
                    </button>
                  )}
                </div>

                {/* Tracking Section */}
                <div className="bg-white/40 p-5 rounded-[32px] border border-white/40 shadow-sm mb-4">
                  <h3 
                    style={{ color: '#1A2138', fontSize: '13.62px', fontFamily: 'Poppins', fontWeight: '700', lineHeight: '20.43px', wordWrap: 'break-word' }}
                    className="uppercase tracking-[0.08em] mb-5 flex items-center gap-2"
                  >
                    Track Your Daily Activities
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => { setShowLogModal(false); navigate('/dashboard', { state: { openLogVitals: 'Weight' } }); }} className="flex items-center gap-3.5 bg-white p-3.5 rounded-[22px] shadow-sm border border-white/80 hover:bg-slate-50 active:scale-95 transition-all group">
                      <div className="bg-emerald-50 w-9 h-9 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Scale size={18} className="text-emerald-500" />
                      </div>
                      <span style={{ color: '#1A2138', fontSize: '12.71px', fontFamily: 'Poppins', fontWeight: '700', lineHeight: '19.06px', wordWrap: 'break-word' }}>Weight</span>
                    </button>

                    <button onClick={() => { setShowLogModal(false); navigate('/dashboard', { state: { openLogVitals: 'Water' } }); }} className="flex items-center gap-3.5 bg-white p-3.5 rounded-[22px] shadow-sm border border-white/80 hover:bg-slate-50 active:scale-95 transition-all group">
                      <div className="bg-blue-50 w-9 h-9 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <img src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Icon.svg?v=1775559081" alt="Water" className="w-5 h-5 object-contain" />
                      </div>
                      <span style={{ color: '#1A2138', fontSize: '12.71px', fontFamily: 'Poppins', fontWeight: '700', lineHeight: '19.06px', wordWrap: 'break-word' }}>Water</span>
                    </button>

                    <button onClick={() => { setShowLogModal(false); navigate('/dashboard', { state: { openLogVitals: 'Sleep' } }); }} className="flex items-center gap-3.5 bg-white p-3.5 rounded-[22px] shadow-sm border border-white/80 hover:bg-slate-50 active:scale-95 transition-all group">
                      <div className="bg-purple-50 w-9 h-9 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Moon size={18} className="text-purple-500" />
                      </div>
                      <span style={{ color: '#1A2138', fontSize: '12.71px', fontFamily: 'Poppins', fontWeight: '700', lineHeight: '19.06px', wordWrap: 'break-word' }}>Sleep</span>
                    </button>

                    <button onClick={() => { setShowLogModal(false); navigate('/dashboard', { state: { openLogVitals: 'Steps' } }); }} className="flex items-center gap-3.5 bg-white p-3.5 rounded-[22px] shadow-sm border border-white/80 hover:bg-slate-50 active:scale-95 transition-all group">
                      <div className="bg-orange-50 w-9 h-9 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Footprints size={18} className="text-orange-500" />
                      </div>
                      <span style={{ color: '#1A2138', fontSize: '12.71px', fontFamily: 'Poppins', fontWeight: '700', lineHeight: '19.06px', wordWrap: 'break-word' }}>Steps</span>
                    </button>
                  </div>
                </div>

                {/* Additional Features Row */}
                <div className="grid grid-cols-2 gap-3 mt-auto">
                  <button onClick={() => { setShowLogModal(false); navigate('/ai-chat'); }} className="flex items-center gap-3 p-3.5 bg-white/40 rounded-[22px] border border-white hover:bg-white active:scale-95 transition-all justify-center">
                    <Sparkles className="text-emerald-600" size={16} />
                    <span className="text-[10px] font-black text-[#1A2138] uppercase tracking-tighter">Ask Coach</span>
                  </button>
                  <button onClick={() => { setShowLogModal(false); navigate('/challenge'); }} className="flex items-center gap-3 p-3.5 bg-white/40 rounded-[22px] border border-white hover:bg-white active:scale-95 transition-all justify-center">
                    <Trophy className="text-amber-500" size={16} />
                    <span className="text-[10px] font-black text-[#1A2138] uppercase tracking-tighter">Challenge</span>
                  </button>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav 
        className={`mobile-bottom-nav-container ${hideNavbarUI ? 'hidden' : ''} !bg-[#EBF0E6] border-t border-emerald-100/30 shadow-[0_-5px_20px_rgba(0,0,0,0.03)] z-[250] !fixed bottom-0 left-0 right-0`}
        style={{ zIndex: 250 }}
      >
        <div className="mobile-bottom-nav">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            const key = `${item.label}-${index}`;

            if (item.isCenter) {
              return (
                <button
                  key={key}
                  onClick={() => setShowLogModal(!showLogModal)}
                  className={`nav-center-fab flex items-center justify-center transition-all duration-400 ${hasSeenTour ? 'no-pulse' : ''}`}
                  style={showLogModal ? {
                    width: '64px',
                    height: '64px',
                    transform: 'translateX(-50%) rotate(45deg)',
                    background: '#FF2056',
                    boxShadow: '0px 8px 20px rgba(244, 63, 94, 0.35)',
                    borderRadius: '50%',
                    outline: '2.45px #E2EED2 solid',
                    outlineOffset: '-2.45px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    border: 'none'
                  } : {}}
                  aria-label={item.label}
                  title={item.label}
                >
                  {showLogModal ? (
                    <img src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Icon_2.svg?v=1775559853" alt="Close" className="w-10 h-10 rotate-[-45deg]" />
                  ) : (
                    <Plus className="w-6 h-6 text-white" strokeWidth={3} />
                  )}
                </button>
              );
            }

            return (
              <Link
                key={key}
                to={item.path}
                state={item.state}
                className={`nav-item-modern flex flex-col items-center justify-center gap-0.5 ${active ? 'active' : ''} text-[#065f46]/50 [&.active]:text-[#064e3b]`}
                aria-label={item.label}
                title={item.label}
              >
                {item.image ? (
                  <img 
                    src={item.image} 
                    alt={item.label} 
                    className={`w-5 h-5 object-contain transition-all duration-300 ${active ? 'scale-110' : 'opacity-40 grayscale group-hover:opacity-80 group-hover:grayscale-0'}`} 
                  />
                ) : (
                  <Icon className="w-5 h-5 transition-transform group-hover:scale-110" />
                )}
                <span className="text-[10px] font-black tracking-tight mt-0.5">{item.label}</span>
              </Link>
            );
          })}

          <Link
            to="/diet-plan"
            className={`nav-item-modern flex flex-col items-center justify-center gap-0.5 ${isActive('/diet-plan') ? 'active' : ''} text-[#065f46]/50 [&.active]:text-[#064e3b]`}
            aria-label="Diet Plan"
            title="Diet Plan"
          >
            <Apple className="w-5 h-5" />
            <span className="text-[10px] font-black tracking-tight mt-0.5">Diet Plan</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
