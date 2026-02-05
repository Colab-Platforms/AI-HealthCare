import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, MessageSquare, Utensils, FileText, MoreVertical, Settings, LogOut, Heart, Watch, X, Calendar } from 'lucide-react';
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
      let hasModal = false;
      
      // Check for any fixed overlay (modal backdrop)
      const fixedOverlays = document.querySelectorAll('.fixed.inset-0');
      
      fixedOverlays.forEach(overlay => {
        // Check if it's a modal overlay (has bg-black or similar backdrop)
        const hasBackdrop = overlay.classList.contains('bg-black') || 
                           overlay.style.backgroundColor.includes('rgba') ||
                           overlay.style.backgroundColor.includes('rgb');
        
        // Check if it's not the main page container
        const isNotMainContainer = !overlay.classList.contains('flex') || 
                                  overlay.classList.contains('z-40') || 
                                  overlay.classList.contains('z-50');
        
        if (hasBackdrop && isNotMainContainer) {
          hasModal = true;
        }
      });
      
      // Also check for any element with z-50 or z-40 that's a modal
      if (!hasModal) {
        const highZElements = document.querySelectorAll('[class*="z-50"], [class*="z-40"]');
        highZElements.forEach(el => {
          if (el.classList.contains('fixed') && el.textContent.length > 0) {
            // Check if it looks like a modal (has rounded corners, padding, etc.)
            const style = window.getComputedStyle(el);
            if (style.position === 'fixed' && (el.classList.contains('rounded') || el.classList.contains('bg-white'))) {
              hasModal = true;
            }
          }
        });
      }
      
      hasModal = hasModal || showMoreMenu;
      
      // Hide navbar when modal is open
      const navContainer = document.querySelector('.mobile-bottom-nav-container');
      if (navContainer) {
        if (hasModal) {
          navContainer.classList.add('hidden');
        } else {
          navContainer.classList.remove('hidden');
        }
      }
    };

    // Check immediately
    checkModal();
    
    // Also check on a small delay to catch modals that render after this effect
    const timer = setTimeout(checkModal, 50);
    
    // Watch for changes with more frequent checks
    const observer = new MutationObserver(checkModal);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    
    // Also add a periodic check as fallback
    const intervalId = setInterval(checkModal, 200);
    
    return () => {
      clearTimeout(timer);
      clearInterval(intervalId);
      observer.disconnect();
    };
  }, [showMoreMenu]);

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
    { path: '/ai-chat', icon: MessageSquare, label: 'AI' },
    { path: '/nutrition', icon: Utensils, label: 'Nutrition', isCenter: true },
    { path: '/upload', icon: FileText, label: 'Reports' }
  ];

  const moreMenuItems = [
    { path: '/profile', icon: Settings, label: 'Profile' },
    { path: '/wearables', icon: Watch, label: 'Wearables', comingSoon: true },
    { path: '/diet-plan', icon: Heart, label: 'Diet Plan' },
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
        <div className="fixed bottom-24 right-4 bg-white rounded-2xl shadow-2xl z-50 w-56 overflow-hidden animate-fade-in">
          <div className="p-4 border-b border-[#E5DFD3]">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#2C2416]">Menu</h3>
              <button onClick={() => setShowMoreMenu(false)} className="text-[#5C4F3D] hover:text-[#2C2416]">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="space-y-1 p-2">
            {moreMenuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              if (item.comingSoon) {
                return (
                  <div
                    key={item.label}
                    className="w-full flex items-center justify-between px-4 py-3 text-[#5C4F3D] bg-[#F5F1EA] rounded-xl opacity-60 cursor-not-allowed text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </div>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">Soon</span>
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
                    className="w-full flex items-center gap-3 px-4 py-3 text-[#5C4F3D] hover:bg-[#F5F1EA] rounded-xl transition-colors text-sm"
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                );
              }

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setShowMoreMenu(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm ${
                    active
                      ? 'bg-[#F5F1EA] text-[#8B7355] font-medium'
                      : 'text-[#5C4F3D] hover:bg-[#F5F1EA]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="border-t border-[#E5DFD3] my-2" />

            <div className="px-4 py-2 text-xs text-[#5C4F3D] font-medium">
              {user?.name}
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors text-sm font-medium"
            >
              <LogOut className="w-5 h-5" />
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
                  className="nav-center-fab"
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
                className={`nav-item-modern ${active ? 'active' : ''}`}
                aria-label={item.label}
                title={item.label}
              >
                <Icon className="w-5 h-5" />
              </Link>
            );
          })}

          {/* More Button */}
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className={`nav-item-modern ${showMoreMenu ? 'active' : ''}`}
            aria-label="More options"
            title="More options"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </nav>
    </>
  );
}
