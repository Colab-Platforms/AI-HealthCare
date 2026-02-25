import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Show prompt immediately on mobile, after 5 seconds on desktop
      const isMobile = window.innerWidth < 768;
      const delay = isMobile ? 1000 : 5000;
      
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, delay);

      return () => clearTimeout(timer);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
      toast.success('🎉 FitCure app installed successfully!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Show prompt every 2 minutes if dismissed
  useEffect(() => {
    if (!deferredPrompt || isInstalled) return;

    const interval = setInterval(() => {
      setShowPrompt(true);
    }, 2 * 60 * 1000); // 2 minutes in milliseconds

    return () => clearInterval(interval);
  }, [deferredPrompt, isInstalled]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      toast.success('Installing FitCure app...');
    } else {
      toast('You can install later from browser menu', { icon: '💡' });
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't save to localStorage - let it show again after 2 minutes
    // No toast notification - silent dismiss
  };

  if (isInstalled || !showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <>
      {/* Mobile - Bottom sticky banner */}
      <div className="md:hidden fixed bottom-20 left-0 right-0 z-50 px-3 animate-slide-up">
        <div className="bg-gradient-to-r from-purple-500 to-orange-600 rounded-2xl shadow-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white text-sm">Install FitCure App</h3>
              <p className="text-xs text-white/90">Quick access from home screen</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={handleInstall}
                className="px-4 py-2 bg-white text-cyan-600 rounded-xl font-bold hover:bg-white/90 transition-all text-sm shadow-lg"
              >
                Install
              </button>
              <button
                onClick={handleDismiss}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop - Bottom right card */}
      <div className="hidden md:block fixed bottom-8 right-8 z-40 animate-slide-up">
        <div className="bg-white rounded-2xl shadow-2xl border-2 border-cyan-200 p-6 max-w-sm">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                <Download className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Install FitCure</h3>
                <p className="text-sm text-slate-600">Progressive Web App</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-slate-400 hover:text-slate-600 flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-slate-600 mb-4">
            ✨ Install FitCure for quick access to your health data
            <br />
            📱 Works offline with cached data
            <br />
            🚀 Faster loading and better performance
          </p>

          <div className="flex gap-3">
            <button
              onClick={handleInstall}
              className="flex-1 px-5 py-3 bg-gradient-to-r from-purple-500 to-orange-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              Install Now
            </button>
            <button
              onClick={handleDismiss}
              className="px-5 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-all"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
