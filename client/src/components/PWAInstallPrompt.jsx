import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
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
      
      // Show prompt immediately on mobile, after 3 seconds on desktop
      const isMobile = window.innerWidth < 768;
      const delay = isMobile ? 500 : 3000;
      
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
      toast.success('App installed successfully!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      toast.success('Installing HealthAI app...');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (isInstalled || !showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-40 animate-slide-up">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E5DFD3] p-4 md:p-6 max-w-sm">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center flex-shrink-0">
              <Download className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-[#2C2416] text-sm md:text-base">Install HealthAI</h3>
              <p className="text-xs md:text-sm text-[#5C4F3D]">Add to your home screen</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-[#5C4F3D] hover:text-[#2C2416] flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs md:text-sm text-[#5C4F3D] mb-4">
          Get quick access to your health data and features offline
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleInstall}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-medium hover:shadow-lg transition-all text-sm md:text-base"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 px-4 py-2 bg-[#F5F1EA] text-[#2C2416] rounded-xl font-medium hover:bg-[#E5DFD3] transition-all text-sm md:text-base"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
