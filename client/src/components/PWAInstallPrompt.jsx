import { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function PWAInstallPrompt() {
  const location = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    // Check if already installed
    const isPWAInstalled = localStorage.getItem('pwa-installed') === 'true' || 
                          window.matchMedia('(display-mode: standalone)').matches || 
                          window.navigator.standalone;

    if (isPWAInstalled) {
      setIsInstalled(true);
      return;
    }

    // Check if we captured the prompt globally in main.jsx
    if (window.__deferredInstallPrompt) {
      console.log('✅ Found captured prompt from main.jsx');
      setDeferredPrompt(window.__deferredInstallPrompt);
      setShowPrompt(true);
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      console.log('✅ beforeinstallprompt event fired inside component');
      setDeferredPrompt(e);
      window.__deferredInstallPrompt = e; 
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Show prompt for iOS anyway after a delay since they don't have beforeinstallprompt
    if (ios) {
      const showTimer = setTimeout(() => {
        const dismissedTime = localStorage.getItem('pwa-install-dismissed');
        const isActuallyInstalled = window.navigator.standalone || localStorage.getItem('pwa-installed') === 'true';
        
        if (isActuallyInstalled) return;

        const cooldown = 7 * 24 * 60 * 60 * 1000; // 7 days for iOS manual prompt reappearance
        
        if (!dismissedTime || (Date.now() - parseInt(dismissedTime) > cooldown)) {
          setShowPrompt(true);
        }
      }, 5000);
      return () => clearTimeout(showTimer);
    }

    // Listen for app installed event
    const handleAppInstalled = () => {
      console.log('✅ App installed successfully');
      localStorage.setItem('pwa-installed', 'true');
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
      window.__deferredInstallPrompt = null;
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // INSTANT SHOW LOGIC:
    // Show the prompt after a short delay for best UX if not already dismissed
    const showTimer = setTimeout(() => {
      const dismissedTime = localStorage.getItem('pwa-install-dismissed');
      const isActuallyInstalled = window.matchMedia('(display-mode: standalone)').matches || localStorage.getItem('pwa-installed') === 'true';
      
      if (isActuallyInstalled) return;

      const cooldown = 24 * 60 * 60 * 1000; // 24 hours cool down for re-prompting
      
      if (!dismissedTime || (Date.now() - parseInt(dismissedTime) > cooldown)) {
        setShowPrompt(true);
      }
    }, 2000);

    return () => {
      clearTimeout(showTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      // iOS doesn't support programmatic install, show instructions
      alert('To install take.health:\n1. Tap the Share button at the bottom of your browser\n2. Scroll down and select "Add to Home Screen"');
      return;
    }

    if (!deferredPrompt) {
      // Fallback for Android/Chrome if prompt was lost or not yet available
      console.log('❌ No deferredPrompt available');
      return;
    }

    setIsInstalling(true);
    try {
      console.log('🚀 Triggering native install prompt');
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to install: ${outcome}`);
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setShowPrompt(false);
      }
    } catch (err) {
      console.error('Install failed', err);
    } finally {
      setIsInstalling(false);
      setDeferredPrompt(null);
      window.__deferredInstallPrompt = null;
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowPrompt(false);
      setIsClosing(false);
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    }, 300);
  };

  if (isInstalled || !showPrompt) return null;

  // Banner Content based on OS
  const bannerTitle = isIOS ? "Add to Home Screen" : "Install take.health";
  const bannerDesc = isIOS ? "Tap share to install app" : "Get the full app experience";

  return (
    <AnimatePresence>
      {showPrompt && !isClosing && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="fixed left-0 right-0 z-[1000] flex justify-center px-4"
          style={{ bottom: '120px' }}
        >
          <div className="w-full max-w-sm">
            <div className="relative overflow-hidden rounded-[2rem] bg-[#064e3b] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10 p-5">
              {/* Row 1: Icon and Text */}
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-lg p-1.5 overflow-hidden">
                   <img 
                    src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/logo_with_text-1.png?v=1774261099" 
                    alt="take.health"
                    className="w-full h-full object-contain"
                   />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <p className="text-white font-black text-sm tracking-tight">{bannerTitle}</p>
                    <p className="text-emerald-200/60 text-[10px] font-bold uppercase tracking-wider">{bannerDesc}</p>
                  </div>
                </div>
              </div>

              {/* Row 2: Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-200/70 hover:text-white transition-all active:scale-95"
                >
                  Not now
                </button>
                <button
                  onClick={handleInstallClick}
                  disabled={isInstalling}
                  className="bg-white text-[#064e3b] px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-black/10 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isInstalling ? '...' : (isIOS ? 'Instructions' : 'Install')}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
