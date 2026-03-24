import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function PWAInstallPrompt() {
  const location = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
      return;
    }

    // Check if user dismissed recently
    const dismissedTime = localStorage.getItem('pwa-install-dismissed');
    if (dismissedTime) {
      const timeSinceDismissed = Date.now() - parseInt(dismissedTime);
      const twoMinutes = 2 * 60 * 1000;

      if (timeSinceDismissed < twoMinutes) {
        const remainingTime = twoMinutes - timeSinceDismissed;
        setTimeout(() => {
          setShowPrompt(true);
        }, remainingTime);
        return;
      }
    }

    // Show prompt after a short delay for better UX
    const showTimer = setTimeout(() => {
      setShowPrompt(true);
    }, 1500);

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      clearTimeout(showTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Fallback for browsers that don't support beforeinstallprompt
      alert('To install this app:\n\n1. Tap the Share button\n2. Select "Add to Home Screen"');
      handleClose();
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setIsInstalled(true);
    } else {
      console.log('User dismissed the install prompt');
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowPrompt(false);
      setIsClosing(false);
      // Store dismissal time
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    }, 300);

    // Show again after 2 minutes
    setTimeout(() => {
      setShowPrompt(true);
    }, 2 * 60 * 1000);
  };

  // Don't show if already installed or prompt is hidden
  if (isInstalled || !showPrompt) {
    return null;
  }

  return (
    <AnimatePresence>
      {showPrompt && !isClosing && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed left-0 right-0 z-[45] md:hidden"
          style={{ bottom: '80px' }}
        >
          <div className="mx-3">
            <div
              className="relative overflow-hidden rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.15)]"
              style={{
                background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
              }}
            >
              {/* Decorative elements */}
              <div
                className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10"
                style={{
                  background: 'radial-gradient(circle, white 0%, transparent 70%)',
                  transform: 'translate(30%, -30%)',
                }}
              />
              <div
                className="absolute bottom-0 left-0 w-24 h-24 rounded-full opacity-10"
                style={{
                  background: 'radial-gradient(circle, white 0%, transparent 70%)',
                  transform: 'translate(-30%, 30%)',
                }}
              />

              <div className="relative p-4">
                <div className="flex items-center gap-3">
                  {/* App Icon */}
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-inner">
                    <Smartphone className="w-6 h-6 text-white" />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm leading-tight">
                      Install take.health
                    </p>
                    <p className="text-emerald-200/80 text-xs mt-0.5 leading-tight">
                      Add to home screen for quick access
                    </p>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleClose}
                      className="px-3 py-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 text-xs font-semibold transition-all active:scale-95"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleInstallClick}
                      className="px-4 py-2 rounded-xl bg-white text-emerald-900 text-xs font-bold shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Install
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom shine line */}
              <div
                className="h-[1px] w-full"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
                }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
